import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TabularAnalysisPanel } from "./tabular-analysis-panel";
import type { Analysis } from "../../../functions/src/contracts";

const mocks = vi.hoisted(() => ({ user: { uid: "synthetic" }, calls: vi.fn(), start: vi.fn(), result: vi.fn() }));
vi.mock("../../lib/auth-context", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../../lib/firebase", () => ({ getServices: () => ({ functions: {} }) }));
vi.mock("./live-analysis-report", () => ({ default: ({ artifact }: { artifact: { result: { objective: string } } }) => <p>{artifact.result.objective}</p> }));
vi.mock("firebase/functions", () => ({ httpsCallable: (...args: unknown[]) => {
  mocks.calls(args[1]);
  if (args[1] === "startAnalysis") return mocks.start;
  if (args[1] === "getAnalysisResult") return mocks.result;
  return async () => ({ data: { access: "available", tables: [{ sourceId: "file-0", fileName: "test.csv", sheet: null, columns: ["Team", "Amount"], rows: 2 }], limits: { rows: 5000, groups: 12, attempts: 3 } } });
} }));
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); mocks.calls.mockClear(); mocks.start.mockReset(); mocks.result.mockReset(); });

it("enables manual retry after the stored server deadline without making an automatic generation call", async () => {
  vi.useFakeTimers();
  const analysis = { id: "synthetic", ai: { status: "failed", attempts: 1, maxAttempts: 3, error: "provider-busy", retryAfter: Date.now() + 30000,
    sourceId: "file-0", selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" } } } as Analysis;
  await act(async () => { render(<TabularAnalysisPanel analysis={analysis} />); });
  expect(screen.getByRole("button", { name: "Kısa bir süre bekleyin" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("işlem kendiliğinden başlamaz");
  await act(async () => { vi.advanceTimersByTime(31000); });
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  expect(mocks.calls.mock.calls.map(call => call[0])).toEqual(["getAnalysisTables"]);
});

it("shows a safe configuration error when admission is rejected before a new job can be stored", async () => {
  mocks.start.mockRejectedValue({ code: "functions/failed-precondition", details: { analysisFailure: "configuration" } });
  const analysis = { id: "synthetic", ai: { status: "failed", attempts: 1, maxAttempts: 3, error: "invalid-data", sourceId: "file-0",
    selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" } } } as Analysis;
  render(<TabularAnalysisPanel analysis={analysis} />);
  const retry = await screen.findByRole("button", { name: "Yeniden dene" });
  await waitFor(() => expect(retry).toBeEnabled());
  await userEvent.click(retry);
  expect(await screen.findByRole("alert")).toHaveTextContent("Analiz servisine şu anda ulaşılamıyor.");
  expect(mocks.start).toHaveBeenCalledTimes(1);
});

it.each([
  ["user-day", "Bugünkü analiz haklarınız doldu."],
  ["provider-day", "Analiz servisinin günlük kapasitesi doldu."],
  ["attempts", "Bu çalışma için deneme sınırına ulaşıldı."],
])("shows the %s admission limit and disables new requests until allowed", async (limit, message) => {
  vi.useFakeTimers({ now: 5000 });
  mocks.start.mockRejectedValue({ code: "functions/resource-exhausted", details: { analysisLimit: limit, ...(limit !== "attempts" ? { retryAfter: 8000 } : {}) } });
  const analysis = { id: "synthetic", ai: { status: "failed", attempts: 1, sourceId: "file-0",
    selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" } } } as Analysis;
  await act(async () => { render(<TabularAnalysisPanel analysis={analysis} />); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Yeniden dene" })); });
  expect(screen.getByRole(limit === "attempts" ? "status" : "alert")).toHaveTextContent(message);
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeDisabled();
  expect(screen.queryByText("Analiz oluşturulmaya hazır.")).not.toBeInTheDocument();
  await act(async () => { vi.advanceTimersByTime(3001); });
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toHaveProperty("disabled", limit === "attempts");
  expect(mocks.start).toHaveBeenCalledTimes(1);
});

it.each(["failed", "running"] as const)("blocks manual resend from a rate-limit response after an old %s job", async status => {
  vi.useFakeTimers({ now: 5000 });
  mocks.start.mockRejectedValue({ code: "functions/resource-exhausted", details: { analysisFailure: "provider-rate-limit", retryAfter: 8000 } });
  const analysis = { id: "synthetic", ai: { status, attempts: 1, error: "provider-busy", locale: "tr", leaseUntil: 4500, sourceId: "file-0",
    selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" } } } as Analysis;
  await act(async () => { render(<TabularAnalysisPanel analysis={analysis} />); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Yeniden dene" })); });
  expect(screen.getByRole("alert")).toHaveTextContent("Özet servisi istek sınırına ulaştı.");
  expect(screen.getByRole("button", { name: "Kısa bir süre bekleyin" })).toBeDisabled();
  await act(async () => { vi.advanceTimersByTime(3001); });
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  expect(mocks.start).toHaveBeenCalledTimes(1);
});

it("uses the exact retry deadline and leaves no polling after expiry", async () => {
  vi.useFakeTimers({ now: 5000 });
  const interval = vi.spyOn(globalThis, "setInterval");
  const analysis = { id: "synthetic", ai: { status: "failed", attempts: 1, error: "provider-busy", retryAfter: 6000,
    sourceId: "file-0", selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" } } } as Analysis;
  await act(async () => { render(<TabularAnalysisPanel analysis={analysis} />); });
  await act(async () => { vi.advanceTimersByTime(999); });
  expect(screen.getByRole("button", { name: "Kısa bir süre bekleyin" })).toBeDisabled();
  await act(async () => { vi.advanceTimersByTime(2); });
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  await act(async () => { vi.advanceTimersByTime(60 * 60 * 1000); });
  expect(interval).not.toHaveBeenCalled();
  expect(mocks.calls.mock.calls.map(call => call[0])).toEqual(["getAnalysisTables"]);
});

it.each([undefined, Number.MAX_VALUE])("shows a quota error even with an unusable reset date (%s)", async retryAfter => {
  mocks.start.mockRejectedValue({ code: "functions/resource-exhausted", details: { analysisLimit: "user-day", retryAfter } });
  const analysis = { id: "quota-missing-time", ai: { status: "failed", attempts: 1, sourceId: "file-0",
    selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" } } } as Analysis;
  render(<TabularAnalysisPanel analysis={analysis} />);
  const submit = await screen.findByRole("button", { name: "Yeniden dene" });
  await waitFor(() => expect(submit).toBeEnabled());
  await userEvent.click(submit);
  expect(await screen.findByRole("alert")).toHaveTextContent("Bugünkü analiz haklarınız doldu.");
  expect(mocks.start).toHaveBeenCalledTimes(1);
});

it("does not resurrect an expired cooldown when a snapshot arrives after an idle period", async () => {
  vi.useFakeTimers({ now: 5000 });
  const analysis = { id: "synthetic", ai: { status: "failed", attempts: 1, error: "provider-busy", retryAfter: 4000,
    sourceId: "file-0", selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" } } } as Analysis;
  const view = render(<TabularAnalysisPanel analysis={analysis} />);
  await act(async () => {});
  vi.setSystemTime(100000);
  await act(async () => { view.rerender(<TabularAnalysisPanel analysis={{ ...analysis, ai: { ...analysis.ai!, retryAfter: 90000 } }} />); });
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Kısa bir süre bekleyin" })).not.toBeInTheDocument();
  expect(mocks.start).not.toHaveBeenCalled();
});

it("leaves the progress screen when the lease expires without another generation request", async () => {
  vi.useFakeTimers({ now: 5000 });
  const analysis = { id: "synthetic", ai: { status: "running", attempts: 1, leaseUntil: 5750,
    sourceId: "file-0", selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" } } } as Analysis;
  await act(async () => { render(<TabularAnalysisPanel analysis={analysis} />); });
  expect(screen.getByRole("heading", { name: "Analiziniz hazırlanıyor" })).toBeVisible();
  await act(async () => { vi.advanceTimersByTime(751); });
  expect(screen.queryByRole("heading", { name: "Analiziniz hazırlanıyor" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  expect(mocks.calls.mock.calls.map(call => call[0])).toEqual(["getAnalysisTables"]);
});

it("refreshes a throttled background clock on visibility without automatic generation", async () => {
  vi.useFakeTimers({ now: 5000 });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const analysis = { id: "synthetic", ai: { status: "running", attempts: 1, leaseUntil: 35000,
    sourceId: "file-0", selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" } } } as Analysis;
  const view = render(<TabularAnalysisPanel analysis={analysis} />);
  vi.setSystemTime(40000);
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  view.unmount();
  await act(async () => { vi.advanceTimersByTime(60 * 60 * 1000); document.dispatchEvent(new Event("visibilitychange")); });
  expect(mocks.start).not.toHaveBeenCalled();
});

it("removes an active lease timer and visibility listener when the panel is closed", async () => {
  vi.useFakeTimers({ now: 5000 });
  const timeout = vi.spyOn(globalThis, "setTimeout"), clear = vi.spyOn(globalThis, "clearTimeout");
  const remove = vi.spyOn(document, "removeEventListener");
  const analysis = { id: "synthetic", ai: { status: "running", attempts: 1, leaseUntil: 35000 } } as Analysis;
  const view = render(<TabularAnalysisPanel analysis={analysis} />);
  const deadlineCall = timeout.mock.calls.findIndex(call => call[1] === 30001);
  expect(deadlineCall).toBeGreaterThanOrEqual(0);
  const timer = timeout.mock.results[deadlineCall].value;
  view.unmount();
  expect(clear).toHaveBeenCalledWith(timer);
  expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  await act(async () => { vi.advanceTimersByTime(60 * 60 * 1000); });
  expect(mocks.calls).not.toHaveBeenCalled();
});

it("handles provider-busy and timeout cooldowns deterministically and ignores late failure from a previous analysis", async () => {
  vi.useFakeTimers({ now: 10_000 });
  const now = 10_000;
  const selection = { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum" as const, numberFormat: "plain" as const, unit: "USD" as const };

  // 1. Timeout bekleme durumunu ve otomatik tekrar yapılmamasını doğrula
  const timeoutAnalysis = {
    id: "analysis-timeout",
    ai: { status: "failed", attempts: 1, maxAttempts: 3, attemptId: "att-1", error: "timeout", retryAfter: now + 30_000, sourceId: "file-0", selection },
  } as Analysis;
  const view = render(<TabularAnalysisPanel analysis={timeoutAnalysis} />);
  await act(async () => {});
  expect(screen.getByRole("status")).toHaveTextContent("Analiz süresi doldu.");
  expect(screen.getByRole("button", { name: "Kısa bir süre bekleyin" })).toBeDisabled();
  await act(async () => { vi.advanceTimersByTime(30_001); });
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  expect(mocks.start).not.toHaveBeenCalled();

  // 2. Bekleyen eski istek kullanıcı başka analize geçtikten sonra geç hata (provider-busy) dönerse yeni analizi bozmaz
  vi.useRealTimers();
  let rejectOld!: (err: unknown) => void;
  mocks.start.mockImplementationOnce(() => new Promise((_res, rej) => { rejectOld = rej; }));
  const firstAnalysis = {
    id: "analysis-old",
    ai: { status: "failed", attempts: 1, maxAttempts: 3, attemptId: "att-old", error: "timeout", sourceId: "file-0", selection },
  } as Analysis;
  view.rerender(<TabularAnalysisPanel analysis={firstAnalysis} />);
  const retryBtn = await screen.findByRole("button", { name: "Yeniden dene" });
  await waitFor(() => expect(retryBtn).toBeEnabled());
  await userEvent.click(retryBtn);

  // Kullanıcı yeni analize geçer; eski isteğin geç provider-busy hatası yeni ekrana alert yazmaz.
  const nextAnalysis = { id: "analysis-new" } as Analysis;
  view.rerender(<TabularAnalysisPanel analysis={nextAnalysis} />);
  await act(async () => {
    rejectOld({ code: "functions/failed-precondition", details: { analysisFailure: "provider-busy" } });
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Analizi oluştur" })).toBeInTheDocument();
});

it("kaydetme aşamasında başarısız eski denemeden yeniden denerken eski job.stage'i göstermez ve aktif adımı aria-current ile işaretler", async () => {
  let finishStart!: () => void;
  mocks.start.mockImplementationOnce(() => new Promise<void>(resolve => { finishStart = resolve; }));
  const failedAtSaving = {
    id: "retry-stage",
    ai: {
      status: "failed" as const,
      attemptId: "att-old",
      attempts: 1,
      maxAttempts: 3,
      stage: "saving" as const,
      error: "provider" as const,
      sourceId: "file-0",
      selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum" as const, numberFormat: "plain" as const, unit: "USD" as const },
    },
  } as Analysis;
  const view = render(<TabularAnalysisPanel analysis={failedAtSaving} />);
  const retry = await screen.findByRole("button", { name: "Yeniden dene" });
  await waitFor(() => expect(retry).toBeEnabled());
  await userEvent.click(retry);

  // Sunucu yeni işi henüz bildirmedi: eski "saving" aşaması gösterilmemeli.
  expect(screen.getByRole("status")).toHaveTextContent("Analiz isteği gönderiliyor…");
  expect(screen.queryByText("Rapor kaydediliyor.")).not.toBeInTheDocument();
  const steps = screen.getAllByRole("listitem");
  expect(steps.every(step => !step.hasAttribute("aria-current"))).toBe(true);

  // Sunucudan gerçek running snapshot geldiğinde etkin adım aria-current="step" taşır.
  view.rerender(<TabularAnalysisPanel analysis={{
    ...failedAtSaving,
    ai: { ...failedAtSaving.ai!, status: "running", attemptId: "att-new", stage: "interpreting", leaseUntil: Date.now() + 60_000 },
  }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Kaynaklı özet hazırlanıyor.");
  const runningSteps = screen.getAllByRole("listitem");
  expect(runningSteps[0]).not.toHaveAttribute("aria-current");
  expect(runningSteps[1]).toHaveAttribute("aria-current", "step");
  expect(runningSteps[2]).not.toHaveAttribute("aria-current");
  finishStart();
});

it("startAnalysis ağ kesintisi döndükten sonra sunucu işi tamamladıysa otomatik tekrar yapmadan kayıtlı sonucu açar", async () => {
  mocks.start.mockRejectedValueOnce({ code: "functions/unavailable" });
  mocks.result.mockResolvedValueOnce({ data: { result: { objective: "Ağ kesintisi sonrası kurtarılan rapor" } } });
  const initial = {
    id: "net-drop",
    ai: {
      status: "failed" as const,
      attemptId: "att-1",
      attempts: 1,
      maxAttempts: 3,
      error: "timeout" as const,
      sourceId: "file-0",
      selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum" as const, numberFormat: "plain" as const, unit: "USD" as const },
    },
  } as Analysis;
  const view = render(<TabularAnalysisPanel analysis={initial} />);
  const retry = await screen.findByRole("button", { name: "Yeniden dene" });
  await waitFor(() => expect(retry).toBeEnabled());
  await userEvent.click(retry);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(mocks.start).toHaveBeenCalledTimes(1);

  // Sunucu işi gerçekte tamamlamış: Firestore snapshot'ı geldiğinde yeni startAnalysis yapılmadan sonuç okunur.
  view.rerender(<TabularAnalysisPanel analysis={{
    ...initial,
    ai: { ...initial.ai!, status: "completed", attemptId: "att-2", finishedAt: Date.now() },
  }} />);
  expect(await screen.findByText("Ağ kesintisi sonrası kurtarılan rapor")).toBeVisible();
  expect(mocks.start).toHaveBeenCalledTimes(1);
  expect(mocks.result).toHaveBeenCalledTimes(1);
});

it("günlük kota ve geçici sağlayıcı beklemesinde sunucu yenilenme saatini yerelde gösterir ve süre dolunca yalnız düğmeyi açar", async () => {
  vi.useFakeTimers({ now: new Date(2026, 10, 28, 10, 0, 0).getTime() });
  const renewAt = new Date(2026, 10, 28, 10, 15, 0).getTime();
  mocks.start.mockRejectedValueOnce({ code: "functions/resource-exhausted", details: { analysisLimit: "user-day", retryAfter: renewAt } });
  const analysis = {
    id: "quota-time",
    ai: {
      status: "failed" as const,
      attempts: 1,
      sourceId: "file-0",
      selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum" as const, numberFormat: "plain" as const, unit: "USD" as const },
    },
  } as Analysis;
  await act(async () => { render(<TabularAnalysisPanel analysis={analysis} />); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Yeniden dene" })); });
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(/Kota .* itibarıyla yenilenir; işlem kendiliğinden başlamaz\./);
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeDisabled();
  await act(async () => { vi.advanceTimersByTime(15 * 60 * 1000 + 10); });
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  expect(mocks.start).toHaveBeenCalledTimes(1);
});
