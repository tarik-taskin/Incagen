import { PARSING_LIMITS } from "../contracts";
import { createParsedDocument, createTextChunks, decodeUtf8, DocumentParseError, type ParserInput } from "./common";

// Düz metin ve Markdown dosyalarını UTF-8 doğrulamasından sonra kaynaklı parçalara ayırır.
export function parseTextDocument(input: ParserInput) {
  const text = decodeUtf8(input.data);
  const chunks = createTextChunks(input.sourceId, text);
  if (!chunks.length) throw new DocumentParseError("Metin belgesi boş veya yalnızca boşluk içeriyor.");
  return createParsedDocument(input, input.extension === "md" ? "text/markdown" : "text/plain", chunks);
}

// JSON derinliğini ve düğüm sayısını özyineleme kullanmadan güvenli sınırlar içinde doğrular.
function validateJsonShape(value: unknown) {
  const queue: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (queue.length) {
    const current = queue.pop()!;
    nodes += 1;
    if (nodes > PARSING_LIMITS.jsonNodes) throw new DocumentParseError("JSON güvenli öğe sınırını aşıyor.");
    if (current.depth > PARSING_LIMITS.jsonDepth) throw new DocumentParseError("JSON güvenli iç içe geçme sınırını aşıyor.");
    if (current.value && typeof current.value === "object") {
      const children = Array.isArray(current.value) ? current.value : Object.values(current.value as Record<string, unknown>);
      for (const child of children) queue.push({ value: child, depth: current.depth + 1 });
    }
  }
}

// JSON içeriğini sözdizimi, derinlik ve büyüklük kontrolleriyle normalize eder.
export function parseJsonDocument(input: ParserInput) {
  const text = decodeUtf8(input.data);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DocumentParseError("JSON sözdizimi geçersiz.");
  }
  validateJsonShape(value);
  const normalized = JSON.stringify(value, null, 2);
  const chunks = createTextChunks(input.sourceId, normalized, { section: "json" });
  return createParsedDocument(input, "application/json", chunks);
}
