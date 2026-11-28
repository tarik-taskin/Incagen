import assert from "node:assert/strict";
import test from "node:test";
import { callerIdentity, imageName, inspectClosedEnvironment, revisionScope, selectedFunctions,
  verifyClosedFunctions, verifyWorker, workerIdentity, workerResource } from "./closed-backend.mjs";

const origin = "https://worker-example.run.app";
const digest = "sha256:" + "a".repeat(64);
const servicePolicy = { bindings: [{ role: "roles/run.invoker", members: [`serviceAccount:${callerIdentity}`] }] };
const projectPolicy = { bindings: [] };

// Çalışan tek worker revizyonunun beklenen küçük API gövdesini üretir.
function worker() {
  const revision = "incagen-extract-00001-test";
  return {
    name: workerResource, uri: origin, reconciling: false,
    latestCreatedRevision: revision, latestReadyRevision: revision,
    trafficStatuses: [{ revision, percent: 100 }],
    template: { serviceAccount: workerIdentity, maxInstanceRequestConcurrency: 1, timeout: "90s",
      scaling: { maxInstanceCount: 1 }, containers: [{ image: `${imageName}@${digest}`, resources: { limits: { cpu: "1", memory: "1Gi" } } }] },
  };
}

test("reads only the required closed release parameters without leaking unrelated environment values", () => {
  const closed = `INCAGEN_TABULAR_ANALYSIS_ENABLED=false\nINCAGEN_PYTHON_WORKER_URL=${origin}\n`;
  assert.deepEqual(inspectClosedEnvironment(closed + "UNRELATED=sensitive-value\n"), { workerOrigin: origin });
  for (const value of [
    closed.replace("false", "true"),
    closed + "INCAGEN_TABULAR_ANALYSIS_ENABLED=false\n",
    closed.replace(origin, origin + "/path"),
    closed.replace(origin, "https://unrelated.example.test/"),
    closed + "GEMINI_API_KEY=synthetic-test-marker\n",
  ]) assert.throws(() => inspectClosedEnvironment(value), /geçersiz|uygunsuz/);
});

test("binds ready worker traffic, private IAM and immutable image to the fixed service", () => {
  assert.deepEqual(verifyWorker(worker(), servicePolicy, projectPolicy), { uri: origin, digest, revision: "incagen-extract-00001-test" });
  for (const change of [
    x => { x.invokerIamDisabled = true; },
    x => { x.template.containers[0].image = imageName + ":mutable"; },
    x => { x.trafficStatuses[0].percent = 90; },
    x => { x.template.scaling.maxInstanceCount = 2; },
    x => { x.template.containers[0].env = [{ name: "EXTRA" }]; },
  ]) {
    const config = worker(); change(config);
    assert.throws(() => verifyWorker(config, servicePolicy, projectPolicy), /revizyonu/);
  }
  assert.throws(() => verifyWorker(worker(), { bindings: [] }, projectPolicy), /özel erişimi/);
  assert.throws(() => verifyWorker(worker(), { bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }] }, projectPolicy), /özel erişimi/);
  assert.throws(() => verifyWorker(worker(), servicePolicy, { bindings: [{ role: "roles/editor", members: [`serviceAccount:${workerIdentity}`] }] }), /IAM/);
});

test("requires active closed functions and publishes no environment values", () => {
  const records = selectedFunctions.map(name => ({
    name: `${revisionScope}/functions/${name}`, state: "ACTIVE", updateTime: "2026-11-25T08:00:00Z",
    serviceConfig: { revision: name + "-001", serviceAccountEmail: callerIdentity, environmentVariables: {
      INCAGEN_TABULAR_ANALYSIS_ENABLED: "false", INCAGEN_PYTHON_WORKER_URL: origin, INCAGEN_BACKEND_RELEASE_SHA: "b".repeat(40), OTHER: "sensitive-value",
    } },
  }));
  const result = verifyClosedFunctions(records, origin);
  assert.deepEqual(result.map(item => item.name), selectedFunctions);
  assert.ok(result.every(item => item.releaseCommit === "b".repeat(40)));
  assert.ok(!JSON.stringify(result).includes("sensitive-value"));
  assert.throws(() => verifyClosedFunctions(records.slice(1), origin), /doğrulanamadı/);
  const runtime = records[0].serviceConfig;
  runtime.environmentVariables.INCAGEN_TABULAR_ANALYSIS_ENABLED = "true";
  assert.throws(() => verifyClosedFunctions(records, origin), /doğrulanamadı/);
  runtime.environmentVariables.INCAGEN_TABULAR_ANALYSIS_ENABLED = "false";
  runtime.secretEnvironmentVariables = [{ key: "GEMINI_API_KEY" }];
  assert.throws(() => verifyClosedFunctions(records, origin), /doğrulanamadı/);
});

test("requires explicit invitation mode, identical endpoint flags and the same release commit", () => {
  const open = `INCAGEN_TABULAR_ANALYSIS_ENABLED=true\nINCAGEN_PYTHON_WORKER_URL=${origin}\n`;
  assert.deepEqual(inspectClosedEnvironment(open, { inviteBeta: true }), { workerOrigin: origin });
  assert.throws(() => inspectClosedEnvironment(open), /uygunsuz/);
  const sha = "b".repeat(40);
  const records = selectedFunctions.map(name => ({
    name: `${revisionScope}/functions/${name}`, state: "ACTIVE", updateTime: "2026-11-27T00:00:00Z",
    serviceConfig: { revision: name + "-001", serviceAccountEmail: callerIdentity, environmentVariables: {
      INCAGEN_TABULAR_ANALYSIS_ENABLED: "true", INCAGEN_PYTHON_WORKER_URL: origin, INCAGEN_BACKEND_RELEASE_SHA: sha,
    } },
  }));
  assert.equal(verifyClosedFunctions(records, origin, { inviteBeta: true, expectedCommit: sha }).length, selectedFunctions.length);
  assert.throws(() => verifyClosedFunctions(records, origin), /doğrulanamadı/);
  assert.throws(() => verifyClosedFunctions(records, origin, { inviteBeta: true, expectedCommit: "c".repeat(40) }), /SHA/);
  records[0].serviceConfig.environmentVariables.INCAGEN_TABULAR_ANALYSIS_ENABLED = "false";
  assert.throws(() => verifyClosedFunctions(records, origin, { inviteBeta: true, expectedCommit: sha }), /doğrulanamadı/);
});

test("enforces exact commit SHA in closed mode when requested and parses CLI flags strictly", async () => {
  const closedMod = await import("./closed-backend.mjs");
  const expectedSha = "a".repeat(40);
  const olderSha = "b".repeat(40);
  const makeRecords = shas => selectedFunctions.map((name, index) => ({
    name: `${revisionScope}/functions/${name}`, state: "ACTIVE", updateTime: "2026-11-28T00:00:00Z",
    serviceConfig: { revision: name + "-002", serviceAccountEmail: callerIdentity, environmentVariables: {
      INCAGEN_TABULAR_ANALYSIS_ENABLED: "false", INCAGEN_PYTHON_WORKER_URL: origin,
      ...(shas[index] ? { INCAGEN_BACKEND_RELEASE_SHA: shas[index] } : {}),
    } },
  }));

  // Kapalı modda kesin SHA eşliği geçer; eski, eksik veya karışık SHA reddedilir.
  assert.equal(verifyClosedFunctions(makeRecords([expectedSha, expectedSha, expectedSha, expectedSha]), origin, { expectedCommit: expectedSha }).length, 4);
  assert.throws(() => verifyClosedFunctions(makeRecords([olderSha, olderSha, olderSha, olderSha]), origin, { expectedCommit: expectedSha }), /SHA/);
  assert.throws(() => verifyClosedFunctions(makeRecords([expectedSha, null, expectedSha, expectedSha]), origin, { expectedCommit: expectedSha }), /SHA/);
  assert.throws(() => verifyClosedFunctions(makeRecords([expectedSha, expectedSha, olderSha, expectedSha]), origin, { expectedCommit: expectedSha }), /SHA/);

  // CLI argüman çözümleyici: --live --expected-commit <40-hex> desteklenir; geçersiz kombinasyonlar reddedilir.
  assert.equal(typeof closedMod.parseClosedBackendArgs, "function");
  assert.deepEqual(closedMod.parseClosedBackendArgs([]), { live: false, inviteBeta: false, expectedCommit: undefined });
  assert.deepEqual(closedMod.parseClosedBackendArgs(["--live"]), { live: true, inviteBeta: false, expectedCommit: undefined });
  assert.deepEqual(closedMod.parseClosedBackendArgs(["--live", "--expected-commit", expectedSha]), { live: true, inviteBeta: false, expectedCommit: expectedSha });
  assert.deepEqual(closedMod.parseClosedBackendArgs(["--live", `--expected-commit=${expectedSha}`]), { live: true, inviteBeta: false, expectedCommit: expectedSha });
  assert.deepEqual(closedMod.parseClosedBackendArgs(["--live", "--invite-beta"]), { live: true, inviteBeta: true, expectedCommit: undefined });
  for (const invalid of [
    ["--invite-beta"],
    ["--expected-commit", expectedSha],
    ["--live", "--expected-commit"],
    ["--live", "--expected-commit", "876c197"],
    ["--live", "--expected-commit", expectedSha, "--expected-commit", olderSha],
    ["--live", "--unknown"],
  ]) {
    assert.throws(() => closedMod.parseClosedBackendArgs(invalid), /Kullanım/);
  }

  // closedBackendPlan: dağıtım öncesi salt okunur kapalı okuma ile kesin --expected-commit eşliği ayrılır.
  const closedEnvText = `INCAGEN_TABULAR_ANALYSIS_ENABLED=false\nINCAGEN_PYTHON_WORKER_URL=${origin}\n`;
  const mockRequestFor = shas => async url => {
    if (url.endsWith(":getIamPolicy") && url.includes("cloudresourcemanager")) return projectPolicy;
    if (url.endsWith(":getIamPolicy")) return servicePolicy;
    if (url.includes("/services/")) return worker();
    const index = selectedFunctions.findIndex(name => url.endsWith(`/functions/${name}`));
    return makeRecords(shas)[index];
  };
  const depsFor = shas => ({
    verifyGit: () => ({ commit: expectedSha }),
    readEnvFile: () => closedEnvText,
    hasSharedEnv: () => false,
    request: mockRequestFor(shas),
  });

  // Dağıtım öncesi --live eski kapalı SHA'yı okuyabilir ve commitMatched: false / expectedCommit: null döndürür.
  const preDeploy = await closedMod.closedBackendPlan(["--live"], process.cwd(), depsFor([olderSha, olderSha, olderSha, olderSha]));
  assert.equal(preDeploy.liveVerified, true);
  assert.equal(preDeploy.expectedCommit, null);
  assert.equal(preDeploy.commitMatched, false);
  assert.ok(preDeploy.functions.every(fn => fn.releaseCommit === olderSha));

  // Kesin SHA eşliği (--live --expected-commit): doğru SHA geçer; eski, eksik ve karışık SHA reddedilir.
  const exact = await closedMod.closedBackendPlan(["--live", "--expected-commit", expectedSha], process.cwd(), depsFor([expectedSha, expectedSha, expectedSha, expectedSha]));
  assert.equal(exact.liveVerified, true);
  assert.equal(exact.expectedCommit, expectedSha);
  assert.equal(exact.commitMatched, true);
  for (const badShas of [
    [olderSha, olderSha, olderSha, olderSha],
    [expectedSha, null, expectedSha, expectedSha],
    [expectedSha, expectedSha, olderSha, expectedSha],
  ]) {
    await assert.rejects(() => closedMod.closedBackendPlan(["--live", "--expected-commit", expectedSha], process.cwd(), depsFor(badShas)), /SHA/);
  }
  await assert.rejects(
    () => closedMod.closedBackendPlan(["--live", "--invite-beta", "--expected-commit", olderSha], process.cwd(), depsFor([expectedSha, expectedSha, expectedSha, expectedSha])),
    /HEAD/
  );
});
