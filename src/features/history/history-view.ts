import type { Analysis } from "../../../functions/src/contracts";

export interface HistorySummary {
  total: number;
  completed: number;
  active: number;
  failed: number;
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
