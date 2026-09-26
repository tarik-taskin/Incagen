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

const collator = new Intl.Collator("tr-TR", { sensitivity: "base", numeric: true });

// Türkçe karakter ve boşluk farklarını aramada kullanıcı için öngörülebilir hale getirir.
function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
}

function matchesStatus(analysis: Analysis, status: HistoryStatusFilter) {
  if (status === "all") return true;
  if (status === "active") return !["completed", "failed"].includes(analysis.status);
  return analysis.status === status;
}

// Arşivi istemcide başlık, işletme ve kaynak adına göre süzer; durum, dönem ve sıralamayı birlikte uygular.
export function buildHistoryView(rows: Analysis[], options: HistoryViewOptions, now = Date.now()): Analysis[] {
  const query = normalizeSearch(options.query);
  const periodDays = options.period === "all" ? null : Number.parseInt(options.period, 10);
  const cutoff = periodDays === null ? null : now - periodDays * 24 * 60 * 60 * 1000;
  const filtered = rows.filter(analysis => {
    if (!matchesStatus(analysis, options.status) || (cutoff !== null && analysis.createdAt < cutoff)) return false;
    if (!query) return true;
    const sourceNames = analysis.report?.sources.map(source => source.name) ?? [];
    return normalizeSearch([analysis.title, analysis.business, ...sourceNames].join(" ")).includes(query);
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
    else if (analysis.status === "failed") summary.failed++;
    else summary.active++;
    return summary;
  }, { total: 0, completed: 0, active: 0, failed: 0 });
}
