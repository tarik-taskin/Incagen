import { LIMITS, PREMIUM_LIMITS } from "../../../functions/src/contracts";

export const PLAN_RULES = {
  free: {
    label: "Free",
    dailyAnalysisLimit: LIMITS.daily,
    filesPerAnalysis: LIMITS.files,
    fileBytes: LIMITS.fileBytes,
    totalBytes: LIMITS.totalBytes,
    analysisDepth: "Medium",
    externalSources: "Bulunmaz",
  },
  premium: {
    label: "Premium",
    dailyAnalysisLimit: PREMIUM_LIMITS.daily,
    filesPerAnalysis: PREMIUM_LIMITS.files,
    fileBytes: PREMIUM_LIMITS.fileBytes,
    totalBytes: PREMIUM_LIMITS.totalBytes,
    analysisDepth: "High",
    externalSources: "Google Analytics ve Microsoft Clarity",
  },
} as const;
