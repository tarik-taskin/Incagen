import { LIMITS, PREMIUM_LIMITS } from "../../../functions/src/contracts";

export const PLAN_RULES = {
  free: {
    label: "Free",
    dailyAnalysisLimit: LIMITS.daily,
    filesPerAnalysis: LIMITS.files,
    totalBytes: LIMITS.totalBytes,
    analysisDepth: "Standard",
    externalSources: "Bulunmaz",
  },
  premium: {
    label: "Premium",
    dailyAnalysisLimit: PREMIUM_LIMITS.daily,
    filesPerAnalysis: PREMIUM_LIMITS.files,
    totalBytes: PREMIUM_LIMITS.totalBytes,
    analysisDepth: "High",
    externalSources: "Google Analytics ve Microsoft Clarity",
  },
} as const;
