import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  acceptanceMode,
  checkAdmission,
  checkResult,
  configuration,
  createHumanReviewRecord,
  expectedAcceptanceCases,
  finalizeAcceptanceEvidence,
  fixture,
  resolveAcceptanceGitCommit,
  usageRecord,
  validateHumanReviewDecision,
  verifyAcceptanceEvidence,
  verifyPreparedCatalog,
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

test("requires correct tables, values and physical lines in both catalog formats", async () => {
  for (const format of ["csv", "xlsx"]) {
    const input = await fixture(format);
    const catalog = { tables: input.previews.map(({ sheet, columns, values }) => ({
      sourceId: "file-0", fileName: input.name, sheet, columns, rows: values.length, nonEmptyRows: values.length,
      sampleRowNumbering: "file-line", sampleRows: values.map((cells, index) => ({ row: index + 2, values: cells })),
    })) };
    assert.doesNotThrow(() => verifyPreparedCatalog(catalog, input));
    const first = catalog.tables[0];
    for (const altered of [
      { sourceId: "foreign-file" }, { sheet: "Unexpected sheet" }, { columns: ["Value", "Group"] },
      { sampleRowNumbering: "record" }, { sampleRows: [{ row: 1, values: first.sampleRows[0].values }] },
      { unavailableReason: "unreadable-table" },
    ]) assert.throws(() => verifyPreparedCatalog({ tables: [{ ...first, ...altered }, ...catalog.tables.slice(1)] }, input));
  }
  await assert.rejects(() => fixture("tsv"), /Unknown synthetic table format/);
});

test("verifies the closed two-format evidence only with physical rows, browser and no paid jobs", t => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "incagen-closed-formats-"));
  t.after(() => rmSync(outputDirectory, { recursive: true, force: true }));
  const checks = ["csv", "xlsx"].map(format => ({
    format, sourceSha256: "b".repeat(64), sourceRowsVerified: true, browserVerified: true,
    access: "closed", paidJobReserved: false, modelCalls: 0,
  }));
  const finalized = finalizeAcceptanceEvidence({ outputDirectory, mode: "closed", gitCommit: "a".repeat(40),
    results: [], reports: [], closedChecks: checks, cleanupStatus: "verified" });
  assert.equal(finalized.verification.verified, true);
  assert.deepEqual(finalized.verification.closedChecks.map(check => check.format), ["csv", "xlsx"]);
  for (const altered of [
    { format: "csv" }, { sourceRowsVerified: false }, { browserVerified: false }, { access: "available" },
    { paidJobReserved: true }, { modelCalls: 1 }, { sourceSha256: "unverified" },
  ]) {
    writePrivateJson(join(outputDirectory, "acceptance.json"), {
      ...finalized.acceptance, closedChecks: [checks[0], { ...checks[1], ...altered }],
    });
    assert.equal(verifyAcceptanceEvidence(outputDirectory).verified, false);
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

test("requires complete, dated criteria for a final human decision and a reason for rejection", () => {
  const binding = { reportId: "synthetic-review", reportSha256: "1".repeat(64), sourceSha256: "2".repeat(64),
    gitCommit: "3".repeat(40), locale: "en" };
  const pending = createHumanReviewRecord(binding);
  assert.equal(validateHumanReviewDecision({ ...pending, schemaVersion: 2 }, binding).valid, false);
  const reviewedAt = "2026-11-25T08:00:00Z";
  assert.equal(validateHumanReviewDecision({ ...pending, reviewedAt }, binding).valid, false);
  const passed = Object.fromEntries(Object.keys(pending.criteria).map(key => [key, "pass"]));
  const rejected = { ...pending, decision: "rejected", reviewedAt,
    criteria: { ...passed, sourceRowSupport: "fail" }, reviewerNote: "The cited row omits the selected group." };
  assert.equal(validateHumanReviewDecision(rejected, binding).status, "rejected");
  for (const invalid of [
    { ...rejected, reviewerNote: "" },
    { ...rejected, reviewerNote: "x".repeat(2001) },
    { ...rejected, reviewedAt: null },
    { ...rejected, criteria: { ...rejected.criteria, languageQuality: "pending" } },
    { ...rejected, criteria: passed },
    { ...rejected, decision: "approved" },
  ]) assert.equal(validateHumanReviewDecision(invalid, binding).valid, false);
});

// Canlı hizmete bağlanmadan gerçek manifest yazıcısıyla çevrimdışı denetim girdisi oluşturur.
async function reviewEvidence(t, mode) {
  const directory = mkdtempSync(join(tmpdir(), "incagen-beta-review-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const gitCommit = "d".repeat(40);
  const reports = [];
  const results = [];
  for (const spec of expectedAcceptanceCases(mode)) {
    const { expected, artifact, record } = await example(spec.format);
    const reportId = `synthetic-${spec.locale}`;
    const result = { ...artifact.result, analysisId: reportId };
    const report = writeVerifiedReportFile(directory, `${spec.locale}-result.json`, result);
    const binding = { reportId, reportSha256: report.reportSha256, gitCommit, locale: spec.locale,
      sourceSha256: createHash("sha256").update(expected.bytes).digest("hex") };
    const review = writePendingHumanReviewFile(directory, `${spec.locale}-review.json`, binding);
    const entry = { ...spec, ...binding, ...report, humanReviewFile: review.humanReviewFile,
      runId: `run-${spec.locale}`, status: "completed" };
    reports.push(entry);
    results.push(usageRecord({ ...entry, job: record.ai, passed: true }));
  }
  const finalized = finalizeAcceptanceEvidence({ outputDirectory: directory, gitCommit, mode, results, reports, cleanupStatus: "verified" });
  assert.equal(finalized.verification.verified, true);
  return { directory, gitCommit, reports, results };
}

test("rejects a rehashed report with changed source anchors even when record hashes are consistent", async t => {
  const { directory, gitCommit, reports, results } = await reviewEvidence(t, "smoke");
  const entry = reports[0];
  const original = JSON.parse(readFileSync(join(directory, entry.reportFile), "utf8"));
  for (const altered of [
    anchor => { anchor.sha256 = "e".repeat(64); },
    anchor => { anchor.locator.sheet = "Foreign sheet"; },
    anchor => { anchor.locator.rowEnd = 6; },
  ]) {
    const report = structuredClone(original);
    altered(report.summary[0].evidence[0]);
    const binding = writeVerifiedReportFile(directory, entry.reportFile, report);
    const next = { ...entry, ...binding };
    writePendingHumanReviewFile(directory, next.humanReviewFile, next);
    const finalized = finalizeAcceptanceEvidence({ outputDirectory: directory, gitCommit, mode: "smoke",
      results: [{ ...results[0], ...binding }], reports: [next], cleanupStatus: "verified" });
    assert.equal(finalized.verification.verified, false);
    assert.match(finalized.verification.errors[0], /Rapor dayanağı/);
  }
});

test("rejects oversized evidence and malformed UTF-8 rather than accepting replacement characters", async t => {
  const { directory, reports } = await reviewEvidence(t, "smoke");
  const path = join(directory, reports[0].humanReviewFile);
  const original = readFileSync(path, "utf8");
  writeFileSync(path, Buffer.alloc(1024 * 1024 + 1, 32));
  assert.match(verifyAcceptanceEvidence(directory).errors[0], /boyutu/);
  const bytes = Buffer.from(original.replace('"reviewerNote": ""', '"reviewerNote": "X"'));
  bytes[bytes.indexOf('"X"') + 1] = 0xff;
  writeFileSync(path, bytes);
  assert.match(verifyAcceptanceEvidence(directory).errors[0], /UTF-8/);
});

// Aynı komut girişini gerçek CLI üzerinden çağırır ve yerel çıktıyı verir.
function checkEvidenceCli(directory, ...args) {
  const cli = spawnSync(process.execPath, ["scripts/check-beta-evidence.mjs", "--input", directory, ...args], { encoding: "utf8" });
  return { exitCode: cli.status, output: cli.stdout ? JSON.parse(cli.stdout) : null, stderr: cli.stderr };
}

test("lists report review states without exposing contents and can pin the Git revision", async t => {
  const { directory, gitCommit, reports } = await reviewEvidence(t, "full");
  const reviewPath = join(directory, reports[0].humanReviewFile);
  const review = JSON.parse(readFileSync(reviewPath, "utf8"));
  writePrivateJson(reviewPath, { ...review, reviewerNote: "Local-only review note" });
  const { output, exitCode } = checkEvidenceCli(directory, "--expected-commit", gitCommit);
  assert.equal(exitCode, 0);
  assert.equal(output.mechanicalVerified, true);
  assert.equal(output.commitMatched, true);
  assert.deepEqual(output.reviews.map(review => [review.locale, review.status]), ["tr", "en", "de", "es", "zh", "ar"].map(locale => [locale, "pending"]));
  assert.ok(!JSON.stringify(output).includes("Local-only review note"));
  const mismatch = checkEvidenceCli(directory, "--expected-commit", "1".repeat(40));
  assert.equal(mismatch.exitCode, 1);
  assert.equal(mismatch.output.commitMatched, false);
  assert.deepEqual(mismatch.output.reviews, []);
  assert.equal(checkEvidenceCli(directory, "--expected-commit", "short-sha").exitCode, 1);
  assert.equal(checkEvidenceCli(directory, "--unknown").exitCode, 1);
});

// Kabul fixture’ında operatörün tamamladığı ölçütleri ve karar dosyasını temsil eder.
function completeReview(directory, entry, { rejected = false } = {}) {
  const path = join(directory, entry.humanReviewFile);
  const record = JSON.parse(readFileSync(path, "utf8"));
  const criteria = Object.fromEntries(Object.keys(record.criteria).map(key => [key, "pass"]));
  if (rejected) criteria.languageQuality = "fail";
  writePrivateJson(path, { ...record, criteria,
    decision: rejected ? "rejected" : "approved",
    reviewerNote: rejected ? "Terminology must be corrected." : "",
    reviewedAt: "2026-11-25T08:00:00Z" });
}

test("closed and smoke evidence cannot qualify for the full beta evidence gate", async t => {
  for (const mode of ["closed", "smoke"]) {
    const { directory, gitCommit, reports } = await reviewEvidence(t, mode);
    for (const report of reports) completeReview(directory, report);
    const result = checkEvidenceCli(directory, "--expected-commit", gitCommit, "--require-ready");
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.mechanicalVerified, true);
    assert.deepEqual(result.output.blockers, ["full-run-required"]);
  }
});

test("strict evidence gate requires all six reviews, complete positive usage and the expected revision", async t => {
  const { directory, gitCommit, reports, results } = await reviewEvidence(t, "full");
  const gate = () => checkEvidenceCli(directory, "--expected-commit", gitCommit, "--require-ready");
  assert.deepEqual(gate().output.blockers, ["pending-human-review"]);
  for (const report of reports) completeReview(directory, report);
  completeReview(directory, reports[5], { rejected: true });
  assert.deepEqual(gate().output.blockers, ["rejected-human-review"]);
  completeReview(directory, reports[5]);

  const runsPath = join(directory, "runs.json");
  const altered = structuredClone(results);
  delete altered[0].usage;
  altered[1].durationMs = 6;
  altered[2].pythonMs = 0;
  altered[3].usage = { promptTokens: 20, outputTokens: 0, totalTokens: 20 };
  writePrivateJson(runsPath, altered);
  const incomplete = gate();
  assert.equal(incomplete.exitCode, 1);
  assert.equal(incomplete.output.mechanicalVerified, true);
  assert.deepEqual(incomplete.output.blockers, ["incomplete-usage-measurements"]);
  assert.deepEqual(incomplete.output.usage, { measuredCases: 2, totalDurationMs: { median: 30, max: 30 }, totalTokens: { median: 30, max: 30 } });
  assert.deepEqual(incomplete.output.reviews.map(review => review.usageMeasured), [false, false, false, false, true, true]);
  const [missing, invalid, zeroTime, zeroTokens] = incomplete.output.reviews;
  assert.deepEqual([missing.format, missing.locale, missing.measurement.missing], ["csv", "tr", ["usage"]]);
  assert.deepEqual([invalid.format, invalid.locale, invalid.measurement.invalid.length], ["xlsx", "en", 1]);
  assert.deepEqual(zeroTime.measurement.zero, ["pythonMs"]);
  assert.deepEqual(zeroTokens.measurement.zero, ["outputTokens"]);

  writePrivateJson(runsPath, results);
  const unpinned = checkEvidenceCli(directory, "--require-ready");
  assert.equal(unpinned.exitCode, 1);
  assert.deepEqual(unpinned.output.blockers, ["expected-commit-required"]);
  const ready = gate();
  assert.equal(ready.exitCode, 0);
  assert.equal(ready.output.evidenceReady, true);
  assert.equal(ready.output.usage.measuredCases, 6);
  assert.deepEqual(ready.output.blockers, []);
  assert.equal(checkEvidenceCli(directory, "--expected-commit", gitCommit, "--expected-commit", gitCommit).exitCode, 1);
});


test("pins live acceptance to a clean Git revision before creating evidence", t => {
  const cwd = mkdtempSync(join(tmpdir(), "incagen-beta-git-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  assert.throws(() => resolveAcceptanceGitCommit({ cwd }), /Git çalışma ağacı/);
  git("init", "-q");
  git("-c", "user.name=Incagen Test", "-c", "user.email=synthetic@example.test", "commit", "--allow-empty", "-m", "Initialize test repo");
  assert.equal(resolveAcceptanceGitCommit({ cwd }), git("rev-parse", "HEAD"));
  writeFileSync(join(cwd, "local-change.txt"), "synthetic");
  assert.throws(() => resolveAcceptanceGitCommit({ cwd }), /Git çalışma ağacı/);
});

test("requires mode-specific opt-ins and keeps paid acceptance away from the primary public site", () => {
  const buildConfig = () => "VITE_FIREBASE_PROJECT_ID=incagen-eeef4\n";
  const closed = { INCAGEN_CLOUD_CLOSED_ACCEPTANCE: "1", INCAGEN_ACCEPTANCE_URL: "https://incagen.netlify.app" };
  assert.equal(configuration("closed", closed, buildConfig).url, closed.INCAGEN_ACCEPTANCE_URL);
  assert.throws(() => configuration("full", closed, buildConfig), /opt-in/);

  const smoke = { INCAGEN_LIVE_MODEL_ACCEPTANCE: "1", INCAGEN_ACCEPTANCE_URL: "http://127.0.0.1:4177" };
  assert.equal(configuration("smoke", smoke, buildConfig).url, smoke.INCAGEN_ACCEPTANCE_URL);
  assert.throws(() => configuration("closed", smoke, buildConfig), /opt-in/);
  for (const INCAGEN_ACCEPTANCE_URL of ["https://incagen.netlify.app", "https://example.test", "http://fake@127.0.0.1",
    "http://127.0.0.1:4177/other", "http://127.0.0.1:4177/?target=other", "http://127.0.0.1:4177/#other",
    "https://deadbeef--incagen.netlify.app:8443"]) {
    assert.throws(() => configuration("smoke", { ...smoke, INCAGEN_ACCEPTANCE_URL }, buildConfig), /Unexpected acceptance URL/);
  }
  assert.equal(configuration("full", { ...smoke, INCAGEN_ACCEPTANCE_URL: "https://deadbeef--incagen.netlify.app" }, buildConfig).firebase.projectId, "incagen-eeef4");
  assert.throws(() => configuration("closed", { ...closed, FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" }, buildConfig), /emulator configuration/);
});

test("closed verification and paid preflight can only issue an explicit read-only admission request", async () => {
  const input = { id: "synthetic", sourceId: "file-0" };
  let attempts = 0;
  const recordCheck = data => {
    attempts += 1;
    assert.deepEqual(data, { ...input, checkOnly: true });
  };
  await assert.rejects(checkAdmission("closed", "available", input, recordCheck), /Catalog access/);
  await assert.rejects(checkAdmission("closed", undefined, input, recordCheck), /Catalog access/);
  await assert.rejects(checkAdmission("smoke", "invite-required", input, recordCheck), /Catalog access/);
  assert.equal(attempts, 0);

  await checkAdmission("closed", "closed", input, async data => {
    recordCheck(data);
    throw Object.assign(new Error(), { code: "functions/failed-precondition", details: { analysisFailure: "configuration" } });
  });
  await assert.rejects(checkAdmission("closed", "closed", input, async data => {
    recordCheck(data);
    return { id: input.id, status: "available", checkOnly: true };
  }), /Missing expected rejection/);

  await checkAdmission("smoke", "available", input, async data => {
    recordCheck(data);
    return { id: input.id, status: "available", checkOnly: true };
  });
  await assert.rejects(checkAdmission("full", "available", input, async data => {
    recordCheck(data);
    return { id: input.id, status: "available" };
  }));
  assert.equal(attempts, 4);
});
