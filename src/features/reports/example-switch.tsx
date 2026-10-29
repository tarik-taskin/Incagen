import { Link } from "react-router-dom";
import { t, useLocale } from "../../i18n/runtime";

// Rapor türünü aynı geçmiş kaydında değiştirir; Geri, örnekten önceki sayfaya döner.
export function ExampleSwitch({ active }: { active: "commercial" | "feedback" }) {
  useLocale();
  return <nav aria-label={t("Örnek raporlar")} className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border bg-card p-1 text-xs">
    {[{ id: "commercial", to: "/ornek-rapor", label: "Ticari performans" }, { id: "feedback", to: "/ornek-rapor/musteri-deneyimi", label: "Müşteri deneyimi" }].map(item => <Link key={item.id} to={item.to} replace aria-current={active === item.id ? "page" : undefined} className={`rounded-lg px-4 py-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active === item.id ? "bg-primary/10 text-primary dark:text-secondary" : "text-muted-foreground hover:bg-muted"}`}>{t(item.label)}</Link>)}
  </nav>;
}
