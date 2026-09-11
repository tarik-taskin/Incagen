import { z } from "zod";

export const LIMITS = { files: 10, fileBytes: 5 * 1024 * 1024, totalBytes: 20 * 1024 * 1024, rows: 50_000, daily: 10 } as const;
export const mappingSchema = z.object({
  dateColumn: z.string().min(1).max(100),
  amountColumn: z.string().min(1).max(100),
  categoryColumn: z.string().max(100).default(""),
  dateFormat: z.enum(["iso", "tr"]),
  numberFormat: z.enum(["dot", "tr"]),
  delimiter: z.enum([",", ";"]),
}).strict().refine(m => new Set([m.dateColumn, m.amountColumn, m.categoryColumn].filter(Boolean)).size === (m.categoryColumn ? 3 : 2), "Sütunlar farklı olmalı.");
export const createSchema = z.object({
  requestId: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  business: z.string().trim().min(1).max(100),
  currency: z.enum(["TRY", "USD", "EUR"]),
  files: z.array(z.object({
    name: z.string().min(1).max(200).refine(n => n.toLowerCase().endsWith(".csv"), "Yalnız CSV işlenebilir."),
    size: z.number().int().positive().max(LIMITS.fileBytes),
    mapping: mappingSchema,
  }).strict()).min(1).max(LIMITS.files),
}).strict().refine(v => v.files.reduce((n, f) => n + f.size, 0) <= LIMITS.totalBytes, "Toplam boyut 20 MB'ı aşamaz.");
export type ColumnMapping = z.infer<typeof mappingSchema>;
export type CreateAnalysis = z.infer<typeof createSchema>;
export type AnalysisStatus = "draft" | "uploading" | "processing" | "completed" | "failed" | "deleting";
export interface Report {
  version: 1;
  totalCents: number;
  rowCount: number;
  averageCents: number;
  daily: { date: string; cents: number }[];
  categories: { category: string; cents: number }[];
  sources: { name: string; rows: number; blankRows: number }[];
}
export interface Analysis {
  id: string;
  title: string;
  business: string;
  currency: CreateAnalysis["currency"];
  status: AnalysisStatus;
  createdAt: number;
  updatedAt: number;
  error?: string | null;
  report?: Report;
}
