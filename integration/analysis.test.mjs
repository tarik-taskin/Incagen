import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from "firebase/auth";
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

const documentBody = Buffer.from("Sentetik faaliyet belgesi");

// Aynı manifest ve belge içeriğiyle tekrar kullanılabilir test taslağı hazırlar.
function input() {
  return {
    requestId: crypto.randomUUID(),
    title: "Sentetik faaliyet analizi",
    business: "Test",
    files: [{ name: "faaliyet.pdf", size: documentBody.length, contentType: "application/pdf" }],
  };
}

test("belge hazırlığı, izolasyon, idempotency, doğrulama ve silme", { timeout: 120000 }, async () => {
  const a = await client(); const b = await client();
  try {
    const create = httpsCallable(a.functions, "createAnalysis");
    const prepare = httpsCallable(a.functions, "prepareAnalysis");
    const remove = httpsCallable(a.functions, "deleteAnalysis");
    const request = input();
    await assert.rejects(create({ ...request, files: Array.from({ length: 11 }, () => request.files[0]) }));
    const limitFiles = Array.from({ length: 6 }, (_, index) => ({ name: `belge-${index}.pdf`, size: 5 * 1024 * 1024, contentType: "application/pdf" }));
    await assert.rejects(create({ ...input(), files: [...limitFiles, { name: "fazla.pdf", size: 1, contentType: "application/pdf" }] }));
    const atLimit = (await create({ ...input(), files: limitFiles })).data;
    await remove({ id: atLimit.id });
    const { data } = await create(request);
    const again = await create(request);
    assert.equal(data.id, again.data.id);
    const record = doc(a.db, "users", a.auth.currentUser.uid, "analyses", data.id);
    await assert.rejects(setDoc(record, { status: "completed" }));
    await assert.rejects(getDoc(doc(b.db, record.path)));
    await assert.rejects(uploadBytes(ref(b.storage, data.paths[0]), documentBody, { contentType: "application/pdf" }));
    await assert.rejects(uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "text/plain" }));
    await assert.rejects(uploadBytes(ref(a.storage, data.paths[0]), Buffer.from("wrong size"), { contentType: "application/pdf" }));
    await uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "application/pdf" });
    await assert.rejects(getBytes(ref(b.storage, data.paths[0])));
    await assert.rejects(httpsCallable(b.functions, "prepareAnalysis")({ id: data.id }));
    await Promise.all([prepare({ id: data.id }), prepare({ id: data.id })]);
    await prepare({ id: data.id });
    const completed = (await getDoc(record)).data();
    assert.equal(completed.status, "completed");
    assert.equal(completed.report.fileCount, 1);
    assert.equal(completed.report.totalBytes, documentBody.length);
    assert.equal(completed.report.sources[0].name, "faaliyet.pdf");
    const quotaRef = doc(a.db, "users", a.auth.currentUser.uid, "quotas", completed.quotaDay);
    assert.equal((await getDoc(quotaRef)).data().used, 1);
    await assert.rejects(uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "application/pdf" }));
    await remove({ id: data.id }); await remove({ id: data.id });
    assert.equal((await getDoc(record)).exists(), false);
    await assert.rejects(getBytes(ref(a.storage, data.paths[0])));

    const missing = (await create(input())).data;
    await assert.rejects(prepare({ id: missing.id }));
    assert.equal((await getDoc(quotaRef)).data().used, 1);
    await uploadBytes(ref(a.storage, missing.paths[0]), documentBody, { contentType: "application/pdf" });
    await prepare({ id: missing.id });
    assert.equal((await getDoc(quotaRef)).data().used, 2);
    await remove({ id: missing.id });
    await signOut(b.auth);
    await assert.rejects(httpsCallable(b.functions, "createAnalysis")(input()), error => error.code === "functions/unauthenticated");
  } finally { await deleteApp(a.app); await deleteApp(b.app); }
});

test("günlük kota on hazırlıktan sonra sunucuda engellenir", { timeout: 120000 }, async () => {
  const a = await client();
  try {
    const create = httpsCallable(a.functions, "createAnalysis");
    const prepare = httpsCallable(a.functions, "prepareAnalysis");
    const remove = httpsCallable(a.functions, "deleteAnalysis");
    for (let i = 0; i < 11; i++) {
      const { data } = await create(input());
      await uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "application/pdf" });
      if (i < 10) await prepare({ id: data.id });
      else await assert.rejects(prepare({ id: data.id }), error => error.code === "functions/resource-exhausted");
      await remove({ id: data.id });
    }
  } finally { await deleteApp(a.app); }
});
