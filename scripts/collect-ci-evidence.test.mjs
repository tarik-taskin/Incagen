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

    assert.equal(isAllowedPublicScreenshot(publicPng, "e2e/example-report.spec.ts"), true);
    assert.equal(isAllowedPublicScreenshot(privatePng, "e2e/tabular-analysis.spec.ts"), false);
    assert.equal(isAllowedPublicScreenshot(traceZip, "e2e/example-report.spec.ts"), false);
    assert.equal(isAllowedPublicScreenshot(envFile, "e2e/example-report.spec.ts"), false);
    assert.equal(isAllowedPublicScreenshot(storageState, "e2e/example-report.spec.ts"), false);
    assert.equal(isAllowedPublicScreenshot(debugLog, "e2e/example-report.spec.ts"), false);
    assert.equal(isAllowedPublicScreenshot(symlinkPng, "e2e/example-report.spec.ts"), false);

    const playwrightReport = {
      suites: [{
        file: "e2e/example-report.spec.ts",
        specs: [{
          title: "örnek rapor dönemi değişir",
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
    assert.match(copiedNames[0], /example-report\.spec\.ts\.png$/);

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
