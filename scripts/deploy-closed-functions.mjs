import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { callerIdentity, cloudRequest, closedBackendPlan, inspectClosedEnvironment, project, revisionScope, selectedFunctions } from "./closed-backend.mjs";

// Yalnız temiz revizyondaki Functions kaynaklarını ve güvenli üç yayın alanını hazırlar.
async function deploy(args) {
  const diagnosticOnly = args.length === 1 && args[0] === "--diagnostic-only";
  assert.ok((args.length === 0 || diagnosticOnly) && process.env.INCAGEN_CLOSED_FUNCTIONS_DEPLOY === "1",
    "Kapalı Functions dağıtımı açık onay gerektirir.");
  const root = process.cwd();
  const plan = await closedBackendPlan(["--live"], root);
  const { workerOrigin } = inspectClosedEnvironment(readFileSync(join(root, "functions", `.env.${project}`), "utf8"));
  const work = mkdtempSync(join(tmpdir(), "incagen-functions-release-"));
  try {
    const archive = execFileSync("git", ["archive", "--format=tar", plan.commit, "--", "firebase.json", "functions", "firestore.rules", "storage.rules"], {
      cwd: root, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 * 1024 * 1024,
    });
    execFileSync("tar", ["-x", "-C", work], { input: archive, stdio: ["pipe", "ignore", "ignore"] });
    writeFileSync(join(work, "functions", `.env.${project}`),
      `INCAGEN_TABULAR_ANALYSIS_ENABLED=false\nINCAGEN_PYTHON_WORKER_URL=${workerOrigin}\nINCAGEN_BACKEND_RELEASE_SHA=${plan.commit}\n`,
      { flag: "wx", mode: 0o600 });
    execFileSync("npm", ["--prefix", "functions", "ci", "--no-audit", "--no-fund"], { cwd: work, stdio: "inherit" });
    execFileSync("npm", ["--prefix", "functions", "run", "build"], { cwd: work, stdio: "inherit" });
    // CLI proje ve uç listesi sabittir. Kurallar, Auth ve diğer işlevler dağıtılmaz.
    const targets = diagnosticOnly ? ["checkGemini"] : selectedFunctions;
    const only = targets.map(name => `functions:${name}`).join(",");
    execFileSync(process.execPath, [resolve(root, "node_modules/firebase-tools/lib/bin/firebase.js"), "deploy", "--project", project, "--only", only, "--non-interactive"], {
      cwd: work, stdio: "inherit",
    });
    const released = await closedBackendPlan(["--live"], root);
    assert.equal(released.commit, plan.commit);
    assert.equal(released.worker.digest, plan.worker.digest, "Functions dağıtımı sırasında worker image değişti.");
    if (diagnosticOnly) {
      assert.deepEqual(released.functions, plan.functions, "Teşhis dışında canlı analiz uçları değişti.");
      const { state, serviceConfig: config } = await cloudRequest(root)(`https://cloudfunctions.googleapis.com/v2/${revisionScope}/functions/checkGemini`);
      const env = config?.environmentVariables;
      assert.ok(state === "ACTIVE" && config.timeoutSeconds === 330 && config.maxInstanceCount === 1
        && config.maxInstanceRequestConcurrency === 1 && config.serviceAccountEmail === callerIdentity
        && env?.INCAGEN_BACKEND_RELEASE_SHA === plan.commit && env.INCAGEN_TABULAR_ANALYSIS_ENABLED === "false"
        && env.INCAGEN_PYTHON_WORKER_URL?.replace(/\/$/, "") === workerOrigin
        && !Object.hasOwn(env, "GEMINI_API_KEY") && !config.secretEnvironmentVariables?.some(secret => secret.key === "GEMINI_API_KEY"),
      "Canlı Gemini teşhisinin süre, kota veya sürüm bilgisi doğrulanamadı.");
      console.log(JSON.stringify({ ...released, targets, diagnosticRevision: config.revision }, null, 2));
    } else {
      assert.ok(released.functions.every(item => item.releaseCommit === plan.commit), "Canlı Functions yayın SHA’sı eksik veya farklı.");
      console.log(JSON.stringify(released, null, 2));
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

deploy(process.argv.slice(2)).catch(error => {
  console.error(JSON.stringify({ status: "failed", reason: error.code && error.code !== "ERR_ASSERTION" ? "Functions dağıtımı tamamlanamadı." : error.message }));
  process.exitCode = 1;
});
