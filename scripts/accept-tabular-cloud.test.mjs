import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  acceptanceMode,
  checkResult,
  createHumanReviewRecord,
  fixture,
  usageRecord,
  validateHumanReviewDecision,
  verifyAcceptanceEvidence,
  writeVerifiedReportFile,
} from "./accept-tabular-cloud.mjs";
import { writePrivateJson } from "./acceptance-resources.mjs";
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

test("verifies linked full acceptance evidence, rejects partial/tampered/missing/unverified runs, keeps legacy readable without forging pass, and blocks secrets", async () => {
  const dir = mkdtempSync(join(tmpdir(), "incagen-accept-evidence-"));
  const gitCommit = "a".repeat(40);
  try {
    const csvEx = await fixture("csv");
    const sourceSha256 = createHash("sha256").update(csvEx.bytes).digest("hex");
    const caseId = "smoke:1:tr:synthetic-service-csv-v1";
    const fullDir = join(dir, "full-valid");
    mkdtempSync(join(dir, "tmp-"));
    writePrivateJson(join(dir, "placeholder.json"), { ok: true });
    // Tam geçerli smoke/full kanıt dizini
    const fsModule = await import("node:fs");
    fsModule.mkdirSync(fullDir, { recursive: true });
    const { reportFile, reportSha256 } = writeVerifiedReportFile(fullDir, "tr-csv-result.json", csvEx.artifact?.result ?? { analysisId: "syn-1", summary: [] });
    const runId = "run-tr-1";
    const linkedRun = usageRecord({
      runId, gitCommit, caseId, locale: "tr", format: "csv", sourceSha256,
      reportFile, reportSha256, job: (await example("csv")).record.ai, passed: true,
    });
    writePrivateJson(join(fullDir, "runs.json"), [linkedRun]);
    writePrivateJson(join(fullDir, "acceptance.json"), {
      schemaVersion: 2,
      phase: "mechanical-acceptance",
      gitCommit,
      status: "passed",
      mode: "smoke",
      caseCount: 1,
      completedReportCount: 1,
      humanReviewRequired: true,
      cleanup: "verified",
      reports: [{ runId, gitCommit, caseId, format: "csv", locale: "tr", sourceSha256, reportFile, reportSha256, status: "completed" }],
    });

    const valid = verifyAcceptanceEvidence(fullDir, { expectedCommit: gitCommit });
    assert.equal(valid.verified, true);
    assert.equal(valid.status, "verified");
    assert.equal(valid.verifiedReports.length, 1);

    // 1. Değişmiş rapor dosyası (SHA-256 uyuşmazlığı) reddedilmeli
    const tamperedDir = join(dir, "tampered");
    fsModule.cpSync(fullDir, tamperedDir, { recursive: true });
    writeFileSync(join(tamperedDir, "tr-csv-result.json"), '{"analysisId":"tampered"}\n');
    const tampered = verifyAcceptanceEvidence(tamperedDir);
    assert.equal(tampered.verified, false);
    assert.match(tampered.errors.join(" "), /SHA-256/);

    // 2. Eksik rapor dosyası reddedilmeli
    const missingDir = join(dir, "missing");
    fsModule.cpSync(fullDir, missingDir, { recursive: true });
    rmSync(join(missingDir, "tr-csv-result.json"));
    assert.equal(verifyAcceptanceEvidence(missingDir).verified, false);

    // 3. Yarım koşu (completedReportCount < caseCount / failed) reddedilmeli
    const partialDir = join(dir, "partial");
    fsModule.cpSync(fullDir, partialDir, { recursive: true });
    const partialManifest = JSON.parse(readFileSync(join(partialDir, "acceptance.json"), "utf8"));
    partialManifest.mode = "full";
    partialManifest.caseCount = 6;
    writePrivateJson(join(partialDir, "acceptance.json"), partialManifest);
    assert.equal(verifyAcceptanceEvidence(partialDir).verified, false);

    // 4. Doğrulanmamış temizlik (cleanup: "unverified") reddedilmeli
    const unverifiedDir = join(dir, "unverified-cleanup");
    fsModule.cpSync(fullDir, unverifiedDir, { recursive: true });
    const unverifiedManifest = JSON.parse(readFileSync(join(unverifiedDir, "acceptance.json"), "utf8"));
    unverifiedManifest.cleanup = "unverified";
    writePrivateJson(join(unverifiedDir, "acceptance.json"), unverifiedManifest);
    assert.equal(verifyAcceptanceEvidence(unverifiedDir).verified, false);

    // 5. Eski kayıt okunabilmeli ancak eksik alanları varsayıp verified: true dönmemeli
    const legacyDir = join(dir, "legacy");
    fsModule.mkdirSync(legacyDir, { recursive: true });
    writePrivateJson(join(legacyDir, "runs.json"), [{ runId: "legacy-1", locale: "tr", format: "csv", status: "completed" }]);
    writePrivateJson(join(legacyDir, "acceptance.json"), { phase: "mechanical-acceptance", status: "passed", mode: "smoke", caseCount: 1, completedReportCount: 1, cleanup: "verified" });
    const legacy = verifyAcceptanceEvidence(legacyDir);
    assert.equal(legacy.legacy, true);
    assert.equal(legacy.verified, false);
    assert.equal(legacy.status, "legacy-unverified");
    assert.equal(legacy.readOnlySummary.completedReportCount, 1);

    // 6. Rapor veya günlükte gizli veri / token sızıntısı reddedilmeli
    const secretDir = join(dir, "secret-leak");
    fsModule.cpSync(fullDir, secretDir, { recursive: true });
    const secretToken = ["ya29.", "AbCdEfGhIjKlMnOpQrStUvWxYz"].join("");
    writePrivateJson(join(secretDir, "tr-csv-result.json"), { analysisId: "syn-1", leak: `Bearer ${secretToken}` });
    const leaked = verifyAcceptanceEvidence(secretDir);
    assert.equal(leaked.verified, false);
    assert.match(leaked.errors.join(" "), /gizli veri/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("keeps human review pending separately from mechanical checks and binds approvals to exact reportId and SHA-256", () => {
  const binding = {
    reportId: "analysis-live-tr-1",
    reportSha256: "b".repeat(64),
    sourceSha256: "c".repeat(64),
    locale: "tr",
    gitCommit: "a".repeat(40),
  };
  const pendingReview = createHumanReviewRecord(binding);
  const pendingCheck = validateHumanReviewDecision(pendingReview, binding);
  assert.equal(pendingCheck.valid, true);
  assert.equal(pendingCheck.status, "pending");
  assert.equal(pendingCheck.approved, false);

  // Altı ölçüt pass olmadan approved geçersiz sayılmalı
  const prematureApproval = { ...pendingReview, decision: "approved", reviewedAt: "2026-11-19T12:00:00Z" };
  assert.equal(validateHumanReviewDecision(prematureApproval, binding).valid, false);

  // Tüm ölçütler pass olsa da rapor hash'i değişince insan kararı geçersiz olmalı
  const fullApproval = {
    ...pendingReview,
    decision: "approved",
    reviewedAt: "2026-11-19T12:00:00Z",
    criteria: Object.fromEntries(Object.keys(pendingReview.criteria).map(k => [k, "pass"])),
  };
  assert.equal(validateHumanReviewDecision(fullApproval, binding).approved, true);
  assert.equal(validateHumanReviewDecision(fullApproval, { ...binding, reportSha256: "d".repeat(64) }).valid, false);
});
