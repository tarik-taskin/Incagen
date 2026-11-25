import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AiResult } from "../../../functions/src/analysis/result-contract";
import type { ReportSource } from "./source-dialog";
import { createMetricsCsv } from "./metrics-csv";
import example from "./feedback-example.json";

const require = createRequire(resolve("functions/package.json"));
const { parse } = require("csv-parse/sync") as {
  parse(csv: string, options: { bom: boolean; columns: boolean }): Record<string, string>[];
};
const source: ReportSource = {
  sourceId: "file-0", fileName: 'Satışlar, "Q1".xlsx', sha256: "a".repeat(64),
  chunks: [{ id: "table-0", locator: { sheet: "季度 · البيانات", rowStart: 2, rowEnd: 9 } }],
};
const metric: AiResult["metrics"][number] = {
  id: "aggregate", label: 'Bölge, "Toplam"\n資料', value: -1234.56, unit: "TRY", status: "available",
  method: "Ölçüm\r\nYöntemi",
  evidence: [
    { sourceId: source.sourceId, sha256: source.sha256, chunkId: "table-0", locator: { sheet: "季度 · البيانات", rowStart: 3, rowEnd: 4 } },
    { sourceId: source.sourceId, sha256: source.sha256, chunkId: "table-0", locator: { sheet: "季度 · البيانات", rowStart: 8, rowEnd: 8 } },
  ],
};

describe("metrics CSV", () => {
  it("preserves Unicode, embedded CSV delimiters and multiple evidence ranges on one numeric row", () => {
    const csv = createMetricsCsv([metric], [source]);
    expect(csv.startsWith("\uFEFFmetric_id,")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    const [row, extra] = parse(csv, { bom: true, columns: true });
    expect(extra).toBeUndefined();
    expect(row).toMatchObject({ metric_id: "aggregate", label: metric.label, value: "-1234.56", unit: "TRY", method: metric.method });
    expect(JSON.parse(row.source_locations)).toEqual([
      { source_id: "file-0", file_name: source.fileName, sheet: "季度 · البيانات", row_start: 3, row_end: 4 },
      { source_id: "file-0", file_name: source.fileName, sheet: "季度 · البيانات", row_start: 8, row_end: 8 },
    ]);
  });

  it.each(["=1+1", "  +10", "\t@label", "\uFEFF-10", "　＝2", "\rdata"])("writes formula-like data as inert text (%j)", label => {
    const [row] = parse(createMetricsCsv([{ ...metric, label, method: label }], [source]), { bom: true, columns: true });
    expect(row.label).toBe(`'${label}`);
    expect(row.method).toBe(`'${label}`);
    expect(row.value).toBe("-1234.56");
  });

  it("keeps genuine zero and missing values distinct without rounding or translating report metadata", () => {
    const [zero, missing, decimal] = parse(createMetricsCsv([
      { ...metric, value: 0 },
      { ...metric, value: null, status: "unavailable", reason: "No results" },
      { ...metric, value: 0.000123, unit: "percent" },
    ], [source]), { bom: true, columns: true });
    expect(zero.value).toBe("0");
    expect(missing).toMatchObject({ value: "", status: "unavailable", reason: "No results" });
    expect(decimal).toMatchObject({ value: "0.000123", unit: "percent" });
    expect(() => createMetricsCsv([{ ...metric, value: Infinity }], [source])).toThrow(/metric value/);
  });

  it("rejects unavailable source versions and mismatched worksheet or row ranges before making a file", () => {
    for (const evidence of [
      { ...metric.evidence[0], sha256: "b".repeat(64) },
      { ...metric.evidence[0], locator: { ...metric.evidence[0].locator, sheet: "Other" } },
      { ...metric.evidence[0], locator: { ...metric.evidence[0].locator, rowEnd: 10 } },
    ]) {
      expect(() => createMetricsCsv([{ ...metric, evidence: [evidence] }], [source])).toThrow(/evidence/);
    }
    expect(() => createMetricsCsv([metric], [])).toThrow(/evidence/);
  });

  it("exports the actual public feedback example without raw comments or model text", () => {
    const result = example.result as AiResult;
    const csv = createMetricsCsv(result.metrics, example.sources);
    const rows = parse(csv, { bom: true, columns: true });
    expect(rows).toHaveLength(result.metrics.length);
    expect(rows.find(row => row.metric_id === "comments")?.value).toBe("32");
    expect(rows.find(row => row.metric_id === "csat")).toMatchObject({ value: "", status: "unavailable" });
    expect(csv).not.toContain(example.sources[0].chunks[0].table!.rows[0][4]);
    expect(csv).not.toContain(result.summary[0].text);
  });
});
