import { useOutsideDismiss } from "../hooks/use-outside-dismiss";
import { PageLoading } from "../components/page-loading";
import { t, useLocale, localeTag } from "../i18n/runtime";
import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Archive, ArrowRight, ArrowUpRight, CheckCheck, CircleCheckBig, FileClock, FilePlus2, FolderOpen, Layers3, LoaderCircle, MoreHorizontal, RotateCcw, Search, SlidersHorizontal, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { Analysis } from "../../functions/src/contracts";
import { Button } from "../components/ui/button";
import { buildHistoryView, DEFAULT_HISTORY_VIEW, parseHistoryView, serializeHistoryView, summarizeHistory, type HistoryPeriodFilter, type HistorySort, type HistoryStatusFilter, type HistoryViewOptions } from "../features/history/history-view";
import { useAnalyses } from "../hooks/use-analyses";
import { tr } from "../i18n/tr";
import { userError } from "../lib/errors";
import { authOnlyPreview } from "../lib/deployment-mode";
import { getServices } from "../lib/firebase";

interface DeleteTarget {
  items: { id: string; title: string }[];
}

interface Notice {
  kind: "success" | "error";
  text: string;
}

// Durumu listedeki kısa, renk destekli etikete dönüştürür; anlamı metin de taşır.
function statusTone(status: Analysis["status"]) {
  if (status === "completed") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "failed") return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  if (["processing", "deleting", "review"].includes(status)) return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}

// Tekli silmeyi bağlamsal menüye yerleştirir; mobilde menüyü sabit alt navigasyonun üstüne açar.
function HistoryActions({ analysis, disabled, onDelete }: { analysis: Analysis; disabled: boolean; onDelete: () => void }) {
  useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstActionRef.current?.focus();
    function handlePointer(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return <div ref={rootRef} className="relative shrink-0">
    <button ref={triggerRef} type="button" disabled={disabled}
      aria-label={t("{0} için diğer işlemler", analysis.title)} aria-expanded={open}
      aria-controls={"history-actions-" + analysis.id}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
      onClick={() => setOpen(value => !value)}>
      <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
    </button>
    {open && <div id={"history-actions-" + analysis.id} className="absolute bottom-full end-0 z-40 mb-1.5 w-48 rounded-2xl border border-border bg-card p-1.5 shadow-xl lg:bottom-auto lg:top-full lg:mb-0 lg:mt-1.5" aria-label={t("{0} işlemleri", analysis.title)}>
      <Link ref={firstActionRef} to={"/app/analyses/" + analysis.id}
        className="flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => setOpen(false)}>{t("Analizi aç")} <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
      <div className="my-1 border-t border-border" />
      <button type="button" className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-start text-sm text-red-700 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300"
        onClick={() => { setOpen(false); onDelete(); }}><Trash2 className="h-4 w-4" aria-hidden="true" />  {t("Analizi sil")}</button>
    </div>}
  </div>;
}

// Kullanıcıya özel geçmişi gösterir; seçim ve onay sonrasında mevcut güvenli silme endpoint'ini sırayla çağırır.
export function HistoryPage() {
  useLocale();
  const { rows, loading, error } = useAnalyses();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseHistoryView(searchParams);
  const { query, status: statusFilter, period: periodFilter, sort } = view;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useOutsideDismiss(dialogRef, () => setTarget(null), target !== null && progress === null);
  const visibleRows = buildHistoryView(rows, { query, status: statusFilter, period: periodFilter, sort });
  const selectedRows = visibleRows.filter(row => selectedIds.has(row.id));
  const allSelected = visibleRows.length > 0 && selectedRows.length === visibleRows.length;
  const summary = summarizeHistory(rows);
  const hasFilters = query.trim() !== "" || statusFilter !== "all" || periodFilter !== "all" || sort !== "newest";
  const advancedCount = Number(statusFilter !== "all") + Number(periodFilter !== "all") + Number(sort !== "newest");
  const [filtersOpen, setFiltersOpen] = useState(advancedCount > 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!target && dialog.open) dialog.close();
  }, [target]);

  // Seçim modunu kapatırken önceki işten kalan seçimleri temizler.
  function toggleSelectionMode() {
    setSelectionMode(value => !value);
    setSelectedIds(new Set());
    setNotice(null);
  }

  // Kart seçimini kimlik üzerinden günceller; canlı liste sırası değişse de seçim kararlı kalır.
  function toggleSelected(id: string) {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateView(update: Partial<HistoryViewOptions>) {
    setSearchParams(serializeHistoryView({ ...view, ...update }), { replace: true });
    setSelectedIds(new Set());
  }

  function clearFilters() { updateView(DEFAULT_HISTORY_VIEW); }

  // Onaydan sonra her analizi ayrı siler; kısmi hatada yalnız başarısız kayıtları seçili bırakır.
  async function deleteConfirmed() {
    if (!target || progress) return;
    const items = target.items;
    setProgress({ done: 0, total: items.length });
    setNotice(null);
    const failed: { id: string; title: string; reason: string }[] = [];
    let deleted = 0;
    try {
      const remove = httpsCallable<{ id: string }, { deleted: boolean }>(getServices().functions, "deleteAnalysis", { timeout: 310_000 });
      for (const [index, item] of items.entries()) {
        try {
          await remove({ id: item.id });
          deleted++;
        } catch (actionError) {
          failed.push({ ...item, reason: userError(actionError) });
        }
        setProgress({ done: index + 1, total: items.length });
      }
    } catch (actionError) {
      failed.push(...items.map(item => ({ ...item, reason: userError(actionError) })));
    }
    setProgress(null);
    setTarget(null);
    setSelectedIds(new Set(failed.map(item => item.id)));
    setSelectionMode(failed.length > 0);
    if (failed.length) {
      const lead = failed[0];
      setNotice({ kind: "error", text: (deleted ? deleted + " analiz silindi. " : "") + failed.length + " analiz silinemedi: " + lead.title + " — " + lead.reason + " Kalanları yeniden deneyebilirsiniz." });
    } else {
      setNotice({ kind: "success", text: deleted + " analiz ve kaynak belgeleri silindi." });
    }
  }

  return <section aria-labelledby="history-title" className="max-w-6xl">
    <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/10 bg-gradient-to-br from-card via-card to-primary/[0.07] p-6 text-foreground shadow-[0_20px_65px_-48px_rgba(70,35,110,0.4)] dark:border-secondary/15 dark:to-secondary/[0.07] sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute -end-14 -top-28 h-80 w-80 rounded-full border border-primary/10 bg-primary/[0.04] dark:border-secondary/10 dark:bg-secondary/[0.04]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 end-16 h-64 w-64 rounded-full bg-primary/[0.05] blur-3xl dark:bg-secondary/[0.05]" aria-hidden="true" />
      <div className="relative flex flex-wrap items-start justify-between gap-7">
        <div className="max-w-2xl">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.07] text-primary dark:border-secondary/20 dark:text-secondary"><FileClock className="h-5 w-5" aria-hidden="true" /></span>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.22em] text-primary dark:text-secondary">{t("Çalışma alanı / Arşiv")}</p>
          <h1 id="history-title" className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{t(tr.analysis.history)}</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{t("Çalışmalarınızın düzenli adresi. Hazırladığınız analizleri yeniden açın, bulun ve ihtiyaç duymadıklarınızı yönetin.")}</p>
        </div>
        {!loading && !error && rows.length > 0 && <Button variant="outline" className="gap-2 rounded-xl bg-card" disabled={progress !== null} onClick={toggleSelectionMode}>
          {selectionMode ? <X className="h-4 w-4" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          {selectionMode ? t("Seçimi bitir") : t("Seç ve sil")}
        </Button>}
      </div>
      {!loading && !error && rows.length > 0 && <div className="relative mt-8 flex flex-wrap items-center gap-3 border-t border-border/70 pt-5 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><Layers3 className="h-4 w-4" aria-hidden="true" /> {summary.total.toLocaleString(localeTag())}  {t("kayıt")}</span><span className="hidden h-1 w-1 rounded-full bg-primary/30 sm:block" aria-hidden="true" /><span>{t("Arama, filtreleme ve toplu yönetim bir arada")}</span></div>}
    </div>

    {notice && <p role={notice.kind === "error" ? "alert" : "status"}
      className={"mt-6 rounded-2xl border px-4 py-3 text-sm leading-6 " + (notice.kind === "error" ? "border-red-500/25 bg-red-500/5 text-red-700 dark:text-red-300" : "border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300")}>{t(notice.text)}</p>}

    {!loading && !error && rows.length > 0 && <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("Arşiv özeti")}>
      {[
        { label: "Toplam analiz", description: "Arşivinizde bulunan tüm analiz kayıtları.", value: summary.total, icon: Archive, tone: "border-primary/15 bg-primary/[0.05] text-primary dark:border-secondary/20 dark:bg-secondary/[0.06] dark:text-secondary" },
        { label: "Analize hazır", description: "Belgeleri başarıyla ayrıştırılan ve açılmaya hazır analizler.", value: summary.completed, icon: CircleCheckBig, tone: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300" },
        { label: "Devam ediyor", description: "Taslak, yükleme, ayrıştırma veya silme işlemi süren analizler.", value: summary.active, icon: LoaderCircle, tone: "border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300" },
        { label: "Dikkat istiyor", description: "Hazırlama sırasında hata alan ve yeniden denenebilecek analizler.", value: summary.failed, icon: TriangleAlert, tone: "border-red-500/20 bg-red-500/[0.05] text-red-700 dark:text-red-300" },
      ].map((item, index) => <div key={item.label} tabIndex={0} aria-describedby={`history-summary-help-${index}`} className="group relative rounded-2xl border border-border/80 bg-card p-4 shadow-sm outline-none transition-colors hover:border-primary/25 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 dark:hover:border-secondary/25 dark:focus-visible:border-secondary dark:focus-visible:ring-secondary/25 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-medium text-muted-foreground">{t(item.label)}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{item.value.toLocaleString(localeTag())}</p></div>
          <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border " + item.tone}><item.icon className="h-4.5 w-4.5" aria-hidden="true" /></span>
        </div>
        <div id={`history-summary-help-${index}`} role="tooltip" className="pointer-events-none invisible absolute bottom-[calc(100%+0.65rem)] start-1/2 z-30 w-64 max-w-[calc(100vw-3rem)] -translate-x-1/2 translate-y-1 rounded-xl border border-primary/15 bg-card px-3.5 py-2.5 text-center text-xs font-medium leading-5 text-foreground opacity-0 shadow-xl shadow-primary/10 transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-secondary/20 dark:shadow-secondary/10">
          {t(item.description)}<span className="absolute start-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-e border-primary/15 bg-card dark:border-secondary/20" aria-hidden="true" />
        </div>
      </div>)}
    </section>}

    {!loading && !error && rows.length > 0 && <section className="mt-6 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5" aria-labelledby="history-filter-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" /><h2 id="history-filter-title" className="text-sm font-semibold">{t("Arşivde bul")}</h2></div>
        <p className="text-xs text-muted-foreground" aria-live="polite">{visibleRows.length.toLocaleString(localeTag())} / {rows.length.toLocaleString(localeTag())}  {t("analiz gösteriliyor")}</p>
      </div>
      <div className="mt-4">
        <label className="relative block">
          <span className="sr-only">{t("Arşivde ara")}</span>
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input type="search" value={query} onChange={event => updateView({ query: event.target.value })} placeholder={t("Başlık, hedef veya belge ara")}
            className="min-h-11 w-full rounded-xl border border-border bg-background py-2 ps-10 pe-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 dark:focus:border-secondary dark:focus:ring-secondary/20" />
        </label>
        <details open={filtersOpen} onToggle={event => setFiltersOpen(event.currentTarget.open)} className="mt-3">
          <summary className="flex min-h-10 w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary [&::-webkit-details-marker]:hidden"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />{t("Filtreler")}{advancedCount > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 tabular-nums dark:bg-secondary/10">{advancedCount.toLocaleString(localeTag())}</span>}</summary>
          <div className="mt-3 grid min-w-0 gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
        <label>
          <span className="sr-only">{t("Duruma göre filtrele")}</span>
          <select value={statusFilter} onChange={event => updateView({ status: event.target.value as HistoryStatusFilter })} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:focus:border-secondary dark:focus:ring-secondary/20">
            <option value="all">{t("Tüm durumlar")}</option><option value="completed">{t("Analize hazır")}</option><option value="active">{t("Devam ediyor")}</option><option value="failed">{t("Dikkat istiyor")}</option>
          </select>
        </label>
        <label>
          <span className="sr-only">{t("Tarihe göre filtrele")}</span>
          <select value={periodFilter} onChange={event => updateView({ period: event.target.value as HistoryPeriodFilter })} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:focus:border-secondary dark:focus:ring-secondary/20">
            <option value="all">{t("Tüm tarihler")}</option><option value="7d">{t("Son 7 gün")}</option><option value="30d">{t("Son 30 gün")}</option><option value="90d">{t("Son 90 gün")}</option>
          </select>
        </label>
        <label>
          <span className="sr-only">{t("Analizleri sırala")}</span>
          <select value={sort} onChange={event => updateView({ sort: event.target.value as HistorySort })} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:focus:border-secondary dark:focus:ring-secondary/20">
            <option value="newest">{t("En yeni")}</option><option value="oldest">{t("En eski")}</option><option value="title">{t("Başlığa göre")}</option>
          </select>
        </label>
          </div>
        </details>
      </div>
      {hasFilters && <button type="button" className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary dark:hover:bg-secondary/[0.08]" onClick={clearFilters}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />  {t("Filtreleri temizle")}</button>}
    </section>}

    {selectionMode && visibleRows.length > 0 && <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 dark:border-secondary/20 dark:bg-secondary/[0.04] sm:p-5" aria-label={t("Toplu silme işlemleri")}>
      <div><p className="font-semibold">{t("{0} analiz seçildi", selectedRows.length)}</p><p className="mt-1 text-xs text-muted-foreground">{t("Seçtiklerinizi silmeden önce onay isteyeceğiz.")}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" className="gap-2 rounded-xl" disabled={progress !== null} onClick={() => setSelectedIds(allSelected ? new Set() : new Set(visibleRows.map(row => row.id)))}>
          <CheckCheck className="h-4 w-4" aria-hidden="true" />{allSelected ? t("Seçimi temizle") : t("Görünenleri seç")}
        </Button>
        <Button variant="outline" className="gap-2 rounded-xl border-red-500/30 text-red-700 hover:bg-red-500/10 dark:text-red-300" disabled={selectedRows.length === 0 || progress !== null}
          onClick={() => setTarget({ items: selectedRows.map(row => ({ id: row.id, title: row.title })) })}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />  {t("Seçilenleri sil")} </Button>
      </div>
    </div>}

    {loading ? <div className="mt-8"><PageLoading kind="history" label="Geçmiş yükleniyor…" /></div> : error ? authOnlyPreview ? <div className="mt-6 grid overflow-hidden rounded-[1.75rem] border border-border/80 bg-card shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.75fr)]" role="status">
      <div className="p-7 sm:p-9"><span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary dark:border-secondary/20 dark:bg-secondary/[0.08] dark:text-secondary"><FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />  {t("İlk çalışmanız")}</span><h2 className="mt-5 max-w-lg text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{t("Henüz analiz yok.")}</h2><p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{t("İlk adımı bir konu seçerek atın. İlgili belgeleri aynı çalışma alanında bir araya getirin; hazırladığınız analizleri ve kaynaklarını bu arşivden takip edin.")}</p><Link to="/app/new-analysis" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90">{t("Analize başla")} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" /></Link></div>
      <div className="relative flex min-h-56 items-center justify-center overflow-hidden border-t border-border/70 bg-gradient-to-br from-primary/[0.06] via-background to-primary/[0.12] p-8 dark:from-secondary/[0.06] dark:to-secondary/[0.12] lg:border-s lg:border-t-0" aria-hidden="true"><div className="absolute h-52 w-52 rounded-full border border-primary/10 dark:border-secondary/15" /><div className="absolute h-36 w-36 rounded-full border border-primary/10 dark:border-secondary/15" /><div className="relative flex h-24 w-24 items-center justify-center rounded-[1.75rem] border border-primary/15 bg-card shadow-xl shadow-primary/10 dark:border-secondary/20"><FolderOpen className="h-11 w-11 text-primary dark:text-secondary" /></div><span className="absolute bottom-5 end-5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm">{t("İlk çalışmanız burada")}</span></div>
    </div> : <div role="alert" className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-6 text-sm text-red-700 dark:text-red-300"><TriangleAlert className="mb-3 h-5 w-5" aria-hidden="true" />{t(error)}</div> : rows.length && visibleRows.length ? <ul className="mt-6 space-y-3" aria-label={t("Analiz geçmişi")}>{visibleRows.map(analysis => <li key={analysis.id} className="relative overflow-visible rounded-[1.35rem] border border-border/80 bg-card shadow-[0_12px_35px_-32px_rgba(55,20,95,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_40px_-27px_rgba(55,20,95,0.35)] dark:hover:border-secondary/30">
      {selectionMode ? <label className="flex min-h-24 cursor-pointer flex-wrap items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-muted/40 sm:p-5">
        <input type="checkbox" className="h-5 w-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          checked={selectedIds.has(analysis.id)} disabled={progress !== null} onChange={() => toggleSelected(analysis.id)} aria-label={t("{0} seç", analysis.title)} />
        <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{analysis.title}</span><span className="mt-1 block text-xs text-muted-foreground">{analysis.business} · {new Date(analysis.createdAt).toLocaleString(localeTag())}</span></span>
        <span className={"rounded-full border px-3 py-1 text-xs font-medium " + statusTone(analysis.status)}>{t(tr.status[analysis.status])}</span>
      </label> : <div className="flex min-h-28 items-center gap-2 p-2 sm:gap-3">
        <Link className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:gap-5 sm:px-4" to={"/app/analyses/" + analysis.id}>
          <span className="hidden h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/[0.07] text-primary dark:bg-secondary/[0.08] dark:text-secondary sm:flex"><span className="text-lg font-bold leading-none">{new Date(analysis.createdAt).toLocaleDateString(localeTag(), { day: "2-digit" })}</span><span className="mt-1 text-[10px] font-semibold uppercase">{new Date(analysis.createdAt).toLocaleDateString(localeTag(), { month: "short" })}</span></span>
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold tracking-tight sm:text-base">{analysis.title}</span><span className="mt-1.5 block break-words text-xs text-muted-foreground">{analysis.business} <span aria-hidden="true">·</span> {new Date(analysis.createdAt).toLocaleString(localeTag())}</span><span className={"mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium sm:hidden " + statusTone(analysis.status)}>{t(tr.status[analysis.status])}</span></span>
          <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
        </Link>
        <div className="flex shrink-0 items-center gap-1 pe-1 sm:gap-2 sm:pe-2">
          <span className={"hidden rounded-full border px-3 py-1 text-xs font-medium sm:inline-flex " + statusTone(analysis.status)}>{t(tr.status[analysis.status])}</span>
          <HistoryActions analysis={analysis} disabled={progress !== null} onDelete={() => setTarget({ items: [{ id: analysis.id, title: analysis.title }] })} />
        </div>
      </div>}
    </li>)}</ul> : rows.length ? <div className="mt-6 rounded-[1.75rem] border border-dashed border-border bg-card/70 px-6 py-16 text-center shadow-sm">
      <Search className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 text-xl font-semibold">{t("Bu ölçütlerle eşleşen analiz yok")}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("Arama ifadenizi veya seçtiğiniz durum ve tarih aralığını değiştirerek tekrar deneyin.")}</p><Button variant="outline" className="mt-5 gap-2 rounded-xl" onClick={clearFilters}><RotateCcw className="h-4 w-4" aria-hidden="true" />  {t("Filtreleri temizle")}</Button>
    </div> : <div className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-border/80 bg-card shadow-sm">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <div className="p-7 sm:p-10"><span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-primary dark:border-secondary/20 dark:bg-secondary/10 dark:text-secondary"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />  {t("Yeni bir başlangıç")}</span><h2 className="mt-5 max-w-lg text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{t("İlk çalışmanız burada yerini alsın.")}</h2><p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">{t("{0} Belgelerinizi hazırladığınızda her çalışmaya, kaynaklarına ve durumuna bu arşivden ulaşabilirsiniz.", t(tr.analysis.noHistory))}</p><Link to="/app/new-analysis" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90">{t("İlk analizini hazırla")} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" /></Link></div>
        <div className="relative flex min-h-60 items-center justify-center overflow-hidden border-t border-border/70 bg-gradient-to-br from-primary/[0.04] via-background to-primary/[0.12] p-8 dark:from-secondary/[0.04] dark:to-secondary/[0.12] lg:border-s lg:border-t-0" aria-hidden="true"><div className="absolute h-56 w-56 rounded-full border border-primary/10 dark:border-secondary/15" /><div className="absolute h-40 w-40 rounded-full border border-primary/10 dark:border-secondary/15" /><div className="absolute start-1/2 top-1/2 flex h-28 w-28 -translate-x-[65%] -translate-y-[58%] rotate-[-10deg] items-center justify-center rounded-2xl border border-primary/15 bg-card shadow-sm dark:border-secondary/20"><FilePlus2 className="h-8 w-8 text-primary/35 dark:text-secondary/35" /></div><div className="relative flex h-32 w-32 rotate-[7deg] flex-col items-center justify-center rounded-2xl border border-primary/20 bg-card shadow-xl shadow-primary/10 dark:border-secondary/20"><FolderOpen className="h-10 w-10 text-primary dark:text-secondary" /><span className="mt-3 h-1.5 w-16 rounded-full bg-primary/15 dark:bg-secondary/20" /><span className="mt-1.5 h-1.5 w-10 rounded-full bg-primary/10 dark:bg-secondary/15" /></div></div>
      </div>
    </div>}

    <dialog ref={dialogRef} role="alertdialog" aria-labelledby="history-delete-title" aria-describedby="history-delete-description"
      onCancel={event => { if (progress) event.preventDefault(); else setTarget(null); }}
      onClose={() => { if (!progress) setTarget(null); }}
      className="w-[min(92vw,30rem)] max-w-none rounded-3xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-7">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-700 dark:text-red-300"><Trash2 className="h-5 w-5" aria-hidden="true" /></span>
        <h2 id="history-delete-title" className="mt-5 text-xl font-semibold">{target?.items.length === 1 ? t("Bu analizi silmek istiyor musunuz?") : (target?.items.length ?? 0) + " analizi silmek istiyor musunuz?"}</h2>
        <p id="history-delete-description" className="mt-2 text-sm leading-6 text-muted-foreground">{t("Bu işlem geri alınamaz. Seçilen analizler, yüklenen kaynak belgeler ve hazırlanmış içerikler birlikte silinir.")}</p>
        {target?.items.length === 1 && <p className="mt-4 break-words rounded-xl bg-muted px-4 py-3 text-sm font-medium">{target.items[0].title}</p>}
        {progress && <p role="status" className="mt-4 text-sm text-muted-foreground">{t("Siliniyor: {0}/{1}", progress.done, progress.total)}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" className="rounded-xl" disabled={progress !== null} onClick={() => setTarget(null)}>{t("Vazgeç")}</Button>
          <Button className="gap-2 rounded-xl bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700" disabled={progress !== null} onClick={deleteConfirmed}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />{target?.items.length === 1 ? t("Analizi sil") : (target?.items.length ?? 0) + " analizi sil"}
          </Button>
        </div>
      </div>
    </dialog>
  </section>;
}
