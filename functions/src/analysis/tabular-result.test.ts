import { describe, expect, it, vi } from "vitest";
import type { GeminiGenerate } from "./gemini";
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
      const generate = vi.fn<GeminiGenerate>(async () => JSON.stringify(narrative));
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
    const generate = vi.fn<GeminiGenerate>(async () => JSON.stringify(narrative));
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

  it("rejects semantic drift observed in live 6e972d8 reports: performance attribution, broad completeness, translated/ordinal group IDs, and translated sheet names", async () => {
    const csvSelection: TableSelection = { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" };
    const csvEvAll = [{ sourceId: "file-0", sha256: "a".repeat(64), chunkId: "file-0:table:0001", locator: { section: "table", rowStart: 2, rowEnd: 5 } }];
    const csvEvCloud = [{ sourceId: "file-0", sha256: "a".repeat(64), chunkId: "file-0:table:0001", locator: { section: "table", rowStart: 2, rowEnd: 3 } }];
    const csvEvCons = [{ sourceId: "file-0", sha256: "a".repeat(64), chunkId: "file-0:table:0001", locator: { section: "table", rowStart: 4, rowEnd: 5 } }];
    const csvWorker: WorkerResult = {
      version: 1,
      document: {
        version: 1, sourceId: "file-0", fileName: "synthetic-service-revenue.csv", sha256: "a".repeat(64), extension: "csv",
        detectedMime: "text/csv", category: "Tablo", parserVersion: "incagen-python/0.1.0", metadata: {}, warnings: [],
        chunks: [{ id: "file-0:table:0001", kind: "table", locator: { section: "table", rowStart: 2, rowEnd: 5 }, table: { columns: ["Service", "NetRevenue"], rows: [["Cloud", "12000.10"], ["Cloud", "-500.10"], ["Consulting", "5000.20"], ["Consulting", "2500.30"]] } }],
      },
      metrics: [
        { id: "rows", labelKey: "rows", methodKey: "count", unit: "count", value: 4, evidence: csvEvAll },
        { id: "aggregate", labelKey: "sum", methodKey: "sum", unit: "USD", value: 19000.5, evidence: csvEvAll },
        { id: "group-1", label: "Cloud", methodKey: "sum", unit: "USD", value: 11500, evidence: csvEvCloud },
        { id: "group-2", label: "Consulting", methodKey: "sum", unit: "USD", value: 7500.5, evidence: csvEvCons },
      ],
      points: [{ label: "Cloud", metricId: "group-1", value: 11500 }, { label: "Consulting", metricId: "group-2", value: 7500.5 }],
      scope: { rows: 4, emptyRows: 0, groups: 2, sheet: null, measure: "NetRevenue", group: "Service", selection: csvSelection },
    };

    const xlsxSelection: TableSelection = { sheet: "Services", valueColumn: 1, groupColumn: 0, aggregation: "mean", numberFormat: "plain", unit: "EUR" };
    const xlsxEvAll = [{ sourceId: "file-0", sha256: "b".repeat(64), chunkId: "file-0:sheet-2:table:0001", locator: { sheet: "Services", rowStart: 2, rowEnd: 4 } }];
    const xlsxEvA = [{ sourceId: "file-0", sha256: "b".repeat(64), chunkId: "file-0:sheet-2:table:0001", locator: { sheet: "Services", rowStart: 2, rowEnd: 3 } }];
    const xlsxEvB = [{ sourceId: "file-0", sha256: "b".repeat(64), chunkId: "file-0:sheet-2:table:0001", locator: { sheet: "Services", rowStart: 4, rowEnd: 4 } }];
    const xlsxWorker: WorkerResult = {
      version: 1,
      document: {
        version: 1, sourceId: "file-0", fileName: "synthetic-service-teams.xlsx", sha256: "b".repeat(64), extension: "xlsx",
        detectedMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", category: "Tablo", parserVersion: "incagen-python/0.1.0", metadata: { sheets: 2 }, warnings: [],
        chunks: [{ id: "file-0:sheet-2:table:0001", kind: "table", locator: { sheet: "Services", rowStart: 2, rowEnd: 4 }, table: { columns: ["Team", "Amount"], rows: [["A", 10], ["A", 20], ["B", 90]] } }],
      },
      metrics: [
        { id: "rows", labelKey: "rows", methodKey: "count", unit: "count", value: 3, evidence: xlsxEvAll },
        { id: "aggregate", labelKey: "mean", methodKey: "mean", unit: "EUR", value: 40, evidence: xlsxEvAll },
        { id: "group-1", label: "A", methodKey: "mean", unit: "EUR", value: 15, evidence: xlsxEvA },
        { id: "group-2", label: "B", methodKey: "mean", unit: "EUR", value: 90, evidence: xlsxEvB },
      ],
      points: [{ label: "B", metricId: "group-2", value: 90 }, { label: "A", metricId: "group-1", value: 15 }],
      scope: { rows: 3, emptyRows: 0, groups: 2, sheet: "Services", measure: "Amount", group: "Team", selection: xlsxSelection },
    };

    // 1. EN XLSX: Amount farkından performans çıkarımı reddedilir (6e972d8 en-xlsx-result.json bulgusu).
    const enPacket = createTabularPacket("en-1", "Compare the unweighted average amount per team on the Services worksheet.", xlsxWorker, "en");
    await expect(interpretTable(enPacket, "en", async () => JSON.stringify({
      summary: [{ text: "The Services worksheet records provide average amounts across team A and team B.", metricIds: ["rows", "aggregate"] }],
      findings: [{ id: "finding-1", title: "Team averages", text: "Team B has a higher average amount than team A.", metricIds: ["aggregate", "group-1", "group-2"] }],
      recommendations: [{ id: "action-1", action: "Collect additional performance and contextual metrics before attributing performance differences between teams.", basisFindingIds: ["finding-1"] }],
      limitations: ["Only recorded Amount averages are available."],
    }))).rejects.toThrow(/performance/i);

    // 2. ZH CSV: "记录完整" ile veri kümesinin tamamı eksiksiz iddiası reddedilir.
    const zhPacket = createTabularPacket("zh-1", "Compare recorded net revenue across service lines.", csvWorker, "zh");
    await expect(interpretTable(zhPacket, "zh", async () => JSON.stringify({
      summary: [{ text: "所选记录涵盖 Cloud 与 Consulting 两个服务线。", metricIds: ["rows", "aggregate"] }],
      findings: [
        { id: "finding-1", title: "服务线对比", text: "Cloud 的汇总金额高于 Consulting。", metricIds: ["group-1", "group-2"] },
        { id: "finding-2", title: "记录完整度", text: "纳入统计的记录完整且无空行，形成了对应的整体汇总指标。", metricIds: ["rows", "aggregate"] },
      ],
      recommendations: [],
      limitations: ["缺少成本数据，无法评估盈利能力。"],
    }))).rejects.toThrow(/completeness/i);

    // 3. ZH CSV: Cloud/Consulting grup kimliklerini çevirip özgün adları düşürmek reddedilir.
    await expect(interpretTable(zhPacket, "zh", async () => JSON.stringify({
      summary: [{ text: "所选记录涵盖两个服务线。", metricIds: ["rows", "aggregate"] }],
      findings: [{ id: "finding-1", title: "服务线分布", text: "根据记录数据，云服务与咨询服务均有汇总金额，其中云服务高于咨询服务。", metricIds: ["group-1", "group-2"] }],
      recommendations: [],
      limitations: ["缺少成本数据，无法评估盈利能力。"],
    }))).rejects.toThrow(/group label/i);

    // 4. ZH CSV: "净收入" kârlılık/net gelir muğlaklığı reddedilir; özgün NetRevenue veya 所选指标 istenir.
    await expect(interpretTable(zhPacket, "zh", async () => JSON.stringify({
      summary: [{ text: "所选记录涵盖 Cloud 与 Consulting。", metricIds: ["rows", "aggregate"] }],
      findings: [{ id: "finding-1", title: "服务线分布", text: "Cloud 的汇总金额高于 Consulting。", metricIds: ["group-1", "group-2"] }],
      recommendations: [],
      limitations: ["当前数据仅包含净收入汇总指标，缺少成本数据。"],
    }))).rejects.toThrow(/measure label/i);

    // 5. AR XLSX: "الفريق الأول/الثاني" sıralı adlandırması ve A/B kimliklerinin kaybolması reddedilir.
    const arPacket = createTabularPacket("ar-1", "Compare the unweighted average amount per team on the Services worksheet.", xlsxWorker, "ar");
    await expect(interpretTable(arPacket, "ar", async () => JSON.stringify({
      summary: [{ text: "يوضح الملخص متوسط المبالغ في ورقة Services.", metricIds: ["rows", "aggregate"] }],
      findings: [{ id: "finding-1", title: "مقارنة المتوسطات", text: "سجل الفريق الثاني متوسط مبالغ أعلى مقارنة بمتوسط الفريق الأول وفق السجلات المرصودة.", metricIds: ["group-1", "group-2"] }],
      recommendations: [],
      limitations: ["لا تتوفر بيانات إضافية لتفسير الاختلاف."],
    }))).rejects.toThrow(/group label/i);

    // 6. AR XLSX: "Services" çalışma sayfası adının "ورقة الخدمات" diye çevrilmesi reddedilir.
    await expect(interpretTable(arPacket, "ar", async () => JSON.stringify({
      summary: [{ text: "يوضح الملخص متوسط المبالغ في ورقة الخدمات.", metricIds: ["rows", "aggregate"] }],
      findings: [{ id: "finding-1", title: "مقارنة المتوسطات", text: "جاء متوسط مبالغ الفريق B أعلى من متوسط الفريق A وفق السجلات المرصودة.", metricIds: ["group-1", "group-2"] }],
      recommendations: [],
      limitations: ["لا تتوفر بيانات إضافية لتفسير الاختلاف."],
    }))).rejects.toThrow(/worksheet/i);

    // 7. Prompt kapsamında sheet ve metrik başına recordCount taşınır (ham hücre/rowStart/hash sızmadan).
    const parsedEnPrompt = JSON.parse(enPacket.prompt);
    expect(parsedEnPrompt.scope.sheet).toBe("Services");
    expect(parsedEnPrompt.verifiedMetrics).toEqual([
      { id: "rows", label: "Records reviewed", value: 3, unit: "count", recordCount: 3 },
      { id: "aggregate", label: "Measure average", value: 40, unit: "EUR", recordCount: 3 },
      { id: "group-1", label: "A", value: 15, unit: "EUR", recordCount: 2 },
      { id: "group-2", label: "B", value: 90, unit: "EUR", recordCount: 1 },
    ]);
    expect(enPacket.prompt).not.toMatch(/rowStart|file-0|synthetic-service-teams/);

    // 8. Düzeltilmiş 6 dilli (EN/ZH/AR/ES/TR/DE) kaynaklı anlatımlar tüm kapılardan geçer.
    const enOk = await interpretTable(enPacket, "en", async () => JSON.stringify({
      summary: [{ text: "The selected Services worksheet records show the overall record-weighted average and separate averages for team A and team B.", metricIds: ["rows", "aggregate"] }],
      findings: [{ id: "finding-1", title: "Recorded amount comparison", text: "Team B has a higher recorded average amount than team A, while team B is based on a single record.", metricIds: ["aggregate", "group-1", "group-2"] }],
      recommendations: [{ id: "action-1", action: "Collect additional contextual data before drawing operational conclusions from the difference in average amounts between team A and team B.", basisFindingIds: ["finding-1"] }],
      limitations: ["Operational drivers cannot be determined from the recorded Amount averages alone."],
    }));
    expect(enOk.metrics.find(m => m.id === "aggregate")?.value).toBe(40);

    const zhOk = await interpretTable(zhPacket, "zh", async () => JSON.stringify({
      summary: [{ text: "所选记录涵盖 Cloud 与 Consulting 两个服务线，得出各组及整体 NetRevenue 汇总金额。", metricIds: ["rows", "aggregate"] }],
      findings: [{ id: "finding-1", title: "服务线汇总金额对比", text: "根据记录数据，Cloud 的所选指标汇总金额高于 Consulting。", metricIds: ["group-1", "group-2"] }],
      recommendations: [{ id: "action-1", action: "结合各服务线的成本支出数据，再开展盈利能力评估。", basisFindingIds: ["finding-1"] }],
      limitations: ["当前仅包含所选指标 NetRevenue 汇总金额，缺少成本数据，无法评估盈利能力。"],
    }));
    expect(zhOk.metrics.find(m => m.id === "aggregate")?.value).toBe(19000.5);

    const arOk = await interpretTable(arPacket, "ar", async () => JSON.stringify({
      summary: [{ text: "يوضح الملخص المتوسط العام للمبالغ في ورقة Services إضافة إلى متوسط الفريق A والفريق B.", metricIds: ["rows", "aggregate"] }],
      findings: [{ id: "finding-1", title: "مقارنة متوسط المبالغ", text: "جاء متوسط مبالغ الفريق B أعلى من متوسط الفريق A وفق السجلات المرصودة، ويستند الفريق B إلى سجل واحد.", metricIds: ["group-1", "group-2"] }],
      recommendations: [{ id: "action-1", action: "مراجعة بيانات إضافية لفهم أسباب الاختلاف بين متوسطي الفريقين A وB قبل اتخاذ قرارات تشغيلية.", basisFindingIds: ["finding-1"] }],
      limitations: ["لا تتوفر تفاصيل إضافية لتفسير أسباب الاختلاف بين المبالغ المسجلة."],
    }));
    expect(arOk.metrics.find(m => m.id === "group-2")?.value).toBe(90);

    const esPacket = createTabularPacket("es-1", "Compare the unweighted average amount per team on the Services worksheet.", xlsxWorker, "es");
    const esOk = await interpretTable(esPacket, "es", async () => JSON.stringify({
      summary: [{ text: "Se revisaron los registros seleccionados de la hoja Services para comparar el promedio calculado de cada grupo con el promedio general ponderado por registro.", metricIds: ["rows", "aggregate"] }],
      findings: [{ id: "finding-1", title: "Diferencia en el promedio calculado", text: "El promedio calculado para el grupo B se sitúa por encima del promedio general y del grupo A; el grupo B se basa en un único registro.", metricIds: ["aggregate", "group-1", "group-2"] }],
      recommendations: [],
      limitations: ["El alcance no contiene datos contextuales para explicar la brecha entre los grupos."],
    }));
    expect(esOk.metrics.find(m => m.id === "aggregate")?.value).toBe(40);
    expect(esOk.metrics.find(m => m.id === "aggregate")?.value).not.toBe(52.5);
  });

  it("handles digit-containing, RTL Arabic, punctuation, and lookalike group labels without breaking numeric prose rules", async () => {
    const ev1 = [{ sourceId: "file-0", sha256: "c".repeat(64), chunkId: "file-0:table:0001", locator: { section: "table", rowStart: 2, rowEnd: 2 } }];
    const ev2 = [{ sourceId: "file-0", sha256: "c".repeat(64), chunkId: "file-0:table:0001", locator: { section: "table", rowStart: 3, rowEnd: 3 } }];
    const ev3 = [{ sourceId: "file-0", sha256: "c".repeat(64), chunkId: "file-0:table:0001", locator: { section: "table", rowStart: 4, rowEnd: 4 } }];
    const evAll = [{ sourceId: "file-0", sha256: "c".repeat(64), chunkId: "file-0:table:0001", locator: { section: "table", rowStart: 2, rowEnd: 4 } }];
    const specialWorker: WorkerResult = {
      version: 1,
      document: {
        version: 1, sourceId: "file-0", fileName: "mixed-labels.csv", sha256: "c".repeat(64), extension: "csv",
        detectedMime: "text/csv", category: "Tablo", parserVersion: "incagen-python/0.1.0", metadata: {}, warnings: [],
        chunks: [{ id: "file-0:table:0001", kind: "table", locator: { section: "table", rowStart: 2, rowEnd: 4 }, table: { columns: ["Group", "Amount"], rows: [["Team 1", "100"], ["فريق الشرق", "200"], ["Cloud (US)/A-B", "300"]] } }],
      },
      metrics: [
        { id: "rows", labelKey: "rows", methodKey: "count", unit: "count", value: 3, evidence: evAll },
        { id: "aggregate", labelKey: "sum", methodKey: "sum", unit: "USD", value: 600, evidence: evAll },
        { id: "group-1", label: "Team 1", methodKey: "sum", unit: "USD", value: 100, evidence: ev1 },
        { id: "group-2", label: "فريق الشرق", methodKey: "sum", unit: "USD", value: 200, evidence: ev2 },
        { id: "group-3", label: "Cloud (US)/A-B", methodKey: "sum", unit: "USD", value: 300, evidence: ev3 },
      ],
      points: [
        { label: "Cloud (US)/A-B", metricId: "group-3", value: 300 },
        { label: "فريق الشرق", metricId: "group-2", value: 200 },
        { label: "Team 1", metricId: "group-1", value: 100 },
      ],
      scope: { rows: 3, emptyRows: 0, groups: 3, sheet: null, measure: "Amount", group: "Group", selection },
    };

    const packet = createTabularPacket("special-1", "Compare totals across groups", specialWorker, "en");
    // Rakam içeren "Team 1" etiketi prose içinde rakam yasak olduğu için zorlanmaz; RTL ve noktalama etiketleri birebir korunur.
    const result = await interpretTable(packet, "en", async () => JSON.stringify({
      summary: [{ text: "The selected table summarizes totals across three groups.", metricIds: ["rows", "aggregate"] }],
      findings: [{ id: "finding-1", title: "Group comparison", text: "Cloud (US)/A-B leads, followed by فريق الشرق and the remaining numbered team label.", metricIds: ["group-1", "group-2", "group-3"] }],
      recommendations: [],
      limitations: ["Only recorded Amount totals are included."],
    }));
    expect(result.datasets[0].points.map(p => [p.metricId, p.label, p.value])).toEqual([
      ["group-3", "Cloud (US)/A-B", 300],
      ["group-2", "فريق الشرق", 200],
      ["group-1", "Team 1", 100],
    ]);
    // Rakamlı etiketi prose içine yazmaya kalkışan model çıktısı safeText tarafından hâlâ reddedilir.
    await expect(interpretTable(packet, "en", async () => JSON.stringify({
      summary: [{ text: "Team 1 has the lowest total.", metricIds: ["group-1"] }],
      findings: [{ id: "finding-1", title: "Group comparison", text: "Cloud (US)/A-B leads over فريق الشرق.", metricIds: ["group-2", "group-3"] }],
      recommendations: [],
      limitations: ["Only Amount totals are available."],
    }))).rejects.toThrow();
  });
});
