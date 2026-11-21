import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "./workspace-provider";
import { PreparationProgress } from "./upload/preparation-progress";
import { useWorkspace } from "../lib/workspace-context";

const api = vi.hoisted(() => ({ create: vi.fn(), prepare: vi.fn(), upload: vi.fn() }));
vi.mock("../lib/deployment-mode", () => ({ authOnlyPreview: false }));
vi.mock("../lib/firebase", () => ({ getServices: () => ({ auth: { currentUser: { uid: "synthetic-user" } }, functions: {}, storage: {}, db: {} }) }));
vi.mock("firebase/functions", () => ({ httpsCallable: (_service: unknown, name: string) => name === "createAnalysis" ? api.create : api.prepare }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc: async () => ({ data: () => ({ status: "uploading" }) }) }));
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
    <input aria-label="files" type="file" onChange={event => workspace.selection.addFiles(Array.from(event.target.files ?? []))} />
    <button onClick={() => workspace.setDraft(() => ({ title: "Sentetik analiz", business: "Sentetik işletme", objective: "Gelir değişimini incele" }))}>Fill</button>
    <button onClick={() => workspace.setDraft(current => ({ ...current, title: "Yeni yerel taslak" }))}>EditTitle</button>
    <button onClick={() => void workspace.start()}>Start</button>
    <button onClick={workspace.cancel}>Cancel</button>
    <button onClick={workspace.completeDraft}>Complete</button>
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
});
