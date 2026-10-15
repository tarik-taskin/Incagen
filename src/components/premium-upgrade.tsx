import { ArrowRight, Crown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PLAN_RULES } from "../features/plans/plan-rules";
import { Button } from "./ui/button";

// Premium üyelik girişini görünür tutar ve ödeme akışı bağlanana kadar kısa ürün bilgisini gösterir.
export function PremiumUpgrade() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Dış etkileşim ve Escape ile geçici bilgilendirmeyi doğal biçimde kapatır.
    function closeOnOutsideInteraction(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-1.5 rounded-full border-primary/20 bg-primary/[0.06] px-3 text-xs font-semibold text-primary shadow-sm hover:bg-primary/10 dark:border-secondary/20 dark:bg-secondary/[0.08] dark:text-secondary dark:hover:bg-secondary/[0.13] sm:h-10 sm:px-4 sm:text-sm"
        aria-expanded={isOpen}
        aria-controls="premium-upgrade-notice"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <Crown className="h-4 w-4" aria-hidden="true" />
        Premium’a geç
      </Button>

      {isOpen && (
        <div
          id="premium-upgrade-notice"
          className="absolute right-0 top-12 z-40 w-[min(18rem,calc(100vw-2.5rem))] rounded-2xl border border-border/80 bg-card p-4 text-left shadow-2xl"
          role="region"
          aria-labelledby="premium-upgrade-title"
        >
          <button
            type="button"
            className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Premium bilgilendirmesini kapat"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <p id="premium-upgrade-title" className="pr-8 text-sm font-semibold" role="status" aria-live="polite">Premium ile daha geniş alan</p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Daha kapsamlı çalışmalar için günde {PLAN_RULES.premium.dailyAnalysisLimit} analiz, analiz başına {PLAN_RULES.premium.filesPerAnalysis} belge ve toplam {PLAN_RULES.premium.totalBytes / 1024 ** 2} MB kapasite öngörüyoruz. {PLAN_RULES.premium.analysisDepth} analiz derinliği ve {PLAN_RULES.premium.externalSources} bağlantılarıyla planın kapsamını karşılaştırabilirsiniz.</p>
          <Link to="/app/plan" onClick={() => setIsOpen(false)} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary">Planları karşılaştır <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </div>
      )}
    </div>
  );
}
