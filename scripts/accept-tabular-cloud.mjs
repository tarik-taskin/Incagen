import assert from "node:assert/strict";
import { createAcceptanceJournal, createTabularAcceptanceEmail, writePrivateJson } from "./acceptance-resources.mjs";
import { tabularFixture } from "./tabular-synthetic-fixtures.mjs";
import { verifyGitStatus } from "./verify-release.mjs";
import { existsSync, lstatSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, getDoc, doc } from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { chromium } from "@playwright/test";
const PROJECT = "incagen-eeef4";
const ACCEPTANCE_MODEL = "gemini-3.8-flash";
const locales = ["tr", "en", "de", "es", "zh", "ar"];
const analysisFailures = new Set(["invalid-data", "scope-limit", "configuration", "provider", "provider-busy", "validation", "timeout"]);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Kapalı ve ücretli kabul ayrı opt-in gerektirir. Ücretli koşu yalnız yerel arayüz veya dağıtım önizlemesini kabul eder.
export function configuration(mode, env = process.env, readEnvFile = () => readFileSync(".env.cloud-preview.local", "utf8")) {
  assert.ok(["closed", "smoke", "full"].includes(mode), "Unexpected acceptance mode.");
  const optIn = mode === "closed" ? env.INCAGEN_CLOUD_CLOSED_ACCEPTANCE : env.INCAGEN_LIVE_MODEL_ACCEPTANCE;
  assert.equal(optIn, "1", "Explicit opt-in required for the selected acceptance mode.");
  assert.ok(!env.FUNCTIONS_EMULATOR && !env.FIRESTORE_EMULATOR_HOST && !env.FIREBASE_AUTH_EMULATOR_HOST
    && !env.FIREBASE_STORAGE_EMULATOR_HOST && !env.STORAGE_EMULATOR_HOST, "Cloud acceptance cannot use emulator configuration.");
  const url = new URL(env.INCAGEN_ACCEPTANCE_URL || "");
  const local = url.protocol === "http:" && url.hostname === "127.0.0.1";
  const deployed = url.protocol === "https:" && !url.port && (/^[a-f0-9]+--incagen\.netlify\.app$/.test(url.hostname)
    || (mode === "closed" && url.hostname === "incagen.netlify.app"));
  assert.ok((local || deployed) && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash,
    "Unexpected acceptance URL.");
  const values = Object.fromEntries(readEnvFile().split(/\r?\n/).filter(line => /^VITE_FIREBASE_/.test(line)).map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
  assert.equal(values.VITE_FIREBASE_PROJECT_ID, PROJECT);
  return { url: url.origin, firebase: { apiKey: values.VITE_FIREBASE_API_KEY, authDomain: values.VITE_FIREBASE_AUTH_DOMAIN, projectId: PROJECT, storageBucket: values.VITE_FIREBASE_STORAGE_BUCKET, appId: values.VITE_FIREBASE_APP_ID } };
}

// CLI modu seçilen azami vaka sayısını belirler. Geçersiz bayrak ücretli moda düşmez.
export function acceptanceMode(args) {
  if (args.length === 0) return "full";
  if (args.length === 1 && args[0] === "--verify-closed") return "closed";
  if (args.length === 1 && args[0] === "--smoke") return "smoke";
  throw new Error("Yalnız --smoke veya --verify-closed bayraklarından biri kullanılabilir.");
}

// Canlı kabul, aynı erişim kuralını salt okunur istekle doğrular. Yanlış durum gerçek modele ilerlemez.
export async function checkAdmission(mode, access, request, checkStart) {
  assert.ok(["closed", "smoke", "full"].includes(mode), "Unexpected acceptance mode.");
  const closed = mode === "closed";
  assert.equal(access, closed ? "closed" : "available", "Catalog access does not match acceptance mode.");
  const check = () => checkStart({ ...request, checkOnly: true });
  if (closed) {
    await assert.rejects(check, { code: "functions/failed-precondition", details: { analysisFailure: "configuration" } });
    return;
  }
  assert.deepEqual(await check(), { id: request.id, status: "available", checkOnly: true });
}

// Kaynak baytlarını ve bağımsız beklenen sayfa, grup, metrik ve fiziksel satırları üretir.
export async function fixture(kind) {
  return tabularFixture(kind);
}

// Yalnız testte üretilen oturumla callable çağırır; model için otomatik tekrar yoktur.
async function call(account, name, body) {
  try { return await httpsCallable(getFunctions(account.app, "europe-west1"), name, { timeout: 190000 })(body); }
  catch (error) {
    console.log(JSON.stringify({ callable: name, code: error?.code || "unknown", ...(analysisFailures.has(error?.details?.analysisFailure) ? { analysisFailure: error.details.analysisFailure } : {}) }));
    throw error;
  }
}

// Kaynak aralıklarını seçilen sayfada gerçekten var olan fiziksel satırlara çözer.
function evidenceRows(evidence, source, expected) {
  assert.ok(Array.isArray(evidence) && evidence.length > 0, "Missing source evidence.");
  const rows = new Set();
  for (const anchor of evidence) {
    assert.equal(anchor.sha256, source.sha256);
    assert.equal(anchor.sourceId, source.sourceId);
    assert.equal(anchor.locator.sheet ?? null, expected.selection.sheet);
    const chunk = source.chunks.find(item => item.id === anchor.chunkId);
    assert.ok(chunk, "Unknown source chunk.");
    const { rowStart, rowEnd } = anchor.locator;
    assert.ok(Number.isInteger(rowStart) && Number.isInteger(rowEnd) && rowStart <= rowEnd
      && rowStart >= 2 && rowEnd <= expected.rows + 1
      && rowStart >= chunk.locator.rowStart && rowEnd <= chunk.locator.rowEnd, "Invalid source rows.");
    for (let row = rowStart; row <= rowEnd; row++) rows.add(row);
  }
  return [...rows].sort((a, b) => a - b);
}

// Başarılı sonuçta seçim, hesap, grafik ve kaynak bağlantıları bağımsız cevap anahtarına uyar.
export function checkResult(artifact, record, expected, id, locale) {
  const job = record.ai;
  assert.equal(job.model, ACCEPTANCE_MODEL);
  assert.equal(job.status, "completed");
  assert.equal(job.attempts, 1);
  assert.deepEqual(job.selection, expected.selection);
  const { promptTokens, outputTokens, totalTokens } = job.usage ?? {};
  assert.ok([promptTokens, outputTokens, totalTokens].every(n => Number.isSafeInteger(n) && n > 0), "Missing model usage.");
  assert.equal(promptTokens + outputTokens, totalTokens, "Inconsistent usage.");
  assert.ok([job.durationMs, job.pythonMs, job.modelMs].every(n => Number.isFinite(n) && n > 0), "Missing measured duration.");
  assert.ok(job.pythonMs + job.modelMs <= job.durationMs, "Inconsistent durations.");

  const { result, scope, sources } = artifact;
  assert.equal(artifact.version, 1);
  assert.equal(artifact.locale, locale);
  assert.equal(result.analysisId, id);
  assert.deepEqual(scope, {
    selection: expected.selection, sheet: expected.selection.sheet, measure: expected.measure,
    group: expected.group, rows: expected.rows, emptyRows: 0, groups: expected.points.length,
  });
  assert.equal(sources.length, 1);
  const [source] = sources;
  assert.equal(source.sourceId, "file-0");
  assert.equal(source.sha256, createHash("sha256").update(expected.bytes).digest("hex"));
  assert.ok(source.chunks.length > 0 && source.chunks.every(chunk => (chunk.locator.sheet ?? null) === expected.selection.sheet));

  const metrics = new Map(result.metrics.map(metric => [metric.id, metric]));
  const allRows = Array.from({ length: expected.rows }, (_, i) => i + 2);
  const rows = metrics.get("rows"), aggregate = metrics.get("aggregate");
  assert.equal(rows.value, expected.rows);
  assert.equal(rows.unit, "count");
  assert.equal(aggregate.value, expected.total);
  assert.equal(aggregate.unit, expected.selection.unit);
  assert.deepEqual(evidenceRows(rows.evidence, source, expected), allRows);
  assert.deepEqual(evidenceRows(aggregate.evidence, source, expected), allRows);

  assert.equal(result.datasets.length, 1);
  const [dataset] = result.datasets;
  assert.equal(dataset.unit, expected.selection.unit);
  assert.deepEqual(dataset.points.map(item => [item.label, item.value]), expected.points);
  assert.equal(result.charts.length, 1);
  assert.equal(result.charts[0].type, "horizontal-bar");
  assert.equal(result.charts[0].datasetId, dataset.id);
  assert.equal(metrics.size, dataset.points.length + 2);
  for (const point of dataset.points) {
    const metric = metrics.get(point.metricId);
    assert.equal(metric.label, point.label);
    assert.equal(metric.value, point.value);
    assert.equal(metric.unit, dataset.unit);
    assert.deepEqual(evidenceRows(metric.evidence, source, expected), expected.groupRows[point.label]);
  }
  assert.ok(result.summary.length > 0 && result.findings.length > 0);
  for (const statement of [...result.summary, ...result.findings.flatMap(item => item.statements)]) {
    assert.ok(!/\p{N}/u.test(statement.text));
    assert.ok(statement.metricIds.length > 0 && statement.metricIds.every(metricId => metrics.has(metricId)));
    const metricRows = new Set(statement.metricIds.flatMap(metricId => evidenceRows(metrics.get(metricId).evidence, source, expected)));
    assert.deepEqual(evidenceRows(statement.evidence, source, expected), [...metricRows].sort((a, b) => a - b));
  }
  assert.ok(result.limitations.length >= 4);
}

const SHA256_HEX = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
const SECRET_LEAK_PATTERN = /(Bearer\s+[A-Za-z0-9._-]+|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]{15,}|ghp_[0-9A-Za-z]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|"(?:apiKey|password|secret|token)"\s*:|\b(?:apiKey|password|secret|token)\s*=|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

// Mod bazında beklenen benzersiz kabul vaka kimliklerini, dillerini ve formatlarını döner.
export function expectedAcceptanceCases(mode) {
  if (mode === "closed") return [];
  if (mode === "smoke") {
    return [{ caseId: "smoke:1:tr:synthetic-service-csv-v1", locale: "tr", format: "csv" }];
  }
  if (mode === "full") {
    return locales.map((locale, index) => {
      const format = index % 2 ? "xlsx" : "csv";
      const cid = format === "csv" ? "synthetic-service-csv-v1" : "synthetic-service-xlsx-v1";
      return { caseId: `full:${index + 1}:${locale}:${cid}`, locale, format };
    });
  }
  throw new Error(`Bilinmeyen kabul modu: ${String(mode)}`);
}

// Geçerli ISO-8601 inceleme tarihini takvim sınırlarıyla (ör. 2026-02-30 hariç) doğrular.
function isValidIsoReviewTimestamp(value) {
  if (typeof value !== "string" || value.trim() !== value) return false;
  const match = ISO_TIMESTAMP.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59 || month < 1 || month > 12 || day < 1) return false;
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  return dateCheck.getUTCFullYear() === year && dateCheck.getUTCMonth() === month - 1 && dateCheck.getUTCDate() === day;
}

// Canlı kanıtın revizyonunu temiz çalışma ağacından, sentetik kaynak oluşturmadan önce alır.
export function resolveAcceptanceGitCommit({ cwd } = {}) {
  const { commit } = verifyGitStatus({ cwd });
  assert.ok(GIT_SHA.test(commit), "Canlı kabul için tam Git SHA gerekli.");
  return commit;
}

// Sentetik kabul raporunu koşuya özel kanıt dizinine yazar ve tam SHA-256 özetini döner.
export function writeVerifiedReportFile(outputDirectory, fileName, reportResult) {
  const target = join(outputDirectory, fileName);
  const serialized = JSON.stringify(reportResult, null, 2) + "\n";
  writePrivateJson(target, reportResult);
  return {
    reportFile: fileName,
    reportSha256: createHash("sha256").update(serialized, "utf8").digest("hex"),
  };
}

// Kullanım özetine yalnız ölçülmüş backend alanlarını ve doğrulanabilir rapor bağlantısını aktarır.
export function usageRecord({ runId, gitCommit, caseId, locale, format, sourceSha256, reportFile, reportSha256, job, passed, failure }) {
  return {
    runId,
    ...(gitCommit ? { gitCommit } : {}),
    ...(caseId ? { caseId } : {}),
    locale,
    format,
    ...(sourceSha256 ? { sourceSha256 } : {}),
    ...(passed && reportFile ? { reportFile } : {}),
    ...(passed && reportSha256 ? { reportSha256 } : {}),
    status: passed ? "completed" : "failed",
    model: job?.model, durationMs: job?.durationMs, pythonMs: job?.pythonMs, modelMs: job?.modelMs,
    usage: job?.usage, ...(passed ? {} : { error: failure }),
  };
}

const HUMAN_REVIEW_CRITERIA = [
  "sourceRowSupport",
  "observationInterpretationSplit",
  "missingDataLimitation",
  "noUnsupportedCausationOrForecast",
  "recommendationBasis",
  "languageQuality",
];

// Otomatik doğrulamadan ayrı olarak rapor kimliği ve SHA-256 hash'ine bağlı bekleyen insan incelemesi şablonu üretir.
export function createHumanReviewRecord({ reportId, reportSha256, sourceSha256, locale, gitCommit }) {
  return {
    schemaVersion: 1,
    kind: "human-review-decision",
    reportId,
    reportSha256,
    sourceSha256,
    locale,
    gitCommit,
    decision: "pending",
    criteria: Object.fromEntries(HUMAN_REVIEW_CRITERIA.map(key => [key, "pending"])),
    reviewerNote: "",
    reviewedAt: null,
  };
}

// İnsan kararının otomatik doğrulamadan ayrı, geçerli rapor/kaynak hash, commit, dil ve tarihe bağlı olduğunu denetler.
export function validateHumanReviewDecision(record, expectedBinding) {
  if (record?.schemaVersion !== 1 || record.kind !== "human-review-decision") {
    return { valid: false, status: "invalid", reason: "Geçersiz insan inceleme kaydı türü." };
  }
  if (!expectedBinding
    || !record.reportId || record.reportId !== expectedBinding.reportId
    || !SHA256_HEX.test(String(record.reportSha256)) || record.reportSha256 !== expectedBinding.reportSha256
    || !SHA256_HEX.test(String(record.sourceSha256)) || record.sourceSha256 !== expectedBinding.sourceSha256
    || !locales.includes(record.locale) || record.locale !== expectedBinding.locale
    || !GIT_SHA.test(String(record.gitCommit)) || !GIT_SHA.test(String(expectedBinding.gitCommit))
    || record.gitCommit !== expectedBinding.gitCommit) {
    return { valid: false, status: "invalid", reason: "İnsan kararı rapor kimliği, kaynak/sonuç hash, Git commit veya dille eşleşmiyor." };
  }
  if (!["pending", "approved", "rejected"].includes(record.decision)) {
    return { valid: false, status: "invalid", reason: "Geçersiz insan karar durumu." };
  }
  if (typeof record.reviewerNote !== "string" || record.reviewerNote.length > 2000) {
    return { valid: false, status: "invalid", reason: "İnceleme notu en fazla 2000 karakter olmalıdır." };
  }
  for (const key of HUMAN_REVIEW_CRITERIA) {
    if (!["pending", "pass", "fail"].includes(record.criteria?.[key])) {
      return { valid: false, status: "invalid", reason: `Eksik veya geçersiz inceleme ölçütü: ${key}.` };
    }
  }
  if (record.decision === "pending") {
    if (record.reviewedAt !== null) {
      return { valid: false, status: "invalid", reason: "Bekleyen kayıtta tamamlanma tarihi bulunamaz." };
    }
    return { valid: true, status: "pending", approved: false, reason: "Gerçek insan incelemesi henüz beklemede." };
  }
  if (!isValidIsoReviewTimestamp(record.reviewedAt) || HUMAN_REVIEW_CRITERIA.some(key => record.criteria[key] === "pending")) {
    return { valid: false, status: "invalid", reason: "Son karar için altı ölçütü tamamlayın ve geçerli ISO inceleme tarihi girin." };
  }
  const allPass = HUMAN_REVIEW_CRITERIA.every(key => record.criteria[key] === "pass");
  if (record.decision === "approved" && !allPass) {
    return { valid: false, status: "invalid", reason: "Altı ölçütün tamamı pass olduğunda onay verilebilir." };
  }
  if (record.decision === "rejected" && (allPass || !record.reviewerNote.trim())) {
    return { valid: false, status: "invalid", reason: "Ret için en az bir başarısız ölçüt ve açıklama gerekir." };
  }
  return { valid: true, status: record.decision, approved: record.decision === "approved" };
}

// Sentetik kabul raporunun bekleyen insan incelemesi kaydını özel kanıt dizinine yazar.
export function writePendingHumanReviewFile(outputDirectory, fileName, reviewInput) {
  const target = join(outputDirectory, fileName);
  const record = createHumanReviewRecord(reviewInput);
  writePrivateJson(target, record);
  return { humanReviewFile: fileName, record };
}

// Koşu sonunda acceptance.json, runs.json ve insan inceleme dosyalarını yazar; doğrulama başarısızsa acceptance'ı failed işaretler.
export function finalizeAcceptanceEvidence({ outputDirectory, mode, gitCommit, failure, results, reports, cleanupStatus }) {
  const expectedCount = expectedAcceptanceCases(mode).length;
  const acceptance = {
    schemaVersion: 2,
    phase: "mechanical-acceptance",
    gitCommit,
    status: failure ? "failed" : "passed",
    mode,
    caseCount: expectedCount,
    completedReportCount: results.filter(run => run.status === "completed").length,
    humanReviewRequired: mode !== "closed",
    cleanup: cleanupStatus,
    reports,
  };
  writePrivateJson(join(outputDirectory, "runs.json"), results);
  writePrivateJson(join(outputDirectory, "acceptance.json"), acceptance);

  const verification = verifyAcceptanceEvidence(outputDirectory, { expectedCommit: gitCommit });
  if (!failure && !verification.verified) {
    const verificationFailure = new Error(`Kabul kanıt doğrulaması başarısız: ${verification.errors.join(" ")}`);
    acceptance.status = "failed";
    writePrivateJson(join(outputDirectory, "acceptance.json"), acceptance);
    return { acceptance, verification, failure: verificationFailure };
  }
  return { acceptance, verification, failure };
}

// Kanıt JSON’unu dosya türü, içerik ve hata güvenliği denetimiyle okur.
function readEvidenceJson(root, fileName, label) {
  const path = join(root, fileName);
  let bytes;
  try {
    if (!lstatSync(path).isFile()) throw new Error();
    bytes = readFileSync(path);
  } catch {
    throw new Error(`${label} eksik veya normal dosya değil.`);
  }
  const text = bytes.toString("utf8");
  if (SECRET_LEAK_PATTERN.test(text)) throw new Error(`${label} gizli veri içeriyor.`);
  try {
    return { bytes, value: JSON.parse(text) };
  } catch {
    throw new Error(`${label} geçerli JSON değil.`);
  }
}

// Kanıt girişleri koşu dizininin doğrudan üyesidir. Bir dosya tek bir rol veya vakaya aittir.
function claimEvidenceFile(fileName, reservedFiles) {
  if (typeof fileName !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*\.json$/.test(fileName)
    || reservedFiles.has(fileName)) return false;
  reservedFiles.add(fileName);
  return true;
}

// Koşuyu çevrimdışı doğrular. Bekleyen veya reddedilen insan kararı mekanik bütünlük hatası değildir.
export function verifyAcceptanceEvidence(outputDirectory, options = {}) {
  const root = resolve(outputDirectory);
  const failed = error => ({ verified: false, status: "failed", legacy: false, errors: [error], verifiedReports: [] });
  let acceptance;
  let runs;
  try {
    if (!existsSync(root) || !lstatSync(root).isDirectory()) return failed("Kabul kanıt dizini bulunamadı veya geçersiz.");
    acceptance = readEvidenceJson(root, "acceptance.json", "acceptance.json").value;
    if (!acceptance || typeof acceptance !== "object" || Array.isArray(acceptance)) return failed("acceptance.json bir nesne olmalıdır.");
    const legacy = acceptance.schemaVersion === undefined || acceptance.schemaVersion === 1;
    runs = legacy && !existsSync(join(root, "runs.json")) ? [] : readEvidenceJson(root, "runs.json", "runs.json").value;
    if (legacy) {
      return {
        verified: false,
        status: "legacy-unverified",
        legacy: true,
        readOnlySummary: {
          phase: acceptance.phase === "mechanical-acceptance" ? acceptance.phase : null,
          mode: ["closed", "smoke", "full"].includes(acceptance.mode) ? acceptance.mode : null,
          status: ["passed", "failed"].includes(acceptance.status) ? acceptance.status : null,
          completedReportCount: Number.isSafeInteger(acceptance.completedReportCount) ? acceptance.completedReportCount : 0,
          cleanup: ["verified", "unverified", "none-created"].includes(acceptance.cleanup) ? acceptance.cleanup : "unknown",
          runCount: Array.isArray(runs) ? runs.length : 0,
        },
        errors: ["Eski kabul kanıtı yalnızca özet olarak okunabilir."],
        verifiedReports: [],
      };
    }
  } catch (error) {
    return failed(error.message);
  }

  if (acceptance.schemaVersion !== 2 || acceptance.phase !== "mechanical-acceptance") {
    return failed("Kabul kanıtı sürümü veya aşaması desteklenmiyor.");
  }
  if (!["closed", "smoke", "full"].includes(acceptance.mode)) return failed("Geçersiz kabul modu.");
  const expectedCases = expectedAcceptanceCases(acceptance.mode);
  const expectedCount = expectedCases.length;
  const errors = [];
  const verifiedReports = [];
  const reviews = [];
  const commitIsValid = typeof acceptance.gitCommit === "string" && GIT_SHA.test(acceptance.gitCommit);
  if (!commitIsValid) errors.push("Geçersiz Git commit SHA.");
  if (options.expectedCommit && acceptance.gitCommit !== options.expectedCommit) errors.push("Git commit beklenen revizyonla eşleşmiyor.");
  if (acceptance.cleanup !== "verified") errors.push("Temizlik doğrulanmadı.");
  if (acceptance.status !== "passed") errors.push("Mekanik kabul koşusu başarısız.");
  if (acceptance.humanReviewRequired !== (acceptance.mode !== "closed")) errors.push("İnsan incelemesi gerekliliği koşu moduyla uyuşmuyor.");
  if (acceptance.caseCount !== expectedCount || acceptance.completedReportCount !== expectedCount) {
    errors.push("Manifestteki vaka veya tamamlanan rapor sayısı koşu moduyla uyuşmuyor.");
  }
  if (!Array.isArray(acceptance.reports) || acceptance.reports.length !== expectedCount
    || !Array.isArray(runs) || runs.length !== expectedCount) {
    errors.push("Rapor ve koşu kayıtlarının sayısı koşu moduyla uyuşmuyor.");
    return { ...failed(errors[0]), errors };
  }

  const runById = new Map(runs.map(run => [run?.runId, run]));
  if (runById.size !== runs.length || runs.some(run => typeof run?.runId !== "string" || !run.runId)) {
    return failed("Eksik veya yinelenen koşu kimliği.");
  }

  const entriesByCase = new Map(acceptance.reports.map(entry => [entry?.caseId, entry]));
  const usedRunIds = new Set();
  const reportIds = new Set();
  const reservedFiles = new Set(["acceptance.json", "runs.json"]);
  for (const spec of expectedCases) {
    const entry = entriesByCase.get(spec.caseId);
    const label = `${spec.locale}/${spec.format}`;
    if (entry?.status !== "completed" || entry.locale !== spec.locale || entry.format !== spec.format) {
      errors.push(`Beklenen vaka kaydı eksik veya geçersiz (${label}).`);
      continue;
    }
    const run = runById.get(entry.runId);
    if (!run || usedRunIds.has(entry.runId) || run.status !== "completed" || run.model !== ACCEPTANCE_MODEL
      || run.gitCommit !== entry.gitCommit || run.caseId !== entry.caseId || run.format !== entry.format || run.locale !== entry.locale
      || run.sourceSha256 !== entry.sourceSha256 || run.reportFile !== entry.reportFile || run.reportSha256 !== entry.reportSha256) {
      errors.push(`Koşu kaydı, model veya rapor bağlantısı geçersiz (${label}).`);
      continue;
    }
    usedRunIds.add(entry.runId);
    if (entry.gitCommit !== acceptance.gitCommit || typeof entry.sourceSha256 !== "string" || !SHA256_HEX.test(entry.sourceSha256)
      || typeof entry.reportSha256 !== "string" || !SHA256_HEX.test(entry.reportSha256)) {
      errors.push(`Rapor revizyonu veya özeti geçersiz (${label}).`);
      continue;
    }
    if (!claimEvidenceFile(entry.reportFile, reservedFiles) || !claimEvidenceFile(entry.humanReviewFile, reservedFiles)) {
      errors.push(`Kanıt dosya adı geçersiz veya tekrar kullanılmış (${label}).`);
      continue;
    }
    try {
      const report = readEvidenceJson(root, entry.reportFile, `Rapor (${label})`);
      if (createHash("sha256").update(report.bytes).digest("hex") !== entry.reportSha256) {
        throw new Error(`Rapor SHA-256 uyuşmuyor (${label}).`);
      }
      const reportId = report.value?.analysisId;
      if (typeof reportId !== "string" || !reportId.trim() || reportId !== entry.reportId || reportIds.has(reportId)) {
        throw new Error(`Rapor kimliği eksik, uyuşmuyor veya tekrar kullanılmış (${label}).`);
      }
      reportIds.add(reportId);
      const review = readEvidenceJson(root, entry.humanReviewFile, `İnsan inceleme kaydı (${label})`);
      const validation = validateHumanReviewDecision(review.value, entry);
      if (!validation.valid) throw new Error(`İnsan inceleme kaydı geçersiz (${label}). ${validation.reason}`);
      verifiedReports.push(entry);
      reviews.push({ locale: spec.locale, format: spec.format, reportFile: entry.reportFile,
        reviewFile: entry.humanReviewFile, status: validation.status, reviewedAt: review.value.reviewedAt });
    } catch (error) {
      errors.push(error.message);
    }
  }

  const verified = errors.length === 0;
  return {
    verified,
    status: verified ? "verified" : "failed",
    legacy: false,
    gitCommit: commitIsValid ? acceptance.gitCommit : null,
    mode: acceptance.mode,
    reportCount: acceptance.reports.length,
    verifiedReports,
    reviews,
    runs: verified ? runs : [],
    errors,
  };
}

// Yeni arayüz aynı gerçek kayıtla açılır; okuma/yenileme/kaynak inceleme yeni model çağrısı yapmaz.
async function checkBrowser(account, id, baseURL, { closed, outputDirectory }) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    await page.goto(baseURL);
    assert.equal(new URL(page.url()).origin, baseURL, "Acceptance site redirected outside the configured origin.");
    await page.getByRole("button", { name: "Analize başla", exact: true }).click();
    assert.equal(new URL(page.url()).origin, baseURL, "Acceptance sign-in redirected outside the configured origin.");
    await page.getByLabel("E-posta", { exact: true }).fill(account.email);
    await page.getByLabel("Parola", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page.waitForURL("**/app/new-analysis", { timeout: 30000 });
    await page.goto(`${baseURL}/app/analyses/${id}`);
    if (closed) {
      await page.getByRole("heading", { name: "Synthetic service analysis", exact: true }).waitFor({ timeout: 30000 });
      await page.getByRole("heading", { name: "Belgelerin içeriği ayrıştırıldı", exact: true }).waitFor({ timeout: 30000 });
      assert.equal(await page.getByRole("heading", { name: "Tablodan net bir özet.", exact: true }).count(), 0);
      console.log(JSON.stringify({ browser: "closed-rollout-preserves-preparation", status: "passed" }));
      return;
    }
    const report = page.getByRole("region", { name: "Analiz raporu", exact: true });
    await report.waitFor({ timeout: 30000 });
    assert.match(await report.innerText(), /19\.000,50 USD/);
    await report.getByText("Veri tablosu", { exact: true }).click();
    await report.getByRole("button", { name: "Cloud kaynağı", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Cloud", exact: true });
    await dialog.waitFor(); assert.match(await dialog.getByRole("table").innerText(), /-500\.10/);
    assert.ok(!(await dialog.getByRole("table").innerText()).includes("Consulting"));
    const downloadEvent = page.waitForEvent("download", { timeout: 30000 });
    await dialog.getByRole("button", { name: "Özgün belgeyi indir", exact: true }).click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), "synthetic-service-revenue.csv");
    assert.equal(createHash("sha256").update(readFileSync(await download.path())).digest("hex"), createHash("sha256").update((await fixture("csv")).bytes).digest("hex"));
    await page.keyboard.press("Escape"); await page.reload(); await report.waitFor({ timeout: 30000 });
    assert.match(await report.innerText(), /19\.000,50 USD/);
    await page.screenshot({ path: join(outputDirectory, "report.png"), fullPage: true });
    console.log(JSON.stringify({ browser: "real-source-report-reload", status: "passed" }));
  } finally { await browser.close(); }
}

// Tek sınama ya da altı dil çalışır. İlk hatada durur ve yalnız koşunun hesaplarını temizler.
async function main(args) {
  const mode = acceptanceMode(args);
  const config = configuration(mode);
  const gitCommit = resolveAcceptanceGitCommit();
  const accounts = [], results = [], reports = [], cleanupErrors = [];
  const journal = createAcceptanceJournal("tabular");
  const outputDirectory = journal.path.replace(/\.json$/, "-evidence");
  mkdirSync(outputDirectory, { mode: 0o700 });
  const closed = mode === "closed";
  const cases = mode === "full" ? locales : locales.slice(0, 1);
  let failure;
  console.log(JSON.stringify({ phase: "start", mode, gitCommit, caseCount: cases.length, outputDirectory, journal: journal.path }));
  try {
    for (let index = 0; index < Math.ceil(cases.length / 2); index++) {
      const app = initializeApp(config.firebase, `live-table-${randomUUID()}`);
      const email = createTabularAcceptanceEmail();
      const password = `Synthetic-${randomUUID()}!`;
      const account = { app, email, password, ids: [] }; accounts.push(account);
      const created = await createUserWithEmailAndPassword(getAuth(app), email, password); account.uid = created.user.uid;
      journal.account(account.uid);
      if (!closed) {
        await journal.grantTabularBeta(account.uid, email);
        const refreshed = await created.user.getIdTokenResult(true);
        assert.equal(refreshed.claims.incagenTabularBeta, true, "Synthetic beta token did not refresh.");
      }
    }
    for (let index = 0; index < cases.length; index++) {
      const accountIndex = Math.floor(index / 2);
      const account = accounts[accountIndex];
      const locale = cases[index], format = index % 2 ? "xlsx" : "csv";
      const input = await fixture(format);
      const sourceSha256 = createHash("sha256").update(input.bytes).digest("hex");
      const caseId = `${mode}:${index + 1}:${locale}:${input.caseId}`;
      const created = (await call(account, "createAnalysis", { requestId: randomUUID(), title: "Synthetic service analysis", business: "Synthetic acceptance", objective: input.objective, files: [{ name: input.name, size: input.bytes.length, contentType: input.type }] })).data;
      account.ids.push(created.id);
      journal.analysis(account.uid, created.id);
      await uploadBytes(ref(getStorage(account.app), created.paths[0]), input.bytes, { contentType: input.type });
      await call(account, "prepareAnalysis", { id: created.id });
      const catalog = (await call(account, "getAnalysisTables", { id: created.id })).data;
      assert.ok(catalog.tables.some(table => table.sheet === input.selection.sheet && table.rows === input.rows));
      const request = { id: created.id, sourceId: "file-0", selection: input.selection, locale };
      await checkAdmission(mode, catalog.access, request, async data => (await call(account, "startAnalysis", data)).data);
      if (closed) {
        const record = (await getDoc(doc(getFirestore(account.app), `users/${account.uid}/analyses/${created.id}`))).data();
        assert.equal(record.ai, undefined, "Closed rollout must not reserve a paid job.");
        await checkBrowser(account, created.id, config.url, { closed, outputDirectory });
        console.log(JSON.stringify({ phase: "closed-rollout", paidJobReserved: false, modelCalls: 0, status: "passed" }));
        break;
      }
      if (mode === "full") {
        const other = accounts[(accountIndex + 1) % accounts.length];
        await assert.rejects(call(other, "getAnalysisResult", { id: created.id }), { code: "functions/not-found" });
      }
      console.log(JSON.stringify({ phase: "real-model-start", run: index + 1, locale, format, caseId }));
      const recordRef = doc(getFirestore(account.app), `users/${account.uid}/analyses/${created.id}`);
      const runId = randomUUID();
      let job, artifact;
      try {
        await call(account, "startAnalysis", request);
        const record = (await getDoc(recordRef)).data();
        job = record?.ai;
        artifact = (await call(account, "getAnalysisResult", { id: created.id })).data;
        checkResult(artifact, record, input, created.id, locale);
        if (mode === "full") {
          const cached = (await call(account, "startAnalysis", request)).data;
          assert.equal(cached.reused, true);
          assert.equal((await getDoc(recordRef)).data().ai.attempts, 1);
        }
      } catch (error) {
        const reason = error?.details?.analysisFailure;
        const failure = analysisFailures.has(reason) ? reason : error instanceof assert.AssertionError ? "acceptance-validation" : "acceptance-request";
        results.push(usageRecord({ runId, gitCommit, caseId, locale, format, sourceSha256, job, passed: false, failure }));
        reports.push({ runId, gitCommit, caseId, format, locale, sourceSha256, status: "failed", failure });
        writePrivateJson(join(outputDirectory, "runs.json"), results);
        throw error;
      }
      const { reportFile, reportSha256 } = writeVerifiedReportFile(outputDirectory, `${locale}-${format}-result.json`, artifact.result);
      const { humanReviewFile } = writePendingHumanReviewFile(outputDirectory, `human-review-${locale}-${format}.json`, {
        reportId: created.id, reportSha256, sourceSha256, locale, gitCommit,
      });
      results.push(usageRecord({ runId, gitCommit, caseId, locale, format, sourceSha256, reportFile, reportSha256, job, passed: true }));
      reports.push({ runId, gitCommit, caseId, format, locale, sourceSha256, reportId: created.id, reportFile, reportSha256, humanReviewFile, status: "completed" });
      writePrivateJson(join(outputDirectory, "runs.json"), results);
      console.log(JSON.stringify({ phase: "real-model-passed", run: index + 1, locale, aggregate: input.total, durationMs: job.durationMs, tokens: job.usage.totalTokens }));
    }
    if (!closed) await checkBrowser(accounts[0], accounts[0].ids[0], config.url, { closed, outputDirectory });
  } catch (error) { failure = error; }
  finally {
    for (const account of accounts) {
      if (account.uid) try {
        await signInWithEmailAndPassword(getAuth(account.app), account.email, account.password);
        for (const id of account.ids) {
          const deadline = Date.now() + 250000;
          while (true) {
            const record = (await getDoc(doc(getFirestore(account.app), `users/${account.uid}/analyses/${id}`))).data();
            if (record?.ai?.status !== "running" || record.ai.leaseUntil < Date.now()) break;
            if (Date.now() > deadline) throw new Error("Synthetic active job did not settle.");
            await pause(10000);
          }
        }
        await call(account, "deleteAccount", { confirmation: "HESABIMI SİL" });
      } catch { cleanupErrors.push(account.uid); }
      await deleteApp(account.app);
    }
    const accountCount = accounts.filter(account => account.uid).length;
    let cleanupStatus = accountCount > 0 ? "unverified" : "none-created";
    try {
      assert.equal(cleanupErrors.length, 0, "Synthetic cleanup failed; inspect the resource manifest.");
      if (accountCount > 0) {
        await journal.verifyClean(config.firebase);
        cleanupStatus = "verified";
      }
    } catch (error) { failure ??= error; }
    if (!failure && results.length !== (closed ? 0 : cases.length)) failure = new Error("Acceptance case count mismatch.");
    const finalized = finalizeAcceptanceEvidence({ outputDirectory, mode, gitCommit, failure, results, reports, cleanupStatus });
    failure = finalized.failure;
    console.log(JSON.stringify({ phase: "cleanup", status: cleanupStatus, accounts: accountCount, evidenceVerified: finalized.verification.verified }));
    console.log(JSON.stringify(finalized.acceptance));
  }
  if (failure) throw failure;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) main(process.argv.slice(2)).catch(error => {
  console.error(JSON.stringify({ status: "failed", code: error?.code || error?.name || "unknown", message: "Son aşamayı ve koşuya özel temizlik günlüğünü kontrol edin." }));
  process.exitCode = 1;
});
