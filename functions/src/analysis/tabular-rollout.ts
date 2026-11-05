import { isAnalysisEmulator } from "./python-worker";

// Canlı ücretli analiz ancak açık sunucu onayıyla açılır; yalnız izole demo testleri bu kapıyı aşabilir.
export function tabularRolloutEnabled() {
  return isAnalysisEmulator() || process.env.INCAGEN_TABULAR_ANALYSIS_ENABLED === "true";
}
