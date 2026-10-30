import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AnimatedLogo } from "../../components/animated-logo";
import { LanguageSelector } from "../../components/language-selector";
import { ThemeToggle } from "../../components/theme-toggle";
import { Button } from "../../components/ui/button";
import { t, useLocale } from "../../i18n/runtime";
import { ExampleSwitch } from "./example-switch";
import { ShareLinkButton } from "./share-link-button";

export const reportContainer = "mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-10";

// Her iki örneğin başlığını, kontrollerini, sekmelerini ve görünüm paylaşımını aynı içerik ekseninde tutar.
export function ExampleReportHeader({ active, activeSection }: { active: "commercial" | "feedback"; activeSection?: string }) {
  useLocale();
  return <>
    <header className="popover-surface border-b border-border/60 bg-card/70">
      <nav aria-label={t("Örnek rapor navigasyonu")} className={`${reportContainer} flex flex-wrap items-center justify-between gap-3 py-4`}>
        <div className="flex items-center gap-5">
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={t("Incagen ana sayfa")}><AnimatedLogo compact className="h-8 w-8" /><span className="text-lg font-semibold tracking-tight">{t("Incagen")}</span></Link>
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" /><span className="hidden text-xs text-muted-foreground sm:block">{t("Örnek rapor")}</span>
        </div>
        <div className="ms-auto flex min-w-0 max-w-full items-center gap-2 sm:gap-3"><LanguageSelector /><ThemeToggle /><Button asChild className="h-auto min-h-10 min-w-0 whitespace-normal rounded-xl"><Link to="/app/new-analysis">{t("Analize başla")}<ArrowRight className="ms-2 h-4 w-4 shrink-0 rtl:-scale-x-100" aria-hidden="true" /></Link></Button></div>
      </nav>
    </header>
    <div className={`${reportContainer} flex flex-wrap items-center justify-between gap-3 pt-5`}>
      <ExampleSwitch active={active} />
      <ShareLinkButton activeSection={activeSection} />
    </div>
  </>;
}
