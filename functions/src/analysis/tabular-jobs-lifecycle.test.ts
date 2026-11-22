import { describe, expect, it } from "vitest";
import { GeminiError } from "./gemini";
import { AnalysisPacketBudgetError } from "./input-packet";
import { mapWorkerFailure, WorkerError } from "./python-worker";
import { failureCode } from "./tabular-jobs";
import { buildAnalysisTables, validateStoredArtifact, type AiArtifact } from "./tabular-storage";
import { analysisFingerprint } from "./tabular-result";
import type { AiJob } from "./tabular-contract";
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

describe("validateStoredArtifact bütünlük bağı", () => {
  const validSha = "b".repeat(64);
  const selection = { sheet: "Services", valueColumn: 1, groupColumn: 0, aggregation: "mean" as const, numberFormat: "plain" as const, unit: "EUR" as const };
  const reportSource: Report["sources"][number] = {
    id: "file-0", name: "services.xlsx", category: "Tablo", size: 256,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    detectedMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sha256: validSha, status: "ready", chunkCount: 1, characterCount: 60, warnings: [],
  };

  function validV1Artifact(): AiArtifact {
    const anchor = { sourceId: "file-0", sha256: validSha, chunkId: "chunk-1", locator: { sheet: "Services", rowStart: 2, rowEnd: 4 } };
    return {
      version: 1,
      locale: "de",
      scope: { rows: 3, emptyRows: 0, groups: 2, sheet: "Services", measure: "Revenue", group: "Team", selection },
      sources: [{
        version: 1, sourceId: "file-0", fileName: "services.xlsx", sha256: validSha, extension: "xlsx",
        detectedMime: reportSource.detectedMime, category: "Tablo", metadata: {}, warnings: [], parserVersion: "1.0.0",
        chunks: [{ id: "chunk-1", kind: "table", locator: { sheet: "Services", rowStart: 2, rowEnd: 4 }, table: { columns: ["Team", "Revenue"], rows: [["A", 10], ["A", 20], ["B", 90]] } }],
      }],
      result: {
        schemaVersion: 1,
        analysisId: "11111111-1111-4111-8111-111111111111",
        objective: "Compare team averages",
        summary: [{ text: "Verified summary.", metricIds: ["aggregate"], evidence: [anchor] }],
        metrics: [
          { id: "rows", label: "Records", status: "available", value: 3, unit: "count", method: "Count", evidence: [anchor] },
          { id: "aggregate", label: "Mean", status: "available", value: 40, unit: "EUR", method: "Row-weighted mean", evidence: [anchor] },
        ],
        datasets: [],
        charts: [],
        findings: [{ id: "f1", title: "Team spread", kind: "observation", statements: [{ text: "Observed from rows.", metricIds: ["aggregate"], evidence: [anchor] }] }],
        recommendations: [],
        limitations: ["Only selected sheet is included."],
      },
    };
  }

  function validJob(withFingerprint = true): AiJob & { fingerprint?: string } {
    return {
      status: "completed",
      attemptId: "22222222-2222-4222-8222-222222222222",
      attempts: 1,
      startedAt: 1000,
      finishedAt: 2000,
      leaseUntil: 10000,
      maxAttempts: 3,
      stage: "saving",
      locale: "de",
      sourceId: "file-0",
      selection,
      ...(withFingerprint ? { fingerprint: analysisFingerprint(validSha, "file-0", selection, "de") } : {}),
    };
  }

  it("geçerli eski v1 raporunu opsiyonel fingerprint olmadan da açar", () => {
    const artifact = validV1Artifact();
    const verified = validateStoredArtifact(artifact, {
      analysisId: "11111111-1111-4111-8111-111111111111",
      objective: "Compare team averages",
      job: validJob(false),
      reportSource,
    });
    expect(verified.locale).toBe("de");
    expect(verified.scope.sheet).toBe("Services");
    expect(verified.sources[0].sha256).toBe(validSha);
  });

  it("dil, kapsam, kaynak kimliği/hash'i, sayfa, fingerprint veya dayanak bağı uyuşmayan kaydı reddeder", () => {
    const baseExpected = { analysisId: "11111111-1111-4111-8111-111111111111", objective: "Compare team averages", job: validJob(true), reportSource };

    // Dil uyuşmazlığı
    const wrongLocale = validV1Artifact();
    wrongLocale.locale = "en";
    expect(() => validateStoredArtifact(wrongLocale, baseExpected)).toThrow("locale-mismatch");

    // Kapsam / seçim uyuşmazlığı
    const wrongScope = validV1Artifact();
    wrongScope.scope.selection = { ...selection, unit: "USD" };
    expect(() => validateStoredArtifact(wrongScope, baseExpected)).toThrow("scope-mismatch");

    // Kaynak hash uyuşmazlığı
    const wrongSourceHash = validV1Artifact();
    wrongSourceHash.sources[0].sha256 = "c".repeat(64);
    expect(() => validateStoredArtifact(wrongSourceHash, baseExpected)).toThrow("source-integrity-mismatch");

    // Başka sayfa chunk'ı
    const wrongSheetChunk = validV1Artifact();
    wrongSheetChunk.sources[0].chunks[0].locator.sheet = "Out of scope";
    expect(() => validateStoredArtifact(wrongSheetChunk, baseExpected)).toThrow("sheet-integrity-mismatch");

    // Fingerprint uyuşmazlığı
    expect(() => validateStoredArtifact(validV1Artifact(), { ...baseExpected, job: { ...validJob(true), fingerprint: "tampered-fingerprint" } })).toThrow("fingerprint-mismatch");

    // Dayanak çapa (evidence) sayfa veya hash uyuşmazlığı
    const wrongEvidence = validV1Artifact();
    wrongEvidence.result.metrics[0].evidence[0].locator.sheet = "Out of scope";
    expect(() => validateStoredArtifact(wrongEvidence, baseExpected)).toThrow("evidence-integrity-mismatch");

    const wrongEvidenceChunk = validV1Artifact();
    wrongEvidenceChunk.result.summary[0].evidence[0].chunkId = "foreign-chunk";
    expect(() => validateStoredArtifact(wrongEvidenceChunk, baseExpected)).toThrow("evidence-integrity-mismatch");
  });
});
