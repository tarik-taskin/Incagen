import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { t, useLocale } from "../i18n/runtime";

// Tarayıcının bağlantı olaylarını izler; servis erişimini test etmez veya kullanıcı adına işlem başlatmaz.
function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

// Çevrimdışında tek sessiz satır gösterir; normal bağlantıda ek yer kaplamaz.
export function ConnectionStatus() {
  useLocale();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return <div role="status" aria-live="polite" className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3 text-sm text-foreground">
    <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
    <div><p className="font-medium">{t("Çevrimdışı görünüyorsunuz")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Bağlantınızı kontrol edin. Bu sekmedeki taslağınız korunur; yerel dosyalarınızı kaybetmemek için sayfayı yenilemeyin.")}</p></div>
  </div>;
}
