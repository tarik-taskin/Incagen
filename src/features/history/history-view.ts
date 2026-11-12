import type { Analysis } from "../../../functions/src/contracts";
import { resolveAnalysisState } from "../reports/analysis-status";

export interface HistorySummary {
  total: number;
  completed: number;
  active: number;
  failed: number;
}

export type HistoryStatusFilter = "all" | "completed" | "active" | "failed";
export type HistoryPeriodFilter = "all" | "7d" | "30d" | "90d";
export type HistorySort = "newest" | "oldest" | "title";

export interface HistoryViewOptions {
  query: string;
  status: HistoryStatusFilter;
  period: HistoryPeriodFilter;
  sort: HistorySort;
}

export const DEFAULT_HISTORY_VIEW: HistoryViewOptions = { query: "", status: "all", period: "all", sort: "newest" };
const historyStatuses: HistoryStatusFilter[] = ["all", "completed", "active", "failed"];
const historyPeriods: HistoryPeriodFilter[] = ["all", "7d", "30d", "90d"];
const historySorts: HistorySort[] = ["newest", "oldest", "title"];

/**
 * Adresteki bilinmeyen veya eski parametreleri güvenli varsayılanlara indirger.
 */
export function parseHistoryView(params: URLSearchParams): HistoryViewOptions {
  const status = params.get("status") as HistoryStatusFilter | null;
  const period = params.get("period") as HistoryPeriodFilter | null;
  const sort = params.get("sort") as HistorySort | null;
  return {
    query: params.get("q")?.slice(0, 100) ?? "",
    status: status && historyStatuses.includes(status) ? status : "all",
    period: period && historyPeriods.includes(period) ? period : "all",
    sort: sort && historySorts.includes(sort) ? sort : "newest",
  };
}

/**
 * Yalnız varsayılandan farklı seçimleri yazar; URL'i kısa ve paylaşılabilir tutar.
 */
export function serializeHistoryView(options: HistoryViewOptions) {
  const params = new URLSearchParams();
  if (options.query.trim()) params.set("q", options.query.trim());
  if (options.status !== "all") params.set("status", options.status);
  if (options.period !== "all") params.set("period", options.period);
  if (options.sort !== "newest") params.set("sort", options.sort);
  return params;
}

/**
 * Türkçe karakter ve boşluk farklarını aramada kullanıcı için öngörülebilir hale getirir.
 */
function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
}

/**
 * Bir analizin filtrelenen durum kategorisiyle eşleşip eşleşmediğini tekil durum çözümlemesiyle kontrol eder.
 */
function matchesStatus(analysis: Analysis, status: HistoryStatusFilter, now = Date.now()): boolean {
  if (status === "all") return true;
  const { category } = resolveAnalysisState(analysis, now);
  return category === status;
}

/**
 * Başlık, hedef, işletme ve kaynak adını birlikte arar; durum ve tarih filtrelerini uygular.
 */
export function buildHistoryView(rows: Analysis[], options: HistoryViewOptions, now = Date.now(), locale = "tr-TR"): Analysis[] {
  const query = normalizeSearch(options.query);
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const periodDays = options.period === "all" ? null : Number.parseInt(options.period, 10);
  const cutoff = periodDays === null ? null : now - periodDays * 24 * 60 * 60 * 1000;
  const filtered = rows.filter(analysis => {
    if (!matchesStatus(analysis, options.status, now) || (cutoff !== null && analysis.createdAt < cutoff)) return false;
    if (!query) return true;
    const sourceNames = [
      ...(analysis.report?.sources ?? []), ...(analysis.report?.excludedSources ?? []),
      ...(analysis.preparationFailures ?? []), ...(analysis.preparationReview?.ready ?? []),
      ...(analysis.preparationReview?.rejected ?? []),
    ].map(source => source.name);
    return normalizeSearch([analysis.title, analysis.objective ?? "", analysis.business, ...sourceNames].join(" ")).includes(query);
  });

  return [...filtered].sort((left, right) => {
    if (options.sort === "oldest") return left.createdAt - right.createdAt;
    if (options.sort === "title") return collator.compare(left.title, right.title);
    return right.createdAt - left.createdAt;
  });
}

/**
 * Canlı analiz listesini tekil durum çözümlemesiyle arşivin dört temel durum sayacına dönüştürür.
 * Kartların görünür etiketleri ile sayaçların tam örtüşmesini garanti eder.
 */
export function summarizeHistory(rows: Analysis[], now = Date.now()): HistorySummary {
  return rows.reduce<HistorySummary>((summary, analysis) => {
    summary.total++;
    const { category } = resolveAnalysisState(analysis, now);
    summary[category]++;
    return summary;
  }, { total: 0, completed: 0, active: 0, failed: 0 });
}
