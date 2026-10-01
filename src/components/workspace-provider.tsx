import { useEffect, useRef, useState, type ReactNode } from "react";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { getDoc, doc } from "firebase/firestore";
import { createSchema, LIMITS, type CreateAnalysis } from "../../functions/src/contracts";
import { useFileSelectionState } from "../hooks/use-file-selection";
import { WorkspaceContext, type Draft } from "../lib/workspace-context";
import { getServices } from "../lib/firebase";
import { userError } from "../lib/errors";
import { authOnlyPreview } from "../lib/deployment-mode";
import { tr } from "../i18n/tr";

// Oturum boyunca dosya taslağını ve yüklemeyi yaşatır; sayfa değişimi işi kesmez.
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const selection = useFileSelectionState();
  const [draft, setDraft] = useState<Draft>({ title: "", business: "" });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");
  const task = useRef<UploadTask | null>(null);
  const lock = useRef(false);
  const cancelled = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  useEffect(() => () => { cancelled.current = true; task.current?.cancel(); }, []);

  // Aynı taslağı tekrar gönderirken aynı istek kimliğini kullanarak ağ belirsizliğinde çift iş açmaz.
  async function start() {
    if (lock.current) return;
    setError("");
    if (authOnlyPreview) { setError("Bu önizlemede belge hazırlama henüz etkin değil."); return; }
    if (!selection.files.length) { setError(tr.analysis.empty); return; }
    const body = {
      title: draft.title,
      business: draft.business,
      files: selection.files.map(({ file }) => ({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" })),
    };
    const signature = JSON.stringify({ body, ids: selection.files.map(f => f.id) });
    if (!request.current || request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    const parsed = createSchema.safeParse({ ...body, requestId: request.current.id });
    if (!parsed.success) { setError(`İşletme ve analiz başlığını doldurun. Free sınırları: ${LIMITS.files} dosya ve toplam ${LIMITS.totalBytes / 1024 ** 2} MB/analiz.`); return; }
    lock.current = true; cancelled.current = false; setBusy(true); setProgress(0);
    try {
      const services = getServices();
      const create = httpsCallable<CreateAnalysis, { id: string; paths: string[] }>(services.functions, "createAnalysis");
      const { data } = await create(parsed.data);
      if (cancelled.current) return;
      setActiveId(data.id);
      const uid = services.auth.currentUser!.uid;
      const existing = await getDoc(doc(services.db, "users", uid, "analyses", data.id));
      if (["processing", "completed"].includes(existing.data()?.status)) return data.id;
      const total = selection.files.reduce((n, f) => n + f.file.size, 0);
      let completed = 0;
      for (const [i, item] of selection.files.entries()) {
        if (cancelled.current) throw new Error("Yükleme iptal edildi.");
        await new Promise<void>((resolve, reject) => {
          const upload = uploadBytesResumable(ref(services.storage, data.paths[i]), item.file, { contentType: item.file.type || "application/octet-stream" });
          task.current = upload;
          upload.on("state_changed", snapshot => setProgress(Math.round((completed + snapshot.bytesTransferred) / total * 100)), reject, resolve);
        });
        completed += item.file.size;
      }
      task.current = null;
      if (cancelled.current) throw new Error("Yükleme iptal edildi.");
      await httpsCallable(services.functions, "prepareAnalysis", { timeout: 310_000 })({ id: data.id });
      return data.id;
    } catch (e) { if (!cancelled.current) setError(userError(e)); else setError("Yükleme iptal edildi; dosyalarınız korundu."); }
    finally { task.current = null; lock.current = false; setBusy(false); }
  }
  // Başarılı hazırlıktan sonra yeni iş için dosya ve başlığı temizler; oturumdaki işletme ve son iş bağlantısını korur.
  function completeDraft() {
    selection.clearFiles();
    setDraft(current => ({ ...current, title: "" }));
    setProgress(0);
    setError("");
    request.current = null;
  }
  function cancel() { cancelled.current = true; task.current?.cancel(); }
  return <WorkspaceContext.Provider value={{ selection, draft, setDraft, busy, progress, error, activeId, start, completeDraft, cancel }}>{children}</WorkspaceContext.Provider>;
}
