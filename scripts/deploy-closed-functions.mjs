import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import {
  callerIdentity,
  closedBackendPlan,
  cloudRequest,
  inspectClosedEnvironment,
  inspectWorker,
  project,
  region,
  revisionScope,
  selectedFunctions,
  summarizeRollbackStatus,
  verifyRollbackFunctions,
} from "./closed-backend.mjs";
import { verifyGitStatus } from "./verify-release.mjs";

const usageMessage = "Kullanım: INCAGEN_CLOSED_FUNCTIONS_DEPLOY=1 npm run backend:functions:deploy [-- --diagnostic-only | --rollback-closed]";

// Dağıtım kiplerini kesin ve birbirini dışlayan biçimde ayrıştırır.
export function parseDeployArgs(args) {
  if (args.length === 0) return { mode: "closed" };
  if (args.length === 1 && args[0] === "--diagnostic-only") return { mode: "diagnostic-only" };
  if (args.length === 1 && args[0] === "--rollback-closed") return { mode: "rollback-closed" };
  throw new Error(usageMessage);
}

// Yalnız açık geri kapatma geçişinde dört analiz ucunu ve özel worker kimliğini salt okunur denetler.
async function inspectRollbackPreflight(root, deps) {
  const { commit } = (deps.verifyGit ?? verifyGitStatus)({ cwd: root });
  const functionsDir = join(root, "functions");
  const readEnv = deps.readEnvFile ?? (path => readFileSync(path, "utf8"));
  const { workerOrigin } = inspectClosedEnvironment(readEnv(join(functionsDir, `.env.${project}`)), { inviteBeta: false });
  const sharedPath = join(functionsDir, ".env");
  if ((deps.hasSharedEnv ?? existsSync)(sharedPath)) {
    const shared = parseEnv(readEnv(sharedPath));
    if (["GEMINI_API_KEY", "INCAGEN_TABULAR_ANALYSIS_ENABLED", "INCAGEN_PYTHON_WORKER_URL"].some(key => Object.hasOwn(shared, key))) {
      throw new Error("Ortak Functions ortamı üretim kontrolünü gölgeliyor.");
    }
  }
  const request = deps.request ?? cloudRequest(root);
  const [worker, records] = await Promise.all([
    inspectWorker(request),
    Promise.all(selectedFunctions.map(name => request(`https://cloudfunctions.googleapis.com/v2/${revisionScope}/functions/${name}`))),
  ]);
  if (worker.report.uri?.replace(/\/$/, "") !== workerOrigin) {
    throw new Error("Canlı worker adresi kapalı ortamla eşleşmiyor.");
  }
  const functions = verifyRollbackFunctions(records, workerOrigin);
  return {
    commit,
    project,
    region,
    workerOrigin,
    worker: { revision: worker.report.revision, digest: worker.report.digest },
    functions,
  };
}

// Temiz revizyondaki Functions kaynaklarını ve güvenli kapalı yayın ortamını hazırlar; geri kapatma ve teşhis yollarını ayrı tutar.
export async function deployClosedFunctions(args, deps = {}) {
  const { mode } = parseDeployArgs(args);
  const env = deps.env ?? process.env;
  assert.equal(env.INCAGEN_CLOSED_FUNCTIONS_DEPLOY, "1", "Kapalı Functions dağıtımı açık onay gerektirir.");
  const root = deps.root ?? process.cwd();
  const request = deps.request ?? cloudRequest(root);
  const runExec = deps.runExec ?? execFileSync;
  const readEnv = deps.readEnvFile ?? (path => readFileSync(path, "utf8"));
  const planDeps = {
    request,
    verifyGit: deps.verifyGit,
    readEnvFile: deps.readEnvFile,
    hasSharedEnv: deps.hasSharedEnv,
  };

  const rollbackMode = mode === "rollback-closed";
  const diagnosticOnly = mode === "diagnostic-only";
  const plan = rollbackMode
    ? await inspectRollbackPreflight(root, planDeps)
    : await closedBackendPlan(["--live"], root, planDeps);
  const workerOrigin = rollbackMode
    ? plan.workerOrigin
    : inspectClosedEnvironment(readEnv(join(root, "functions", `.env.${project}`))).workerOrigin;
  const targets = diagnosticOnly ? ["checkGemini"] : selectedFunctions;
  const only = targets.map(name => `functions:${name}`).join(",");
  const targetEnvContent = `INCAGEN_TABULAR_ANALYSIS_ENABLED=false\nINCAGEN_PYTHON_WORKER_URL=${workerOrigin}\nINCAGEN_BACKEND_RELEASE_SHA=${plan.commit}\n`;

  const work = mkdtempSync(join(tmpdir(), "incagen-functions-release-"));
  let deployError;
  try {
    if (deps.prepareAndDeploy) {
      try {
        await deps.prepareAndDeploy({ work, commit: plan.commit, project, targets, only, targetEnvContent });
      } catch (error) {
        deployError = error;
      }
    } else {
      const archive = runExec("git", ["archive", "--format=tar", plan.commit, "--", "firebase.json", "functions", "firestore.rules", "storage.rules"], {
        cwd: root, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 * 1024 * 1024,
      });
      runExec("tar", ["-x", "-C", work], { input: archive, stdio: ["pipe", "ignore", "ignore"] });
      writeFileSync(join(work, "functions", `.env.${project}`), targetEnvContent, { flag: "wx", mode: 0o600 });
      runExec("npm", ["--prefix", "functions", "ci", "--no-audit", "--no-fund"], { cwd: work, stdio: "inherit" });
      runExec("npm", ["--prefix", "functions", "run", "build"], { cwd: work, stdio: "inherit" });
      try {
        // CLI proje ve uç listesi sabittir. Kurallar, Auth ve diğer işlevler dağıtılmaz.
        runExec(process.execPath, [resolve(root, "node_modules/firebase-tools/lib/bin/firebase.js"), "deploy", "--project", project, "--only", only, "--non-interactive"], {
          cwd: work, stdio: "inherit",
        });
      } catch (error) {
        deployError = error;
      }
    }

    if (rollbackMode) {
      const unreadableNames = new Set();
      const [postWorkerResult, postRecords] = await Promise.all([
        inspectWorker(request).then(
          worker => ({ ok: true, worker }),
          () => ({ ok: false, worker: null }),
        ),
        Promise.all(selectedFunctions.map(name => request(`https://cloudfunctions.googleapis.com/v2/${revisionScope}/functions/${name}`).catch(() => {
          unreadableNames.add(name);
          return null;
        }))),
      ]);
      const rollbackSummary = summarizeRollbackStatus(postRecords, workerOrigin, plan.commit, unreadableNames);
      const workerUnchanged = postWorkerResult.ok ? postWorkerResult.worker.report.digest === plan.worker.digest : null;
      const workerStatus = !postWorkerResult.ok ? "unreadable" : workerUnchanged ? "verified" : "changed";
      if (deployError || !rollbackSummary.allClosed || workerStatus !== "verified") {
        const error = new Error(workerStatus === "changed"
          ? "Geri kapatma sırasında worker image değişti."
          : workerStatus === "unreadable"
            ? "Geri kapatma sonrası worker durumu okunamadı; uç özetleri kontrol edilmelidir."
            : "Geri kapatma tamamlanamadı; tüm analiz uçları kapalı ve beklenen SHA’da doğrulanmadı.");
        error.rollbackSummary = {
          mode,
          commit: plan.commit,
          workerStatus,
          workerUnchanged,
          ...rollbackSummary,
        };
        throw error;
      }
      return {
        commit: plan.commit,
        project,
        region,
        mode,
        analysisEnabled: false,
        liveVerified: true,
        expectedCommit: plan.commit,
        commitMatched: true,
        targets,
        workerStatus,
        worker: { revision: postWorkerResult.worker.report.revision, digest: postWorkerResult.worker.report.digest },
        previousStates: plan.functions.map(({ name, analysisEnabled, releaseCommit }) => ({ name, analysisEnabled, releaseCommit })),
        ...rollbackSummary,
      };
    }

    if (deployError) throw deployError;
    const released = await closedBackendPlan(["--live"], root, planDeps);
    assert.equal(released.commit, plan.commit);
    assert.equal(released.worker.digest, plan.worker.digest, "Functions dağıtımı sırasında worker image değişti.");
    if (diagnosticOnly) {
      assert.deepEqual(released.functions, plan.functions, "Teşhis dışında canlı analiz uçları değişti.");
      const { state, serviceConfig: config } = await request(`https://cloudfunctions.googleapis.com/v2/${revisionScope}/functions/checkGemini`);
      const runtimeEnv = config?.environmentVariables;
      assert.ok(state === "ACTIVE" && config.timeoutSeconds === 330 && config.maxInstanceCount === 1
        && config.maxInstanceRequestConcurrency === 1 && config.serviceAccountEmail === callerIdentity
        && runtimeEnv?.INCAGEN_BACKEND_RELEASE_SHA === plan.commit && runtimeEnv.INCAGEN_TABULAR_ANALYSIS_ENABLED === "false"
        && runtimeEnv.INCAGEN_PYTHON_WORKER_URL?.replace(/\/$/, "") === workerOrigin
        && !Object.hasOwn(runtimeEnv, "GEMINI_API_KEY") && !config.secretEnvironmentVariables?.some(secret => secret.key === "GEMINI_API_KEY"),
      "Canlı Gemini teşhisinin süre, kota veya sürüm bilgisi doğrulanamadı.");
      return { ...released, targets, diagnosticRevision: config.revision };
    }
    assert.ok(released.functions.every(item => item.releaseCommit === plan.commit), "Canlı Functions yayın SHA’sı eksik veya farklı.");
    return released;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deployClosedFunctions(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    const payload = {
      status: "failed",
      reason: error.code && error.code !== "ERR_ASSERTION" ? "Functions dağıtımı tamamlanamadı." : error.message,
      ...(error.rollbackSummary ? { rollbackSummary: error.rollbackSummary } : {}),
    };
    console.error(JSON.stringify(payload));
    process.exitCode = 1;
  });
}
