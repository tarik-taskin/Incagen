import assert from "node:assert/strict";
import test from "node:test";
import {
  callerIdentity,
  imageName,
  revisionScope,
  selectedFunctions,
  workerIdentity,
  workerResource,
} from "./closed-backend.mjs";
import { deployClosedFunctions, parseDeployArgs } from "./deploy-closed-functions.mjs";

const origin = "https://worker-example.run.app";
const digest = "sha256:" + "a".repeat(64);
const servicePolicy = { bindings: [{ role: "roles/run.invoker", members: [`serviceAccount:${callerIdentity}`] }] };
const projectPolicy = { bindings: [] };
const headSha = "f".repeat(40);
const prevSha = "e".repeat(40);
const closedEnv = `INCAGEN_TABULAR_ANALYSIS_ENABLED=false\nINCAGEN_PYTHON_WORKER_URL=${origin}\n`;

// Sahte Cloud Run worker gövdesi üretir.
function makeWorker(overrideDigest = digest) {
  const revision = "incagen-extract-00002-pld";
  return {
    name: workerResource,
    uri: origin,
    reconciling: false,
    latestCreatedRevision: revision,
    latestReadyRevision: revision,
    trafficStatuses: [{ revision, percent: 100 }],
    template: {
      serviceAccount: workerIdentity,
      maxInstanceRequestConcurrency: 1,
      timeout: "90s",
      scaling: { maxInstanceCount: 1 },
      containers: [{ image: `${imageName}@${overrideDigest}`, resources: { limits: { cpu: "1", memory: "1Gi" } } }],
    },
  };
}

// Dört analiz ucu için sahte Functions v2 metadata kayıtları üretir.
function makeFunctionRecords(states, overrides = {}) {
  return selectedFunctions.map((name, index) => {
    const state = states[index];
    return {
      name: `${revisionScope}/functions/${name}`,
      state: state.state ?? "ACTIVE",
      updateTime: "2026-11-28T08:00:00Z",
      serviceConfig: {
        revision: `${name}-00${index + 1}`,
        serviceAccountEmail: state.serviceAccountEmail ?? callerIdentity,
        environmentVariables: {
          INCAGEN_TABULAR_ANALYSIS_ENABLED: String(state.enabled),
          INCAGEN_PYTHON_WORKER_URL: state.workerOrigin ?? origin,
          ...(state.sha ? { INCAGEN_BACKEND_RELEASE_SHA: state.sha } : {}),
          ...(state.extraEnv ?? {}),
        },
        ...(overrides.secretEnvironmentVariables ? { secretEnvironmentVariables: overrides.secretEnvironmentVariables } : {}),
      },
    };
  });
}

// checkGemini teşhis ucu için sahte Functions v2 metadata kaydı üretir.
function makeDiagnosticRecord(sha, enabled = false) {
  return {
    name: `${revisionScope}/functions/checkGemini`,
    state: "ACTIVE",
    updateTime: "2026-11-28T08:00:00Z",
    serviceConfig: {
      revision: "checkgemini-00014-test",
      serviceAccountEmail: callerIdentity,
      timeoutSeconds: 330,
      maxInstanceCount: 1,
      maxInstanceRequestConcurrency: 1,
      environmentVariables: {
        INCAGEN_TABULAR_ANALYSIS_ENABLED: String(enabled),
        INCAGEN_PYTHON_WORKER_URL: origin,
        INCAGEN_BACKEND_RELEASE_SHA: sha,
      },
    },
  };
}

test("normal closed deploy blocks closing from open invite-beta mode while --rollback-closed succeeds safely from open or mixed state", async () => {
  const openRecords = makeFunctionRecords([
    { enabled: true, sha: prevSha },
    { enabled: true, sha: prevSha },
    { enabled: true, sha: prevSha },
    { enabled: true, sha: prevSha },
  ]);
  let currentRecords = openRecords;
  let deployCalls = 0;
  let capturedDeploy;

  const request = async url => {
    if (url.endsWith(":getIamPolicy") && url.includes("cloudresourcemanager")) return projectPolicy;
    if (url.endsWith(":getIamPolicy")) return servicePolicy;
    if (url.includes("/services/")) return makeWorker();
    const index = selectedFunctions.findIndex(name => url.endsWith(`/functions/${name}`));
    if (index >= 0) return currentRecords[index];
    throw new Error(`Unexpected URL: ${url}`);
  };

  const baseDeps = {
    env: { INCAGEN_CLOSED_FUNCTIONS_DEPLOY: "1" },
    verifyGit: () => ({ commit: headSha }),
    readEnvFile: () => closedEnv,
    hasSharedEnv: () => false,
    request,
    prepareAndDeploy: async info => {
      deployCalls += 1;
      capturedDeploy = info;
      currentRecords = makeFunctionRecords([
        { enabled: false, sha: headSha },
        { enabled: false, sha: headSha },
        { enabled: false, sha: headSha },
        { enabled: false, sha: headSha },
      ]);
    },
  };

  // 1. Mevcut normal kapalı dağıtım, canlı uçlar açık (true) iken geri kapatmayı engeller.
  await assert.rejects(() => deployClosedFunctions([], baseDeps), /doğrulanamadı/);
  assert.equal(deployCalls, 0);

  // 2. Açıkça seçilen --rollback-closed tüm açık uçları kapalı + güncel SHA hedefine geçirir.
  const rolledBack = await deployClosedFunctions(["--rollback-closed"], baseDeps);
  assert.equal(deployCalls, 1);
  assert.equal(rolledBack.mode, "rollback-closed");
  assert.equal(rolledBack.allClosed, true);
  assert.equal(rolledBack.analysisEnabled, false);
  assert.equal(rolledBack.commitMatched, true);
  assert.equal(rolledBack.closedEndpoints.length, 4);
  assert.deepEqual(rolledBack.pendingEndpoints, []);
  assert.deepEqual(capturedDeploy.targets, selectedFunctions);
  assert.equal(capturedDeploy.only, "functions:prepareAnalysis,functions:startAnalysis,functions:getAnalysisTables,functions:getAnalysisResult");
  assert.match(capturedDeploy.targetEnvContent, /^INCAGEN_TABULAR_ANALYSIS_ENABLED=false\n/m);
  assert.match(capturedDeploy.targetEnvContent, new RegExp(`INCAGEN_BACKEND_RELEASE_SHA=${headSha}`));

  // 3. Kısmi kapanıştan sonra açık/kapalı karışmış dört uçta güvenli yeniden çalıştırma geçer.
  currentRecords = makeFunctionRecords([
    { enabled: false, sha: headSha },
    { enabled: true, sha: prevSha },
    { enabled: false, sha: prevSha },
    { enabled: true, sha: headSha },
  ]);
  const rerun = await deployClosedFunctions(["--rollback-closed"], baseDeps);
  assert.equal(deployCalls, 2);
  assert.equal(rerun.allClosed, true);
  assert.deepEqual(rerun.previousStates.map(item => item.analysisEnabled), [false, true, false, true]);

  // 4. Servis hesabı veya worker adresi farklıysa geri kapatma başlamadan durur.
  for (const mutated of [
    makeFunctionRecords([
      { enabled: true, sha: prevSha, serviceAccountEmail: "wrong@example.iam.gserviceaccount.com" },
      { enabled: true, sha: prevSha }, { enabled: true, sha: prevSha }, { enabled: true, sha: prevSha },
    ]),
    makeFunctionRecords([
      { enabled: true, sha: prevSha, workerOrigin: "https://other-worker.run.app" },
      { enabled: true, sha: prevSha }, { enabled: true, sha: prevSha }, { enabled: true, sha: prevSha },
    ]),
  ]) {
    currentRecords = mutated;
    await assert.rejects(() => deployClosedFunctions(["--rollback-closed"], baseDeps), /geri kapatma ön koşulu/);
  }
  assert.equal(deployCalls, 2);
});

test("reports closed vs pending endpoints when partial rollback fails and performs no automatic retry", async () => {
  let currentRecords = makeFunctionRecords([
    { enabled: true, sha: prevSha },
    { enabled: true, sha: prevSha },
    { enabled: true, sha: prevSha },
    { enabled: true, sha: prevSha },
  ]);
  let deployCalls = 0;

  const request = async url => {
    if (url.endsWith(":getIamPolicy") && url.includes("cloudresourcemanager")) return projectPolicy;
    if (url.endsWith(":getIamPolicy")) return servicePolicy;
    if (url.includes("/services/")) return makeWorker();
    const index = selectedFunctions.findIndex(name => url.endsWith(`/functions/${name}`));
    return currentRecords[index];
  };

  let caught;
  try {
    await deployClosedFunctions(["--rollback-closed"], {
      env: { INCAGEN_CLOSED_FUNCTIONS_DEPLOY: "1" },
      verifyGit: () => ({ commit: headSha }),
      readEnvFile: () => closedEnv,
      hasSharedEnv: () => false,
      request,
      prepareAndDeploy: async () => {
        deployCalls += 1;
        // İlk iki uç kapandı, üçüncü eski SHA'da kaldı, dördüncü hâlâ açık.
        currentRecords = makeFunctionRecords([
          { enabled: false, sha: headSha },
          { enabled: false, sha: headSha },
          { enabled: false, sha: prevSha },
          { enabled: true, sha: prevSha },
        ]);
        throw new Error("Simulated partial deploy failure");
      },
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught, "Partial rollback must fail.");
  assert.equal(deployCalls, 1, "Rollback must not auto-retry.");
  assert.equal(caught.rollbackSummary.allClosed, false);
  assert.deepEqual(caught.rollbackSummary.closedEndpoints.map(item => item.name), ["prepareAnalysis", "startAnalysis"]);
  assert.deepEqual(
    caught.rollbackSummary.pendingEndpoints.map(item => [item.name, item.reason]),
    [["getAnalysisTables", "commit-mismatch"], ["getAnalysisResult", "analysis-still-open"]],
  );
  assert.ok(!JSON.stringify(caught.rollbackSummary).includes("GEMINI_API_KEY"));
});

test("keeps --diagnostic-only strictly isolated from --rollback-closed and analysis endpoints", async () => {
  assert.deepEqual(parseDeployArgs([]), { mode: "closed" });
  assert.deepEqual(parseDeployArgs(["--diagnostic-only"]), { mode: "diagnostic-only" });
  assert.deepEqual(parseDeployArgs(["--rollback-closed"]), { mode: "rollback-closed" });
  for (const invalid of [["--diagnostic-only", "--rollback-closed"], ["--unknown"], ["--rollback-closed", "--rollback-closed"]]) {
    assert.throws(() => parseDeployArgs(invalid), /Kullanım/);
  }

  const closedRecords = makeFunctionRecords([
    { enabled: false, sha: prevSha },
    { enabled: false, sha: prevSha },
    { enabled: false, sha: prevSha },
    { enabled: false, sha: prevSha },
  ]);
  let diagSha = prevSha;
  let capturedTargets;

  const request = async url => {
    if (url.endsWith(":getIamPolicy") && url.includes("cloudresourcemanager")) return projectPolicy;
    if (url.endsWith(":getIamPolicy")) return servicePolicy;
    if (url.includes("/services/")) return makeWorker();
    if (url.endsWith("/functions/checkGemini")) return makeDiagnosticRecord(diagSha, false);
    const index = selectedFunctions.findIndex(name => url.endsWith(`/functions/${name}`));
    return closedRecords[index];
  };

  const result = await deployClosedFunctions(["--diagnostic-only"], {
    env: { INCAGEN_CLOSED_FUNCTIONS_DEPLOY: "1" },
    verifyGit: () => ({ commit: headSha }),
    readEnvFile: () => closedEnv,
    hasSharedEnv: () => false,
    request,
    prepareAndDeploy: async info => {
      capturedTargets = info.targets;
      assert.equal(info.only, "functions:checkGemini");
      diagSha = headSha;
    },
  });
  assert.deepEqual(capturedTargets, ["checkGemini"]);
  assert.equal(result.diagnosticRevision, "checkgemini-00014-test");
  assert.ok(result.functions.every(fn => fn.releaseCommit === prevSha));
});

test("preserves endpoint rollbackSummary and unreadable status when Cloud Run worker metadata fails during partial rollback", async () => {
  let currentRecords = makeFunctionRecords([
    { enabled: true, sha: prevSha },
    { enabled: true, sha: prevSha },
    { enabled: true, sha: prevSha },
    { enabled: true, sha: prevSha },
  ]);
  let phase = "preflight";
  let deployCalls = 0;

  const request = async url => {
    if (phase === "post" && url.includes("/services/")) {
      throw new Error("Simulated Cloud Run metadata failure");
    }
    if (url.endsWith(":getIamPolicy") && url.includes("cloudresourcemanager")) return projectPolicy;
    if (url.endsWith(":getIamPolicy")) return servicePolicy;
    if (url.includes("/services/")) return makeWorker();
    if (phase === "post" && url.endsWith("/functions/getAnalysisTables")) {
      throw new Error("Simulated single endpoint metadata read failure");
    }
    const index = selectedFunctions.findIndex(name => url.endsWith(`/functions/${name}`));
    return currentRecords[index];
  };

  let caught;
  try {
    await deployClosedFunctions(["--rollback-closed"], {
      env: { INCAGEN_CLOSED_FUNCTIONS_DEPLOY: "1" },
      verifyGit: () => ({ commit: headSha }),
      readEnvFile: () => closedEnv,
      hasSharedEnv: () => false,
      request,
      prepareAndDeploy: async () => {
        deployCalls += 1;
        phase = "post";
        // startAnalysis kapandı, diğerleri açık kaldı; ayrıca worker ve getAnalysisTables okuması hata verecek.
        currentRecords = makeFunctionRecords([
          { enabled: true, sha: prevSha },
          { enabled: false, sha: headSha },
          { enabled: true, sha: prevSha },
          { enabled: true, sha: prevSha },
        ]);
        throw new Error("Simulated partial deploy failure");
      },
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught?.rollbackSummary, "rollbackSummary must be preserved even when worker metadata read fails.");
  assert.equal(deployCalls, 1, "Must not trigger a second deploy or retry.");
  assert.equal(caught.rollbackSummary.allClosed, false);
  assert.equal(caught.rollbackSummary.workerStatus, "unreadable");
  assert.equal(caught.rollbackSummary.workerUnchanged, null);
  assert.deepEqual(caught.rollbackSummary.closedEndpoints.map(item => item.name), ["startAnalysis"]);
  assert.deepEqual(
    caught.rollbackSummary.pendingEndpoints.map(item => [item.name, item.reason]),
    [
      ["prepareAnalysis", "analysis-still-open"],
      ["getAnalysisTables", "endpoint-read-failed"],
      ["getAnalysisResult", "analysis-still-open"],
    ],
  );
});
