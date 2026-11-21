import { WorkspaceDeletionProvider } from "../components/workspace-deletion-provider";
import { WorkspaceDeletionStatus } from "../components/workspace-deletion-status";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPage } from "./history-page";
import type { Analysis } from "../../functions/src/contracts";
import type { AiJob } from "../../functions/src/analysis/tabular-contract";

const mocks = vi.hoisted(() => ({
  rows: [] as Analysis[],
  loading: false,
  error: null as string | null,
  call: vi.fn(),
}));

vi.mock("../hooks/use-analyses", () => ({
  useAnalyses: () => ({
    rows: mocks.rows,
    loading: mocks.loading,
    error: mocks.error,
  }),
}));

vi.mock("../lib/firebase", () => ({
  getServices: () => ({ functions: {}, auth: { currentUser: { uid: "test-user" } } }),
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: () => mocks.call,
}));

vi.mock("../lib/deployment-mode", () => ({ authOnlyPreview: false }));

describe("HistoryPage - reaktif zaman aşımı ve yaşam döngüsü kabulü", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000); // Başlangıç saati: 5000 ms
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("açık geçmiş ekranında snapshot gelmeden lease dolduğunda etiket ve sayaçlar birlikte güncellenir", () => {
    const runningJob: AiJob = {
      status: "running",
      leaseUntil: 10_000,
      attempts: 1,
      maxAttempts: 3,
      attemptId: "att-1",
      startedAt: 1_000,
      stage: "calculating",
      locale: "tr",
      sourceId: "src-1",
      selection: {
        sheet: null,
        valueColumn: 1,
        groupColumn: null,
        aggregation: "sum",
        numberFormat: "tr",
        unit: "TRY",
      },
    };

    // 5000 ms'de 10000 ms'ye kadar geçerli lease'e sahip bir iş
    const runningAnalysis: Analysis = {
      id: "a-1",
      title: "Satış Özeti",
      business: "Test Ltd",
      status: "completed",
      createdAt: 1_000,
      updatedAt: 1_000,
      ai: runningJob,
    };

    mocks.rows = [runningAnalysis];

    render(
      <MemoryRouter initialEntries={["/app/history"]}>
        <WorkspaceDeletionProvider uid="test-user"><HistoryPage /></WorkspaceDeletionProvider>
      </MemoryRouter>
    );

    // 1. Başlangıçta: "Analiz hazırlanıyor" ve "Devam ediyor" sayacı 1
    expect(screen.getAllByText("Analiz hazırlanıyor").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Devam ediyor")).toBeInTheDocument();

    // 2. Zamanı 5100 ms ileri saralım (artık Date.now() = 10100 ms > leaseUntil 10000 ms)
    act(() => {
      vi.advanceTimersByTime(5_100);
    });

    // 3. Yeni Firestore snapshot'ı gelmediği halde lease dolduğu için etiket ve sayaç güncellenmeli:
    expect(screen.getAllByText("Analiz yeniden denenebilir").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Analiz hazırlanıyor")).not.toBeInTheDocument();
  });

  it("deneme hakkı tükenmiş olan işlerde doğru durum etiketi gösterilir", () => {
    const exhaustedJob: AiJob = {
      status: "failed",
      attempts: 3,
      maxAttempts: 3,
      attemptId: "att-2",
      startedAt: 1_000,
      leaseUntil: 1_000,
      stage: "calculating",
      locale: "tr",
      sourceId: "src-2",
      selection: {
        sheet: null,
        valueColumn: 1,
        groupColumn: null,
        aggregation: "sum",
        numberFormat: "tr",
        unit: "TRY",
      },
    };

    const exhaustedAnalysis: Analysis = {
      id: "a-2",
      title: "Mali Tablo",
      business: "Finans AŞ",
      status: "completed",
      createdAt: 1_000,
      updatedAt: 1_000,
      ai: exhaustedJob,
    };

    mocks.rows = [exhaustedAnalysis];

    render(
      <MemoryRouter initialEntries={["/app/history"]}>
        <WorkspaceDeletionProvider uid="test-user"><HistoryPage /></WorkspaceDeletionProvider>
      </MemoryRouter>
    );

    expect(screen.getAllByText("Analiz deneme sınırı aşıldı").length).toBeGreaterThanOrEqual(1);
  });

  it("uzun boş beklemeden sonra gelen snapshot lease zamanlayıcısını geciktirmez", () => {
    mocks.rows = [];
    const view = render(<MemoryRouter initialEntries={["/app/history?status=active"]}><WorkspaceDeletionProvider uid="test-user"><HistoryPage /></WorkspaceDeletionProvider></MemoryRouter>);
    vi.setSystemTime(13_000);
    mocks.rows = [{ id: "new", title: "Yeni iş", business: "Sentetik", status: "completed", createdAt: 1_000, updatedAt: 13_000,
      ai: { status: "running", attempts: 1, maxAttempts: 3, leaseUntil: 14_000 } as AiJob }];
    view.rerender(<MemoryRouter initialEntries={["/app/history?status=active"]}><WorkspaceDeletionProvider uid="test-user"><HistoryPage /></WorkspaceDeletionProvider></MemoryRouter>);
    expect(screen.getByText("Yeni iş")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1_100); });
    expect(screen.queryByText("Yeni iş")).not.toBeInTheDocument();
    expect(screen.queryByText("Analiz hazırlanıyor")).not.toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Arşiv özeti" });
    expect(summary.children[2]).toHaveTextContent("Devam ediyor0");
    expect(summary.children[3]).toHaveTextContent("Dikkat istiyor1");
  });
  it.each([7, 30, 90])("%i günlük filtre açıkken sınırı geçen satır snapshot olmadan görünümden çıkar", days => {
    const windowMs = days * 86_400_000;
    vi.setSystemTime(windowMs + 1_000);
    mocks.rows = [{ id: "expiring", title: "Süreli kayıt", business: "Sentetik", status: "completed", createdAt: 2_000, updatedAt: 2_000 }];
    const view = render(<MemoryRouter initialEntries={[`/app/history?period=${days}d`]}><WorkspaceDeletionProvider uid="test-user"><HistoryPage /></WorkspaceDeletionProvider></MemoryRouter>);
    expect(screen.getByText("Süreli kayıt")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByText("Süreli kayıt")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(51); });
    expect(screen.queryByText("Süreli kayıt")).not.toBeInTheDocument();
    // Tarih filtresi kaydı silmez; genel arşiv sayacı aynı kalır.
    expect(screen.getByRole("region", { name: "Arşiv özeti" }).children[0]).toHaveTextContent("1");
    view.unmount();
  });

});

describe("HistoryPage - analiz silme onay, ilerleme ve kısmi hata tekrarı", () => {
  beforeEach(() => {
    mocks.call.mockReset();
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });

  function deferred() {
    let resolve!: (value: { data: { deleted: boolean } }) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<{ data: { deleted: boolean } }>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  }

  it("toplu silmede Firestore kayıtları erken kalksa da pencereyi açık tutar, ilerlemeyi sayar ve kısmi hatada yalnız başarısızı yeniden dener", async () => {
    const user = userEvent.setup();
    mocks.rows = [
      { id: "h1", title: "Birinci Analiz", business: "B1", status: "completed", createdAt: 3_000, updatedAt: 3_000 },
      { id: "h2", title: "Sorunlu Analiz", business: "B2", status: "completed", createdAt: 2_000, updatedAt: 2_000 },
      { id: "h3", title: "Üçüncü Analiz", business: "B3", status: "completed", createdAt: 1_000, updatedAt: 1_000 },
    ];

    const view = render(
      <MemoryRouter initialEntries={["/app/history"]}>
        <WorkspaceDeletionProvider uid="test-user">
          <WorkspaceDeletionStatus />
          <HistoryPage />
        </WorkspaceDeletionProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Seç ve sil" }));
    await user.click(screen.getByRole("button", { name: "Görünenleri seç" }));
    await user.click(screen.getByRole("button", { name: "Seçilenleri sil" }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: "3 analizi silmek istiyor musunuz?" })).toBeVisible();

    const p1 = deferred();
    const p2 = deferred();
    const p3 = deferred();
    mocks.call
      .mockReturnValueOnce(p1.promise)
      .mockReturnValueOnce(p2.promise)
      .mockReturnValueOnce(p3.promise);

    await user.click(within(dialog).getByRole("button", { name: "3 analizi sil" }));
    expect(within(dialog).getByRole("button", { name: "Siliniyor… 1/3" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Vazgeç" })).toBeDisabled();

    // Silme sürerken arka plan seçim kutuları da kilitlidir ve Escape kapatmaz.
    expect(screen.getByRole("checkbox", { name: "Birinci Analiz seç" })).toBeDisabled();
    const cancelEvent = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(dialog).toBeVisible();

    // Firestore ilk kaydı erken silse bile pencere kapanmaz; sıradaki adıma geçer.
    mocks.rows = mocks.rows.slice(1);
    view.rerender(
      <MemoryRouter initialEntries={["/app/history"]}>
        <WorkspaceDeletionProvider uid="test-user">
          <WorkspaceDeletionStatus />
          <HistoryPage />
        </WorkspaceDeletionProvider>
      </MemoryRouter>,
    );
    await act(async () => { p1.resolve({ data: { deleted: true } }); });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Siliniyor… 2/3" })).toBeDisabled();

    await act(async () => { p2.reject({ code: "functions/unavailable" }); });
    expect(within(dialog).getByRole("button", { name: "Siliniyor… 3/3" })).toBeDisabled();

    mocks.rows = [mocks.rows[0]];
    view.rerender(
      <MemoryRouter initialEntries={["/app/history"]}>
        <WorkspaceDeletionProvider uid="test-user">
          <WorkspaceDeletionStatus />
          <HistoryPage />
        </WorkspaceDeletionProvider>
      </MemoryRouter>,
    );
    await act(async () => { p3.resolve({ data: { deleted: true } }); });

    // Kısmi hatada pencere kapanmaz; yalnız Sorunlu Analiz yeniden denenebilir.
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "1 analiz silinemedi." })).toBeVisible();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Sorunlu Analiz");
    expect(screen.getByRole("checkbox", { name: "Sorunlu Analiz seç" })).toBeChecked();

    mocks.call.mockClear();
    const retry = deferred();
    mocks.call.mockReturnValueOnce(retry.promise);
    await user.click(within(dialog).getByRole("button", { name: "Yeniden dene" }));

    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.call).toHaveBeenCalledWith({ id: "h2" });
    expect(within(dialog).getByRole("button", { name: "Siliniyor…" })).toBeDisabled();

    mocks.rows = [];
    await act(async () => { retry.resolve({ data: { deleted: true } }); });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 analiz ve kaynak belgeleri silindi.");
  });

  it("dinleyici yükleme veya hata durumuna geçtiğinde silme diyaloğunu yeniden bağlamaz", async () => {
    mocks.loading = false;
    mocks.error = null;
    const user = userEvent.setup();
    mocks.rows = [
      { id: "h1", title: "Birinci", business: "B1", status: "completed", createdAt: 2_000, updatedAt: 2_000 },
      { id: "h2", title: "İkinci", business: "B2", status: "completed", createdAt: 1_000, updatedAt: 1_000 },
    ];

    const view = render(
      <MemoryRouter initialEntries={["/app/history"]}>
        <WorkspaceDeletionProvider uid="test-user">
          <WorkspaceDeletionStatus />
          <HistoryPage />
        </WorkspaceDeletionProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Seç ve sil" }));
    await user.click(screen.getByRole("button", { name: "Görünenleri seç" }));
    await user.click(screen.getByRole("button", { name: "Seçilenleri sil" }));

    const initialDialog = screen.getByRole("alertdialog");
    const p1 = deferred();
    const p2 = deferred();
    mocks.call.mockReturnValueOnce(p1.promise).mockReturnValueOnce(p2.promise);

    await user.click(within(initialDialog).getByRole("button", { name: "2 analizi sil" }));
    expect(within(initialDialog).getByRole("button", { name: "Siliniyor… 1/2" })).toBeDisabled();

    mocks.loading = true;
    view.rerender(
      <MemoryRouter initialEntries={["/app/history"]}>
        <WorkspaceDeletionProvider uid="test-user">
          <WorkspaceDeletionStatus />
          <HistoryPage />
        </WorkspaceDeletionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alertdialog")).toBe(initialDialog);
    expect(within(initialDialog).getByRole("button", { name: "Siliniyor… 1/2" })).toBeDisabled();

    mocks.loading = false;
    mocks.error = "Geçmiş okunamıyor.";
    view.rerender(
      <MemoryRouter initialEntries={["/app/history"]}>
        <WorkspaceDeletionProvider uid="test-user">
          <WorkspaceDeletionStatus />
          <HistoryPage />
        </WorkspaceDeletionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alertdialog")).toBe(initialDialog);

    await act(async () => { p1.resolve({ data: { deleted: true } }); });
    expect(within(initialDialog).getByRole("button", { name: "Siliniyor… 2/2" })).toBeDisabled();
    await act(async () => { p2.resolve({ data: { deleted: true } }); });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 analiz ve kaynak belgeleri silindi.");
  });

  it("kart menüsü ve toplu silmede kapatma sonrası odağı açıcıya veya yedek hedefe döndürür", async () => {
    mocks.loading = false;
    mocks.error = null;
    const user = userEvent.setup();
    mocks.rows = [
      { id: "h1", title: "Birinci", business: "B1", status: "completed", createdAt: 2_000, updatedAt: 2_000 },
    ];

    const view = render(
      <MemoryRouter initialEntries={["/app/history"]}>
        <WorkspaceDeletionProvider uid="test-user">
          <HistoryPage />
        </WorkspaceDeletionProvider>
      </MemoryRouter>,
    );

    const cardTrigger = screen.getByRole("button", { name: "Birinci için diğer işlemler" });
    await user.click(cardTrigger);
    await user.click(screen.getByRole("button", { name: "Analizi sil" }));
    fireEvent(screen.getByRole("alertdialog"), new Event("cancel", { cancelable: true }));
    expect(cardTrigger).toHaveFocus();

    // Kart silme sırasında kayıt listeden silinirse Kapat sonrasında anlamlı yedek hedefe odaklanır.
    const failed = deferred();
    mocks.call.mockReturnValueOnce(failed.promise);
    await user.click(cardTrigger);
    await user.click(screen.getByRole("button", { name: "Analizi sil" }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Analizi sil" }));
    await act(async () => { failed.reject({ code: "functions/unavailable" }); });

    mocks.rows = [];
    view.rerender(
      <MemoryRouter initialEntries={["/app/history"]}>
        <WorkspaceDeletionProvider uid="test-user">
          <HistoryPage />
        </WorkspaceDeletionProvider>
      </MemoryRouter>,
    );
    await user.click(within(dialog).getByRole("button", { name: "Kapat" }));
    expect(screen.getByRole("link", { name: "İlk analizini hazırla" })).toHaveFocus();
  });

  it("kart ve menüden analiz açarken mevcut arama ve filtre parametrelerini taşır", async () => {
    mocks.loading = false;
    mocks.error = null;
    const user = userEvent.setup();
    mocks.rows = [
      { id: "h1", title: "Birinci Analiz", business: "B1", status: "completed", createdAt: Date.now() - 1000, updatedAt: Date.now() },
    ];

    render(
      <MemoryRouter initialEntries={["/app/history?q=Birinci&status=completed&period=30d&sort=title&evil=drop"]}>
        <WorkspaceDeletionProvider uid="test-user">
          <HistoryPage />
        </WorkspaceDeletionProvider>
      </MemoryRouter>,
    );

    const expectedHref = "/app/analyses/h1?q=Birinci&status=completed&period=30d&sort=title";
    expect(screen.getByRole("link", { name: /Birinci Analiz/ })).toHaveAttribute("href", expectedHref);

    await user.click(screen.getByRole("button", { name: "Birinci Analiz için diğer işlemler" }));
    expect(screen.getByRole("link", { name: "Analizi aç" })).toHaveAttribute("href", expectedHref);
  });
});
