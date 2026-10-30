import { describe, expect, it } from "vitest";
import { suggestAnalysisTitle } from "./title-suggestion";

describe("suggestAnalysisTitle", () => {
  it("uzantıyı kaldırır ve alt çizgi/tireleri okunabilir boşluklara çevirir", () => {
    expect(suggestAnalysisTitle("satis_2026_q3.xlsx")).toBe("Satis 2026 Q3");
    expect(suggestAnalysisTitle("atlas-performans-2025.pdf")).toBe("Atlas Performans 2025");
    expect(suggestAnalysisTitle("musteri_geri_bildirimleri.docx")).toBe("Musteri Geri Bildirimleri");
  });

  it("fazla boşlukları ve ardışık ayırıcıları temizler", () => {
    expect(suggestAnalysisTitle("gelir___tablosu--2026..xlsx")).toBe("Gelir Tablosu 2026");
    expect(suggestAnalysisTitle("   faaliyet   raporu   .pdf")).toBe("Faaliyet Raporu");
  });

  it("dönem ve sürüm kısaltmalarını büyük harfle korur", () => {
    expect(suggestAnalysisTitle("butce_2025_h1.xlsx")).toBe("Butce 2025 H1");
    expect(suggestAnalysisTitle("pazarlama_plan_v2.docx")).toBe("Pazarlama Plan V2");
  });

  it("boş, geçersiz veya yalnızca uzantı içeren dosya adlarında boş döner", () => {
    expect(suggestAnalysisTitle("")).toBe("");
    expect(suggestAnalysisTitle(undefined)).toBe("");
    expect(suggestAnalysisTitle(null)).toBe("");
    expect(suggestAnalysisTitle(".xlsx")).toBe("");
    expect(suggestAnalysisTitle("___--..pdf")).toBe("");
  });

  it("kullanıcının kendi metin karakterlerini değiştirmez veya çevirmez", () => {
    expect(suggestAnalysisTitle("müşteri_memnuniyeti_2026.csv")).toBe("Müşteri Memnuniyeti 2026");
    expect(suggestAnalysisTitle("annual_financial_overview.pdf")).toBe("Annual Financial Overview");
  });

  it("100 karakter sınırına uyar", () => {
    const longName = "a_".repeat(60) + ".xlsx";
    const result = suggestAnalysisTitle(longName);
    expect(result.length).toBeLessThanOrEqual(100);
  });
});
