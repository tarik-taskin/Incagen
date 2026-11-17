import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { summarizeSingleRun, summarizeUsageAcceptance } from "./summarize-usage-acceptance.mjs";

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
  assert.equal(report.measuredCounts.totalDurationMs, 2);
  assert.equal(report.averages.totalDurationMs, 45_000);
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
