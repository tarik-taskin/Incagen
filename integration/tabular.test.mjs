import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getStorage, connectStorageEmulator, ref, uploadBytes } from "firebase/storage";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage: getAdminStorage } = require("firebase-admin/storage");

// Yetki testleri gerçek buluta düşemez; tüm hesaplar yalnız açıkça seçilen demo emülatöründedir.
async function client() {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? "", /^127\.0\.0\.1:/);
  const app = initializeApp({ projectId: "demo-incagen", apiKey: "demo-key", storageBucket: "demo-incagen.appspot.com" }, crypto.randomUUID());
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const functions = getFunctions(app, "europe-west1"); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const storage = getStorage(app); connectStorageEmulator(storage, "127.0.0.1", 9199);
  await createUserWithEmailAndPassword(auth, `table-${crypto.randomUUID()}@example.test`, "Synthetic123!");
  return { app, auth, functions, storage, call: (name, data) => httpsCallable(functions, name, { timeout: 180000 })(data) };
}

test("gerçek Python hesabı, kaynaklı rapor, tekrar/yenileme, izolasyon ve temiz silme", { timeout: 180000 }, async () => {
  if (!getApps().length) initializeAdmin({ projectId: "demo-incagen", storageBucket: "demo-incagen.appspot.com" });
  const own = await client(), other = await client(), db = getFirestore();
  const selection = { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "en", unit: "USD" };
  const body = Buffer.from("Channel,Revenue,Notes\nWeb,0.10,Good\nStore,0.20,Review\n");
  const create = async () => {
    const { data } = await own.call("createAnalysis", { requestId: crypto.randomUUID(), title: "Actual table test", business: "Synthetic", objective: "Compare revenue by channel", files: [{ name: "revenue.csv", size: body.length, contentType: "text/csv" }] });
    await uploadBytes(ref(own.storage, data.paths[0]), body, { contentType: "text/csv" });
    await own.call("prepareAnalysis", { id: data.id }); return data.id;
  };
  try {
    const id = await create(), record = db.doc(`users/${own.auth.currentUser.uid}/analyses/${id}`);
    assert.equal((await own.call("getAnalysisTables", { id })).data.tables[0].rows, 2);
    for (const name of ["getAnalysisTables", "getAnalysisResult", "startAnalysis"]) await assert.rejects(other.call(name, name === "startAnalysis" ? { id, sourceId: "file-0", selection, locale: "en" } : { id }), { code: "functions/not-found" });
    await assert.rejects(own.call("startAnalysis", { id, sourceId: "file-0", selection: { ...selection, currencyGuess: true }, locale: "en" }), { code: "functions/invalid-argument" });
    const input = { id, sourceId: "file-0", selection, locale: "en" };
    await Promise.all([own.call("startAnalysis", input), own.call("startAnalysis", input)]);
    const completed = (await record.get()).data();
    assert.equal(completed.ai.status, "completed"); assert.equal(completed.ai.attempts, 1); assert.equal(completed.ai.model, "emulator");
    const report = (await own.call("getAnalysisResult", { id })).data;
    assert.equal(report.result.metrics.find(metric => metric.id === "aggregate").value, 0.3);
    assert.equal(report.result.charts.length, 1); assert.equal(report.sources[0].fileName, "revenue.csv");
    assert.equal((await own.call("startAnalysis", input)).data.reused, true);
    assert.equal((await record.get()).data().ai.attempts, 1);
    await assert.rejects(own.call("startAnalysis", { ...input, locale: "de" }), { code: "functions/failed-precondition" });
    assert.deepEqual((await own.call("getAnalysisResult", { id })).data.result, report.result);
    const retryId = await create(), retryInput = { ...input, id: retryId }, retryRecord = db.doc(`users/${own.auth.currentUser.uid}/analyses/${retryId}`);
    await assert.rejects(own.call("startAnalysis", { ...retryInput, selection: { ...selection, valueColumn: 2 } }), { code: "functions/failed-precondition" });
    assert.equal((await retryRecord.get()).data().ai.status, "failed");
    await own.call("startAnalysis", retryInput);
    assert.equal((await retryRecord.get()).data().ai.status, "completed");
    assert.equal((await retryRecord.get()).data().ai.attempts, 2);
    const thirdId = crypto.randomUUID();
    await db.doc(`users/${own.auth.currentUser.uid}/analyses/${thirdId}`).set({ ...completed, ai: null });
    await assert.rejects(own.call("startAnalysis", { ...input, id: thirdId }), { code: "functions/resource-exhausted" });
    await own.call("deleteAnalysis", { id: thirdId });
    for (const removeId of [id, retryId]) {
      await own.call("deleteAnalysis", { id: removeId });
      assert.equal((await db.doc(`users/${own.auth.currentUser.uid}/analyses/${removeId}`).get()).exists, false);
      const [files] = await getAdminStorage().bucket().getFiles({ prefix: `derived/${own.auth.currentUser.uid}/analyses/${removeId}/` });
      assert.equal(files.length, 0);
    }
  } finally { await deleteApp(own.app); await deleteApp(other.app); }
});

test("atomik iş kabulü, sınırlar ve geç gelen/silinen sonuçların reddi", { timeout: 30000 }, async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? "", /^127\.0\.0\.1:/);
  if (!getApps().length) initializeAdmin({ projectId: "demo-incagen", storageBucket: "demo-incagen.appspot.com" });
  const { reserveAnalysis, completeAnalysis } = require("./lib/analysis/tabular-jobs");
  const { analysisFingerprint } = require("./lib/analysis/tabular-result");
  const { getQuotaDay } = require("./lib/contracts");
  const db = getFirestore(), uid = crypto.randomUUID(), id = crypto.randomUUID(), record = db.doc(`users/${uid}/analyses/${id}`);
  const selection = { sheet: null, valueColumn: 1, groupColumn: null, aggregation: "sum", numberFormat: "en", unit: "number" };
  const input = { id, sourceId: "file-0", selection, locale: "en" }, fingerprint = analysisFingerprint("a", "file-0", selection, "en");
  await record.set({ status: "completed" });
  const starts = await Promise.all([reserveAnalysis(uid, input, fingerprint), reserveAnalysis(uid, input, fingerprint)]);
  assert.equal(starts.filter(value => value.state === "started").length, 1);
  const job = starts[0].job;
  assert.equal(await completeAnalysis(uid, id, crypto.randomUUID(), { ...job, status: "completed" }), false);
  await db.doc(`users/${uid}`).set({ deletingAccount: true });
  assert.equal(await completeAnalysis(uid, id, job.attemptId, { ...job, status: "completed" }), false);
  await db.doc(`users/${uid}`).delete();
  await record.delete();
  assert.equal(await completeAnalysis(uid, id, job.attemptId, { ...job, status: "completed" }), false);
  await record.set({ status: "completed", ai: { ...job, status: "failed", attempts: 3 } });
  await assert.rejects(reserveAnalysis(uid, input, fingerprint), { code: "resource-exhausted" });
  await record.set({ status: "completed" });
  await db.doc(`internalAnalysisQuotas/${getQuotaDay()}`).set({ count: 100 });
  await assert.rejects(reserveAnalysis(crypto.randomUUID(), { ...input, id: crypto.randomUUID() }, fingerprint), { code: "not-found" });
  await assert.rejects(reserveAnalysis(uid, input, fingerprint), { code: "resource-exhausted" });
  await db.doc(`internalAnalysisQuotas/${getQuotaDay()}`).delete();
  await record.delete();
});

test("sağlayıcı bekleme süresinde deneme/kota tüketmez; süre dolunca yalnız açık isteği kabul eder", async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? "", /^127\.0\.0\.1:/);
  if (!getApps().length) initializeAdmin({ projectId: "demo-incagen", storageBucket: "demo-incagen.appspot.com" });
  const { reserveAnalysis } = require("./lib/analysis/tabular-jobs");
  const { getQuotaDay } = require("./lib/contracts");
  const db = getFirestore(), uid = crypto.randomUUID(), id = crypto.randomUUID(), now = Date.UTC(2001, 0, 1, 12);
  const record = db.doc(`users/${uid}/analyses/${id}`), day = getQuotaDay(new Date(now));
  const quota = db.doc(`internalAnalysisQuotas/${day}`), own = db.doc(`users/${uid}/aiQuotas/${day}`);
  const input = { id, sourceId: "file-0", locale: "en", selection: { sheet: null, valueColumn: 1, groupColumn: null, aggregation: "sum", numberFormat: "plain", unit: "USD" } };
  try {
    await record.set({ status: "completed", ai: { status: "failed", attempts: 1, error: "provider-busy", retryAfter: now + 30000 } });
    await assert.rejects(reserveAnalysis(uid, input, "synthetic-fingerprint", now), { code: "resource-exhausted" });
    assert.equal((await record.get()).data().ai.attempts, 1);
    assert.equal((await quota.get()).exists, false); assert.equal((await own.get()).exists, false);
    const next = await reserveAnalysis(uid, input, "synthetic-fingerprint", now + 30001);
    assert.equal(next.state, "started"); assert.equal(next.job.attempts, 2);
    assert.equal((await quota.get()).data().count, 1); assert.equal((await own.get()).data().count, 1);
  } finally { await record.delete(); await quota.delete(); await own.delete(); }
});

test("XLSX çalışma sayfası seçimi ve satır ağırlıklı ortalama tam defterle eşleşir", { timeout: 90000 }, async () => {
  const ExcelJS = require("exceljs"), workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Out of scope").addRows([["Team", "Revenue"], ["Other", 999999]]);
  workbook.addWorksheet("Services").addRows([["Team", "Revenue"], ["A", 10], ["A", 20], ["B", 90]]);
  const body = Buffer.from(await workbook.xlsx.writeBuffer()), own = await client();
  let id;
  try {
    const created = await own.call("createAnalysis", { requestId: crypto.randomUUID(), title: "Sheet selection", business: "Synthetic", objective: "Compare the average revenue of service teams", files: [{ name: "services.xlsx", size: body.length, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }] });
    id = created.data.id;
    await uploadBytes(ref(own.storage, created.data.paths[0]), body, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    await own.call("prepareAnalysis", { id });
    const catalog = (await own.call("getAnalysisTables", { id })).data;
    assert.equal(catalog.tables.length, 2);
    assert.equal(catalog.tables.find(table => table.sheet === "Services").rows, 3);
    await own.call("startAnalysis", { id, sourceId: "file-0", locale: "de", selection: { sheet: "Services", valueColumn: 1, groupColumn: 0, aggregation: "mean", numberFormat: "plain", unit: "EUR" } });
    const artifact = (await own.call("getAnalysisResult", { id })).data;
    assert.equal(artifact.result.metrics.find(metric => metric.id === "aggregate").value, 40);
    assert.deepEqual(artifact.result.datasets[0].points.map(point => [point.label, point.value]), [["B", 90], ["A", 15]]);
    assert.equal(artifact.scope.rows, 3);
    assert.ok(artifact.sources[0].chunks.every(chunk => chunk.locator.sheet === "Services"));
    assert.equal(artifact.locale, "de");
    assert.equal(artifact.result.metrics.find(metric => metric.id === "aggregate").unit, "EUR");
  } finally {
    if (id) await own.call("deleteAnalysis", { id });
    await deleteApp(own.app);
  }
});
