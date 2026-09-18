import { PDFParse } from "pdf-parse";
import { PARSING_LIMITS, type DocumentChunk } from "../contracts";
import { createParsedDocument, createTextChunks, DocumentParseError, type ParserInput } from "./common";

// PDF sayfalarındaki metni sayfa numaralarını koruyarak çıkarır; taranmış sayfaları OCR için işaretler.
export async function parsePdfDocument(input: ParserInput) {
  if (input.data.length < 5 || input.data.subarray(0, 5).toString("ascii") !== "%PDF-") throw new DocumentParseError("PDF imzası geçersiz.");
  const parser = new PDFParse({ data: new Uint8Array(input.data) });
  try {
    const info = await parser.getInfo();
    if (!info.total || info.total > PARSING_LIMITS.pdfPages) throw new DocumentParseError("PDF sayfa sınırını aşıyor veya sayfa içermiyor.");
    const result = await parser.getText();
    const totalCharacters = result.pages.reduce((total, page) => total + page.text.length, 0);
    if (totalCharacters > PARSING_LIMITS.textCharacters) throw new DocumentParseError("PDF metin karakter sınırını aşıyor.");
    const chunks: DocumentChunk[] = [];
    const warnings: string[] = [];
    for (const page of result.pages) {
      const pageChunks = createTextChunks(`${input.sourceId}:page-${page.num}`, page.text, { page: page.num });
      if (!pageChunks.length) {
        warnings.push(`Sayfa ${page.num}: metin bulunamadı; AI/OCR aşaması gerekebilir.`);
        pageChunks.push({ id: `${input.sourceId}:page-${page.num}:image:0001`, kind: "image", locator: { page: page.num } });
      }
      chunks.push(...pageChunks);
    }
    if (!totalCharacters) warnings.push("PDF metin katmanı içermiyor; sonraki AI/OCR aşamasında görsel olarak işlenecek.");
    return createParsedDocument(input, "application/pdf", chunks, { pages: info.total }, warnings);
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    throw new DocumentParseError("PDF bozuk, parolalı veya ayrıştırılamıyor.");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
