import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Yalnız kullanıcı oturumu, gerçek/sentetik yüklenmiş belge veya kimlik bilgisi taşımayan public örnek/tema specleri.
export const PUBLIC_SCREENSHOT_SPECS = new Set([
  "example-report.spec.ts",
  "glass-surfaces.spec.ts",
  "layout-and-entry.spec.ts",
  "report-responsive.spec.ts",
  "report-tables.spec.ts",
  "report.spec.ts",
  "startup-and-report-links.spec.ts",
  "theme.spec.ts",
]);

const FORBIDDEN_FILE_PATTERNS = /(\.env|storageState|firebase-debug|trace\.zip|secret|token|credential|auth-state|\.json$|\.log$|\.txt$|\.har$)/i;
const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".webp"]);
const MAX_PUBLIC_SCREENSHOTS = 10;
const MAX_ERROR_LENGTH = 400;

// Ham hata veya yığın metnindeki token, anahtar, Authorization başlığı ve e-posta gibi hassas kalıpları sansürler.
export function sanitizeErrorSummary(message) {
  if (typeof message !== "string" || !message.trim()) return "Ayrıntısız test hatası.";
  const cleaned = message
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/(Authorization|apiKey|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_KEY]")
    .replace(/ya29\.[0-9A-Za-z_-]{15,}/g, "[REDACTED_TOKEN]")
    .replace(/ghp_[0-9A-Za-z]{20,}/g, "[REDACTED_GH_TOKEN]")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PEM]")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > MAX_ERROR_LENGTH ? `${cleaned.slice(0, MAX_ERROR_LENGTH - 3)}...` : cleaned;
}

// Playwright JSON rapor ağacından başarısız veya beklenmeyen testleri özyinelemeli toplar.
function extractFailedTests(suites, inheritedFile = "", results = []) {
  if (!Array.isArray(suites)) return results;
  for (const suite of suites) {
    const file = suite.file || inheritedFile;
    if (Array.isArray(suite.specs)) {
      for (const spec of suite.specs) {
        const specFile = spec.file || file;
        for (const testEntry of spec.tests ?? []) {
          const lastResult = testEntry.results?.[testEntry.results.length - 1];
          const isFailed = testEntry.status === "unexpected" || testEntry.status === "flaky"
            || lastResult?.status === "failed" || lastResult?.status === "timedOut";
          if (!isFailed) continue;
          const rawError = lastResult?.error?.message ?? lastResult?.errors?.[0]?.message ?? "";
          const attachments = (lastResult?.attachments ?? []).map(att => ({
            name: String(att.name ?? ""),
            contentType: String(att.contentType ?? ""),
            path: typeof att.path === "string" ? att.path : "",
          }));
          results.push({
            title: String(spec.title ?? "Adsız test"),
            file: basename(specFile || "unknown"),
            projectName: String(testEntry.projectName ?? "unknown"),
            status: String(lastResult?.status ?? testEntry.status ?? "failed"),
            safeError: sanitizeErrorSummary(rawError),
            attachments,
          });
        }
      }
    }
    if (Array.isArray(suite.suites)) {
      extractFailedTests(suite.suites, file, results);
    }
  }
  return results;
}

// Dosya adının yalnız public örnek allowlist'ine ait düzenli bir görsel olup olmadığını doğrular.
export function isAllowedPublicScreenshot(filePath, specFile) {
  if (!filePath || !existsSync(filePath)) return false;
  let stat;
  try {
    stat = lstatSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return false;
  const ext = extname(filePath).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) return false;
  if (FORBIDDEN_FILE_PATTERNS.test(filePath)) return false;
  return PUBLIC_SCREENSHOT_SPECS.has(basename(specFile || ""));
}

// Başarısız CI koşularında yalnız güvenli metin özetini ve allowlist'teki public örnek görsellerini toplar.
export function collectCiEvidence(options = {}) {
  const failedStep = String(options.failedStep || "unknown");
  const outDir = resolve(options.outDir || "ci-evidence");
  const playwrightJsonPath = options.playwrightJsonPath ? resolve(options.playwrightJsonPath) : null;
  const screenshotsOutDir = join(outDir, "public-screenshots");

  mkdirSync(outDir, { recursive: true, mode: 0o755 });

  let failures = [];
  let reportParsed = false;
  if (playwrightJsonPath && existsSync(playwrightJsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(playwrightJsonPath, "utf8"));
      failures = extractFailedTests(parsed.suites ?? []);
      reportParsed = true;
    } catch {
      failures = [];
    }
  }

  let copiedCount = 0;
  const copiedFiles = [];
  const enrichedFailures = failures.map(failure => {
    let copiedScreenshot = null;
    if (copiedCount < MAX_PUBLIC_SCREENSHOTS) {
      const imageAttachment = failure.attachments.find(att =>
        att.contentType.startsWith("image/") && isAllowedPublicScreenshot(att.path, failure.file)
      );
      if (imageAttachment) {
        mkdirSync(screenshotsOutDir, { recursive: true, mode: 0o755 });
        const safeName = `${copiedCount + 1}-${failure.projectName}-${failure.file.replace(/[^a-zA-Z0-9._-]/g, "_")}${extname(imageAttachment.path).toLowerCase()}`;
        const dest = join(screenshotsOutDir, safeName);
        copyFileSync(imageAttachment.path, dest);
        copiedCount += 1;
        copiedScreenshot = `public-screenshots/${safeName}`;
        copiedFiles.push(copiedScreenshot);
      }
    }
    return {
      title: failure.title,
      file: failure.file,
      projectName: failure.projectName,
      status: failure.status,
      failedStep,
      safeError: failure.safeError,
      publicScreenshot: copiedScreenshot,
    };
  });

  // Ek olarak resultsDir içinde sahipsiz bırakılmış public spec görselleri varsa yalnız allowlist sınırıyla kontrol et.
  if (options.resultsDir && existsSync(options.resultsDir) && copiedCount === 0 && !reportParsed) {
    const entries = readdirSync(options.resultsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (copiedCount >= MAX_PUBLIC_SCREENSHOTS) break;
      if (!entry.isDirectory()) continue;
      const matchedSpec = [...PUBLIC_SCREENSHOT_SPECS].find(spec => entry.name.includes(spec.replace(".spec.ts", "")));
      if (!matchedSpec) continue;
      const subDir = join(options.resultsDir, entry.name);
      for (const file of readdirSync(subDir)) {
        if (copiedCount >= MAX_PUBLIC_SCREENSHOTS) break;
        const candidatePath = join(subDir, file);
        if (isAllowedPublicScreenshot(candidatePath, matchedSpec)) {
          mkdirSync(screenshotsOutDir, { recursive: true, mode: 0o755 });
          const safeName = `${copiedCount + 1}-${entry.name.replace(/[^a-zA-Z0-9._-]/g, "_")}-${basename(file)}`;
          copyFileSync(candidatePath, join(screenshotsOutDir, safeName));
          copiedCount += 1;
          copiedFiles.push(`public-screenshots/${safeName}`);
        }
      }
    }
  }

  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    failedStep,
    reportParsed,
    failureCount: enrichedFailures.length,
    publicScreenshotCount: copiedFiles.length,
    publicScreenshotSpecsAllowlist: [...PUBLIC_SCREENSHOT_SPECS],
    copiedFiles,
    failures: enrichedFailures,
  };

  const lines = [
    "## Incagen CI Güvenli Hata Özeti",
    "",
    `- **Başarısız adım:** \`${failedStep}\``,
    `- **Playwright raporu okundu:** ${reportParsed ? "evet" : "hayır"}`,
    `- **Tespit edilen tarayıcı hatası:** ${enrichedFailures.length}`,
    `- **İzinli public örnek görseli:** ${copiedFiles.length}`,
    "",
  ];
  if (enrichedFailures.length > 0) {
    lines.push("| Proje | Dosya | Senaryo | Güvenli Hata Özeti | Public Görsel |", "|---|---|---|---|---|");
    for (const item of enrichedFailures) {
      lines.push(`| ${item.projectName} | ${item.file} | ${item.title} | ${item.safeError.replace(/\|/g, "/")} | ${item.publicScreenshot ?? "kapsam dışı / yok"} |`);
    }
  } else {
    lines.push("Tarayıcı raporu hatası kaydedilmedi veya adım Playwright öncesinde başarısız oldu.");
  }

  writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
  writeFileSync(join(outDir, "summary.md"), lines.join("\n") + "\n", "utf8");
  return summary;
}

function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--") && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const args = parseCliArgs(process.argv.slice(2));
  const summary = collectCiEvidence({
    failedStep: args["failed-step"],
    playwrightJsonPath: args["playwright-json"],
    resultsDir: args["results-dir"],
    outDir: args["out-dir"] || "ci-evidence",
  });
  console.log(JSON.stringify({ failedStep: summary.failedStep, failureCount: summary.failureCount, publicScreenshotCount: summary.publicScreenshotCount }));
}
