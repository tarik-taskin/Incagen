#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkSourceCredentials } from "./check-source-credentials.mjs";

export const MANIFEST_NAME = "release-manifest.json";
export const DEFAULT_SITE_URL = "https://incagen.netlify.app";
export const SPA_ROUTES = ["/", "/ornek-rapor", "/ornek-rapor/musteri-deneyimi", "/app/new-analysis", "/app/history", "/app/settings", "/app/plan"];
const controlFiles = new Set(["_redirects", "_headers"]);
const textExtensions = new Set([".js", ".css", ".html", ".json", ".map", ".svg", ".txt", ".md", ".xml", ".csv"]);
const hashPattern = /^[a-f0-9]{64}$/;
export const HOSTING_COMMENT = "<!-- This site is hosted on Netlify. Anyone can build and deploy a site\n     like this one for free: https://netlify.new/?utm_campaign=loops&utm_source=ai-legible&utm_medium=owned&utm_content=comment&utm_id=9a03e44c-44d8-4c0b-8443-91fba5b9abf9\n     Netlify hosting facts for this site: static/SSR served via Netlify Edge. -->\n";
export const FORBIDDEN_SECRET_PATTERNS = [/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/, /GEMINI_API_KEY|SecretManagerServiceClient|@google\/genai|AI_GATEWAY_TOKEN/, /["']type["']\s*:\s*["']service_account["']/, /["'](?:private_key|client_secret)["']\s*:/, /ya29\.[A-Za-z0-9_-]{20,}/];
export const digest = bytes => createHash("sha256").update(bytes).digest("hex");

// Salt okunur Git kontrolü; kirli ağaç veya başka commit'ten paket tam kabulden geçemez.
export function verifyGitStatus({ cwd = process.cwd() } = {}) {
  try {
    const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
    assert.ok(git("status", "--porcelain") === "");
    return { commit: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), branch: git("branch", "--show-current") };
  } catch {
    // Porcelain veya Git stderr'i dosya adındaki credential'ı hata mesajına ekleyemez.
    throw new Error("Git çalışma ağacı kirli veya metadata okunamadı; yayın doğrulaması reddedildi.");
  }
}

// Paket dışına çıkabilen symlink'leri reddeder; bütün dosyaların adı ve hash'i korunur.
export function calculateDistManifest(directory = "dist") {
  const files = {};
  function visit(relative = "") {
    for (const name of readdirSync(join(directory, relative)).sort()) {
      const file = relative ? `${relative}/${name}` : name, stat = lstatSync(join(directory, file));
      assert.ok(!stat.isSymbolicLink(), "Yayın paketinde sembolik bağlantı olamaz.");
      if (stat.isDirectory()) visit(file);
      else files[file] = digest(readFileSync(join(directory, file)));
    }
  }
  visit(); return files;
}

// Manifest build sırasında yazılır; şimdiki HEAD'i eski dist'e etiketlemek kabul değildir.
export function verifyDistDirectory(directory = "dist", revision) {
  const manifest = calculateDistManifest(directory);
  assert.ok(manifest["index.html"], "Paket index.html içermiyor.");
  assert.ok(manifest[MANIFEST_NAME], "Build provenance manifesti bulunamadı; yeniden derleyin.");
  const info = JSON.parse(readFileSync(join(directory, MANIFEST_NAME), "utf8"));
  assert.equal(info.version, 1, "Bilinmeyen manifest sürümü.");
  assert.ok(revision?.commit && revision?.tree, "Beklenen kaynak revizyonu gerekli.");
  assert.equal(info.revision?.commit, revision.commit, "Paket commit'i güncel kaynakla eşleşmiyor.");
  assert.equal(info.revision?.tree, revision.tree, "Paket kaynak ağacı eşleşmiyor.");
  assert.equal(info.revision?.dirty, false, "Paket kirli kaynak ağacından derlenmiş.");
  assert.equal(info.mode, "cloud-preview", "Canlı paket cloud-preview modunda derlenmeli.");
  assert.deepEqual(info.flags, { authOnlyPreview: false, tabularAnalysisEnabled: false }, "Yayın kapıları beklenen kapsamla eşleşmiyor.");
  const config = info.firebase;
  assert.equal(config?.mode, "cloud", "Firebase cloud modu gerekli.");
  assert.equal(config.projectId, "incagen-eeef4", "Firebase proje kimliği eşleşmiyor.");
  assert.equal(config.authDomain, "incagen-eeef4.firebaseapp.com", "Firebase authDomain eşleşmiyor.");
  assert.ok(["incagen-eeef4.firebasestorage.app", "incagen-eeef4.appspot.com"].includes(config.storageBucket), "Firebase storageBucket eşleşmiyor.");
  assert.match(config.messagingSenderId ?? "", /^\d+$/, "Firebase messagingSenderId eksik.");
  assert.match(config.appId ?? "", /^1:\d+:web:[a-f0-9]+$/, "Firebase appId eksik.");
  assert.match(config.apiKeySha256 ?? "", hashPattern, "Public Firebase anahtar fingerprint'i eksik.");
  const expected = { ...manifest }; delete expected[MANIFEST_NAME];
  assert.deepEqual(info.files, expected, "Paket dosyaları build manifestiyle eşleşmiyor.");
  let publicKeyFound = false; const js = [];
  for (const name of Object.keys(manifest)) {
    if (!textExtensions.has(extname(name))) continue;
    const content = readFileSync(join(directory, name), "utf8");
    for (const pattern of FORBIDDEN_SECRET_PATTERNS) assert.ok(!pattern.test(content), `Backend secret/modül işareti bulundu: ${name}`);
    if (name.endsWith(".js")) {
      js.push(content);
      for (const match of content.matchAll(/AIza[A-Za-z0-9_-]{35}/g)) if (digest(match[0]) === config.apiKeySha256) publicKeyFound = true;
    }
  }
  assert.ok(publicKeyFound, "Public Firebase anahtar fingerprint'i JS çıktısıyla eşleşmiyor.");
  for (const key of ["projectId", "authDomain", "storageBucket", "messagingSenderId", "appId"]) assert.ok(js.some(content => content.includes(config[key])), `Firebase public alanı JS çıktısında doğrulanamadı: ${key}`);
  return { manifest, info };
}

// Yalnız birebir bilinen statik Netlify yorumu ayrılır; diğer HTML ve whitespace korunur.
export function normalizeHtmlForComparison(html) { return html.replace(HOSTING_COMMENT, ""); }

// Timeout başlıklarla bitmez: gövde okumasını da kapsar; redirect ve origin kayması reddedilir.
export async function fetchWithTimeout(url, { timeoutMs = 15000, fetchFn = globalThis.fetch } = {}) {
  const target = new URL(url);
  assert.ok(target.protocol === "https:" || (target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname)), "Yalnız HTTPS veya yerel test adresi kullanılabilir.");
  assert.ok(!target.username && !target.password, "URL kimlik bilgisi içeremez.");
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader;
  try {
    const response = await fetchFn(target.href, { signal: controller.signal, redirect: "error" });
    assert.equal(response.status, 200, "Yayın dosyası HTTP 200 dönmedi.");
    if (response.url) assert.equal(new URL(response.url).origin, target.origin, "Yayın yanıtı başka origin'e yönlendi.");
    assert.ok(Number(response.headers.get("content-length") ?? 0) <= 64 * 1024 * 1024, "Yayın yanıtı boyut sınırını aşıyor.");
    const parts = []; let size = 0;
    reader = response.body?.getReader();
    if (reader) while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; assert.ok(size <= 64 * 1024 * 1024, "Yayın yanıtı boyut sınırını aşıyor."); parts.push(Buffer.from(value));
    }
    return { bytes: Buffer.concat(parts), contentType: response.headers.get("content-type") ?? "" };
  } catch (error) { controller.abort(); throw error; }
  finally { clearTimeout(timer); if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); } }
}

// Lazy JS, fontlar, örnek belgeler ve manifest dahil bütün public dosyalar karşılaştırılır.
export async function verifyLiveAssets(baseUrl, manifest, options = {}) {
  const files = Object.keys(manifest).filter(name => !controlFiles.has(name));
  for (let start = 0; start < files.length; start += 4) await Promise.all(files.slice(start, start + 4).map(async name => {
    const url = new URL(`/${name.split("/").map(encodeURIComponent).join("/")}`, baseUrl);
    const { bytes } = await fetchWithTimeout(url, options);
    const actual = name === "index.html" ? digest(normalizeHtmlForComparison(bytes.toString("utf8"))) : digest(bytes);
    assert.equal(actual, manifest[name], `Canlı dosya hash uyuşmazlığı: ${name}`);
  }));
  return { verifiedFiles: files.length };
}

// Her SPA rotası yalnız 200/HTML değil, doğrulanan aynı index.html içeriğini sunmalı.
export async function verifyLiveRoutes(baseUrl, manifest, options = {}) {
  assert.ok(manifest["index.html"], "Beklenen index.html hash'i gerekli.");
  for (const route of SPA_ROUTES) {
    const { bytes, contentType } = await fetchWithTimeout(new URL(route, baseUrl), options);
    assert.ok(contentType.includes("text/html"), `SPA rotası HTML dönmedi: ${route}`);
    assert.equal(digest(normalizeHtmlForComparison(bytes.toString("utf8"))), manifest["index.html"], `SPA rota içeriği eşleşmiyor: ${route}`);
  }
  return { verifiedRoutes: SPA_ROUTES.length };
}

// Doğrulama salt okunurdur; yerel-only sonuç canlı yayın kabulü diye etiketlenmez.
export async function runReleaseVerification(args = process.argv.slice(2), { cwd = process.cwd(), fetchFn = globalThis.fetch } = {}) {
  assert.ok(args.every(arg => arg === "--skip-live" || /^--site-url=.+$/.test(arg)), "Bilinmeyen seçenek; dirty-tree bypass desteklenmez.");
  const git = verifyGitStatus({ cwd }), directory = resolve(cwd, "dist");
  assert.equal(checkSourceCredentials({ cwd }).findings.length, 0, "Takip edilen kaynaklarda credential kalıbı bulundu; yayın reddedildi.");
  const { manifest, info } = verifyDistDirectory(directory, git);
  const site = args.find(arg => arg.startsWith("--site-url="))?.slice("--site-url=".length) ?? process.env.INCAGEN_SITE_URL ?? DEFAULT_SITE_URL;
  const live = !args.includes("--skip-live");
  const result = { commit: git.commit, files: Object.keys(manifest).length, mode: info.mode, liveVerified: false };
  if (live) {
    Object.assign(result, await verifyLiveAssets(site, manifest, { fetchFn }), await verifyLiveRoutes(site, manifest, { fetchFn }));
    result.liveVerified = true;
  }
  console.log(JSON.stringify(result));
  console.log(live ? "Yerel paket ve canlı yayın dosya eşliği doğrulandı." : "Yalnız yerel paket doğrulandı; canlı yayın kontrol edilmedi.");
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runReleaseVerification().catch(error => { console.error(`Yayın doğrulaması başarısız: ${error.message}`); process.exitCode = 1; });
