#!/usr/bin/env node

/**
 * Incagen Yayın Doğrulama Aracı Test Paketi
 *
 * `scripts/verify-release.mjs` aracının güvenlik, yaşam döngüsü, hash doğrulama
 * ve hata yakalama yeteneklerini negatif ve pozitif senaryolarla test eder.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  calculateDistManifest,
  EXPECTED_AUTH_DOMAIN,
  EXPECTED_PROJECT,
  FORBIDDEN_SECRET_PATTERNS,
  runReleaseVerification,
  SPA_ROUTES,
  verifyDistDirectory,
  verifyGitStatus,
  verifyLiveAssets,
  verifyLiveRoutes,
} from "./verify-release.mjs";

test("verifyGitStatus: --allow-dirty olmadan kirli ağaçta hata fırlatır", () => {
  // Eğer yerel çalışma ağacında uncommitted değişiklik varsa doğrudan test edilebilir
  try {
    const git = verifyGitStatus({ allowDirty: false });
    // Eğer ağaç tamamen temizse, en azından branch ve commit döndüğünü doğrula
    assert.ok(git.clean);
    assert.ok(git.commit);
  } catch (err) {
    assert.match(err.message, /Git çalışma ağacı kirli/);
  }

  // allowDirty: true verildiğinde hata fırlatmamalı
  const gitTolerant = verifyGitStatus({ allowDirty: true });
  assert.ok(typeof gitTolerant.clean === "boolean");
  assert.ok(gitTolerant.commit);
});

test("verifyDistDirectory: eksik dizin veya eksik index.html durumunda hata fırlatır", () => {
  assert.throws(
    () => verifyDistDirectory("non_existent_dist_dir_12345"),
    /Derleme dizini bulunamadı/
  );

  const tmp = mkdtempSync(join(tmpdir(), "incagen-dist-test-"));
  try {
    assert.throws(
      () => verifyDistDirectory(tmp),
      /index.html bulunamadı/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("verifyDistDirectory: Firebase yapılandırması eksikse hata fırlatır", () => {
  const tmp = mkdtempSync(join(tmpdir(), "incagen-dist-test-"));
  try {
    writeFileSync(join(tmp, "index.html"), "<html><body>Incagen</body></html>");
    mkdirSync(join(tmp, "assets"));
    // Proje kimliği eksik JS
    writeFileSync(
      join(tmp, "assets", "bundle.js"),
      `console.log("Firebase config yok");`
    );

    assert.throws(
      () => verifyDistDirectory(tmp),
      /beklenen Firebase proje kimliği/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("verifyDistDirectory: secret veya özel anahtar sızıntısında derlemeyi reddeder", () => {
  const tmp = mkdtempSync(join(tmpdir(), "incagen-dist-test-"));
  try {
    writeFileSync(join(tmp, "index.html"), "<html><body>Incagen</body></html>");
    mkdirSync(join(tmp, "assets"));
    // Geçerli config ama sızdırılmış private key
    writeFileSync(
      join(tmp, "assets", "bundle.js"),
      `
      const config = {
        projectId: "${EXPECTED_PROJECT}",
        authDomain: "${EXPECTED_AUTH_DOMAIN}",
        storageBucket: "incagen-eeef4.firebasestorage.app",
        apiKey: "AIzaSyB4oSne64yBl0sisvvFwgyv-hC-5yRx2m4"
      };
      const secret = "-----BEGIN RSA PRIVATE KEY-----MIIEowIBAAKCAQEA0...";
      `
    );

    assert.throws(
      () => verifyDistDirectory(tmp),
      /gizli bilgi sızıntısı tespit edildi/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("verifyDistDirectory: VITE_TABULAR_ANALYSIS_ENABLED=true aktifse reddeder", () => {
  const tmp = mkdtempSync(join(tmpdir(), "incagen-dist-test-"));
  try {
    writeFileSync(join(tmp, "index.html"), "<html><body>Incagen</body></html>");
    mkdirSync(join(tmp, "assets"));
    writeFileSync(
      join(tmp, "assets", "bundle.js"),
      `
      const config = {
        projectId: "${EXPECTED_PROJECT}",
        authDomain: "${EXPECTED_AUTH_DOMAIN}",
        storageBucket: "incagen-eeef4.firebasestorage.app",
        apiKey: "AIzaSyB4oSne64yBl0sisvvFwgyv-hC-5yRx2m4"
      };
      const env = { "VITE_TABULAR_ANALYSIS_ENABLED": "true" };
      `
    );

    assert.throws(
      () => verifyDistDirectory(tmp),
      /VITE_TABULAR_ANALYSIS_ENABLED=true tespit edildi/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("calculateDistManifest: doğru SHA-256 özetleri üretir", () => {
  const tmp = mkdtempSync(join(tmpdir(), "incagen-dist-test-"));
  try {
    writeFileSync(join(tmp, "index.html"), "<!doctype html>");
    mkdirSync(join(tmp, "assets"));
    writeFileSync(join(tmp, "assets", "app.js"), 'console.log("incagen");');

    const manifest = calculateDistManifest(tmp);
    const expectedHtmlHash = createHash("sha256").update("<!doctype html>").digest("hex");
    const expectedJsHash = createHash("sha256").update('console.log("incagen");').digest("hex");

    assert.equal(manifest["index.html"], expectedHtmlHash);
    assert.equal(manifest["assets/app.js"], expectedJsHash);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("verifyLiveRoutes: HTTP 404 veya HTML dışı yanıtta hata fırlatır", async () => {
  const mockFetch404 = async () => ({
    status: 404,
    headers: new Headers({ "content-type": "text/html" }),
  });

  await assert.rejects(
    () => verifyLiveRoutes("https://mock.test", { fetchFn: mockFetch404 }),
    /HTTP 200 dönmedi: 404/
  );

  const mockFetchNonHtml = async () => ({
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
  });

  await assert.rejects(
    () => verifyLiveRoutes("https://mock.test", { fetchFn: mockFetchNonHtml }),
    /text\/html dönmedi/
  );
});

test("verifyLiveRoutes: zaman aşımında (timeout) hata fırlatır", async () => {
  const mockTimeoutFetch = async (_url, { signal } = {}) => {
    return new Promise((_, reject) => {
      if (signal?.aborted) {
        reject(new Error("Zaman aşımı (The operation was aborted)"));
        return;
      }
      signal?.addEventListener(
        "abort",
        () => {
          reject(new Error("Zaman aşımı (The operation was aborted)"));
        },
        { once: true }
      );
    });
  };

  await assert.rejects(
    () => verifyLiveRoutes("https://mock.test", { timeoutMs: 15, fetchFn: mockTimeoutFetch }),
    /Zaman aşımı/
  );
});

test("verifyLiveAssets: hash uyuşmazlığında yayını reddeder", async () => {
  const localHtml = `<html><head><script src="/assets/main.js"></script></head></html>`;
  const manifest = {
    "index.html": createHash("sha256").update(localHtml).digest("hex"),
    "assets/main.js": createHash("sha256").update("console.log('local');").digest("hex"),
  };

  // Canlıda index.html farklı bir hash ile dönüyor
  const mockFetchMismatched = async (url) => {
    const urlStr = url.toString();
    if (urlStr.endsWith("/index.html") || urlStr.endsWith("/")) {
      return {
        status: 200,
        text: async () => `<html><head><script src="/assets/main.js"></script><body>Farklı</body></html>`,
      };
    }
    return {
      status: 200,
      arrayBuffer: async () => Buffer.from("console.log('local');"),
    };
  };

  await assert.rejects(
    () => verifyLiveAssets("https://mock.test", manifest, { fetchFn: mockFetchMismatched }),
    /Canlı index.html hash uyuşmazlığı/
  );

  // Canlı index.html eşleşiyor ama JS bundle'ı uyuşmuyor
  const mockFetchJsMismatch = async (url) => {
    const urlStr = url.toString();
    if (urlStr.endsWith("/index.html") || urlStr.endsWith("/")) {
      return {
        status: 200,
        text: async () => localHtml,
      };
    }
    return {
      status: 200,
      arrayBuffer: async () => Buffer.from("console.log('remote tampered');"),
    };
  };

  await assert.rejects(
    () => verifyLiveAssets("https://mock.test", manifest, { fetchFn: mockFetchJsMismatch }),
    /Varlık hash uyuşmazlığı/
  );
});

test("verifyLiveAssets: yerel manifest ile birebir eşleştiğinde başarıyla doğrular", async () => {
  const localHtml = `<!doctype html><html><head><script src="/assets/main.js"></script><link href="/assets/style.css"></head></html>`;
  const jsContent = "console.log('verified');";
  const cssContent = "body { color: purple; }";

  const manifest = {
    "index.html": createHash("sha256").update(Buffer.from(localHtml, "utf8")).digest("hex"),
    "assets/main.js": createHash("sha256").update(Buffer.from(jsContent, "utf8")).digest("hex"),
    "assets/style.css": createHash("sha256").update(Buffer.from(cssContent, "utf8")).digest("hex"),
  };

  const mockFetchSuccess = async (url) => {
    const urlStr = url.toString();
    if (urlStr.endsWith("/index.html") || urlStr.endsWith("/")) {
      return {
        status: 200,
        text: async () => localHtml,
      };
    }
    if (urlStr.endsWith("assets/main.js")) {
      return {
        status: 200,
        arrayBuffer: async () => Buffer.from(jsContent, "utf8"),
      };
    }
    if (urlStr.endsWith("assets/style.css")) {
      return {
        status: 200,
        arrayBuffer: async () => Buffer.from(cssContent, "utf8"),
      };
    }
    throw new Error(`Bilinmeyen mock url: ${urlStr}`);
  };

  const result = await verifyLiveAssets("https://mock.test", manifest, { fetchFn: mockFetchSuccess });
  assert.equal(result.verifiedAssets.length, 2);
  assert.equal(result.indexHash, manifest["index.html"]);
});
