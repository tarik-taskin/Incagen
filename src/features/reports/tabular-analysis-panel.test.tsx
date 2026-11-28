import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n/runtime";
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
  user: { uid: "test-user", getIdToken: vi.fn() },
  access: "available" as import("../../../functions/src/analysis/tabular-contract").AnalysisAccess | undefined,
  start: vi.fn(),
  getResult: vi.fn(),
  getTablesOverride: null as null | (() => Promise<{ data: { tables: AnalysisTable[]; access?: import("../../../functions/src/analysis/tabular-contract").AnalysisAccess; limits: { rows: number; groups: number; attempts: number } } }>),
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
    if (args[1] === "getAnalysisResult") return mocks.getResult;
    return () => mocks.getTablesOverride ? mocks.getTablesOverride() : Promise.resolve({
      data: {
        tables: mocks.tables,
        access: mocks.access,
        limits: { rows: 5000, groups: 12, attempts: 3 },
      },
    });
  },
}));

afterEach(() => {
  setLocale("tr");
  mocks.start.mockReset();
  mocks.access = "available";
  mocks.user.getIdToken.mockReset();
  mocks.getResult.mockReset();
  mocks.getTablesOverride = null;
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
        sampleRowNumbering: "file-line",
        sampleRows: [
          { row: 2, values: ["Alfa", "10.00"] },
          { row: 3, values: ["Beta", "25.50"] },
        ],
      },
      {
        sourceId: "file-1",
        fileName: "eski.csv",
        sheet: null,
        columns: ["Kanal", "Tutar"],
        rows: 2,
        nonEmptyRows: 2,
        sampleRowNumbering: "record",
        sampleRows: [
          { row: 1, values: ["Web", "10"] },
          { row: 2, values: ["Store", "20"] },
        ],
      },
      {
        sourceId: "file-2",
        fileName: "genis.csv",
        sheet: null,
        columns: ["Bölge", "Ciro"],
        rows: 50,
        nonEmptyRows: 50,
        sampleRowNumbering: "file-line",
        sampleRows: [],
      },
    ];
    const analysis = { id: "preview-1", title: "Önizleme", business: "Test", status: "completed", createdAt: 1, updatedAt: 1 } as Analysis;
    render(<TabularAnalysisPanel analysis={analysis} />);

    // 1. Fiziksel satır numarası bilinen tabloda "Dosya satırı" başlığı görünür
    await screen.findByText("1. İncelenecek veri kaynağı");
    await user.click(screen.getByRole("combobox", { name: "Analiz tablosu" }));
    await user.click(await screen.findByRole("option", { name: "gelir.xlsx · Hizmetler" }));
    await user.click(screen.getByText("Tablo önizlemesi"));
    expect(screen.getByText(/İlk 2 satır · 2 sütun/)).toBeVisible();
    const previewTable = screen.getByRole("table", { name: "Seçili tablodan örnek satırlar" });
    expect(within(previewTable).getByRole("columnheader", { name: "Dosya satırı" })).toBeVisible();
    expect(within(previewTable).getByText("Alfa")).toBeVisible();
    expect(within(previewTable).getByText("25.50")).toBeVisible();
    expect(screen.getByText(/Yalnızca ilk 2 satır örnek olarak gösterilir/)).toBeVisible();

    // 2. Fiziksel konumu belirlenemeyen eski kayıtta açıkça "Kayıt sırası" ve açıklama gösterilir
    await user.click(screen.getByRole("combobox", { name: "Analiz tablosu" }));
    await user.click(await screen.findByRole("option", { name: "eski.csv" }));
    const legacyTable = screen.getByRole("table", { name: "Seçili tablodan örnek satırlar" });
    expect(within(legacyTable).getByRole("columnheader", { name: "Kayıt sırası" })).toBeVisible();
    expect(screen.getByText(/özgün dosya satır numarası belirlenemediği için veri kaydı sırası gösterilir/)).toBeVisible();

    // 3. Bütçe nedeniyle örnek satır dönmediğinde tablo ve sütun seçimi çalışmaya devam eder
    await user.click(screen.getByRole("combobox", { name: "Analiz tablosu" }));
    await user.click(await screen.findByRole("option", { name: "genis.csv" }));
    expect(screen.getByText(/Örnek satır önizlemesi bu kayıt için mevcut değil/)).toBeVisible();
    await user.click(screen.getByRole("combobox", { name: "Ölçüm alanı" }));
    await user.click(await screen.findByRole("option", { name: "Ciro" }));
    expect(screen.getByRole("button", { name: "Analizi oluştur" })).toBeEnabled();
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

  it("tutarsız saklanan raporda getAnalysisResult reddedildiğinde kontrollü hata ve yeniden yükleme düğmesi gösterir", async () => {
    const loadError = Object.assign(new Error("Analiz sonucu doğrulanamadı. Yeniden yükleyin."), { code: "functions/failed-precondition" });
    let rejectRetry!: (reason: Error) => void;
    const retry = new Promise<never>((_resolve, reject) => { rejectRetry = reject; });
    mocks.getResult.mockRejectedValueOnce(loadError).mockReturnValueOnce(retry);
    const baseSelection = { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum" as const, numberFormat: "plain" as const, unit: "TRY" as const };
    render(<TabularAnalysisPanel analysis={{
      id: "corrupt-1", title: "Bozuk", business: "Test", status: "completed", createdAt: 1, updatedAt: 1,
      ai: { status: "completed", attemptId: "a1", attempts: 1, maxAttempts: 3, startedAt: 1, finishedAt: 2, leaseUntil: 10, stage: "saving", locale: "tr", sourceId: "file-0", selection: baseSelection },
    } as Analysis} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Analiz sonucu doğrulanamadı. Yeniden yükleyin.");
    const button = screen.getByRole("button", { name: "Yeniden yükle" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Analiz yükleniyor…");
    expect(mocks.getResult).toHaveBeenCalledTimes(2);
    rejectRetry(loadError);
    expect(await screen.findByRole("button", { name: "Yeniden yükle" })).toBeEnabled();
  });
});

// Kayıtlı kapsam geçerli olduğundan düğmenin durumu yalnız sunucunun erişim kararına bağlıdır.
const retryable = {
  id: "test-analysis", status: "completed", ai: { status: "failed", attempts: 1,
    sourceId: "file-1", selection: { sheet: "Q1", valueColumn: 1, groupColumn: null,
      aggregation: "sum", numberFormat: "plain", unit: "USD" } },
} as Analysis;

it.each([
  ["invite-required", "Bu hesap tablo analizi betasına dahil değil."],
  ["closed", "Tablo analizi şu anda kapalı."],
  [undefined, "Tablo analizi şu anda kapalı."],
] as const)("preserves the table while blocking generation for access %s", async (access, message) => {
  mocks.access = access;
  render(<TabularAnalysisPanel analysis={retryable} />);
  const button = await screen.findByRole("button", { name: "Yeniden dene" });
  expect(button).toBeDisabled();
  expect(screen.getByText(new RegExp(message))).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Analiz tablosu" })).toHaveTextContent("satislar.xlsx");
  expect(screen.queryByText("Analiz oluşturulmaya hazır.")).not.toBeInTheDocument();
  expect(mocks.start).not.toHaveBeenCalled();
});

it("refreshes the signed-in Firebase token and reloads access without starting an analysis", async () => {
  mocks.access = "invite-required";
  let completeRefresh!: () => void;
  mocks.user.getIdToken.mockReturnValue(new Promise<void>(resolve => { completeRefresh = resolve; }));
  const user = userEvent.setup();
  render(<TabularAnalysisPanel analysis={retryable} />);
  const recheck = await screen.findByRole("button", { name: "Erişimi kontrol et" });
  await user.click(recheck);
  expect(recheck).toBeDisabled();
  expect(screen.getByText("Tablo analizi erişimi kontrol ediliyor…")).toBeVisible();
  expect(mocks.user.getIdToken).toHaveBeenCalledExactlyOnceWith(true);
  mocks.access = "available";
  completeRefresh();
  expect(await screen.findByText("Analiz oluşturulmaya hazır.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  expect(mocks.start).not.toHaveBeenCalled();
});

it("disables generation after the server denies admission with a newer access decision", async () => {
  mocks.start.mockRejectedValue({ code: "functions/permission-denied", details: { analysisAccess: "invite-required" } });
  const user = userEvent.setup();
  render(<TabularAnalysisPanel analysis={retryable} />);
  const button = await screen.findByRole("button", { name: "Yeniden dene" });
  await user.click(button);
  expect(await screen.findByText(/Bu hesap tablo analizi betasına dahil değil/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(mocks.start).toHaveBeenCalledTimes(1);
});

it("tablo yoksa erişim uyarısı göstermeden yalnız CSV/XLSX yönlendirmesini ve bağlantı hatasında tek yeniden yükleme düğmesini sunar", async () => {
  mocks.tables = [];
  mocks.access = "invite-required";
  const base = { id: "empty-1", title: "Boş", business: "Test", status: "completed", createdAt: 1, updatedAt: 1 } as Analysis;
  const view = render(<TabularAnalysisPanel analysis={base} />);
  expect(await screen.findByText(/Bu ilk analiz sürümü CSV ve XLSX tablolarını kullanır/)).toBeVisible();
  expect(screen.queryByText(/Bu hesap tablo analizi betasına dahil değil/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Erişimi kontrol et" })).not.toBeInTheDocument();
  view.unmount();

  mocks.getTablesOverride = () => Promise.reject(Object.assign(new Error("network"), { code: "functions/unavailable" }));
  render(<TabularAnalysisPanel analysis={{ ...base, id: "err-conn" }} />);
  expect(await screen.findByRole("button", { name: "Tabloları yeniden yükle" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Erişimi kontrol et" })).not.toBeInTheDocument();
});

it("erişim yenileme hatasında seçimi korur, çift tıklamayı tekilleştirir ve geciken eski katalog yanıtının yeni erişimi ezmesini önler", async () => {
  const user = userEvent.setup();
  let call = 0;
  let resolveStale!: (value: { data: { tables: AnalysisTable[]; access: "closed"; limits: { rows: number; groups: number; attempts: number } } }) => void;
  mocks.getTablesOverride = () => {
    call += 1;
    if (call === 1) {
      return Promise.resolve({ data: { tables: mocks.tables, access: "invite-required", limits: { rows: 5000, groups: 12, attempts: 3 } } });
    }
    if (call === 2) {
      return new Promise(resolve => { resolveStale = resolve; });
    }
    return Promise.resolve({ data: { tables: mocks.tables, access: "available", limits: { rows: 5000, groups: 12, attempts: 3 } } });
  };

  render(<TabularAnalysisPanel analysis={retryable} />);
  const recheck = await screen.findByRole("button", { name: "Erişimi kontrol et" });

  // 1. Token yenileme başarısızsa seçili tablo korunur ve yeniden deneme açılır.
  mocks.user.getIdToken.mockRejectedValueOnce(new Error("offline"));
  await user.click(recheck);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByText("Tablo analizi erişimi doğrulanamadı. Yeniden kontrol edin.")).toBeVisible();
  expect(screen.queryByText(/Bu hesap tablo analizi betasına dahil değil/)).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Analiz tablosu" })).toHaveTextContent("satislar.xlsx");
  expect(screen.getByRole("button", { name: "Erişimi kontrol et" })).toBeEnabled();

  // 2. Çift tıklama tek token yenilemesi üretir, analiz başlatmaz.
  let resolveToken!: () => void;
  mocks.user.getIdToken.mockImplementationOnce(() => new Promise<void>(resolve => { resolveToken = resolve; }));
  fireEvent.click(recheck);
  fireEvent.click(recheck);
  expect(mocks.user.getIdToken).toHaveBeenCalledTimes(2);
  await act(async () => { resolveToken(); });
  // İlk yenileme hâlâ beklerken üçüncü yeni yanıtı tetikleyip geciken eski yanıtın erişimi ezmediğini doğrula.
  expect(mocks.start).not.toHaveBeenCalled();
  await act(async () => {
    resolveStale({ data: { tables: mocks.tables, access: "closed", limits: { rows: 5000, groups: 12, attempts: 3 } } });
  });
});

it("alan doğrulama ve sunucu biçim hatasını aria-invalid ve aria-describedby ile ilgili alana bağlar; kullanıcı biçimi değiştirince işaret kalkar", async () => {
  const user = userEvent.setup();
  const badFormatJob = {
    ...retryable,
    id: "fmt-1",
    ai: { ...retryable.ai!, error: "invalid-number-format" as const, selection: { ...retryable.ai!.selection, numberFormat: "plain" as const } },
  } as Analysis;
  const view = render(<TabularAnalysisPanel analysis={badFormatJob} />);
  const formatTrigger = await screen.findByRole("combobox", { name: "Sayı biçimi" });
  expect(formatTrigger).toHaveAttribute("aria-invalid", "true");
  expect(formatTrigger).toHaveAttribute("aria-describedby", "ai-job-status");

  await user.click(formatTrigger);
  await user.click(await screen.findByRole("option", { name: "1.234,56" }));
  expect(formatTrigger).not.toHaveAttribute("aria-invalid");
  view.unmount();

  // Tablo seçilmediğinde tablo alanı ve kilitli gönder düğmesi aynı doğrulama açıklamasına bağlanır.
  const fresh = { id: "fresh-1", status: "completed" } as Analysis;
  render(<TabularAnalysisPanel analysis={fresh} />);
  const tableTrigger = await screen.findByRole("combobox", { name: "Analiz tablosu" });
  expect(tableTrigger).toHaveAttribute("aria-invalid", "true");
  expect(tableTrigger).toHaveAttribute("aria-describedby", "ai-validation-status");
  expect(screen.getByRole("button", { name: "Analizi oluştur" })).toHaveAttribute("aria-describedby", "ai-validation-status");
});

it("kapsam özeti uzun dosya/sayfa/alan adlarını kırpmadan ve Arapça RTL arayüzde <bdi dir='auto'> içinde gösterir", async () => {
  setLocale("ar");
  const longName = "VeryLongRegionalRevenueAndServicesWorksheet_2026_Q4.xlsx";
  const longSheet = "Consolidated_Services_Department_Summary";
  const longCol = "Gross_Recurring_Amount_USD";
  mocks.tables = [{ sourceId: "file-long", fileName: longName, sheet: longSheet, columns: ["Team", longCol], rows: 12 }];
  render(<TabularAnalysisPanel analysis={{
    id: "rtl-scope",
    status: "completed",
    ai: { status: "failed", attempts: 1, sourceId: "file-long", selection: { sheet: longSheet, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" } },
  } as Analysis} />);
  const summaryRegion = await screen.findByLabelText("ملخص النطاق");
  expect(summaryRegion).toHaveTextContent(longName);
  expect(summaryRegion).toHaveTextContent(longSheet);
  expect(summaryRegion).toHaveTextContent(longCol);
  const bdis = summaryRegion.querySelectorAll("bdi[dir='auto']");
  expect(bdis.length).toBeGreaterThanOrEqual(4);
  summaryRegion.querySelectorAll("strong").forEach(node => {
    expect(node.className).not.toContain("truncate");
  });
});

it("katalog yenilendiğinde şeması değişen tabloda geçersiz sütunu temizler, aynı kalan geçerli seçimi korur", async () => {
  const user = userEvent.setup();
  mocks.access = "invite-required";
  mocks.tables = [{ sourceId: "file-1", fileName: "satislar.xlsx", sheet: "Q1", columns: ["Kategori", "Tutar", "Adet"], rows: 20 }];
  render(<TabularAnalysisPanel analysis={retryable} />);
  const recheck = await screen.findByRole("button", { name: "Erişimi kontrol et" });

  // Şema değişti: 1. sütun artık "Tutar" değil "Notlar".
  mocks.user.getIdToken.mockResolvedValueOnce(undefined);
  mocks.access = "available";
  mocks.tables = [{ sourceId: "file-1", fileName: "satislar.xlsx", sheet: "Q1", columns: ["Kategori", "Notlar"], rows: 20 }];
  await user.click(recheck);
  expect(await screen.findByText("Hesaplanacak ölçüm alanını seçin.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeDisabled();
});
