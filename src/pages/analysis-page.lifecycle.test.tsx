import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Analysis } from "../../functions/src/contracts";
import type { AiJob } from "../../functions/src/analysis/tabular-contract";
import { AnalysisPage } from "./analysis-page";

const state = vi.hoisted(() => ({
  user: { uid: "owner-a" }, activeId: "a", completeDraft: vi.fn(), call: vi.fn(),
  analyses: {} as Record<string, Analysis>,
}));
vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("../lib/workspace-context", () => ({ useWorkspace: () => ({ activeId: state.activeId, completeDraft: state.completeDraft }) }));
vi.mock("../hooks/use-analyses", () => ({ useAnalysis: (id: string) => ({ analysis: state.analyses[id], loading: false, error: "" }) }));
vi.mock("../lib/firebase", () => ({ getServices: () => ({ functions: {} }) }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => state.call }));
vi.mock("../components/prepared-documents", () => ({ PreparedDocuments: () => <p>Prepared sources</p> }));
vi.mock("../features/reports/tabular-analysis-panel", () => ({ TabularAnalysisPanel: () => <p>Analysis panel</p> }));

// Gerçek route geçişi aynı sayfa türünü yeniden kullanır; key'in durum ve asenkron yanıtları ayırmasını sınar.
function App() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/app/analyses/b")}>Open B</button><Routes>
    <Route path="/app/analyses/:id" element={<AnalysisPage />} />
    <Route path="/app/history" element={<p>History destination</p>} />
  </Routes></>;
}
function mount() { return render(<MemoryRouter initialEntries={["/app/analyses/a"]}><App /></MemoryRouter>); }

// Yanıtı testin istediği anda tamamlar; gerçek callable veya model çağrısı yapılmaz.
function deferred() {
  let resolve!: (value: { data: { ready?: boolean } }) => void, reject!: (error: unknown) => void;
  const promise = new Promise<{ data: { ready?: boolean } }>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  state.user = { uid: "owner-a" }; state.activeId = "a"; state.completeDraft.mockReset(); state.call.mockReset();
  state.analyses = Object.fromEntries(["a", "b"].map(id => [id, { id, title: `Report ${id}`, business: "Synthetic", status: "completed", createdAt: 1, updatedAt: 1 }]));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

// Aynı kaynakla farklı lease snapshot'larını üretir; hesaplama veya model başlatmaz.
function running(leaseUntil: number): AiJob {
  return { status: "running", leaseUntil, attempts: 1, maxAttempts: 3, attemptId: "synthetic-attempt", startedAt: 1000, stage: "calculating", locale: "tr", sourceId: "file-0",
    selection: { sheet: null, valueColumn: 1, groupColumn: null, aggregation: "sum", numberFormat: "plain", unit: "number" } };
}

it("updates the report header at lease expiry without a new snapshot or server call", async () => {
  vi.useFakeTimers({ now: 5000 });
  state.analyses.a.ai = running(6000);
  await act(async () => { mount(); });
  expect(screen.getByRole("status")).toHaveTextContent("Analiz hazırlanıyor");
  act(() => { vi.advanceTimersByTime(1001); });
  expect(screen.getByRole("status")).toHaveTextContent("Analiz yeniden denenebilir");
  expect(state.call).not.toHaveBeenCalled();
});

it("does not use the old render time for an already expired incoming snapshot", async () => {
  vi.useFakeTimers({ now: 5000 });
  const view = mount();
  vi.setSystemTime(50000);
  state.analyses.a.ai = running(49000);
  await act(async () => { view.rerender(<MemoryRouter><App /></MemoryRouter>); });
  expect(screen.getByRole("status")).toHaveTextContent("Analiz yeniden denenebilir");
});

it("reschedules a renewed lease and refreshes a throttled clock on visibility", async () => {
  vi.useFakeTimers({ now: 5000 });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  state.analyses.a.ai = running(6000);
  const view = mount();
  state.analyses.a.ai = running(9000);
  await act(async () => { view.rerender(<MemoryRouter><App /></MemoryRouter>); vi.advanceTimersByTime(1001); });
  expect(screen.getByRole("status")).toHaveTextContent("Analiz hazırlanıyor");
  vi.setSystemTime(10000);
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(screen.getByRole("status")).toHaveTextContent("Analiz yeniden denenebilir");
  expect(state.call).not.toHaveBeenCalled();
});

it("removes the header's deadline subscription on unmount", () => {
  vi.useFakeTimers({ now: 5000 });
  const remove = vi.spyOn(document, "removeEventListener");
  state.analyses.a.ai = running(9000);
  const view = mount();
  view.unmount();
  expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  act(() => { vi.advanceTimersByTime(10000); });
  expect(state.call).not.toHaveBeenCalled();
});

it("ignores a late delete success after navigating to another report", async () => {
  const request = deferred(); state.call.mockReturnValue(request.promise);
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Analizi ve belgeleri sil" }));
  const confirm = within(screen.getByRole("alertdialog")).getByRole("button", { name: "Analizi sil" });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(state.call).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Open B" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  await act(async () => { request.resolve({ data: {} }); });
  expect(screen.getByRole("heading", { name: "Report b" })).toBeVisible();
  expect(screen.queryByText("History destination")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Analizi ve belgeleri sil" })).toBeEnabled();
});

it("does not display the old report's late failure on a new report", async () => {
  const request = deferred(); state.call.mockReturnValue(request.promise);
  state.analyses.a.status = "failed";
  mount();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  await userEvent.click(screen.getByRole("button", { name: "Open B" }));
  await act(async () => { request.reject({ code: "functions/unavailable" }); });
  expect(screen.getByRole("heading", { name: "Report b" })).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("resets dialogs and pending actions when the account changes on the same route", async () => {
  const request = deferred(); state.call.mockReturnValue(request.promise);
  const view = mount();
  await userEvent.click(screen.getByRole("button", { name: "Analizi ve belgeleri sil" }));
  await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Analizi sil" }));
  state.user = { uid: "owner-b" };
  view.rerender(<MemoryRouter><App /></MemoryRouter>);
  await act(async () => { request.resolve({ data: {} }); });
  expect(screen.queryByText("History destination")).not.toBeInTheDocument();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Analizi ve belgeleri sil" })).toBeEnabled();
});

it.each(["navigate", "new-draft", "stay"])("only completes the matching reviewed draft (%s)", async next => {
  const request = deferred(); state.call.mockReturnValue(request.promise);
  state.analyses.a = { ...state.analyses.a, status: "review", preparationReview: {
    token: "synthetic-review", ready: [{ id: "file-0", name: "synthetic.csv" }], rejected: [],
  } } as Analysis;
  const view = mount();
  await userEvent.click(screen.getByRole("button", { name: "Yalnız 1 belgeyle devam et" }));
  if (next === "navigate") await userEvent.click(screen.getByRole("button", { name: "Open B" }));
  if (next === "new-draft") {
    state.activeId = "b";
    view.rerender(<MemoryRouter><App /></MemoryRouter>);
  }
  await act(async () => { request.resolve({ data: { ready: true } }); });
  expect(state.completeDraft).toHaveBeenCalledTimes(next === "stay" ? 1 : 0);
});

it("keeps successful deletion and safe retry errors working in the original context", async () => {
  state.analyses.a.status = "failed";
  state.call.mockRejectedValueOnce({ code: "functions/unavailable" }).mockResolvedValue({ data: {} });
  mount();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(await screen.findByRole("alert")).not.toBeEmptyDOMElement();
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Analizi ve belgeleri sil" }));
  await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Analizi sil" }));
  expect(await screen.findByText("History destination")).toBeVisible();
});
