import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { summarizeSingleRun, summarizeUsageAcceptance, validatePricingInput } from "./summarize-usage-acceptance.mjs";

test("accepts real calendar pricing dates and rejects malformed tariffs", () => {
  const pricing = { model: "gemini-3.8-flash", effectiveDate: "2028-02-29", currency: "USD", inputPer1MTokens: 0, outputPer1MTokens: 1 };
  assert.deepEqual(validatePricingInput(pricing), pricing);
  for (const effectiveDate of ["2026-02-29", "2028-02-30", "2026-04-31", "2026-13-01", "2026-01-01\n"]) {
    assert.throws(() => validatePricingInput({ ...pricing, effectiveDate }), /Fiyat tarifesi/);
  }
  assert.throws(() => validatePricingInput(false), /Geçersiz fiyat tarifesi/);
});

test("blocks unknown, repeated and incomplete CLI arguments before producing output", t => {
  const directory = mkdtempSync(join(tmpdir(), "incagen-usage-args-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = join(directory, "runs.json");
  const output = join(directory, "summary.json");
  writeFileSync(input, JSON.stringify([{ status: "completed", runId: "one" }]));
  for (const extras of [["--pricing"], ["--price", "other.json"], ["--input", input], ["--output", "  "], ["extra"]]) {
    const cli = spawnSync(process.execPath, ["scripts/summarize-usage-acceptance.mjs", "--input", input, "--output", output, ...extras], { encoding: "utf8" });
    assert.equal(cli.status, 1);
    assert.equal(cli.stdout, "");
    assert.equal(existsSync(output), false);
  }
  const valid = spawnSync(process.execPath, ["scripts/summarize-usage-acceptance.mjs", "--input", input, "--output", output], { encoding: "utf8" });
  assert.equal(valid.status, 0);
  assert.equal(JSON.parse(valid.stdout).overallStatus, "partial");
  assert.equal(existsSync(output), true);
});

test("distinguishes real zero measurements from unmeasured fields and avoids inventing prices", () => {
  const zeroRun = {
    runId: "r-zero",
    status: "completed",
    model: "gemini-3.8-flash",
    pythonMs: 0,
    modelMs: 0,
    durationMs: 0,
    usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
  };
  const missingRun = {
    runId: "r-missing",
    status: "failed",
    error: "timeout",
    durationMs: 90_000,
  };

  const report = summarizeUsageAcceptance([zeroRun, missingRun]);
  assert.equal(report.overallStatus, "partial");
  assert.equal(report.invalidMeasurementCount, 0);

  const first = report.runs[0];
  assert.equal(first.measurementStatus, "measured");
  assert.equal(first.calculationMs, 0);
  assert.equal(first.modelMs, 0);
  assert.equal(first.totalDurationMs, 0);
  assert.deepEqual(first.usage, { promptTokens: 0, outputTokens: 0, totalTokens: 0 });
  assert.deepEqual(first.unmeasuredFields, []);
  assert.equal(first.estimatedCost.status, "hesaplanamadı");

  const second = report.runs[1];
  assert.equal(second.measurementStatus, "failed");
  assert.equal(second.error, "timeout");
  assert.equal(second.calculationMs, null);
  assert.equal(second.modelMs, null);
  assert.equal(second.totalDurationMs, 90_000);
  assert.deepEqual(second.unmeasuredFields, ["pythonMs", "modelMs", "usage"]);

  // Eksik pythonMs sıfır kabul edilip ortalamaya katılmaz (yalnız r-zero ölçülü: avg = 0, measuredCounts = 1).
  assert.equal(report.measuredCounts.calculationMs, 1);
  assert.equal(report.averages.calculationMs, 0);
  assert.equal(report.measuredCounts.totalDurationMs, 1);
  assert.equal(report.averages.totalDurationMs, 0);
  assert.equal(report.completedCount, 1);
  assert.equal(report.failedCount, 1);
});

test("calculates estimated cost only with explicit pricing input and matching model", () => {
  const pricing = {
    model: "gemini-3.8-flash",
    effectiveDate: "2026-11-17",
    currency: "USD",
    inputPer1MTokens: 0.1,
    outputPer1MTokens: 0.4,
  };
  const run = {
    runId: "r-1",
    status: "completed",
    model: "gemini-3.8-flash",
    pythonMs: 250,
    modelMs: 1200,
    durationMs: 1600,
    usage: { promptTokens: 1000, outputTokens: 500, totalTokens: 1500 },
  };
  const summarized = summarizeSingleRun(run, pricing);
  assert.equal(summarized.estimatedCost.status, "estimated");
  assert.equal(summarized.estimatedCost.currency, "USD");
  // 1000 * 0.1 / 1e6 + 500 * 0.4 / 1e6 = 0.0001 + 0.0002 = 0.0003
  assert.equal(summarized.estimatedCost.amount, 0.0003);
  assert.match(summarized.estimatedCost.note, /gerçek fatura tahsilatı değildir/);

  const wrongModel = summarizeSingleRun({ ...run, model: "emulator" }, pricing);
  assert.equal(wrongModel.estimatedCost.status, "hesaplanamadı");
});

test("marks inconsistent or negative measurements as invalid and fails CLI exit code", () => {
  const inconsistent = [
    {
      runId: "bad-time",
      status: "completed",
      pythonMs: 500,
      modelMs: 700,
      durationMs: 1000, // 500 + 700 > 1000 tutarsız
      usage: { promptTokens: 10, outputTokens: 10, totalTokens: 20 },
    },
    {
      runId: "bad-tokens",
      status: "completed",
      pythonMs: 100,
      modelMs: 100,
      durationMs: 300,
      usage: { promptTokens: 50, outputTokens: 60, totalTokens: 100 }, // 50 + 60 > 100
    },
  ];
  const report = summarizeUsageAcceptance(inconsistent);
  assert.equal(report.overallStatus, "invalid");
  assert.equal(report.invalidMeasurementCount, 2);
  assert.equal(report.runs[0].measurementStatus, "invalid-measurement");
  assert.equal(report.runs[1].measurementStatus, "invalid-measurement");

  const dir = mkdtempSync(join(tmpdir(), "incagen-usage-cli-"));
  try {
    const inputPath = join(dir, "runs.json");
    writeFileSync(inputPath, JSON.stringify(inconsistent), "utf8");
    const run = spawnSync(process.execPath, [
      "scripts/summarize-usage-acceptance.mjs",
      "--input", inputPath,
    ], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.equal(JSON.parse(run.stdout).overallStatus, "invalid");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects unexplained token mismatch (prompt+output !== totalTokens) and excludes invalid runs from acceptance averages", () => {
  const pricing = {
    model: "gemini-3.8-flash",
    effectiveDate: "2026-11-17",
    currency: "USD",
    inputPer1MTokens: 0.1,
    outputPer1MTokens: 0.4,
  };

  // Bulgu 3A: promptTokens=0, outputTokens=0, totalTokens=1000 açıklanamayan farkı 0 maliyetle geçirmemeli
  const unexplainedRun = {
    runId: "unexplained-tokens",
    status: "completed",
    model: "gemini-3.8-flash",
    pythonMs: 5,
    modelMs: 5,
    durationMs: 10,
    usage: { promptTokens: 0, outputTokens: 0, totalTokens: 1000 },
  };
  const single = summarizeSingleRun(unexplainedRun, pricing);
  assert.equal(single.measurementStatus, "invalid-measurement");
  assert.equal(single.estimatedCost.status, "hesaplanamadı");
  assert.notEqual(single.estimatedCost.amount, 0);

  // Bulgu 3B: Geçerli koşu (5ms) + geçersiz koşu (1000ms) bir aradayken geçersiz koşu ortalamaya karışmamalı
  const validRun = {
    runId: "valid-run",
    status: "completed",
    model: "gemini-3.8-flash",
    pythonMs: 5,
    modelMs: 5,
    durationMs: 10,
    usage: { promptTokens: 100, outputTokens: 200, totalTokens: 300 },
  };
  const invalidRun = {
    runId: "invalid-run",
    status: "completed",
    model: "gemini-3.8-flash",
    pythonMs: 1000,
    modelMs: 1000,
    durationMs: 1,
    usage: { promptTokens: 10, outputTokens: 10, totalTokens: 20 },
  };
  const report = summarizeUsageAcceptance([validRun, invalidRun], { pricing });
  assert.equal(report.overallStatus, "invalid");
  assert.equal(report.measuredCounts.calculationMs, 1);
  assert.equal(report.averages.calculationMs, 5);
  assert.equal(report.averages.modelMs, 5);
  assert.equal(report.averages.totalDurationMs, 10);
  assert.deepEqual(report.excludedInvalidRunIds, ["invalid-run"]);
});


test("unfinished runs cannot satisfy the usage acceptance or influence success latency", () => {
  const unfinished = { runId: "interrupted", status: "running", pythonMs: 1, modelMs: 2, durationMs: 1000,
    usage: { promptTokens: 1, outputTokens: 1, totalTokens: 2 } };
  const report = summarizeUsageAcceptance([unfinished]);
  assert.equal(report.overallStatus, "partial");
  assert.equal(report.runs[0].measurementStatus, "partial");
  assert.equal(report.completedCount, 0);
  assert.equal(report.unfinishedCount, 1);
  assert.equal(report.measuredCounts.totalDurationMs, 0);
  assert.equal(report.averages.totalDurationMs, null);
  assert.equal(report.medians.totalDurationMs, null);
});

test("separates CSV and XLSX sample counts, medians, and maxima, prevents duplicate runId double-counting, and flags small samples without inventing cost", () => {
  const csv1 = { runId: "csv-1", locale: "tr", format: "csv", status: "completed", model: "gemini-3.8-flash", pythonMs: 20, modelMs: 80, durationMs: 100, usage: { promptTokens: 100, outputTokens: 50, totalTokens: 150 } };
  const csv2 = { runId: "csv-2", locale: "en", format: "csv", status: "completed", model: "gemini-3.8-flash", pythonMs: 40, modelMs: 160, durationMs: 200, usage: { promptTokens: 200, outputTokens: 100, totalTokens: 300 } };
  const csv3 = { runId: "csv-3", locale: "de", format: "csv", status: "completed", model: "gemini-3.8-flash", pythonMs: 100, modelMs: 800, durationMs: 900, usage: { promptTokens: 300, outputTokens: 150, totalTokens: 450 } };
  const xlsx1 = { runId: "xlsx-1", locale: "es", format: "xlsx", status: "completed", model: "gemini-3.8-flash", pythonMs: 300, modelMs: 1200, durationMs: 1500, usage: { promptTokens: 400, outputTokens: 200, totalTokens: 600 } };
  const negativeRun = { runId: "bad-neg", locale: "zh", format: "csv", status: "completed", pythonMs: -5, modelMs: 10, durationMs: 20, usage: { promptTokens: 10, outputTokens: 10, totalTokens: 20 } };
  const failedXlsx = { runId: "fail-xlsx", locale: "ar", format: "xlsx", status: "failed", error: "provider-busy", durationMs: 5000 };

  // Aynı runId ("csv-1") iki kez verilse de ikinci kopya çift sayılmaz.
  const report = summarizeUsageAcceptance([csv1, { ...csv1 }, csv2, csv3, xlsx1, negativeRun, failedXlsx]);

  assert.equal(report.overallStatus, "invalid");
  assert.equal(report.completedCount, 5);
  assert.equal(report.validCompletedCount, 4); // csv-1, csv-2, csv-3, xlsx-1 (bad-neg invalid, duplicate csv-1 hariç)
  assert.deepEqual(report.duplicateRunIds, ["csv-1"]);
  assert.equal(report.excludedDuplicateCount, 1);
  assert.deepEqual(report.excludedInvalidRunIds, ["bad-neg"]);
  assert.equal(report.failedCount, 1);
  assert.equal(report.sampleConfidence, "small-sample");
  assert.match(report.sampleNote, /küçük örneklem/);

  // CSV ayrı medyan ve en uzun süre (100, 200, 900 -> medyan=200, max=900)
  assert.equal(report.byFormat.csv.sampleCount, 3);
  assert.equal(report.byFormat.csv.smallSample, true);
  assert.equal(report.byFormat.csv.typicalDurationMs, 200);
  assert.equal(report.byFormat.csv.totalDurationMs.median, 200);
  assert.equal(report.byFormat.csv.totalDurationMs.max, 900);

  // XLSX ayrı medyan ve en uzun süre (yalnız xlsx1 başarılı, fail-xlsx dışarıda)
  assert.equal(report.byFormat.xlsx.sampleCount, 1);
  assert.equal(report.byFormat.xlsx.typicalDurationMs, 1500);
  assert.equal(report.byFormat.xlsx.totalDurationMs.max, 1500);

  // Genel medyan ve en uzun süre ([100, 200, 900, 1500] -> medyan=550, max=1500)
  assert.equal(report.medians.totalDurationMs, 550);
  assert.equal(report.maxima.totalDurationMs, 1500);

  // Fiyat verilmediğinde maliyet hiçbir zaman uydurulmaz
  assert.ok(report.runs.every(run => run.estimatedCost.status === "hesaplanamadı"));

  // Eski format/locale olmayan kayıtlar okunabilir ve ortalamaları korur
  const legacyReport = summarizeUsageAcceptance([
    { runId: "old-1", status: "completed", pythonMs: 10, modelMs: 20, durationMs: 30, usage: { promptTokens: 5, outputTokens: 5, totalTokens: 10 } },
  ]);
  assert.equal(legacyReport.overallStatus, "complete");
  assert.equal(legacyReport.averages.totalDurationMs, 30);
  assert.equal(legacyReport.byFormat.csv.sampleCount, 0);
  assert.equal(legacyReport.byFormat.xlsx.sampleCount, 0);
});

test("does not count six unmeasured completed runs as sufficient sample size", () => {
  const partialRuns = Array.from({ length: 6 }, (_, index) => ({
    runId: `unmeasured-${index + 1}`,
    locale: ["tr", "en", "de", "es", "zh", "ar"][index],
    format: "csv",
    status: "completed",
    model: "gemini-3.8-flash",
    // pythonMs / modelMs / durationMs / usage eksik
  }));
  const partialReport = summarizeUsageAcceptance(partialRuns);
  assert.equal(partialReport.validCompletedCount, 6);
  assert.equal(partialReport.measuredSampleCount, 0);
  assert.equal(partialReport.sampleConfidence, "small-sample");
  assert.equal(partialReport.byFormat.csv.sampleCount, 6);
  assert.equal(partialReport.byFormat.csv.measuredSampleCount, 0);
  assert.equal(partialReport.byFormat.csv.smallSample, true);
  assert.match(partialReport.sampleNote, /tam ölçülmüş/i);

  // Yalnız süre + token alanlarının tamamı ölçülen 6 koşu temel örneklem yeterliliğine ulaşır.
  const measuredRuns = Array.from({ length: 6 }, (_, index) => ({
    runId: `measured-${index + 1}`,
    locale: ["tr", "en", "de", "es", "zh", "ar"][index],
    format: "csv",
    status: "completed",
    model: "gemini-3.8-flash",
    pythonMs: 25 + index,
    modelMs: 200 + index * 10,
    durationMs: 250 + index * 10,
    usage: { promptTokens: 100, outputTokens: 50, totalTokens: 150 },
  }));
  const measuredReport = summarizeUsageAcceptance(measuredRuns);
  assert.equal(measuredReport.measuredSampleCount, 6);
  assert.equal(measuredReport.sampleConfidence, "baseline-met");
  assert.equal(measuredReport.byFormat.csv.measuredSampleCount, 6);
  assert.equal(measuredReport.byFormat.csv.smallSample, false);
});
