import { describe, expect, it } from "vitest";
import { createSchema, getQuotaDay, hasSupportedExtension } from "../../../functions/src/contracts";

// Farklı belge türleriyle geçerli bir analiz hazırlama isteği üretir.
function request() {
  return {
    requestId: crypto.randomUUID(),
    title: "Aylık faaliyet analizi",
    business: "Sentetik İşletme",
    files: [
      { name: "faaliyet.pdf", size: 1024, contentType: "application/pdf" },
      { name: "veriler.xlsx", size: 2048, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    ],
  };
}

describe("Belge hazırlama sözleşmesi", () => {
  it("kotayı İstanbul gece yarısında sıfırlar", () => {
    expect(getQuotaDay(new Date("2026-09-11T20:59:59Z"))).toBe("2026-09-11");
    expect(getQuotaDay(new Date("2026-09-11T21:00:00Z"))).toBe("2026-09-12");
  });

  it("farklı iş belgesi türlerini aynı analizde kabul eder", () => {
    expect(createSchema.safeParse(request()).success).toBe(true);
    expect(hasSupportedExtension("SUNUM.PPTX")).toBe(true);
    expect(hasSupportedExtension("notlar.md")).toBe(true);
  });

  it("çalıştırılabilir dosyayı ve dosya boyutu sınırı ihlalini reddeder", () => {
    const unsupported = request();
    unsupported.files[0] = { name: "program.exe", size: 100, contentType: "application/octet-stream" };
    expect(createSchema.safeParse(unsupported).success).toBe(false);

    const oversized = request();
    oversized.files[0].size = 6 * 1024 * 1024;
    expect(createSchema.safeParse(oversized).success).toBe(false);
  });

  it("eski para birimi alanını sözleşmede kabul etmez", () => {
    expect(createSchema.safeParse({ ...request(), currency: "TRY" }).success).toBe(false);
  });
});
