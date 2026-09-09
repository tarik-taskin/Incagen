import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FileStack } from "lucide-react";
import { FileDropzone } from "../components/upload/file-dropzone";
import { SelectedFileList } from "../components/upload/selected-file-list";
import { Button } from "../components/ui/button";
import { FREE_PLAN_FILE_LIMIT } from "../features/files/file-rules";
import { useFileSelection } from "../hooks/use-file-selection";

// Yeni analiz rotasında dosya seçimi, istemci ön kontrolü ve istek hazırlığını birlikte yönetir.
export function NewAnalysisPage() {
  const { files, rejections, addFiles, removeFile, clearFiles, dismissRejections } = useFileSelection();
  const [isReady, setIsReady] = useState(false);
  const isAtLimit = files.length >= FREE_PLAN_FILE_LIMIT;

  // Yeni bir dosya grubu geldiğinde önceki hazırlık sonucunu temizleyip seçimi doğrular.
  function handleFilesSelected(selectedFiles: File[]) {
    setIsReady(false);
    addFiles(selectedFiles);
  }

  // Kullanıcının seçtiği dosyaları mevcut frontend kapsamı içinde analize hazır olarak işaretler.
  function handlePrepareAnalysis() {
    if (files.length > 0) setIsReady(true);
  }

  return (
    <section aria-labelledby="new-analysis-title">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-primary dark:text-secondary">Yeni analiz</p>
          <h1 id="new-analysis-title" className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Verilerinizi analize hazırlayın</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Dosyalarınızı birlikte seçin, ön kontrolleri tamamlayın ve analiz kapsamını doğrulayın.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/75 px-4 py-3 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Günlük analiz hakkı</p>
            <p className="text-sm font-semibold">10 analiz · Free</p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-6">
          <FileDropzone disabled={isAtLimit} onFilesSelected={handleFilesSelected} />

          {rejections.length > 0 && (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4" role="alert">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold">Bazı dosyalar eklenemedi</h2>
                    <button type="button" className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={dismissRejections}>Bildirimi kapat</button>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {rejections.map(({ id, fileName, reason }) => <li key={id}><span className="font-medium text-foreground">{fileName}:</span> {reason}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {isReady && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4" role="status">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Dosya kapsamı hazır</p>
                <p className="mt-1 text-sm text-muted-foreground">{files.length} dosya istemci ön kontrolünü geçti. Backend bağlantısı eklendiğinde analiz isteği bu adımdan gönderilecek.</p>
              </div>
            </div>
          )}

          <SelectedFileList
            files={files}
            limit={FREE_PLAN_FILE_LIMIT}
            onClear={() => {
              setIsReady(false);
              clearFiles();
            }}
            onRemove={(id) => {
              setIsReady(false);
              removeFile(id);
            }}
          />
        </div>

        <aside className="h-fit rounded-3xl border border-border/70 bg-card/75 p-5 shadow-sm xl:sticky xl:top-24" aria-labelledby="analysis-summary-title">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary">
              <FileStack className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="analysis-summary-title" className="font-semibold">Analiz özeti</h2>
              <p className="text-xs text-muted-foreground">Free plan</p>
            </div>
          </div>

          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Seçilen dosya</dt><dd className="font-semibold">{files.length}/{FREE_PLAN_FILE_LIMIT}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Analiz derinliği</dt><dd className="font-semibold">Medium</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Harici kaynak</dt><dd className="font-semibold">Bulunmaz</dd></div>
          </dl>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-[width] dark:bg-secondary" style={{ width: `${(files.length / FREE_PLAN_FILE_LIMIT) * 100}%` }} />
          </div>

          <Button type="button" className="mt-6 w-full gap-2 rounded-xl" disabled={files.length === 0} onClick={handlePrepareAnalysis}>
            Analize hazırla
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">Bu adım dosyaları yalnızca tarayıcıda hazırlar; henüz sunucuya göndermez.</p>
        </aside>
      </div>
    </section>
  );
}
