import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "./workspace-provider";
import { PreparationProgress } from "./upload/preparation-progress";
import { useWorkspace } from "../lib/workspace-context";

const api = vi.hoisted(() => ({
  create: vi.fn(),
  prepare: vi.fn(),
  upload: vi.fn(),
  afterPrepareStatus: "" as string,
  docError: "",
  docExists: true,
  listeners: new Set<(snap: { exists: () => boolean; data: () => Record<string, unknown> }) => void>(),
  unsubscribedCount: 0,
}));
vi.mock("../lib/deployment-mode", () => ({ authOnlyPreview: false }));
vi.mock("../lib/firebase", () => ({ getServices: () => ({ auth: { currentUser: { uid: "synthetic-user" } }, functions: {}, storage: {}, db: {} }) }));
vi.mock("firebase/functions", () => ({ httpsCallable: (_service: unknown, name: string) => name === "createAnalysis" ? api.create : api.prepare }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => segments.join("/")),
  getDoc: async () => {
    const status = api.prepare.mock.calls.length > 0 && api.afterPrepareStatus ? api.afterPrepareStatus : "uploading";
    return { exists: () => api.docExists, data: () => ({ status, error: api.docError }) };
  },
  onSnapshot: (_ref: unknown, onNext: (snap: { exists: () => boolean; data: () => Record<string, unknown> }) => void) => {
    api.listeners.add(onNext);
    return () => {
      api.listeners.delete(onNext);
      api.unsubscribedCount++;
    };
  },
}));
vi.mock("firebase/storage", () => ({ ref: vi.fn(), uploadBytesResumable: api.upload }));

// Ağ çağrılarını test istediğinde çözer; yüzde ile hazırlık sonucunu birbirinden bağımsız sınar.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let create: ReturnType<typeof deferred<{ data: { id: string; paths: string[] } }>>;
let prepare: ReturnType<typeof deferred<{ data: { ready: boolean; needsReview?: boolean } }>>;
let uploads: { progress: (snapshot: { bytesTransferred: number }) => void; reject: (error: unknown) => void; finish: () => void }[];

// Test kontrolleri gerçek sağlayıcının taslak ve işlem API'sini kullanır; ek bir durum modeli oluşturmaz.
function Probe({ compact = false }: { compact?: boolean }) {
  const workspace = useWorkspace();
  return <>
    <input aria-label="files" type="file" onChange={event => { workspace.selection.addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    <button onClick={() => workspace.setDraft(() => ({ title: "Sentetik analiz", business: "Sentetik işletme", objective: "Gelir değişimini incele" }))}>Fill</button>
    <button onClick={() => workspace.setDraft(() => ({ title: "B çalışması", business: "Sentetik işletme", objective: "B hedefi" }))}>FillB</button>
    <button onClick={() => workspace.setDraft(current => ({ ...current, title: "Yeni yerel taslak" }))}>EditTitle</button>
    <button onClick={workspace.selection.clearFiles}>Clear</button>
    <button onClick={() => void workspace.start()}>Start</button>
    <button onClick={workspace.cancel}>Cancel</button>
    <button onClick={() => workspace.completeDraft(workspace.activeId)}>Complete</button>
    <button onClick={() => workspace.completeDraft("review-a")}>CompleteA</button>
    <p data-testid="phase">{workspace.phase}</p>
    <p data-testid="count">{workspace.selection.files.length}</p>
    <p data-testid="title">{workspace.draft.title}</p>
    <p data-testid="business">{workspace.draft.business}</p>
    <p data-testid="objective">{workspace.draft.objective}</p>
    <p data-testid="active-id">{workspace.activeId}</p>
    <p data-testid="draft-analysis-id">{workspace.draftAnalysisId}</p>
    <p role="alert">{workspace.error}</p>
    <PreparationProgress compact={compact} />
  </>;
}

async function setup(compact = false, initialEntries?: string[]) {
  const user = userEvent.setup();
  const result = render(<MemoryRouter initialEntries={initialEntries}><WorkspaceProvider><Probe compact={compact} /></WorkspaceProvider></MemoryRouter>);
  await user.click(screen.getByText("Fill"));
  await user.upload(screen.getByLabelText("files"), new File(["a".repeat(100)], "kaynak.txt", { type: "text/plain" }));
  return { user, ...result };
}

function leavingIsPrevented() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.afterPrepareStatus = ""; api.docError = ""; api.docExists = true;
  api.listeners.clear(); api.unsubscribedCount = 0;
  create = deferred(); prepare = deferred(); uploads = [];
  api.create.mockImplementation(() => create.promise);
  api.prepare.mockImplementation(() => prepare.promise);
  api.upload.mockImplementation(() => {
    let current: typeof uploads[number];
    return {
      on: (_event: string, progress: typeof current.progress, reject: typeof current.reject, finish: typeof current.finish) => { current = { progress, reject, finish }; uploads.push(current); },
      cancel: () => current.reject(Object.assign(new Error("Cancelled"), { code: "storage/canceled" })),
    };
  });
});

describe("Gerçek hazırlama aşamaları ve taslak", () => {
  it("yeni kayıt açılırken önceki çalışmanın bağlantısını aktif işlem gibi göstermez", async () => {
    const { user } = await setup(true);
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "previous-analysis", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(screen.getByRole("link", { name: "İşlemi izle" })).toHaveAttribute("href", "/app/analyses/previous-analysis");
    await act(async () => uploads[0].finish());
    await act(async () => prepare.resolve({ data: { ready: true } }));
    expect(screen.getByRole("link", { name: "Hazırlık özetini aç" })).toHaveAttribute("href", "/app/analyses/previous-analysis");
    await user.click(screen.getByText("Fill"));
    await user.upload(screen.getByLabelText("files"), new File(["b".repeat(100)], "ikinci.txt", { type: "text/plain" }));
    create = deferred();
    await user.click(screen.getByText("Start"));
    expect(screen.getByTestId("phase")).toHaveTextContent("creating");
    expect(screen.queryByRole("link", { name: "Hazırlık özetini aç" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "İşlemi izle" })).not.toBeInTheDocument();
    await user.click(screen.getByText("Cancel"));
    await act(async () => create.resolve({ data: { id: "previous-analysis", paths: ["path-1"] } }));
  });

  it("oluşturma/aktarım/hazırlığı ayırır; %100 aktarım tamamlanmış rapor sayılmaz; başarıda yalnızca gönderilen taslağı temizler", async () => {
    const { user, unmount } = await setup(true);
    expect(leavingIsPrevented()).toBe(true);
    await user.click(screen.getByText("Start"));
    expect(screen.getByText("Çalışma oluşturuluyor")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    await act(async () => create.resolve({ data: { id: "analysis-1", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(screen.getByText("Dosyalar yükleniyor")).toBeVisible();
    act(() => uploads[0].progress({ bytesTransferred: 50 }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "50");
    act(() => uploads[0].progress({ bytesTransferred: 100 }));
    expect(screen.getByTestId("phase")).toHaveTextContent("uploading");
    expect(api.prepare).not.toHaveBeenCalled();
    await act(async () => uploads[0].finish());
    expect(screen.getByText("Belgeler hazırlanıyor")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    await act(async () => prepare.resolve({ data: { ready: true } }));
    expect(screen.getByTestId("phase")).toHaveTextContent("idle");
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("title")).toHaveTextContent("");
    expect(screen.getByTestId("objective")).toHaveTextContent("");
    expect(screen.getByTestId("business")).toHaveTextContent("Sentetik işletme");
    expect(screen.getByTestId("active-id")).toHaveTextContent("analysis-1");
    expect(screen.getByRole("link", { name: "Hazırlık özetini aç" })).toHaveAttribute("href", "/app/analyses/analysis-1");
    expect(leavingIsPrevented()).toBe(false);
    unmount();
    expect(leavingIsPrevented()).toBe(false);
  });

  it("hazırlama sürerken kullanıcı taslağı değiştirirse geç gelen başarı yeni taslağı temizlemez", async () => {
    const { user } = await setup(true);
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "analysis-1", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => uploads[0].finish());
    await user.click(screen.getByText("EditTitle"));
    await act(async () => prepare.resolve({ data: { ready: true } }));
    expect(screen.getByTestId("title")).toHaveTextContent("Yeni yerel taslak");
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("inceleme gerektiren veya iptal/hata ile biten işi hazır gibi göstermez; kapatılabilir gerçek sonuç sunar", async () => {
    const { user } = await setup(true);
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "review-1", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => uploads[0].finish());
    await act(async () => prepare.resolve({ data: { ready: false, needsReview: true } }));
    expect(screen.getByText("Bazı belgeler inceleme bekliyor")).toBeVisible();
    expect(screen.getByRole("link", { name: "İncelemeyi aç" })).toHaveAttribute("href", "/app/analyses/review-1");
    expect(screen.queryByText("Belgeleriniz hazır")).not.toBeInTheDocument();
    expect(screen.getByTestId("draft-analysis-id")).toHaveTextContent("review-1");

    await user.click(screen.getByRole("button", { name: "Kapat" }));
    expect(screen.queryByText("Bazı belgeler inceleme bekliyor")).not.toBeInTheDocument();

    prepare = deferred();
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "fail-1", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(2));
    await act(async () => uploads[1].finish());
    await act(async () => prepare.reject(Object.assign(new Error("Unavailable"), { code: "functions/unavailable" })));
    expect(screen.getByText("Belgeler hazırlanamadı")).toBeVisible();
    expect(screen.getByRole("link", { name: "Yeni analize dön" })).toHaveAttribute("href", "/app/new-analysis");
    expect(screen.queryByText("Belgeleriniz hazır")).not.toBeInTheDocument();
  });

  it("kullanıcı zaten tamamlanan analizin sayfasındaysa kompakt ilerleme bannerını yinelemez", async () => {
    const { user } = await setup(true, ["/app/analyses/analysis-1"]);
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "analysis-1", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => uploads[0].finish());
    await act(async () => prepare.resolve({ data: { ready: true } }));
    expect(screen.queryByText("Belgeleriniz hazır")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hazırlık özetini aç" })).not.toBeInTheDocument();
  });

  it("yükleme iptalinde dosyaları korur; yeniden denemede aynı istek kimliğini kullanır", async () => {
    const { user } = await setup();
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "analysis-1", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await user.click(screen.getByText("Cancel"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Yükleme iptal edildi; dosyalarınız korundu.");
    expect(screen.getByTestId("phase")).toHaveTextContent("idle");
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(leavingIsPrevented()).toBe(true);
    expect(api.prepare).not.toHaveBeenCalled();
    await user.click(screen.getByText("Start"));
    await waitFor(() => expect(uploads).toHaveLength(2));
    expect(api.create.mock.calls[0][0].requestId).toBe(api.create.mock.calls[1][0].requestId);
    await act(async () => uploads[1].finish());
    await act(async () => prepare.reject(Object.assign(new Error("Unavailable"), { code: "functions/unavailable" })));
    expect(screen.getByTestId("phase")).toHaveTextContent("idle");
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(leavingIsPrevented()).toBe(true);
  });

  it("ilk kayıt açılırken iptal edilirse aktarım başlatmaz; unmount ayrılma uyarısını kaldırır", async () => {
    const { user, unmount } = await setup();
    await user.click(screen.getByText("Start"));
    await user.click(screen.getByText("Cancel"));
    await act(async () => create.resolve({ data: { id: "analysis-1", paths: ["path-1"] } }));
    expect(api.upload).not.toHaveBeenCalled();
    expect(api.prepare).not.toHaveBeenCalled();
    expect(screen.getByTestId("phase")).toHaveTextContent("idle");
    expect(screen.getByRole("alert")).toHaveTextContent("Yükleme iptal edildi; dosyalarınız korundu.");
    unmount();
    expect(leavingIsPrevented()).toBe(false);
  });

  it("A inceleme taslağı temizlenip B oluşturulurken B createAnalysis beklese ve hata verse bile B taslağını ve yeniden deneme kimliğini korur", async () => {
    const { user } = await setup(true);
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "review-a", paths: ["path-a"] } }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => uploads[0].finish());
    await act(async () => prepare.resolve({ data: { ready: false, needsReview: true } }));
    expect(screen.getByTestId("draft-analysis-id")).toHaveTextContent("review-a");

    // A'nın dosyaları tamamen temizlenip yeni B dosyası seçilince A'nın sahipliği geri gelmez.
    await user.click(screen.getByText("Clear"));
    expect(screen.getByTestId("draft-analysis-id")).toBeEmptyDOMElement();
    await user.click(screen.getByText("FillB"));
    await user.upload(screen.getByLabelText("files"), new File(["bbb"], "b-dosya.txt", { type: "text/plain" }));
    expect(screen.getByTestId("draft-analysis-id")).toBeEmptyDOMElement();

    // B'nin createAnalysis isteği beklerken A kısmi onayı tamamlansa bile B taslağı ve requestId korunur.
    create = deferred();
    await user.click(screen.getByText("Start"));
    expect(screen.getByTestId("active-id")).toHaveTextContent("review-a");
    await user.click(screen.getByText("CompleteA"));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("title")).toHaveTextContent("B çalışması");
    expect(screen.getByTestId("objective")).toHaveTextContent("B hedefi");

    await act(async () => create.reject(Object.assign(new Error("Unavailable"), { code: "functions/unavailable" })));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("title")).toHaveTextContent("B çalışması");
    expect(screen.getByTestId("objective")).toHaveTextContent("B hedefi");

    // B yeniden denendiğinde ilk B çağrısındaki aynı requestId kullanılır.
    create = deferred();
    await user.click(screen.getByText("Start"));
    expect(api.create).toHaveBeenCalledTimes(3);
    expect(api.create.mock.calls[2][0].requestId).toBe(api.create.mock.calls[1][0].requestId);
    expect(api.create.mock.calls[2][0].requestId).not.toBe(api.create.mock.calls[0][0].requestId);
    await act(async () => create.resolve({ data: { id: "analysis-b", paths: ["path-b"] } }));
  });

  it("ready: false yanıtında needsReview yokken körü körüne inceleme göstermez; gerçek iş kaydına göre davranır", async () => {
    const { user } = await setup(true);
    api.afterPrepareStatus = "processing";
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "proc-1", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => uploads[0].finish());
    await act(async () => prepare.resolve({ data: { ready: false } }));

    expect(screen.queryByText("Bazı belgeler inceleme bekliyor")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "İncelemeyi aç" })).not.toBeInTheDocument();
    expect(screen.queryByText("Belgeleriniz hazır")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "İşlemi izle" })).toHaveAttribute("href", "/app/analyses/proc-1");

    // Kayıt gerçekten failed durumundaysa failed olarak bildirilir.
    create = deferred();
    prepare = deferred();
    api.prepare.mockClear();
    api.afterPrepareStatus = "failed";
    api.docError = "Sunucu ayrıştırması tamamlanamadı.";
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "failed-2", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(2));
    await act(async () => uploads[1].finish());
    await act(async () => prepare.resolve({ data: { ready: false } }));
    expect(screen.getByText("Belgeler hazırlanamadı")).toBeVisible();
    expect(screen.getByRole("link", { name: "Yeni analize dön" })).toHaveAttribute("href", "/app/new-analysis");
    expect(screen.queryByText("Bazı belgeler inceleme bekliyor")).not.toBeInTheDocument();

    // Kayıt review durumundaysa (veya açık needsReview: true geldiyse) inceleme gösterilir.
    create = deferred();
    prepare = deferred();
    api.prepare.mockClear();
    api.afterPrepareStatus = "review";
    api.docError = "";
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "review-3", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(3));
    await act(async () => uploads[2].finish());
    await act(async () => prepare.resolve({ data: { ready: false } }));
    expect(screen.getByText("Bazı belgeler inceleme bekliyor")).toBeVisible();
    expect(screen.getByRole("link", { name: "İncelemeyi aç" })).toHaveAttribute("href", "/app/analyses/review-3");
  });

  it("B hazırlama hatasından sonra tümü temizlenip aynı A dosyaları ve başlık/hedef yeniden seçildiğinde eski A onayı yeni taslağı temizlemez", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><WorkspaceProvider><Probe compact /></WorkspaceProvider></MemoryRouter>);
    const sharedFile = new File(["aaaa"], "ozgun.txt", { type: "text/plain", lastModified: 1700000000000 });
    await user.click(screen.getByText("Fill"));
    await user.upload(screen.getByLabelText("files"), sharedFile);

    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "review-a", paths: ["path-a"] } }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => uploads[0].finish());
    await act(async () => prepare.resolve({ data: { ready: false, needsReview: true } }));

    // Dosyaları değiştirmeden yalnız başlığı B'ye çevirip başarısız olan B hazırlığını başlat.
    await user.click(screen.getByText("FillB"));
    create = deferred();
    prepare = deferred();
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "failed-b", paths: ["path-b"] } }));
    await waitFor(() => expect(uploads).toHaveLength(2));
    await act(async () => uploads[1].finish());
    await act(async () => prepare.reject(Object.assign(new Error("Unavailable"), { code: "functions/unavailable" })));

    // Tümünü temizle ve aynı özgün dosya + A başlığı/hedefini yeni taslak örneği olarak yeniden seç.
    await user.click(screen.getByText("Clear"));
    await user.click(screen.getByText("Fill"));
    await user.upload(screen.getByLabelText("files"), sharedFile);
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("title")).toHaveTextContent("Sentetik analiz");

    // Eski A kısmi onayı tamamlansa bile yeni taslak örneği kesinlikle temizlenmez.
    await user.click(screen.getByText("CompleteA"));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("title")).toHaveTextContent("Sentetik analiz");
    expect(screen.getByTestId("objective")).toHaveTextContent("Gelir değişimini incele");
  });

  it("bekleme bildirimini canlı Firestore kaydıyla günceller ve sonuç, silinme, kapatma ile unmount sonrasında dinleyiciyi bırakır", async () => {
    const { user, unmount } = await setup(true);
    api.afterPrepareStatus = "processing";
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "proc-live-1", paths: ["path-1"] } }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => uploads[0].finish());
    await act(async () => prepare.resolve({ data: { ready: false } }));

    expect(screen.getByRole("link", { name: "İşlemi izle" })).toHaveAttribute("href", "/app/analyses/proc-live-1");
    await waitFor(() => expect(api.listeners.size).toBe(1));

    // Kayıt completed olduğunda üst bildirim otomatik Hazırlık özetini aç olur ve dinleyici bırakılır.
    await act(async () => {
      for (const listener of api.listeners) listener({ exists: () => true, data: () => ({ status: "completed" }) });
    });
    expect(screen.getByText("Belgeleriniz hazır")).toBeVisible();
    expect(screen.getByRole("link", { name: "Hazırlık özetini aç" })).toHaveAttribute("href", "/app/analyses/proc-live-1");
    expect(api.listeners.size).toBe(0);
    expect(api.unsubscribedCount).toBe(1);

    // Yeni bekleme kaydı silindiğinde bildirim kapanır ve dinleyici bırakılır.
    create = deferred();
    prepare = deferred();
    api.prepare.mockClear();
    await user.click(screen.getByText("Fill"));
    await user.upload(screen.getByLabelText("files"), new File(["bb"], "ikinci.txt", { type: "text/plain" }));
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "proc-live-2", paths: ["path-2"] } }));
    await waitFor(() => expect(uploads).toHaveLength(2));
    await act(async () => uploads[1].finish());
    await act(async () => prepare.resolve({ data: { ready: false } }));
    await waitFor(() => expect(api.listeners.size).toBe(1));

    await act(async () => {
      for (const listener of api.listeners) listener({ exists: () => false, data: () => ({}) });
    });
    expect(screen.queryByRole("link", { name: "İşlemi izle" })).not.toBeInTheDocument();
    expect(api.listeners.size).toBe(0);
    expect(api.unsubscribedCount).toBe(2);

    // Bildirim kapatıldığında ve oturum/bileşen unmount olduğunda takip durur.
    create = deferred();
    prepare = deferred();
    api.prepare.mockClear();
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "proc-live-3", paths: ["path-3"] } }));
    await waitFor(() => expect(uploads).toHaveLength(3));
    await act(async () => uploads[2].finish());
    await act(async () => prepare.resolve({ data: { ready: false } }));
    await waitFor(() => expect(api.listeners.size).toBe(1));

    await user.click(screen.getByRole("button", { name: "Kapat" }));
    expect(api.listeners.size).toBe(0);
    expect(api.unsubscribedCount).toBe(3);

    create = deferred();
    prepare = deferred();
    api.prepare.mockClear();
    await user.click(screen.getByText("Start"));
    await act(async () => create.resolve({ data: { id: "proc-live-4", paths: ["path-4"] } }));
    await waitFor(() => expect(uploads).toHaveLength(4));
    await act(async () => uploads[3].finish());
    await act(async () => prepare.resolve({ data: { ready: false } }));
    await waitFor(() => expect(api.listeners.size).toBe(1));

    unmount();
    expect(api.listeners.size).toBe(0);
    expect(api.unsubscribedCount).toBe(4);
  });
});
