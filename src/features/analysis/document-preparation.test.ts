import { describe, expect, it } from "vitest";
import { createSchema, getQuotaDay, hasSupportedExtension, LIMITS, PREMIUM_LIMITS } from "../../../functions/src/contracts";

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
    for (const deferred of ["eski.xls", "eski.doc", "eski.ppt", "tablo.ods", "tarama.heic", "vektor.svg"]) {
      expect(hasSupportedExtension(deferred)).toBe(false);
    }
  });

  it("çalıştırılabilir dosyayı ve dosya boyutu sınırı ihlalini reddeder", () => {
    const unsupported = request();
    unsupported.files[0] = { name: "program.exe", size: 100, contentType: "application/octet-stream" };
    expect(createSchema.safeParse(unsupported).success).toBe(false);

    const oversized = request();
    oversized.files[0].size = 6 * 1024 * 1024;
    expect(createSchema.safeParse(oversized).success).toBe(false);
  });

  it("Free 30 MB sınırını uygular ve Premium 50 MB'ı ayrı plan sınırı olarak tutar", () => {
    const full = request();
    full.files = Array.from({ length: 6 }, (_, index) => ({ name: `belge-${index}.pdf`, size: 5 * 1024 * 1024, contentType: "application/pdf" }));
    expect(createSchema.safeParse(full).success).toBe(true);
    expect(createSchema.safeParse({ ...full, files: [...full.files, { name: "fazla.pdf", size: 1, contentType: "application/pdf" }] }).success).toBe(false);
    expect(LIMITS.totalBytes).toBe(30 * 1024 * 1024);
    expect(PREMIUM_LIMITS.totalBytes).toBe(50 * 1024 * 1024);
    expect(PREMIUM_LIMITS.fileBytes).toBe(LIMITS.fileBytes);
  });

  it("eski para birimi alanını sözleşmede kabul etmez", () => {
    expect(createSchema.safeParse({ ...request(), currency: "TRY" }).success).toBe(false);
  });
});
