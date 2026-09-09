import { Settings } from "lucide-react";

// Plan, hesap ve bağlantı ayarları için uygulamanın hazırlık ekranını sunar.
export function SettingsPage() {
  return (
    <section aria-labelledby="settings-title">
      <p className="text-sm font-semibold text-primary dark:text-secondary">Ayarlar</p>
      <h1 id="settings-title" className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Çalışma alanı ayarları</h1>
      <div className="mt-8 flex min-h-80 items-center justify-center rounded-3xl border border-border/70 bg-card/70 p-8 text-center shadow-sm">
        <div>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><Settings className="h-6 w-6" /></span>
          <p className="mt-5 font-semibold">Ayarlar yakında burada</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Plan, profil ve veri kaynağı bağlantıları ilgili servisler eklendiğinde yönetilebilecek.</p>
        </div>
      </div>
    </section>
  );
}
