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

  it("çalıştırılabilir dosyayı ve toplam boyut ihlalini reddeder", () => {
    const unsupported = request();
    unsupported.files[0] = { name: "program.exe", size: 100, contentType: "application/octet-stream" };
    expect(createSchema.safeParse(unsupported).success).toBe(false);

    const oversized = request();
    oversized.files[0].size = 25 * 1024 * 1024;
    expect(createSchema.safeParse(oversized).success).toBe(false);
  });

  it("Free 25 MB sınırını uygular; Premium 50 MB kapasitesini ayrı tutar", () => {
    const full = request();
    full.files = [{ name: "tek-belge.pdf", size: 25 * 1024 * 1024, contentType: "application/pdf" }];
    expect(createSchema.safeParse(full).success).toBe(true);
    expect(createSchema.safeParse({ ...full, files: [...full.files, { name: "fazla.pdf", size: 1, contentType: "application/pdf" }] }).success).toBe(false);
    expect(LIMITS).toEqual({ files: 5, totalBytes: 25 * 1024 * 1024, daily: 2 });
    expect(PREMIUM_LIMITS).toEqual({ files: 10, totalBytes: 50 * 1024 * 1024, daily: 5 });
  });

  it("eski para birimi alanını sözleşmede kabul etmez", () => {
    expect(createSchema.safeParse({ ...request(), currency: "TRY" }).success).toBe(false);
  });
});
