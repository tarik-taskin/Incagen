import { afterEach, expect, it } from "vitest";
import { languages, setLocale } from "../../i18n/runtime";
import { reportDuration, reportNumber, sourceCell } from "./report-format";
afterEach(() => setLocale("tr"));

// Doğrulanmış ondalıklar küçük kart/tooltip/tablo gösteriminde sıfıra veya tam sayıya yuvarlanmaz.
it("sayı ve para hassasiyetini, negatif/sıfır değerleri ve kaynak birimini korur", () => {
  expect(reportNumber(0.123456, "number", true)).toBe("0,123456");
  expect(reportNumber(19000.5, "USD")).toBe("19.000,50 USD");
  expect(reportNumber(-0.3, "USD")).toBe("-0,30 USD");
  expect(reportNumber(0, "EUR")).toBe("0,00 EUR");
  expect(reportNumber(2, "count")).toBe("2 kayıt");
  setLocale("en");
  expect(reportNumber(0.123456, "number", true)).toBe("0.123456");
  expect(reportNumber(12.3456, "percent")).toBe("12.3456%");
  expect(reportNumber(0.3, "USD")).toBe("0.30 USD");
  expect(reportNumber(null, "number")).toBe("—");
  setLocale("ar"); expect(reportNumber(2, "count")).toBe("سجلان");
});

it("does not turn missing, invalid or high-precision source cells into monetary zeroes", () => {
  for (const value of [null, "", "   "]) expect(sourceCell(value, "revenue_try", true)).toBe("—");
  for (const value of [false, true, "not reported", "0x10", "1e3", "1,20", "12.3456", 12.3456, "9007199254740993.01", "90071992547409.91"])
    expect(sourceCell(value, "revenue_try", true)).toBe(String(value));
  expect(sourceCell(0, "revenue_try", true)).toBe("0,00");
  expect(sourceCell("-12.30", "revenue_try", true)).toBe("-12,30");
  expect(sourceCell("1120.50", "revenue_try", false)).toBe("1120.50");
  expect(sourceCell("0012", "record_id", true)).toBe("0012");
});

it.each(languages)("formats source amounts and recorded durations in $code without changing their values", language => {
  setLocale(language.code);
  expect(sourceCell("1234.50", "revenue_try", true)).toBe(new Intl.NumberFormat(language.tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.5));
  const seconds = new Intl.NumberFormat(language.tag).format(1.3);
  expect(reportDuration(1250)).toContain(seconds);
  expect(reportDuration(0)).toContain(new Intl.NumberFormat(language.tag).format(0));
  for (const absent of [undefined, NaN, Infinity, -1]) expect(reportDuration(absent)).toBe("—");
});
