import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TabularAnalysisPanel } from "./tabular-analysis-panel";
import type { Analysis } from "../../../functions/src/contracts";

const mocks = vi.hoisted(() => ({ user: { uid: "synthetic" }, calls: vi.fn(), start: vi.fn() }));
vi.mock("../../lib/auth-context", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../../lib/firebase", () => ({ getServices: () => ({ functions: {} }) }));
vi.mock("firebase/functions", () => ({ httpsCallable: (...args: unknown[]) => {
  mocks.calls(args[1]);
  if (args[1] === "startAnalysis") return mocks.start;
  return async () => ({ data: { tables: [{ sourceId: "file-0", fileName: "test.csv", sheet: null, columns: ["Team", "Amount"], rows: 2 }], limits: { rows: 5000, groups: 12, attempts: 3 } } });
} }));
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); mocks.calls.mockClear(); mocks.start.mockReset(); });

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
