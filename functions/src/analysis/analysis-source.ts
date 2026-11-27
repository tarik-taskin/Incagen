import { createHash } from "node:crypto";
import { addAbortSignal } from "node:stream";
import type { Bucket } from "@google-cloud/storage";
import { beforeAbort } from "./analysis-deadline";
import { WorkerError } from "./python-worker";

// Hazırlığı doğrulanan neslin boyutunu, okunan baytları ve SHA-256 özetini birlikte kontrol eder.
export async function readOriginalTable(bucket: Bucket, path: string, source: { size: number; sha256: string }, timeoutMs: number) {
  if (!Number.isSafeInteger(source.size) || source.size <= 0 || source.size > 25 * 1024 * 1024) throw new WorkerError("invalid-data");
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const [metadata] = await beforeAbort(signal, () => bucket.file(path).getMetadata());
    const generation = String(metadata.generation ?? "");
    if (Number(metadata.size) !== source.size || !/^\d+$/.test(generation)) throw new WorkerError("invalid-data");
    signal.throwIfAborted();
    const stream = addAbortSignal(signal, bucket.file(path, { generation }).createReadStream({ decompress: false }));
    const chunks: Buffer[] = [];
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.byteLength;
      if (bytes > source.size) throw new WorkerError("invalid-data");
      chunks.push(buffer);
      hash.update(buffer);
    }
    if (bytes !== source.size || hash.digest("hex") !== source.sha256) throw new WorkerError("invalid-data");
    return Buffer.concat(chunks, bytes);
  } catch (error) {
    if (signal.aborted) throw new WorkerError("timeout");
    if (error instanceof WorkerError) throw error;
    throw new WorkerError("invalid-data");
  }
}
