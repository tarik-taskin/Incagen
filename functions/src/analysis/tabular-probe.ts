import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import ExcelJS from "exceljs";
import { GEMINI_MODEL, GeminiError, type GeminiGenerate, type GeminiUsage } from "./gemini";
import { computeTable, WorkerError } from "./python-worker";
import type { TableSelection, WorkerResult } from "./tabular-contract";
import { createTabularPacket, interpretTable } from "./tabular-result";

export const syntheticTableFormats = ["csv", "xlsx"] as const;
type Format = typeof syntheticTableFormats[number];
const sourceId = "file-0";
const objective = "Summarize the selected amounts by service. Explain which conclusions need additional evidence.";

// İstek yalnız biçimi seçer. Baytlar, kapsam ve bağımsız beklenen cevaplar sunucuda sabittir.
async function syntheticFixture(format: Format) {
  const name = `incagen-synthetic.${format}`;
  const selection: TableSelection = { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "EUR" };
  if (format === "csv") return {
    name, selection, bytes: Buffer.from('Service,Amount\nWeb,10.50\n\nWeb,-0.25\nStore,20.75\n'),
    aggregate: 31, rows: [2, 4, 5], groups: [{ label: "Store", value: 20.75, rows: [5] }, { label: "Web", value: 10.25, rows: [2, 4] }],
  };
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Excluded").addRows([["Service", "Amount"], ["Other", 999]]);
  book.addWorksheet("Selected").addRows([["Service", "Amount"], ["Web", 10], ["Web", 20], ["Store", 90]]);
  return {
    name, selection: { ...selection, sheet: "Selected", aggregation: "mean" as const }, bytes: Buffer.from(await book.xlsx.writeBuffer()),
    aggregate: 40, rows: [2, 3, 4], groups: [{ label: "Store", value: 90, rows: [4] }, { label: "Web", value: 15, rows: [2, 3] }],
  };
}

// Her metrik kaynağının fiziksel satırlarını bağımsız cevap anahtarı ve işçi parçasıyla eşleştirir.
export function verifySyntheticLedger(worker: WorkerResult, fixture: { name: string; selection: TableSelection; aggregate: number; rows: number[]; groups: { label: string; value: number; rows: number[] }[] }, digest: string) {
  const { document, scope, metrics, points } = worker;
  const matches = (metric: WorkerResult["metrics"][number] | undefined, value: number, unit: string, rows: number[]) => {
    if (!metric || metric.value !== value || metric.unit !== unit) return false;
    const covered = new Set<number>();
    for (const entry of metric.evidence) {
      const { rowStart, rowEnd } = entry.locator;
      const chunk = document.chunks.find(item => item.id === entry.chunkId);
      if (entry.sourceId !== sourceId || entry.sha256 !== digest || !chunk || !rowStart || !rowEnd
        || rowStart > rowEnd || rowEnd > fixture.rows.at(-1)! || rowStart < (chunk.locator.rowStart ?? Infinity) || rowEnd > (chunk.locator.rowEnd ?? 0)
        || (entry.locator.sheet ?? null) !== fixture.selection.sheet) return false;
      for (let row = rowStart; row <= rowEnd; row++) covered.add(row);
    }
    return isDeepStrictEqual([...covered].sort((a, b) => a - b), rows);
  };
  if (document.sourceId !== sourceId || document.fileName !== fixture.name || document.sha256 !== digest
    || document.chunks.some(chunk => (chunk.locator.sheet ?? null) !== fixture.selection.sheet)
    || scope.rows !== fixture.rows.length || scope.groups !== fixture.groups.length || scope.sheet !== fixture.selection.sheet
    || !isDeepStrictEqual(scope.selection, fixture.selection) || points.length !== fixture.groups.length || metrics.length !== fixture.groups.length + 2
    || !matches(metrics.find(metric => metric.id === "rows"), fixture.rows.length, "count", fixture.rows)
    || !matches(metrics.find(metric => metric.id === "aggregate"), fixture.aggregate, fixture.selection.unit, fixture.rows)
    || !fixture.groups.every(group => {
      const point = points.find(entry => entry.label === group.label && entry.value === group.value);
      return point && matches(metrics.find(metric => metric.id === point.metricId && metric.label === group.label), group.value, fixture.selection.unit, group.rows);
    })) throw new WorkerError("invalid-data");
}

// Canlı kullanıcı analizinin hesap ve yorum yolunu tek sentetik vakada, kalıcı rapor oluşturmadan çalıştırır.
export async function probeSyntheticTable(format: Format, createGenerate: (onUsage: (usage: GeminiUsage) => void) => GeminiGenerate,
  compute = computeTable, now = Date.now) {
  const fixture = await syntheticFixture(format);
  const started = now();
  const worker = await compute(fixture.bytes, sourceId, fixture.name, fixture.selection);
  const pythonMs = now() - started;
  verifySyntheticLedger(worker, fixture, createHash("sha256").update(fixture.bytes).digest("hex"));
  const packet = createTabularPacket("incagen-synthetic", objective, worker, "en");
  let usage: GeminiUsage | undefined;
  const generate = createGenerate(value => { usage = value; });
  const modelStarted = now();
  try { await interpretTable(packet, "en", generate); }
  catch (error) { throw error instanceof GeminiError ? error : new GeminiError("invalid-response"); }
  const modelMs = now() - modelStarted;
  if (!usage || usage.promptTokens <= 0 || usage.outputTokens <= 0 || pythonMs <= 0 || modelMs <= 0) throw new GeminiError("invalid-response");
  return { status: "ok" as const, model: GEMINI_MODEL, tableFormat: format, rows: fixture.rows.length, groups: fixture.groups.length,
    aggregate: fixture.aggregate, sourceRowsVerified: true as const, pythonMs, modelMs, durationMs: now() - started, inputBytes: packet.inputBytes, usage };
}
