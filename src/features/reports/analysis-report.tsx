import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, FileCheck2, Layers3, ListFilter, ScanLine, Table2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { AiResult } from "../../../functions/src/analysis/result-contract";
import { ReportChart } from "./report-chart";
import { SourceDialog, type ReportSource, type SourceSelection } from "./source-dialog";

interface Props { result: AiResult; sources: ReportSource[]; overviewTitle: string; highlights: { metricId: string; note: string }[] }

// Para/yüzde/adet değerlerini aynı hassasiyet ve açık birimle bütün raporda tutarlı sunar.
function formatValue(value: number | null, unit: string) {
  if (value === null) return "Hesaplanamadı";
  const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
  return unit === "%" ? `%${number}` : `${number} ${unit === "TRY" ? "TL" : unit}`;
}

// Doğrulanmış sonuç sözleşmesini grafik, erişilebilir tablo ve kanıta açılan bulgular halinde sunar.
export function AnalysisReport({ result, sources, highlights, overviewTitle }: Props) {
  const [chartIndex, setChartIndex] = useState(0);
  const [tableOpen, setTableOpen] = useState(false);
  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const reducedMotion = useReducedMotion();
  const chart = result.charts[chartIndex];
  const dataset = result.datasets.find(item => item.id === chart?.datasetId);
  const openMetric = (id: string) => {
    const metric = result.metrics.find(item => item.id === id);
    if (metric) setSelection({ title: metric.label, evidence: metric.evidence, method: metric.method });
  };
  const reveal = { initial: { opacity: 0, y: reducedMotion ? 0 : 12 }, animate: { opacity: 1, y: 0 } };
  return <>
    <section aria-label="Öne çıkan metrikler" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {highlights.map(({ metricId, note }, index) => {
        const metric = result.metrics.find(item => item.id === metricId);
        if (!metric) return null;
        return <motion.button key={metricId} {...reveal} transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : index * 0.06 }} onClick={() => openMetric(metricId)} className="group flex min-w-0 flex-col items-start rounded-2xl border border-border/80 bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-6">
          <span className="flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground">{metric.label}<ArrowUpRight className="h-4 w-4 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-secondary" aria-hidden="true" /></span>
          <span className="mt-5 text-2xl font-semibold tabular-nums tracking-[-0.05em] sm:text-[2rem]">{formatValue(metric.value, metric.unit)}</span><span className="mt-2 text-xs leading-5 text-muted-foreground">{note}</span>
        </motion.button>;
      })}
    </section>

    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
      {chart && dataset && <section className="min-w-0 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-7" aria-labelledby="chart-title">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Verinin görünümü</p><h2 id="chart-title" className="mt-2 text-xl font-semibold tracking-tight">{chart.title}</h2></div><div role="group" aria-label="Grafik görünümü" className="inline-flex rounded-xl bg-muted p-1">{result.charts.map((item, index) => <button key={item.id} aria-pressed={chartIndex === index} onClick={() => setChartIndex(index)} className="relative rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{chartIndex === index && <motion.span layoutId="chart-selection" transition={{ duration: reducedMotion ? 0 : 0.2 }} className="absolute inset-0 rounded-lg border border-border bg-card shadow-sm" />}<span className="relative">{index === 0 ? "Dönemler" : "Kategoriler"}</span></button>)}</div></div>
        <p className="mt-3 text-xs text-muted-foreground">{dataset.unit === "TRY" ? "Net satış · TL" : dataset.unit} <span aria-hidden="true">/</span> Değerleri seçerek kaynağı inceleyin</p>
        <ReportChart dataset={dataset} type={chart.type} onPoint={openMetric} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="text-xs text-muted-foreground">{dataset.points.length} karşılaştırılabilir değer · sıfır tabanlı eksen</p><Button variant="ghost" onClick={() => setTableOpen(!tableOpen)} aria-expanded={tableOpen} aria-controls="chart-data" className="gap-2 text-xs"><Table2 className="h-4 w-4" aria-hidden="true" />Veri tablosu<ChevronDown className={`h-3 w-3 transition-transform ${tableOpen ? "rotate-180" : ""}`} aria-hidden="true" /></Button></div>
        <div id="chart-data" hidden={!tableOpen} className="mt-3"><table className="w-full text-left text-sm"><caption className="sr-only">{dataset.label}, {dataset.unit}</caption><thead><tr className="border-b border-border text-xs text-muted-foreground"><th scope="col" className="py-3 font-medium">{chart.type === "horizontal-bar" ? "Kategori" : "Dönem"}</th><th scope="col" className="py-3 text-right font-medium">Değer ({dataset.unit === "TRY" ? "TL" : dataset.unit})</th><th scope="col" className="py-3 text-right font-medium">Dayanak</th></tr></thead><tbody>{dataset.points.map(point => <tr key={point.metricId} className="border-b border-border/50"><th scope="row" className="py-3 font-medium">{point.label}</th><td className="py-3 text-right tabular-nums">{formatValue(point.value, dataset.unit)}</td><td className="py-3 text-right"><button onClick={() => openMetric(point.metricId)} className="rounded px-2 py-1 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary" aria-label={`${point.label} kaynağını incele`}>Kaynak <ArrowUpRight className="inline h-3 w-3" aria-hidden="true" /></button></td></tr>)}</tbody></table></div>
      </section>}
      <aside className="flex self-start flex-col rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-card p-6 dark:border-secondary/15 dark:from-secondary/[0.06] sm:p-7 lg:min-h-[31rem]" aria-labelledby="summary-title">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/10 bg-card text-primary dark:text-secondary"><ScanLine className="h-5 w-5" aria-hidden="true" /></span><p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary dark:text-secondary">Bir bakışta</p><h2 id="summary-title" className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{overviewTitle}</h2>
        <div className="mt-5 space-y-4">{result.summary.map((statement, index) => <p key={index} className="text-sm leading-7 text-muted-foreground">{statement.text}</p>)}</div>
        <button onClick={() => setSelection({ title: "Yönetici özeti", evidence: result.summary.flatMap(item => item.evidence) })} className="mt-6 flex w-fit items-center gap-2 rounded-lg text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary"><FileCheck2 className="h-4 w-4" aria-hidden="true" /> Özetin dayanaklarını gör <ArrowRight className="h-3 w-3" aria-hidden="true" /></button>
        <div className="mt-auto pt-8"><div className="flex items-center gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground"><Check className="h-4 w-4 shrink-0 text-primary dark:text-secondary" aria-hidden="true" /> Metrikler ve kaynak bağları doğrulandı</div></div>
      </aside>
    </div>

    <section className="mt-10" aria-labelledby="findings-title"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary dark:text-secondary">Sayıların arkasında</p><h2 id="findings-title" className="mt-2 text-2xl font-semibold tracking-tight">{result.findings.length} net bulgu.</h2></div><span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Layers3 className="h-4 w-4" aria-hidden="true" /> Kaynaklarıyla birlikte</span></div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">{result.findings.map((finding, index) => <article key={finding.id} className="flex flex-col rounded-2xl border border-border/80 bg-card p-6"><div className="flex items-center justify-between"><span className="text-sm font-semibold tabular-nums text-primary/70 dark:text-secondary">0{index + 1}</span><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{finding.kind === "observation" ? "Gözlem" : "Yorum"}</span></div><h3 className="mt-5 text-lg font-semibold leading-snug tracking-tight">{finding.title}</h3>{finding.statements.map((statement, n) => <p key={n} className="mt-3 text-sm leading-7 text-muted-foreground">{statement.text}</p>)}<button onClick={() => setSelection({ title: finding.title, evidence: finding.statements.flatMap(item => item.evidence) })} className="mt-auto flex w-fit items-center gap-2 rounded pt-6 text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary">Kaynakları incele <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></button></article>)}</div>
    </section>

    <section className="mt-5 grid gap-5 rounded-3xl border border-primary/15 bg-primary/[0.04] p-6 dark:border-secondary/15 dark:bg-secondary/[0.04] sm:p-7 lg:grid-cols-[0.7fr_1.3fr]" aria-labelledby="next-title"><div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-secondary"><ArrowDownRight className="h-4 w-4" aria-hidden="true" /> Sonraki adım</p><h2 id="next-title" className="mt-3 text-xl font-semibold tracking-tight">Daha iyi bir soru ile ilerleyin.</h2></div><div>{result.recommendations.map(item => <div key={item.id}><p className="text-sm leading-7">{item.action}</p><p className="mt-3 text-xs text-muted-foreground">Dayanak: {item.basisFindingIds.map(id => result.findings.find(finding => finding.id === id)?.title).join(" · ")}</p></div>)}</div></section>
    <details className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-6"><summary className="flex cursor-pointer items-center gap-2 rounded text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ListFilter className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" /> Kapsam, yöntem ve sınırlar</summary><p className="mt-4 text-sm leading-7"><span className="font-semibold">Analiz hedefi: </span>{result.objective}</p><ul className="mt-4 space-y-2 pl-5 text-sm leading-7 text-muted-foreground">{result.limitations.map(item => <li key={item} className="list-disc">{item}</li>)}</ul><p className="mt-4 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">Grafikler doğrulanmış metriklerden çizilir. Kaynak bağlantısı metnin tüm anlamsal doğruluğunu veya neden-sonuç ilişkisini tek başına kanıtlamaz.</p></details>
    <AnimatePresence>{selection && <SourceDialog selection={selection} sources={sources} onClose={() => setSelection(null)} />}</AnimatePresence>
  </>;
}
