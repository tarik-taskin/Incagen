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
  expectedAcceptanceCases,
  finalizeAcceptanceEvidence,
  fixture,
  usageRecord,
  validateHumanReviewDecision,
  verifyAcceptanceEvidence,
  writePendingHumanReviewFile,
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

test("verifies linked full, smoke, and closed evidence, rejects zero-report/duplicate/unmatched runs, and connects verification into normal acceptance finalization", async () => {
  const dir = mkdtempSync(join(tmpdir(), "incagen-accept-evidence-"));
  const gitCommit = "a".repeat(40);
  try {
    const fsModule = await import("node:fs");
    const csvEx = await example("csv");
    const xlsxEx = await example("xlsx");
    const csvSha = createHash("sha256").update(csvEx.expected.bytes).digest("hex");
    const xlsxSha = createHash("sha256").update(xlsxEx.expected.bytes).digest("hex");

    // 1. Geçerli smoke kabul akışı (bekleyen insan inceleme kaydıyla birlikte)
    const smokeDir = join(dir, "smoke-valid");
    fsModule.mkdirSync(smokeDir, { recursive: true });
    const smokeReport = writeVerifiedReportFile(smokeDir, "tr-csv-result.json", csvEx.artifact.result);
    const smokeReview = writePendingHumanReviewFile(smokeDir, "human-review-tr-csv.json", {
      reportId: csvEx.artifact.result.analysisId, reportSha256: smokeReport.reportSha256, sourceSha256: csvSha, locale: "tr", gitCommit,
    });
    assert.equal(smokeReview.record.decision, "pending");
    const smokeRun = usageRecord({
      runId: "run-tr-1", gitCommit, caseId: "smoke:1:tr:synthetic-service-csv-v1", locale: "tr", format: "csv",
      sourceSha256: csvSha, reportFile: smokeReport.reportFile, reportSha256: smokeReport.reportSha256, job: csvEx.record.ai, passed: true,
    });
    const smokeFinal = finalizeAcceptanceEvidence({
      outputDirectory: smokeDir,
      mode: "smoke",
      gitCommit,
      failure: undefined,
      results: [smokeRun],
      reports: [{
        runId: "run-tr-1", gitCommit, caseId: "smoke:1:tr:synthetic-service-csv-v1", format: "csv", locale: "tr",
        sourceSha256: csvSha, reportId: csvEx.artifact.result.analysisId, reportFile: smokeReport.reportFile,
        reportSha256: smokeReport.reportSha256, humanReviewFile: smokeReview.humanReviewFile, status: "completed",
      }],
      cleanupStatus: "verified",
    });
    assert.equal(smokeFinal.failure, undefined);
    assert.equal(smokeFinal.verification.verified, true);
    assert.equal(smokeFinal.acceptance.caseCount, 1);

    // 2. Geçerli tam (full) kabul: 6 beklenen benzersiz vaka
    const fullDir = join(dir, "full-valid");
    fsModule.mkdirSync(fullDir, { recursive: true });
    const fullRuns = [];
    const fullReports = [];
    for (const spec of expectedAcceptanceCases("full")) {
      const sample = spec.format === "csv" ? csvEx : xlsxEx;
      const sourceSha = spec.format === "csv" ? csvSha : xlsxSha;
      const result = { ...sample.artifact.result, analysisId: `synthetic-${spec.locale}` };
      const rep = writeVerifiedReportFile(fullDir, `${spec.locale}-${spec.format}-result.json`, result);
      const rev = writePendingHumanReviewFile(fullDir, `human-review-${spec.locale}-${spec.format}.json`, {
        reportId: result.analysisId, reportSha256: rep.reportSha256, sourceSha256: sourceSha, locale: spec.locale, gitCommit,
      });
      const runId = `run-${spec.locale}-${spec.format}`;
      fullRuns.push(usageRecord({
        runId, gitCommit, caseId: spec.caseId, locale: spec.locale, format: spec.format, sourceSha256: sourceSha,
        reportFile: rep.reportFile, reportSha256: rep.reportSha256, job: sample.record.ai, passed: true,
      }));
      fullReports.push({
        runId, gitCommit, caseId: spec.caseId, format: spec.format, locale: spec.locale, sourceSha256: sourceSha,
        reportId: result.analysisId, reportFile: rep.reportFile, reportSha256: rep.reportSha256,
        humanReviewFile: rev.humanReviewFile, status: "completed",
      });
    }
    const fullFinal = finalizeAcceptanceEvidence({
      outputDirectory: fullDir, mode: "full", gitCommit, failure: undefined, results: fullRuns, reports: fullReports, cleanupStatus: "verified",
    });
    assert.equal(fullFinal.failure, undefined);
    assert.equal(fullFinal.verification.verified, true);
    assert.equal(fullFinal.verification.verifiedReports.length, 6);

    // 3. Geçerli kapalı (closed) mod: sıfır model sonucu / sıfır run kaydı / doğrulanmış temizlik
    const closedDir = join(dir, "closed-valid");
    fsModule.mkdirSync(closedDir, { recursive: true });
    const closedFinal = finalizeAcceptanceEvidence({
      outputDirectory: closedDir, mode: "closed", gitCommit, failure: undefined, results: [], reports: [], cleanupStatus: "verified",
    });
    assert.equal(closedFinal.failure, undefined);
    assert.equal(closedFinal.verification.verified, true);
    assert.equal(closedFinal.acceptance.caseCount, 0);

    // 4. Sıfır rapor (full/smoke modunda reports=[] ve caseCount=0) reddedilmeli
    const zeroDir = join(dir, "zero-reports");
    fsModule.mkdirSync(zeroDir, { recursive: true });
    const zeroFinal = finalizeAcceptanceEvidence({
      outputDirectory: zeroDir, mode: "full", gitCommit, failure: undefined, results: [], reports: [], cleanupStatus: "verified",
    });
    assert.ok(zeroFinal.failure instanceof Error);
    assert.equal(zeroFinal.acceptance.status, "failed");
    assert.equal(verifyAcceptanceEvidence(zeroDir).verified, false);

    // 5. Yinelenen vaka (duplicate caseId / runId / locale+format) reddedilmeli
    const dupDir = join(dir, "duplicate-case");
    fsModule.cpSync(fullDir, dupDir, { recursive: true });
    const dupAcc = JSON.parse(readFileSync(join(dupDir, "acceptance.json"), "utf8"));
    dupAcc.reports[5] = { ...dupAcc.reports[0] };
    writePrivateJson(join(dupDir, "acceptance.json"), dupAcc);
    assert.equal(verifyAcceptanceEvidence(dupDir).verified, false);

    // 6. Raporla uyuşmayan / fazla runs.json kaydı reddedilmeli
    const mismatchRunsDir = join(dir, "mismatched-runs");
    fsModule.cpSync(smokeDir, mismatchRunsDir, { recursive: true });
    const extraRuns = JSON.parse(readFileSync(join(mismatchRunsDir, "runs.json"), "utf8"));
    extraRuns.push({ ...extraRuns[0], runId: "unmatched-extra-run" });
    writePrivateJson(join(mismatchRunsDir, "runs.json"), extraRuns);
    assert.equal(verifyAcceptanceEvidence(mismatchRunsDir).verified, false);

    // 7. Değişmiş rapor dosyası (SHA-256 uyuşmazlığı) & eksik bekleyen insan inceleme dosyası reddedilmeli
    const tamperedDir = join(dir, "tampered");
    fsModule.cpSync(smokeDir, tamperedDir, { recursive: true });
    writeFileSync(join(tamperedDir, "tr-csv-result.json"), '{"analysisId":"tampered"}\n');
    const tampered = verifyAcceptanceEvidence(tamperedDir);
    assert.equal(tampered.verified, false);
    assert.match(tampered.errors.join(" "), /SHA-256/);

    const missingReviewDir = join(dir, "missing-review");
    fsModule.cpSync(smokeDir, missingReviewDir, { recursive: true });
    rmSync(join(missingReviewDir, "human-review-tr-csv.json"));
    assert.equal(verifyAcceptanceEvidence(missingReviewDir).verified, false);

    // 8. Eksik rapor dosyası, eksik full vakası ve doğrulanmamış temizlik reddedilmeli
    const missingDir = join(dir, "missing");
    fsModule.cpSync(smokeDir, missingDir, { recursive: true });
    rmSync(join(missingDir, "tr-csv-result.json"));
    assert.equal(verifyAcceptanceEvidence(missingDir).verified, false);

    const partialDir = join(dir, "partial");
    fsModule.cpSync(smokeDir, partialDir, { recursive: true });
    const partialManifest = JSON.parse(readFileSync(join(partialDir, "acceptance.json"), "utf8"));
    partialManifest.mode = "full";
    partialManifest.caseCount = 6;
    writePrivateJson(join(partialDir, "acceptance.json"), partialManifest);
    assert.equal(verifyAcceptanceEvidence(partialDir).verified, false);

    const unverifiedDir = join(dir, "unverified-cleanup");
    fsModule.cpSync(smokeDir, unverifiedDir, { recursive: true });
    const unverifiedManifest = JSON.parse(readFileSync(join(unverifiedDir, "acceptance.json"), "utf8"));
    unverifiedManifest.cleanup = "unverified";
    writePrivateJson(join(unverifiedDir, "acceptance.json"), unverifiedManifest);
    assert.equal(verifyAcceptanceEvidence(unverifiedDir).verified, false);

    // 9. Eski kayıt okunabilmeli ancak eksik alanları varsayıp verified: true dönmemeli
    const legacyDir = join(dir, "legacy");
    fsModule.mkdirSync(legacyDir, { recursive: true });
    writePrivateJson(join(legacyDir, "runs.json"), [{ runId: "legacy-1", locale: "tr", format: "csv", status: "completed" }]);
    writePrivateJson(join(legacyDir, "acceptance.json"), { phase: "mechanical-acceptance", status: "passed", mode: "smoke", caseCount: 1, completedReportCount: 1, cleanup: "verified" });
    const legacy = verifyAcceptanceEvidence(legacyDir);
    assert.equal(legacy.legacy, true);
    assert.equal(legacy.verified, false);
    assert.equal(legacy.status, "legacy-unverified");
    assert.equal(legacy.readOnlySummary.completedReportCount, 1);

    // 10. Rapor veya günlükte gizli veri / token sızıntısı reddedilmeli
    const secretDir = join(dir, "secret-leak");
    fsModule.cpSync(smokeDir, secretDir, { recursive: true });
    const secretToken = ["ya29.", "AbCdEfGhIjKlMnOpQrStUvWxYz"].join("");
    writePrivateJson(join(secretDir, "tr-csv-result.json"), { analysisId: "syn-1", leak: `Bearer ${secretToken}` });
    const leaked = verifyAcceptanceEvidence(secretDir);
    assert.equal(leaked.verified, false);
    assert.match(leaked.errors.join(" "), /gizli veri/);

    // Kapalı koşu dahil her v2 kanıtında runs.json bulunmalı.
    rmSync(join(closedDir, "runs.json"));
    assert.match(verifyAcceptanceEvidence(closedDir).errors.join(" "), /runs.json eksik/);

    // Geçersiz JSON ve desteklenmeyen sürüm kontrollü hataya dönüşür.
    const manifestPath = join(smokeDir, "acceptance.json");
    writeFileSync(manifestPath, "{");
    assert.match(verifyAcceptanceEvidence(smokeDir).errors.join(" "), /geçerli JSON değil/);
    writePrivateJson(manifestPath, { ...smokeFinal.acceptance, schemaVersion: 3 });
    assert.match(verifyAcceptanceEvidence(smokeDir).errors.join(" "), /sürümü/);
    writePrivateJson(manifestPath, { ...smokeFinal.acceptance, humanReviewRequired: false });
    assert.match(verifyAcceptanceEvidence(smokeDir).errors.join(" "), /incelemesi gerekliliği/);
    writePrivateJson(manifestPath, smokeFinal.acceptance);

    // Manifest ve insan kararı aynı anda değişse de rapor kimliği bu iddiayı doğrulamalı.
    const wrongId = "another-synthetic-analysis";
    writePrivateJson(manifestPath, { ...smokeFinal.acceptance, reports: [{ ...smokeFinal.acceptance.reports[0], reportId: wrongId }] });
    writePrivateJson(join(smokeDir, smokeReview.humanReviewFile), { ...smokeReview.record, reportId: wrongId });
    assert.match(verifyAcceptanceEvidence(smokeDir).errors.join(" "), /Rapor kimliği/);
    writePrivateJson(manifestPath, smokeFinal.acceptance);
    writePrivateJson(join(smokeDir, smokeReview.humanReviewFile), smokeReview.record);

    writePrivateJson(join(smokeDir, "runs.json"), [{ ...smokeRun, model: "unknown-model" }]);
    assert.match(verifyAcceptanceEvidence(smokeDir).errors.join(" "), /model/);
    writePrivateJson(join(smokeDir, "runs.json"), [smokeRun]);
    const reviewPath = join(smokeDir, smokeReview.humanReviewFile);
    rmSync(reviewPath);
    fsModule.symlinkSync(join(fullDir, fullReports[0].humanReviewFile), reviewPath);
    assert.match(verifyAcceptanceEvidence(smokeDir).errors.join(" "), /normal dosya değil/);

    const duplicateFileReports = structuredClone(fullReports);
    duplicateFileReports[1].humanReviewFile = duplicateFileReports[0].humanReviewFile;
    writePrivateJson(join(fullDir, "acceptance.json"), { ...fullFinal.acceptance, reports: duplicateFileReports });
    assert.match(verifyAcceptanceEvidence(fullDir).errors.join(" "), /tekrar kullanılmış/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("keeps human review pending separately from mechanical checks and binds approvals to report/source hashes, commit, locale, and valid ISO date", () => {
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

  const validCriteria = Object.fromEntries(Object.keys(pendingReview.criteria).map(k => [k, "pass"]));
  const fullApproval = {
    ...pendingReview,
    decision: "approved",
    reviewedAt: "2026-11-19T12:00:00+03:00",
    criteria: validCriteria,
  };
  assert.equal(validateHumanReviewDecision(fullApproval, binding).approved, true);

  // Hash, commit, dil ve geçersiz/boş inceleme tarihi reddedilmeli
  assert.equal(validateHumanReviewDecision(fullApproval, { ...binding, reportSha256: "d".repeat(64) }).valid, false);
  assert.equal(validateHumanReviewDecision(fullApproval, { ...binding, sourceSha256: "e".repeat(64) }).valid, false);
  assert.equal(validateHumanReviewDecision(fullApproval, { ...binding, gitCommit: "f".repeat(40) }).valid, false);
  assert.equal(validateHumanReviewDecision(fullApproval, { ...binding, locale: "en" }).valid, false);
  for (const badDate of ["", "   ", "not-a-date", "2026-11-19", "2026-02-30T12:00:00Z"]) {
    assert.equal(validateHumanReviewDecision({ ...fullApproval, reviewedAt: badDate }, binding).valid, false);
  }
});
