import { isAnalysisEmulator } from "./python-worker";
import type { AnalysisAccess } from "./tabular-contract";

// Ücretli analiz hem sunucu bayrağını hem doğrulanmış Firebase kimliğindeki beta davetini gerektirir.
export function tabularAnalysisAccess(invited: unknown = undefined): AnalysisAccess {
  if (isAnalysisEmulator()) return "available";
  if (process.env.INCAGEN_TABULAR_ANALYSIS_ENABLED !== "true") return "closed";
  return invited === true ? "available" : "invite-required";
}
