import type { Analysis } from "../../../functions/src/contracts";
import { tr } from "../../i18n/tr";

// Hazırlık/silme durumları önceliklidir; süresi dolan AI işi hâlâ çalışıyor gibi gösterilmez.
export function analysisDisplayStatus(analysis: Analysis, now = Date.now()): { state: Analysis["status"]; label: string } {
  if (analysis.status !== "completed" || !analysis.ai) return { state: analysis.status, label: tr.status[analysis.status] };
  if (analysis.ai.status === "completed") return { state: "completed", label: "Analiz hazır" };
  if (analysis.ai.status === "running" && now < analysis.ai.leaseUntil) return { state: "processing", label: "Analiz hazırlanıyor" };
  return { state: "failed", label: "Analiz yeniden denenebilir" };
}
