import { z } from "zod";
import { parsedDocumentSchema } from "./input-packet";
import { sourceLocatorSchema } from "./result-contract";

export const AI_JOB_LIMITS = { attempts: 3, leaseMs: 240_000, retryDelayMs: 30_000, dailyPerUser: 2, dailyGlobal: 100, packetBytes: 256 * 1024, outputBytes: 64 * 1024 } as const;
export const resultLocaleSchema = z.enum(["tr", "en", "de", "es", "zh", "ar"]);
export const tableSelectionSchema = z.object({
  sheet: z.string().trim().min(1).max(200).nullable(),
  valueColumn: z.number().int().min(0).max(199).nullable(),
  groupColumn: z.number().int().min(0).max(199).nullable(),
  aggregation: z.enum(["sum", "mean", "count"]), numberFormat: z.enum(["plain", "tr", "en"]),
  unit: z.enum(["number", "count", "TRY", "USD", "EUR", "percent"]),
}).strict().superRefine((selection, ctx) => {
  if ((selection.aggregation === "count" && (selection.valueColumn !== null || selection.unit !== "count"))
    || (selection.aggregation !== "count" && (selection.valueColumn === null || selection.unit === "count"))
    || (selection.valueColumn !== null && selection.valueColumn === selection.groupColumn)) ctx.addIssue({ code: "custom", message: "invalid-selection" });
});
export const startAnalysisSchema = z.object({
  id: z.string().uuid(), sourceId: z.string().regex(/^file-\d+$/), selection: tableSelectionSchema,
  locale: resultLocaleSchema,
}).strict();
const anchor = z.object({ sourceId: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), chunkId: z.string(), locator: sourceLocatorSchema }).strict();
export const workerResultSchema = z.object({
  version: z.literal(1), document: parsedDocumentSchema,
  metrics: z.array(z.object({ id: z.string().regex(/^(rows|aggregate|group-\d+)$/), labelKey: z.enum(["rows", "sum", "mean", "count"]).optional(), label: z.string().trim().min(1).max(200).optional(), value: z.number().finite(), unit: z.string().min(1).max(32), methodKey: z.enum(["sum", "mean", "count"]), evidence: z.array(anchor).min(1).max(256) }).strict()).min(2).max(14),
  points: z.array(z.object({ label: z.string().min(1).max(200), metricId: z.string(), value: z.number().finite() }).strict()).max(12),
  scope: z.object({ rows: z.number().int().min(1).max(5000), emptyRows: z.number().int().min(0).max(5000), groups: z.number().int().min(0).max(12), sheet: z.string().nullable(), measure: z.string().nullable(), group: z.string().nullable(), selection: tableSelectionSchema }).strict(),
}).strict();

export type TableSelection = z.infer<typeof tableSelectionSchema>;
export type WorkerResult = z.infer<typeof workerResultSchema>;
export type ResultLocale = z.infer<typeof resultLocaleSchema>;
export interface AnalysisTable { sourceId: string; fileName: string; sheet: string | null; columns: string[]; rows: number }
export type AnalysisFailure = "invalid-data" | "scope-limit" | "configuration" | "provider" | "provider-busy" | "validation" | "timeout";
export interface AiJob {
  status: "running" | "completed" | "failed";
  attemptId: string; attempts: number; startedAt: number; finishedAt?: number;
  leaseUntil: number; maxAttempts: number; stage: "calculating" | "interpreting" | "saving";
  error?: AnalysisFailure; retryAfter?: number; locale: ResultLocale; sourceId: string; selection: TableSelection;
  artifactPath?: string; artifactSha256?: string; model?: string; durationMs?: number; inputBytes?: number; pythonMs?: number; modelMs?: number;
  usage?: { promptTokens: number; outputTokens: number; totalTokens: number };
}
