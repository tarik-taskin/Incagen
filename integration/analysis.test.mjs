import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";

// Test verileri yalnız demo emülatörlerine gider; bağımsız kullanıcı oturumları oluşturur.
async function client() {
  const app = initializeApp({ projectId: "demo-incagen", apiKey: "demo-local-key", storageBucket: "demo-incagen.appspot.com" }, crypto.randomUUID());
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const storage = getStorage(app); connectStorageEmulator(storage, "127.0.0.1", 9199);
  const functions = getFunctions(app, "europe-west1"); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  await createUserWithEmailAndPassword(auth, `test-${crypto.randomUUID()}@example.test`, "Synthetic123!");
  return { app, auth, db, storage, functions };
}
const mapping = { dateColumn: "Tarih", amountColumn: "Tutar", categoryColumn: "Kategori", delimiter: ";", dateFormat: "tr", numberFormat: "tr" };
const csv = "Tarih;Tutar;Kategori\n01.09.2026;1.234,50;A\n02.09.2026;10,25;B";
// Aynı manifest ve dosya içeriğiyle tekrar kullanılabilir test taslağı hazırlar.
function input(text = csv) {
  return { requestId: crypto.randomUUID(), title: "Sentetik satış", business: "Test", currency: "TRY", files: [{ name: "satis.csv", size: Buffer.byteLength(text), mapping }] };
}

test("gerçek rapor, izolasyon, idempotency, hata iadesi ve silme", { timeout: 120000 }, async () => {
  const a = await client(); const b = await client();
  try {
    const create = httpsCallable(a.functions, "createAnalysis");
    const run = httpsCallable(a.functions, "runAnalysis");
    const remove = httpsCallable(a.functions, "deleteAnalysis");
    const request = input();
    const { data } = await create(request);
    const again = await create(request);
    assert.equal(data.id, again.data.id);
    const record = doc(a.db, "users", a.auth.currentUser.uid, "analyses", data.id);
    await assert.rejects(setDoc(record, { status: "completed" }));
    await assert.rejects(getDoc(doc(b.db, record.path)));
    await assert.rejects(uploadBytes(ref(b.storage, data.paths[0]), Buffer.from(csv), { contentType: "text/csv" }));
    await assert.rejects(uploadBytes(ref(a.storage, data.paths[0]), Buffer.from("wrong size"), { contentType: "text/csv" }));
    await uploadBytes(ref(a.storage, data.paths[0]), Buffer.from(csv), { contentType: "text/csv" });
    await assert.rejects(getBytes(ref(b.storage, data.paths[0])));
    await assert.rejects(httpsCallable(b.functions, "runAnalysis")({ id: data.id }));
    await Promise.all([run({ id: data.id }), run({ id: data.id })]);
    await run({ id: data.id });
    const completed = (await getDoc(record)).data();
    assert.equal(completed.status, "completed");
    assert.equal(completed.report.totalCents, 124475);
    assert.equal(completed.report.rowCount, 2);
    const quotaRef = doc(a.db, "users", a.auth.currentUser.uid, "quotas", completed.quotaDay);
    assert.equal((await getDoc(quotaRef)).data().used, 1);
    await assert.rejects(uploadBytes(ref(a.storage, data.paths[0]), Buffer.from(csv), { contentType: "text/csv" }));
    const badCsv = "Tarih;Tutar;Kategori\n31.02.2026;abc;A";
    const failed = (await create(input(badCsv))).data;
    await uploadBytes(ref(a.storage, failed.paths[0]), Buffer.from(badCsv), { contentType: "text/csv" });
    await assert.rejects(run({ id: failed.id }));
    assert.equal((await getDoc(quotaRef)).data().used, 1);
    assert.equal((await getDoc(doc(a.db, "users", a.auth.currentUser.uid, "analyses", failed.id))).data().status, "failed");
    await remove({ id: data.id }); await remove({ id: data.id });
    assert.equal((await getDoc(record)).exists(), false);
    await assert.rejects(getBytes(ref(a.storage, data.paths[0])));
    await remove({ id: failed.id });
  } finally { await deleteApp(a.app); await deleteApp(b.app); }
});
