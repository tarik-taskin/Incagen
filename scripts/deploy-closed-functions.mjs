import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { closedBackendPlan, inspectClosedEnvironment, project, selectedFunctions } from "./closed-backend.mjs";

// Yalnız temiz revizyondaki Functions kaynaklarını ve güvenli üç yayın alanını hazırlar.
async function deploy(args) {
  assert.ok(args.length === 0 && process.env.INCAGEN_CLOSED_FUNCTIONS_DEPLOY === "1", "Kapalı Functions dağıtımı açık onay gerektirir.");
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
    const only = selectedFunctions.map(name => `functions:${name}`).join(",");
    execFileSync(process.execPath, [resolve(root, "node_modules/firebase-tools/lib/bin/firebase.js"), "deploy", "--project", project, "--only", only, "--non-interactive"], {
      cwd: work, stdio: "inherit",
    });
    const released = await closedBackendPlan(["--live"], root);
    assert.equal(released.commit, plan.commit);
    assert.equal(released.worker.digest, plan.worker.digest, "Functions dağıtımı sırasında worker image değişti.");
    assert.ok(released.functions.every(item => item.releaseCommit === plan.commit), "Canlı Functions yayın SHA’sı eksik veya farklı.");
    console.log(JSON.stringify(released, null, 2));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

deploy(process.argv.slice(2)).catch(error => {
  console.error(JSON.stringify({ status: "failed", reason: error.code && error.code !== "ERR_ASSERTION" ? "Functions dağıtımı tamamlanamadı." : error.message }));
  process.exitCode = 1;
});
