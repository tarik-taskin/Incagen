import { describe, expect, it } from "vitest";
import { GeminiError } from "./gemini";
import { AnalysisPacketBudgetError } from "./input-packet";
import { mapWorkerFailure, WorkerError } from "./python-worker";
import { failureCode } from "./tabular-jobs";
import { buildAnalysisTables } from "./tabular-storage";
import type { ParsedDocument, Report } from "../contracts";

describe("AI iş yaşam döngüsü hata sınıflandırması", () => {
  it("sağlayıcı busy/timeout, geçersiz yanıt, kapsam aşımı ve eksik anahtar hatalarını ayırır", () => {
    expect(failureCode(new GeminiError("busy"))).toBe("provider-busy");
    expect(failureCode(new GeminiError("timeout"))).toBe("timeout");
    expect(failureCode(new GeminiError("invalid-response"))).toBe("validation");
    expect(failureCode(new GeminiError("invalid-input"))).toBe("validation");
    expect(failureCode(new GeminiError("not-configured"))).toBe("configuration");
    expect(failureCode(new GeminiError("unavailable"))).toBe("provider");
    expect(failureCode(new WorkerError("invalid-data"))).toBe("invalid-data");
    expect(failureCode(new AnalysisPacketBudgetError(300_000, 256_000))).toBe("scope-limit");
    expect(failureCode(new Error("beklenmeyen hata"))).toBe("validation");
  });

  it("Python veri ve kapsam hatalarını ham içerik veya stack trace sızdırmadan sabit kodlara eşler", () => {
    expect(mapWorkerFailure("invalid-number-format")).toBe("invalid-number-format");
    expect(mapWorkerFailure("currency-precision")).toBe("currency-precision");
    expect(mapWorkerFailure("invalid-measure")).toBe("invalid-measure");
    expect(mapWorkerFailure("number-out-of-range")).toBe("invalid-measure");
    expect(mapWorkerFailure("number-precision")).toBe("invalid-measure");
    expect(mapWorkerFailure("invalid-group")).toBe("invalid-group");
    expect(mapWorkerFailure("empty-table")).toBe("empty-table");
    expect(mapWorkerFailure("group-limit")).toBe("group-limit");
    expect(mapWorkerFailure("analysis-row-limit")).toBe("row-limit");
    expect(mapWorkerFailure("evidence-limit")).toBe("scope-limit");
    expect(mapWorkerFailure("result-budget")).toBe("scope-limit");
    expect(mapWorkerFailure("worker-timeout")).toBe("timeout");
    expect(mapWorkerFailure("Traceback: ValueError cell='Musteri Gizli 999'")).toBe("invalid-data");
    expect(mapWorkerFailure(null)).toBe("invalid-data");
    expect(failureCode(new WorkerError("currency-precision"))).toBe("currency-precision");
    expect(failureCode(new WorkerError("group-limit"))).toBe("group-limit");
  });
});

describe("buildAnalysisTables katalog ve önizleme sınırları", () => {
  const baseSource = (id: string, name: string): Report["sources"][number] => ({
    id, name, category: "Tablo", size: 120, contentType: "text/csv", detectedMime: "text/csv",
    sha256: "a".repeat(64), status: "ready", chunkCount: 1, characterCount: 40, warnings: [],
  });
  const baseDoc = (sourceId: string, fileName: string, chunks: ParsedDocument["chunks"]): ParsedDocument => ({
    version: 1, sourceId, fileName, sha256: "a".repeat(64), extension: fileName.endsWith(".xlsx") ? "xlsx" : "csv",
    detectedMime: "text/csv", category: "Tablo", metadata: {}, chunks, warnings: [], parserVersion: "1.0.0",
  });

  it("örnek satırları 5 ile sınırlar, çok sayfalı XLSX ile aynı adlı dosyaları ve sorunlu tabloları ayırır", async () => {
    const sources: Report["sources"] = [
      baseSource("file-0", "satis.xlsx"),
      baseSource("file-1", "bos.csv"),
      baseSource("file-2", "bozuk.csv"),
      baseSource("file-3", "tutarsiz.csv"),
    ];
    const docs: Record<string, ParsedDocument> = {
      "file-0": baseDoc("file-0", "satis.xlsx", [
        {
          id: "c1", kind: "table", locator: { sheet: "Q1", rowStart: 2, rowEnd: 8 },
          table: {
            columns: ["Ekip", "Tutar"],
            rows: Array.from({ length: 7 }, (_, i) => [`Ekip-${i + 1}`, i === 0 ? "x".repeat(160) : (i + 1) * 10]),
          },
        },
        {
          id: "c2", kind: "table", locator: { sheet: "Q2", rowStart: 2, rowEnd: 3 },
          table: { columns: ["Ekip", "Tutar"], rows: [["", ""], ["  ", null]] },
        },
      ]),
      "file-1": baseDoc("file-1", "bos.csv", []),
      "file-3": baseDoc("file-3", "tutarsiz.csv", [
        { id: "t1", kind: "table", locator: { rowStart: 1, rowEnd: 1 }, table: { columns: ["A", "B"], rows: [["1", "2"]] } },
        { id: "t2", kind: "table", locator: { rowStart: 2, rowEnd: 2 }, table: { columns: ["A", "C"], rows: [["3", "4"]] } },
      ]),
    };

    const tables = await buildAnalysisTables(sources, async source => {
      if (source.id === "file-2") throw new Error("corrupt gzip");
      return docs[source.id];
    });

    const q1 = tables.find(item => item.sourceId === "file-0" && item.sheet === "Q1")!;
    expect(q1.rows).toBe(7);
    expect(q1.nonEmptyRows).toBe(7);
    expect(q1.unavailableReason).toBeUndefined();
    expect(q1.sampleRows).toHaveLength(5);
    expect(q1.sampleRows![0].row).toBe(2);
    expect(String(q1.sampleRows![0].values[1]).length).toBeLessThanOrEqual(120);

    const q2 = tables.find(item => item.sourceId === "file-0" && item.sheet === "Q2")!;
    expect(q2.unavailableReason).toBe("empty-table");

    expect(tables.find(item => item.sourceId === "file-1")?.unavailableReason).toBe("empty-table");
    expect(tables.find(item => item.sourceId === "file-2")?.unavailableReason).toBe("unreadable-table");
    expect(tables.find(item => item.sourceId === "file-3")?.unavailableReason).toBe("inconsistent-columns");
  });
});
