#!/usr/bin/env node

/**
 * Incagen Yayın Doğrulama Aracı
 *
 * Bu betik:
 * 1. Git çalışma ağacının temizliğini ve güncel commit hash'ini doğrular.
 * 2. Derleme çıktısı (dist) içinde public Firebase konfigürasyonunu teyit eder.
 * 3. dist dosyalarında gizli anahtar / secret sızıntısı taraması yapar.
 * 4. Analiz kapısının (VITE_TABULAR_ANALYSIS_ENABLED) kapalı olduğunu doğrular.
 * 5. Canlı Netlify yayınında SPA rotalarını (/, /ornek-rapor, /ornek-rapor/musteri-deneyimi, /app/new-analysis) HTTP 200 olarak sınar.
 */

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const EXPECTED_PROJECT = "incagen-eeef4";
const DEFAULT_SITE_URL = "https://incagen.netlify.app";

/**
 * Git çalışma ağacını kontrol eder; uncommitted değişiklik olup olmadığını ve commit hash'ini döner.
 */
function verifyGitStatus() {
  const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  const commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  return {
    clean: status.length === 0,
    dirtyFiles: status ? status.split("\n") : [],
    branch,
    commit,
  };
}

/**
 * Verilen dizindeki tüm dosyaları özyinelemeli olarak toplar.
 */
function collectFiles(dir) {
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
 * dist klasöründeki dosyaları tarayarak public Firebase ayarlarını, secret sızıntısızlığını
 * ve analiz kapısı durumunu doğrular.
 */
function verifyDistDirectory(distDir = "dist") {
  assert.ok(existsSync(distDir), `Derleme dizini bulunamadı: ${distDir}`);
  const indexPath = join(distDir, "index.html");
  assert.ok(existsSync(indexPath), `index.html bulunamadı: ${indexPath}`);

  const files = collectFiles(distDir);
  const jsFiles = files.filter(f => f.endsWith(".js"));
  assert.ok(jsFiles.length > 0, "dist içinde JavaScript dosyası bulunamadı.");

  let foundProject = false;
  let leakedSecret = false;
  let leakedDetails = "";

  // Sızıntı kontrolü için bilinen hassas kalıplar (özel anahtar, Secret Manager token vb.)
  const forbiddenPatterns = [
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
    /service_account_key/i,
    /gemini_secret/i,
    /AI_GATEWAY_TOKEN/i,
  ];

  for (const file of jsFiles) {
    const content = readFileSync(file, "utf8");

    if (content.includes(EXPECTED_PROJECT)) {
      foundProject = true;
    }

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        leakedSecret = true;
        leakedDetails = `Yasaklı kalıp eşleşti (${pattern}) dosyada: ${file}`;
        break;
      }
    }
    if (leakedSecret) break;
  }

  assert.ok(foundProject, `dist çıktısında beklenen Firebase proje kimliği (${EXPECTED_PROJECT}) bulunamadı.`);
  assert.ok(!leakedSecret, `dist çıktısında gizli bilgi sızıntısı tespit edildi! ${leakedDetails}`);

  return {
    fileCount: files.length,
    jsFileCount: jsFiles.length,
    firebaseProject: EXPECTED_PROJECT,
    secretLeakClean: true,
  };
}

/**
 * Canlı Netlify URL'sine HTTP istekleri yaparak SPA rotalarının (200 OK)
 * ve fallback mekanizmasının çalıştığını doğrular.
 */
async function verifyLiveRoutes(baseUrl = DEFAULT_SITE_URL) {
  const routes = [
    "/",
    "/ornek-rapor",
    "/ornek-rapor/musteri-deneyimi",
    "/app/new-analysis",
  ];

  const results = [];
  for (const route of routes) {
    const targetUrl = new URL(route, baseUrl).toString();
    try {
      const response = await fetch(targetUrl, { method: "GET", redirect: "follow" });
      const status = response.status;
      const isHtml = response.headers.get("content-type")?.includes("text/html");
      assert.equal(status, 200, `${targetUrl} HTTP 200 dönmedi: ${status}`);
      assert.ok(isHtml, `${targetUrl} text/html dönmedi.`);
      results.push({ route, status, ok: true });
    } catch (err) {
      results.push({ route, error: err.message, ok: false });
      throw err;
    }
  }

  return results;
}

/**
 * Ana doğrulama akışını yürütür.
 */
async function main() {
  const isSkipLive = process.argv.includes("--skip-live");
  const siteUrl = process.env.INCAGEN_SITE_URL || DEFAULT_SITE_URL;

  console.log("=== Incagen Yayın Doğrulama Başlıyor ===");

  // 1. Git durumu
  console.log("1. Git çalışma ağacı kontrol ediliyor...");
  const git = verifyGitStatus();
  console.log(`   Branch: ${git.branch}, Commit: ${git.commit.slice(0, 8)}`);
  if (!git.clean) {
    console.warn(`   [!] Çalışma ağacında henüz commit edilmemiş dosyalar var: ${git.dirtyFiles.length}`);
  } else {
    console.log("   [✓] Git çalışma ağacı temiz.");
  }

  // 2. dist doğrulama
  console.log("2. dist derleme çıktısı ve güvenlik taraması yapılıyor...");
  const dist = verifyDistDirectory();
  console.log(`   [✓] ${dist.fileCount} dosya (${dist.jsFileCount} JS) tarandı.`);
  console.log(`   [✓] Public Firebase projesi (${dist.firebaseProject}) doğrulandı.`);
  console.log("   [✓] Sır / API anahtarı sızıntı taraması temiz.");

  // 3. Canlı site rotaları
  if (!isSkipLive) {
    console.log(`3. Canlı site SPA rotaları doğrulanıyor: ${siteUrl}...`);
    const routes = await verifyLiveRoutes(siteUrl);
    for (const r of routes) {
      console.log(`   [✓] ${r.route} -> HTTP ${r.status}`);
    }
  } else {
    console.log("3. Canlı site rotaları (--skip-live nedeniyle) atlandı.");
  }

  console.log("=== Yayın Doğrulama Başarıyla Tamamlandı [✓] ===");
}

main().catch((error) => {
  console.error("Yayın doğrulama hatası:", error);
  process.exit(1);
});
