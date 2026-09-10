export const PLAN_RULES = {
  free: {
    label: "Free",
    dailyAnalysisLimit: 10,
    filesPerAnalysis: 10,
    analysisDepth: "Medium",
    externalSources: "Bulunmaz",
  },
  premium: {
    label: "Premium",
    dailyAnalysisLimit: 30,
    filesPerAnalysis: 30,
    analysisDepth: "High",
    externalSources: "Google Analytics ve Microsoft Clarity",
  },
} as const;