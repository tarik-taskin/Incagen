import { describe, expect, it } from "vitest";
import { GeminiError } from "./gemini";
import { AnalysisPacketBudgetError } from "./input-packet";
import { mapWorkerFailure, WorkerError } from "./python-worker";
import { failureCode, failureDisposition } from "./tabular-jobs";
import { buildAnalysisTables, fitAnalysisTablesBudget, parseCsvTablePreview, validateStoredArtifact, type AiArtifact } from "./tabular-storage";
import { analysisFingerprint } from "./tabular-result";
import { AI_JOB_LIMITS, hasActiveAnalysisLease, type AiJob } from "./tabular-contract";
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

  it("CSV önizlemesinde düz, boş satırlı ve tırnak içinde satır sonlu dosya satırlarını korur; eski kayıtta kayıt sırası döner", async () => {
    const plainCsv = Buffer.from("Channel,Revenue\nWeb,0.10\nStore,0.20\n", "utf8");
    const blankLineCsv = Buffer.from("Channel,Revenue\nWeb,0.10\n\nStore,0.20\n", "utf8");
    const quotedNewlineCsv = Buffer.from('Channel,Note,Revenue\nWeb,"First line\nSecond line",0.10\nStore,Single,0.20\n', "utf8");

    const plain = parseCsvTablePreview(plainCsv, { id: "file-0", name: "plain.csv" });
    expect(plain.sampleRowNumbering).toBe("file-line");
    expect(plain.rows).toBe(2);
    expect(plain.nonEmptyRows).toBe(2);
    expect(plain.sampleRows).toEqual([
      { row: 2, values: ["Web", "0.10"] },
      { row: 3, values: ["Store", "0.20"] },
    ]);

    const blank = parseCsvTablePreview(blankLineCsv, { id: "file-1", name: "blank.csv" });
    expect(blank.sampleRowNumbering).toBe("file-line");
    expect(blank.rows).toBe(3);
    expect(blank.nonEmptyRows).toBe(2);
    expect(blank.unavailableReason).toBeUndefined();
    expect(blank.sampleRows).toEqual([
      { row: 2, values: ["Web", "0.10"] },
      { row: 3, values: [null, null] },
      { row: 4, values: ["Store", "0.20"] },
    ]);

    const multiline = parseCsvTablePreview(quotedNewlineCsv, { id: "file-2", name: "quoted.csv" });
    expect(multiline.sampleRowNumbering).toBe("file-line");
    expect(multiline.rows).toBe(2);
    expect(multiline.nonEmptyRows).toBe(2);
    expect(multiline.sampleRows).toEqual([
      { row: 2, values: ["Web", "First line\nSecond line", "0.10"] },
      { row: 4, values: ["Store", "Single", "0.20"] },
    ]);

    // Ham CSV erişilemeyen eski kayıtta fiziksel konum uydurulmaz; açıkça "record" döner.
    const legacySource = baseSource("file-legacy", "legacy.csv");
    const legacyDoc = baseDoc("file-legacy", "legacy.csv", [
      { id: "c1", kind: "table", locator: { section: "tablo", rowStart: 1, rowEnd: 2 }, table: { columns: ["Channel", "Revenue"], rows: [["Web", "0.10"], ["Store", "0.20"]] } },
    ]);
    legacyDoc.parserVersion = "incagen-python/0.1.0";
    legacyDoc.chunks[0].locator = { section: "table", rowStart: 3, rowEnd: 4 };
    const [legacyTable] = await buildAnalysisTables([legacySource], async () => legacyDoc, async () => null);
    expect(legacyTable.sampleRowNumbering).toBe("record");
    expect(legacyTable.sampleRows?.map(r => r.row)).toEqual([1, 2]);
  });

  it("ayırt edilebilir olmayan CSV'lere örnek döndürmez ve büyük kayıtları sınırlar", () => {
    const source = { id: "file-0", name: "data.csv" };
    expect(parseCsvTablePreview(Buffer.from("\n\n"), source).unavailableReason).toBe("empty-table");
    expect(parseCsvTablePreview(Buffer.from("A,B\nx,1\ny\n"), source)).toMatchObject({
      unavailableReason: "inconsistent-columns", sampleRows: [],
    });
    expect(parseCsvTablePreview(Buffer.from(`A,B\n${"x".repeat(100_001)},1\n`), source)).toMatchObject({
      unavailableReason: "unreadable-table", sampleRows: [],
    });
  });

  it("5 geçerli geniş CSV ve çok baytlı UTF-8 hücrelerle 512 KiB JSON byte bütçesini aşmadan tablo ve sütunları döndürür", async () => {
    const columnCount = 200;
    const columns = Array.from({ length: columnCount }, (_, i) => `Kolon_${i + 1}`);
    const makeWideDoc = (sourceId: string, fileName: string, cellText: string) => baseDoc(sourceId, fileName, [{
      id: `${sourceId}:table:0001`,
      kind: "table",
      locator: { section: "tablo", rowStart: 1, rowEnd: 5 },
      table: {
        columns,
        rows: Array.from({ length: 5 }, (_, rowIdx) => Array.from({ length: columnCount }, (_, colIdx) => `${rowIdx}-${colIdx}-${cellText}`)),
      },
    }]);

    // 5 geniş ASCII CSV (~729 KiB ham örnek)
    const asciiSources = Array.from({ length: 5 }, (_, i) => baseSource(`file-${i}`, `genis-${i + 1}.csv`));
    const asciiDocs = Object.fromEntries(asciiSources.map(s => [s.id, makeWideDoc(s.id, s.name, "a".repeat(120))]));
    const asciiTables = await buildAnalysisTables(asciiSources, async source => asciiDocs[source.id]);
    expect(asciiTables).toHaveLength(5);
    expect(Buffer.byteLength(JSON.stringify(asciiTables), "utf8")).toBeLessThanOrEqual(512 * 1024);
    for (const table of asciiTables) {
      expect(table.columns).toHaveLength(columnCount);
      expect(table.rows).toBe(5);
      expect(table.unavailableReason).toBeUndefined();
    }

    // Çok baytlı UTF-8 içerik (Türkçe, Çince, Arapça, 4-bayt emoji) gerçek UTF-8 byte boyutuyla sınırlanır
    const multibyteSources = Array.from({ length: 5 }, (_, i) => baseSource(`mb-${i}`, `cokbayt-${i + 1}.csv`));
    const multibyteDocs = Object.fromEntries(multibyteSources.map(s => [s.id, makeWideDoc(s.id, s.name, "ğşçİÖÜ中ع🚀".repeat(16))]));
    const multibyteTables = await buildAnalysisTables(multibyteSources, async source => multibyteDocs[source.id]);
    expect(multibyteTables).toHaveLength(5);
    const response = { result: { tables: multibyteTables, limits: { rows: 5000, groups: 12, attempts: 3 } } };
    expect(Buffer.byteLength(JSON.stringify(response), "utf8")).toBeLessThanOrEqual(512 * 1024);
    for (const table of multibyteTables) {
      expect(table.columns).toHaveLength(columnCount);
      expect(table.rows).toBe(5);
    }

    // Örnekler bütçeye hiç sığmadığında sampleRows temizlenir ama tablo ve sütun bilgileri korunur
    const tight = fitAnalysisTablesBudget(asciiTables, 20 * 1024);
    expect(tight).toHaveLength(5);
    expect(tight.every(table => table.columns.length === columnCount && (table.sampleRows?.length ?? 0) === 0)).toBe(true);
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

  it("saklanan ölçüm adı veya boş satır adedi kaynakla uyuşmadığında raporu reddeder", () => {
    const expected = {
      analysisId: "11111111-1111-4111-8111-111111111111",
      objective: "Compare team averages",
      job: validJob(false),
      reportSource,
    };
    const artifact = validV1Artifact();
    artifact.scope.measure = "Team";
    expect(() => validateStoredArtifact(artifact, expected)).toThrow("scope-columns-mismatch");
    artifact.scope.measure = "Revenue";
    artifact.scope.emptyRows = 1;
    expect(() => validateStoredArtifact(artifact, expected)).toThrow("scope-row-count-mismatch");
    artifact.sources[0].chunks[0].table!.rows.push([null, null]);
    artifact.sources[0].chunks[0].locator.rowEnd = 5;
    expect(validateStoredArtifact(artifact, expected).scope.emptyRows).toBe(1);
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

    // Dayanak çapa (evidence) sayfa, parça veya satır aralığı uyuşmazlığı (mevcut kaynak doğrulama mantığı)
    const wrongEvidence = validV1Artifact();
    wrongEvidence.result.metrics[0].evidence[0].locator.sheet = "Out of scope";
    expect(() => validateStoredArtifact(wrongEvidence, baseExpected)).toThrow("Kaynak konumu eşleşmiyor.");

    const wrongEvidenceChunk = validV1Artifact();
    wrongEvidenceChunk.result.summary[0].evidence[0].chunkId = "foreign-chunk";
    expect(() => validateStoredArtifact(wrongEvidenceChunk, baseExpected)).toThrow("Kaynak parçası bulunamadı.");

    const outOfRangeEvidence = validV1Artifact();
    outOfRangeEvidence.result.metrics[0].evidence[0].locator = { sheet: "Services", rowStart: 2, rowEnd: 9 };
    expect(() => validateStoredArtifact(outOfRangeEvidence, baseExpected)).toThrow("Kaynak satırı parçanın dışında.");

    const wrongDimensionEvidence = validV1Artifact();
    wrongDimensionEvidence.result.metrics[0].evidence[0].locator = { section: "table", rowStart: 2, rowEnd: 4 };
    expect(() => validateStoredArtifact(wrongDimensionEvidence, baseExpected)).toThrow("Kaynak konumunun boyutları değiştirilemez.");

    // Grafik ve veri kümesi referansları arayüze dönmeden doğrulanır
    const brokenChart = validV1Artifact();
    brokenChart.result.charts = [{ id: "group-chart", title: "Teams", type: "horizontal-bar", datasetId: "missing-dataset" }];
    expect(() => validateStoredArtifact(brokenChart, baseExpected)).toThrow("Grafik veri kümesi sonuçta bulunamadı.");

    const brokenDataset = validV1Artifact();
    brokenDataset.result.datasets = [{ id: "groups", label: "Teams", unit: "EUR", points: [{ label: "A", metricId: "missing-metric", value: 15 }] }];
    expect(() => validateStoredArtifact(brokenDataset, baseExpected)).toThrow("Veri kümesi/metrik değeri veya birimi eşleşmiyor.");

    const mismatchedDatasetValue = validV1Artifact();
    mismatchedDatasetValue.result.metrics.push({ id: "group-1", label: "A", status: "available", value: 15, unit: "EUR", method: "Mean", evidence: [{ sourceId: "file-0", sha256: validSha, chunkId: "chunk-1", locator: { sheet: "Services", rowStart: 2, rowEnd: 3 } }] });
    mismatchedDatasetValue.result.datasets = [{ id: "groups", label: "Teams", unit: "EUR", points: [{ label: "A", metricId: "group-1", value: 999 }] }];
    expect(() => validateStoredArtifact(mismatchedDatasetValue, baseExpected)).toThrow("Veri kümesi/metrik değeri veya birimi eşleşmiyor.");

    const unusedChartMetric = validV1Artifact();
    const groupAnchor = { sourceId: "file-0", sha256: validSha, chunkId: "chunk-1", locator: { sheet: "Services", rowStart: 2, rowEnd: 3 } };
    unusedChartMetric.result.metrics.push({ id: "group-1", label: "A", status: "available", value: 15, unit: "EUR", method: "Mean", evidence: [groupAnchor] });
    unusedChartMetric.result.datasets = [{ id: "groups", label: "Teams", unit: "EUR", points: [{ label: "A", metricId: "group-1", value: 15 }] }];
    unusedChartMetric.result.charts = [{ id: "group-chart", title: "Teams", type: "horizontal-bar", datasetId: "groups" }];
    expect(() => validateStoredArtifact(unusedChartMetric, baseExpected)).toThrow("Grafik metriği kaynaklı bulgu/özette kullanılmıyor.");

    // Grafik ve veri kümesi tutarlı olan geçerli eski v1 raporu (fingerprint olmadan) açılmaya devam eder
    const validWithChart = structuredClone(unusedChartMetric);
    validWithChart.result.findings.push({ id: "verified-groups", title: "Groups", kind: "observation", statements: [{ text: "Group values.", metricIds: ["group-1"], evidence: [groupAnchor] }] });
    const verifiedWithChart = validateStoredArtifact(validWithChart, { ...baseExpected, job: validJob(false) });
    expect(verifiedWithChart.result.charts).toHaveLength(1);
    expect(verifiedWithChart.result.datasets[0].points[0].value).toBe(15);
  });
});

describe("attempt ownership and artifact finalization", () => {
  it("uses the earliest deadline and ends ownership exactly at expiry", () => {
    const startedAt = 1000;
    const hardDeadline = startedAt + AI_JOB_LIMITS.leaseMs;
    const previous = { status: "running" as const, startedAt };
    expect(hasActiveAnalysisLease(previous, hardDeadline - 1)).toBe(true);
    expect(hasActiveAnalysisLease(previous, hardDeadline)).toBe(false);
    expect(hasActiveAnalysisLease({ ...previous, leaseUntil: hardDeadline + 1000 }, hardDeadline)).toBe(false);
    expect(hasActiveAnalysisLease({ ...previous, leaseUntil: 2000 }, 2000)).toBe(false);
    expect(hasActiveAnalysisLease({ ...previous, startedAt: Number.NaN }, 0)).toBe(false);
    expect(hasActiveAnalysisLease({ ...previous, status: "failed" }, 0)).toBe(false);
  });

  it("recovers a confirmed publication and preserves any still-referenced object", () => {
    const digest = "a".repeat(64);
    const path = "derived/synthetic/analyses/test/ai/attempt.json.gz";
    const ai = { status: "completed" as const, attemptId: "attempt", artifactPath: path, artifactSha256: digest };
    expect(failureDisposition({ status: "completed", ai }, "attempt", path, digest)).toBe("published");
    expect(failureDisposition({ status: "deleting", ai }, "attempt", path, digest)).toBe("preserve");
    expect(failureDisposition({ status: "completed", ai }, "attempt", path, "other-digest")).toBe("preserve");
    expect(failureDisposition({ status: "completed", ai }, "attempt", path)).toBe("preserve");
  });

  it("only marks the current running attempt failed and recognizes unreferenced candidates", () => {
    const attempt = { status: "running" as const, attemptId: "attempt" };
    expect(failureDisposition({ status: "completed", ai: attempt }, "attempt", "candidate")).toBe("fail");
    expect(failureDisposition({ status: "completed", ai: attempt }, "old-attempt", "candidate")).toBe("unreferenced");
    expect(failureDisposition(undefined, "attempt", "candidate")).toBe("unreferenced");
  });
});
