import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  it("geçerli oturum ve doğru hash ile dosyayı indirir (anchor.click çağrılır)", async () => {
    const validHash = await computeSha256(sampleBytes);
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

    // İndirme tetiklenmeli
    expect(mocks.createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(mocks.anchorClickMock).toHaveBeenCalledTimes(1);
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
    act(() => {
      resolveStorage(sampleBytes);
    });

    // İndirme tetiklenmemeli
    expect(mocks.createObjectURLMock).not.toHaveBeenCalled();
    expect(mocks.anchorClickMock).not.toHaveBeenCalled();
  });
});
