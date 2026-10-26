import { useEffect, useRef, useState, type ReactNode } from "react";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { getDoc, doc } from "firebase/firestore";
import { ANALYSIS_OBJECTIVE_MAX_LENGTH, createSchema, LIMITS, type CreateAnalysis } from "../../functions/src/contracts";
import { useFileSelectionState } from "../hooks/use-file-selection";
import { WorkspaceContext, type Draft, type PreparationPhase, type UploadingFile } from "../lib/workspace-context";
import { useBeforeUnload } from "../hooks/use-before-unload";
import { getServices } from "../lib/firebase";
import { userError } from "../lib/errors";
import { authOnlyPreview } from "../lib/deployment-mode";
import { tr } from "../i18n/tr";

// Oturum boyunca dosya taslağını ve yüklemeyi yaşatır; sayfa değişimi işi kesmez.
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const selection = useFileSelectionState();
  const [draftState, setDraftState] = useState<{ draft: Draft; originalObjective: string | null }>({ draft: { title: "", business: "", objective: "" }, originalObjective: null });
  const { draft, originalObjective } = draftState;
  const [phase, setPhase] = useState<PreparationPhase>("idle");
  const busy = phase !== "idle";
  const [uploadingFile, setUploadingFile] = useState<UploadingFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");
  const task = useRef<UploadTask | null>(null);
  const lock = useRef(false);
  const cancelled = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  useBeforeUnload(selection.files.length > 0 || busy);
  useEffect(() => () => { cancelled.current = true; task.current?.cancel(); }, []);

  // Kullanıcının hedefi değişince eski geri alma kaydını bırakır; başlık/işletme düzenlemek bu kaydı bozmaz.
  function setDraft(update: (draft: Draft) => Draft) {
    setDraftState(current => {
      const next = update(current.draft);
      return { draft: next, originalObjective: next.objective === current.draft.objective ? current.originalObjective : null };
    });
  }

  // Birden fazla örnek denense de ilk kullanıcı metnini oturum içindeki taslakla birlikte korur.
  function applyObjectiveExample(objective: string) {
    if (lock.current) return;
    setDraftState(current => current.draft.objective === objective ? current : { draft: { ...current.draft, objective }, originalObjective: current.originalObjective ?? current.draft.objective });
  }

  // Yalnız örnek seçimiyle değişen hedefi geri alır; sonradan yazılmış kullanıcı metnine dokunmaz.
  function undoObjectiveExample() {
    if (lock.current) return;
    setDraftState(current => current.originalObjective === null ? current : { draft: { ...current.draft, objective: current.originalObjective }, originalObjective: null });
  }

  // Aynı taslağı tekrar gönderirken aynı istek kimliğini kullanarak ağ belirsizliğinde çift iş açmaz.
  async function start() {
    if (lock.current) return;
    setError("");
    if (authOnlyPreview) { setError("Bu önizlemede belge hazırlama henüz etkin değil."); return; }
    if (!selection.files.length) { setError(tr.analysis.empty); return; }
    const body = {
      title: draft.title,
      business: draft.business,
      objective: draft.objective,
      files: selection.files.map(({ file }) => ({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" })),
    };
    const signature = JSON.stringify({ body, ids: selection.files.map(f => f.id) });
    if (!request.current || request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    const parsed = createSchema.safeParse({ ...body, requestId: request.current.id });
    if (!parsed.success) {
      setError(parsed.error.issues.some(issue => issue.path[0] === "objective")
        ? `Analiz hedefini belirtin (en fazla ${ANALYSIS_OBJECTIVE_MAX_LENGTH} karakter).`
        : `İşletme ve analiz başlığını doldurun. Free sınırları: ${LIMITS.files} dosya ve toplam ${LIMITS.totalBytes / 1024 ** 2} MB/analiz.`);
      return;
    }
    lock.current = true; cancelled.current = false; setPhase("creating"); setUploadingFile(null); setProgress(0);
    try {
      const services = getServices();
      const create = httpsCallable<CreateAnalysis, { id: string; paths: string[] }>(services.functions, "createAnalysis");
      const { data } = await create(parsed.data);
      if (cancelled.current) throw new Error("Yükleme iptal edildi.");
      setActiveId(data.id);
      const uid = services.auth.currentUser!.uid;
      const existing = await getDoc(doc(services.db, "users", uid, "analyses", data.id));
      if (["processing", "review", "completed"].includes(existing.data()?.status)) return { id: data.id, ready: existing.data()?.status === "completed" };
      const total = selection.files.reduce((n, f) => n + f.file.size, 0);
      let completed = 0;
      for (const [i, item] of selection.files.entries()) {
        if (cancelled.current) throw new Error("Yükleme iptal edildi.");
        setPhase("uploading");
        setUploadingFile({ name: item.file.name, index: i + 1, total: selection.files.length });
        await new Promise<void>((resolve, reject) => {
          const upload = uploadBytesResumable(ref(services.storage, data.paths[i]), item.file, { contentType: item.file.type || "application/octet-stream" });
          task.current = upload;
          upload.on("state_changed", snapshot => setProgress(Math.round((completed + snapshot.bytesTransferred) / total * 100)), reject, resolve);
        });
        completed += item.file.size;
      }
      task.current = null;
      if (cancelled.current) throw new Error("Yükleme iptal edildi.");
      setPhase("preparing");
      setUploadingFile(null);
      const result = await httpsCallable<{ id: string }, { needsReview?: boolean; ready: boolean }>(services.functions, "prepareAnalysis", { timeout: 310_000 })({ id: data.id });
      return { id: data.id, ready: result.data.ready === true };
    } catch (e) { if (!cancelled.current) setError(userError(e)); else setError("Yükleme iptal edildi; dosyalarınız korundu."); }
    finally { task.current = null; lock.current = false; setPhase("idle"); setUploadingFile(null); }
  }
  // Başarılı hazırlıktan sonra dosya, başlık ve hedefi temizler; işletme ve son iş bağlantısını korur.
  function completeDraft() {
    // Başka bir çalışmaya geçildiyse önceki kaydın tamamlanması yeni taslağı temizlemez.
    const body = { title: draft.title, business: draft.business, objective: draft.objective, files: selection.files.map(({ file }) => ({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" })) };
    if (request.current?.signature !== JSON.stringify({ body, ids: selection.files.map(f => f.id) })) return;
    selection.clearFiles();
    setDraftState(current => ({ draft: { ...current.draft, title: "", objective: "" }, originalObjective: null }));
    setProgress(0);
    setError("");
    request.current = null;
  }
  function cancel() { cancelled.current = true; task.current?.cancel(); }
  return <WorkspaceContext.Provider value={{ selection, draft, setDraft, canUndoObjectiveExample: originalObjective !== null, applyObjectiveExample, undoObjectiveExample, busy, progress, phase, uploadingFile, error, activeId, start, completeDraft, cancel }}>{children}</WorkspaceContext.Provider>;
}
