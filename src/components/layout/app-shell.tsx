import { Crown, FileBarChart2, History, Settings } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { AnimatedLogo } from "../animated-logo";
import { PremiumUpgrade } from "../premium-upgrade";
import { ThemeToggle } from "../theme-toggle";
import { PLAN_RULES } from "../../features/plans/plan-rules";
import { cn } from "../../lib/utils";
import { useWorkspace } from "../../lib/workspace-context";

const navigationItems = [
  { to: "/app/new-analysis", label: "Yeni analiz", icon: FileBarChart2 },
  { to: "/app/history", label: "Geçmiş", icon: History },
  { to: "/app/settings", label: "Ayarlar", icon: Settings },
  { to: "/app/plan", label: "Plan", icon: Crown },
];

// Aktif rota bilgisini kullanarak masaüstü navigasyon bağlantılarının stilini üretir.
function getDesktopLinkClass(isActive: boolean) {
  return cn(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    isActive
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

// Uygulama sayfalarını ortak responsive navigasyon, başlık ve tema kontrolü içinde sunar.
export function AppShell() {
  const workspace = useWorkspace();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        İçeriğe geç
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border/70 bg-card/85 px-5 py-6 backdrop-blur-xl lg:flex lg:flex-col">
        <Link to="/app/new-analysis" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Yeni analize git">
          <AnimatedLogo className="h-10 w-10" compact />
          <div>
            <p className="text-lg font-semibold tracking-[-0.04em]">Incagen</p>
            <p className="text-xs text-muted-foreground">Analiz çalışma alanı</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-1.5" aria-label="Ana navigasyon">
          {navigationItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} replace className={({ isActive }) => getDesktopLinkClass(isActive)}>
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-primary/10 bg-primary/[0.05] p-4 dark:border-secondary/10 dark:bg-secondary/[0.05]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{PLAN_RULES.free.label} plan</span>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary dark:bg-secondary/10 dark:text-secondary">{PLAN_RULES.free.dailyAnalysisLimit}/gün</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Her analizde en fazla {PLAN_RULES.free.filesPerAnalysis} dosya ve toplam {PLAN_RULES.free.totalBytes / 1024 ** 2} MB kullanabilirsiniz.</p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
            <Link to="/app/new-analysis" className="flex items-center gap-2.5 lg:hidden" aria-label="Yeni analize git">
              <AnimatedLogo className="h-8 w-8" compact />
              <span className="font-semibold tracking-[-0.03em]">Incagen</span>
            </Link>
            <div className="hidden lg:block">
              <p className="text-sm font-medium">İşletme çalışma alanı</p>
              <p className="text-xs text-muted-foreground">Verilerinizi güvenle hazırlayın ve analiz edin.</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <PremiumUpgrade />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main id="main-content" className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-5 py-8 pb-28 sm:px-8 lg:pb-10">
          {workspace.busy && <p role="status" className="mb-4 rounded-xl border border-border bg-card p-3 text-sm">İşleminiz devam ediyor. {workspace.activeId && <Link className="underline" to={"/app/analyses/" + workspace.activeId}>İşlemi izle</Link>}</p>}
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-4 bottom-4 z-30 grid grid-cols-4 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-xl backdrop-blur-xl lg:hidden" aria-label="Mobil navigasyon">
        {navigationItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            replace
            className={({ isActive }) => cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
