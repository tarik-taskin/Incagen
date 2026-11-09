import type { Analysis } from "../../../functions/src/contracts";
import { tr } from "../../i18n/tr";

export type HistoryStatusCategory = "completed" | "active" | "failed";

export interface ResolvedAnalysisStatus {
  state: Analysis["status"];
  category: HistoryStatusCategory;
  label: string;
}

/**
 * Bir analizin görsel etiketini ve state değerini belirler.
 * Hazırlık/silme durumları önceliklidir; süresi dolan AI işi çalışıyor gibi gösterilmez.
 */
export function analysisDisplayStatus(
  analysis: Analysis,
  now = Date.now()
): { state: Analysis["status"]; label: string } {
  if (analysis.status !== "completed" || !analysis.ai) {
    return { state: analysis.status, label: tr.status[analysis.status] };
  }
  if (analysis.ai.status === "completed") {
    return { state: "completed", label: "Analiz hazır" };
  }
  if (analysis.ai.status === "running" && now < analysis.ai.leaseUntil) {
    return { state: "processing", label: "Analiz hazırlanıyor" };
  }
  return { state: "failed", label: "Analiz yeniden denenebilir" };
}

/**
 * Analizin etkin görünür durumunu, arşiv filtreleme kategorisini ve etiketini
 * tekil bir hakikat kaynağından türetir. Böylece kart etiketi, rengi, sayaçlar
 * ve filtreler daima %100 örtüşür.
 */
export function resolveAnalysisState(
  analysis: Analysis,
  now = Date.now()
): ResolvedAnalysisStatus {
  const display = analysisDisplayStatus(analysis, now);
  let category: HistoryStatusCategory;
  if (display.state === "completed") {
    category = "completed";
  } else if (display.state === "failed" || display.state === "review") {
    category = "failed";
  } else {
    category = "active";
  }
  return {
    state: display.state,
    category,
    label: display.label,
  };
}
