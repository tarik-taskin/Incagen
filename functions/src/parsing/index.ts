import { getSupportedExtension, SUPPORTED_FILE_FORMATS, type ParsedDocument } from "../contracts";
import { type ParserInput, DocumentParseError } from "./common";
import { parseDelimitedDocument } from "./delimited";
import { parseDocxDocument } from "./docx";
import { parseImageDocument } from "./image";
import { parsePdfDocument } from "./pdf";
import { parsePptxDocument } from "./pptx";
import { parseJsonDocument, parseTextDocument } from "./text";
import { parseXlsxDocument } from "./xlsx";

export { countDocumentCharacters, DocumentParseError } from "./common";

export interface DocumentInput {
  sourceId: string;
  fileName: string;
  contentType: string;
  data: Buffer;
}

// Dosya adını tek destek matrisine göre doğru ayrıştırıcıya yönlendirir.
export async function parseDocument(input: DocumentInput): Promise<ParsedDocument> {
  const extension = getSupportedExtension(input.fileName);
  if (!extension) throw new DocumentParseError(`${input.fileName}: Bu dosya türü ayrıştırılmıyor.`);
  const format = SUPPORTED_FILE_FORMATS[extension];
  const mimeTypes: readonly string[] = format.mimeTypes;
  if (!mimeTypes.includes(input.contentType)) throw new DocumentParseError(`${input.fileName}: Bildirilen içerik türü uzantıyla uyumlu değil.`);
  const value: ParserInput = { ...input, extension };
  switch (format.parser) {
    case "delimited": return parseDelimitedDocument(value);
    case "xlsx": return parseXlsxDocument(value);
    case "pdf": return parsePdfDocument(value);
    case "image": return parseImageDocument(value);
    case "text": return parseTextDocument(value);
    case "json": return parseJsonDocument(value);
    case "docx": return parseDocxDocument(value);
    case "pptx": return parsePptxDocument(value);
  }
}
