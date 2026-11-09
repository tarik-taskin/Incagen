import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TabularAnalysisPanel } from "./tabular-analysis-panel";
import type { Analysis } from "../../../functions/src/contracts";

// jsdom'da Radix Select bileşenlerinin ihtiyaç duyduğu pointer capture ve scroll işlevlerini tanımla
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.setPointerCapture = () => {};
  window.HTMLElement.prototype.releasePointerCapture = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
});

const mocks = vi.hoisted(() => ({
  user: { uid: "test-user" },
  start: vi.fn(),
  tables: [
    { sourceId: "file-1", fileName: "satislar.xlsx", sheet: "Q1", columns: ["Kategori", "Tutar", "Adet"], rows: 150 },
    { sourceId: "file-2", fileName: "masraflar.csv", sheet: null, columns: ["Departman", "Harcama"], rows: 40 },
  ],
}));

vi.mock("../../lib/auth-context", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../../lib/firebase", () => ({ getServices: () => ({ functions: {} }) }));
vi.mock("firebase/functions", () => ({
  httpsCallable: (...args: unknown[]) => {
    if (args[1] === "startAnalysis") return mocks.start;
    return async () => ({
      data: {
        tables: mocks.tables,
        limits: { rows: 5000, groups: 12, attempts: 3 },
      },
    });
  },
}));

afterEach(() => {
  mocks.start.mockReset();
});

describe("TabularAnalysisPanel - Görev 2 kapsam ve düzen kontrolleri", () => {
  it("üç mantıksal bölümü ve dinamik kapsam özetini gösterir", async () => {
    const analysis = {
      id: "test-analysis",
      title: "Test",
      business: "Test Co",
      status: "completed",
      createdAt: 1000,
      updatedAt: 1000,
      ai: undefined,
    } as Analysis;
    render(<TabularAnalysisPanel analysis={analysis} />);

    // Üç mantıksal bölüm başlığı görünür
    expect(await screen.findByText("1. İncelenecek veri kaynağı")).toBeInTheDocument();
    expect(screen.getByText("2. Hesaplama yöntemi ve ölçüm")).toBeInTheDocument();
    expect(screen.getByText("3. Gruplama ve gösterim biçimi")).toBeInTheDocument();

    // Henüz tablo seçilmediğinde yönlendirme mesajı çıkar
    expect(screen.getByText("Devam etmek için bir tablo seçin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analizi oluştur" })).toBeDisabled();
  });

  it("sayım seçildiğinde ölçüm alanını devre dışı bırakır ve kapsam özetine tüm kayıtları yansıtır", async () => {
    const user = userEvent.setup();
    const analysis = {
      id: "test-analysis-2",
      title: "Test 2",
      business: "Test Co",
      status: "completed",
      createdAt: 1000,
      updatedAt: 1000,
      ai: undefined,
    } as Analysis;
    render(<TabularAnalysisPanel analysis={analysis} />);

    // Tabloyu seçelim
    await screen.findByText("1. İncelenecek veri kaynağı");
    const tableTrigger = screen.getByRole("combobox", { name: "Analiz tablosu" });
    await user.click(tableTrigger);
    const option = await screen.findByRole("option", { name: /satislar\.xlsx/i });
    await user.click(option);

    // Tablo seçildi, satır/alan bilgisi görünür
    expect(screen.getByText(/150 kayıt · 3 alan/i)).toBeInTheDocument();

    // Kapsam özeti kartı görünür (hem tetikleyicide hem özet kartında tablo adı geçer)
    expect(screen.getByLabelText("Kapsam özeti")).toBeInTheDocument();
    expect(screen.getAllByText(/satislar\.xlsx/i).length).toBeGreaterThanOrEqual(2);

    // Kapsam özeti etiketleri WCAG AA kontrastı için text-foreground/85 sınıfına sahiptir
    const sourceLabel = screen.getByText("Kaynak:");
    expect(sourceLabel).toHaveClass("text-foreground/85");
    expect(screen.getByText("Hesap:")).toHaveClass("text-foreground/85");
    expect(screen.getByText("Gruplama:")).toHaveClass("text-foreground/85");
    expect(screen.getByText("Gösterim:")).toHaveClass("text-foreground/85");

    // Hesaplama yöntemini "Kayıt sayısı" olarak değiştirelim
    const aggTrigger = screen.getByRole("combobox", { name: "Hesaplama" });
    await user.click(aggTrigger);
    const countOption = await screen.findByRole("option", { name: "Kayıt sayısı" });
    await user.click(countOption);

    // Kayıt sayısı seçildiğinde açıklama görünür ve buton aktif olur
    expect(screen.getByText(/Kayıt sayısı seçildiğinde boş olmayan tüm satırlar sayılır/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ölçüm alanı" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analizi oluştur" })).toBeEnabled();
    expect(screen.getByText("Analiz oluşturulmaya hazır.")).toBeInTheDocument();
    // Kapsam özetinde "Dolu satırlar" yazar
    expect(screen.getByText(/Dolu satırlar/i)).toBeInTheDocument();
  });

  it("ölçüm alanı eksik olduğunda uyarı mesajı verir ve butonu kilitler", async () => {
    const user = userEvent.setup();
    const analysis = {
      id: "test-analysis-3",
      title: "Test 3",
      business: "Test Co",
      status: "completed",
      createdAt: 1000,
      updatedAt: 1000,
      ai: undefined,
    } as Analysis;
    render(<TabularAnalysisPanel analysis={analysis} />);

    // Masraflar tablosunu seçelim
    await screen.findByText("1. İncelenecek veri kaynağı");
    const tableTrigger = screen.getByRole("combobox", { name: "Analiz tablosu" });
    await user.click(tableTrigger);
    const option = await screen.findByRole("option", { name: /masraflar\.csv/i });
    await user.click(option);

    // Varsayılan Toplam yönteminde ölçüm seçilmediği için uyarı çıkar
    expect(screen.getByText("Hesaplanacak ölçüm alanını seçin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analizi oluştur" })).toBeDisabled();
  });
});
