import { History } from "lucide-react";

// Henüz analiz kaydı bulunmayan kullanıcı için geçmiş sayfasının boş durumunu sunar.
export function HistoryPage() {
  return (
    <section aria-labelledby="history-title">
      <p className="text-sm font-semibold text-primary dark:text-secondary">Geçmiş</p>
      <h1 id="history-title" className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Geçmiş analizleriniz</h1>
      <div className="mt-8 flex min-h-80 items-center justify-center rounded-3xl border border-border/70 bg-card/70 p-8 text-center shadow-sm">
        <div>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><History className="h-6 w-6" /></span>
          <p className="mt-5 font-semibold">Henüz analiz yok</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Tamamlanan analizler Firebase bağlantısı kurulduğunda burada listelenecek.</p>
        </div>
      </div>
    </section>
  );
}
