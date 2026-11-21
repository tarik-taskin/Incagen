import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { getDoc, doc } from "firebase/firestore";
import { ANALYSIS_OBJECTIVE_MAX_LENGTH, createSchema, LIMITS, type CreateAnalysis } from "../../functions/src/contracts";
import { useFileSelectionState } from "../hooks/use-file-selection";
import { type PreparedFile } from "../features/files/file-rules";
import { WorkspaceContext, type Draft, type PreparationOutcome, type PreparationPhase, type UploadingFile } from "../lib/workspace-context";
import { useBeforeUnload } from "../hooks/use-before-unload";
import { getServices } from "../lib/firebase";
import { userError } from "../lib/errors";
import { authOnlyPreview } from "../lib/deployment-mode";
import { tr } from "../i18n/tr";

// Gönderilen taslağın dosya ve metin kimliğini değişim denetimi için serileştirir.
function buildDraftSignature(draft: Draft, files: readonly PreparedFile[]) {
  return JSON.stringify({
    body: {
      title: draft.title,
      business: draft.business,
      objective: draft.objective,
      files: files.map(({ file }) => ({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" })),
    },
    ids: files.map(f => f.id),
  });
}

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
  const [draftAnalysisId, setDraftAnalysisId] = useState("");
  const [outcome, setOutcome] = useState<PreparationOutcome | null>(null);
  const active = useRef(true);
  const task = useRef<UploadTask | null>(null);
  const lock = useRef(false);
  const cancelled = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const latestSignatureRef = useRef("");
  const jobDraftSignaturesRef = useRef(new Map<string, string>());
  useBeforeUnload(selection.files.length > 0 || busy);

  useEffect(() => {
    latestSignatureRef.current = buildDraftSignature(draft, selection.files);
  }, [draft, selection.files]);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      cancelled.current = true;
      task.current?.cancel();
    };
  }, []);

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

  function dismissOutcome() {
    setOutcome(null);
  }

  const wrappedSelection = useMemo(() => ({
    ...selection,
    // Yerel dosyalar tamamen temizlendiğinde eski inceleme kaydının taslak sahipliği geri gelmez.
    removeFile: (fileId: string) => {
      const removesLastFile = selection.files.length <= 1 && selection.files.some(file => file.id === fileId);
      if (removesLastFile) {
        if (draftAnalysisId) jobDraftSignaturesRef.current.delete(draftAnalysisId);
        setDraftAnalysisId("");
      }
      selection.removeFile(fileId);
    },
    clearFiles: () => {
      if (draftAnalysisId) jobDraftSignaturesRef.current.delete(draftAnalysisId);
      setDraftAnalysisId("");
      selection.clearFiles();
    },
  }), [selection, draftAnalysisId]);

  // Yalnız gönderilenle hâlâ aynı kalan taslağın dosya, başlık ve hedefini temizler; işletme ve diğer istek kimlikleri kalır.
  function clearMatchedDraft(expectedSignature: string) {
    if (latestSignatureRef.current !== expectedSignature) return;
    selection.clearFiles();
    setDraftState(current => ({ draft: { ...current.draft, title: "", objective: "" }, originalObjective: null }));
    setDraftAnalysisId("");
    setProgress(0);
    setError("");
    if (request.current?.signature === expectedSignature) {
      request.current = null;
    }
  }

  // Aynı taslağı tekrar gönderirken aynı istek kimliğini kullanarak ağ belirsizliğinde çift iş açmaz.
  async function start() {
    if (lock.current) return;
    setError("");
    setOutcome(null);
    if (authOnlyPreview) { setError("Bu önizlemede belge hazırlama henüz etkin değil."); return; }
    if (!selection.files.length) { setError(tr.analysis.empty); return; }
    const body = {
      title: draft.title,
      business: draft.business,
      objective: draft.objective,
      files: selection.files.map(({ file }) => ({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" })),
    };
    const signature = buildDraftSignature(draft, selection.files);
    if (!request.current || request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    const parsed = createSchema.safeParse({ ...body, requestId: request.current.id });
    if (!parsed.success) {
      setError(parsed.error.issues.some(issue => issue.path[0] === "objective")
        ? `Analiz hedefini belirtin (en fazla ${ANALYSIS_OBJECTIVE_MAX_LENGTH} karakter).`
        : `İşletme ve analiz başlığını doldurun. Free sınırları: ${LIMITS.files} dosya ve toplam ${LIMITS.totalBytes / 1024 ** 2} MB/analiz.`);
      return;
    }
    const expectedUid = getServices().auth.currentUser?.uid;
    const isSameSession = () => active.current && getServices().auth.currentUser?.uid === expectedUid;
    let createdId = "";
    lock.current = true; cancelled.current = false; setDraftAnalysisId(""); setPhase("creating"); setUploadingFile(null); setProgress(0);
    selection.dismissAcceptance();
    try {
      const services = getServices();
      const create = httpsCallable<CreateAnalysis, { id: string; paths: string[] }>(services.functions, "createAnalysis");
      const { data } = await create(parsed.data);
      if (!isSameSession()) return;
      if (cancelled.current) throw new Error("Yükleme iptal edildi.");
      createdId = data.id;
      jobDraftSignaturesRef.current.set(createdId, signature);
      setActiveId(createdId);
      setDraftAnalysisId(latestSignatureRef.current === signature ? createdId : "");
      const uid = services.auth.currentUser!.uid;
      const existing = await getDoc(doc(services.db, "users", uid, "analyses", createdId));
      if (!isSameSession()) return;
      const existingStatus = existing.data()?.status;
      if (["processing", "review", "completed"].includes(existingStatus)) {
        const ready = existingStatus === "completed";
        if (ready) {
          jobDraftSignaturesRef.current.delete(createdId);
          clearMatchedDraft(signature);
          setOutcome({ kind: "ready", id: createdId });
        } else if (existingStatus === "review") {
          setOutcome({ kind: "review", id: createdId });
        } else {
          setOutcome({ kind: "processing", id: createdId });
        }
        return { id: createdId, ready };
      }
      const total = selection.files.reduce((n, f) => n + f.file.size, 0);
      let completed = 0;
      for (const [i, item] of selection.files.entries()) {
        if (!isSameSession()) return;
        if (cancelled.current) throw new Error("Yükleme iptal edildi.");
        setPhase("uploading");
        setUploadingFile({ name: item.file.name, index: i + 1, total: selection.files.length });
        await new Promise<void>((resolve, reject) => {
          const upload = uploadBytesResumable(ref(services.storage, data.paths[i]), item.file, { contentType: item.file.type || "application/octet-stream" });
          task.current = upload;
          upload.on("state_changed", snapshot => {
            if (isSameSession()) setProgress(Math.round((completed + snapshot.bytesTransferred) / total * 100));
          }, reject, resolve);
        });
        completed += item.file.size;
      }
      task.current = null;
      if (!isSameSession()) return;
      if (cancelled.current) throw new Error("Yükleme iptal edildi.");
      setPhase("preparing");
      setUploadingFile(null);
      const result = await httpsCallable<{ id: string }, { needsReview?: boolean; ready: boolean }>(services.functions, "prepareAnalysis", { timeout: 310_000 })({ id: createdId });
      if (!isSameSession()) return;
      if (result.data.ready === true) {
        jobDraftSignaturesRef.current.delete(createdId);
        clearMatchedDraft(signature);
        setOutcome({ kind: "ready", id: createdId });
        return { id: createdId, ready: true };
      }
      if (result.data.needsReview === true) {
        setOutcome({ kind: "review", id: createdId });
        return { id: createdId, ready: false };
      }
      // ready: false açık needsReview taşımıyorsa mevcut iş kaydını tek kez okuyup gerçek sunucu durumunu yansıtır.
      const latest = await getDoc(doc(services.db, "users", uid, "analyses", createdId));
      if (!isSameSession()) return;
      const latestStatus = latest.exists() ? latest.data()?.status : undefined;
      if (latestStatus === "completed") {
        jobDraftSignaturesRef.current.delete(createdId);
        clearMatchedDraft(signature);
        setOutcome({ kind: "ready", id: createdId });
        return { id: createdId, ready: true };
      }
      if (latestStatus === "review") {
        setOutcome({ kind: "review", id: createdId });
      } else if (latestStatus === "failed") {
        const message = typeof latest.data()?.error === "string" && latest.data()?.error ? latest.data()!.error : "Belgeler hazırlanamadı.";
        setError(message);
        setOutcome({ kind: "failed", id: createdId, message });
      } else if (latestStatus === "processing" || latestStatus === "uploading") {
        setOutcome({ kind: "processing", id: createdId });
      } else {
        setOutcome(null);
      }
      return { id: createdId, ready: false };
    } catch (e) {
      if (!isSameSession()) return;
      if (cancelled.current) {
        const message = "Yükleme iptal edildi; dosyalarınız korundu.";
        setError(message);
        setOutcome({ kind: "cancelled", ...(createdId ? { id: createdId } : {}), message });
      } else {
        const message = userError(e);
        setError(message);
        setOutcome({ kind: "failed", ...(createdId ? { id: createdId } : {}), message });
      }
    } finally {
      task.current = null;
      lock.current = false;
      if (active.current) {
        setPhase("idle");
        setUploadingFile(null);
      }
    }
  }
  // Yalnız onaylanan kaydın kendi gönderilmiş taslağı hâlâ eşleşiyorsa bir kez temizler; işletme ve diğer işler korunur.
  function completeDraft(analysisId: string) {
    if (!analysisId) return;
    const submittedSignature = jobDraftSignaturesRef.current.get(analysisId);
    if (!submittedSignature) return;
    jobDraftSignaturesRef.current.delete(analysisId);
    clearMatchedDraft(submittedSignature);
  }
  function cancel() { cancelled.current = true; task.current?.cancel(); }
  const ownedDraftAnalysisId = selection.files.length > 0 ? draftAnalysisId : "";
  return <WorkspaceContext.Provider value={{ selection: wrappedSelection, draft, setDraft, canUndoObjectiveExample: originalObjective !== null, applyObjectiveExample, undoObjectiveExample, busy, progress, error, activeId, draftAnalysisId: ownedDraftAnalysisId, phase, uploadingFile, outcome, dismissOutcome, start, completeDraft, cancel }}>{children}</WorkspaceContext.Provider>;
}
