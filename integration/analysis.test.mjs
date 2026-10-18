import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
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

const documentBody = Buffer.from("Sentetik faaliyet belgesi", "utf8");

// Aynı manifest ve belge içeriğiyle tekrar kullanılabilir test taslağı hazırlar.
function input() {
  return {
    requestId: crypto.randomUUID(),
    title: "Sentetik faaliyet analizi",
    business: "Test",
    objective: "Belgedeki ana konuları kaynaklarıyla açıkla.",
    files: [{ name: "faaliyet.txt", size: documentBody.length, contentType: "text/plain" }],
  };
}

test("belge hazırlığı, izolasyon, idempotency, doğrulama ve silme", { timeout: 120000 }, async () => {
  const a = await client(); const b = await client();
  try {
    const create = httpsCallable(a.functions, "createAnalysis");
    const prepare = httpsCallable(a.functions, "prepareAnalysis");
    const remove = httpsCallable(a.functions, "deleteAnalysis");
    const request = input();
    request.objective = "  Faaliyet belgesindeki ana konuları bul.  ";
    await assert.rejects(create({ ...request, objective: undefined }), { code: "functions/invalid-argument" });
    await assert.rejects(create({ ...request, objective: "   " }), { code: "functions/invalid-argument" });
    await assert.rejects(create({ ...request, objective: "x".repeat(501) }), { code: "functions/invalid-argument" });
    await assert.rejects(create({ ...request, files: Array.from({ length: 6 }, () => request.files[0]) }));
    const limitFiles = Array.from({ length: 5 }, (_, index) => ({ name: `belge-${index}.txt`, size: 5 * 1024 * 1024, contentType: "text/plain" }));
    await assert.rejects(create({ ...input(), files: [...limitFiles, { name: "fazla.txt", size: 1, contentType: "text/plain" }] }));
    const atLimit = (await create({ ...input(), files: limitFiles })).data;
    await remove({ id: atLimit.id });
    const largerBody = Buffer.alloc(6 * 1024 * 1024, 97);
    const larger = (await create({ ...input(), files: [{ name: "buyuk.txt", size: largerBody.length, contentType: "text/plain" }] })).data;
    await uploadBytes(ref(a.storage, larger.paths[0]), largerBody, { contentType: "text/plain" });
    await remove({ id: larger.id });
    const { data } = await create(request);
    const again = await create(request);
    assert.equal(data.id, again.data.id);
    await assert.rejects(create({ ...request, objective: "Farklı bir hedef" }), { code: "functions/already-exists" });
    const record = doc(a.db, "users", a.auth.currentUser.uid, "analyses", data.id);
    await assert.rejects(setDoc(record, { status: "completed" }));
    await assert.rejects(getDoc(doc(b.db, record.path)));
    await assert.rejects(uploadBytes(ref(b.storage, data.paths[0]), documentBody, { contentType: "text/plain" }));
    await assert.rejects(uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "application/pdf" }));
    await assert.rejects(uploadBytes(ref(a.storage, data.paths[0]), Buffer.from("wrong size"), { contentType: "text/plain" }));
    await uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "text/plain" });
    await assert.rejects(getBytes(ref(b.storage, data.paths[0])));
    await assert.rejects(httpsCallable(b.functions, "prepareAnalysis")({ id: data.id }));
    const concurrent = await Promise.all([prepare({ id: data.id }), prepare({ id: data.id })]);
    assert.equal(concurrent.some(response => response.data.ready === true), true);
    assert.equal(concurrent.every(response => typeof response.data.ready === "boolean"), true);
    assert.equal((await prepare({ id: data.id })).data.ready, true);
    const completed = (await getDoc(record)).data();
    assert.equal(completed.status, "completed");
    assert.equal(completed.objective, request.objective.trim());
    assert.equal(completed.report.version, 3);
    assert.equal(completed.report.fileCount, 1);
    assert.equal(completed.report.totalBytes, documentBody.length);
    assert.equal(completed.report.totalChunks, 1);
    assert.equal(completed.report.totalCharacters, "Sentetik faaliyet belgesi".length);
    assert.equal(completed.report.sources[0].name, "faaliyet.txt");
    assert.equal(completed.report.sources[0].detectedMime, "text/plain");
    assert.match(completed.report.sources[0].sha256, /^[a-f0-9]{64}$/);
    const quotaRef = doc(a.db, "users", a.auth.currentUser.uid, "quotas", completed.quotaDay);
    assert.equal((await getDoc(quotaRef)).data().used, 1);
    await assert.rejects(uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "application/pdf" }));
    await remove({ id: data.id }); await remove({ id: data.id });
    assert.equal((await getDoc(record)).exists(), false);
    await assert.rejects(getBytes(ref(a.storage, data.paths[0])));

    const invalidRequest = input();
    invalidRequest.files[0] = { name: "bozuk.pdf", size: documentBody.length, contentType: "application/pdf" };
    const invalid = (await create(invalidRequest)).data;
    await uploadBytes(ref(a.storage, invalid.paths[0]), documentBody, { contentType: "application/pdf" });
    await assert.rejects(prepare({ id: invalid.id }), error => error.code === "functions/invalid-argument");
    assert.equal((await getDoc(doc(a.db, "users", a.auth.currentUser.uid, "analyses", invalid.id))).data().status, "failed");
    assert.equal((await getDoc(quotaRef)).data().used, 1);
    await remove({ id: invalid.id });

    const missing = (await create(input())).data;
    await assert.rejects(prepare({ id: missing.id }));
    assert.equal((await getDoc(quotaRef)).data().used, 1);
    await uploadBytes(ref(a.storage, missing.paths[0]), documentBody, { contentType: "text/plain" });
    await prepare({ id: missing.id });
    assert.equal((await getDoc(quotaRef)).data().used, 2);
    await remove({ id: missing.id });
    await signOut(b.auth);
    await assert.rejects(httpsCallable(b.functions, "createAnalysis")(input()), error => error.code === "functions/unauthenticated");
  } finally { await deleteApp(a.app); await deleteApp(b.app); }
});

test("kısmi hazırlık açık kapsam onayı ister; tekrar ve eşzamanlı onay tek kota tüketir", { timeout: 120000 }, async () => {
  const a = await client(); const b = await client();
  try {
    const create = httpsCallable(a.functions, "createAnalysis");
    const prepare = httpsCallable(a.functions, "prepareAnalysis");
    const remove = httpsCallable(a.functions, "deleteAnalysis");
    const request = input();
    request.files.push({ name: "bozuk.pdf", size: documentBody.length, contentType: "application/pdf" });
    const { data } = await create(request);
    const record = doc(a.db, "users", a.auth.currentUser.uid, "analyses", data.id);
    await uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "text/plain" });
    await uploadBytes(ref(a.storage, data.paths[1]), documentBody, { contentType: "application/pdf" });
    await assert.rejects(prepare({ id: data.id, excludedSources: ["file-1"] }), { code: "functions/invalid-argument" });
    const reviewResponse = (await prepare({ id: data.id })).data;
    assert.equal(reviewResponse.needsReview, true);
    assert.equal(reviewResponse.ready, false);
    const first = (await getDoc(record)).data();
    const quota = doc(a.db, "users", a.auth.currentUser.uid, "quotas", first.quotaDay);
    assert.equal(first.status, "review");
    assert.equal(first.report, undefined);
    assert.deepEqual(first.preparationReview.ready, [{ id: "file-0", name: "faaliyet.txt" }]);
    assert.equal(first.preparationReview.rejected[0].id, "file-1");
    assert.equal((await getDoc(quota)).data().used, 0);
    await assert.rejects(uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "text/plain" }));
    await assert.rejects(httpsCallable(b.functions, "prepareAnalysis")({ id: data.id, reviewToken: first.preparationReview.token }));
    await assert.rejects(prepare({ id: data.id, reviewToken: crypto.randomUUID() }), { code: "functions/failed-precondition" });
    await prepare({ id: data.id });
    const next = (await getDoc(record)).data();
    assert.notEqual(next.preparationReview.token, first.preparationReview.token);
    await assert.rejects(prepare({ id: data.id, reviewToken: first.preparationReview.token }), { code: "functions/failed-precondition" });
    const approved = { id: data.id, reviewToken: next.preparationReview.token };
    await Promise.all([prepare(approved), prepare(approved)]);
    await prepare(approved);
    const completed = (await getDoc(record)).data();
    assert.equal(completed.status, "completed");
    assert.equal(completed.preparationReview, null);
    assert.equal(completed.report.fileCount, 1);
    assert.equal(completed.report.totalBytes, documentBody.length);
    assert.deepEqual(completed.report.sources.map(source => source.id), ["file-0"]);
    assert.equal(completed.report.excludedSources[0].name, "bozuk.pdf");
    assert.equal((await getDoc(quota)).data().used, 1);
    await remove({ id: data.id });
    for (const path of data.paths) await assert.rejects(getBytes(ref(a.storage, path)));
    const invalid = (await create({ ...input(), files: [request.files[1]] })).data;
    await uploadBytes(ref(a.storage, invalid.paths[0]), documentBody, { contentType: "application/pdf" });
    await assert.rejects(prepare({ id: invalid.id }), { code: "functions/invalid-argument" });
    const rejected = (await getDoc(doc(a.db, "users", a.auth.currentUser.uid, "analyses", invalid.id))).data();
    assert.equal(rejected.status, "failed");
    assert.equal(rejected.preparationReview, null);
    assert.equal(rejected.preparationFailures.length, 1);
    assert.equal((await getDoc(quota)).data().used, 1);
    await assert.rejects(prepare({ id: invalid.id, reviewToken: approved.reviewToken }), { code: "functions/failed-precondition" });
    await remove({ id: invalid.id });
  } finally { await deleteApp(a.app); await deleteApp(b.app); }
});

test("günlük kota iki hazırlıktan sonra sunucuda engellenir", { timeout: 120000 }, async () => {
  const a = await client();
  try {
    const create = httpsCallable(a.functions, "createAnalysis");
    const prepare = httpsCallable(a.functions, "prepareAnalysis");
    const remove = httpsCallable(a.functions, "deleteAnalysis");
    for (let i = 0; i < 3; i++) {
      const { data } = await create(input());
      await uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "text/plain" });
      if (i < 2) await prepare({ id: data.id });
      else await assert.rejects(prepare({ id: data.id }), error => error.code === "functions/resource-exhausted");
      await remove({ id: data.id });
    }
  } finally { await deleteApp(a.app); }
});

test("hesap silme onay gerektirir ve Auth, analiz, kota ve dosyaları temizler", { timeout: 120000 }, async () => {
  const a = await client();
  try {
    const uid = a.auth.currentUser.uid;
    const email = a.auth.currentUser.email;
    const create = httpsCallable(a.functions, "createAnalysis");
    const prepare = httpsCallable(a.functions, "prepareAnalysis");
    const removeAccount = httpsCallable(a.functions, "deleteAccount");
    const { data } = await create(input());
    await uploadBytes(ref(a.storage, data.paths[0]), documentBody, { contentType: "text/plain" });
    await prepare({ id: data.id });
    const record = doc(a.db, "users", uid, "analyses", data.id);
    const quota = doc(a.db, "users", uid, "quotas", (await getDoc(record)).data().quotaDay);

    await assert.rejects(removeAccount({ confirmation: "YANLIŞ" }), error => error.code === "functions/invalid-argument");
    assert.equal((await getDoc(record)).exists(), true);
    assert.equal((await removeAccount({ confirmation: "HESABIMI SİL" })).data.deleted, true);
    assert.equal((await getDoc(record)).exists(), false);
    assert.equal((await getDoc(quota)).exists(), false);
    await assert.rejects(getBytes(ref(a.storage, data.paths[0])));
    await signOut(a.auth);
    await assert.rejects(signInWithEmailAndPassword(a.auth, email, "Synthetic123!"));
  } finally { await deleteApp(a.app); }
});
