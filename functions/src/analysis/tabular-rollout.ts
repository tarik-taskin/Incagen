import type { AnalysisAccess } from "./tabular-contract";

// Üretim yetkileri ve sağlayıcı bağlantıları demo projesinin emülatörüne taşınmaz.
export function isAnalysisEmulator() {
  return process.env.FUNCTIONS_EMULATOR === "true" && (process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "").startsWith("demo-");
}

// Ücretli analiz hem sunucu bayrağını hem doğrulanmış Firebase kimliğindeki beta davetini gerektirir.
export function tabularAnalysisAccess(invited: unknown = undefined): AnalysisAccess {
  if (isAnalysisEmulator()) return "available";
  if (process.env.INCAGEN_TABULAR_ANALYSIS_ENABLED !== "true") return "closed";
  return invited === true ? "available" : "invite-required";
}
