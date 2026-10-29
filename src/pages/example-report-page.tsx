import { ExampleReportHeader, reportContainer } from "../features/reports/example-report-header";
import { companyDisplay } from "../features/reports/company-display";
import { t, useLocale, localeTag } from "../i18n/runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Building2, Download, FolderOpen } from "lucide-react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { AnalysisReport } from "../features/reports/analysis-report";
import { ReportReveal } from "../features/reports/report-primitives";
import documentsJson from "../features/reports/company-sources.json";
import sourceUrl from "../features/reports/atlas-2025-kaynaklar.zip?url";
import { COMPANY_PERIODS, createCompanyReport, type CompanyPeriod } from "../../functions/src/examples/company-report";
import type { ParsedDocument } from "../../functions/src/contracts";

const documents = documentsJson as ParsedDocument[];
const sections = [{ id: "genel-bakis", label: "Genel bakış" }, { id: "ticari-performans", label: "Performans" }, { id: "finansal-detay", label: "Finansal detay" }, { id: "bulgular", label: "Bulgular" }, { id: "kaynaklar", label: "Kaynaklar" }];
const periods: { id: CompanyPeriod; label: string }[] = [{ id: "year", label: "Tam yıl" }, { id: "h1", label: "İlk 6 ay" }, { id: "h2", label: "Son 6 ay" }, { id: "q4", label: "Son çeyrek" }];

// Kaynaklar aynı kalırken dönem filtresi bütün raporu birlikte hesaplar; seçim paylaşılabilir URL'de korunur.
export function ExampleReportPage() {
  const locale = useLocale();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requested = params.get("period") ?? "year";
  const period: CompanyPeriod = Object.prototype.hasOwnProperty.call(COMPANY_PERIODS, requested) ? requested as CompanyPeriod : "year";
  const report = useMemo(() => companyDisplay(createCompanyReport(documents, period), locale), [period, locale]);
  const [activeSection, setActiveSection] = useState("genel-bakis");
  const reduced = useReducedMotion();
  const previousLocation = useRef({ period, hash: location.hash });
  // Bölüm adreslerini doğrudan açılışta ve geri/ileride çözer; kapalı ayrıntıyı açmadan kaydırmaz.
  useEffect(() => {
    const previous = previousLocation.current;
    previousLocation.current = { period, hash: location.hash };
    const section = sections.find(item => `#${item.id}` === location.hash);
    const targetId = section?.id ?? (!location.hash && (previous.period !== period || previous.hash) ? "genel-bakis" : null);
    if (!targetId) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      const disclosure = target?.closest("details");
      if (disclosure) disclosure.open = true;
      target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      setActiveSection(targetId);
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash, location.key, period, reduced]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.find(entry => entry.isIntersecting);
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: "-12% 0px -65% 0px" });
    sections.forEach(section => { const element = document.getElementById(section.id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, [period]);
  const netValues = report.monthly.map(row => row.net);
  const min = Math.min(...netValues), max = Math.max(...netValues);
  const sparkline = netValues.map((value, index) => `${20 + index * 310 / Math.max(1, netValues.length - 1)},${85 - (value - min) * 65 / Math.max(1, max - min)}`).join(" ");
  return <MotionConfig reducedMotion="user"><div className="min-h-screen bg-background text-foreground glass:bg-transparent">
    <ExampleReportHeader active="commercial" />
    <main><div className="relative overflow-hidden border-b border-border/60"><div aria-hidden="true" className="pointer-events-none absolute -end-28 -top-40 h-[35rem] w-[35rem] rounded-full bg-primary/[0.04] blur-3xl dark:bg-secondary/[0.03]" /><div className={`${reportContainer} relative grid items-center gap-8 pb-9 pt-6 sm:py-10 lg:grid-cols-[1.35fr_0.65fr] lg:gap-16 lg:py-8`}>
      <ReportReveal><div className="flex flex-wrap items-center gap-2 text-[10px]"><span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 font-medium text-primary dark:border-secondary/20 dark:text-secondary">{t("Örnek rapor")}</span><span className="uppercase tracking-[0.14em] text-muted-foreground">{t("Atlas Teknoloji / Yönetim dosyası")}</span></div><h1 className="mt-4 max-w-3xl text-[clamp(2.3rem,3.7vw,3.3rem)] font-semibold leading-[1.04] tracking-[-0.05em]">{t("Performansın")}<br /><span className="text-primary dark:text-secondary">{t("büyük resmi.")}</span></h1><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{t("Gelir, kârlılık ve hizmet düzeyini birlikte inceleyin. Her bulguyu özgün belgesine kadar izleyin.")}</p><div className="mt-6 flex flex-wrap items-center gap-4"><a href={sourceUrl} download="atlas-teknoloji-2025.zip" className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-card px-4 py-3 text-xs font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Download className="h-3.5 w-3.5 text-primary dark:text-secondary" aria-hidden="true" />{t("Örnek belgeleri indir")}<span className="ms-1 text-[9px] text-muted-foreground">{t("ZIP · 8 format")}</span></a><span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />{t("3.612 kayıt · 12 ay · 9 belge")}</span></div></ReportReveal>
      <ReportReveal delay={0.1} className="hidden lg:block"><div className="relative mx-auto w-full max-w-sm"><div className="absolute -end-3 top-3 h-full w-full rounded-3xl border border-primary/10 bg-primary/[0.035] dark:border-secondary/10" aria-hidden="true" /><div className="surface relative overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_75px_-45px_rgba(70,35,110,0.4)]"><div className="flex items-center gap-3 border-b border-border/70 p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary"><Building2 className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-sm font-semibold">{t("Atlas Teknoloji")}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{t("Ticari performans / 2025")}</p></div><span className="ms-auto rounded-full bg-muted px-2 py-1 text-[9px] text-muted-foreground">{t(periods.find(item => item.id === period)!.label)}</span></div><div className="px-5 pt-4"><div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-muted-foreground"><span>{t("Net satış görünümü")}</span><span>{t("{0} ay", report.monthly.length)}</span></div><svg viewBox="0 0 350 100" className="mt-2 h-24 w-full text-primary dark:text-secondary" aria-hidden="true"><path d="M20 90H330 M20 55H330 M20 20H330" fill="none" className="stroke-border" strokeDasharray="3 5" /><motion.polyline key={period} points={sparkline} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 1.1, ease: "easeOut" }} /></svg></div><div className="flex justify-between border-t border-border bg-muted/40 px-5 py-3 text-[9px] text-muted-foreground"><span>{t("4 bölge · 3 kanal · 8 hizmet alanı")}</span><span>{t("TRY")}</span></div></div></div></ReportReveal>
    </div></div>
    <div className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur-xl"><div className={`${reportContainer} flex flex-col justify-between gap-3 py-3 lg:flex-row lg:items-center`}><nav aria-label={t("Rapor bölümleri")} className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">{sections.map(section => <Link key={section.id} to={{ search: location.search, hash: `#${section.id}` }} aria-current={activeSection === section.id ? "location" : undefined} className={`relative shrink-0 rounded-lg px-3 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${activeSection === section.id ? "text-primary dark:text-secondary" : "text-muted-foreground hover:text-foreground"}`}>{activeSection === section.id && <motion.span layoutId="report-section" className="absolute inset-0 rounded-lg bg-primary/[0.07] dark:bg-secondary/[0.08]" transition={{ duration: reduced ? 0 : 0.25 }} />}<span className="relative">{t(section.label)}</span></Link>)}</nav><div role="group" aria-label={t("Dönem seçimi")} className="inline-flex w-fit gap-1 rounded-xl border border-border/70 bg-card p-1">{periods.map(item => <button key={item.id} aria-pressed={period === item.id} onClick={() => { const next = new URLSearchParams(params); if (item.id === "year") next.delete("period"); else next.set("period", item.id); setParams(next); }} className={`relative rounded-lg px-3 py-1.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${period === item.id ? "text-primary dark:text-secondary" : "text-muted-foreground"}`}>{period === item.id && <motion.span layoutId="report-period" className="absolute inset-0 rounded-lg bg-muted" transition={{ duration: reduced ? 0 : 0.22 }} />}<span className="relative">{t(item.label)}</span></button>)}</div></div></div>
    <div className={`${reportContainer} pb-10 pt-6`}><div className="mb-4 flex items-center justify-between text-[10px] text-muted-foreground"><p className="font-medium text-foreground">{t(report.periodLabel)}</p><p>{new Intl.NumberFormat(localeTag()).format(report.sourceRows)}  {t("kayıt inceleniyor")}</p></div><AnalysisReport key={period} report={report} sources={documents} /><footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-[10px] text-muted-foreground"><span className="font-semibold tracking-tight text-foreground">{t("Incagen")} <span className="ms-2 font-normal text-muted-foreground">{t("Kaynaktan karara.")}</span></span><p>{t("İyi kararlar, izlenebilir kaynaklarla başlar.")}</p><Link to={{ search: location.search, hash: "#genel-bakis" }} className="rounded py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("Raporun başına dön ↑")}</Link></footer></div></main>
  </div></MotionConfig>;
}
