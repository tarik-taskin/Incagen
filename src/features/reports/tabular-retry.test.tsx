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
afterEach(() => { vi.useRealTimers(); mocks.calls.mockClear(); mocks.start.mockReset(); });

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
