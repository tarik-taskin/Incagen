import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCloudDiagnosticConfig, resolveProbeResourcePath, runCloudProbe } from "./check-gemini-cloud.mjs";

const validConfig = {
  apiKey: "synthetic-web-key",
  authDomain: "incagen-eeef4.firebaseapp.com",
  projectId: "incagen-eeef4",
  storageBucket: "incagen-eeef4.firebasestorage.app",
  appId: "1:0000:web:0000",
};

function mockDeps(overrides = {}) {
  let tick = 1000;
  const written = new Map();
  const calls = { callable: 0, deleteAccount: 0, adminActions: [] };
  const journal = {
    path: "/tmp/mock-journal.json",
    account() {},
    analysis() {},
    async verifyClean() {},
  };

  const firebase = {
    initializeApp: () => ({ name: "mock-app" }),
    deleteApp: async () => {},
    getAuth: () => ({}),
    createUserWithEmailAndPassword: async () => ({
      user: {
        uid: "synthetic-uid-00000000001",
        getIdToken: async () => "mock-id-token-never-logged",
      },
    }),
    signInWithEmailAndPassword: async () => ({}),
    getFunctions: () => ({}),
    httpsCallable: (_functions, name, options) => async () => {
      if (name === "checkGemini") {
        assert.deepEqual(options, { timeout: 340_000 });
        calls.callable += 1;
        return { data: { status: "ok", model: "gemini-3.8-flash" } };
      }
      if (name === "deleteAccount") {
        calls.deleteAccount += 1;
        return { data: { ok: true } };
      }
      throw new Error(`Unexpected callable: ${name}`);
    },
  };

  const adminClient = async () => async (action, body) => {
    calls.adminActions.push({ action, body });
    if (action === "lookup") return { users: [] };
    return {};
  };

  return {
    calls,
    written,
    deps: {
      now: () => {
        tick += 25;
        return tick;
      },
      loadConfig: () => validConfig,
      adminClient,
      createJournal: () => journal,
      resolveResourcePath: () => "/tmp/mock-probe.json",
      writeFile: (path, data) => written.set(path, data),
      firebase,
      ...overrides,
    },
  };
}

test("loadCloudDiagnosticConfig requires explicit opt-in and rejects emulator vars", () => {
  assert.throws(() => loadCloudDiagnosticConfig({}, () => "VITE_FIREBASE_PROJECT_ID=incagen-eeef4\n"));
  assert.throws(() => loadCloudDiagnosticConfig(
    { INCAGEN_CLOUD_DIAGNOSTIC: "1", FUNCTIONS_EMULATOR: "true" },
    () => "VITE_FIREBASE_PROJECT_ID=incagen-eeef4\n"
  ));
});

test("resolveProbeResourcePath preserves unfinished, unverified, or unreadable resource logs", () => {
  const dir = mkdtempSync(join(tmpdir(), "incagen-probe-path-"));
  try {
    const base = join(dir, "probe.json");
    writeFileSync(base, JSON.stringify({ project: "incagen-eeef4", uid: "old-uid", cleaned: false }));
    const resolved = resolveProbeResourcePath(base, "new-run-123");
    assert.notEqual(resolved, base);
    assert.match(resolved, /new-run-123\.json$/);
    assert.equal(JSON.parse(readFileSync(base, "utf8")).uid, "old-uid");

    // cleaned: true olsa bile journalVerifiedClean: true yoksa eski kayıt korunmalı
    writeFileSync(base, JSON.stringify({ project: "incagen-eeef4", uid: "old-uid", cleaned: true }));
    const unverifiedResolved = resolveProbeResourcePath(base, "new-run-234");
    assert.notEqual(unverifiedResolved, base);
    assert.match(unverifiedResolved, /new-run-234\.json$/);

    // Bozuk JSON da üzerine yazılmamalı
    writeFileSync(base, "{corrupt-json");
    const corruptResolved = resolveProbeResourcePath(base, "new-run-345");
    assert.notEqual(corruptResolved, base);

    writeFileSync(base, JSON.stringify({ project: "incagen-eeef4", uid: "old-uid", cleaned: true, journalVerifiedClean: true }));
    assert.equal(resolveProbeResourcePath(base, "new-run-456"), base);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runCloudProbe separates configuration, clientAuth, callable and cleanup stages on success", async () => {
  const { deps, calls, written } = mockDeps();
  const summary = await runCloudProbe(deps);

  assert.equal(summary.status, "passed");
  assert.equal(summary.stage, "completed");
  assert.equal(summary.callAttempted, true);
  assert.equal(summary.model, "gemini-3.8-flash");
  assert.equal(summary.stages.configuration.status, "passed");
  assert.equal(summary.stages.clientAuth.status, "passed");
  assert.equal(summary.stages.callable.status, "passed");
  assert.equal(summary.stages.cleanup.status, "passed");
  assert.equal(summary.cleanup.temporaryClaimRemoved, true);
  assert.equal(summary.cleanup.syntheticAccountDeleted, true);
  assert.equal(summary.cleanup.journalVerifiedClean, true);
  assert.equal(calls.callable, 1);
  assert.equal(calls.deleteAccount, 1);
  assert.equal(JSON.parse(written.get("/tmp/mock-probe.json")).cleaned, true);
});

test("runCloudProbe stops before callable on clientAuth failure and does not leak secrets", async () => {
  const base = mockDeps();
  base.deps.firebase.createUserWithEmailAndPassword = async () => {
    throw Object.assign(new Error("Authorization: Bearer secret-token-xyz email=probe@example.test"), {
      code: "auth/operation-not-allowed",
    });
  };
  const summary = await runCloudProbe(base.deps);
  const serialized = JSON.stringify(summary);

  assert.equal(summary.status, "failed");
  assert.equal(summary.stage, "client-auth");
  assert.equal(summary.callAttempted, false);
  assert.equal(summary.code, "auth/operation-not-allowed");
  assert.equal(summary.stages.clientAuth.status, "failed");
  assert.equal(summary.stages.callable.status, "not-run");
  assert.equal(base.calls.callable, 0);
  assert.doesNotMatch(serialized, /secret-token-xyz|Bearer|example\.test|mock-id-token/);
});

test("runCloudProbe isolates callable timeout without retrying or leaking raw provider bodies", async () => {
  const base = mockDeps();
  base.deps.firebase.httpsCallable = (_fn, name) => async () => {
    if (name === "checkGemini") {
      base.calls.callable += 1;
      const err = new Error("Raw provider payload with apiKey=AIzaSySyntheticLeak and Authorization header");
      err.code = "functions/unavailable";
      err.details = { geminiFailure: "timeout", rawBody: "SENSITIVE_PROVIDER_BODY" };
      throw err;
    }
    base.calls.deleteAccount += 1;
    return { data: { ok: true } };
  };

  const summary = await runCloudProbe(base.deps);
  const serialized = JSON.stringify(summary);

  assert.equal(summary.status, "failed");
  assert.equal(summary.stage, "callable");
  assert.equal(summary.callAttempted, true);
  assert.equal(summary.code, "functions/unavailable");
  assert.equal(summary.reason, "timeout");
  assert.equal(summary.stages.callable.status, "failed");
  assert.equal(summary.stages.callable.reason, "timeout");
  assert.equal(summary.cleanup.status, "passed");
  assert.equal(summary.cleanup.syntheticAccountDeleted, true);
  assert.equal(base.calls.callable, 1);
  assert.doesNotMatch(serialized, /SENSITIVE_PROVIDER_BODY|AIzaSySyntheticLeak|Authorization/);
});

test("runCloudProbe reports cleanup failure explicitly when account deletion fails", async () => {
  const base = mockDeps();
  base.deps.firebase.httpsCallable = (_fn, name) => async () => {
    if (name === "checkGemini") {
      base.calls.callable += 1;
      return { data: { status: "ok", model: "gemini-3.8-flash" } };
    }
    throw Object.assign(new Error("raw cleanup error"), { code: "functions/internal" });
  };

  const summary = await runCloudProbe(base.deps);
  assert.equal(summary.status, "failed");
  assert.equal(summary.stage, "cleanup");
  assert.equal(summary.cleanup.status, "failed");
  assert.equal(summary.cleanup.syntheticAccountDeleted, false);
  assert.equal(summary.stages.cleanup.cleaned, false);
});

test("runCloudProbe writes cleaned: true only AFTER journal.verifyClean succeeds and preserves cleaned: false on failure", async () => {
  const events = [];
  const localWritten = new Map();
  const base = mockDeps({
    createJournal: () => ({
      path: "/tmp/mock-journal.json",
      runId: "probe-run-verify-fail",
      account() {},
      analysis() {},
      async verifyClean() {
        events.push("verifyClean");
        throw new Error("leftover synthetic doc");
      },
    }),
    writeFile: (path, data) => {
      events.push(`write:${JSON.parse(data).cleaned}:${JSON.parse(data).journalVerifiedClean}`);
      localWritten.set(path, data);
    },
  });

  const summary = await runCloudProbe(base.deps);
  assert.equal(summary.status, "failed");
  assert.equal(summary.stage, "cleanup");
  assert.equal(summary.cleanup.status, "failed");
  assert.equal(summary.cleanup.journalVerifiedClean, false);
  assert.equal(summary.stages.cleanup.cleaned, false);

  const persisted = JSON.parse(localWritten.get("/tmp/mock-probe.json"));
  assert.equal(persisted.cleaned, false);
  assert.equal(persisted.journalVerifiedClean, false);
  assert.equal(persisted.syntheticAccountDeleted, true);
  assert.equal(events.includes("write:true:undefined"), false);
  assert.equal(events.includes("write:true:true"), false);
});

test("runCloudProbe fails cleanup stage when final probe state persistence throws", async () => {
  const base = mockDeps({
    writeFile: (_path, data) => {
      if (JSON.parse(data).cleaned === true) {
        throw new Error("EACCES: read-only filesystem");
      }
    },
  });

  const summary = await runCloudProbe(base.deps);
  assert.equal(summary.status, "failed");
  assert.equal(summary.stage, "cleanup");
  assert.equal(summary.cleanup.status, "failed");
  assert.equal(summary.stages.cleanup.cleaned, false);
});
