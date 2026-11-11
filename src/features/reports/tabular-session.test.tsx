import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Analysis } from "../../../functions/src/contracts";
import type { AnalysisTable, AiJob } from "../../../functions/src/analysis/tabular-contract";
import { TabularAnalysisPanel } from "./tabular-analysis-panel";

const mocks = vi.hoisted(() => ({ user: { uid: "owner-a" }, tables: vi.fn(), result: vi.fn(), start: vi.fn() }));
vi.mock("../../lib/auth-context", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../../lib/firebase", () => ({ getServices: () => ({ functions: {} }) }));
vi.mock("firebase/functions", () => ({ httpsCallable: (_functions: unknown, name: string) => name === "startAnalysis" ? mocks.start : name === "getAnalysisResult" ? mocks.result : mocks.tables }));
vi.mock("./live-analysis-report", () => ({ default: ({ artifact }: { artifact: { result: { objective: string } } }) => <p>{artifact.result.objective}</p> }));

const sourceA: AnalysisTable = { sourceId: "file-0", fileName: "revenue.xlsx", sheet: "Q1", columns: ["Team", "Amount", "Region"], rows: 10 };
const sourceB: AnalysisTable = { sourceId: "file-1", fileName: "costs.xlsx", sheet: "Q1", columns: ["Team", "Cost"], rows: 20 };
const limits = { rows: 5000, groups: 12, attempts: 3 };
const failed: AiJob = { status: "failed", attemptId: "attempt-a", attempts: 1, maxAttempts: 3, startedAt: 1, leaseUntil: 1, stage: "calculating", locale: "tr", sourceId: "file-0",
  selection: { sheet: "Q1", valueColumn: 1, groupColumn: null, aggregation: "sum", numberFormat: "plain", unit: "USD" } };
const analysis = { id: "analysis-a", status: "completed", createdAt: 1, updatedAt: 1 } as Analysis;

beforeEach(() => {
  mocks.user = { uid: "owner-a" }; mocks.tables.mockReset(); mocks.result.mockReset(); mocks.start.mockReset();
  mocks.tables.mockResolvedValue({ data: { tables: [sourceA, sourceB], limits } });
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => vi.restoreAllMocks());

// Kullanıcı gerçek Radix seçeneklerini seçer; sayfa/sütun değerleri testte kestirmeden atanmaz.
async function choose(label: string, option: string) {
  await userEvent.click(await screen.findByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

it("keeps the selected source and sheet when a refreshed table list changes order", async () => {
  const view = render(<TabularAnalysisPanel analysis={{ ...analysis, ai: failed }} />);
  await choose("Analiz tablosu", "costs.xlsx · Q1");
  await choose("Hesaplama", "Kayıt sayısı");
  view.rerender(<TabularAnalysisPanel analysis={{ ...analysis, ai: { ...failed, status: "running", leaseUntil: Date.now() + 10000 } }} />);
  mocks.tables.mockResolvedValue({ data: { tables: [sourceB, sourceA], limits } });
  view.rerender(<TabularAnalysisPanel analysis={{ ...analysis, ai: failed }} />);
  await waitFor(() => expect(mocks.tables).toHaveBeenCalledTimes(2));
  await userEvent.click(await screen.findByRole("button", { name: "Yeniden dene" }));
  expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ sourceId: "file-1", selection: expect.objectContaining({ sheet: "Q1", aggregation: "count" }) }));
});

it("does not silently select a different source when the selected source disappears", async () => {
  const view = render(<TabularAnalysisPanel analysis={{ ...analysis, ai: failed }} />);
  await choose("Analiz tablosu", "costs.xlsx · Q1");
  await choose("Hesaplama", "Kayıt sayısı");
  view.rerender(<TabularAnalysisPanel analysis={{ ...analysis, ai: { ...failed, status: "running", leaseUntil: Date.now() + 10000 } }} />);
  mocks.tables.mockResolvedValue({ data: { tables: [sourceA], limits } });
  view.rerender(<TabularAnalysisPanel analysis={{ ...analysis, ai: failed }} />);
  await waitFor(() => expect(mocks.tables).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeDisabled());
  expect(screen.getByText("Devam etmek için bir tablo seçin.")).toBeVisible();
  expect(mocks.start).not.toHaveBeenCalled();
});

it.each(["measure", "group"])("rejects a saved selection with a missing %s column", async missing => {
  const job = { ...failed, selection: { ...failed.selection, [missing === "measure" ? "valueColumn" : "groupColumn"]: 7 } };
  render(<TabularAnalysisPanel analysis={{ ...analysis, ai: job }} />);
  const retry = await screen.findByRole("button", { name: "Yeniden dene" });
  expect(retry).toBeDisabled();
  expect(screen.getByText(missing === "measure" ? "Hesaplanacak ölçüm alanını seçin." : "Gruplama alanını yeniden seçin.")).toBeVisible();
  expect(mocks.start).not.toHaveBeenCalled();
});

it("initializes a new attempt from its own stored selection rather than the previous form", async () => {
  const view = render(<TabularAnalysisPanel analysis={{ ...analysis, ai: failed }} />);
  await screen.findByLabelText("Kapsam özeti");
  view.rerender(<TabularAnalysisPanel analysis={{ ...analysis, ai: { ...failed, attemptId: "attempt-b", sourceId: "file-1", selection: { ...failed.selection, unit: "EUR" } } }} />);
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Analiz tablosu" })).toHaveTextContent("costs.xlsx"));
  expect(screen.getByRole("combobox", { name: "Birim" })).toHaveTextContent("EUR");
});

it.each(["account", "record"])("ignores an old start failure after changing %s", async boundary => {
  let reject!: (error: unknown) => void;
  mocks.start.mockReturnValue(new Promise((_yes, no) => { reject = no; }));
  const view = render(<TabularAnalysisPanel analysis={{ ...analysis, ai: failed }} />);
  await userEvent.click(await screen.findByRole("button", { name: "Yeniden dene" }));
  expect(screen.getByRole("heading", { name: "Analiziniz hazırlanıyor" })).toBeVisible();
  if (boundary === "account") mocks.user = { uid: "owner-b" };
  view.rerender(<TabularAnalysisPanel analysis={{ ...analysis, id: boundary === "record" ? "analysis-b" : analysis.id, ai: failed }} />);
  await act(async () => { reject({ code: "functions/unavailable" }); });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Yeniden dene" })).toBeEnabled();
});

it("does not show the previous account's saved artifact while the new result is loading", async () => {
  mocks.result.mockResolvedValueOnce({ data: { result: { objective: "Private report A" } } }).mockReturnValue(new Promise(() => {}));
  const ready = { ...analysis, ai: { ...failed, status: "completed" as const } };
  const view = render(<TabularAnalysisPanel analysis={ready} />);
  expect(await screen.findByText("Private report A")).toBeVisible();
  mocks.user = { uid: "owner-b" };
  view.rerender(<TabularAnalysisPanel analysis={ready} />);
  expect(screen.queryByText("Private report A")).not.toBeInTheDocument();
  await waitFor(() => expect(mocks.result).toHaveBeenCalledTimes(2));
});
