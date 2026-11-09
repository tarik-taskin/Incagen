import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPage } from "./history-page";
import type { Analysis } from "../../functions/src/contracts";
import type { AiJob } from "../../functions/src/analysis/tabular-contract";

const mocks = vi.hoisted(() => ({
  rows: [] as Analysis[],
  loading: false,
  error: null as string | null,
}));

vi.mock("../hooks/use-analyses", () => ({
  useAnalyses: () => ({
    rows: mocks.rows,
    loading: mocks.loading,
    error: mocks.error,
  }),
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
        <HistoryPage />
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
        <HistoryPage />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Analiz deneme sınırı aşıldı").length).toBeGreaterThanOrEqual(1);
  });

  it("uzun boş beklemeden sonra gelen snapshot lease zamanlayıcısını geciktirmez", () => {
    mocks.rows = [];
    const view = render(<MemoryRouter initialEntries={["/app/history?status=active"]}><HistoryPage /></MemoryRouter>);
    vi.setSystemTime(13_000);
    mocks.rows = [{ id: "new", title: "Yeni iş", business: "Sentetik", status: "completed", createdAt: 1_000, updatedAt: 13_000,
      ai: { status: "running", attempts: 1, maxAttempts: 3, leaseUntil: 14_000 } as AiJob }];
    view.rerender(<MemoryRouter initialEntries={["/app/history?status=active"]}><HistoryPage /></MemoryRouter>);
    expect(screen.getByText("Yeni iş")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1_100); });
    expect(screen.queryByText("Yeni iş")).not.toBeInTheDocument();
    expect(screen.queryByText("Analiz hazırlanıyor")).not.toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Arşiv özeti" });
    expect(summary.children[2]).toHaveTextContent("Devam ediyor0");
    expect(summary.children[3]).toHaveTextContent("Dikkat istiyor1");
  });
});
