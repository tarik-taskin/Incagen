import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { PARSING_LIMITS, type DocumentChunk } from "../contracts";
import { inspectArchive, requireArchiveEntries } from "./archive";
import { createParsedDocument, createTextChunks, DocumentParseError, type ParserInput } from "./common";

// OOXML ağacında yalnız sunum metni düğümlerini belge sırasını bozmadan toplar.
function collectDrawingText(value: unknown, output: string[]) {
  if (Array.isArray(value)) {
    for (const item of value) collectDrawingText(item, output);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "a:t") {
      const textValues = Array.isArray(child) ? child : [child];
      for (const textValue of textValues) if (typeof textValue === "string" || typeof textValue === "number") output.push(String(textValue));
    } else collectDrawingText(child, output);
  }
}

// PPTX slayt metinlerini slayt numaralarını koruyarak çıkarır; medya sonraki AI aşamasına bırakılır.
export async function parsePptxDocument(input: ParserInput) {
  const inspection = await inspectArchive(input.data);
  requireArchiveEntries(inspection, ["[Content_Types].xml", "ppt/presentation.xml"], "PPTX");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input.data, { checkCRC32: true });
  } catch {
    throw new DocumentParseError("PPTX paketi okunamadı.");
  }
  const slides = Object.keys(zip.files)
    .map(name => ({ name, match: /^ppt\/slides\/slide(\d+)\.xml$/.exec(name) }))
    .filter((entry): entry is { name: string; match: RegExpExecArray } => Boolean(entry.match))
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));
  if (!slides.length) throw new DocumentParseError("PPTX slayt içermiyor.");
  if (slides.length > PARSING_LIMITS.slides) throw new DocumentParseError("PPTX slayt sınırını aşıyor.");
  const xml = new XMLParser({ ignoreAttributes: true, processEntities: false, parseTagValue: false, trimValues: false });
  const chunks: DocumentChunk[] = [];
  const warnings: string[] = [];
  let characters = 0;
  for (const slide of slides) {
    const slideNumber = Number(slide.match[1]);
    const content = await zip.file(slide.name)!.async("string");
    const values: string[] = [];
    try {
      collectDrawingText(xml.parse(content), values);
    } catch {
      throw new DocumentParseError(`Slayt ${slideNumber}: XML içeriği ayrıştırılamadı.`);
    }
    const text = values.map(value => value.trim()).filter(Boolean).join("\n");
    characters += text.length;
    if (characters > PARSING_LIMITS.textCharacters) throw new DocumentParseError("PPTX metin karakter sınırını aşıyor.");
    const slideChunks = createTextChunks(`${input.sourceId}:slide-${slideNumber}`, text, { slide: slideNumber });
    if (!slideChunks.length) {
      warnings.push(`Slayt ${slideNumber}: metin bulunamadı; görseller AI aşamasında değerlendirilecek.`);
      slideChunks.push({ id: `${input.sourceId}:slide-${slideNumber}:image:0001`, kind: "image", locator: { slide: slideNumber } });
    }
    chunks.push(...slideChunks);
  }
  if (!characters) warnings.push("Sunum metin içermiyor; görsel analiz sonraki AI aşamasında yapılacak.");
  return createParsedDocument(input, "application/vnd.openxmlformats-officedocument.presentationml.presentation", chunks, { slides: slides.length }, warnings);
}
