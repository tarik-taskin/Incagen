import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { calculateDistManifest, digest, fetchWithTimeout, HOSTING_COMMENT, MANIFEST_NAME, normalizeHtmlForComparison, runReleaseVerification, SPA_ROUTES, verifyDistDirectory, verifyGitStatus, verifyLiveAssets, verifyLiveRoutes } from "./verify-release.mjs";

const revision = { commit: "a".repeat(40), tree: "b".repeat(40) };
// Sentetik anahtar çalışma anında oluşturulur; hiçbir gerçek proje değeri fixture'a kopyalanmaz.
const publicKey = "AIza" + "A".repeat(35);
const config = { mode: "cloud", projectId: "incagen-eeef4", authDomain: "incagen-eeef4.firebaseapp.com", storageBucket: "incagen-eeef4.firebasestorage.app", messagingSenderId: "123", appId: "1:123:web:abcd" };
const html = '<!doctype html><html><script src="/assets/app.js"></script><body>Incagen</body></html>';

// Test paketi kendi geçici dizinini temizler; gerçek repo ve ortam dosyalarına dokunmaz.
function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "incagen-release-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), html);
  writeFileSync(join(dir, "assets/app.js"), JSON.stringify({ ...config, apiKey: publicKey }));
  writeFileSync(join(dir, "assets/lazy.js"), "export const lazy = true;");
  writeFileSync(join(dir, "assets/font.woff2"), Buffer.from([1, 2, 3]));
  writeFileSync(join(dir, "example.pdf"), "synthetic example bytes");
  for (const [name, content] of Object.entries(options.extra ?? {})) writeFileSync(join(dir, name), content);
  const info = { version: 1, revision: { ...revision, dirty: false }, mode: "cloud-preview", firebase: { ...config, apiKeySha256: digest(publicKey) }, flags: { authOnlyPreview: false, tabularAnalysisEnabled: false }, files: calculateDistManifest(dir) };
  if (options.change) options.change(info);
  writeFileSync(join(dir, MANIFEST_NAME), JSON.stringify(info));
  return dir;
}

// Tüm dosya türlerini ve rotaları aynı test sunucusu sözleşmesiyle sunar.
function mockFiles(directory, override = () => undefined) {
  return async (url, options) => {
    assert.equal(options.redirect, "error");
    const path = decodeURIComponent(new URL(url).pathname);
    const changed = override(path); if (changed) return changed;
    const name = SPA_ROUTES.includes(path) ? "index.html" : path.slice(1);
    return new Response(readFileSync(join(directory, name)), { headers: { "content-type": name.endsWith(".html") ? "text/html" : "application/octet-stream" } });
  };
}

test("valid package records revision, public config and all file hashes without self-hash", t => {
  const directory = fixture(t), result = verifyDistDirectory(directory, revision);
  assert.equal(Object.keys(result.manifest).length, 6);
  assert.ok(!result.info.files[MANIFEST_NAME]);
});

test("missing manifest/index and changed file set are rejected", t => {
  for (const name of [MANIFEST_NAME, "index.html", "example.pdf"]) {
    const directory = fixture(t); rmSync(join(directory, name));
    assert.throws(() => verifyDistDirectory(directory, revision));
  }
  const directory = fixture(t); writeFileSync(join(directory, "stale.txt"), "unexpected");
  assert.throws(() => verifyDistDirectory(directory, revision), /manifestiyle/);
});

test("wrong revision, dirty source, wrong mode and open rollout flags are rejected", t => {
  for (const change of [i => i.revision.commit = "c".repeat(40), i => i.revision.tree = "c".repeat(40), i => i.revision.dirty = true, i => i.mode = "production", i => i.flags.tabularAnalysisEnabled = true, i => i.flags.authOnlyPreview = true]) {
    assert.throws(() => verifyDistDirectory(fixture(t, { change }), revision));
  }
});

test("every required Firebase field and actual bundle key fingerprint is checked", t => {
  for (const key of Object.keys({ ...config, apiKeySha256: "" })) {
    const directory = fixture(t, { change: info => delete info.firebase[key] });
    assert.throws(() => verifyDistDirectory(directory, revision));
  }
  assert.throws(() => verifyDistDirectory(fixture(t, { change: info => info.firebase.apiKeySha256 = "f".repeat(64) }), revision), /fingerprint/);
});

test("secret markers are rejected in text, JSON, source maps and private-key headers", t => {
  for (const [name, content] of [["leak.txt", "GEMINI_API_KEY=synthetic"], ["leak.map", "SecretManagerServiceClient"], ["leak.json", '{"type":"service_account"}'], ["leak.md", "-----BEGIN PRIVATE KEY-----"], ["leak.xml", "-----BEGIN RSA PRIVATE KEY-----"]]) {
    assert.throws(() => verifyDistDirectory(fixture(t, { extra: { [name]: content } }), revision), /Backend secret/);
  }
});

test("git check uses an isolated repo and deterministically rejects dirty trees", t => {
  const cwd = mkdtempSync(join(tmpdir(), "incagen-git-test-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, stdio: "pipe" });
  git("init", "-q"); writeFileSync(join(cwd, "source.txt"), "synthetic"); git("add", "source.txt");
  git("-c", "user.name=Synthetic", "-c", "user.email=test@example.test", "commit", "-qm", "fixture");
  assert.match(verifyGitStatus({ cwd }).commit, /^[a-f0-9]{40}$/);
  writeFileSync(join(cwd, "dirty.txt"), "changed");
  assert.throws(() => verifyGitStatus({ cwd }), /kirli/);
});

test("dirty credential-shaped paths never enter release errors", t => {
  const cwd = mkdtempSync(join(tmpdir(), "incagen-release-redaction-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, stdio: "pipe" });
  git("init", "-q"); writeFileSync(join(cwd, "safe.txt"), "synthetic"); git("add", ".");
  git("-c", "user.name=Synthetic", "-c", "user.email=test@example.test", "commit", "-qm", "fixture");
  writeFileSync(join(cwd, `${publicKey}.txt`), "synthetic");
  assert.throws(() => verifyGitStatus({ cwd }), error => /kirli/.test(error.message) && !String(error).includes(publicKey));
});

test("local-only CLI cannot accept a dirty bypass option", async () => {
  await assert.rejects(runReleaseVerification(["--allow-dirty", "--skip-live"]), /bypass/);
});

test("all public files including lazy JS, fonts, documents and build manifest are compared", async t => {
  const directory = fixture(t), manifest = calculateDistManifest(directory);
  const result = await verifyLiveAssets("https://release.test", manifest, { fetchFn: mockFiles(directory) });
  assert.equal(result.verifiedFiles, 6);
  assert.equal((await verifyLiveRoutes("https://release.test", manifest, { fetchFn: mockFiles(directory) })).verifiedRoutes, 7);
});

test("lazy asset, example document, manifest and font mismatches reject the release", async t => {
  const directory = fixture(t), manifest = calculateDistManifest(directory);
  for (const path of ["/assets/lazy.js", "/assets/font.woff2", "/example.pdf", `/${MANIFEST_NAME}`]) {
    await assert.rejects(verifyLiveAssets("https://release.test", manifest, { fetchFn: mockFiles(directory, p => p === path ? new Response("wrong") : undefined) }), /hash uyuşmazlığı/);
  }
});

test("HTTP 200 wrong SPA HTML, non-HTML and missing files fail", async t => {
  const directory = fixture(t), manifest = calculateDistManifest(directory);
  for (const response of [() => new Response("wrong html", { headers: { "content-type": "text/html" } }), () => new Response(html), () => new Response("missing", { status: 404 })]) {
    await assert.rejects(verifyLiveRoutes("https://release.test", manifest, { fetchFn: mockFiles(directory, path => path === "/app/settings" ? response() : undefined) }));
  }
});

test("only the exact known static hosting comment is accepted, not broad comment ranges", async t => {
  const directory = fixture(t), manifest = calculateDistManifest(directory);
  await verifyLiveAssets("https://release.test", manifest, { fetchFn: mockFiles(directory, path => path === "/" || path === "/index.html" ? new Response(html + HOSTING_COMMENT) : undefined) });
  const changed = '<!-- first -->' + html + '<!-- hosted on Netlify but different -->';
  assert.equal(normalizeHtmlForComparison(changed), changed);
  await assert.rejects(verifyLiveAssets("https://release.test", manifest, { fetchFn: mockFiles(directory, path => path === "/index.html" ? new Response(changed) : undefined) }), /hash uyuşmazlığı/);
});

test("cross-origin responses and redirects are rejected", async () => {
  const foreign = new Response("wrong"); Object.defineProperty(foreign, "url", { value: "https://other.test/" });
  await assert.rejects(fetchWithTimeout("https://release.test", { fetchFn: async () => foreign }), /origin/);
  await assert.rejects(fetchWithTimeout("https://release.test", { fetchFn: async () => new Response(null, { status: 302 }) }), /HTTP 200/);
});

test("real transport timeout covers both connection headers and stalled response bodies", { timeout: 5000 }, async t => {
  const server = createServer((request, response) => {
    if (request.url === "/body") { response.writeHead(200, { "content-type": "text/html" }); response.flushHeaders(); response.write("partial"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/headers", "/body"]) await assert.rejects(fetchWithTimeout(base + path, { timeoutMs: 50 }), /abort/i);
});


test("release CLI captures Git stderr without printing credential-shaped paths", t => {
  const cwd = mkdtempSync(join(tmpdir(), "incagen-release-git-stderr-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(join(cwd, ".git"), `gitdir: ${join(cwd, publicKey)}\n`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./verify-release.mjs", import.meta.url)), "--skip-live"], { cwd, encoding: "utf8" });
  assert.equal(result.status, 1); assert.ok(!(result.stdout + result.stderr).includes(publicKey));
});
