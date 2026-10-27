import { useOutsideDismiss } from "../../hooks/use-outside-dismiss";
import { t, useLocale, localeTag } from "../../i18n/runtime";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Download, FileText, Search, X } from "lucide-react";
import { sourceCatalog, sourceExtent } from "./source-catalog";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import type { AiResult } from "../../../functions/src/analysis/result-contract";

export type Evidence = AiResult["metrics"][number]["evidence"];
export interface ReportSource {
  sourceId: string; fileName: string; sha256: string;
  chunks: { id: string; locator: { rowStart?: number; rowEnd?: number; page?: number; sheet?: string; section?: string; slide?: number }; text?: string; table?: { columns: string[]; rows: (string | number | boolean | null)[][] } }[];
}
export interface SourceSelection { title: string; evidence: Evidence; method?: string }
const columnLabels: Record<string, string> = { reviewer_name: "Ad soyad", analysis_type: "Analiz türü", service_orders: "Hizmet işi", billable_units: "Faturalanabilir birim", gross_revenue_try: "Brüt gelir · TL", service_credit_try: "Hizmet kredisi · TL", direct_cost_try: "Doğrudan maliyet · TL", sales_marketing_try: "Satış/pazarlama · TL", service_delivery_try: "Hizmet operasyonu · TL", completed_services: "Tamamlanan hizmet işi", on_time_services: "Zamanında tamamlanan", late_services: "Geciken hizmet işi", feedback_id: "Yorum kimliği", received_date: "Tarih", comment: "Yorum metni", record_id: "Kayıt kimliği", period: "Dönem", region: "Bölge", channel: "Kanal", category: "Kategori", segment: "Müşteri segmenti", orders: "Sipariş", units: "Ürün adedi", gross_sales_try: "Brüt satış · TL", discount_try: "İndirim · TL", refund_try: "İade · TL", cost_of_goods_try: "Mal maliyeti · TL", marketing_try: "Pazarlama · TL", fulfillment_try: "Karşılama · TL", net_sales_budget_try: "Satış bütçesi · TL", shipped_orders: "Sevk edilen", on_time_orders: "Zamanında teslim", late_orders: "Gecikmeli teslim" };
const names = Object.fromEntries(Object.entries(sourceCatalog).map(([id, item]) => [id, item.name]));
const PAGE_SIZE = 25;

// Metin aramasını kaynak içeriğini HTML olarak yorumlamadan işaretler.
function highlightText(text: string, query: string) {
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return text;
  const haystack = text.toLocaleLowerCase("tr-TR");
  const parts: React.ReactNode[] = [];
  let start = 0, index = haystack.indexOf(needle);
  while (index >= 0) {
    parts.push(text.slice(start, index), <mark key={index} className="rounded bg-primary/15 px-0.5 text-foreground dark:bg-secondary/20">{text.slice(index, index + needle.length)}</mark>);
    start = index + needle.length;
    index = haystack.indexOf(needle, start);
  }
  parts.push(text.slice(start));
  return parts;
}

// Büyük kaynaklarda sabit satır kimlikleriyle arama/sayfalama sunar; odak kilidi ve Escape yerel dialog'a aittir.
export function SourceDialog({ selection, sources, onClose }: { selection: SourceSelection; sources: ReportSource[]; onClose: () => void }) {
  useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  useOutsideDismiss(dialog, onClose);
  const available = sources.filter(source => selection.evidence.some(item => item.sourceId === source.sourceId));
  const [sourceId, setSourceId] = useState(available[0]?.sourceId ?? "");
  const [query, setQuery] = useState("");
  const [allRows, setAllRows] = useState(false);
  const [page, setPage] = useState(1);
  const reduced = useReducedMotion();
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    const wasLocked = document.body.classList.contains("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    element.showModal();
    return () => { element.close(); if (!wasLocked) document.body.classList.remove("overflow-hidden"); previousFocus?.focus({ preventScroll: true }); };
  }, []);
  const source = available.find(item => item.sourceId === sourceId)!;
  const records = source.chunks.flatMap(chunk => chunk.table?.rows.map((cells, index) => {
    const row = (chunk.locator.rowStart ?? 1) + index;
    const evidence = selection.evidence.some(item => item.sourceId === sourceId && item.chunkId === chunk.id && (item.locator.rowStart === undefined || row >= item.locator.rowStart && row <= item.locator.rowEnd!));
    return { cells, row, evidence, chunk };
  }) ?? []);
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = records.filter(record => (allRows || record.evidence) && (!needle || [String(record.row), ...record.cells.map(String)].some(value => value.toLocaleLowerCase("tr-TR").includes(needle))));
  const textual = !source.chunks.some(chunk => chunk.table);
  const textChunks = source.chunks.filter(chunk => (allRows || selection.evidence.some(item => item.sourceId === sourceId && item.chunkId === chunk.id)) && (!needle || chunk.text?.toLocaleLowerCase("tr-TR").includes(needle)));
  const original = sourceCatalog[sourceId];
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const columns = source.chunks.find(chunk => chunk.table)?.table?.columns ?? [];
  // Native üst katmanda transform/kaydırma uygulanmaz; hareket yalnız iç panelde, taşma clip ile sınırlandırılır.
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="source-title" aria-describedby="source-description" className="surface fixed inset-0 m-auto h-[calc(100dvh-2rem)] overscroll-contain max-h-[56rem] w-[calc(100%-1.5rem)] max-w-7xl overflow-clip rounded-3xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/35 backdrop:backdrop-blur-md">
    <motion.div initial={{ opacity: 0, y: reduced ? 0 : 24, scale: reduced ? 1 : 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduced ? 0 : 12 }} transition={{ duration: reduced ? 0 : 0.25 }} className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="relative z-20 flex shrink-0 items-start bg-card justify-between gap-4 border-b border-border p-5 sm:px-7 sm:py-6"><div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary dark:text-secondary"><span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-secondary" />  {t("Kaynak çalışma alanı")}</p><h2 id="source-title" className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{t(selection.title)}</h2><p id="source-description" className="mt-2 text-xs leading-5 text-muted-foreground">{t("Sonucu özgün belgeye kadar takip edin. Tablolarda satır, PDF belgelerinde sayfa, Word belgelerinde metin bölümü korunur.")}</p></div><Button variant="ghost" size="icon" aria-label={t("Kaynak incelemesini kapat")} onClick={onClose} className="shrink-0 rounded-full"><X className="h-5 w-5" aria-hidden="true" /></Button></header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="min-w-0 shrink-0 border-b border-border bg-muted/40 p-4 lg:border-b-0 lg:border-e lg:p-5" aria-label={t("Dayanak belgeleri")}><p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t("Belgeler · {0}", available.length)}</p><div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col">{available.map(item => <button key={item.sourceId} onClick={() => { setSourceId(item.sourceId); setQuery(""); setPage(1); }} aria-pressed={sourceId === item.sourceId} className={`flex min-w-[12rem] items-start gap-3 rounded-xl border p-3 text-start text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${sourceId === item.sourceId ? "border-primary/25 bg-card shadow-sm dark:border-secondary/25" : "border-transparent hover:bg-card/70"}`}><FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-secondary" aria-hidden="true" /><span className="min-w-0"><span className="block font-semibold">{t(names[item.sourceId]) ?? item.fileName}</span><span className="mt-1 block text-[10px] text-muted-foreground">{sourceExtent(item)} · {sourceCatalog[item.sourceId]?.format ?? t("Belge")}</span></span></button>)}</div><div className="mt-5 hidden rounded-xl border border-border bg-card/70 p-3 lg:block"><p className="flex items-center gap-2 text-[11px] font-medium"><Check className="h-3 w-3 text-primary dark:text-secondary" aria-hidden="true" />  {t("Kaynağa bağlı görünüm")}</p><p className="mt-2 text-[10px] leading-5 text-muted-foreground">{t("Arama ve sayfalama özgün satır numaralarını değiştirmez.")}</p></div></aside>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {selection.method && <div className="mb-5 rounded-xl border border-primary/10 bg-primary/[0.04] px-4 py-3 dark:border-secondary/15 dark:bg-secondary/[0.04]"><p className="text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-secondary">{t("Hesap yöntemi")}</p><p className="mt-1.5 text-xs leading-6 text-muted-foreground">{t(selection.method)}</p></div>}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-lg border border-border bg-muted px-2 py-1 text-[9px] font-semibold">{original?.format ?? t("Belge")}</span><span className="text-[10px] text-muted-foreground">{sourceExtent(source)}</span></div>{original && <a href={original.url} download={source.fileName} aria-label={t("{0} özgün dosyasını indir", t(names[sourceId]))} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[10px] font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Download className="h-3.5 w-3.5" aria-hidden="true" />{t("Özgün belgeyi indir")}</a>}</div>
          {textual ? <div><div className="mb-4"><h3 className="text-base font-semibold">{t(names[sourceId]) ?? source.fileName}</h3><p className="mt-1 break-all text-[10px] text-muted-foreground">{source.fileName}</p></div><div className="relative mb-4"><Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><input aria-label={t("Belge metninde ara")} value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Belgede bir kavram veya ifade arayın…")} className="h-10 w-full rounded-xl border border-border bg-background ps-10 pe-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-xs" /></div><p role="status" className="mb-4 text-[10px] text-muted-foreground">{t("{0} kaynak bölümü gösteriliyor", textChunks.length)}{query ? ` · “${query}”` : ""}</p><div className="space-y-5">{textChunks.map((chunk, index) => <article key={chunk.id} className="mx-auto max-w-3xl rounded-2xl border border-border bg-background/50 p-5 shadow-sm sm:p-8"><div className="mb-5 flex items-center justify-between gap-3 border-b border-border pb-4 text-[10px]"><span className="font-semibold uppercase tracking-[0.12em] text-primary dark:text-secondary">{chunk.locator.page ? t("Sayfa {0}", chunk.locator.page) : chunk.locator.slide ? t("Slayt {0}", chunk.locator.slide) : t("Metin bölümü {0}", source.chunks.indexOf(chunk) + 1)}</span><span className="text-muted-foreground">{t(t(names[sourceId]))}</span></div><div className="space-y-4">{chunk.text?.split(/\n\s*\n/).filter(Boolean).map((paragraph, n) => <p key={n} lang="tr" dir="auto" className="whitespace-pre-line break-words text-xs leading-7 text-muted-foreground sm:text-sm sm:leading-8">{highlightText(paragraph, query)}</p>)}</div><p className="mt-6 border-t border-border pt-3 text-end text-[9px] text-muted-foreground">{index + 1}  {t("/ {0} görünür bölüm", textChunks.length)}</p></article>)}{!textChunks.length && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t("Belgede aramanızla eşleşen bölüm yok.")}</p>}</div></div> : <>          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">{t(names[sourceId]) ?? source.fileName}</h3><p className="mt-1 text-[10px] text-muted-foreground">{t("{0} · {1} kayıt · {2} dayanak", source.fileName, records.length, records.filter(record => record.evidence).length)}</p></div><label className="flex items-center gap-2 text-xs"><Checkbox checked={allRows} onCheckedChange={value => { setAllRows(value === true); setPage(1); }} className="h-4 w-4" />{t("Tüm kaynak satırları")}</label></div>
          <div className="relative mb-4"><Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><input aria-label={t("Kaynak satırlarında ara")} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={columns.includes("feedback_id") ? t("Yorum kimliği, tarih veya yorum metni ara…") : t("Kayıt kimliği, dönem, kanal veya kategori ara…")} className="h-10 w-full rounded-xl border border-border bg-background ps-10 pe-10 text-base outline-none sm:text-xs focus-visible:ring-2 focus-visible:ring-primary" />{query && <button aria-label={t("Kaynak aramasını temizle")} onClick={() => { setQuery(""); setPage(1); }} className="absolute end-2 top-2 rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-4 w-4" aria-hidden="true" /></button>}</div>
          <div role="region" aria-label={t("{0} kaynak satırları", source.fileName)} tabIndex={0} className="max-h-[43dvh] overflow-auto overscroll-contain rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:max-h-[48dvh]"><table className="w-full whitespace-nowrap text-start text-xs"><caption className="sr-only">{t("{0} için kaynak satırları", selection.title)}</caption><thead className="sticky top-0 z-10 bg-muted"><tr><th scope="col" className="px-4 py-3 font-medium">{t("Satır")}</th>{columns.map((column, index) => <th scope="col" key={index} title={column} className="px-4 py-3 font-medium">{t(column === "category" && columns.includes("service_orders") ? "Hizmet alanı" : columnLabels[column]) ?? column}</th>)}</tr></thead><tbody>{shown.map(({ cells, row, evidence, chunk }) => <tr key={`${chunk.id}:${row}`} className="border-t border-border/60 transition-colors hover:bg-muted/50"><th scope="row" className="bg-card px-4 py-3 font-medium"><span className="inline-flex items-center gap-2">{evidence && <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-secondary" aria-hidden="true" />}{row}{evidence && <span className="sr-only">{t(", dayanak")}</span>}</span></th>{cells.map((cell, index) => <td key={index} className="px-4 py-3 text-muted-foreground" title={String(cell ?? "")}>{columns[index].endsWith("_try") ? new Intl.NumberFormat(localeTag(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(cell)) : cell === null ? "—" : String(cell)}</td>)}</tr>)}</tbody></table>{!shown.length && <p className="p-8 text-center text-sm text-muted-foreground">{t("Aramanızla eşleşen kaynak satırı yok.")}</p>}</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-xs text-muted-foreground">{filtered.length ? (current - 1) * PAGE_SIZE + 1 : 0}–{Math.min(current * PAGE_SIZE, filtered.length)}  {t("/ {0} kayıt", filtered.length)}</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label={t("Önceki kaynak sayfası")}><ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" /></Button><span className="min-w-16 text-center text-xs tabular-nums">{current} / {pages}</span><Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label={t("Sonraki kaynak sayfası")}><ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" /></Button></div></div>
          </>}
          <details className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground"><summary className="w-fit cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("Belge kimliği ve bütünlük")}</summary><p className="mt-2 break-all leading-5">{t("SHA-256: {0}", source.sha256)}</p></details>
        </div>
      </div>
    </motion.div>
  </dialog>;
}
