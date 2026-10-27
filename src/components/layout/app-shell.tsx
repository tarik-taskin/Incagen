import { LanguageSelector } from "../language-selector";
import { t, useLocale } from "../../i18n/runtime";
import { ArrowUpRight, CircleHelp, Crown, FileBarChart2, Headphones, History, Settings } from "lucide-react";
import { useState } from "react";
import { SupportDialog } from "../support-dialog";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatedLogo } from "../animated-logo";
import { PremiumUpgrade } from "../premium-upgrade";
import { ThemeToggle } from "../theme-toggle";
import { PLAN_RULES } from "../../features/plans/plan-rules";
import { cn } from "../../lib/utils";
import { ConnectionStatus } from "../connection-status";
import { PreparationProgress } from "../upload/preparation-progress";

const navigationItems = [
  { to: "/app/new-analysis", label: "Yeni analiz", icon: FileBarChart2 },
  { to: "/app/history", label: "Geçmiş", icon: History },
  { to: "/app/settings", label: "Ayarlar", icon: Settings },
  { to: "/app/plan", label: "Plan", icon: Crown },
];

// Aktif rota bilgisini kullanarak masaüstü navigasyon bağlantılarının stilini üretir.
function getDesktopLinkClass(isActive: boolean) {
  return cn(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-secondary",
    isActive
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

// Uygulama sayfalarını ortak responsive navigasyon, başlık ve tema kontrolü içinde sunar.
export function AppShell() {
  useLocale();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground glass:bg-transparent">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
         {t("İçeriğe geç")} </a>

      <aside className="fixed inset-y-0 start-0 z-30 hidden w-72 border-e border-border/70 bg-card/85 px-5 py-6 backdrop-blur-xl glass:bg-card/45 glass:backdrop-saturate-150 lg:flex lg:flex-col">
        <Link to="/app/new-analysis" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={t("Yeni analize git")}>
          <AnimatedLogo className="h-10 w-10" compact />
          <div>
            <p className="text-lg font-semibold tracking-[-0.04em]">{t("Incagen")}</p>
            <p className="text-xs text-muted-foreground">{t("Analiz çalışma alanı")}</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-1.5" aria-label={t("Ana navigasyon")}>
          {navigationItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => getDesktopLinkClass(isActive)}>
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {t(label)}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto mb-4 space-y-1">
        <Link to="/" className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-secondary">
          <CircleHelp className="h-4 w-4" aria-hidden="true" />  {t("Nasıl çalışır?")} <ArrowUpRight className="ms-auto h-4 w-4" aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => setHelpOpen(true)} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/25 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-secondary"><Headphones className="h-4 w-4 shrink-0" aria-hidden="true" />{t("Destek ve yardım")}</button>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-primary/[0.05] p-4 dark:border-secondary/10 dark:bg-secondary/[0.05]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{t("{0} plan", PLAN_RULES.free.label)}</span>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary dark:bg-secondary/10 dark:text-secondary">{t("{0}/gün", PLAN_RULES.free.dailyAnalysisLimit)}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("Her analizde en fazla {0} dosya ve toplam", PLAN_RULES.free.filesPerAnalysis)} {PLAN_RULES.free.totalBytes / 1024 ** 2}  {t("MB kullanabilirsiniz.")}</p>
        </div>
      </aside>

      <div className="lg:ps-72">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl glass:bg-background/35 glass:backdrop-saturate-150">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
            <Link to="/app/new-analysis" className="flex items-center gap-2.5 lg:hidden" aria-label={t("Yeni analize git")}>
              <AnimatedLogo className="h-8 w-8" compact />
              <span className="font-semibold tracking-[-0.03em]">{t("Incagen")}</span>
            </Link>
            <div className="hidden lg:block">
              <p className="text-sm font-medium">{t("İşletme çalışma alanı")}</p>
              <p className="text-xs text-muted-foreground">{t("Verilerinizi güvenle hazırlayın ve analiz edin.")}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/" aria-label={t("Nasıl çalışır?")} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"><CircleHelp className="h-4 w-4" aria-hidden="true" /></Link>
              <PremiumUpgrade />
              <LanguageSelector /><ThemeToggle />
            </div>
          </div>
        </header>

        <main id="main-content" className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-5 py-8 pb-28 sm:px-8 lg:pb-10">
          <ConnectionStatus />
          {location.pathname !== "/app/new-analysis" && <PreparationProgress compact />}
          <Outlet />
          <div className="mt-8 flex justify-center border-t border-border/60 pt-5 lg:hidden"><button type="button" onClick={() => setHelpOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Headphones className="h-4 w-4" aria-hidden="true" />{t("Destek ve yardım")}</button></div>
        </main>
      </div>

      <nav className="fixed inset-x-4 bottom-4 z-30 grid grid-cols-4 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-xl backdrop-blur-xl glass:bg-card/65 glass:backdrop-saturate-150 lg:hidden" aria-label={t("Mobil navigasyon")}>
        {navigationItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-secondary",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {t(label)}
          </NavLink>
        ))}
      </nav>
      <SupportDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
