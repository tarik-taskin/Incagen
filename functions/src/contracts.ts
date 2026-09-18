import { z } from "zod";

export const LIMITS = { files: 10, fileBytes: 5 * 1024 * 1024, totalBytes: 30 * 1024 * 1024, daily: 10 } as const;
export const PREMIUM_LIMITS = { files: 30, fileBytes: LIMITS.fileBytes, totalBytes: 50 * 1024 * 1024, daily: 30 } as const;

export type DocumentCategory = "Tablo" | "Belge" | "Sunum" | "Veri" | "Görsel";
export type ParserKind = "delimited" | "xlsx" | "pdf" | "image" | "text" | "json" | "docx" | "pptx";

export interface FileFormatDefinition {
  category: DocumentCategory;
  parser: ParserKind;
  mimeTypes: readonly string[];
}

// Yalnız backend'de gerçekten ayrıştırılan formatlar ürün tarafından desteklenmiş sayılır.
export const SUPPORTED_FILE_FORMATS = {
  csv: { category: "Tablo", parser: "delimited", mimeTypes: ["text/csv", "application/csv", "application/vnd.ms-excel", "application/octet-stream"] },
  tsv: { category: "Tablo", parser: "delimited", mimeTypes: ["text/tab-separated-values", "text/tsv", "text/plain", "application/octet-stream"] },
  xlsx: { category: "Tablo", parser: "xlsx", mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"] },
  pdf: { category: "Belge", parser: "pdf", mimeTypes: ["application/pdf", "application/octet-stream"] },
  docx: { category: "Belge", parser: "docx", mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"] },
  txt: { category: "Belge", parser: "text", mimeTypes: ["text/plain", "application/octet-stream"] },
  md: { category: "Belge", parser: "text", mimeTypes: ["text/markdown", "text/plain", "application/octet-stream"] },
  pptx: { category: "Sunum", parser: "pptx", mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"] },
  json: { category: "Veri", parser: "json", mimeTypes: ["application/json", "text/json", "text/plain", "application/octet-stream"] },
  jpg: { category: "Görsel", parser: "image", mimeTypes: ["image/jpeg", "application/octet-stream"] },
  jpeg: { category: "Görsel", parser: "image", mimeTypes: ["image/jpeg", "application/octet-stream"] },
  png: { category: "Görsel", parser: "image", mimeTypes: ["image/png", "application/octet-stream"] },
  webp: { category: "Görsel", parser: "image", mimeTypes: ["image/webp", "application/octet-stream"] },
} as const satisfies Record<string, FileFormatDefinition>;

export type SupportedFileExtension = keyof typeof SUPPORTED_FILE_FORMATS;
export const SUPPORTED_FILE_EXTENSIONS = Object.keys(SUPPORTED_FILE_FORMATS) as SupportedFileExtension[];

export const PARSING_LIMITS = {
  archiveEntries: 2_000,
  archiveUncompressedBytes: 40 * 1024 * 1024,
  textCharacters: 1_000_000,
  chunkCharacters: 12_000,
  chunksPerFile: 1_000,
  tableRows: 50_000,
  tableColumns: 200,
  workbookSheets: 50,
  pdfPages: 250,
  slides: 250,
  jsonDepth: 50,
  jsonNodes: 100_000,
  imagePixels: 40_000_000,
} as const;

// Dosya adındaki son uzantıyı güvenli biçimde destek matrisine eşler.
export function getSupportedExtension(name: string): SupportedFileExtension | null {
  const finalDot = name.lastIndexOf(".");
  if (finalDot < 0) return null;
  const extension = name.slice(finalDot + 1).toLowerCase();
  return Object.prototype.hasOwnProperty.call(SUPPORTED_FILE_FORMATS, extension) ? extension as SupportedFileExtension : null;
}

// Dosya adını yalnız gerçekten ayrıştırılan iş belgesi formatlarıyla sınırlar.
export function hasSupportedExtension(name: string) {
  return getSupportedExtension(name) !== null;
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
export type ParsedCell = string | number | boolean | null;

export interface SourceLocator {
  page?: number;
  sheet?: string;
  slide?: number;
  section?: string;
  rowStart?: number;
  rowEnd?: number;
}

export interface ParsedTable {
  columns: string[];
  rows: ParsedCell[][];
}

export interface DocumentChunk {
  id: string;
  kind: "text" | "table" | "image";
  locator: SourceLocator;
  text?: string;
  table?: ParsedTable;
}

export interface ParsedDocumentMetadata {
  pages?: number;
  sheets?: number;
  slides?: number;
  width?: number;
  height?: number;
}

export interface ParsedDocument {
  version: 1;
  sourceId: string;
  fileName: string;
  sha256: string;
  extension: SupportedFileExtension;
  detectedMime: string;
  category: DocumentCategory;
  metadata: ParsedDocumentMetadata;
  chunks: DocumentChunk[];
  warnings: string[];
  parserVersion: string;
}

export interface ReportSource {
  id: string;
  name: string;
  size: number;
  declaredContentType: string;
  detectedMime: string;
  sha256: string;
  category: DocumentCategory;
  chunkCount: number;
  characterCount: number;
  warnings: string[];
  metadata: ParsedDocumentMetadata;
}

export interface Report {
  version: 3;
  fileCount: number;
  totalBytes: number;
  totalChunks: number;
  totalCharacters: number;
  sources: ReportSource[];
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
