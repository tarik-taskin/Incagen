import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sales from "../../../fixtures/analysis-reference/v1/sales.expected.json";
import feedback from "../../../fixtures/analysis-reference/v1/customer-feedback.expected.json";
import tasks from "../../../fixtures/analysis-reference/v1/tasks.json";
import policy from "../../../fixtures/analysis-reference/evaluation-policy.json";
import { validateReference, type Reference } from "../../../fixtures/analysis-reference/contract";
import { parseDocument } from "./index";

// Gerçek CSV parser'ını kullanır; cevap anahtarını girdi üretiminde veya hesaplamada kullanmaz.
async function loadSource(source: typeof sales.source) {
  const data = readFileSync(new URL(`../../../fixtures/analysis-reference/v1/${source.file}`, import.meta.url));
  const document = await parseDocument({ sourceId: source.sourceId, fileName: source.file, contentType: "text/csv", data });
  expect(document.sha256).toBe(source.sha256);
  expect(document.chunks).toHaveLength(1);
  const chunk = document.chunks[0];
  expect(chunk.id).toBe(source.chunkId);
  expect(chunk.locator).toMatchObject({ rowStart: source.rowStart, rowEnd: source.rowEnd });
  expect(chunk.table?.rows).toHaveLength(source.dataRows);
  return chunk.table!.rows.map(row => Object.fromEntries(chunk.table!.columns.map((key, index) => [key, String(row[index])])));
}

// Ondalık TRY girdisini kuruşa çevirir; test hesabında metin, boşluk veya NaN sessizce sayı sayılmaz.
function cents(value: string) {
  expect(value).toMatch(/^\d+(?:\.\d{1,2})?$/);
  return Math.round(Number(value) * 100);
}

// İnsan etiketlerini deterministik olarak sayar; duygu veya konu sınıflandırması yapmaz.
function counts(values: string[], keys: string[]) {
  return Object.fromEntries(keys.map(key => [key, values.filter(value => value === key).length]));
}

// Satır numarası geçerli olsa da bulgu/grafik için yanlış kanıtı reddeder; seçimleri kaynak olaylarından türetir.
function assertEvidence(reference: Reference, rows: Record<string, string>[]) {
  const select = (predicate: (row: Record<string, string>) => boolean) => rows.flatMap((row, index) => predicate(row) ? [index + 1] : []);
  const allRows = select(() => true);
  const evidence: Record<string, number[]> = reference.caseId === "sales-net-revenue-v1" ? {
    "sales-period-change": select(row => row.status !== "cancelled"),
    "sales-category-leader": select(row => row.category === "Teknoloji" && row.status !== "cancelled"),
    "sales-adjustments": allRows,
  } : {
    "feedback-delivery-problems": reference.annotations.filter(item => item.problemThemes.includes("delivery")).map(item => item.sourceRow),
    "feedback-positive-experiences": reference.annotations.filter(item => item.sentiment === "positive").map(item => item.sourceRow),
    "feedback-mixed-context": reference.annotations.filter(item => item.sentiment === "mixed").map(item => item.sourceRow),
    "feedback-billing-signal": reference.annotations.filter(item => item.problemThemes.includes("billing")).map(item => item.sourceRow),
  };
  expect(reference.findings.map(item => item.id).sort()).toEqual(Object.keys(evidence).sort());
  for (const finding of reference.findings) {
    expect([...finding.sourceRows].sort((a, b) => a - b)).toEqual(evidence[finding.id]);
    const needsDenominator = ["sales-category-leader", "feedback-delivery-problems"].includes(finding.id);
    if (needsDenominator) expect(finding.denominatorRows).toEqual(reference.caseId === "sales-net-revenue-v1" ? evidence["sales-period-change"] : allRows);
  }
  const expectedChartRows = reference.caseId === "sales-net-revenue-v1" ? evidence["sales-period-change"]
    : reference.annotations.filter(item => item.problemThemes.length > 0).map(item => item.sourceRow);
  for (const chart of reference.charts) expect(chart.sourceRows).toEqual(expectedChartRows);
}

describe("sürümlü özetleme referansları (LLM olmadan)", () => {
  it.each([sales, feedback])("$caseId cevap anahtarını sıkı değerlendirme sözleşmesi ve ilgili kanıtla doğrular", async input => {
    const reference = validateReference(input);
    const rows = await loadSource(reference.source);
    assertEvidence(reference, rows);
  });

  it("görevlerin izin verilen alanlarını ve değerlendirme kapsamının gerçek metriklere bağlandığını doğrular", () => {
    expect(tasks.version).toBe(1);
    expect(policy.policyVersion).toBe(1);
    expect(policy.status).toBe("proposed-not-model-tested");
    const references = [sales, feedback];
    expect(tasks.cases.map(item => item.caseId).sort()).toEqual(references.map(item => item.caseId).sort());
    expect(policy.cases.map(item => item.caseId).sort()).toEqual(references.map(item => item.caseId).sort());
    for (const reference of references) {
      const task = tasks.cases.find(item => item.caseId === reference.caseId)!;
      expect(Object.keys(task).sort()).toEqual(["businessRules", "caseId", "objective", "sourceFile", "title"]);
      expect(task.objective).toBe(reference.objective);
      expect(task.sourceFile).toBe(reference.source.file);
      expect(task.businessRules.length).toBeGreaterThan(0);
      const criteria = policy.cases.find(item => item.caseId === reference.caseId)!;
      expect(criteria.requiredFindingIds).toEqual(reference.findings.map(item => item.id));
      for (const path of criteria.requiredMetricPaths) expect(reference.metrics).toHaveProperty(path);
      expect(criteria.requiredScopeNotes.length).toBeGreaterThan(0);
    }
    expect(new Set(policy.rubric.map(item => item.dimension)).size).toBe(policy.rubric.length);
    expect(policy.rubric.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
    expect(policy.minimumScorePerRun).toBe(90);
    expect(policy.hardGates).toContain("minimum-content");
    expect(new Set(policy.hardGates).size).toBe(policy.hardGates.length);
    expect(policy.runsPerCase).toBe(3);
  });

  it("yanlış kaynak, payda, öneri dayanağı, birim ve grafik değerini yeşil sonuç olarak kabul etmez", async () => {
    const rows = await loadSource(sales.source);
    const wrongEvidence = structuredClone(sales);
    wrongEvidence.findings[1].sourceRows = [3, 8];
    expect(() => assertEvidence(validateReference(wrongEvidence), rows)).toThrow();
    const wrongDenominator = structuredClone(sales);
    wrongDenominator.findings[1].denominatorRows = [2, 7];
    expect(() => assertEvidence(validateReference(wrongDenominator), rows)).toThrow();
    const mutations: Array<(copy: typeof sales) => void> = [
      copy => { copy.findings[0].sourceRows = [0]; },
      copy => { copy.findings[0].sourceRows = [1.5]; },
      copy => { copy.findings[0].sourceRows = [1, 1]; },
      copy => { copy.findings[0].sourceRows = [13]; },
      copy => { copy.findings[0].metricPaths = ["missing"]; },
      copy => { copy.recommendations[0].basisFindingIds = ["missing"]; },
      copy => { copy.charts[0].unit = "yorum"; },
      copy => { copy.charts[0].y[0] = 999; },
      copy => { copy.charts[0].sourceRows = [13]; },
    ];
    for (const mutate of mutations) {
      const copy = structuredClone(sales);
      mutate(copy);
      expect(() => validateReference(copy)).toThrow();
    }
    const recommendation = structuredClone(feedback);
    recommendation.recommendations[0].sourceRows = [8];
    expect(() => validateReference(recommendation)).toThrow();
    const invalidReference = { ...sales, schemaVersion: 2 };
    expect(() => validateReference(invalidReference)).toThrow();
  });

  it("satış satırlarını, iade/iptal/indirim kurallarını ve bütün beklenen metrikleri bağımsız hesapla doğrular", async () => {
    const rows = await loadSource(sales.source);
    expect(new Set(rows.map(row => row.event_id)).size).toBe(rows.length);
    const amounts: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    const units: Record<string, number> = {};
    const categories: Record<string, number> = {};
    let gross = 0, discounts = 0, refunds = 0, netUnits = 0;
    for (const row of rows) {
      expect(row.posted_date).toMatch(/^2026-(09|10)-\d{2}$/);
      expect(["completed", "refunded", "cancelled"]).toContain(row.status);
      const quantity = Number(row.quantity);
      expect(Number.isInteger(quantity)).toBe(true);
      const price = cents(row.unit_price_try);
      const discount = cents(row.discount_try);
      if (row.status === "refunded") {
        const original = rows.find(item => item.event_id === row.original_event_id);
        expect(original?.status).toBe("completed");
        expect(quantity).toBeLessThan(0);
        expect(-quantity).toBeLessThanOrEqual(Number(original?.quantity));
        expect(price).toBe(cents(original!.unit_price_try));
        expect(discount).toBe(0);
      } else expect(quantity).toBeGreaterThan(0);
      const amount = row.status === "cancelled" ? 0 : quantity * price - discount;
      amounts[row.event_id] = amount / 100;
      if (row.status === "cancelled") continue;
      const month = row.posted_date.slice(0, 7);
      monthly[month] = (monthly[month] ?? 0) + amount;
      units[month] = (units[month] ?? 0) + quantity;
      categories[row.category] = (categories[row.category] ?? 0) + amount;
      netUnits += quantity;
      if (row.status === "completed") { gross += quantity * price; discounts += discount; }
      else refunds -= amount;
    }
    const net = Object.values(monthly).reduce((sum, value) => sum + value, 0);
    const difference = monthly["2026-10"] - monthly["2026-09"];
    expect(monthly["2026-09"]).toBeGreaterThan(0);
    const toTry = (data: Record<string, number>) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value / 100]));
    expect(amounts).toEqual(sales.rowAmountsTry);
    const { monthlyChangePercent, leadingCategorySharePercent, ...expectedMetrics } = sales.metrics;
    expect(difference / monthly["2026-09"] * 100).toBeCloseTo(monthlyChangePercent, 8);
    expect(Math.max(...Object.values(categories)) / net * 100).toBeCloseTo(leadingCategorySharePercent, 8);
    expect({
      rawEvents: rows.length,
      completedSales: rows.filter(row => row.status === "completed").length,
      refundEvents: rows.filter(row => row.status === "refunded").length,
      cancelledEvents: rows.filter(row => row.status === "cancelled").length,
      grossCompletedSalesTry: gross / 100, discountsTry: discounts / 100, refundsTry: refunds / 100,
      netSalesTry: net / 100, netUnits,
      monthlyNetSalesTry: toTry(monthly), monthlyNetUnits: units,
      monthlyChangeTry: difference / 100,
      categoryNetSalesTry: toTry(categories),
    }).toEqual(expectedMetrics);
    expect(gross - discounts - refunds).toBe(net);
    expect(Object.values(categories).reduce((sum, value) => sum + value, 0)).toBe(net);
  });

  it("yorum kanıtlarını ve insan etiketlerinden hesaplanan paydaları doğrular; etiketleri NLP sonucu saymaz", async () => {
    const rows = await loadSource(feedback.source);
    expect(new Set(rows.map(row => row.feedback_id)).size).toBe(rows.length);
    expect(feedback.annotations).toHaveLength(rows.length);
    expect(new Set(feedback.annotations.map(item => item.sourceRow)).size).toBe(rows.length);
    const themes = Object.keys(feedback.definitions.themeAliases);
    for (const item of feedback.annotations) {
      const row = rows[item.sourceRow - 1];
      expect(row.feedback_id).toBe(item.id);
      expect(row.comment).toContain(item.quote);
      expect(item.themes.length).toBeGreaterThan(0);
      expect(new Set(item.themes).size).toBe(item.themes.length);
      for (const theme of item.themes) expect(themes).toContain(theme);
      for (const problem of item.problemThemes) expect(item.themes).toContain(problem);
      expect(["negative", "positive", "mixed"]).toContain(item.sentiment);
    }
    const themeMentions = counts(feedback.annotations.flatMap(item => item.themes), themes);
    const problemMentions = counts(feedback.annotations.flatMap(item => item.problemThemes), themes);
    const sentimentCounts = counts(feedback.annotations.map(item => item.sentiment), ["negative", "positive", "mixed"]);
    const percentages = (data: Record<string, number>) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value / rows.length * 100]));
    expect({ comments: rows.length,
      themeAssignments: Object.values(themeMentions).reduce((sum, value) => sum + value, 0),
      themeMentions, themeMentionPercent: percentages(themeMentions),
      problemMentions, problemMentionPercent: percentages(problemMentions),
      sentimentCounts, negativeCommentPercent: sentimentCounts.negative / rows.length * 100,
    }).toEqual(feedback.metrics);
  });

  it.each([sales, feedback])("$caseId bulgu/öneri kaynaklarını ve grafiklerin metrikle eşleşmesini doğrular", reference => {
    expect(reference.schemaVersion).toBe(1);
    expect(reference.synthetic).toBe(true);
    const findingIds = reference.findings.map(finding => finding.id);
    expect(new Set(findingIds).size).toBe(findingIds.length);
    for (const finding of reference.findings) {
      for (const path of finding.metricPaths) expect(reference.metrics).toHaveProperty(path);
      const rows = [...finding.sourceRows, ...("denominatorRows" in finding ? finding.denominatorRows : [])];
      expect(finding.sourceRows.length).toBeGreaterThan(0);
      for (const row of rows) { expect(row).toBeGreaterThanOrEqual(1); expect(row).toBeLessThanOrEqual(reference.source.dataRows); }
    }
    for (const recommendation of reference.recommendations) {
      expect(recommendation.basisFindingIds.length).toBeGreaterThan(0);
      for (const id of recommendation.basisFindingIds) expect(findingIds).toContain(id);
    }
    for (const chart of reference.charts) {
      const dataset = (reference.metrics as Record<string, unknown>)[chart.metricPath] as Record<string, number>;
      expect(chart.x.map(key => dataset[key])).toEqual(chart.y);
      expect(chart.x).toHaveLength(chart.y.length);
      expect(chart.sourceRows.length).toBeGreaterThan(0);
      for (const row of chart.sourceRows) { expect(row).toBeGreaterThanOrEqual(1); expect(row).toBeLessThanOrEqual(reference.source.dataRows); }
    }
  });
});
