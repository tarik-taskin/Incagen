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
let prepare: ReturnType<typeof deferred<{ data: { ready: boolean } }>>;
let uploads: { progress: (snapshot: { bytesTransferred: number }) => void; reject: (error: unknown) => void; finish: () => void }[];

// Test kontrolleri gerçek sağlayıcının taslak ve işlem API'sini kullanır; ek bir durum modeli oluşturmaz.
function Probe({ compact = false }: { compact?: boolean }) {
  const workspace = useWorkspace();
  return <>
    <input aria-label="files" type="file" onChange={event => workspace.selection.addFiles(Array.from(event.target.files ?? []))} />
    <button onClick={() => workspace.setDraft(() => ({ title: "Sentetik analiz", business: "Sentetik işletme", objective: "Gelir değişimini incele" }))}>Fill</button>
    <button onClick={() => void workspace.start()}>Start</button>
    <button onClick={workspace.cancel}>Cancel</button>
    <button onClick={workspace.completeDraft}>Complete</button>
    <p data-testid="phase">{workspace.phase}</p>
    <p data-testid="count">{workspace.selection.files.length}</p>
    <p role="alert">{workspace.error}</p>
    <PreparationProgress compact={compact} />
  </>;
}

async function setup(compact = false) {
  const user = userEvent.setup();
  const result = render(<MemoryRouter><WorkspaceProvider><Probe compact={compact} /></WorkspaceProvider></MemoryRouter>);
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
    create = deferred();
    await user.click(screen.getByText("Start"));
    expect(screen.getByTestId("phase")).toHaveTextContent("creating");
    expect(screen.queryByRole("link", { name: "İşlemi izle" })).not.toBeInTheDocument();
    await user.click(screen.getByText("Cancel"));
    await act(async () => create.resolve({ data: { id: "previous-analysis", paths: ["path-1"] } }));
  });

  it("oluşturma/aktarım/hazırlığı ayırır; %100 aktarım tamamlanmış rapor sayılmaz; başarıda riskli taslağı temizler", async () => {
    const { user, unmount } = await setup();
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
    await user.click(screen.getByText("Complete"));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(leavingIsPrevented()).toBe(false);
    unmount();
    expect(leavingIsPrevented()).toBe(false);
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
