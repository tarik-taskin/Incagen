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
    const { geminiQuotaDay } = require("./lib/analysis/provider-calendar");
    const global = db.doc("internalDiagnostics/gemini");
    const now = Date.parse("2026-11-27T07:50:00Z");
    await global.delete();
    const attempts = await Promise.allSettled([reserveGeminiDiagnostic(uid, now), reserveGeminiDiagnostic("other-developer", now)]);
    assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((await global.get()).data().count, 1);
    const priorityAttempts = await Promise.allSettled([reserveGeminiDiagnostic("priority-developer-one", now + 60_000, true), reserveGeminiDiagnostic("priority-developer-two", now + 60_000, true)]);
    assert.equal(priorityAttempts.filter(result => result.status === "fulfilled").length, 1);
    await assert.rejects(reserveGeminiDiagnostic("fresh-account", now + 90_000), { code: "resource-exhausted" });
    await assert.rejects(reserveGeminiDiagnostic("other-priority-developer", now + 120_000, true), { code: "resource-exhausted" });
    await reserveGeminiDiagnostic("standard-developer", now + 120_000);
    await reserveGeminiDiagnostic("another-developer", now + 180_000);
    assert.equal((await global.get()).data().priorityUsed, true);
    await assert.rejects(reserveGeminiDiagnostic("another-developer-two", now + 240_000), { code: "resource-exhausted" });
    assert.equal((await global.get()).data().day, "2026-11-26");
    await reserveGeminiDiagnostic("midnight-developer", Date.parse("2026-11-27T08:00:00Z"), true);
    assert.equal((await global.get()).data().count, 1);
    assert.equal(geminiQuotaDay(Date.parse("2026-07-10T06:59:59Z")), "2026-07-09");
    assert.equal(geminiQuotaDay(Date.parse("2026-07-10T07:00:00Z")), "2026-07-10");

    await global.set({ day: "2026-11-27", count: 3, priorityUsed: true });
    await assert.rejects(reserveGeminiDiagnostic("legacy-priority", now, true), { code: "resource-exhausted" });
    await reserveGeminiDiagnostic("legacy-standard", now);
    assert.deepEqual((await global.get()).data(), { calendar: "pacific", day: "2026-11-26", lastAt: now, count: 4, priorityUsed: true });
    await global.delete();
    await db.doc(`users/${uid}`).set({ deletingAccount: true });
    await assert.rejects(reserveGeminiDiagnostic(uid), { code: "failed-precondition" });
  } finally { await deleteApp(app); }
});
