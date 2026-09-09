import { UploadCloud } from "lucide-react";

// Yeni analiz rotası için dosya hazırlama alanının ilk uygulama kabuğunu sunar.
export function NewAnalysisPage() {
  return (
    <section aria-labelledby="new-analysis-title">
      <p className="text-sm font-semibold text-primary dark:text-secondary">Yeni analiz</p>
      <h1 id="new-analysis-title" className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Verilerinizi analize hazırlayın</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Dosyalarınızı seçin, kontrol edin ve analiz isteğini göndermeden önce kapsamı doğrulayın.</p>
      <div className="mt-8 flex min-h-80 items-center justify-center rounded-3xl border border-dashed border-primary/25 bg-card/70 p-8 text-center shadow-sm">
        <div>
          <UploadCloud className="mx-auto h-10 w-10 text-primary dark:text-secondary" />
          <p className="mt-4 font-semibold">Dosya çalışma alanı hazırlanıyor</p>
          <p className="mt-2 text-sm text-muted-foreground">Dosya seçimi bir sonraki geliştirme adımında bu alana bağlanacak.</p>
        </div>
      </div>
    </section>
  );
}
