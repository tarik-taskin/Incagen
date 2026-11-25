import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n/runtime";
import { AuthContext } from "../../lib/auth-context";
import type { User } from "firebase/auth";
import type { AiJob, TableSelection } from "../../../functions/src/analysis/tabular-contract";
import type { AiArtifact } from "../../../functions/src/analysis/tabular-storage";
import type { AiResult } from "../../../functions/src/analysis/result-contract";
import type { ParsedDocument } from "../../../functions/src/contracts";
import LiveAnalysisReport from "./live-analysis-report";
import type { ReportSource } from "./source-dialog";

const mocks = vi.hoisted(() => ({
  getBytesMock: vi.fn(),
  currentUser: { uid: "user-123" } as { uid: string } | null,
  createObjectURLMock: vi.fn(() => "blob:http://localhost/mock-blob-url"),
  revokeObjectURLMock: vi.fn(),
  anchorClickMock: vi.fn(),
}));

vi.mock("../../lib/firebase", () => ({
  getServices: () => ({
    auth: {
      get currentUser() {
        return mocks.currentUser;
      },
    },
    storage: {},
  }),
}));

vi.mock("firebase/storage", () => ({
  ref: (_storage: unknown, path: string) => ({ path }),
  getBytes: (...args: unknown[]) => mocks.getBytesMock(...args),
}));

vi.mock("../../hooks/use-theme", () => ({
  useTheme: () => ({ theme: "classic", mode: "light" }),
}));

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  mocks.currentUser = { uid: "user-123" };
  mocks.getBytesMock.mockReset();
  mocks.createObjectURLMock.mockClear();
  mocks.revokeObjectURLMock.mockClear();
  mocks.anchorClickMock.mockClear();

  globalThis.URL.createObjectURL = mocks.createObjectURLMock;
  globalThis.URL.revokeObjectURL = mocks.revokeObjectURLMock;
  globalThis.IntersectionObserver = MockIntersectionObserver;

  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  HTMLAnchorElement.prototype.click = mocks.anchorClickMock;
});

afterEach(() => {
  setLocale("tr");
  vi.restoreAllMocks();
});

const sampleContent = "test,revenue\nA,10\n";
const sampleBytes = new TextEncoder().encode(sampleContent);

async function computeSha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data.buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const defaultSelection: TableSelection = {
  sheet: null,
  valueColumn: 1,
  groupColumn: null,
  aggregation: "sum",
  numberFormat: "tr",
  unit: "TRY",
};

function createTestArtifact(source: ReportSource): AiArtifact {
  const parsedDoc: ParsedDocument = {
    version: 1,
    sourceId: source.sourceId,
    fileName: source.fileName,
    sha256: source.sha256,
    extension: "csv",
    detectedMime: "text/csv",
    category: "Tablo",
    metadata: {},
    chunks: source.chunks.map((c) => ({
      id: c.id,
      kind: "table" as const,
      locator: c.locator,
      text: "",
      table: c.table,
    })),
    warnings: [],
    parserVersion: "1.0.0",
  };

  const mockResult: AiResult = {
    schemaVersion: 1,
    analysisId: "analysis-1",
    objective: "Test objective",
    summary: [
      {
        text: "Özet bilgi",
        evidence: [{ sourceId: source.sourceId, sha256: source.sha256, chunkId: "c1", locator: {} }],
        metricIds: [],
      },
    ],
    metrics: [
      {
        id: "aggregate",
        label: "Toplam",
        value: 10,
        unit: "TRY",
        status: "available",
        method: "sum",
        evidence: [{ sourceId: source.sourceId, sha256: source.sha256, chunkId: "c1", locator: {} }],
      },
    ],
    findings: [],
    recommendations: [],
    limitations: ["Kapsam sınırları"],
    charts: [],
    datasets: [],
  };

  return {
    version: 1,
    result: mockResult,
    sources: [parsedDoc],
    scope: {
      rows: 1,
      emptyRows: 0,
      groups: 1,
      sheet: null,
      measure: "Revenue",
      group: null,
      selection: defaultSelection,
    },
    locale: "tr",
  };
}

function createJob(sourceId: string): AiJob {
  return {
    sourceId,
    status: "completed",
    attemptId: "att-1",
    attempts: 1,
    startedAt: 1000,
    leaseUntil: 5000,
    maxAttempts: 3,
    stage: "saving",
    locale: "tr",
    selection: defaultSelection,
  };
}

describe("LiveAnalysisReport - downloadSource oturum ve yaşam döngüsü koordinasyonu", () => {
  it("only displays recorded processing measurements and does not invent zero duration", () => {
    const source: ReportSource = { sourceId: "file-0", fileName: "synthetic.csv", sha256: "a".repeat(64), chunks: [{ id: "c1", locator: {}, table: { columns: ["Team", "Amount"], rows: [["A", 10]] } }] };
    const artifact = createTestArtifact(source), job = { ...createJob(source.sourceId), pythonMs: 1250, modelMs: 3000 };
    const view = render(<LiveAnalysisReport artifact={artifact} job={job} analysisId="analysis-1" />);
    expect(screen.getByText("İşlem süresi").nextElementSibling).toHaveTextContent("—");
    expect(screen.getByText("Hesaplama süresi").nextElementSibling).toHaveTextContent("1,3 saniye");
    expect(screen.getByText("Özet süresi").nextElementSibling).toHaveTextContent("3 saniye");
    view.rerender(<LiveAnalysisReport artifact={artifact} job={{ ...job, durationMs: 0 }} analysisId="analysis-1" />);
    expect(screen.getByText("İşlem süresi").nextElementSibling).toHaveTextContent("0 saniye");
  });

  it("geçerli oturum ve doğru hash ile dosyayı indirir (anchor.click çağrılır)", async () => {
    const validHash = await computeSha256(sampleBytes);
    const nativeDigest = crypto.subtle.digest.bind(crypto.subtle);
    let releaseHash!: () => void;
    const hashGate = new Promise<void>(resolve => { releaseHash = resolve; });
    // Gerçek Web Crypto işlemini kontrollü bekletir; tıklamanın hash tamamlanması olmadığını sınar.
    const digest = vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(async (algorithm, data) => {
      await hashGate;
      return nativeDigest(algorithm, data);
    });
    mocks.getBytesMock.mockResolvedValue(sampleBytes);

    const source: ReportSource = {
      sourceId: "src-1",
      fileName: "sales.csv",
      sha256: validHash,
      chunks: [{ id: "c1", locator: {}, table: { columns: ["Channel", "Revenue"], rows: [["A", 10]] } }],
    };

    const artifact = createTestArtifact(source);
    const job = createJob("src-1");

    const user = userEvent.setup();
    render(<LiveAnalysisReport artifact={artifact} job={job} analysisId="analysis-1" />);

    // Metrik kartına tıkla ve dayanak dialog'unu aç
    await user.click(screen.getByRole("button", { name: /Dayanağını incele/i }));

    const downloadBtn = await screen.findByRole("button", { name: "Özgün belgeyi indir" });
    await user.click(downloadBtn);

    await waitFor(() => expect(digest).toHaveBeenCalledTimes(1));
    expect(downloadBtn).toBeDisabled();
    expect(mocks.createObjectURLMock).not.toHaveBeenCalled();
    expect(mocks.anchorClickMock).not.toHaveBeenCalled();
    await act(async () => { releaseHash(); });

    // Native hash tamamlanmadan test sonlanamaz; gerçek indirme yan etkileri birlikte doğrulanır.
    await waitFor(() => {
      expect(mocks.createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(mocks.anchorClickMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Özgün belgeyi indir" })).toBeEnabled();
    });
  });

  it("hash uyuşmazlığında dosyayı indirmez ve bütünlük hatası gösterir", async () => {
    mocks.getBytesMock.mockResolvedValue(sampleBytes);

    const source: ReportSource = {
      sourceId: "src-1",
      fileName: "sales.csv",
      sha256: "0".repeat(64), // geçersiz hash
      chunks: [{ id: "c1", locator: {}, table: { columns: ["Channel"], rows: [["A"]] } }],
    };

    const artifact = createTestArtifact(source);
    const job = createJob("src-1");
    const user = userEvent.setup();
    render(<LiveAnalysisReport artifact={artifact} job={job} analysisId="analysis-1" />);

    await user.click(screen.getByRole("button", { name: /Dayanağını incele/i }));
    const downloadBtn = await screen.findByRole("button", { name: "Özgün belgeyi indir" });

    await user.click(downloadBtn);

    // Hash uyuşmazlığında asla createObjectURL ve click çağrılmamalı
    expect(mocks.createObjectURLMock).not.toHaveBeenCalled();
    expect(mocks.anchorClickMock).not.toHaveBeenCalled();

    // Kullanıcıya güvenli yerelleştirilmiş hata gösterilmeli
    expect(await screen.findByRole("alert")).toHaveTextContent("İndirilen dosya bütünlük kontrolünü geçemedi.");
  });

  it("Storage cevabı beklerken oturum kapandığında veya kullanıcı değiştiğinde indirme iptal edilir", async () => {
    let resolveStorage!: (value: Uint8Array) => void;
    mocks.getBytesMock.mockReturnValue(new Promise((resolve) => { resolveStorage = resolve; }));

    const source: ReportSource = {
      sourceId: "src-1",
      fileName: "sales.csv",
      sha256: "0".repeat(64),
      chunks: [{ id: "c1", locator: {}, table: { columns: ["Channel"], rows: [["A"]] } }],
    };

    const artifact = createTestArtifact(source);
    const job = createJob("src-1");
    const user = userEvent.setup();
    render(<LiveAnalysisReport artifact={artifact} job={job} analysisId="analysis-1" />);

    await user.click(screen.getByRole("button", { name: /Dayanağını incele/i }));
    const downloadBtn = await screen.findByRole("button", { name: "Özgün belgeyi indir" });

    await user.click(downloadBtn);

    // İstek sürerken kullanıcı çıkış yaptı (currentUser = null)
    mocks.currentUser = null;
    await act(async () => {
      resolveStorage(sampleBytes);
    });

    // İndirme tetiklenmemeli
    expect(mocks.createObjectURLMock).not.toHaveBeenCalled();
    expect(mocks.anchorClickMock).not.toHaveBeenCalled();
  });

  it.each(["session", "unmount"])("hash beklerken %s değişirse indirme yan etkisi oluşmaz", async mode => {
    const hash = await computeSha256(sampleBytes);
    let finish!: (value: ArrayBuffer) => void;
    const digest = vi.spyOn(crypto.subtle, "digest").mockReturnValueOnce(new Promise<ArrayBuffer>(resolve => { finish = resolve; }));
    mocks.getBytesMock.mockResolvedValue(sampleBytes);
    const source: ReportSource = { sourceId: "src-1", fileName: "sales.csv", sha256: hash,
      chunks: [{ id: "c1", locator: {}, table: { columns: ["Channel"], rows: [["A"]] } }] };
    const view = render(<LiveAnalysisReport artifact={createTestArtifact(source)} job={createJob(source.sourceId)} analysisId="analysis-1" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Dayanağını incele/i }));
    await user.click(await screen.findByRole("button", { name: "Özgün belgeyi indir" }));
    await waitFor(() => expect(digest).toHaveBeenCalledTimes(1));
    if (mode === "session") mocks.currentUser = { uid: "another-user" };
    else view.unmount();
    await act(async () => { finish(Uint8Array.from(hash.match(/../g)!, byte => parseInt(byte, 16)).buffer); });
    expect(mocks.createObjectURLMock).not.toHaveBeenCalled();
    expect(mocks.anchorClickMock).not.toHaveBeenCalled();
  });

  it("denetlenebilir kapsamı, kaynak penceresi açılışını, doğrulanmış hesap/model ayrımını ve kayıtlı dil değişmezliğini korur", async () => {
    const user = userEvent.setup();
    const hash = await computeSha256(sampleBytes);
    const source: ReportSource = {
      sourceId: "file-0",
      fileName: "hizmetler.xlsx",
      sha256: hash,
      chunks: [{ id: "c1", locator: { sheet: "Gelir", rowStart: 2, rowEnd: 3 }, table: { columns: ["Ekip", "Tutar"], rows: [["Alfa", "10"], ["Beta", "20"]] } }],
    };
    const artifact = createTestArtifact(source);
    artifact.locale = "de";
    artifact.scope = {
      rows: 2,
      emptyRows: 3,
      groups: 2,
      sheet: "Gelir",
      measure: "Tutar",
      group: "Ekip",
      selection: { sheet: "Gelir", valueColumn: 1, groupColumn: 0, aggregation: "mean", numberFormat: "tr", unit: "EUR" },
    };
    artifact.result.summary[0].text = "Gespeicherter deutscher Berichtstext.";
    artifact.result.metrics[0].evidence[0].locator = { sheet: "Gelir", rowStart: 2, rowEnd: 3 };
    artifact.result.summary[0].evidence[0].locator = { sheet: "Gelir", rowStart: 2, rowEnd: 3 };

    // Eski kayıtta eksik süre/token ölçümleri varsa uydurma 0 değer üretilmez.
    const legacyJob: AiJob = {
      status: "completed",
      attemptId: "legacy-1",
      attempts: 1,
      startedAt: 1000,
      finishedAt: 2000,
      leaseUntil: 10000,
      maxAttempts: 3,
      stage: "saving",
      locale: "de",
      sourceId: "file-0",
      selection: artifact.scope.selection,
    };

    render(<LiveAnalysisReport artifact={artifact} job={legacyJob} analysisId="analysis-1" />);

    expect(screen.getByText("Doğrulanmış hesaplar")).toBeVisible();
    expect(screen.getByText("Model yorumu · Kaynaklı özet")).toBeVisible();
    expect(screen.getByText("Gespeicherter deutscher Berichtstext.")).toHaveAttribute("lang", "de");

    await user.click(screen.getByText("İşlem ayrıntıları"));
    expect(screen.getByText("hizmetler.xlsx · Gelir")).toBeVisible();
    expect(screen.getByText("Tutar")).toBeVisible();
    expect(screen.getByText("EUR")).toBeVisible();
    expect(screen.getByText("Ekip (2 grup)")).toBeVisible();
    expect(screen.getByText("3 boş satır hesaplama dışında bırakıldı")).toBeVisible();
    expect(screen.getByText("İşlem süresi").nextElementSibling).toHaveTextContent("—");
    expect(screen.queryByText("Hesaplama süresi")).not.toBeInTheDocument();
    expect(screen.queryByText("Özet süresi")).not.toBeInTheDocument();
    expect(screen.queryByText("Model kullanımı")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kapsam kaynağını incele" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("hizmetler.xlsx · Gelir");
    expect(dialog).toHaveTextContent("Alfa");
    await user.click(screen.getByRole("button", { name: "Kaynak incelemesini kapat" }));

    // Arayüz dili İngilizce'ye çevrilse de kayıtlı raporun dili (Almanca) ve içeriği değişmez.
    act(() => setLocale("en"));
    expect(screen.getByText("Report language: German")).toBeVisible();
    expect(screen.getByText("Gespeicherter deutscher Berichtstext.")).toBeVisible();
    expect(screen.getByText("Verified calculations")).toBeVisible();
    expect(screen.getByText("Model commentary · Grounded summary")).toBeVisible();
  });
});

describe("report metric export", () => {
  const source: ReportSource = {
    sourceId: "file-0", fileName: "test.csv", sha256: "a".repeat(64),
    chunks: [{ id: "c1", locator: {}, table: { columns: ["Team", "Revenue"], rows: [["A", 10]] } }],
  };

  // Raporun ilk oturumunu görünür tutarak tıklama anındaki Firebase kullanıcısını ayrı sınar.
  function showForOwner(artifact = createTestArtifact(source)) {
    return render(<AuthContext.Provider value={{ user: { uid: "user-123" } as User, loading: false, error: "" }}>
      <LiveAnalysisReport artifact={artifact} job={createJob(source.sourceId)} analysisId="analysis-1" />
    </AuthContext.Provider>);
  }

  it.each([null, { uid: "another-user" }])("rejects export after the report's owner session changed (%j)", async session => {
    const user = userEvent.setup();
    showForOwner();
    mocks.currentUser = session;
    await user.click(screen.getByRole("button", { name: "Hesapları CSV olarak indir" }));
    expect(screen.getByRole("alert")).toHaveTextContent("CSV hazırlanamadı");
    expect(mocks.createObjectURLMock).not.toHaveBeenCalled();
    expect(mocks.getBytesMock).not.toHaveBeenCalled();
  });

  it("creates a CSV from the authorized open report without fetching any source bytes", async () => {
    const user = userEvent.setup();
    showForOwner();
    await user.click(screen.getByRole("button", { name: "Hesapları CSV olarak indir" }));
    expect(mocks.createObjectURLMock).toHaveBeenCalledWith(expect.objectContaining({ type: "text/csv;charset=utf-8" }));
    expect(mocks.anchorClickMock).toHaveBeenCalledOnce();
    expect(mocks.getBytesMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a broken evidence link without handing an incomplete export to the browser", async () => {
    const user = userEvent.setup();
    const artifact = createTestArtifact(source);
    artifact.result.metrics[0].evidence[0].sha256 = "b".repeat(64);
    showForOwner(artifact);
    await user.click(screen.getByRole("button", { name: "Hesapları CSV olarak indir" }));
    expect(screen.getByRole("alert")).toHaveTextContent("CSV hazırlanamadı");
    expect(mocks.anchorClickMock).not.toHaveBeenCalled();
  });
});
