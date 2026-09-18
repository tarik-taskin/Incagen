import mammoth from "mammoth";
import { inspectArchive, requireArchiveEntries } from "./archive";
import { createParsedDocument, createTextChunks, DocumentParseError, type ParserInput } from "./common";

// DOCX paketini doğrular ve makro ya da dış kaynak çalıştırmadan okunabilir metni çıkarır.
export async function parseDocxDocument(input: ParserInput) {
  const inspection = await inspectArchive(input.data);
  requireArchiveEntries(inspection, ["[Content_Types].xml", "word/document.xml"], "DOCX");
  try {
    const result = await mammoth.extractRawText({ buffer: input.data });
    const chunks = createTextChunks(input.sourceId, result.value, { section: "belge-metni" });
    if (!chunks.length) throw new DocumentParseError("DOCX analiz edilebilir metin içermiyor.");
    const warnings = result.messages.map(message => message.message).slice(0, 20);
    return createParsedDocument(input, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", chunks, {}, warnings);
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    throw new DocumentParseError("DOCX bozuk, parolalı veya ayrıştırılamıyor.");
  }
}
