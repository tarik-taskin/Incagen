import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { runIsolated } from "./run-emulator-tests.mjs";

// Child metadata contains only a test directory path and its mode, never application credentials.
async function fixture(callback) {
  const dir = mkdtempSync(join(tmpdir(), "inc-runner-test-"));
  try { await callback(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

for (const code of [0, 7]) test(`isolates and removes temporary data after child exit ${code}`, () => fixture(async dir => {
  const output = join(dir, "metadata.json");
  const script = `const fs=require('node:fs'); fs.writeFileSync(process.argv[1],JSON.stringify({dir:process.env.TMPDIR,tmp:process.env.TMP,temp:process.env.TEMP,mode:fs.statSync(process.env.TMPDIR).mode&0o777})); process.exit(${code});`;
  const original = process.env.TMPDIR;
  const result = await runIsolated(process.execPath, ["-e", script, output], { stdio: "ignore" });
  assert.equal(result.code, code);
  const data = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(data.dir, data.tmp); assert.equal(data.dir, data.temp);
  assert.ok(data.dir.length < 45); assert.equal(data.mode, 0o700);
  assert.equal(existsSync(data.dir), false); assert.equal(process.env.TMPDIR, original);
}));

test("parallel invocations own different directories and do not remove sibling files", () => fixture(async dir => {
  const sibling = join(dir, "keep"); writeFileSync(sibling, "unrelated");
  const outputs = [join(dir, "a"), join(dir, "b")];
  await Promise.all(outputs.map(output => runIsolated(process.execPath, ["-e", `require('node:fs').writeFileSync(process.argv[1], process.env.TMPDIR);setTimeout(()=>{},50);`, output], { stdio: "ignore" })));
  const paths = outputs.map(output => readFileSync(output, "utf8"));
  assert.notEqual(paths[0], paths[1]); paths.forEach(path => assert.equal(existsSync(path), false));
  assert.equal(readFileSync(sibling, "utf8"), "unrelated");
}));

test("reports a spawn failure and restores signal listeners", async () => {
  const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
  await assert.rejects(runIsolated("/incagen-test-missing-executable", [], { stdio: "ignore" }), { code: "ENOENT" });
  assert.deepEqual([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")], before);
});

for (const signal of ["SIGINT", "SIGTERM"]) test(`forwards ${signal}, waits for graceful exit and cleans its directory`, () => fixture(async dir => {
  const metadata = join(dir, "ready"), acknowledged = join(dir, "stopped"), result = join(dir, "result");
  const childScript = `const fs=require('node:fs'); process.on('${signal}',()=>{fs.writeFileSync(${JSON.stringify(acknowledged)},'yes');setTimeout(()=>process.exit(0),30)});fs.writeFileSync(${JSON.stringify(metadata)},process.env.TMPDIR);setInterval(()=>{},1000);`;
  const runner = `import {runIsolated} from ${JSON.stringify(new URL("./run-emulator-tests.mjs", import.meta.url).href)};import{writeFileSync}from'node:fs';const result=await runIsolated(process.execPath,['-e',${JSON.stringify(childScript)}]);writeFileSync(${JSON.stringify(result)},JSON.stringify(result));`;
  const parent = spawn(process.execPath, ["--input-type=module", "-e", runner], { stdio: "ignore" });
  const finished = new Promise((resolve, reject) => { parent.once("error", reject); parent.once("exit", code => resolve(code)); });
  try {
    for (let n = 0; !existsSync(metadata) && n < 100; n++) await delay(20);
    assert.ok(existsSync(metadata), "child must be ready before interrupt");
    const temporary = readFileSync(metadata, "utf8");
    assert.equal(statSync(temporary).isDirectory(), true);
    parent.kill(signal);
    assert.equal(await finished, 0);
    assert.equal(readFileSync(acknowledged, "utf8"), "yes");
    assert.deepEqual(JSON.parse(readFileSync(result, "utf8")), { code: 0, signal });
    assert.equal(existsSync(temporary), false);
  } finally { if (parent.exitCode === null) { parent.kill("SIGTERM"); await finished; } }
}));
