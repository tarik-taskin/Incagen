import { describe, expect, it } from "vitest";
import { calculateReport, parseCents, parseDate, readCsv } from "../../../functions/src/csv";
import { createSchema, getQuotaDay, type ColumnMapping } from "../../../functions/src/contracts";
const mapping: ColumnMapping = { dateColumn: "Tarih", amountColumn: "Tutar", categoryColumn: "Kategori", delimiter: ";", dateFormat: "tr", numberFormat: "tr" };
describe("CSV hesaplaması", () => {
  it("kotayı İstanbul gece yarısında sıfırlar", () => {
    expect(getQuotaDay(new Date("2026-09-11T20:59:59Z"))).toBe("2026-09-11");
    expect(getQuotaDay(new Date("2026-09-11T21:00:00Z"))).toBe("2026-09-12");
  });
  it("50.000 satırı aşan veriyi reddeder", () => {
    expect(() => calculateReport([{ name: "large.csv", mapping, text: "Tarih;Tutar;Kategori\n" + "01.09.2026;1;A\n".repeat(50001) }])).toThrow("50.000");
  });
  it("virgül, tırnak, BOM ve ISO tarihini destekler", () => {
    const r = calculateReport([{ name: "quoted.csv", mapping: { ...mapping, delimiter: ",", dateFormat: "iso", numberFormat: "dot" }, text: '\uFEFFTarih,Tutar,Kategori\n2026-09-01,"1,234.50","A,B"' }]);
    expect(r.totalCents).toBe(123450);
    expect(r.categories[0].category).toBe("A,B");
  });
  it("gerçek tutarları kuruşla toplar ve kaynakları korur", () => {
    const r = calculateReport([{ name: "satis.csv", mapping, text: "Tarih;Tutar;Kategori\n01.09.2026;1.234,50;A\n02.09.2026;10,25;B\n" }]);
    expect(r.totalCents).toBe(124475);
    expect(r.rowCount).toBe(2);
    expect(r.daily).toHaveLength(2);
    expect(r.sources[0].rows).toBe(2);
  });
  it("tarih, sayı ve başlık hatalarını reddeder", () => {
    expect(() => parseDate("31.02.2026", "tr")).toThrow();
    expect(parseDate("29.02.2024", "tr")).toBe("2024-02-29");
    expect(() => parseCents("1.23,00", "tr")).toThrow();
    expect(parseCents("-1,234.56", "dot")).toBe(-123456);
    expect(() => readCsv("a;a\n1;2", ";")).toThrow();
  });
  it("hatalı satırı sessizce atlamaz", () => {
    expect(() => calculateReport([{ name: "bad.csv", mapping, text: "Tarih;Tutar;Kategori\n01.09.2026;abc;A" }])).toThrow("bad.csv, kayıt 2");
  });
  it("boş veri ve aşırı boyutlu talepleri reddeder", () => {
    expect(() => calculateReport([{ name: "empty.csv", mapping, text: "Tarih;Tutar;Kategori\n" }])).toThrow();
    expect(createSchema.safeParse({ requestId: crypto.randomUUID(), title: "Test", business: "Test", currency: "TRY", files: [{ name: "a.csv", size: 6 * 1024 * 1024, mapping }] }).success).toBe(false);
  });
});
