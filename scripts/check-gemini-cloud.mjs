import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

const require = createRequire(import.meta.url), cli = require("firebase-tools/lib/auth");
const project = "incagen-eeef4";

// Tek sabit bulut çağrısı için açık opt-in gerekir; yalnız public Firebase yapılandırması okunur.
function configuration() {
  assert.equal(process.env.INCAGEN_CLOUD_DIAGNOSTIC, "1", "Explicit cloud diagnostic opt-in required.");
  const values = Object.fromEntries(readFileSync(".env.cloud-preview.local", "utf8").split(/\r?\n/)
    .filter(line => /^VITE_FIREBASE_/.test(line)).map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
  assert.equal(values.VITE_FIREBASE_PROJECT_ID, project);
  assert.ok(!process.env.FUNCTIONS_EMULATOR && !process.env.FIREBASE_AUTH_EMULATOR_HOST);
  return { apiKey: values.VITE_FIREBASE_API_KEY, authDomain: values.VITE_FIREBASE_AUTH_DOMAIN, projectId: project,
    storageBucket: values.VITE_FIREBASE_STORAGE_BUCKET, appId: values.VITE_FIREBASE_APP_ID };
}

// CLI OAuth yalnız bellekte tutulur; yönetici işlemi scriptin kendi oluşturduğu UID ile sınırlıdır.
async function adminClient() {
  const account = cli.getProjectDefaultAccount(process.cwd()); assert.ok(account, "Firebase CLI login required.");
  const token = await cli.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"]);
  return async (action, body) => {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:${action}`, {
      method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Diagnostic metadata status ${response.status}`);
    return response.json();
  };
}

// Geçici geliştirici claim'iyle tek backend smoke testi yapar; sır ve sağlayıcı gövdesi yerel ortama gelmez.
async function main() {
  const config = configuration(), admin = await adminClient();
  const app = initializeApp(config, `cloud-probe-${randomUUID()}`), auth = getAuth(app);
  const email = `probe-${randomUUID()}@example.test`, password = `Synthetic-${randomUUID()}!`;
  let uid, failure;
  try {
    const created = await createUserWithEmailAndPassword(auth, email, password); uid = created.user.uid;
    writeFileSync("/tmp/incagen-cloud-probe-resources.json", JSON.stringify({ project, uid, cleaned: false }), { mode: 0o600 });
    await admin("update", { localId: uid, customAttributes: JSON.stringify({ incagenDeveloper: true }) });
    await created.user.getIdToken(true);
    const started = Date.now();
    try {
      const result = await httpsCallable(getFunctions(app, "europe-west1"), "checkGemini", { timeout: 125000 })({});
      assert.equal(result.data.status, "ok"); assert.equal(result.data.model, "gemini-3.8-flash");
      console.log(JSON.stringify({ probe: "cloud-connectivity", status: "passed", model: result.data.model, durationMs: Date.now() - started }));
    } catch (error) {
      const reason = error?.details?.geminiFailure;
      console.log(JSON.stringify({ probe: "cloud-connectivity", status: "failed", code: error?.code || "validation",
        ...(["not-configured", "unavailable", "busy", "timeout", "invalid-response", "invalid-input"].includes(reason) ? { reason } : {}), durationMs: Date.now() - started }));
      failure = error;
    }
  } finally {
    try {
      if (uid) {
        await admin("update", { localId: uid, customAttributes: "{}" });
        await signInWithEmailAndPassword(auth, email, password);
        await httpsCallable(getFunctions(app, "europe-west1"), "deleteAccount")({ confirmation: "HESABIMI SİL" });
        assert.equal((await admin("lookup", { localId: [uid] })).users?.length ?? 0, 0);
        writeFileSync("/tmp/incagen-cloud-probe-resources.json", JSON.stringify({ project, uid, cleaned: true }), { mode: 0o600 });
        console.log(JSON.stringify({ temporaryClaimRemoved: true, syntheticAccountDeleted: true }));
      }
    } finally { await deleteApp(app); }
  }
  if (failure) process.exitCode = 1;
}

main().catch(error => { console.error(JSON.stringify({ status: "failed", code: error?.code || "diagnostic-failed" })); process.exitCode = 1; });
