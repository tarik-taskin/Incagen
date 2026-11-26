import { describe, expect, it, vi } from "vitest";
import { createTabularPacket, interpretTable, analysisFingerprint } from "./tabular-result";
import type { WorkerResult, TableSelection } from "./tabular-contract";

const selection: TableSelection = { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "en", unit: "USD" };
const evidence = [{ sourceId: "file-0", sha256: "a".repeat(64), chunkId: "file-0:table:0001", locator: { section: "table", rowStart: 2, rowEnd: 3 } }];
const worker: WorkerResult = {
  version: 1, document: { version: 1, sourceId: "file-0", fileName: "sales.csv", sha256: "a".repeat(64), extension: "csv", detectedMime: "text/csv", category: "Tablo", parserVersion: "test", metadata: {}, warnings: [], chunks: [{ id: "file-0:table:0001", kind: "table", locator: evidence[0].locator, table: { columns: ["Channel", "Amount"], rows: [["Web", "10.10"], ["Store", "20.20"]] } }] },
  metrics: [{ id: "rows", labelKey: "rows", methodKey: "count", unit: "count", value: 2, evidence }, { id: "aggregate", labelKey: "sum", methodKey: "sum", unit: "USD", value: 30.3, evidence }, { id: "group-1", label: "Web", methodKey: "sum", unit: "USD", value: 10.1, evidence }, { id: "group-2", label: "Store", methodKey: "sum", unit: "USD", value: 20.2, evidence }],
  points: [{ label: "Store", metricId: "group-2", value: 20.2 }, { label: "Web", metricId: "group-1", value: 10.1 }],
  scope: { rows: 2, emptyRows: 0, groups: 2, sheet: null, measure: "Amount", group: "Channel", selection },
};
const narrative = { summary: [{ text: "Store leads the selected measure.", metricIds: ["group-2"] }], findings: [{ id: "finding-1", title: "A concentration worth reviewing", text: "Compare the underlying drivers before changing investment.", metricIds: ["aggregate", "group-2"] }], recommendations: [{ id: "action-1", action: "Review the supporting records with the commercial team.", basisFindingIds: ["finding-1"] }], limitations: ["Costs and campaign effects are outside the source scope."] };

describe("real table result boundary", () => {
  it("hydrates exact metrics and source anchors instead of accepting model calculations", async () => {
    const packet = createTabularPacket("analysis-1", "Compare revenue by channel", worker, "en");
    const result = await interpretTable(packet, "en", async () => JSON.stringify(narrative));
    expect(result.metrics.find(metric => metric.id === "aggregate")!.value).toBe(30.3);
    expect(result.summary[0].evidence).toEqual(evidence);
    expect(result.charts).toHaveLength(1);
    expect(result.findings.at(-1)?.kind).toBe("observation");
  });
  it.each([["tr", "Turkish"], ["en", "English"], ["de", "German"], ["es", "Spanish"], ["zh", "Simplified Chinese"], ["ar", "Arabic"]] as const)(
    "sends the explicit language and a compact, measured data projection for %s", async (locale, language) => {
      const table = structuredClone(worker);
      table.document.chunks[0].table!.rows[0][0] = "PRIVATE RAW CELL";
      const packet = createTabularPacket("private-analysis-id", "收入和服务", table, locale);
      const generate = vi.fn(async (_request: { prompt: string }) => JSON.stringify(narrative));
      const result = await interpretTable(packet, locale, generate);
      const prompt = generate.mock.calls[0][0].prompt;
      expect(JSON.parse(prompt)).toMatchObject({ language, objective: "收入和服务", scope: {
        measure: "Amount", group: "Channel", rows: 2, emptyRows: 0, aggregation: "sum", unit: "USD",
      } });
      expect(prompt).not.toMatch(/PRIVATE RAW CELL|sales\.csv|private-analysis-id|file-0|rowStart/);
      expect(prompt).not.toContain(worker.document.sha256);
      expect(packet.inputBytes).toBe(Buffer.byteLength(prompt, "utf8"));
      expect(packet.inputBytes).toBeGreaterThan(prompt.length);
      expect(result.summary[0].evidence).toEqual(evidence);
    },
  );
  it("accepts a source larger than the old prompt cap without sending its cells", async () => {
    const table = structuredClone(worker);
    const rows = Array.from({ length: 600 }, () => ["敏".repeat(180), "150.20"]);
    table.document.chunks[0].table!.rows = rows;
    const chunk = table.document.chunks[0];
    chunk.locator = { ...chunk.locator, rowEnd: rows.length + 1 };
    table.scope.rows = rows.length;
    table.metrics[0].value = rows.length;
    expect(Buffer.byteLength(JSON.stringify(rows))).toBeGreaterThan(256 * 1024);
    const packet = createTabularPacket("a", "Review the computed measure", table, "en");
    expect(packet.inputBytes).toBeLessThan(2048);
    expect(packet.prompt).not.toContain("敏");
    const result = await interpretTable(packet, "en", async () => JSON.stringify(narrative));
    expect(result.metrics[0].value).toBe(rows.length);
    expect(result.summary[0].evidence).toEqual(evidence);
  });
  it("limits the provider and local narrative to verified metric IDs and three model findings", async () => {
    const packet = createTabularPacket("a", "Compare", worker, "en");
    const generate = vi.fn(async (_request: { schema: unknown }) => JSON.stringify(narrative));
    await interpretTable(packet, "en", generate);
    const schema = JSON.stringify(generate.mock.calls[0][0].schema);
    expect(schema).toContain('"enum":["rows","aggregate","group-1","group-2"]');
    const findings = [1, 2, 3, 4].map(index => ({ ...narrative.findings[0], id: `finding-${index}` }));
    await expect(interpretTable(packet, "en", async () => JSON.stringify({ ...narrative, findings }))).rejects.toThrow();
    await expect(interpretTable(packet, "de", generate)).rejects.toThrow("Mismatched report locale");
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it.each(["The total is 999 dollars.", "الإجمالي ٩٩٩", "There are ２ records."])("rejects unverified numeric prose: %s", async text => {
    await expect(interpretTable(createTabularPacket("a", "Compare", worker, "en"), "en", async () => JSON.stringify({ ...narrative, summary: [{ text, metricIds: ["aggregate"] }] }))).rejects.toThrow();
  });
  it("rejects invented metric IDs, calculations and detached recommendation IDs", async () => {
    const packet = createTabularPacket("a", "Compare", worker, "en");
    for (const response of [
      { ...narrative, summary: [{ text: "Unsupported conclusion", metricIds: ["invented"] }] },
      { ...narrative, metrics: [{ id: "aggregate", value: 999 }] },
      { ...narrative, recommendations: [{ id: "action-1", action: "Do this", basisFindingIds: ["missing"] }] },
    ]) await expect(interpretTable(packet, "en", async () => JSON.stringify(response))).rejects.toThrow();
  });
  it("rejects corrupt calculation evidence and ledger dimensions", () => {
    const corrupted = structuredClone(worker); corrupted.metrics[1].evidence[0].sha256 = "b".repeat(64);
    expect(() => createTabularPacket("a", "Compare", corrupted, "en")).toThrow();
    expect(() => createTabularPacket("a", "Compare", { ...worker, scope: { ...worker.scope, rows: 99 } }, "en")).toThrow();
  });
  it("binds idempotency to exact source, semantic selection and result language", () => {
    const key = analysisFingerprint("a", "file-0", selection, "en");
    expect(analysisFingerprint("a", "file-0", { ...selection }, "en")).toBe(key);
    expect(analysisFingerprint("a", "file-0", { ...selection, numberFormat: "tr" }, "en")).not.toBe(key);
    expect(analysisFingerprint("a", "file-0", selection, "de")).not.toBe(key);
  });
});
