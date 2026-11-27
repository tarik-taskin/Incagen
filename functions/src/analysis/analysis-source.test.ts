import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import type { Bucket } from "@google-cloud/storage";
import { expect, it, vi } from "vitest";
import { readOriginalTable } from "./analysis-source";

const bytes = Buffer.from("Product,Amount\nWeb,15\n");
const source = { size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
const path = "synthetic-table";

// Metadata ve nesil bağlı medya isteğini testte bağımsız döndürür.
function storage(chunks: Buffer[], generation = "1700000000000001") {
  const read = vi.fn(() => Readable.from(chunks));
  const file = vi.fn((_path: string, options?: { generation: string }) => options
    ? { createReadStream: read }
    : { getMetadata: vi.fn().mockResolvedValue([{ size: bytes.length, generation }]) });
  return { bucket: { file } as unknown as Bucket, file, read, generation };
}

it("pins the streamed bytes to the checked object generation", async () => {
  const { bucket, file, generation, read } = storage([bytes.subarray(0, 4), bytes.subarray(4)]);
  await expect(readOriginalTable(bucket, path, source, 1000)).resolves.toEqual(bytes);
  expect(file.mock.calls).toEqual([[path], [path, { generation }]]);
  expect(read).toHaveBeenCalledExactlyOnceWith({ decompress: false });
});

it.each([Buffer.alloc(1), Buffer.alloc(bytes.length), Buffer.alloc(bytes.length + 1)])("rejects incomplete, changed or oversized actual bytes", async actual => {
  await expect(readOriginalTable(storage([actual]).bucket, path, source, 1000)).rejects.toMatchObject({ code: "invalid-data" });
});

it("does not open a stream without verified generation metadata", async () => {
  const { bucket, read } = storage([bytes], "");
  await expect(readOriginalTable(bucket, path, source, 1000)).rejects.toMatchObject({ code: "invalid-data" });
  expect(read).not.toHaveBeenCalled();
});
