import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import gold from "../../../fixtures/analysis-reference/v1/sales.expected.json";
import tasks from "../../../fixtures/analysis-reference/v1/tasks.json";
import artifact from "../../../src/features/reports/sales-example.json";
import { parseDocument } from "../parsing";
import { validateAiResult } from "../analysis/result-contract";
import { createSalesExample } from "./sales-report";

// Üretici yalnız ham CSV + görev kuralları alır; cevap anahtarı bağımsız test beklentisidir.
async function example() {
  const document = await parseDocument({ sourceId: "reference-sales", fileName: "sales.csv", contentType: "text/csv", data: readFileSync(new URL("../../../fixtures/analysis-reference/v1/sales.csv", import.meta.url)) });
  const task = tasks.cases[0];
  return { document, output: createSalesExample(document, task.objective, task.businessRules) };
}

describe("sentetik satış raporu", () => {
  it("ham olaylardan hesaplanan bütün sayıları bağımsız referansla eşleştirir", async () => {
    const { output } = await example();
    const value = (id: string) => output.result.metrics.find(item => item.id === id)!.value;
    const expected = gold.metrics;
    expect(value("net-sales")).toBe(expected.netSalesTry);
    expect(value("september")).toBe(expected.monthlyNetSalesTry["2026-09"]);
    expect(value("october")).toBe(expected.monthlyNetSalesTry["2026-10"]);
    expect(value("change")).toBe(expected.monthlyChangeTry);
    expect(value("growth-percent")).toBe(expected.monthlyChangePercent);
    expect(value("category-0")).toBe(expected.categoryNetSalesTry.Teknoloji);
    expect(value("category-1")).toBe(expected.categoryNetSalesTry.Kirtasiye);
    expect(value("category-2")).toBe(expected.categoryNetSalesTry.Aksesuar);
    expect(value("leading-share")).toBeCloseTo(expected.leadingCategorySharePercent, 10);
    expect(value("net-units")).toBe(expected.netUnits);
    expect(value("gross-sales")).toBe(expected.grossCompletedSalesTry);
    expect(value("discounts")).toBe(expected.discountsTry);
    expect(value("refunds")).toBe(expected.refundsTry);
    expect(value("cancelled")).toBe(expected.cancelledEvents);
    expect(output.result.metrics).toHaveLength(14);
  });
  it("yayımlanan statik örneği parser ve doğrulayıcıyla tekrar üretebilir", async () => {
    const { output } = await example();
    expect(output).toEqual(artifact);
    expect(output.result).toEqual(validateAiResult(output.result, output.packet.validationContext));
    expect(output.packet.modelInput.documents[0].chunks[0].table!.rows).toHaveLength(12);
    expect(output.synthetic).toBe(true);
  });
  it("kategori payında tüm uygun satırları, iade ve indirimde doğru olayları dayanak alır", async () => {
    const { output } = await example();
    const rows = (id: string) => output.result.metrics.find(item => item.id === id)!.evidence.map(item => item.locator.rowStart);
    expect(rows("leading-share")).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10, 11]);
    expect(rows("category-0")).toEqual([2, 7]);
    expect(rows("refunds")).toEqual([11]);
    expect(rows("discounts")).toEqual([10]);
    expect(rows("cancelled")).toEqual([5, 12]);
    const tampered = structuredClone(output.result);
    tampered.metrics[0].value = 2650;
    expect(() => validateAiResult(tampered, output.packet.validationContext)).toThrow();
  });
  it("başka bir belgeyi bu sabit örneğin hesaplayıcısına kabul etmez", async () => {
    const { document } = await example();
    document.sha256 = "b".repeat(64);
    expect(() => createSalesExample(document, tasks.cases[0].objective, tasks.cases[0].businessRules)).toThrow(/sentetik/);
  });
});
