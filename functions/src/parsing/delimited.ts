import { parse } from "csv-parse/sync";
import { PARSING_LIMITS, type ParsedCell } from "../contracts";
import { createParsedDocument, createTableChunks, decodeUtf8, DocumentParseError, normalizeColumns, type ParserInput } from "./common";

// CSV'nin ilk mantıksal satırında tırnak dışındaki ayraçları sayarak kararlı bir ayraç seçer.
function detectCsvDelimiter(text: string) {
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && character === "\n") break;
    else if (!quoted && counts.has(character)) counts.set(character, counts.get(character)! + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[1] ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] : ",";
}

// CSV/TSV içeriğini satır ve sütun sınırlarıyla tablo parçalarına dönüştürür.
export function parseDelimitedDocument(input: ParserInput) {
  const text = decodeUtf8(input.data);
  const delimiter = input.extension === "tsv" ? "\t" : detectCsvDelimiter(text);
  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      delimiter,
      skip_empty_lines: true,
      relax_column_count: false,
      max_record_size: 100_000,
      cast: false,
    });
  } catch {
    throw new DocumentParseError("Tablo ayrıştırılamadı; ayraç veya satır yapısını kontrol edin.");
  }
  if (!records.length) throw new DocumentParseError("Tablo veri içermiyor.");
  if (records.length - 1 > PARSING_LIMITS.tableRows) throw new DocumentParseError("Tablo satır sınırını aşıyor.");
  const width = Math.max(...records.map(row => row.length));
  if (!width || width > PARSING_LIMITS.tableColumns) throw new DocumentParseError("Tablo sütun sınırını aşıyor.");
  const columns = normalizeColumns(records[0] as ParsedCell[], width);
  const rows = records.slice(1).map(row => Array.from({ length: width }, (_, index) => row[index] ?? null));
  const chunks = createTableChunks(input.sourceId, columns, rows, { section: "tablo" });
  return createParsedDocument(input, input.extension === "tsv" ? "text/tab-separated-values" : "text/csv", chunks);
}
