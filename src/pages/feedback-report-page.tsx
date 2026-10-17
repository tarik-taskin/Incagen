import { ExampleSwitch } from "../features/reports/example-switch";
import { LanguageSelector } from "../components/language-selector";
import { t, useLocale } from "../i18n/runtime";
import { Link } from "react-router-dom";
import { Download, ArrowRight, MessageSquareText } from "lucide-react";
import { MotionConfig } from "motion/react";
import { AnimatedLogo } from "../components/animated-logo";
import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";
import { AdaptiveReport, ReportDetails } from "../features/reports/result-sections";
import { ReportReveal } from "../features/reports/report-primitives";
import example from "../features/reports/feedback-example.json";
import csvUrl from "../../fixtures/analysis-reference/examples/customer-feedback.csv?url";
import type { AiResult } from "../../functions/src/analysis/result-contract";

// İnsan etiketli yorum referansını ortak sonuç bileşenleriyle sunar; özgün yorumlar çevrilmez veya AI çıktısı sayılmaz.
export function FeedbackReportPage() {
  useLocale();
  const result = example.result as AiResult;
  return <MotionConfig reducedMotion="user"><div className="min-h-screen bg-background text-foreground"><header className="border-b border-border bg-card/70"><nav aria-label={t("Örnek rapor navigasyonu")} className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8"><Link to="/" aria-label={t("Incagen ana sayfa")} className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><AnimatedLogo compact className="h-8 w-8" /><span className="text-lg font-semibold tracking-tight">{t("Incagen")}</span></Link><div className="flex items-center gap-2"><LanguageSelector /><ThemeToggle /><Button asChild className="rounded-xl"><Link to="/app/new-analysis">{t("Analize başla")}<ArrowRight className="ms-2 h-4 w-4 rtl:-scale-x-100" aria-hidden="true" /></Link></Button></div></nav></header>
    <main className="mx-auto max-w-7xl px-5 pb-14 pt-8 sm:px-8 sm:pt-12"><ReportReveal><div className="mb-8"><ExampleSwitch active="feedback" /></div><div className="grid items-end gap-6 border-b border-border pb-8 lg:grid-cols-[1fr_auto]"><div><p className="flex items-center gap-2 text-xs font-medium text-primary dark:text-secondary"><MessageSquareText className="h-4 w-4" aria-hidden="true" />{t("Örnek rapor · Müşteri deneyimi")}</p><h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">{t("Müşterinin sesinden,")}<br /><span className="text-primary dark:text-secondary">{t("net önceliklere.")}</span></h1><p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">{t("Tekrar eden sorunları görün, olumlu deneyimleri koruyun. Her bulguyu onu oluşturan yoruma kadar izleyin.")}</p><p className="mt-3 text-xs text-muted-foreground">{t("32 kurgusal yorum · 4 konu · İnsan etiketli referans")}</p></div><a href={csvUrl} download="customer-feedback.csv" className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Download aria-hidden="true" className="h-4 w-4" />{t("Örnek yorumları indir")}</a></div></ReportReveal>
      <div className="pt-6"><AdaptiveReport result={result} sources={example.sources} featuredMetricIds={["comments", "problem-comments", "positive-comments", "csat"]}><ReportDetails title={t("Yorum defteri")} description="32 özgün yorum ve insan referansındaki değerlendirmeleri."><p className="mb-5 text-xs leading-6 text-muted-foreground">{t("Bir yorum birden çok konuyu içerebilir. Özgün ifadeler kaynak dilinde gösterilir.")}</p><div className="grid gap-3 md:grid-cols-2">{example.annotations.map(annotation => { const row = example.sources[0].chunks[0].table!.rows[annotation.sourceRow - 1]; return <article key={annotation.id} className="rounded-2xl border border-border bg-background/60 p-5"><div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground"><span>{annotation.id} · {row[1]}</span><span>{annotation.sentiment === "positive" ? t("Olumlu") : annotation.sentiment === "negative" ? t("Olumsuz") : t("Karma")}</span></div><blockquote lang="tr" dir="auto" className="mt-3 text-sm leading-7">“{row[2]}”</blockquote></article>; })}</div></ReportDetails></AdaptiveReport></div>
    </main></div></MotionConfig>;
}
