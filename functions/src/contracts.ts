import { z } from "zod";

export const LIMITS = { files: 10, fileBytes: 5 * 1024 * 1024, totalBytes: 30 * 1024 * 1024, daily: 10 } as const;
export const PREMIUM_LIMITS = { files: 30, fileBytes: LIMITS.fileBytes, totalBytes: 50 * 1024 * 1024, daily: 30 } as const;

export const SUPPORTED_FILE_EXTENSIONS = [
  "csv", "tsv", "xls", "xlsx", "ods",
  "pdf", "doc", "docx", "txt", "rtf", "md",
  "ppt", "pptx", "json", "xml",
  "jpg", "jpeg", "png", "webp", "gif", "svg", "heic", "heif",
] as const;

const supportedExtensions = new Set<string>(SUPPORTED_FILE_EXTENSIONS);

// Dosya adını izin verilen iş belgesi ve veri formatlarıyla sınırlar.
export function hasSupportedExtension(name: string) {
  const finalDot = name.lastIndexOf(".");
  return finalDot > -1 && supportedExtensions.has(name.slice(finalDot + 1).toLowerCase());
}

// UTC saatini İstanbul gün sınırına dönüştürür; kota için istemci saatine güvenilmez.
export function getQuotaDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export const createSchema = z.object({
  requestId: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  business: z.string().trim().min(1).max(100),
  files: z.array(z.object({
    name: z.string().min(1).max(200).refine(hasSupportedExtension, "Bu dosya türü desteklenmiyor."),
    size: z.number().int().positive().max(LIMITS.fileBytes),
    contentType: z.string().trim().min(1).max(200),
  }).strict()).min(1).max(LIMITS.files),
}).strict().refine(v => v.files.reduce((n, f) => n + f.size, 0) <= LIMITS.totalBytes, "Free planda toplam boyut 30 MB'ı aşamaz.");
export type CreateAnalysis = z.infer<typeof createSchema>;
export type AnalysisStatus = "draft" | "uploading" | "processing" | "completed" | "failed" | "deleting";
export interface Report {
  version: 2;
  fileCount: number;
  totalBytes: number;
  sources: { name: string; size: number; contentType: string }[];
}
export interface Analysis {
  id: string;
  title: string;
  business: string;
  status: AnalysisStatus;
  createdAt: number;
  updatedAt: number;
  error?: string | null;
  report?: Report;
}
