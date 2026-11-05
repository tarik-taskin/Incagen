import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { GoogleAuth } from "google-auth-library";
import type { TableSelection, WorkerResult } from "./tabular-contract";
import { workerResultSchema } from "./tabular-contract";

export class WorkerError extends Error {
  constructor(readonly code: "invalid-data" | "scope-limit" | "configuration" | "timeout") { super(code); }
}

// Üretim yetkileri ve sağlayıcı bağlantıları demo projesinin emülatörüne taşınmaz.
export function isAnalysisEmulator() {
  return process.env.FUNCTIONS_EMULATOR === "true" && (process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "").startsWith("demo-");
}

// Python hatalarını belge içeriği/ham servis yanıtı taşımayan sınırlı hata türlerine indirger.
function unwrap(response: unknown): WorkerResult {
  if (response && typeof response === "object" && "error" in response) {
    const reason = String(response.error);
    throw new WorkerError(["analysis-row-limit", "group-limit", "evidence-limit", "result-budget"].includes(reason) ? "scope-limit" : reason === "worker-timeout" ? "timeout" : "invalid-data");
  }
  try { return workerResultSchema.parse((response as { result: unknown }).result); }
  catch { throw new WorkerError("invalid-data"); }
}

// Yalnız izole demo emülatöründe sabit Python modülünü çalıştırır; çocuk ortama sağlayıcı anahtarı geçmez.
async function localWorker(data: Buffer, metadata: string): Promise<unknown> {
  return new Promise((accept, reject) => {
    const child = spawn(resolve(__dirname, "../../../python/.venv/bin/python"), ["-m", "incagen_extract.worker_cli"], {
      env: { PATH: process.env.PATH, PYTHONPATH: resolve(__dirname, "../../../python/src"), INCAGEN_WORKER_METADATA: metadata, OPENBLAS_NUM_THREADS: "1" },
      stdio: ["pipe", "pipe", "ignore"], timeout: 60_000, killSignal: "SIGKILL",
    });
    const buffers: Buffer[] = []; let bytes = 0;
    child.stdout.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) child.kill("SIGKILL"); else buffers.push(chunk); });
    child.on("error", () => reject(new WorkerError("configuration")));
    child.on("close", () => { try { accept(JSON.parse(Buffer.concat(buffers).toString("utf8"))); } catch { reject(new WorkerError("invalid-data")); } });
    child.stdin.on("error", () => undefined); child.stdin.end(data);
  });
}

// Tek güvenilir Cloud Run adresine OIDC audience ile ham dosya gönderir; dosya/URL/kod istemciden çalıştırılmaz.
export async function computeTable(data: Buffer, sourceId: string, fileName: string, selection: TableSelection) {
  const metadata = Buffer.from(JSON.stringify({ sourceId, fileName, selection })).toString("base64");
  if (isAnalysisEmulator()) return unwrap(await localWorker(data, metadata));
  let url: URL;
  try { url = new URL(process.env.INCAGEN_PYTHON_WORKER_URL || ""); }
  catch { throw new WorkerError("configuration"); }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".run.app") || url.pathname !== "/" || url.username || url.password || url.search || url.hash) throw new WorkerError("configuration");
  try {
    const client = await new GoogleAuth().getIdTokenClient(url.origin);
    const response = await client.request({ url: `${url.origin}/analyze`, method: "POST", data,
      headers: { "Content-Type": "application/octet-stream", "X-Incagen-Metadata": metadata },
      timeout: 70_000, retry: false, responseType: "json", maxContentLength: 4 * 1024 * 1024, validateStatus: code => code === 200 || code === 422,
    });
    return unwrap(response.data);
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw new WorkerError("configuration");
  }
}
