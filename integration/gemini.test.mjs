import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, getIdToken } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, getApps } = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

// Geliştirici claim'i yalnız demo Auth emülatöründe oluşturulur; üretim hesaplarına yetki verilmez.
test("Gemini geliştirici sınırı, eksik anahtar ve atomik maliyet sınırı", { timeout: 30000 }, async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? "", /^127\.0\.0\.1:/);
  if (!getApps().length) initializeAdmin({ projectId: "demo-incagen" });
  const app = initializeApp({ projectId: "demo-incagen", apiKey: "demo-local-key" }, crypto.randomUUID());
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const functions = getFunctions(app, "europe-west1"); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const call = httpsCallable(functions, "checkGemini");
  const db = getFirestore();
  try {
    await assert.rejects(call({}), { code: "functions/unauthenticated" });
    await createUserWithEmailAndPassword(auth, `gemini-${crypto.randomUUID()}@example.test`, "Synthetic123!");
    await assert.rejects(call({}), { code: "functions/permission-denied" });
    const uid = auth.currentUser.uid;
    await getAdminAuth().setCustomUserClaims(uid, { incagenDeveloper: true });
    await getIdToken(auth.currentUser, true);
    await assert.rejects(call({ prompt: "untrusted" }), { code: "functions/invalid-argument" });
    await assert.rejects(call({}), { code: "functions/failed-precondition" });
    assert.equal((await db.doc(`users/${uid}/diagnostics/gemini`).get()).exists, false);
    const { reserveGeminiDiagnostic } = require("./lib/analysis/gemini-diagnostic");
    await db.doc("internalDiagnostics/gemini").delete();
    const attempts = await Promise.allSettled([reserveGeminiDiagnostic(uid), reserveGeminiDiagnostic(uid)]);
    assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((await db.doc("internalDiagnostics/gemini").get()).data().count, 1);
    await db.doc("internalDiagnostics/gemini").set({ day: new Date().toISOString().slice(0, 10), count: 20 });
    await assert.rejects(reserveGeminiDiagnostic("another-developer"), { code: "resource-exhausted" });
    await db.doc("internalDiagnostics/gemini").delete();
    await db.doc(`users/${uid}`).set({ deletingAccount: true });
    await assert.rejects(reserveGeminiDiagnostic(uid), { code: "failed-precondition" });
  } finally { await deleteApp(app); }
});
