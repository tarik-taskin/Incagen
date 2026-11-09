#!/usr/bin/env node

/**
 * Incagen Yayın Doğrulama Aracı
 *
 * Bu betik:
 * 1. Git çalışma ağacının temizliğini ve güncel commit hash'ini doğrular; kirli ağaçta reddeder.
 * 2. Derleme çıktısı (dist) içinde public Firebase konfigürasyonunu tam olarak teyit eder.
 * 3. dist dosyalarında gizli anahtar / secret sızıntısı taraması yapar.
 * 4. Analiz kapısının (VITE_TABULAR_ANALYSIS_ENABLED) derlemede kapalı olduğunu doğrular.
 * 5. Yerel dist dosyalarının SHA-256 manifestini çıkarır.
 * 6. Canlı Netlify yayınında SPA rotalarını (/, /ornek-rapor, /ornek-rapor/musteri-deneyimi, /app/new-analysis, /app/history, /app/settings, /app/plan) HTTP 200/HTML olarak sınar.
 * 7. Canlı sitedeki index.html ve index varlıklarının (JS/CSS) SHA-256 hash'lerini yerel derleme manifesti ile karşılaştırır.
 */

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_PROJECT = "incagen-eeef4";
export const EXPECTED_AUTH_DOMAIN = "incagen-eeef4.firebaseapp.com";
export const EXPECTED_STORAGE_BUCKET_PATTERNS = ["incagen-eeef4.firebasestorage.app", "incagen-eeef4.appspot.com"];
export const DEFAULT_SITE_URL = "https://incagen.netlify.app";

export const SPA_ROUTES = [
  "/",
  "/ornek-rapor",
  "/ornek-rapor/musteri-deneyimi",
  "/app/new-analysis",
  "/app/history",
  "/app/settings",
  "/app/plan",
];

export const FORBIDDEN_SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /service_account/i,
  /AI_GATEWAY_TOKEN/i,
  /GEMINI_API_KEY/i,
  /client_secret/i,
  /ya29\.[0-9A-Za-z-_]{20,}/,
];

/**
 * Git çalışma ağacını kontrol eder; uncommitted dosya varsa reddeder, hash ve dal bilgisini döner.
 */
export function verifyGitStatus(options = {}) {
  const statusRaw = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  const commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const dirtyFiles = statusRaw ? statusRaw.split("\n").map(s => s.trim()) : [];
  const clean = dirtyFiles.length === 0;

  if (!clean && !options.allowDirty) {
    throw new Error(
      `Git çalışma ağacı kirli (${dirtyFiles.length} değiştirilmiş/izlenmeyen dosya). Yayın doğrulaması reddedildi.\n` +
      `Değişiklikleri commit edin veya yerel testler için --allow-dirty kullanın.\n` +
      dirtyFiles.map(f => `  - ${f}`).join("\n")
    );
  }

  return { clean, dirtyFiles, branch, commit };
}

/**
 * Verilen dizindeki tüm dosyaları özyinelemeli olarak toplar.
 */
export function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * dist altındaki tüm dosyaların göreli yolunu ve SHA-256 hash'ini hesaplar.
 */
export function calculateDistManifest(distDir = "dist") {
  assert.ok(existsSync(distDir), `Derleme dizini bulunamadı: ${distDir}`);
  const files = collectFiles(distDir);
  const manifest = {};
  for (const filePath of files) {
    const relPath = relative(distDir, filePath).replace(/\\/g, "/");
    const buffer = readFileSync(filePath);
    const hash = createHash("sha256").update(buffer).digest("hex");
    manifest[relPath] = hash;
  }
  return manifest;
}

/**
 * dist klasöründeki dosyaları tarayarak public Firebase ayarlarını, secret sızıntısızlığını
 * ve analiz kapısı durumunu doğrular.
 */
export function verifyDistDirectory(distDir = "dist") {
  assert.ok(existsSync(distDir), `Derleme dizini bulunamadı: ${distDir}`);
  const indexPath = join(distDir, "index.html");
  assert.ok(existsSync(indexPath), `index.html bulunamadı: ${indexPath}`);

  const files = collectFiles(distDir);
  const jsFiles = files.filter(f => f.endsWith(".js"));
  assert.ok(jsFiles.length > 0, "dist içinde JavaScript dosyası bulunamadı.");

  let foundProject = false;
  let foundAuthDomain = false;
  let foundStorageBucket = false;
  let foundApiKey = false;
  let leakedSecret = false;
  let leakedDetails = "";
  let tabularGateViolation = false;

  for (const file of jsFiles) {
    const content = readFileSync(file, "utf8");

    if (content.includes(EXPECTED_PROJECT)) {
      foundProject = true;
    }
    if (content.includes(EXPECTED_AUTH_DOMAIN)) {
      foundAuthDomain = true;
    }
    if (EXPECTED_STORAGE_BUCKET_PATTERNS.some(b => content.includes(b))) {
      foundStorageBucket = true;
    }
    if (/AIza[0-9A-Za-z-_]{35}/.test(content)) {
      foundApiKey = true;
    }

    // Tabular analiz kapısının derlemede true olarak açılmadığını garanti et
    if (/["']?VITE_TABULAR_ANALYSIS_ENABLED["']?\s*:\s*["']?true["']?/i.test(content)) {
      tabularGateViolation = true;
    }

    // Secret / hassas bilgi sızıntı kontrolü
    for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
      if (pattern.test(content)) {
        leakedSecret = true;
        leakedDetails = `Yasaklı kalıp eşleşti (${pattern}) dosyada: ${file}`;
        break;
      }
    }
    if (leakedSecret) break;
  }

  assert.ok(foundProject, `dist çıktısında beklenen Firebase proje kimliği (${EXPECTED_PROJECT}) bulunamadı.`);
  assert.ok(foundAuthDomain, `dist çıktısında beklenen authDomain (${EXPECTED_AUTH_DOMAIN}) bulunamadı.`);
  assert.ok(foundStorageBucket, `dist çıktısında beklenen storageBucket bulunamadı.`);
  assert.ok(foundApiKey, `dist çıktısında geçerli Firebase API anahtarı formatı bulunamadı.`);
  assert.ok(!tabularGateViolation, "dist çıktısında VITE_TABULAR_ANALYSIS_ENABLED=true tespit edildi! Analiz kapısı kapalı olmalıdır.");
  assert.ok(!leakedSecret, `dist çıktısında gizli bilgi sızıntısı tespit edildi! ${leakedDetails}`);

  return {
    fileCount: files.length,
    jsFileCount: jsFiles.length,
    firebaseProject: EXPECTED_PROJECT,
    authDomain: EXPECTED_AUTH_DOMAIN,
    storageBucketValid: true,
    apiKeyValid: true,
    tabularGateClosed: true,
    secretLeakClean: true,
  };
}

/**
 * Belirtilen URL'ye zaman aşımlı GET isteği yapar.
 */
export async function fetchWithTimeout(url, { timeoutMs = 10000, fetchFn = globalThis.fetch, ...options } = {}) {
  const signal = AbortSignal.timeout(timeoutMs);
  return await fetchFn(url, { signal, ...options });
}

/**
 * Canlı Netlify URL'sine HTTP istekleri yaparak SPA rotalarının (200 OK)
 * ve HTML içeriğinin döndüğünü doğrular.
 */
export async function verifyLiveRoutes(baseUrl = DEFAULT_SITE_URL, { timeoutMs = 10000, fetchFn = globalThis.fetch } = {}) {
  const results = [];
  for (const route of SPA_ROUTES) {
    const targetUrl = new URL(route, baseUrl).toString();
    try {
      const response = await fetchWithTimeout(targetUrl, { timeoutMs, fetchFn, redirect: "follow" });
      const status = response.status;
      const contentType = response.headers.get("content-type") || "";
      const isHtml = contentType.includes("text/html");
      assert.equal(status, 200, `${targetUrl} HTTP 200 dönmedi: ${status}`);
      assert.ok(isHtml, `${targetUrl} text/html dönmedi (${contentType}).`);
      results.push({ route, status, ok: true });
    } catch (err) {
      results.push({ route, error: err.message, ok: false });
      throw new Error(`Canlı SPA rota kontrolü başarısız (${route}): ${err.message}`);
    }
  }
  return results;
}

/**
 * Canlı sitedeki index.html ve index varlıklarının SHA-256 özetlerini yerel dist manifesti ile karşılaştırır.
 */
export async function verifyLiveAssets(baseUrl = DEFAULT_SITE_URL, manifest, { timeoutMs = 10000, fetchFn = globalThis.fetch } = {}) {
  assert.ok(manifest && typeof manifest === "object", "Yerel manifest nesnesi gerekli.");
  const indexUrl = new URL("/", baseUrl).toString();

  const response = await fetchWithTimeout(indexUrl, { timeoutMs, fetchFn, redirect: "follow" });
  assert.equal(response.status, 200, `Canlı index.html alınamadı: HTTP ${response.status}`);
  const liveIndexText = await response.text();
  const liveIndexHash = createHash("sha256").update(Buffer.from(liveIndexText, "utf8")).digest("hex");

  const localIndexHash = manifest["index.html"];
  assert.ok(localIndexHash, "Yerel manifestte index.html bulunamadı.");
  assert.equal(
    liveIndexHash,
    localIndexHash,
    `Canlı index.html hash uyuşmazlığı! Yerel: ${localIndexHash}, Canlı: ${liveIndexHash}. Canlı site güncel derleme ile senkronize değil!`
  );

  // Canlı index.html içindeki JS ve CSS varlık yollarını bul
  const scriptRegex = /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;
  const linkRegex = /<link\b[^>]*\bhref="([^"]+)"[^>]*>/gi;
  const assetPaths = new Set();

  let match;
  while ((match = scriptRegex.exec(liveIndexText)) !== null) {
    const src = match[1];
    if (src.startsWith("/assets/") || src.startsWith("assets/")) {
      assetPaths.add(src.replace(/^\//, ""));
    }
  }
  while ((match = linkRegex.exec(liveIndexText)) !== null) {
    const href = match[1];
    if (href.startsWith("/assets/") || href.startsWith("assets/")) {
      assetPaths.add(href.replace(/^\//, ""));
    }
  }

  assert.ok(assetPaths.size > 0, "Canlı index.html içinde /assets/ referansı bulunamadı.");

  const verifiedAssets = [];
  for (const assetPath of assetPaths) {
    const assetUrl = new URL(assetPath, baseUrl).toString();
    const assetRes = await fetchWithTimeout(assetUrl, { timeoutMs, fetchFn });
    assert.equal(assetRes.status, 200, `Canlı varlık indirilemedi: ${assetUrl} (HTTP ${assetRes.status})`);
    const arrayBuf = await assetRes.arrayBuffer();
    const liveAssetHash = createHash("sha256").update(Buffer.from(arrayBuf)).digest("hex");
    const localAssetHash = manifest[assetPath];

    assert.ok(localAssetHash, `Canlı index.html'deki varlık yerel manifestte bulunamadı: ${assetPath}`);
    assert.equal(
      liveAssetHash,
      localAssetHash,
      `Varlık hash uyuşmazlığı (${assetPath})! Yerel: ${localAssetHash}, Canlı: ${liveAssetHash}`
    );
    verifiedAssets.push({ path: assetPath, hash: liveAssetHash });
  }

  return {
    indexHash: liveIndexHash,
    verifiedAssets,
  };
}

/**
 * Ana doğrulama akışını yürütür.
 */
export async function runReleaseVerification(args = process.argv.slice(2)) {
  const isSkipLive = args.includes("--skip-live");
  const allowDirty = args.includes("--allow-dirty");
  const siteUrlArg = args.find(a => a.startsWith("--site-url="));
  const siteUrl = siteUrlArg ? siteUrlArg.split("=")[1] : (process.env.INCAGEN_SITE_URL || DEFAULT_SITE_URL);

  console.log("=== Incagen Yayın Doğrulama Başlıyor ===");

  // 1. Git durumu
  console.log("1. Git çalışma ağacı kontrol ediliyor...");
  const git = verifyGitStatus({ allowDirty });
  console.log(`   Branch: ${git.branch}, Commit: ${git.commit.slice(0, 8)}`);
  if (!git.clean) {
    console.warn(`   [!] UYARI: Çalışma ağacında ${git.dirtyFiles.length} commit edilmemiş dosya var (--allow-dirty ile devam edildi).`);
  } else {
    console.log("   [✓] Git çalışma ağacı temiz.");
  }

  // 2. dist ve manifest doğrulama
  console.log("2. dist derleme çıktısı ve güvenlik taraması yapılıyor...");
  const dist = verifyDistDirectory("dist");
  const manifest = calculateDistManifest("dist");
  console.log(`   [✓] ${dist.fileCount} dosya (${dist.jsFileCount} JS) tarandı.`);
  console.log(`   [✓] Public Firebase projesi (${dist.firebaseProject}), authDomain ve apiKey doğrulandı.`);
  console.log(`   [✓] Tablo analiz kapısı (VITE_TABULAR_ANALYSIS_ENABLED=false) doğrulandı.`);
  console.log("   [✓] Sır / API anahtarı sızıntı taraması temiz.");
  console.log(`   [✓] ${Object.keys(manifest).length} dosyalık yerel SHA-256 manifesti hesaplandı.`);

  // 3. Canlı site doğrulaması
  if (!isSkipLive) {
    console.log(`3. Canlı site SPA rotaları doğrulanıyor: ${siteUrl}...`);
    const routes = await verifyLiveRoutes(siteUrl);
    for (const r of routes) {
      console.log(`   [✓] ${r.route} -> HTTP ${r.status}`);
    }

    console.log("4. Canlı varlıklar ve SHA-256 manifest eşleşmesi doğrulanıyor...");
    const liveAssetCheck = await verifyLiveAssets(siteUrl, manifest);
    console.log(`   [✓] Canlı index.html hash eşleşmesi doğrulandı (${liveAssetCheck.indexHash.slice(0, 12)}).`);
    for (const asset of liveAssetCheck.verifiedAssets) {
      console.log(`   [✓] ${asset.path} -> SHA-256 eşleşti (${asset.hash.slice(0, 12)})`);
    }
  } else {
    console.log("3. [UYARI] Canlı site kontrolleri (--skip-live bayrağı nedeniyle) atlandı. Yalnızca yerel paket doğrulandı!");
  }

  console.log("=== Yayın Doğrulama Başarıyla Tamamlandı [✓] ===");
  return { git, dist, manifest };
}

// Betik doğrudan çağrıldığında çalıştır
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  runReleaseVerification().catch((error) => {
    console.error("\nYayın doğrulama hatası:", error.message || error);
    process.exit(1);
  });
}
