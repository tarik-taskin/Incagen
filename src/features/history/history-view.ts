import type { Analysis } from "../../../functions/src/contracts";

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

// Adresteki bilinmeyen veya eski değerleri güvenli varsayılanlara indirger.
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

// Yalnız varsayılandan farklı seçimleri yazar; paylaşılabilir adresi kısa ve kararlı tutar.
export function serializeHistoryView(options: HistoryViewOptions) {
  const params = new URLSearchParams();
  if (options.query.trim()) params.set("q", options.query.trim());
  if (options.status !== "all") params.set("status", options.status);
  if (options.period !== "all") params.set("period", options.period);
  if (options.sort !== "newest") params.set("sort", options.sort);
  return params;
}

const collator = new Intl.Collator("tr-TR", { sensitivity: "base", numeric: true });

// Türkçe karakter ve boşluk farklarını aramada kullanıcı için öngörülebilir hale getirir.
function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
}

function matchesStatus(analysis: Analysis, status: HistoryStatusFilter) {
  if (status === "all") return true;
  if (status === "active") return !["completed", "failed", "review"].includes(analysis.status);
  if (status === "failed") return ["failed", "review"].includes(analysis.status);
  return analysis.status === status;
}

// Başlık, hedef, işletme ve kaynak adını birlikte arar; boş hedefli eski kayıtları ve özgün metinleri korur.
export function buildHistoryView(rows: Analysis[], options: HistoryViewOptions, now = Date.now()): Analysis[] {
  const query = normalizeSearch(options.query);
  const periodDays = options.period === "all" ? null : Number.parseInt(options.period, 10);
  const cutoff = periodDays === null ? null : now - periodDays * 24 * 60 * 60 * 1000;
  const filtered = rows.filter(analysis => {
    if (!matchesStatus(analysis, options.status) || (cutoff !== null && analysis.createdAt < cutoff)) return false;
    if (!query) return true;
    const sourceNames = analysis.report?.sources.map(source => source.name) ?? [];
    return normalizeSearch([analysis.title, analysis.objective ?? "", analysis.business, ...sourceNames].join(" ")).includes(query);
  });

  return [...filtered].sort((left, right) => {
    if (options.sort === "oldest") return left.createdAt - right.createdAt;
    if (options.sort === "title") return collator.compare(left.title, right.title);
    return right.createdAt - left.createdAt;
  });
}

// Canlı kullanıcı listesini ek sorgu yapmadan arşivin dört temel durum sayacına dönüştürür.
export function summarizeHistory(rows: Analysis[]): HistorySummary {
  return rows.reduce<HistorySummary>((summary, analysis) => {
    summary.total++;
    if (analysis.status === "completed") summary.completed++;
    else if (["failed", "review"].includes(analysis.status)) summary.failed++;
    else summary.active++;
    return summary;
  }, { total: 0, completed: 0, active: 0, failed: 0 });
}
