import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../../../fixtures/company-example/v1/manifest.json";
import expected from "../../../fixtures/company-example/expected.json";

import { parseDocument } from "../parsing";
import { createCompanyReport, type CompanyPeriod } from "./company-report";

// Dondurulmuş beklentiden bağımsız olarak gerçek kaynak dosyalarını parser'dan geçirir.
async function documents() {
  return Promise.all(manifest.files.map(async item => {
    const data = readFileSync(new URL(`../../../fixtures/company-example/v1/${item.file}`, import.meta.url));
    expect(createHash("sha256").update(data).digest("hex")).toBe(item.sha256);
    const document = await parseDocument({ sourceId: item.sourceId, fileName: item.file, contentType: "text/csv", data });
    expect(document.chunks.reduce((n, chunk) => n + (chunk.table?.rows.length ?? 0), 0)).toBe(item.rows);
    return document;
  }));
}

describe("kapsamlı şirket örneği", () => {
  it.each(["year", "h1", "h2", "q4"] as CompanyPeriod[])("%s döneminde tüm rapor/tablolar bağımsız beklenen toplamlarla eşleşir", async period => {
    const report = createCompanyReport(await documents(), period);
    const gold = expected[period];
    const value = (id: string) => report.result.metrics.find(item => item.id === id)!.value!;
    for (const [id, field] of [["net-sales", "net"], ["gross-sales", "gross"], ["discounts", "discounts"], ["refunds", "refunds"], ["gross-profit", "profit"], ["target", "budget"], ["orders", "orders"], ["contribution", "contribution"]] as const) expect(value(id)).toBe(gold[field]);
    expect(value("margin")).toBeCloseTo(gold.margin, 10);
    expect(value("on-time")).toBeCloseTo(gold.onTime, 10);
    expect(value("target-rate")).toBeCloseTo(gold.net / gold.budget * 100, 10);
    expect(report.sourceRows).toBe(gold.rows);
    for (const [dim, rows] of [["category", report.categories], ["channel", report.channels], ["region", report.regions]] as const) for (const row of rows) expect(row.net).toBe(gold[dim][row.name as keyof typeof gold[typeof dim]]);
    expect(Math.round(report.monthly.reduce((n, row) => n + row.net * 100, 0))).toBe(Math.round(gold.net * 100));
    expect(report.channels.reduce((n, row) => n + row.orders, 0)).toBe(gold.orders);
    for (const row of report.channels) expect(row.contribution / row.orders).toBeGreaterThan(0);
    expect(report.result.charts).toHaveLength(6);
    expect(report.result.findings).toHaveLength(3);
  });

  it("halkaya çizilen kanal payları tek ve pozitif bir bütünü oluşturur", async () => {
    const report = createCompanyReport(await documents());
    expect(report.channels.every(row => row.net > 0)).toBe(true);
    expect(report.channels.reduce((n, row) => n + row.share, 0)).toBeCloseTo(100, 10);
    expect(report.categories.reduce((n, row) => n + row.net, 0)).toBeCloseTo(expected.year.net, 6);
  });

  it("kategori kanıtları parça sınırlarını ve aradaki ilgisiz satırları korur", async () => {
    const sources = await documents();
    const report = createCompanyReport(sources);
    for (const category of report.categories) {
      const referenced = category.evidence.flatMap(anchor => {
        const chunk = sources[0].chunks.find(part => part.id === anchor.chunkId)!;
        expect(anchor.locator.rowStart!).toBeGreaterThanOrEqual(chunk.locator.rowStart!);
        expect(anchor.locator.rowEnd!).toBeLessThanOrEqual(chunk.locator.rowEnd!);
        return chunk.table!.rows.filter((_row, index) => {
          const row = chunk.locator.rowStart! + index;
          return row >= anchor.locator.rowStart! && row <= anchor.locator.rowEnd!;
        });
      });
      expect(referenced).toHaveLength(216);
      expect(referenced.every(row => row[4] === category.name)).toBe(true);
    }
  });

  it("bozuk tutarı, yinelenen kaydı ve satış/operasyon çelişkisini reddeder", async () => {
    const sources = await documents();
    const badMoney = structuredClone(sources); badMoney[0].chunks[0].table!.rows[0][8] = "nan";
    expect(() => createCompanyReport(badMoney)).toThrow(/sayı/);
    const duplicate = structuredClone(sources); duplicate[0].chunks[0].table!.rows[1][0] = duplicate[0].chunks[0].table!.rows[0][0];
    expect(() => createCompanyReport(duplicate)).toThrow(/yinelenen/);
    const mismatch = structuredClone(sources); mismatch[2].chunks[0].table!.rows[0][4] = 1;
    expect(() => createCompanyReport(mismatch)).toThrow(/tutarsız/);
  });
});
