import { t, useLocale } from "../../i18n/runtime";
import { ArrowDownToLine, ArrowUpRight, BookOpen, FileSpreadsheet, FileText, Layers3 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { sourceCatalog, sourceExtent } from "./source-catalog";
import type { ReportSource, SourceSelection } from "./source-dialog";
import { ReportReveal } from "./report-primitives";

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

// Özgün dosya indirmelerini, kaynak kanıtından okunan içerik ve format bilgisiyle tek belge kütüphanesinde birleştirir.
export function DocumentLibrary({ sources, onOpen }: { sources: ReportSource[]; onOpen: (selection: SourceSelection) => void }) {
  useLocale();
  const reduced = useReducedMotion();
  const ordered = [...sources].sort((a, b) => (sourceCatalog[a.sourceId]?.number ?? "").localeCompare(sourceCatalog[b.sourceId]?.number ?? ""));
  return <section id="kaynaklar" className="mt-12 scroll-mt-32" aria-labelledby="sources-title">
    <ReportReveal><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary dark:text-secondary">{t("08 / Kaynak dosyası")}</p><h2 id="sources-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{t("Bir rapor. Bütün dayanakları.")}</h2><p className="mt-3 max-w-2xl text-xs leading-6 text-muted-foreground">{t("Yönetim belgelerinden en küçük satış kırılımına. Özgün dosyayı indirin veya raporun içinden kaynağını açın.")}</p></div><span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[10px] text-muted-foreground"><Layers3 className="h-3.5 w-3.5" aria-hidden="true" />{t("9 belge · 8 format")}</span></div></ReportReveal>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">{ordered.map((source, index) => {
      const meta = sourceCatalog[source.sourceId];
      const editorial = ["PDF", "DOCX"].includes(meta.format);
      const Icon = ["CSV", "XLSX"].includes(meta.format) ? FileSpreadsheet : meta.format === "PDF" ? BookOpen : FileText;
      return <ReportReveal key={source.sourceId} delay={index * 0.045} className={editorial ? "lg:col-span-3" : "lg:col-span-2"}>
        <motion.article whileHover={reduced ? {} : { y: -4 }} transition={{ duration: 0.2 }} className="surface group relative flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[0_16px_48px_-36px_rgba(2,7,10,0.22)]">
          {editorial && <div className="relative flex h-40 items-end overflow-hidden border-b border-border/70 bg-gradient-to-br from-primary/[0.08] via-muted/50 to-card px-6 pt-6 dark:from-secondary/[0.08]" aria-hidden="true"><div className="absolute end-6 top-4 text-[80px] font-semibold leading-none tracking-tighter text-primary/[0.06] dark:text-secondary/[0.06]">{meta.number}</div><div className="relative w-44 origin-bottom -rotate-6 rounded-t-xl border border-border bg-card p-4 shadow-lg transition-transform duration-300 group-hover:rotate-0"><span className="text-[8px] font-semibold tracking-[0.14em] text-primary dark:text-secondary">{t("ATLAS / 2025")}</span><p className="mt-3 max-w-28 text-sm font-semibold leading-tight">{t(t(meta.name))}</p><div className="mt-4 flex h-7 items-end gap-1">{["h-2", "h-3", "h-4", "h-3", "h-5", "h-6", "h-7"].map((height, n) => <span key={n} className={`w-3 rounded-t-sm bg-primary/20 dark:bg-secondary/20 ${height}`} />)}</div></div><span className="mb-5 ms-auto rounded-full border border-border bg-card/90 px-3 py-1.5 text-[10px] text-muted-foreground">{meta.format === "PDF" ? t("7 sayfa") : t("Word belgesi")}</span></div>}
          <div className="flex flex-1 flex-col p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-[9px] uppercase tracking-widest text-muted-foreground"><Icon className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" />{t(meta.department)}</span><span className="rounded-md border border-border px-2 py-1 text-[9px] font-semibold">{meta.format}</span></div><h3 className="mt-4 text-lg font-semibold tracking-tight">{t(t(meta.name))}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{t(meta.description)}</p><p className="mt-4 text-[10px] font-medium text-primary dark:text-secondary">{sourceExtent(source)}</p><p className="mt-1 truncate text-[10px] text-muted-foreground" title={source.fileName}>{source.fileName}</p><div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-xs"><button onClick={() => onOpen({ title: meta.name, evidence: source.chunks.map(chunk => ({ sourceId: source.sourceId, sha256: source.sha256, chunkId: chunk.id, locator: chunk.locator })) })} className={`mt-4 inline-flex items-center gap-2 rounded-md font-semibold text-primary dark:text-secondary ${focus}`}>{t("Belgeyi incele")}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></button><a href={meta.url} download={source.fileName} aria-label={t("{0} özgün dosyasını indir", t(meta.name))} className={`mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[10px] hover:bg-muted ${focus}`}><ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />{t("İndir")}</a></div></div>
        </motion.article>
      </ReportReveal>;
    })}</div>
  </section>;
}
