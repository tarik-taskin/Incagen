import { lazy, Suspense } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { languages, t, useLocale } from "../i18n/runtime";

// Radix seçim kodu ilk açılış paketine girmesin diye ayrı yüklenir; yer tutucu aynı ölçüde çizilir.
const LanguageSelectMenu = lazy(() => import("./language-select-menu").then(module => ({ default: module.LanguageSelectMenu })));

// Menü kodu gelene kadar aynı görünümde pasif tetikleyici gösterir; sayfada kayma oluşmaz.
function LanguageSelectorPlaceholder() {
  const locale = useLocale();
  const current = languages.find(item => item.code === locale);
  return (
    <button type="button" disabled aria-label={t("Dil")} data-testid="language-select" className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full border border-border/70 bg-card/70 px-0 text-foreground shadow-sm backdrop-blur-xl sm:w-[8.75rem] sm:justify-between sm:px-3">
      <Languages className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="hidden min-w-0 flex-1 truncate text-start text-xs font-medium sm:block">{current ? t(current.name) : ""}</span>
      <ChevronDown className="hidden h-4 w-4 shrink-0 opacity-60 sm:block" aria-hidden="true" />
    </button>
  );
}

// Dil seçiciyi lazy menüyle sunar; diyalog içindeki kullanımlar portal hedefini iletir.
export function LanguageSelector({ container }: { container?: HTMLElement | null }) {
  return (
    <Suspense fallback={<LanguageSelectorPlaceholder />}>
      <LanguageSelectMenu container={container} />
    </Suspense>
  );
}
