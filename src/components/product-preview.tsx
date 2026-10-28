import { useState } from "react";
import { ArrowRight, BarChart3, LayoutDashboard, Table2 } from "lucide-react";
import { Link } from "react-router-dom";
import { t, useLocale } from "../i18n/runtime";
import { useTheme } from "../hooks/use-theme";
import { cn } from "../lib/utils";

const views = [
  { id: "report-overview", label: "Rapor özeti", icon: LayoutDashboard, alt: "Örnek raporun özet ekranı: net satış, brüt kâr, bütçe gerçekleşmesi ve zamanında tamamlanma kartları" },
  { id: "report-charts", label: "Grafikler", icon: BarChart3, alt: "Örnek raporun grafik bölümü: hizmet alanı katkısı, kanal karması ve bölgesel performans" },
  { id: "report-table", label: "Kaynak tablosu", icon: Table2, alt: "Örnek raporun aylık performans tablosu: net satış, bütçe, brüt kâr ve hizmet düzeyi" },
] as const;

// Giriş yapmadan önce sentetik örnek rapordan alınmış ekran görüntülerini gösterir; yalnız seçili tema için tek görsel iner.
export function ProductPreview() {
  useLocale();
  const { theme } = useTheme();
  const [active, setActive] = useState<(typeof views)[number]["id"]>("report-overview");
  const view = views.find(item => item.id === active) ?? views[0];

  return (
    <section className="surface surface-accent mt-6 overflow-hidden rounded-[2rem] border border-border/80 bg-card shadow-sm" aria-labelledby="preview-title">
      <div className="grid gap-7 p-6 sm:p-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary dark:text-secondary">{t("Ürün önizlemesi")}</p>
          <h2 id="preview-title" className="mt-3 text-balance text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{t("Hazırlanan raporun nasıl göründüğünü inceleyin.")}</h2>
          <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">{t("Kurgusal bir şirketin örnek belgeleriyle hazırlanan raporda metrikleri, grafikleri ve kaynağına bağlanan tabloları görün.")}</p>
          <div role="group" aria-label={t("Önizleme görünümü")} className="mt-6 flex flex-wrap gap-2">
            {views.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={active === id}
                onClick={() => setActive(id)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-secondary",
                  active === id ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />{t(label)}
              </button>
            ))}
          </div>
          <Link to="/ornek-rapor" className="mt-6 inline-flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary dark:focus-visible:ring-secondary">
            {t("Canlı örneği aç")} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </div>
        <figure className="min-w-0">
          <img
            key={`${view.id}-${theme}`}
            src={`/showcase/${view.id}-${theme}.webp`}
            alt={t(view.alt)}
            width={1200}
            height={750}
            loading="lazy"
            decoding="async"
            className="aspect-[8/5] w-full rounded-2xl border border-border/70 bg-muted object-cover object-top shadow-[0_30px_80px_-45px_rgba(50,14,59,0.55)] animate-in fade-in-0 duration-300"
          />
        </figure>
      </div>
    </section>
  );
}
