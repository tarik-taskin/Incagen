import assert from "node:assert/strict";
import { createAcceptanceJournal, writePrivateJson } from "./acceptance-resources.mjs";
import { tabularFixture } from "./tabular-synthetic-fixtures.mjs";
import { execSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, getDoc, doc } from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { chromium } from "@playwright/test";
const PROJECT = "incagen-eeef4";
const locales = ["tr", "en", "de", "es", "zh", "ar"];
const analysisFailures = new Set(["invalid-data", "scope-limit", "configuration", "provider", "provider-busy", "validation", "timeout"]);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Canlı ücretli kabul yalnız açık opt-in ve bilinen proje/arayüz adresiyle çalışabilir; sağlayıcı anahtarı okunmaz.
function configuration() {
  assert.equal(process.env.INCAGEN_LIVE_MODEL_ACCEPTANCE, "1", "Explicit live-model acceptance opt-in required.");
  const url = new URL(process.env.INCAGEN_ACCEPTANCE_URL || "");
  assert.ok((url.protocol === "http:" && url.hostname === "127.0.0.1") || (url.protocol === "https:" && (url.hostname === "incagen.netlify.app" || /^[a-f0-9]+--incagen\.netlify\.app$/.test(url.hostname))), "Unexpected acceptance URL.");
  const values = Object.fromEntries(readFileSync(".env.cloud-preview.local", "utf8").split(/\r?\n/).filter(line => /^VITE_FIREBASE_/.test(line)).map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
  assert.equal(values.VITE_FIREBASE_PROJECT_ID, PROJECT);
  assert.ok(!process.env.FUNCTIONS_EMULATOR && !process.env.FIRESTORE_EMULATOR_HOST);
  return { url: url.origin, firebase: { apiKey: values.VITE_FIREBASE_API_KEY, authDomain: values.VITE_FIREBASE_AUTH_DOMAIN, projectId: PROJECT, storageBucket: values.VITE_FIREBASE_STORAGE_BUCKET, appId: values.VITE_FIREBASE_APP_ID } };
}

// CLI modu seçilen azami vaka sayısını belirler. Geçersiz bayrak ücretli moda düşmez.
export function acceptanceMode(args) {
  if (args.length === 0) return "full";
  if (args.length === 1 && args[0] === "--verify-closed") return "closed";
  if (args.length === 1 && args[0] === "--smoke") return "smoke";
  throw new Error("Yalnız --smoke veya --verify-closed bayraklarından biri kullanılabilir.");
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
  assert.equal(job.model, "gemini-3.8-flash");
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
const SECRET_LEAK_PATTERN = /(Bearer\s+[A-Za-z0-9._-]+|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]{15,}|ghp_[0-9A-Za-z]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|"(?:apiKey|password|secret|token)"\s*:|\b(?:apiKey|password|secret|token)\s*=|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

// Koşu kapsamındaki mevcut Git HEAD SHA bilgisini alır; hata olursa "unknown" döner.
export function resolveAcceptanceGitCommit(explicitCommit) {
  if (explicitCommit) return explicitCommit;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
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

// İnsan kararının otomatik doğrulamadan ayrı, geçerli rapor hash'ine bağlı ve altı ölçütlü olduğunu denetler.
export function validateHumanReviewDecision(record, expectedBinding) {
  if (!record || record.kind !== "human-review-decision") {
    return { valid: false, status: "invalid", reason: "Geçersiz insan inceleme kaydı türü." };
  }
  if (!record.reportId || record.reportId !== expectedBinding.reportId
    || !SHA256_HEX.test(String(record.reportSha256)) || record.reportSha256 !== expectedBinding.reportSha256
    || !SHA256_HEX.test(String(record.sourceSha256)) || record.sourceSha256 !== expectedBinding.sourceSha256
    || !locales.includes(record.locale) || record.locale !== expectedBinding.locale) {
    return { valid: false, status: "invalid", reason: "İnsan kararı rapor kimliği, kaynak/sonuç hash veya dille eşleşmiyor." };
  }
  if (!["pending", "approved", "rejected"].includes(record.decision)) {
    return { valid: false, status: "invalid", reason: "Geçersiz insan karar durumu." };
  }
  for (const key of HUMAN_REVIEW_CRITERIA) {
    if (!["pending", "pass", "fail"].includes(record.criteria?.[key])) {
      return { valid: false, status: "invalid", reason: `Eksik veya geçersiz inceleme ölçütü: ${key}.` };
    }
  }
  if (record.decision === "pending") {
    return { valid: true, status: "pending", approved: false, reason: "Gerçek insan incelemesi henüz beklemede." };
  }
  if (record.decision === "approved") {
    const allPass = HUMAN_REVIEW_CRITERIA.every(key => record.criteria[key] === "pass");
    if (!allPass || !record.reviewedAt) {
      return { valid: false, status: "invalid", approved: false, reason: "Altı ölçütün tamamı pass ve inceleme zamanı olmadan onay verilemez." };
    }
    return { valid: true, status: "approved", approved: true };
  }
  return { valid: true, status: "rejected", approved: false };
}

// Kabul dizinindeki acceptance.json, runs.json ve rapor dosyalarını bütünlük/temizlik/eski-kayıt sınırıyla doğrular.
export function verifyAcceptanceEvidence(outputDirectory, options = {}) {
  const root = resolve(outputDirectory);
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) {
    return { verified: false, status: "failed", legacy: false, errors: ["Kabul kanıt dizini bulunamadı veya symlink."], verifiedReports: [] };
  }
  const realRoot = realpathSync(root);
  const acceptancePath = join(root, "acceptance.json");
  const runsPath = join(root, "runs.json");
  if (!existsSync(acceptancePath) || lstatSync(acceptancePath).isSymbolicLink()) {
    return { verified: false, status: "failed", legacy: false, errors: ["acceptance.json eksik veya geçersiz."], verifiedReports: [] };
  }

  const acceptanceText = readFileSync(acceptancePath, "utf8");
  const runsText = existsSync(runsPath) && !lstatSync(runsPath).isSymbolicLink() ? readFileSync(runsPath, "utf8") : "[]";
  if (SECRET_LEAK_PATTERN.test(acceptanceText) || SECRET_LEAK_PATTERN.test(runsText)) {
    return { verified: false, status: "failed", legacy: false, errors: ["Kabul kaydında gizli veri/kimlik bilgisi sızıntısı tespit edildi."], verifiedReports: [] };
  }

  const acceptance = JSON.parse(acceptanceText);
  const runs = JSON.parse(runsText);

  const missingLegacyFields = [];
  if (!acceptance.schemaVersion || acceptance.schemaVersion < 2) missingLegacyFields.push("schemaVersion");
  if (!acceptance.gitCommit) missingLegacyFields.push("gitCommit");
  if (!Array.isArray(acceptance.reports)) missingLegacyFields.push("reports");
  if (missingLegacyFields.length > 0) {
    return {
      verified: false,
      status: "legacy-unverified",
      legacy: true,
      missingFields: missingLegacyFields,
      readOnlySummary: {
        phase: acceptance.phase ?? null,
        mode: acceptance.mode ?? null,
        status: acceptance.status ?? null,
        completedReportCount: acceptance.completedReportCount ?? 0,
        cleanup: acceptance.cleanup ?? "unknown",
        runCount: Array.isArray(runs) ? runs.length : 0,
      },
      errors: [`Eski biçimli kayıt okundu; doğrulama alanları eksik (${missingLegacyFields.join(", ")}).`],
      verifiedReports: [],
    };
  }

  const errors = [];
  const verifiedReports = [];
  if (!GIT_SHA.test(String(acceptance.gitCommit))) errors.push("Geçersiz Git commit SHA.");
  if (options.expectedCommit && acceptance.gitCommit !== options.expectedCommit) errors.push("Git commit beklenen revizyonla eşleşmiyor.");
  if (acceptance.cleanup !== "verified") errors.push(`Temizlik doğrulanmadı: ${String(acceptance.cleanup)}.`);
  if (acceptance.status !== "passed") errors.push(`Kabul durumu başarısız: ${String(acceptance.status)}.`);
  if (acceptance.mode === "closed") {
    if (acceptance.completedReportCount !== 0 || acceptance.reports.length !== 0) {
      errors.push("Kapalı kabul modunda tamamlanmış rapor kaydı bulunamaz.");
    }
  } else {
    if (acceptance.completedReportCount !== acceptance.caseCount) {
      errors.push(`Tamamlanan rapor sayısı (${acceptance.completedReportCount}) beklenen vaka sayısına (${acceptance.caseCount}) eşit değil.`);
    }
    if (acceptance.reports.length !== acceptance.caseCount) {
      errors.push("Rapor kayıt sayısı beklenen vaka sayısından az/farklı.");
    }
  }

  const runById = new Map(Array.isArray(runs) ? runs.map(run => [run.runId, run]) : []);
  for (const entry of acceptance.reports) {
    if (entry.status !== "completed") {
      errors.push(`Tamamlanmamış vaka kaydı (${String(entry.caseId)}): ${String(entry.status)}.`);
      continue;
    }
    if (!GIT_SHA.test(String(entry.gitCommit)) || entry.gitCommit !== acceptance.gitCommit) {
      errors.push(`Rapor Git commit eşleşmiyor (${String(entry.caseId)}).`);
      continue;
    }
    if (!entry.caseId || !["csv", "xlsx"].includes(entry.format) || !locales.includes(entry.locale)) {
      errors.push(`Eksik vaka kimliği, format veya dil (${String(entry.caseId)}).`);
      continue;
    }
    if (!SHA256_HEX.test(String(entry.sourceSha256)) || !SHA256_HEX.test(String(entry.reportSha256))) {
      errors.push(`Geçersiz SHA-256 özeti (${entry.caseId}).`);
      continue;
    }
    if (!entry.reportFile || isAbsolute(entry.reportFile) || entry.reportFile.includes("..")) {
      errors.push(`Geçersiz rapor dosya yolu (${entry.caseId}).`);
      continue;
    }
    const reportPath = join(root, entry.reportFile);
    if (!existsSync(reportPath) || lstatSync(reportPath).isSymbolicLink()) {
      errors.push(`Rapor dosyası eksik veya symlink (${entry.reportFile}).`);
      continue;
    }
    const realReportPath = realpathSync(reportPath);
    if (!realReportPath.startsWith(`${realRoot}${sep}`)) {
      errors.push(`Rapor dosyası kanıt dizini dışında (${entry.reportFile}).`);
      continue;
    }
    const reportText = readFileSync(reportPath, "utf8");
    if (SECRET_LEAK_PATTERN.test(reportText)) {
      errors.push(`Rapor dosyasında gizli veri sızıntısı (${entry.reportFile}).`);
      continue;
    }
    const actualSha256 = createHash("sha256").update(reportText, "utf8").digest("hex");
    if (actualSha256 !== entry.reportSha256) {
      errors.push(`Rapor SHA-256 uyuşmuyor (${entry.reportFile}).`);
      continue;
    }
    const linkedRun = runById.get(entry.runId);
    if (!linkedRun || linkedRun.status !== "completed" || linkedRun.gitCommit !== entry.gitCommit
      || linkedRun.caseId !== entry.caseId || linkedRun.format !== entry.format || linkedRun.locale !== entry.locale
      || linkedRun.sourceSha256 !== entry.sourceSha256 || linkedRun.reportFile !== entry.reportFile
      || linkedRun.reportSha256 !== entry.reportSha256) {
      errors.push(`runs.json ile rapor kaydı uyuşmuyor (${entry.runId}).`);
      continue;
    }
    verifiedReports.push(entry);
  }

  return {
    verified: errors.length === 0,
    status: errors.length === 0 ? "verified" : "failed",
    legacy: false,
    gitCommit: acceptance.gitCommit,
    mode: acceptance.mode,
    reportCount: acceptance.reports.length,
    verifiedReports,
    errors,
  };
}

// Yeni arayüz aynı gerçek kayıtla açılır; okuma/yenileme/kaynak inceleme yeni model çağrısı yapmaz.
async function checkBrowser(account, id, baseURL, { closed, outputDirectory }) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    await page.goto(baseURL);
    await page.getByRole("button", { name: "Analize başla", exact: true }).click();
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
  const config = configuration(), accounts = [], results = [], reports = [], cleanupErrors = [];
  const gitCommit = resolveAcceptanceGitCommit();
  const journal = createAcceptanceJournal("tabular");
  const outputDirectory = journal.path.replace(/\.json$/, "-evidence");
  mkdirSync(outputDirectory, { mode: 0o700 });
  const closed = mode === "closed";
  const cases = mode === "full" ? locales : locales.slice(0, 1);
  let failure;
  console.log(JSON.stringify({ phase: "start", mode, gitCommit, caseCount: cases.length, outputDirectory, journal: journal.path }));
  try {
    for (let index = 0; index < Math.ceil(cases.length / 2); index++) {
      const app = initializeApp(config.firebase, `live-table-${randomUUID()}`), email = `table-acceptance-${randomUUID()}@example.test`, password = `Synthetic-${randomUUID()}!`;
      const account = { app, email, password, ids: [] }; accounts.push(account);
      const created = await createUserWithEmailAndPassword(getAuth(app), email, password); account.uid = created.user.uid;
      journal.account(account.uid);
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
      if (closed) {
        await assert.rejects(call(account, "startAnalysis", request), { code: "functions/failed-precondition", details: { analysisFailure: "configuration" } });
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
      results.push(usageRecord({ runId, gitCommit, caseId, locale, format, sourceSha256, reportFile, reportSha256, job, passed: true }));
      reports.push({ runId, gitCommit, caseId, format, locale, sourceSha256, reportFile, reportSha256, status: "completed" });
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
    const acceptance = {
      schemaVersion: 2,
      phase: "mechanical-acceptance",
      gitCommit,
      status: failure ? "failed" : "passed",
      mode,
      caseCount: cases.length,
      completedReportCount: results.filter(run => run.status === "completed").length,
      humanReviewRequired: !closed,
      cleanup: cleanupStatus,
      reports,
    };
    writePrivateJson(join(outputDirectory, "acceptance.json"), acceptance);
    console.log(JSON.stringify({ phase: "cleanup", status: cleanupStatus, accounts: accountCount }));
    console.log(JSON.stringify(acceptance));
  }
  if (failure) throw failure;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) main(process.argv.slice(2)).catch(error => {
  console.error(JSON.stringify({ status: "failed", code: error?.code || error?.name || "unknown", message: "Son aşamayı ve koşuya özel temizlik günlüğünü kontrol edin." }));
  process.exitCode = 1;
});
