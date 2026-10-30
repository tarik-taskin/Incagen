import { ExampleReportHeader, reportContainer } from "../features/reports/example-report-header";
import { t, useLocale, localeTag } from "../i18n/runtime";
import { Download, MessageSquareText } from "lucide-react";
import { MotionConfig } from "motion/react";
import { AdaptiveReport, ReportDetails } from "../features/reports/result-sections";
import { ReportReveal } from "../features/reports/report-primitives";
import example from "../features/reports/feedback-example.json";
import csvUrl from "../../fixtures/analysis-reference/examples/customer-feedback.v2.csv?url";
import type { AiResult } from "../../functions/src/analysis/result-contract";

// İnsan etiketli yorum referansını ortak sonuç bileşenleriyle sunar; özgün yorumlar çevrilmez veya AI çıktısı sayılmaz.
export function FeedbackReportPage() {
  useLocale();
  const result = example.result as AiResult;
  return <MotionConfig reducedMotion="user"><div className="min-h-screen bg-background text-foreground glass:bg-transparent"><ExampleReportHeader active="feedback" />
    <main><div className="brand-hero border-b border-border/60"><div className={`${reportContainer} py-8 sm:py-10`}><ReportReveal><div className="grid items-end gap-6 lg:grid-cols-[1fr_auto]"><div><p className="flex items-center gap-2 text-xs font-medium text-primary dark:text-secondary"><MessageSquareText className="h-4 w-4" aria-hidden="true" />{t("Örnek rapor · Müşteri deneyimi")}</p><h1 className="mt-4 max-w-3xl text-[clamp(2.3rem,3.7vw,3.3rem)] font-semibold leading-[1.04] tracking-[-0.05em]">{t("Müşterinin sesinden,")}<br /><span className="text-primary dark:text-secondary">{t("net önceliklere.")}</span></h1><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{t("Tamamlanan analizler hakkındaki geri bildirimleri inceleyin. Her bulguyu özgün yorumuna kadar izleyin.")}</p><p className="mt-3 text-xs text-muted-foreground">{t("32 örnek geri bildirim · 4 konu · İnsan etiketli referans")}</p></div><a href={csvUrl} download="customer-feedback.csv" className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Download aria-hidden="true" className="h-4 w-4" />{t("Örnek yorumları indir")}</a></div></ReportReveal></div></div>
      <div className={`${reportContainer} pb-14 pt-6`}><AdaptiveReport result={result} sources={example.sources} featuredMetricIds={["comments", "problem-comments", "positive-comments", "csat"]}><ReportDetails title={t("Yorum defteri")} description="32 analiz sonrası geri bildirim ve kaynak değerlendirmeleri."><p className="mb-5 text-xs leading-6 text-muted-foreground">{t("Bir yorum birden çok konuyu içerebilir. Özgün ifadeler kaynak dilinde gösterilir.")}</p><div className="grid gap-3 md:grid-cols-2">{[...example.annotations].reverse().map(annotation => { const row = example.sources[0].chunks[0].table!.rows[annotation.sourceRow - 1]; return <article key={annotation.id} className="rounded-2xl border border-border bg-background/60 p-5"><div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground"><span>{annotation.id} · {new Date(String(row[1]) + "T12:00:00Z").toLocaleDateString(localeTag())}</span><span>{annotation.sentiment === "positive" ? t("Olumlu") : annotation.sentiment === "negative" ? t("Olumsuz") : t("Karma")}</span></div><h3 className="mt-4 break-words text-sm font-semibold">{row[2]}</h3><p lang="tr" dir="auto" className="mt-1 text-xs text-muted-foreground">{row[3]}</p><blockquote lang="tr" dir="auto" className="mt-3 text-sm leading-7">“{row[4]}”</blockquote></article>; })}</div></ReportDetails></AdaptiveReport></div>
    </main></div></MotionConfig>;
}
