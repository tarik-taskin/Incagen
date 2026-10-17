import { reportColors } from "./report-colors";
import { useTheme } from "../../hooks/use-theme";
import { t, useLocale } from "../../i18n/runtime";
import { useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { ArrowRight, ArrowUpRight, ChevronDown, FileCheck2 } from "lucide-react";
import type { AiResult } from "../../../functions/src/analysis/result-contract";
import { ReportReveal } from "./report-primitives";
import { ReportChart } from "./report-chart";
import { reportNumber } from "./report-format";
import { SourceDialog, type ReportSource, type SourceSelection } from "./source-dialog";

export const reportPanel = "min-w-0 rounded-3xl border border-border/75 bg-card shadow-[0_8px_30px_-22px_rgba(70,35,110,0.22)]";
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

// Ayrıntıları kaybetmeden bölümün amacını ön planda tutar; yerel details klavye ve erişilebilirlik davranışını sağlar.
export function ReportDetails({ id, title, description, children }: { id?: string; title: string; description: string; children: ReactNode }) {
  useLocale();
  return <details id={id} className={`${reportPanel} group mt-5 scroll-mt-32`}>
    <summary className={`flex cursor-pointer list-none items-center justify-between gap-5 rounded-3xl p-5 sm:p-6 [&::-webkit-details-marker]:hidden ${focus}`}><span><span className="block text-base font-semibold tracking-tight">{t(title)}</span><span className="mt-1 block text-xs leading-6 text-muted-foreground">{t(description)}</span></span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-180 dark:text-secondary" /></summary>
    <div className="border-t border-border/60 p-4 sm:p-6">{children}</div>
  </details>;
}

// Analiz türünden bağımsız olarak bulguyu, yorum niteliğini ve eylemin dayanağını aynı sözleşmeden sunar.
export function ReportFindings({ result, onOpen }: { result: AiResult; onOpen: (selection: SourceSelection) => void }) {
  useLocale();
  return <section id="bulgular" className="mt-10 scroll-mt-32" aria-labelledby="findings-title"><div className="mb-5"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary">{t("Öne çıkan bulgular")}</p><h2 id="findings-title" className="mt-2 text-2xl font-semibold tracking-tight">{t("Bulgudan sonraki adıma.")}</h2></div><div className={`grid gap-4 md:grid-cols-2 ${result.findings.length === 4 ? "xl:grid-cols-2" : "xl:grid-cols-3"}`}>{result.findings.map((finding, index) => <ReportReveal key={finding.id} delay={index * 0.04}><article className={`${reportPanel} flex h-full flex-col p-6`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-primary dark:text-secondary">{String(index + 1).padStart(2, "0")}</span><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">{finding.kind === "observation" ? t("Gözlem") : t("Yorum")}</span></div><h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight">{t(finding.title)}</h3>{finding.statements.map((statement, n) => <p key={n} className="mt-3 text-sm leading-7 text-muted-foreground">{t(statement.text)}</p>)}<button onClick={() => onOpen({ title: finding.title, evidence: finding.statements.flatMap(item => item.evidence) })} className={`mt-auto inline-flex w-fit items-center gap-2 rounded pt-5 text-xs font-semibold text-primary dark:text-secondary ${focus}`}>{t("Kaynakları incele")}<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></button></article></ReportReveal>)}</div>
    {result.recommendations.length > 0 && <ReportDetails title={t("Sonraki adımlar")} description="Bulgulara bağlı önerileri ve dayanaklarını inceleyin."><ol className="space-y-5">{result.recommendations.map(item => <li key={item.id} className="flex gap-3"><ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-primary dark:text-secondary rtl:-scale-x-100" /><div><p className="text-sm leading-7">{t(item.action)}</p><div className="mt-2 flex flex-wrap gap-2">{item.basisFindingIds.map(id => { const finding = result.findings.find(value => value.id === id)!; return <button key={id} onClick={() => onOpen({ title: finding.title, evidence: finding.statements.flatMap(statement => statement.evidence) })} className={`rounded-lg bg-muted px-2.5 py-1.5 text-xs text-primary dark:text-secondary ${focus}`}>{t(finding.title)}</button>; })}</div></div></li>)}</ol></ReportDetails>}
  </section>;
}

// Yapılandırılmış metrik ve grafiklerden görünüm üretir; eksik değeri sıfıra dönüştürmez, metin raporuna grafik dayatmaz.
export function AdaptiveReport({ result, sources, featuredMetricIds, children }: { result: AiResult; sources: ReportSource[]; featuredMetricIds?: string[]; children?: ReactNode }) {
  useLocale();
  const { theme } = useTheme();
  const colors = reportColors(theme);
  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const featured = featuredMetricIds ? featuredMetricIds.map(id => result.metrics.find(item => item.id === id)).filter(item => item !== undefined) : result.metrics.slice(0, 4);
  const openMetric = (id: string) => { const metric = result.metrics.find(item => item.id === id); if (metric) setSelection({ title: metric.label, evidence: metric.evidence, method: metric.method }); };
  return <>
    {featured.length > 0 && <section aria-label={t("Öne çıkan metrikler")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">{featured.map(metric => <ReportReveal key={metric.id}><button onClick={() => openMetric(metric.id)} className={`${reportPanel} h-full w-full p-5 text-start transition-colors hover:border-primary/30 sm:p-6 ${focus}`}><span className="text-xs text-muted-foreground">{t(metric.label)}</span><span className="mt-3 block text-3xl font-semibold tabular-nums tracking-tight">{reportNumber(metric.value, metric.unit, true)}</span><span className="mt-3 block text-[11px] leading-5 text-muted-foreground">{metric.status === "unavailable" ? t(metric.reason) : t("Dayanağını incele")}</span></button></ReportReveal>)}</section>}
    <section className={`${reportPanel} my-5 p-6 sm:p-8`} aria-labelledby="result-summary"><div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary dark:text-secondary"><FileCheck2 className="h-4 w-4" aria-hidden="true" />{t("Kaynaklı özet")}</div><h2 id="result-summary" className="sr-only">{t("Yönetici özeti")}</h2>{result.summary.map((statement, index) => <p key={index} className="max-w-4xl text-base leading-8">{t(statement.text)}</p>)}</section>
    {result.charts.length > 0 && <div className={`grid gap-5 ${result.charts.length === 3 ? "xl:grid-cols-3" : "lg:grid-cols-2"}`}>{result.charts.map((chart, index) => { const dataset = result.datasets.find(item => item.id === chart.datasetId)!; return <ReportReveal key={chart.id} delay={index * 0.04}><section className={`${reportPanel} p-5 sm:p-6`}><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight">{t(chart.title)}</h2><span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">{t(dataset.unit)}</span></div><ReportChart dataset={dataset} type={chart.type} onPoint={openMetric} testId={`chart-${chart.id}`} />{chart.type === "donut" && <><ul aria-label={t(dataset.label)} className="mb-4 mt-1 space-y-1">{dataset.points.map((point, n) => <li key={point.metricId}><button onClick={() => openMetric(point.metricId)} className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-2 py-2 text-xs transition-colors hover:bg-muted ${focus}`}><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors[n % colors.length] }} /><span>{t(point.label)}</span><span className="ms-auto font-semibold tabular-nums">{reportNumber(point.value, "")}</span><ArrowUpRight aria-hidden="true" className="ms-1 h-3.5 w-3.5 text-muted-foreground" /></button></li>)}</ul><p className="mb-4 text-[11px] leading-5 text-muted-foreground">{t("Örnek yorumlar için elle belirlenmiş duygu etiketleri.")}</p></>}<details className="border-t border-border pt-3 text-xs"><summary className={`w-fit cursor-pointer rounded py-2 font-medium ${focus}`}>{t("Veri tablosu")}</summary><table className="mt-3 w-full text-start"><caption className="sr-only">{t(dataset.label)}</caption><thead><tr><th scope="col" className="py-3 font-medium">{t("Konu")}</th><th scope="col" className="text-end font-medium">{t("Değer")}</th><th scope="col" className="text-end font-medium">{t("Kaynak")}</th></tr></thead><tbody>{dataset.points.map(point => <tr key={point.metricId} className="border-t border-border"><th scope="row" className="py-3 font-normal">{t(point.label)}</th><td className="text-end tabular-nums">{reportNumber(point.value, dataset.unit)}</td><td className="text-end"><button onClick={() => openMetric(point.metricId)} aria-label={t("{0} kaynağı", point.label)} className={`rounded p-2 text-primary dark:text-secondary ${focus}`}><ArrowUpRight className="h-4 w-4" aria-hidden="true" /></button></td></tr>)}</tbody></table></details></section></ReportReveal>; })}</div>}
    <ReportFindings result={result} onOpen={setSelection} />
    {children}
    <ReportDetails title={t("Kapsam ve hesap yöntemleri")} description="Analiz hedefi, kaynak kapsamı ve değerlendirme sınırları."><p className="text-sm leading-7">{t(result.objective)}</p><ul className="mt-4 space-y-3 text-xs leading-6 text-muted-foreground">{result.limitations.map(item => <li key={item}>{t(item)}</li>)}</ul></ReportDetails>
    <AnimatePresence>{selection && <SourceDialog selection={selection} sources={sources} onClose={() => setSelection(null)} />}</AnimatePresence>
  </>;
}
