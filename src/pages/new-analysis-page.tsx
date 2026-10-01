import { Link, useNavigate } from "react-router-dom";
import { FileDropzone } from "../components/upload/file-dropzone";
import { SelectedFileList } from "../components/upload/selected-file-list";
import { Button } from "../components/ui/button";
import { FREE_PLAN_FILE_LIMIT } from "../features/files/file-rules";
import { useWorkspace } from "../lib/workspace-context";
import { tr } from "../i18n/tr";

// Farklı iş belgesi türlerini analiz hazırlığı ve güvenli yerel yükleme akışında birleştirir.
export function NewAnalysisPage() {
  const { selection, draft, setDraft, busy, progress, error, activeId, start, completeDraft, cancel } = useWorkspace();
  const { files, rejections, addFiles, removeFile, clearFiles, dismissRejections } = selection;
  const navigate = useNavigate();
  async function submit() {
    const id = await start();
    if (id) {
      completeDraft();
      navigate("/app/analyses/" + id);
    }
  }
  return <section aria-labelledby="new-analysis-title">
    <p className="text-sm font-semibold text-primary dark:text-secondary">Yeni analiz · Free</p>
    <h1 id="new-analysis-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{tr.analysis.title}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Belgelerinizi, tablolarınızı, sunumlarınızı, veri dosyalarınızı ve görsellerinizi tek analiz alanında bir araya getirin.</p>
    <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-6">
        <FileDropzone disabled={busy || files.length >= FREE_PLAN_FILE_LIMIT} onFilesSelected={addFiles} />
        {rejections.length > 0 && <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
          <h2 className="font-semibold">Bazı dosyalar eklenemedi</h2>
          <ul className="mt-2 space-y-1">{rejections.map(r => <li key={r.id} className="break-words">{r.fileName}: {r.reason}</li>)}</ul>
          <Button variant="ghost" onClick={dismissRejections}>Bildirimi kapat</Button>
        </div>}
        <fieldset disabled={busy} className="min-w-0">
          <SelectedFileList files={files} limit={FREE_PLAN_FILE_LIMIT} onClear={() => { if (!busy) clearFiles(); }} onRemove={id => { if (!busy) removeFile(id); }} />
        </fieldset>
      </div>
      <aside className="rounded-3xl border border-border bg-card p-5 shadow-sm xl:sticky xl:top-24" aria-label="Analiz ayarları">
        <h2 className="text-lg font-semibold">Analiz ayarları</h2>
        <fieldset disabled={busy} className="mt-5 space-y-4">
          <label className="block text-sm">{tr.analysis.business}<input className="form-control mt-1" maxLength={100} value={draft.business} onChange={e => setDraft(d => ({ ...d, business: e.target.value }))} /></label>
          <label className="block text-sm">{tr.analysis.titleLabel}<input className="form-control mt-1" maxLength={100} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} /></label>
        </fieldset>
        <p className="mt-5 rounded-xl border border-primary/10 bg-primary/[0.04] px-3.5 py-3 text-xs leading-5 text-muted-foreground dark:border-secondary/15 dark:bg-secondary/[0.05]"><span className="font-semibold text-foreground">Bir konuya odaklanın.</span> Müşteri geri bildirimleri ya da finans verileri gibi birbiriyle ilişkili belgeleri aynı analizde toplayın.</p>
        {busy && <div role="status" className="mt-4 text-sm"><p>{progress < 100 ? `Yükleniyor: %${progress}` : tr.status.processing}</p><progress aria-label="Yükleme ilerlemesi" className="mt-2 w-full accent-purple-700" value={progress} max={100} /></div>}
        {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <Button className="mt-5 w-full" disabled={busy || files.length === 0} onClick={submit}>{tr.analysis.start}</Button>
        {busy && progress < 100 && <Button variant="ghost" className="mt-2 w-full" onClick={cancel}>{tr.analysis.cancel}</Button>}
        {activeId && <Link className="mt-4 block text-sm underline" to={"/app/analyses/" + activeId}>Son işlemi aç</Link>}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Hazırlama başladığında dosyaların gerçek içerik türü doğrulanır; okunabilir bölümler kaynakları korunarak düzenlenir. Yorum ve öneriler bu aşamada üretilmez.</p>
      </aside>
    </div>
  </section>;
}
