import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, FlaskConical } from "lucide-react";
import { MotionConfig } from "motion/react";
import { AnimatedLogo } from "../components/animated-logo";
import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";
import { AnalysisReport } from "../features/reports/analysis-report";
import example from "../features/reports/sales-example.json";
import sourceUrl from "../../fixtures/analysis-reference/v1/sales.csv?url";
import { validateAiResult } from "../../functions/src/analysis/result-contract";

// Sürüm kontrollü sentetik raporu sunmadan önce metrik/kaynak sözleşmesini yeniden doğrular; AI veya hesap servisi çağırmaz.
const result = validateAiResult(example.result, example.packet.validationContext);

// Ziyaretçiye oturum gerektirmeyen, gerçek kullanıcı verilerinden ayrılmış etkileşimli rapor deneyimi sunar.
export function ExampleReportPage() {
  return <MotionConfig reducedMotion="user"><div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border/70 bg-card/60"><nav aria-label="Örnek rapor navigasyonu" className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8"><Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Incagen ana sayfa"><AnimatedLogo compact className="h-8 w-8" /><span className="text-lg font-semibold tracking-tight">Incagen</span></Link><div className="flex items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:inline">Örnek rapor</span><ThemeToggle /><Button asChild className="rounded-xl"><Link to="/app/new-analysis">Analize başla<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button></div></nav></header>
    <main className="mx-auto max-w-7xl px-5 pb-12 pt-7 sm:px-8 sm:pt-10">
      <Link to="/" className="inline-flex items-center gap-2 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Ana sayfa</Link>
      <div className="mb-8 mt-7 flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="flex items-center gap-2 text-xs font-medium text-primary dark:text-secondary"><span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 dark:border-secondary/20"><FlaskConical className="mr-1.5 inline h-3 w-3" aria-hidden="true" />Sentetik örnek</span><span>{example.period}</span></p><h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.055em] sm:text-5xl">{example.title}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">İki dönem, tek kaynak. Satışların nasıl değiştiğini görün; her sayıyı dayandığı satırlara kadar takip edin.</p></div><a href={sourceUrl} download="incagen-ornek-satis.csv" className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Download className="h-4 w-4" aria-hidden="true" /> Örnek CSV’yi indir</a></div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-xs leading-5 text-muted-foreground"><span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 shrink-0 text-primary dark:text-secondary" aria-hidden="true" />12 sentetik olay · 1 CSV kaynağı</span><span>Gerçek işletme verisi içermez. Hesabınıza kaydedilmez.</span></div>
      <AnalysisReport overviewTitle="Artış var. Nedenini ayrı inceleyin." result={result} sources={example.packet.modelInput.documents} highlights={[{ metricId: "net-sales", note: "İndirim ve iadeler sonrası · iki dönem" }, { metricId: "growth-percent", note: "Ekim / Eylül · 550 TL artış" }, { metricId: "category-0", note: "Teknoloji · toplam net satışın %43,14’ü" }, { metricId: "net-units", note: "İade dahil ürün adedi · müşteri sayısı değil" }]} />
      <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border pt-5 text-xs leading-6 text-muted-foreground"><p>Bu örnekte AI çağrısı yapılmadı. Hesaplar sentetik CSV’den üretilip doğrulandı.</p><span>Incagen <span aria-hidden="true">/</span> Kaynaktan karara</span></footer>
    </main>
  </div></MotionConfig>;
}
