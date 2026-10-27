import { lazy, Suspense } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { t, useLocale } from "../i18n/runtime";
import { useTheme } from "../hooks/use-theme";

// Menü kodu ilk açılış paketine girmez; tema zaten main.tsx'te çizimden önce uygulanır.
const ThemeMenu = lazy(() => import("./theme-menu").then(module => ({ default: module.ThemeMenu })));

// Menü yüklenene kadar mevcut modu gösteren pasif tetikleyici; boyutu gerçek düğmeyle aynıdır.
function ThemeTogglePlaceholder() {
  useLocale();
  const { theme, mode, style } = useTheme();
  const Icon = mode === "system" ? Monitor : theme === "dark" ? Moon : Sun;
  return (
    <button type="button" disabled aria-label={t("Tema")} data-testid="theme-menu" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/70 text-foreground shadow-sm backdrop-blur-xl">
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      {style === "glass" && <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-gradient-to-br from-secondary to-primary ring-2 ring-card" aria-hidden="true" />}
    </button>
  );
}

// Renk modu ve görünüm menüsünü lazy yükleyerek sunar.
export function ThemeToggle() {
  return (
    <Suspense fallback={<ThemeTogglePlaceholder />}>
      <ThemeMenu />
    </Suspense>
  );
}
