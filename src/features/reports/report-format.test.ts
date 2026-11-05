import { afterEach, expect, it } from "vitest";
import { setLocale } from "../../i18n/runtime";
import { reportNumber } from "./report-format";
afterEach(() => setLocale("tr"));

// Doğrulanmış ondalıklar küçük kart/tooltip/tablo gösteriminde sıfıra veya tam sayıya yuvarlanmaz.
it("sayı ve para hassasiyetini, negatif/sıfır değerleri ve kaynak birimini korur", () => {
  expect(reportNumber(0.123456, "number", true)).toBe("0,123456");
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
