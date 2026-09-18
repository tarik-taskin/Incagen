import { createHash } from "node:crypto";
import {
  PARSING_LIMITS,
  SUPPORTED_FILE_FORMATS,
  type DocumentChunk,
  type ParsedCell,
  type ParsedDocument,
  type ParsedDocumentMetadata,
  type SourceLocator,
  type SupportedFileExtension,
} from "../contracts";

export const PARSER_VERSION = "1.0.0";

export interface ParserInput {
  sourceId: string;
  fileName: string;
  contentType: string;
  extension: SupportedFileExtension;
  data: Buffer;
}

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentParseError";
  }
}

// Metin tabanlı dosyaları kayıplı dönüşüm yapmadan UTF-8 olarak doğrular.
export function decodeUtf8(data: Buffer) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    if (text.includes("\0")) throw new Error("NUL");
    return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  } catch {
    throw new DocumentParseError("Dosya geçerli UTF-8 metin içermiyor.");
  }
}

// Uzun metni paragraf sınırlarını tercih ederek model ve depolama için sınırlı parçalara ayırır.
export function createTextChunks(sourceId: string, text: string, locator: SourceLocator = {}): DocumentChunk[] {
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length > PARSING_LIMITS.textCharacters) throw new DocumentParseError("Belgedeki metin güvenli karakter sınırını aşıyor.");
  const chunks: DocumentChunk[] = [];
  let remaining = normalized;
  while (remaining) {
    let end = Math.min(PARSING_LIMITS.chunkCharacters, remaining.length);
    if (end < remaining.length) {
      const paragraphBreak = remaining.lastIndexOf("\n\n", end);
      const lineBreak = remaining.lastIndexOf("\n", end);
      const candidate = Math.max(paragraphBreak, lineBreak);
      if (candidate > end * 0.6) end = candidate;
    }
    const value = remaining.slice(0, end).trim();
    remaining = remaining.slice(end).trimStart();
    if (value) chunks.push({ id: `${sourceId}:text:${String(chunks.length + 1).padStart(4, "0")}`, kind: "text", locator: { ...locator, section: locator.section ?? `parça-${chunks.length + 1}` }, text: value });
    if (chunks.length > PARSING_LIMITS.chunksPerFile) throw new DocumentParseError("Belge güvenli parça sınırını aşıyor.");
  }
  return chunks;
}

// Tablo satırlarını kaynak satır aralıklarını koruyarak sınırlı parçalara böler.
export function createTableChunks(sourceId: string, columns: string[], rows: ParsedCell[][], locator: SourceLocator = {}): DocumentChunk[] {
  if (columns.length > PARSING_LIMITS.tableColumns) throw new DocumentParseError("Tablo sütun sınırını aşıyor.");
  if (rows.length > PARSING_LIMITS.tableRows) throw new DocumentParseError("Tablo satır sınırını aşıyor.");
  const chunkRows = 500;
  const chunks: DocumentChunk[] = [];
  const firstRow = locator.rowStart ?? 1;
  for (let start = 0; start < rows.length || (start === 0 && rows.length === 0); start += chunkRows) {
    const values = rows.slice(start, start + chunkRows);
    chunks.push({
      id: `${sourceId}:table:${String(chunks.length + 1).padStart(4, "0")}`,
      kind: "table",
      locator: { ...locator, rowStart: firstRow + start, rowEnd: firstRow + start + Math.max(0, values.length - 1) },
      table: { columns, rows: values },
    });
  }
  return chunks;
}

// Boş veya yinelenen başlıkları kararlı ve benzersiz sütun adlarına dönüştürür.
export function normalizeColumns(values: ParsedCell[], width: number) {
  const seen = new Map<string, number>();
  return Array.from({ length: width }, (_, index) => {
    const base = String(values[index] ?? "").trim() || `Sütun ${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

// Ayrıştırılmış içerikten sürümlü ve hash'li ortak belge kaydını üretir.
export function createParsedDocument(
  input: ParserInput,
  detectedMime: string,
  chunks: DocumentChunk[],
  metadata: ParsedDocumentMetadata = {},
  warnings: string[] = [],
): ParsedDocument {
  if (!SUPPORTED_FILE_FORMATS[input.extension].mimeTypes.includes(input.contentType as never)) {
    throw new DocumentParseError(`${input.fileName}: Bildirilen içerik türü dosya uzantısıyla uyumlu değil.`);
  }
  if (chunks.length > PARSING_LIMITS.chunksPerFile) throw new DocumentParseError("Belge güvenli parça sınırını aşıyor.");
  return {
    version: 1,
    sourceId: input.sourceId,
    fileName: input.fileName,
    sha256: createHash("sha256").update(input.data).digest("hex"),
    extension: input.extension,
    detectedMime,
    category: SUPPORTED_FILE_FORMATS[input.extension].category,
    metadata,
    chunks,
    warnings,
    parserVersion: PARSER_VERSION,
  };
}

// Rapor özetinde kullanılmak üzere metin ve tablo hücrelerindeki karakterleri sayar.
export function countDocumentCharacters(document: ParsedDocument) {
  return document.chunks.reduce((total, chunk) => total
    + (chunk.text?.length ?? 0)
    + (chunk.table?.rows.flat().reduce<number>((sum, value) => sum + String(value ?? "").length, 0) ?? 0), 0);
}
