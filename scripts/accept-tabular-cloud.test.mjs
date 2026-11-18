import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { acceptanceMode, checkResult, fixture, usageRecord } from "./accept-tabular-cloud.mjs";
import { summarizeUsageAcceptance } from "./summarize-usage-acceptance.mjs";

// Kazanılan test kanıtı için kaynak baytlarını koruyan kısa bir rapor hazırlar.
async function example(format) {
  const expected = await fixture(format);
  const sheet = expected.selection.sheet;
  const analysisId = "synthetic-analysis";
  const source = {
    sourceId: "file-0",
    sha256: createHash("sha256").update(expected.bytes).digest("hex"),
    chunks: [{ id: "c1", locator: { sheet, rowStart: 2, rowEnd: expected.rows + 1 } }],
  };
  const evidence = (rowStart, rowEnd) => [{
    sourceId: source.sourceId, sha256: source.sha256, chunkId: "c1", locator: { sheet, rowStart, rowEnd },
  }];
  const points = expected.points.map(([label, value], index) => ({ metricId: `group-${index + 1}`, label, value }));
  const metric = (id, value, unit, rows, label = id) => ({ id, value, unit, label, evidence: evidence(rows[0], rows.at(-1)) });
  const allRows = [2, expected.rows + 1];
  const unit = expected.selection.unit;
  const metrics = [metric("rows", expected.rows, "count", allRows), metric("aggregate", expected.total, unit, allRows),
    ...points.map(point => metric(point.metricId, point.value, unit, expected.groupRows[point.label], point.label))];
  const statement = { text: "Seçili kayıtları tutarlarıyla karşılaştırın.", metricIds: ["aggregate"], evidence: evidence(...allRows) };
  return {
    expected,
    record: { ai: { model: "gemini-3.8-flash", status: "completed", attempts: 1, selection: expected.selection,
      durationMs: 30, pythonMs: 4, modelMs: 20, usage: { promptTokens: 20, outputTokens: 10, totalTokens: 30 } } },
    artifact: {
      version: 1, locale: "tr", sources: [source],
      scope: { selection: expected.selection, sheet, measure: expected.measure, group: expected.group,
        rows: expected.rows, emptyRows: 0, groups: points.length },
      result: { analysisId, summary: [statement], findings: [{ statements: [statement] }],
        limitations: ["Kapsam", "Boş satır", "Çıkarım", "Ek veri"],
        metrics, datasets: [{ id: "groups", unit, points }], charts: [{ type: "horizontal-bar", datasetId: "groups" }] },
    },
  };
}

test("validates CLI mode before initializing any live resources", () => {
  assert.equal(acceptanceMode([]), "full");
  assert.equal(acceptanceMode(["--smoke"]), "smoke");
  assert.equal(acceptanceMode(["--verify-closed"]), "closed");
  for (const args of [["--smok"], ["--smoke", "--verify-closed"], ["--smoke", "--smoke"]]) {
    assert.throws(() => acceptanceMode(args));
  }
  const cli = spawnSync(process.execPath, ["scripts/accept-tabular-cloud.mjs", "--smok"], {
    env: { ...process.env, INCAGEN_LIVE_MODEL_ACCEPTANCE: "" },
    encoding: "utf8",
  });
  assert.equal(cli.status, 1);
  assert.equal(cli.stdout, "");
  assert.equal(JSON.parse(cli.stderr).status, "failed");
});

test("checks CSV and XLSX physical evidence, token totals and selected worksheet", async () => {
  for (const format of ["csv", "xlsx"]) {
    const { expected, record, artifact } = await example(format);
    assert.doesNotThrow(() => checkResult(artifact, record, expected, artifact.result.analysisId, "tr"));
    const badEvidence = structuredClone(artifact);
    badEvidence.result.metrics[2].evidence[0].locator.rowStart = 1;
    assert.throws(() => checkResult(badEvidence, record, expected, artifact.result.analysisId, "tr"), /source rows/);
    const wrongGroup = structuredClone(artifact);
    wrongGroup.result.metrics[2].evidence = wrongGroup.result.metrics[3].evidence;
    assert.throws(() => checkResult(wrongGroup, record, expected, artifact.result.analysisId, "tr"));
    const wrongSheet = structuredClone(artifact);
    wrongSheet.sources[0].chunks[0].locator.sheet = "Out of scope";
    assert.throws(() => checkResult(wrongSheet, record, expected, artifact.result.analysisId, "tr"));
    const invalidUsage = structuredClone(record);
    invalidUsage.ai.usage.totalTokens++;
    assert.throws(() => checkResult(artifact, invalidUsage, expected, artifact.result.analysisId, "tr"), /Inconsistent usage/);
  }
});

test("acceptance records feed the usage report without document or account fields", async () => {
  const { record } = await example("csv");
  const common = { locale: "tr", format: "csv" };
  const success = usageRecord({ ...common, runId: "completed", job: record.ai, passed: true });
  const failure = usageRecord({ ...common, runId: "failed", job: undefined, failure: "provider-busy" });
  const report = summarizeUsageAcceptance([success, failure]);
  assert.equal(report.completedCount, 1);
  assert.equal(report.failedCount, 1);
  assert.equal(report.averages.totalDurationMs, 30);
  assert.equal(report.runs[1].error, "provider-busy");
  assert.equal(report.runs[1].format, "csv");
  assert.equal(report.runs[1].locale, "tr");
  assert.equal(report.runs[1].model, null);
  assert.deepEqual(Object.keys(success).sort(), ["durationMs", "format", "locale", "model", "modelMs", "pythonMs", "runId", "status", "usage"]);
});
