import ExcelJS, { type CellValue } from "exceljs";
import { PARSING_LIMITS, type DocumentChunk, type ParsedCell } from "../contracts";
import { inspectArchive, requireArchiveEntries } from "./archive";
import { createParsedDocument, createTableChunks, DocumentParseError, normalizeColumns, type ParserInput } from "./common";

// ExcelJS hücre değerlerini formül çalıştırmadan ortak ilkel hücre türlerine indirger.
function normalizeCell(value: CellValue | undefined): ParsedCell {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if ("result" in value) return normalizeCell(value.result as CellValue);
  if ("richText" in value) return value.richText.map(part => part.text).join("");
  if ("text" in value) return String(value.text);
  if ("error" in value) return String(value.error);
  return String(value);
}

// XLSX çalışma sayfalarını formülleri yürütmeden, sayfa ve satır konumlarını koruyan tablolara dönüştürür.
export async function parseXlsxDocument(input: ParserInput) {
  const inspection = await inspectArchive(input.data);
  requireArchiveEntries(inspection, ["[Content_Types].xml", "xl/workbook.xml"], "XLSX");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(input.data as unknown as Parameters<typeof workbook.xlsx.load>[0], {
      ignoreNodes: ["dataValidations", "extLst", "hyperlinks", "picture", "drawing", "sheetProtection"],
    });
  } catch {
    throw new DocumentParseError("XLSX çalışma kitabı okunamadı veya parolalı.");
  }
  if (!workbook.worksheets.length) throw new DocumentParseError("XLSX çalışma sayfası içermiyor.");
  if (workbook.worksheets.length > PARSING_LIMITS.workbookSheets) throw new DocumentParseError("XLSX çalışma sayfası sınırını aşıyor.");
  const chunks: DocumentChunk[] = [];
  const warnings: string[] = [];
  let totalRows = 0;
  let totalCells = 0;
  for (const worksheet of workbook.worksheets) {
    const width = worksheet.actualColumnCount;
    const height = worksheet.actualRowCount;
    if (!width || !height) {
      warnings.push(`${worksheet.name}: boş çalışma sayfası atlandı.`);
      continue;
    }
    if (width > PARSING_LIMITS.tableColumns) throw new DocumentParseError(`${worksheet.name}: Sütun sınırı aşıldı.`);
    totalRows += Math.max(0, height - 1);
    if (totalRows > PARSING_LIMITS.tableRows) throw new DocumentParseError("XLSX toplam satır sınırını aşıyor.");
    totalCells += Math.max(0, height - 1) * width;
    if (totalCells > PARSING_LIMITS.tableCells) throw new DocumentParseError("XLSX toplam hücre sınırını aşıyor.");
    const header = Array.from({ length: width }, (_, index) => normalizeCell(worksheet.getRow(1).getCell(index + 1).value));
    const columns = normalizeColumns(header, width);
    const rows: ParsedCell[][] = [];
    for (let rowNumber = 2; rowNumber <= height; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      rows.push(Array.from({ length: width }, (_, index) => normalizeCell(row.getCell(index + 1).value)));
    }
    chunks.push(...createTableChunks(input.sourceId, columns, rows, { sheet: worksheet.name, rowStart: 2 }));
  }
  if (!chunks.length) throw new DocumentParseError("XLSX analiz edilebilir hücre içermiyor.");
  return createParsedDocument(input, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", chunks, { sheets: workbook.worksheets.length }, warnings);
}
