import { WorkspaceDeletionProvider } from "../components/workspace-deletion-provider";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Analysis } from "../../functions/src/contracts";
import type { AiJob } from "../../functions/src/analysis/tabular-contract";
import { AnalysisPage } from "./analysis-page";

const state = vi.hoisted(() => ({
  user: { uid: "owner-a" }, activeId: "a", draftAnalysisId: "", selectionFiles: 0,
  outcome: null as null | { kind: "ready"; id: string }, dismissOutcome: vi.fn(), completeDraft: vi.fn(), call: vi.fn(),
  analyses: {} as Record<string, Analysis>,
  loading: false,
  error: "",
}));
vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("../lib/workspace-context", () => ({
  useWorkspace: () => ({
    activeId: state.activeId,
    draftAnalysisId: state.draftAnalysisId,
    selection: { files: Array.from({ length: state.selectionFiles }) },
    outcome: state.outcome,
    dismissOutcome: state.dismissOutcome,
    completeDraft: state.completeDraft,
  }),
}));
vi.mock("../hooks/use-analyses", () => ({ useAnalysis: (id: string) => ({ analysis: state.analyses[id], loading: state.loading, error: state.error }) }));
vi.mock("../lib/firebase", () => ({ getServices: () => ({ functions: {}, auth: { currentUser: state.user } }) }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => state.call }));
vi.mock("../components/prepared-documents", () => ({ PreparedDocuments: () => <p>Prepared sources</p> }));
vi.mock("../features/reports/tabular-analysis-panel", () => ({ TabularAnalysisPanel: () => <p>Analysis panel</p> }));

// Gerçek route geçişi aynı sayfa türünü yeniden kullanır; key'in durum ve asenkron yanıtları ayırmasını sınar.
function App() {
  const navigate = useNavigate();
  return <WorkspaceDeletionProvider key={state.user.uid} uid={state.user.uid}><button onClick={() => navigate("/app/analyses/b")}>Open B</button><Routes>
    <Route path="/app/analyses/:id" element={<AnalysisPage />} />
    <Route path="/app/history" element={<p>History destination</p>} />
  </Routes></WorkspaceDeletionProvider>;
}
function mount() { return render(<MemoryRouter initialEntries={["/app/analyses/a"]}><App /></MemoryRouter>); }

// Yanıtı testin istediği anda tamamlar; gerçek callable veya model çağrısı yapılmaz.
function deferred() {
  let resolve!: (value: { data: { ready?: boolean; deleted?: boolean } }) => void, reject!: (error: unknown) => void;
  const promise = new Promise<{ data: { ready?: boolean; deleted?: boolean } }>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  state.user = { uid: "owner-a" }; state.activeId = "a"; state.draftAnalysisId = ""; state.selectionFiles = 0; state.outcome = null; state.loading = false; state.error = "";
  state.dismissOutcome.mockReset(); state.completeDraft.mockReset(); state.call.mockReset();
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
  await act(async () => { request.resolve({ data: { deleted: true } }); });
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
  await act(async () => { request.resolve({ data: { deleted: true } }); });
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
  expect(state.completeDraft).toHaveBeenCalledTimes(next === "navigate" ? 0 : 1);
  if (next !== "navigate") expect(state.completeDraft).toHaveBeenCalledWith("a");
});

it("keeps successful deletion and safe retry errors working in the original context", async () => {
  state.analyses.a.status = "failed";
  state.call.mockRejectedValueOnce({ code: "functions/unavailable" }).mockResolvedValue({ data: { deleted: true } });
  mount();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(await screen.findByRole("alert")).not.toBeEmptyDOMElement();
  expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Analizi ve belgeleri sil" }));
  await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Analizi sil" }));
  expect(await screen.findByText("History destination")).toBeVisible();
});

it("analiz kapalıyken belge hazırlığı, geçmişten açma ve kaynak görünümü çalışır; bozuk/pasif analiz düğmesi görünmez", () => {
  vi.stubEnv("VITE_TABULAR_ANALYSIS_ENABLED", "false");
  try {
    state.analyses.a = {
      id: "a",
      title: "Synthetic CSV readiness",
      business: "Synthetic",
      status: "completed",
      createdAt: 1,
      updatedAt: 2,
      report: {
        version: 3,
        fileCount: 1,
        totalBytes: 84,
        totalChunks: 1,
        totalCharacters: 60,
        sources: [{
          id: "file-0",
          name: "synthetic-service-revenue.csv",
          size: 84,
          declaredContentType: "text/csv",
          detectedMime: "text/csv",
          sha256: "a".repeat(64),
          category: "Tablo",
          chunkCount: 1,
          characterCount: 60,
          warnings: [],
          metadata: {},
        }],
      },
    };

    mount();
    expect(screen.getByText("Prepared sources")).toBeVisible();
    expect(screen.getByText(/Belge içerikleri ayrıştırıldı/)).toBeVisible();
    expect(screen.queryByText("Analysis panel")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Analizi oluştur|Tabloları yeniden yükle|Yeniden dene/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Geçmiş analizler" })).toHaveAttribute("href", "/app/history");
    expect(state.call).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
});

it("keeps the delete dialog open when Firestore clears the analysis before the server responds, and supports retry after failure", async () => {
  const user = userEvent.setup();
  const firstRequest = deferred();
  state.call.mockReturnValueOnce(firstRequest.promise);
  const view = mount();

  await user.click(screen.getByRole("button", { name: "Analizi ve belgeleri sil" }));
  const dialog = screen.getByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Analizi sil" }));

  // Silme sürerken düğmede spinner ve "Siliniyor…" metni görünür; Vazgeç devre dışıdır.
  expect(dialog).toBeVisible();
  expect(within(dialog).getByRole("button", { name: "Siliniyor…" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Vazgeç" })).toBeDisabled();

  // Firestore canlı dinleyicisi yanıt gelmeden kaydı kaldırsa bile pencere açık kalır ve erken "silindi" uyarısı göstermez.
  delete (state.analyses as Record<string, Analysis | undefined>).a;
  view.rerender(<MemoryRouter><App /></MemoryRouter>);
  expect(dialog).toBeVisible();
  expect(screen.queryByText("Analiz bulunamadı veya silindi.")).not.toBeInTheDocument();

  // Sunucu başarısız döndüğünde hata ve yalnız o kaydı yeniden deneme seçeneği görünür.
  await act(async () => { firstRequest.reject({ code: "functions/unavailable" }); });
  expect(dialog).toBeVisible();
  expect(within(dialog).getByRole("heading", { name: "Analiz silinemedi." })).toBeVisible();
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Report a");

  const retryRequest = deferred();
  state.call.mockReturnValueOnce(retryRequest.promise);
  await user.click(within(dialog).getByRole("button", { name: "Yeniden dene" }));
  expect(within(dialog).getByRole("button", { name: "Siliniyor…" })).toBeDisabled();
  await act(async () => { retryRequest.resolve({ data: { deleted: true } }); });
  expect(await screen.findByText("History destination")).toBeVisible();
});

it("keeps the same delete dialog mounted and locked during listener loading/error and navigates to history on success", async () => {
  const user = userEvent.setup();
  const request = deferred();
  state.call.mockReturnValueOnce(request.promise);
  const view = mount();

  await user.click(screen.getByRole("button", { name: "Analizi ve belgeleri sil" }));
  const initialDialog = screen.getByRole("alertdialog");
  await user.click(within(initialDialog).getByRole("button", { name: "Analizi sil" }));
  expect(within(initialDialog).getByRole("button", { name: "Siliniyor…" })).toBeDisabled();

  // Firestore dinleyicisi yükleme durumuna dönse bile aynı dialog DOM düğümü korunur ve bekleme kilidi sürer.
  state.loading = true;
  view.rerender(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByRole("alertdialog")).toBe(initialDialog);
  expect(within(initialDialog).getByRole("button", { name: "Siliniyor…" })).toBeDisabled();
  expect(within(initialDialog).getByRole("button", { name: "Vazgeç" })).toBeDisabled();

  // Firestore dinleyicisi hata üretse bile aynı dialog DOM düğümü ve istek kilidi bozulmaz.
  state.loading = false;
  state.error = "Analiz okunamıyor.";
  delete (state.analyses as Record<string, Analysis | undefined>).a;
  view.rerender(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByRole("alertdialog")).toBe(initialDialog);
  expect(within(initialDialog).getByRole("button", { name: "Siliniyor…" })).toBeDisabled();

  await act(async () => { request.resolve({ data: { deleted: true } }); });
  expect(await screen.findByText("History destination")).toBeVisible();
});

it("restores focus to the delete trigger on Vazgeç/Escape/outside click, and uses Geçmişe dön fallback if the trigger is gone", async () => {
  const user = userEvent.setup();
  const view = mount();

  const trigger = screen.getByRole("button", { name: "Analizi ve belgeleri sil" });
  trigger.focus();
  await user.click(trigger);
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Vazgeç" }));
  expect(trigger).toHaveFocus();

  await user.click(trigger);
  fireEvent(screen.getByRole("alertdialog"), new Event("cancel", { cancelable: true }));
  expect(trigger).toHaveFocus();

  await user.click(trigger);
  await user.click(document.body);
  expect(trigger).toHaveFocus();

  // Başarısız silme sırasında kayıt ve açıcı düğme kalkarsa Kapat sonrası odağı anlamlı Geçmişe dön bağlantısına verir.
  const failingRequest = deferred();
  state.call.mockReturnValueOnce(failingRequest.promise);
  await user.click(trigger);
  const dialog = screen.getByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Analizi sil" }));
  await act(async () => { failingRequest.reject({ code: "functions/unavailable" }); });

  delete (state.analyses as Record<string, Analysis | undefined>).a;
  view.rerender(<MemoryRouter><App /></MemoryRouter>);
  await user.click(within(dialog).getByRole("button", { name: "Kapat" }));
  expect(screen.getByRole("link", { name: "Geçmişe dön" })).toHaveFocus();
});

it("kısmi incelemede hazır belge ve yerel taslak sahipliğine göre devam/düzenle veya yeniden seç sunar", () => {
  state.analyses.a = {
    id: "a",
    title: "İnceleme Kaydı",
    business: "Sentetik",
    status: "review",
    createdAt: 1,
    updatedAt: 1,
    preparationReview: {
      token: "tok-1",
      ready: [{ id: "r1", name: "hazir.txt" }],
      rejected: [{ id: "bad", name: "bozuk.pdf", reason: "Dosya içeriği okunamadı." }],
    },
  };

  // Başka oturum veya temizlenmiş yerel taslak varken "Dosyaları düzenle" görünmez; "Belgeleri yeniden seç" çıkar.
  state.draftAnalysisId = "other-analysis";
  state.selectionFiles = 1;
  const view = render(<MemoryRouter initialEntries={["/app/analyses/a"]}><App /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Yalnız 1 belgeyle devam et" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Dosyaları düzenle" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Belgeleri yeniden seç" })).toHaveAttribute("href", "/app/new-analysis");
  expect(screen.getByText(/Özgün yerel dosyalar bu tarayıcı oturumunda artık bulunmuyor/)).toBeVisible();

  // Yerel taslak bu kayda aitse "Dosyaları düzenle" gösterilir.
  state.draftAnalysisId = "a";
  state.selectionFiles = 1;
  view.rerender(<MemoryRouter initialEntries={["/app/analyses/a"]}><App /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Dosyaları düzenle" })).toHaveAttribute("href", "/app/new-analysis");
  expect(screen.queryByRole("link", { name: "Belgeleri yeniden seç" })).not.toBeInTheDocument();

  // Hazır belge yoksa "Yalnız 0 belgeyle devam et" butonu kesinlikle render edilmez.
  state.analyses.a = {
    ...state.analyses.a,
    preparationReview: { token: "tok-2", ready: [], rejected: [{ id: "bad", name: "bozuk.pdf", reason: "Dosya içeriği okunamadı." }] },
  };
  view.rerender(<MemoryRouter initialEntries={["/app/analyses/a"]}><App /></MemoryRouter>);
  expect(screen.queryByRole("button", { name: /belgeyle devam et/ })).not.toBeInTheDocument();
});

it("geçmiş arama ve filtre sorgusunu geri dönüşte, eksik kayıtta ve silme sonrası yönlendirmede korur", async () => {
  const user = userEvent.setup();
  const deleteRequest = deferred();
  state.call.mockReturnValueOnce(deleteRequest.promise);

  render(
    <MemoryRouter initialEntries={["/app/analyses/a?q=Sat%C4%B1%C5%9F&status=completed&period=30d&sort=title&evil=https://evil.test&selected=a"]}>
      <WorkspaceDeletionProvider key={state.user.uid} uid={state.user.uid}>
        <Routes>
          <Route path="/app/analyses/:id" element={<AnalysisPage />} />
          <Route path="/app/history" element={<HistoryTargetEcho />} />
        </Routes>
      </WorkspaceDeletionProvider>
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: "← Geçmiş analizler" }))
    .toHaveAttribute("href", "/app/history?q=Sat%C4%B1%C5%9F&status=completed&period=30d&sort=title");

  await user.click(screen.getByRole("button", { name: "Analizi ve belgeleri sil" }));
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Analizi sil" }));
  await act(async () => { deleteRequest.resolve({ data: { deleted: true } }); });

  expect(await screen.findByTestId("history-location"))
    .toHaveTextContent("/app/history?q=Sat%C4%B1%C5%9F&status=completed&period=30d&sort=title");
});

function HistoryTargetEcho() {
  const location = useLocation();
  return <p data-testid="history-location">{location.pathname + location.search}</p>;
}
