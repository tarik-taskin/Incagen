import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectCiEvidence, isAllowedPublicScreenshot, sanitizeErrorSummary } from "./collect-ci-evidence.mjs";

test("sanitizeErrorSummary redacts bearer tokens, API keys, emails, PEM blocks and truncates long payloads", () => {
  const mockApiKey = ["AIzaSy", "MockKey123456789012345"].join("");
  const pemBegin = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  const pemEnd = ["-----END ", "PRIVATE KEY-----"].join("");
  const raw = `Failed request Authorization: Bearer secretToken123 with apiKey=${mockApiKey} user=test@example.test ${pemBegin}abc${pemEnd} ` + "x".repeat(500);
  const safe = sanitizeErrorSummary(raw);
  assert.doesNotMatch(safe, /secretToken123|MockKey123456789012345|test@example\.test|PRIVATE KEY/);
  assert.match(safe, /\[REDACTED\]/);
  assert.ok(safe.length <= 400);
});

test("collectCiEvidence enforces strict public allowlist and never copies auth/trace/env/storageState/private screenshots", () => {
  const dir = mkdtempSync(join(tmpdir(), "incagen-ci-evidence-"));
  try {
    const rawResults = join(dir, "test-results");
    const outDir = join(dir, "ci-evidence");
    mkdirSync(rawResults, { recursive: true });

    // 1. İzinli public spec ekran görüntüsü
    const publicPng = join(rawResults, "public-fail.png");
    writeFileSync(publicPng, "png-bytes");

    // 2. İzin dışı: kullanıcı oturumu / tablo analizi ekran görüntüsü
    const privatePng = join(rawResults, "private-tabular-fail.png");
    writeFileSync(privatePng, "sensitive-user-doc-bytes");

    // 3. İzin dışı dosyalar: trace.zip, storageState.json, .env, firebase-debug.log, symlink
    const traceZip = join(rawResults, "trace.zip");
    const envFile = join(rawResults, ".env");
    const storageState = join(rawResults, "storageState.json");
    const debugLog = join(rawResults, "firebase-debug.log");
    const symlinkPng = join(rawResults, "linked.png");
    writeFileSync(traceZip, "zip");
    writeFileSync(envFile, "SECRET=1");
    writeFileSync(storageState, "{}");
    writeFileSync(debugLog, "debug");
    symlinkSync(publicPng, symlinkPng);

    const exampleTitle = "hareketli raporda filtre, kaynak sekmeleri ve indirme kullanılabilir kalır";
    assert.equal(isAllowedPublicScreenshot(publicPng, "e2e/example-report.spec.ts", exampleTitle, rawResults), true);
    assert.equal(isAllowedPublicScreenshot(publicPng, "e2e/example-report.spec.ts"), false);
    assert.equal(isAllowedPublicScreenshot(privatePng, "e2e/tabular-analysis.spec.ts", "kullanıcı belgesi testi", rawResults), false);
    assert.equal(isAllowedPublicScreenshot(traceZip, "e2e/example-report.spec.ts", exampleTitle, rawResults), false);
    assert.equal(isAllowedPublicScreenshot(envFile, "e2e/example-report.spec.ts", exampleTitle, rawResults), false);
    assert.equal(isAllowedPublicScreenshot(storageState, "e2e/example-report.spec.ts", exampleTitle, rawResults), false);
    assert.equal(isAllowedPublicScreenshot(debugLog, "e2e/example-report.spec.ts", exampleTitle, rawResults), false);
    assert.equal(isAllowedPublicScreenshot(symlinkPng, "e2e/example-report.spec.ts", exampleTitle, rawResults), false);

    const playwrightReport = {
      suites: [{
        file: "e2e/example-report.spec.ts",
        specs: [{
          title: exampleTitle,
          tests: [{
            projectName: "desktop-chromium",
            status: "unexpected",
            results: [{
              status: "failed",
              error: { message: "Expected heading visible, Bearer secret-999 not allowed" },
              attachments: [
                { name: "screenshot", contentType: "image/png", path: publicPng },
                { name: "trace", contentType: "application/zip", path: traceZip },
              ],
            }],
          }],
        }],
      }, {
        file: "e2e/tabular-analysis.spec.ts",
        specs: [{
          title: "kullanıcı belgesi testi",
          tests: [{
            projectName: "mobile-chromium",
            status: "unexpected",
            results: [{
              status: "failed",
              error: { message: `Timeout waiting for report; token=${["ya29.", "AbCdEfGhIjKlMnOpQrStUvWxYz"].join("")}` },
              attachments: [
                { name: "screenshot", contentType: "image/png", path: privatePng },
              ],
            }],
          }],
        }],
      }],
    };

    const reportPath = join(dir, "playwright-report.json");
    writeFileSync(reportPath, JSON.stringify(playwrightReport), "utf8");

    const summary = collectCiEvidence({
      failedStep: "browser",
      playwrightJsonPath: reportPath,
      resultsDir: rawResults,
      outDir,
    });

    assert.equal(summary.failedStep, "browser");
    assert.equal(summary.failureCount, 2);
    assert.equal(summary.publicScreenshotCount, 1);

    const copiedDir = join(outDir, "public-screenshots");
    const copiedNames = readdirSync(copiedDir);
    assert.equal(copiedNames.length, 1);
    assert.match(copiedNames[0], /^public-\d+\.png$/);

    // Gizli veya izin dışı hiçbir dosya çıktı dizinine girmemeli
    assert.equal(existsSync(join(outDir, "trace.zip")), false);
    assert.equal(existsSync(join(outDir, ".env")), false);
    const summaryJsonText = readFileSync(join(outDir, "summary.json"), "utf8");
    const summaryMdText = readFileSync(join(outDir, "summary.md"), "utf8");
    assert.doesNotMatch(summaryJsonText, /secret-999|AbCdEfGhIjKlMnOpQrStUvWxYz/);
    assert.match(summaryMdText, /desktop-chromium/);
    assert.match(summaryMdText, /mobile-chromium/);
    assert.match(summaryMdText, /kapsam dışı \/ yok/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collectCiEvidence blocks mixed auth specs/report.spec.ts, traversal/parent symlinks, stale files, and redacts JSON/multiline secrets across all fields", () => {
  const dir = mkdtempSync(join(tmpdir(), "incagen-ci-evidence-neg-"));
  try {
    const rawResults = join(dir, "test-results");
    const outDir = join(dir, "ci-evidence");
    const outsideDir = join(dir, "outside-results");
    const freshDir = join(dir, "new-evidence");
    mkdirSync(rawResults, { recursive: true });
    mkdirSync(join(outDir, "public-screenshots"), { recursive: true });
    mkdirSync(outsideDir, { recursive: true });

    // Dolu dizin silinmez ve yayın girdisi olarak kullanılmaz.
    writeFileSync(join(outDir, "stale-leak.txt"), "old-secret-leak");
    writeFileSync(join(outDir, "public-screenshots", "stale.png"), "old-png");

    // Parent dizin symlink / path traversal tuzağı
    const secretOutsidePng = join(outsideDir, "outside.png");
    writeFileSync(secretOutsidePng, "outside-secret-bytes");
    const linkedSubdir = join(rawResults, "linked-subdir");
    symlinkSync(outsideDir, linkedSubdir);
    const traversedPng = join(linkedSubdir, "outside.png");

    // Karışık dosyadaki (layout-and-entry.spec.ts) auth senaryosu reddedilmeli, public senaryo kabul edilmeli
    const authScenarioPng = join(rawResults, "auth-scenario.png");
    const publicLayoutPng = join(rawResults, "public-layout.png");
    const reportSpecPng = join(rawResults, "report-spec.png");
    writeFileSync(authScenarioPng, "auth-bytes");
    writeFileSync(publicLayoutPng, "public-layout-bytes");
    writeFileSync(reportSpecPng, "report-spec-bytes");

    assert.equal(
      isAllowedPublicScreenshot(traversedPng, "e2e/example-report.spec.ts", "hareketli raporda filtre, kaynak sekmeleri ve indirme kullanılabilir kalır", rawResults),
      false
    );
    assert.equal(isAllowedPublicScreenshot(reportSpecPng, "e2e/report.spec.ts", "kayıt, belge hazırlığı, geçmiş, silme ve çıkış", rawResults), false);
    assert.equal(
      isAllowedPublicScreenshot(authScenarioPng, "e2e/layout-and-entry.spec.ts", "ana sayfa alt çağrısı, üst çağrı, plan, rapor ve aktif navigasyon analizi baştan açar", rawResults),
      false
    );
    assert.equal(
      isAllowedPublicScreenshot(publicLayoutPng, "e2e/layout-and-entry.spec.ts", "iki örnek aynı başlık, sekme ve içerik eksenini kullanır; landing görsel önizleme yüklemez", rawResults),
      true
    );

    const playwrightReport = {
      suites: [{
        file: "e2e/layout-and-entry.spec.ts",
        specs: [{
          title: "iki örnek aynı başlık, sekme ve içerik eksenini kullanır; landing görsel önizleme yüklemez",
          tests: [{
            projectName: "desktop-chromium",
            status: "unexpected",
            results: [{
              status: "failed",
              error: { message: 'Response body {"password":"JsonPassword999","token":"Multi\nLineSecret888"}' },
              attachments: [{ name: "screenshot", contentType: "image/png", path: publicLayoutPng }],
            }],
          }],
        }, {
          title: "ana sayfa alt çağrısı, üst çağrı, plan, rapor ve aktif navigasyon analizi baştan açar",
          tests: [{
            projectName: "project secret=LeakProj777",
            status: "unexpected",
            results: [{
              status: "failed",
              error: { message: "Unexpected opaque payload without standard prefix" },
              attachments: [{ name: "screenshot", contentType: "image/png", path: authScenarioPng }],
            }],
          }],
        }],
      }, {
        file: "e2e/report.spec.ts",
        specs: [{
          title: "rapor yükleme token=LeakTitle555",
          tests: [{
            projectName: "chromium",
            status: "unexpected",
            results: [{
              status: "failed",
              error: { message: "Expect comparison to pass\nReceived: Example Company (synthetic fixture)" },
              attachments: [
                { name: "screenshot", contentType: "image/png", path: reportSpecPng },
                { name: "screenshot", contentType: "image/png", path: traversedPng },
              ],
            }],
          }],
        }],
      }],
    };

    const reportPath = join(dir, "playwright-report.json");
    writeFileSync(reportPath, JSON.stringify(playwrightReport), "utf8");

    assert.throws(() => collectCiEvidence({ outDir }), /boş bir dizin/);
    assert.equal(existsSync(join(outDir, "stale-leak.txt")), true);
    assert.equal(isAllowedPublicScreenshot(publicLayoutPng, "layout-and-entry.spec.ts",
      "iki örnek aynı başlık, sekme ve içerik eksenini kullanır; landing görsel önizleme yüklemez"), false);
    const summary = collectCiEvidence({
      failedStep: 'browser {"secret":"StepSecret444"}',
      playwrightJsonPath: reportPath,
      resultsDir: rawResults,
      outDir: freshDir,
    });

    assert.equal(existsSync(join(freshDir, "stale-leak.txt")), false);
    assert.equal(existsSync(join(freshDir, "public-screenshots", "stale.png")), false);
    assert.equal(summary.publicScreenshotCount, 1);
    const copiedNames = readdirSync(join(freshDir, "public-screenshots"));
    assert.deepEqual(copiedNames, ["public-1.png"]);

    const summaryJsonText = readFileSync(join(freshDir, "summary.json"), "utf8");
    const summaryMdText = readFileSync(join(freshDir, "summary.md"), "utf8");
    const combined = `${summaryJsonText}\n${summaryMdText}`;
    assert.match(combined, /Test beklentisi karşılanmadı/);
    assert.doesNotMatch(combined, /JsonPassword999|Multi\nLineSecret888|LineSecret888|LeakProj777|LeakTitle555|StepSecret444|Unexpected opaque payload|Example Company/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
