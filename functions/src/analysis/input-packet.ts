import { z } from "zod";
import { ANALYSIS_OBJECTIVE_MAX_LENGTH, PARSING_LIMITS, SUPPORTED_FILE_EXTENSIONS } from "../contracts";
import { sourceLocatorSchema, validateAiResultContext, type AiResultValidationContext } from "./result-contract";

export const ANALYSIS_PACKET_LIMITS = { documents: 20, utf8Bytes: 256 * 1024 } as const;
const identifier = z.string().min(1).max(200).refine(value => value === value.trim(), "Kaynak/parça kimliğinde kenar boşluğu olamaz.");
const cell = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const chunkSchema = z.object({
  id: identifier, kind: z.enum(["text", "table", "image"]), locator: sourceLocatorSchema,
  text: z.string().max(PARSING_LIMITS.textCharacters).optional(),
  table: z.object({ columns: z.array(z.string()).min(1).max(PARSING_LIMITS.tableColumns), rows: z.array(z.array(cell)).max(PARSING_LIMITS.tableRows) }).strict().optional(),
}).strict().superRefine((chunk, ctx) => {
  if (chunk.kind === "table" && !chunk.table) ctx.addIssue({ code: "custom", message: "Tablo parçasının verisi eksik." });
  if (chunk.kind !== "table" && chunk.table) ctx.addIssue({ code: "custom", message: "Tablo verisi parça türüyle uyuşmuyor." });
  if (chunk.kind === "text" && !chunk.text?.trim()) ctx.addIssue({ code: "custom", message: "Metin parçası boş." });
  if (chunk.table) {
    if (chunk.table.rows.some(row => row.length !== chunk.table!.columns.length)) ctx.addIssue({ code: "custom", message: "Tablo satır/sütun sayısı tutarsız." });
    const { rowStart, rowEnd } = chunk.locator;
    if (rowStart !== undefined && rowEnd! - rowStart + 1 !== chunk.table.rows.length) ctx.addIssue({ code: "custom", message: "Tablo satır aralığı gerçek içerikle uyuşmuyor." });
  }
});
const positive = z.number().int().positive();
const documentSchema = z.object({
  version: z.literal(1), sourceId: identifier, fileName: z.string().min(1).max(200),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), extension: z.enum(SUPPORTED_FILE_EXTENSIONS),
  detectedMime: z.string().min(1).max(200), category: z.enum(["Tablo", "Belge", "Sunum", "Veri", "Görsel"]),
  parserVersion: z.string().min(1).max(100),
  metadata: z.object({ pages: positive.optional(), sheets: positive.optional(), slides: positive.optional(), width: positive.optional(), height: positive.optional() }).strict(),
  chunks: z.array(chunkSchema).min(1).max(PARSING_LIMITS.chunksPerFile),
  warnings: z.array(z.string().min(1).max(4000)).max(1000),
}).strict();
const documentsSchema = z.array(documentSchema).min(1).max(ANALYSIS_PACKET_LIMITS.documents);

export interface AnalysisPacketInput {
  analysisId: string;
  objective: string;
  documents: unknown;
  metrics?: AiResultValidationContext["metrics"];
  datasets?: AiResultValidationContext["datasets"];
  byteBudget?: number;
  businessRules?: string[];
}

// Bütçe aşımını açık ve yeniden ele alınabilir bir hata olarak taşır; içerik sessizce kesilmez.
export class AnalysisPacketBudgetError extends Error {
  readonly code = "analysis-packet/budget-exceeded";
  constructor(readonly actualBytes: number, readonly budgetBytes: number) {
    super(`Analiz veri paketi ${budgetBytes} bayt bütçesini aşıyor (${actualBytes} bayt). Kaynak kapsamını açıkça daraltın.`);
    this.name = "AnalysisPacketBudgetError";
  }
}

// Yalnız backend'in ayrıştırdığı belgeleri paketler; hesapları üretmez ve doğrulama bağlamını model girdisinden ayırır.
export function buildAnalysisPacket(input: AnalysisPacketInput) {
  const documents = documentsSchema.parse(input.documents);
  const objective = z.string().trim().min(1).max(ANALYSIS_OBJECTIVE_MAX_LENGTH).parse(input.objective);
  const budget = z.number().int().min(1).max(ANALYSIS_PACKET_LIMITS.utf8Bytes).parse(input.byteBudget ?? ANALYSIS_PACKET_LIMITS.utf8Bytes);
  const validationContext = validateAiResultContext({
    analysisId: input.analysisId, objective,
    sources: documents.map(document => ({ id: document.sourceId, sha256: document.sha256, chunks: document.chunks.map(chunk => ({ id: chunk.id, locator: chunk.locator })) })),
    metrics: input.metrics ?? [], datasets: input.datasets ?? [],
  });
  const modelInput = {
    packetVersion: 1 as const, analysisId: validationContext.analysisId, objective,
    sourceContentPolicy: "data-only" as const,
    businessRules: z.array(z.string().trim().min(1).max(2000)).max(30).parse(input.businessRules ?? []),
    documents: documents.map(document => ({
      sourceId: document.sourceId, fileName: document.fileName, sha256: document.sha256,
      detectedMime: document.detectedMime, parserVersion: document.parserVersion,
      metadata: document.metadata, chunks: document.chunks, warnings: document.warnings,
    })),
    verifiedMetrics: structuredClone(validationContext.metrics),
    verifiedDatasets: structuredClone(validationContext.datasets),
  };
  const bytes = Buffer.byteLength(JSON.stringify(modelInput), "utf8");
  if (bytes > budget) throw new AnalysisPacketBudgetError(bytes, budget);
  return { modelInput, validationContext, usage: { utf8Bytes: bytes, budgetBytes: budget, documents: documents.length, chunks: documents.reduce((n, document) => n + document.chunks.length, 0) } };
}

export type AnalysisPacket = ReturnType<typeof buildAnalysisPacket>;
