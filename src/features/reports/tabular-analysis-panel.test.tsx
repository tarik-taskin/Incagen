import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TabularAnalysisPanel } from "./tabular-analysis-panel";
import type { Analysis } from "../../../functions/src/contracts";
import type { AnalysisTable } from "../../../functions/src/analysis/tabular-contract";

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
  ] as AnalysisTable[],
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
  mocks.tables = [
    { sourceId: "file-1", fileName: "satislar.xlsx", sheet: "Q1", columns: ["Kategori", "Tutar", "Adet"], rows: 150 },
    { sourceId: "file-2", fileName: "masraflar.csv", sheet: null, columns: ["Departman", "Harcama"], rows: 40 },
  ];
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

  it("hesaplamadan önce seçili tablonun sütunlarını ve küçük satır örneğini iş başlatmadan gösterir", async () => {
    const user = userEvent.setup();
    mocks.tables = [
      {
        sourceId: "file-0",
        fileName: "gelir.xlsx",
        sheet: "Hizmetler",
        columns: ["Ekip", "Gelir"],
        rows: 12,
        nonEmptyRows: 12,
        sampleRows: [
          { row: 2, values: ["Alfa", "10.00"] },
          { row: 3, values: ["Beta", "25.50"] },
        ],
      },
    ];
    const analysis = { id: "preview-1", title: "Önizleme", business: "Test", status: "completed", createdAt: 1, updatedAt: 1 } as Analysis;
    render(<TabularAnalysisPanel analysis={analysis} />);

    const summaryToggle = await screen.findByText("Tablo önizlemesi");
    await user.click(summaryToggle);
    expect(screen.getByText(/İlk 2 satır · 2 sütun/)).toBeVisible();
    const previewTable = screen.getByRole("table", { name: "Seçili tablodan örnek satırlar" });
    expect(within(previewTable).getByText("Alfa")).toBeVisible();
    expect(within(previewTable).getByText("25.50")).toBeVisible();
    expect(screen.getByText(/Yalnızca ilk 2 satır örnek olarak gösterilir/)).toBeVisible();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("aynı adlı dosyaları ayırt eder, tablo değişince geçersiz sütunu temizler, sorunlu tabloyu açıklar ve kayıt sayımı ayarını tutarlı gönderir", async () => {
    const user = userEvent.setup();
    mocks.tables = [
      { sourceId: "file-0", fileName: "rapor.csv", sheet: null, columns: ["Kanal", "Gelir"], rows: 10, nonEmptyRows: 10 },
      { sourceId: "file-1", fileName: "rapor.csv", sheet: null, columns: ["Bölge", "Maliyet"], rows: 8, nonEmptyRows: 8 },
      { sourceId: "file-2", fileName: "bos.csv", sheet: null, columns: ["A"], rows: 0, nonEmptyRows: 0, unavailableReason: "empty-table" },
      { sourceId: "file-3", fileName: "bozuk.xlsx", sheet: "Sayfa1", columns: [], rows: 0, unavailableReason: "unreadable-table" },
    ];
    const analysis = { id: "stable-1", title: "Kararlılık", business: "Test", status: "completed", createdAt: 1, updatedAt: 1 } as Analysis;
    render(<TabularAnalysisPanel analysis={analysis} />);

    await screen.findByText("1. İncelenecek veri kaynağı");
    await user.click(screen.getByRole("combobox", { name: "Analiz tablosu" }));
    expect(await screen.findByRole("option", { name: "rapor.csv (Belge 1)" })).toBeVisible();
    expect(screen.getByRole("option", { name: "rapor.csv (Belge 2)" })).toBeVisible();
    await user.click(screen.getByRole("option", { name: "rapor.csv (Belge 1)" }));

    await user.click(screen.getByRole("combobox", { name: "Ölçüm alanı" }));
    await user.click(await screen.findByRole("option", { name: "Gelir" }));
    await user.click(screen.getByRole("combobox", { name: "Sayı biçimi" }));
    await user.click(await screen.findByRole("option", { name: "1.234,56" }));
    expect(screen.getByRole("button", { name: "Analizi oluştur" })).toBeEnabled();

    // Sütunları farklı olan ikinci aynı adlı dosyaya geçince eski ölçüm alanı temizlenir.
    await user.click(screen.getByRole("combobox", { name: "Analiz tablosu" }));
    await user.click(await screen.findByRole("option", { name: "rapor.csv (Belge 2)" }));
    expect(screen.getByText("Hesaplanacak ölçüm alanını seçin.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Analizi oluştur" })).toBeDisabled();

    // Kayıt sayısı seçilince kapalı format/birim kontrolleriyle gönderilen ayar tutarlı olur.
    await user.click(screen.getByRole("combobox", { name: "Hesaplama" }));
    await user.click(await screen.findByRole("option", { name: "Kayıt sayısı" }));
    await user.click(screen.getByRole("button", { name: "Analizi oluştur" }));
    expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: "file-1",
      selection: { sheet: null, valueColumn: null, groupColumn: null, aggregation: "count", numberFormat: "plain", unit: "count" },
    }));

    // Boş ve okunamayan tablolarda gerçek neden görünür ve analiz başlatma kilitlenir.
    await user.click(screen.getByRole("combobox", { name: "Analiz tablosu" }));
    await user.click(await screen.findByRole("option", { name: "bos.csv" }));
    expect(screen.getByText("Bu tabloda hesaplanabilecek veri satırı yok. Boş olmayan bir tablo seçin.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Analizi oluştur" })).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Analiz tablosu" }));
    await user.click(await screen.findByRole("option", { name: "bozuk.xlsx · Sayfa1" }));
    expect(screen.getByText("Bu tablonun sütun yapısı tutarsız veya okunamadı. Başka bir tablo seçin veya belgeyi düzenleyip yeniden yükleyin.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Analizi oluştur" })).toBeDisabled();
  });

  it("Python sabit hata kodları için uygulanabilir yönlendirme ve bilinmeyen kodda genel açıklama gösterir", async () => {
    mocks.tables = [{ sourceId: "file-0", fileName: "satis.csv", sheet: null, columns: ["Kanal", "Tutar"], rows: 5, nonEmptyRows: 5 }];
    const baseSelection = { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum" as const, numberFormat: "plain" as const, unit: "TRY" as const };
    const { rerender } = render(<TabularAnalysisPanel analysis={{
      id: "err-1", title: "Hata", business: "Test", status: "completed", createdAt: 1, updatedAt: 1,
      ai: { status: "failed", attemptId: "a1", attempts: 1, maxAttempts: 3, startedAt: 1, leaseUntil: 1, stage: "calculating", locale: "tr", sourceId: "file-0", selection: baseSelection, error: "currency-precision" },
    } as Analysis} />);
    expect(await screen.findByRole("status")).toHaveTextContent(/ikiden fazla ondalık basamaklı hücreler/);
    expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();

    rerender(<TabularAnalysisPanel analysis={{
      id: "err-1", title: "Hata", business: "Test", status: "completed", createdAt: 1, updatedAt: 1,
      ai: { status: "failed", attemptId: "a2", attempts: 1, maxAttempts: 3, startedAt: 1, leaseUntil: 1, stage: "calculating", locale: "tr", sourceId: "file-0", selection: baseSelection, error: "group-limit" },
    } as Analysis} />);
    expect(await screen.findByRole("status")).toHaveTextContent(/en fazla 12 benzersiz grup sınırını aşıyor/);

    rerender(<TabularAnalysisPanel analysis={{
      id: "err-1", title: "Hata", business: "Test", status: "completed", createdAt: 1, updatedAt: 1,
      ai: { status: "failed", attemptId: "a3", attempts: 1, maxAttempts: 3, startedAt: 1, leaseUntil: 1, stage: "calculating", locale: "tr", sourceId: "file-0", selection: baseSelection, error: "legacy-unknown-code" as never },
    } as Analysis} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Bu işlemden henüz sonuç alınamadı. Seçiminizi kontrol edip yeniden deneyebilirsiniz.");
  });
});
