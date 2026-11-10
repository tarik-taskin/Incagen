import assert from "node:assert/strict";
import { createAcceptanceJournal } from "./acceptance-resources.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, getDoc, doc } from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { chromium } from "@playwright/test";
const backend = createRequire(new URL("../functions/package.json", import.meta.url));
const ExcelJS = backend("exceljs");
const PROJECT = "incagen-eeef4", locales = ["tr", "en", "de", "es", "zh", "ar"], pause = ms => new Promise(resolve => setTimeout(resolve, ms));

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

// Aynı cevap anahtarını üç bağımsız dil/koşuda sınar; Excel'in seçilmeyen sayfası hesaba karışamaz.
async function fixture(kind) {
  if (kind === "csv") return { name: "synthetic-service-revenue.csv", type: "text/csv", bytes: Buffer.from("Service,NetRevenue\nCloud,12000.10\nCloud,-500.10\nConsulting,5000.20\nConsulting,2500.30\n"), rows: 4, total: 19000.5, points: [["Cloud", 11500], ["Consulting", 7500.5]], selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" }, objective: "Compare recorded net revenue across service lines. Explain which profitability conclusions cannot be supported without cost data." };
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Out of scope").addRows([["Team", "Amount"], ["Other", 999999]]);
  workbook.addWorksheet("Services").addRows([["Team", "Amount"], ["A", 10], ["A", 20], ["B", 90]]);
  return { name: "synthetic-service-teams.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: Buffer.from(await workbook.xlsx.writeBuffer()), rows: 3, total: 40, points: [["B", 90], ["A", 15]], selection: { sheet: "Services", valueColumn: 1, groupColumn: 0, aggregation: "mean", numberFormat: "plain", unit: "EUR" }, objective: "Compare the unweighted average amount per team on the Services worksheet. Explain which business conclusions need additional evidence." };
}

// Yalnız testte üretilen oturumla callable çağırır; model için otomatik tekrar yoktur.
async function call(account, name, body) {
  try { return await httpsCallable(getFunctions(account.app, "europe-west1"), name, { timeout: 190000 })(body); }
  catch (error) {
    console.log(JSON.stringify({ callable: name, code: error?.code || "unknown", ...(typeof error?.details?.analysisFailure === "string" ? { analysisFailure: error.details.analysisFailure } : {}) }));
    throw error;
  }
}

// Defter, kaynak hash/konumları ve kayıtlı kullanım gerçek servisten bağımsız cevap anahtarıyla karşılaştırılır.
function checkResult(artifact, record, expected, id, locale) {
  assert.equal(record.ai.model, "gemini-3.8-flash"); assert.equal(record.ai.status, "completed"); assert.equal(record.ai.attempts, 1);
  assert.ok(record.ai.usage?.totalTokens > 0); assert.ok(record.ai.durationMs > 0 && record.ai.pythonMs > 0 && record.ai.modelMs > 0);
  assert.equal(artifact.locale, locale); assert.equal(artifact.result.analysisId, id); assert.equal(artifact.scope.rows, expected.rows);
  assert.equal(artifact.result.metrics.find(item => item.id === "aggregate").value, expected.total);
  assert.equal(artifact.result.metrics.find(item => item.id === "aggregate").unit, expected.selection.unit);
  assert.deepEqual(artifact.result.datasets[0].points.map(item => [item.label, item.value]), expected.points);
  assert.equal(artifact.sources[0].sha256, createHash("sha256").update(expected.bytes).digest("hex"));
  assert.ok(artifact.sources[0].chunks.every(chunk => (chunk.locator.sheet ?? null) === expected.selection.sheet));
  for (const metric of artifact.result.metrics) for (const anchor of metric.evidence) {
    assert.equal(anchor.sha256, artifact.sources[0].sha256); assert.equal(anchor.sourceId, "file-0");
    assert.ok(anchor.locator.rowStart >= 2 && anchor.locator.rowEnd <= expected.rows + 1);
  }
  assert.ok(artifact.result.summary.length > 0 && artifact.result.findings.length > 0);
  assert.ok(artifact.result.summary.every(item => !/\p{N}/u.test(item.text)));
  assert.ok(artifact.result.limitations.length >= 4);
}

// Yeni arayüz aynı gerçek kayıtla açılır; okuma/yenileme/kaynak inceleme yeni model çağrısı yapmaz.
async function checkBrowser(account, id, baseURL, closed = false) {
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
    await page.screenshot({ path: "/tmp/incagen-live-tabular-report.png", fullPage: true });
    console.log(JSON.stringify({ browser: "real-source-report-reload", status: "passed" }));
  } finally { await browser.close(); }
}

// En fazla altı gerçek çağrı yapar; hata halinde durur ve yalnız kendi sentetik hesaplarını temizler.
async function main() {
  const config = configuration(), accounts = [], results = [], cleanupErrors = [], journal = createAcceptanceJournal("tabular");
  const closed = process.argv.includes("--verify-closed");
  let failure;
  try {
    for (let index = 0; index < (closed ? 1 : 3); index++) {
      const app = initializeApp(config.firebase, `live-table-${randomUUID()}`), email = `table-acceptance-${randomUUID()}@example.test`, password = `Synthetic-${randomUUID()}!`;
      const account = { app, email, password, ids: [] }; accounts.push(account);
      const created = await createUserWithEmailAndPassword(getAuth(app), email, password); account.uid = created.user.uid;
      journal.account(account.uid);
      writeFileSync("/tmp/incagen-live-tabular-resources.json", JSON.stringify(accounts.filter(item => item.uid).map(({ uid, ids }) => ({ uid, ids }))), { mode: 0o600 });
    }
    writeFileSync("/tmp/incagen-live-tabular-resources.json", JSON.stringify(accounts.map(({ uid, ids }) => ({ uid, ids }))), { mode: 0o600 });
    for (let index = 0; index < (closed ? 1 : locales.length); index++) {
      const account = accounts[Math.floor(index / 2)], other = accounts[(Math.floor(index / 2) + 1) % 3], locale = locales[index], input = await fixture(index % 2 ? "xlsx" : "csv");
      const created = (await call(account, "createAnalysis", { requestId: randomUUID(), title: "Synthetic service analysis", business: "Synthetic acceptance", objective: input.objective, files: [{ name: input.name, size: input.bytes.length, contentType: input.type }] })).data;
      account.ids.push(created.id);
      journal.analysis(account.uid, created.id);
      writeFileSync("/tmp/incagen-live-tabular-resources.json", JSON.stringify(accounts.map(({ uid, ids }) => ({ uid, ids }))), { mode: 0o600 });
      await uploadBytes(ref(getStorage(account.app), created.paths[0]), input.bytes, { contentType: input.type });
      await call(account, "prepareAnalysis", { id: created.id });
      const catalog = (await call(account, "getAnalysisTables", { id: created.id })).data;
      assert.ok(catalog.tables.some(table => table.sheet === input.selection.sheet && table.rows === input.rows));
      const request = { id: created.id, sourceId: "file-0", selection: input.selection, locale };
      if (closed) {
        await assert.rejects(call(account, "startAnalysis", request), { code: "functions/failed-precondition", details: { analysisFailure: "configuration" } });
        const record = (await getDoc(doc(getFirestore(account.app), `users/${account.uid}/analyses/${created.id}`))).data();
        assert.equal(record.ai, undefined, "Closed rollout must not reserve a paid job.");
        await checkBrowser(account, created.id, config.url, true);
        console.log(JSON.stringify({ phase: "closed-rollout", paidJobReserved: false, modelCalls: 0, status: "passed" }));
        break;
      }
      await assert.rejects(call(other, "getAnalysisResult", { id: created.id }), { code: "functions/not-found" });
      console.log(JSON.stringify({ phase: "real-model-start", run: index + 1, locale, format: index % 2 ? "xlsx" : "csv" }));
      await call(account, "startAnalysis", request);
      const path = `users/${account.uid}/analyses/${created.id}`, record = (await getDoc(doc(getFirestore(account.app), path))).data();
      const artifact = (await call(account, "getAnalysisResult", { id: created.id })).data;
      checkResult(artifact, record, input, created.id, locale);
      const cached = (await call(account, "startAnalysis", request)).data; assert.equal(cached.reused, true);
      assert.equal((await getDoc(doc(getFirestore(account.app), path))).data().ai.attempts, 1);
      results.push({ locale, format: index % 2 ? "xlsx" : "csv", aggregate: input.total, durationMs: record.ai.durationMs, pythonMs: record.ai.pythonMs, modelMs: record.ai.modelMs, inputBytes: record.ai.inputBytes, usage: record.ai.usage, result: artifact.result });
      writeFileSync("/tmp/incagen-live-tabular-results.json", JSON.stringify(results, null, 2));
      console.log(JSON.stringify({ phase: "real-model-passed", run: index + 1, locale, aggregate: input.total, durationMs: record.ai.durationMs, tokens: record.ai.usage.totalTokens }));
    }
    if (!closed) await checkBrowser(accounts[0], accounts[0].ids[0], config.url);
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
    if (!cleanupErrors.length && accounts.some(account => account.uid)) await journal.verifyClean(config.firebase);
    assert.equal(cleanupErrors.length, 0, "Synthetic cleanup failed; inspect the resource manifest.");
    console.log(JSON.stringify({ phase: "cleanup", status: accounts.some(account => account.uid) ? "verified" : "none-created", accounts: accounts.filter(account => account.uid).length }));
  }
  if (failure) throw failure;
  assert.equal(results.length, closed ? 0 : 6);
  console.log(closed ? "Closed rollout acceptance passed without model calls." : "Live Python/Gemini/source/report acceptance passed in six languages.");
}

main().catch(error => { console.error(JSON.stringify({ status: "failed", code: error?.code || error?.name || "unknown", message: error instanceof assert.AssertionError ? String(error.message).slice(0, 300) : "Inspect the phase and sanitized backend status." })); process.exitCode = 1; });
