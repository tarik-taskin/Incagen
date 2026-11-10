import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkSourceCredentials, scanCredentialPatterns } from "./check-source-credentials.mjs";

const googleKey = "AIza" + "A".repeat(35);

// İzole Git index'i, stage/çalışma dosyası farklarını gerçek repo veya credential kullanmadan sınar.
function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), "incagen-credentials-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd });
  return { cwd, write: (name, data) => writeFileSync(join(cwd, name), data), stage: () => execFileSync("git", ["add", "."], { cwd }) };
}

test("Git dışı ortam dosyaları okunmaz; temiz index kabul edilir", t => {
  const repo = repository(t);
  repo.write(".gitignore", ".env\n"); repo.write(".env", googleKey); repo.write("source.js", "export const ready = true;\n"); repo.stage();
  assert.deepEqual(checkSourceCredentials({ cwd: repo.cwd }), { checkedFiles: 2, findings: [] });
});

test("stage temizken çalışma dosyasındaki anahtar yakalanır ve değeri raporlanmaz", t => {
  const repo = repository(t);
  repo.write("source.js", "safe\n"); repo.stage(); repo.write("source.js", "safe\n" + googleKey);
  const result = checkSourceCredentials({ cwd: repo.cwd });
  assert.deepEqual(result.findings, [{ path: "source.js", location: "worktree", line: 2, kind: "google-api-key" }]);
  assert.ok(!JSON.stringify(result).includes(googleKey));
});

test("çalışma dosyası temizlense de stage edilmiş anahtar commit öncesinde reddedilir", t => {
  const repo = repository(t);
  repo.write("source.js", googleKey); repo.stage(); repo.write("source.js", "safe");
  assert.deepEqual(checkSourceCredentials({ cwd: repo.cwd }).findings, [{ path: "source.js", location: "index", line: 1, kind: "google-api-key" }]);
});

test("token biçimleri ve gerçek/escaped PEM gövdeleri yakalanır; çıplak test başlığı kabul edilir", () => {
  const values = [
    ["ghp_" + "T".repeat(36), "github-token"],
    ["github_pat_" + "T".repeat(60), "github-token"],
    ["AKIA" + "A".repeat(16), "aws-access-key"],
    ["ya29." + "T".repeat(30), "google-oauth-token"],
    ["-----BEGIN PRIVATE KEY-----\n" + "A".repeat(64), "private-key-material"],
    ["-----BEGIN RSA PRIVATE KEY-----\\n" + "A".repeat(64), "private-key-material"],
  ];
  for (const [value, kind] of values) {
    const findings = scanCredentialPatterns(Buffer.from(value), "fixture", "index");
    assert.equal(findings.length, 1); assert.equal(findings[0].kind, kind);
    assert.ok(!JSON.stringify(findings).includes(value));
  }
  assert.deepEqual(scanCredentialPatterns(Buffer.from("-----BEGIN PRIVATE KEY-----"), "fixture", "index"), []);
});

test("dosya adındaki tab/newline korunur; symlink hedefi dışarıdan okunmaz", t => {
  const repo = repository(t), outside = mkdtempSync(join(tmpdir(), "incagen-outside-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, "outside.env"), googleKey);
  symlinkSync(join(outside, "outside.env"), join(repo.cwd, "linked.env"));
  repo.write("source\t\n.js", googleKey); repo.stage();
  const result = checkSourceCredentials({ cwd: repo.cwd });
  assert.equal(result.checkedFiles, 2);
  assert.deepEqual(result.findings, [{ path: "source\t\n.js", location: "index", line: 1, kind: "google-api-key" }]);
});

test("silinmiş çalışma dosyası index taramasını atlatamaz", t => {
  const repo = repository(t); repo.write("source.js", googleKey); repo.stage(); rmSync(join(repo.cwd, "source.js"));
  assert.equal(checkSourceCredentials({ cwd: repo.cwd }).findings[0].location, "index");
});

test("credential dosya adına yazılmış olsa da rapor değeri ifşa etmez", () => {
  const findings = scanCredentialPatterns(Buffer.from(googleKey), `${googleKey}.js`, "index");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].path, "[google-api-key-redacted].js");
  assert.ok(!JSON.stringify(findings).includes(googleKey));
});

test("CLI credential bulduğunda başarısız çıkar ve stdout/stderr'e değer yazmaz", t => {
  const repo = repository(t); repo.write("source.js", googleKey); repo.stage();
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./check-source-credentials.mjs", import.meta.url))], { cwd: repo.cwd, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).findings[0].kind, "google-api-key");
  assert.ok(!(result.stdout + result.stderr).includes(googleKey));
});

test("yalnız dosya adına yazılan credential da maskelenerek reddedilir", t => {
  const repo = repository(t); repo.write(`${googleKey}.txt`, "safe content"); repo.stage();
  const result = checkSourceCredentials({ cwd: repo.cwd });
  assert.deepEqual(result.findings, [{ path: "[google-api-key-redacted].txt", location: "path", line: 1, kind: "google-api-key" }]);
  assert.ok(!JSON.stringify(result).includes(googleKey));
});

test("okunamayan dosya hatası üst çağrıya veya CLI günlüğüne credential taşımaz", t => {
  const repo = repository(t), name = `${googleKey}.txt`, file = join(repo.cwd, name);
  repo.write(name, "synthetic"); repo.stage(); chmodSync(file, 0);
  try {
    assert.throws(() => checkSourceCredentials({ cwd: repo.cwd }), error => {
      assert.ok(!String(error).includes(googleKey)); assert.equal(error.cause, undefined);
      return /taraması tamamlanamadı/.test(error.message);
    });
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./check-source-credentials.mjs", import.meta.url))], { cwd: repo.cwd, encoding: "utf8" });
    assert.equal(result.status, 1); assert.ok(!(result.stdout + result.stderr).includes(googleKey));
  } finally { chmodSync(file, 0o600); }
});


test("Git alt sürecinin stderr'i credential biçimli yolu CLI dışına taşımaz", t => {
  const repo = repository(t);
  rmSync(join(repo.cwd, ".git"), { recursive: true, force: true });
  repo.write(".git", `gitdir: ${join(repo.cwd, googleKey)}\n`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./check-source-credentials.mjs", import.meta.url))], { cwd: repo.cwd, encoding: "utf8" });
  assert.equal(result.status, 1); assert.ok(!(result.stdout + result.stderr).includes(googleKey));
});
