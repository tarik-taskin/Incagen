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
