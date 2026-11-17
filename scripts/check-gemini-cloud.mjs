import assert from "node:assert/strict";
import { createAcceptanceJournal } from "./acceptance-resources.mjs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

const PROJECT = "incagen-eeef4";
const DEFAULT_PROBE_STATE_FILE = "/tmp/incagen-cloud-probe-resources.json";
const ALLOWED_REASONS = new Set(["not-configured", "unavailable", "busy", "timeout", "invalid-response", "invalid-input"]);
const SAFE_CODE = /^(auth|functions)\/[a-z0-9-]+$|^(configuration-error|client-auth-failed|claim-assign-failed|token-refresh-failed|callable-failed|cleanup-failed|validation|diagnostic-failed)$/;

// İzinli hata kodu dışındaki serbest hata/mesaj metinlerini çıktıda sabit güvenli koda indirger.
export function safeCode(rawCode, fallback = "diagnostic-failed") {
  if (typeof rawCode === "string" && SAFE_CODE.test(rawCode)) return rawCode;
  return fallback;
}

// Çıktı için yalnız izinli sabit alanları tutar; ham hata mesajı, token veya kullanıcı verisi taşımaz.
export function formatDiagnosticSummary({
  status,
  stage,
  callAttempted,
  code,
  reason,
  model,
  durationMs,
  stages,
  cleanup,
}) {
  const summary = {
    probe: "cloud-connectivity",
    status: status === "passed" ? "passed" : "failed",
    stage,
    callAttempted: Boolean(callAttempted),
    durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
    ...(model === "gemini-3.8-flash" ? { model } : {}),
    ...(code ? { code: safeCode(code) } : {}),
    ...(ALLOWED_REASONS.has(reason) ? { reason } : {}),
    stages,
    cleanup,
  };
  return summary;
}

// Tek sabit bulut çağrısı için açık opt-in gerekir; yalnız public Firebase yapılandırması okunur.
export function loadCloudDiagnosticConfig(env = process.env, readEnvFile = () => readFileSync(".env.cloud-preview.local", "utf8")) {
  assert.equal(env.INCAGEN_CLOUD_DIAGNOSTIC, "1", "Explicit cloud diagnostic opt-in required.");
  const values = Object.fromEntries(
    readEnvFile()
      .split(/\r?\n/)
      .filter(line => /^VITE_FIREBASE_/.test(line))
      .map(line => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, "")];
      })
  );
  assert.equal(values.VITE_FIREBASE_PROJECT_ID, PROJECT);
  assert.ok(!env.FUNCTIONS_EMULATOR && !env.FIREBASE_AUTH_EMULATOR_HOST);
  return {
    apiKey: values.VITE_FIREBASE_API_KEY,
    authDomain: values.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: PROJECT,
    storageBucket: values.VITE_FIREBASE_STORAGE_BUCKET,
    appId: values.VITE_FIREBASE_APP_ID,
  };
}

// CLI OAuth yalnız bellekte tutulur; yönetici işlemi scriptin kendi oluşturduğu UID ile sınırlıdır.
async function defaultAdminClient() {
  const require = createRequire(import.meta.url);
  const cli = require("firebase-tools/lib/auth");
  const account = cli.getProjectDefaultAccount(process.cwd());
  assert.ok(account, "Firebase CLI login required.");
  const token = await cli.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"]);
  return async (action, body) => {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Object.assign(new Error(`Diagnostic metadata status ${response.status}`), { code: "diagnostic-failed" });
    return response.json();
  };
}

// Önceki yarım kalmış (cleaned: false) test kaynağı kaydını ezmemek için koşuya özel yedek dosya seçer.
export function resolveProbeResourcePath(defaultPath = DEFAULT_PROBE_STATE_FILE, runId = randomUUID()) {
  if (existsSync(defaultPath)) {
    try {
      const existing = JSON.parse(readFileSync(defaultPath, "utf8"));
      if (existing && existing.cleaned === false) {
        return `/tmp/incagen-cloud-probe-resources-${runId}.json`;
      }
    } catch {
      return `/tmp/incagen-cloud-probe-resources-${runId}.json`;
    }
  }
  return defaultPath;
}

// Aşamalı, sabit izinli çıktıyla tek sentetik bağlantı teşhisini çalıştırır ve temizlik kanıtını döner.
export async function runCloudProbe(deps = {}) {
  const now = deps.now ?? (() => Date.now());
  const probeStart = now();
  const stages = {
    configuration: { status: "not-run", durationMs: 0 },
    clientAuth: { status: "not-run", durationMs: 0 },
    callable: { status: "not-run", durationMs: 0, callAttempted: false },
    cleanup: { status: "not-run", durationMs: 0, cleaned: false },
  };
  const cleanup = {
    status: "skipped",
    temporaryClaimRemoved: false,
    syntheticAccountDeleted: false,
    journalVerifiedClean: false,
    durationMs: 0,
  };

  let config;
  let admin;
  let journal;
  let app;
  let auth;
  let uid;
  let email;
  let password;
  let failedStage = "configuration";
  let failureCode;
  let failureReason;
  let model;
  let probeStatePath;

  const configStarted = now();
  try {
    config = (deps.loadConfig ?? loadCloudDiagnosticConfig)();
    admin = deps.adminClient ? await deps.adminClient() : await defaultAdminClient();
    journal = (deps.createJournal ?? createAcceptanceJournal)("connectivity");
    stages.configuration = { status: "passed", durationMs: now() - configStarted };
  } catch (error) {
    stages.configuration = { status: "failed", durationMs: now() - configStarted };
    return formatDiagnosticSummary({
      status: "failed",
      stage: "configuration",
      callAttempted: false,
      code: safeCode(error?.code, "configuration-error"),
      durationMs: now() - probeStart,
      stages,
      cleanup,
    });
  }

  const sdk = deps.firebase ?? {
    initializeApp,
    deleteApp,
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    getFunctions,
    httpsCallable,
  };

  const runTag = randomUUID();
  probeStatePath = (deps.resolveResourcePath ?? resolveProbeResourcePath)(DEFAULT_PROBE_STATE_FILE, runTag);
  const writeProbeState = deps.writeFile ?? ((file, data) => writeFileSync(file, data, { mode: 0o600 }));

  app = sdk.initializeApp(config, `cloud-probe-${runTag}`);
  auth = sdk.getAuth(app);
  email = `probe-${randomUUID()}@example.test`;
  password = `Synthetic-${randomUUID()}!`;

  try {
    // 1. İstemci / sentetik kimlik + geçici geliştirici claim + token yenileme aşaması
    failedStage = "client-auth";
    const authStarted = now();
    let created;
    try {
      created = await sdk.createUserWithEmailAndPassword(auth, email, password);
      uid = created.user.uid;
      journal.account(uid);
      writeProbeState(probeStatePath, JSON.stringify({ project: PROJECT, uid, cleaned: false }));
      await admin("update", { localId: uid, customAttributes: JSON.stringify({ incagenDeveloper: true }) });
      await created.user.getIdToken(true);
      stages.clientAuth = { status: "passed", durationMs: now() - authStarted };
    } catch (error) {
      stages.clientAuth = { status: "failed", durationMs: now() - authStarted };
      failureCode = safeCode(error?.code, "client-auth-failed");
      throw error;
    }

    // 2. Tek sabit callable isteği aşaması (otomatik/manuel tekrar yok)
    failedStage = "callable";
    const callableStarted = now();
    stages.callable.callAttempted = true;
    try {
      const callable = sdk.httpsCallable(sdk.getFunctions(app, "europe-west1"), "checkGemini", { timeout: 125000 });
      const result = await callable({});
      assert.equal(result?.data?.status, "ok");
      assert.equal(result?.data?.model, "gemini-3.8-flash");
      model = result.data.model;
      stages.callable = { status: "passed", durationMs: now() - callableStarted, callAttempted: true };
      failedStage = "cleanup";
    } catch (error) {
      const reason = error?.details?.geminiFailure;
      failureCode = safeCode(error?.code, "callable-failed");
      failureReason = ALLOWED_REASONS.has(reason) ? reason : undefined;
      stages.callable = {
        status: "failed",
        durationMs: now() - callableStarted,
        callAttempted: true,
        code: failureCode,
        ...(failureReason ? { reason: failureReason } : {}),
      };
      throw error;
    }
  } catch {
    // Hata durumu summary nesnesinde aşamalarıyla birlikte döner.
  } finally {
    const cleanupStarted = now();
    try {
      if (uid) {
        await admin("update", { localId: uid, customAttributes: "{}" });
        cleanup.temporaryClaimRemoved = true;
        await sdk.signInWithEmailAndPassword(auth, email, password);
        await sdk.httpsCallable(sdk.getFunctions(app, "europe-west1"), "deleteAccount")({ confirmation: "HESABIMI SİL" });
        const lookedUp = await admin("lookup", { localId: [uid] });
        assert.equal(lookedUp.users?.length ?? 0, 0);
        cleanup.syntheticAccountDeleted = true;
        writeProbeState(probeStatePath, JSON.stringify({ project: PROJECT, uid, cleaned: true }));
        await journal.verifyClean(config);
        cleanup.journalVerifiedClean = true;
        cleanup.status = "passed";
        stages.cleanup = { status: "passed", durationMs: now() - cleanupStarted, cleaned: true };
      }
    } catch (cleanupError) {
      cleanup.status = "failed";
      stages.cleanup = {
        status: "failed",
        durationMs: now() - cleanupStarted,
        cleaned: false,
        code: safeCode(cleanupError?.code, "cleanup-failed"),
      };
      if (!failureCode) {
        failedStage = "cleanup";
        failureCode = safeCode(cleanupError?.code, "cleanup-failed");
      }
    } finally {
      cleanup.durationMs = now() - cleanupStarted;
      await sdk.deleteApp(app).catch(() => {});
    }
  }

  const allPassed = stages.configuration.status === "passed"
    && stages.clientAuth.status === "passed"
    && stages.callable.status === "passed"
    && (!uid || cleanup.status === "passed");

  return formatDiagnosticSummary({
    status: allPassed ? "passed" : "failed",
    stage: allPassed ? "completed" : failedStage,
    callAttempted: stages.callable.callAttempted,
    code: allPassed ? undefined : failureCode,
    reason: allPassed ? undefined : failureReason,
    model,
    durationMs: now() - probeStart,
    stages,
    cleanup,
  });
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  runCloudProbe()
    .then(summary => {
      console.log(JSON.stringify(summary));
      if (summary.status !== "passed") process.exitCode = 1;
    })
    .catch(error => {
      console.error(JSON.stringify({ probe: "cloud-connectivity", status: "failed", stage: "configuration", callAttempted: false, code: safeCode(error?.code) }));
      process.exitCode = 1;
    });
}
