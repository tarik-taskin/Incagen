import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { computeTable } from "./python-worker";
import type { TableSelection } from "./tabular-contract";

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), emulator: vi.fn(), getIdTokenClient: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("./tabular-rollout", () => ({ isAnalysisEmulator: mocks.emulator }));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getIdTokenClient = mocks.getIdTokenClient; } }));

const selection: TableSelection = { sheet: null, valueColumn: 1, groupColumn: null, aggregation: "sum", numberFormat: "plain", unit: "EUR" };
const input = Buffer.from("Product,Revenue\nExample,20\n");
const fetchWorker = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("INCAGEN_PYTHON_WORKER_URL", "https://synthetic-worker.run.app");
  vi.stubGlobal("fetch", fetchWorker);
  mocks.getIdTokenClient.mockResolvedValue({ getRequestHeaders: async () => new Headers({ Authorization: "Bearer synthetic-identity" }) });
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

// Sahte yerel işçide süreç kapanışını ve çıktı akışını birlikte gözlemler.
function mockLocalChild() {
  mocks.emulator.mockReturnValue(true);
  const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stdin: Object.assign(new EventEmitter(), { end: vi.fn() }) });
  const kill = vi.fn(() => child.emit("close", null, "SIGKILL"));
  mocks.spawn.mockReturnValue(Object.assign(child, { kill }));
  return { child, kill };
}

it("aborts a local worker with a distinct deadline error", async () => {
  vi.useFakeTimers();
  const { kill } = mockLocalChild();
  const result = expect(computeTable(input, "file-0", "synthetic.csv", selection)).rejects.toMatchObject({ code: "timeout" });
  await vi.advanceTimersByTimeAsync(60_000);
  await result;
  expect(kill).toHaveBeenCalledExactlyOnceWith("SIGKILL");
});

it("stops collecting local stdout as soon as its byte budget is crossed", async () => {
  const { child, kill } = mockLocalChild();
  const result = expect(computeTable(input, "file-0", "synthetic.csv", selection)).rejects.toMatchObject({ code: "scope-limit" });
  child.stdout.emit("data", Buffer.alloc(4 * 1024 * 1024));
  child.stdout.emit("data", Buffer.from("界"));
  await result;
  expect(kill).toHaveBeenCalledOnce();
});

it.each([[413, "scope-limit"], [504, "timeout"], [403, "configuration"]])("maps Cloud Run HTTP %s safely and prohibits redirects", async (status, code) => {
  fetchWorker.mockResolvedValue(new Response("private worker details", { status: status as number }));
  await expect(computeTable(input, "file-0", "synthetic.csv", selection)).rejects.toMatchObject({ code });
  expect(mocks.getIdTokenClient).toHaveBeenCalledExactlyOnceWith("https://synthetic-worker.run.app");
  expect(fetchWorker).toHaveBeenCalledExactlyOnceWith("https://synthetic-worker.run.app/analyze",
    expect.objectContaining({ method: "POST", redirect: "error", signal: expect.any(AbortSignal), body: new Uint8Array(input) }));
});

it("also recognizes a transport deadline while awaiting the Cloud Run response", async () => {
  fetchWorker.mockRejectedValue(new DOMException("synthetic transport failure", "TimeoutError"));
  await expect(computeTable(input, "file-0", "synthetic.csv", selection)).rejects.toMatchObject({ code: "timeout" });
});

it("expires during Cloud Run identity acquisition with no worker request", async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(controller.signal);
  try {
    let finishIdentity!: (value: unknown) => void;
    mocks.getIdTokenClient.mockReturnValue(new Promise(resolve => { finishIdentity = resolve; }));
    const result = expect(computeTable(input, "file-0", "synthetic.csv", selection, 1600)).rejects.toMatchObject({ code: "timeout" });
    await Promise.resolve();
    controller.abort(new DOMException("synthetic deadline", "TimeoutError"));
    await result;
    finishIdentity({ getRequestHeaders: vi.fn() });
    expect(timeout).toHaveBeenCalledExactlyOnceWith(1600);
    expect(fetchWorker).not.toHaveBeenCalled();
  } finally { timeout.mockRestore(); }
});

it("bounds the streamed Cloud Run body even without a Content-Length header", async () => {
  const cancel = vi.fn();
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(4 * 1024 * 1024)); controller.enqueue(new Uint8Array(1)); },
    cancel,
  });
  fetchWorker.mockResolvedValue(new Response(body));
  await expect(computeTable(input, "file-0", "synthetic.csv", selection)).rejects.toMatchObject({ code: "scope-limit" });
  expect(cancel).toHaveBeenCalledOnce();
});

it("preserves the existing typed Cloud Run 422 response", async () => {
  fetchWorker.mockResolvedValue(Response.json({ error: "invalid-number-format" }, { status: 422 }));
  await expect(computeTable(input, "file-0", "synthetic.csv", selection)).rejects.toMatchObject({ code: "invalid-number-format" });
});
