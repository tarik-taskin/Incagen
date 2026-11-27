import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { GoogleAuth } from "google-auth-library";
import type { TableSelection, WorkerResult } from "./tabular-contract";
import { workerResultSchema } from "./tabular-contract";
import { isAnalysisEmulator } from "./tabular-rollout";
import { beforeAbort } from "./analysis-deadline";

const workerLimits = { outputBytes: 4 * 1024 * 1024, localTimeoutMs: 60_000, cloudTimeoutMs: 70_000 } as const;

export type WorkerFailureCode =
  | "invalid-data"
  | "invalid-number-format"
  | "currency-precision"
  | "invalid-measure"
  | "invalid-group"
  | "empty-table"
  | "group-limit"
  | "row-limit"
  | "scope-limit"
  | "configuration"
  | "timeout";

export class WorkerError extends Error {
  constructor(readonly code: WorkerFailureCode) { super(code); }
}

// Python işçi hata kodlarını yalnızca sabit, güvenli bir izin listesine indirger; ham veri veya stack trace taşımaz.
export function mapWorkerFailure(reason: unknown): WorkerFailureCode {
  const code = typeof reason === "string" ? reason : "";
  switch (code) {
    case "invalid-number-format": return "invalid-number-format";
    case "currency-precision": return "currency-precision";
    case "invalid-measure":
    case "number-out-of-range":
    case "number-precision": return "invalid-measure";
    case "invalid-group": return "invalid-group";
    case "empty-table": return "empty-table";
    case "group-limit": return "group-limit";
    case "analysis-row-limit": return "row-limit";
    case "evidence-limit":
    case "result-budget": return "scope-limit";
    case "worker-timeout": return "timeout";
    default: return "invalid-data";
  }
}

// Python hatalarını belge içeriği/ham servis yanıtı taşımayan sınırlı hata türlerine indirger.
function unwrap(response: unknown): WorkerResult {
  if (response && typeof response === "object" && "error" in response) {
    throw new WorkerError(mapWorkerFailure((response as { error?: unknown }).error));
  }
  try { return workerResultSchema.parse((response as { result: unknown }).result); }
  catch { throw new WorkerError("invalid-data"); }
}

// İşçi JSON’u okunamıyorsa belge içeriği veya parser hata ayrıntısı taşınmaz.
function parseWorkerJson(bytes: Uint8Array): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new WorkerError("invalid-data"); }
}

// Yalnız izole demo emülatöründe sabit Python modülünü çalıştırır; çocuk ortama sağlayıcı anahtarı geçmez.
async function localWorker(data: Buffer, metadata: string, timeoutMs: number): Promise<unknown> {
  return new Promise((accept, reject) => {
    const child = spawn(resolve(__dirname, "../../../python/.venv/bin/python"), ["-m", "incagen_extract.worker_cli"], {
      env: { PATH: process.env.PATH, PYTHONPATH: resolve(__dirname, "../../../python/src"), INCAGEN_WORKER_METADATA: metadata, OPENBLAS_NUM_THREADS: "1" },
      stdio: ["pipe", "pipe", "ignore"],
    });
    const buffers: Buffer[] = [];
    let bytes = 0, stopped: WorkerFailureCode | undefined;
    // İlk durdurma nedeni korunur; yarım stdout başarılı işçi cevabı sayılmaz.
    function stop(code: WorkerFailureCode) {
      if (stopped) return;
      stopped = code;
      child.kill("SIGKILL");
    }
    const deadline = setTimeout(() => stop("timeout"), timeoutMs);
    deadline.unref();
    child.stdout.on("data", (chunk: Buffer) => {
      if (stopped) return;
      bytes += chunk.length;
      if (bytes > workerLimits.outputBytes) stop("scope-limit");
      else buffers.push(chunk);
    });
    child.once("error", () => { clearTimeout(deadline); reject(new WorkerError(stopped ?? "configuration")); });
    child.once("close", (_code, signal) => {
      clearTimeout(deadline);
      if (stopped || signal) return reject(new WorkerError(stopped ?? "configuration"));
      try { accept(parseWorkerJson(Buffer.concat(buffers))); } catch (error) { reject(error); }
    });
    child.stdin.on("error", () => undefined); child.stdin.end(data);
  });
}

// Gerçek gövde baytlarını akışta sınırlar; Content-Length üst sınırı tek başına kanıtlamaz.
async function boundedCloudBody(response: Response) {
  if (!response.body) throw new WorkerError("invalid-data");
  const reader = response.body.getReader();
  const buffers: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return Buffer.concat(buffers);
      bytes += value.byteLength;
      if (bytes > workerLimits.outputBytes) {
        void reader.cancel().catch(() => {});
        throw new WorkerError("scope-limit");
      }
      buffers.push(value);
    }
  } finally { reader.releaseLock(); }
}

// Tek güvenilir Cloud Run adresine OIDC audience ile ham dosya gönderir; dosya/URL/kod istemciden çalıştırılmaz.
export async function computeTable(data: Buffer, sourceId: string, fileName: string, selection: TableSelection, availableMs: number = workerLimits.cloudTimeoutMs) {
  if (availableMs <= 0) throw new WorkerError("timeout");
  const metadata = Buffer.from(JSON.stringify({ sourceId, fileName, selection })).toString("base64");
  if (isAnalysisEmulator()) return unwrap(await localWorker(data, metadata, Math.min(availableMs, workerLimits.localTimeoutMs)));
  let url: URL;
  try { url = new URL(process.env.INCAGEN_PYTHON_WORKER_URL || ""); }
  catch { throw new WorkerError("configuration"); }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".run.app") || url.pathname !== "/" || url.username || url.password || url.search || url.hash || url.port) throw new WorkerError("configuration");
  try {
    const signal = AbortSignal.timeout(Math.min(availableMs, workerLimits.cloudTimeoutMs));
    const headers = await beforeAbort(signal, async () => {
      const client = await new GoogleAuth().getIdTokenClient(url.origin);
      signal.throwIfAborted();
      return client.getRequestHeaders();
    });
    headers.set("Content-Type", "application/octet-stream");
    headers.set("X-Incagen-Metadata", metadata);
    const response = await fetch(`${url.origin}/analyze`, { method: "POST", headers, body: new Uint8Array(data),
      redirect: "error", signal });
    if (response.status !== 200 && response.status !== 422) {
      void response.body?.cancel().catch(() => {});
      if (response.status === 408 || response.status === 504) throw new WorkerError("timeout");
      if (response.status === 413) throw new WorkerError("scope-limit");
      throw new WorkerError("configuration");
    }
    return unwrap(parseWorkerJson(await beforeAbort(signal, () => boundedCloudBody(response))));
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new WorkerError("timeout");
    throw new WorkerError("configuration");
  }
}
