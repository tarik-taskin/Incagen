import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Yalnız kullanıcı oturumu, belge yükleme veya kimlik bilgisi içermediği tek tek doğrulanmış (dosya, test başlığı) çiftleri.
export const PUBLIC_SCREENSHOT_ALLOWLIST = new Map([
  ["example-report.spec.ts", new Set([
    "şirket raporu grafikleri, tabloları ve büyük kaynak aramasını aynı kapsamda tutar",
    "hareketli raporda filtre, kaynak sekmeleri ve indirme kullanılabilir kalır",
    "Excel, sunum ve yapılandırılmış metin kaynakları özgün formatlarında açılır",
    "örnek raporda bağlantıyı kopyala mevcut görünümü korur ve tarayıcı geçmişini bozmaz",
    "bekleyen pano işlemi rapor değişiminde yeni görünümü etkilemez",
    "aynı adreste kaydırma gözlemcisi değişince bekleyen kopyalama tamamlanır",
    "yavaş görünüm güncellemesinde yeni adresin gerçek pano bildirimi korunur",
  ])],
  ["glass-surfaces.spec.ts", new Set([
    "landing, giriş ve yardım dört görünümde okunur; azaltılmış saydamlık cam efektini kapatır",
  ])],
  ["layout-and-entry.spec.ts", new Set([
    "iki örnek aynı başlık, sekme ve içerik eksenini kullanır; landing görsel önizleme yüklemez",
    "örnek rapor sekmelerinden geri doğrudan ana sayfaya, ileri son örneğe döner",
  ])],
  ["report-responsive.spec.ts", new Set([
    "rapor mobil çevirileri sans-serif fontuyla taşmaz",
    "rapor mobil çevirileri monospace fontuyla taşmaz",
  ])],
  ["report-tables.spec.ts", new Set([
    "finansal tablolar sütuna göre sıralanır, sırayı duyurur ve kaynak sırasına döner",
  ])],
  ["startup-and-report-links.spec.ts", new Set([
    "ana sayfa çalışma alanı kodu olmadan açılır; ilk açılan yardım gönderilmemiş metni korur",
    "rapor bölüm adresleri doğrudan açılır; dönem, yeniden açma ve geri/ileri doğru bölümü korur",
  ])],
  ["tabular-analysis.spec.ts", new Set([
    "iki örnek raporda kısa keşif rehberi isteğe bağlı ve klavyeyle erişilebilirdir",
  ])],
  ["theme.spec.ts", new Set([
    "tema menüsü dört mod/görünüm kombinasyonunda erişilebilir ve seçim kalıcıdır",
    "tema ve dil menüleri klavyeyle kullanılır; Arapçada liste sağdan hizalanır",
  ])],
]);

export const PUBLIC_SCREENSHOT_SPECS = new Set(PUBLIC_SCREENSHOT_ALLOWLIST.keys());

const FORBIDDEN_FILE_PATTERNS = /(\.env|storageState|firebase-debug|trace\.zip|secret|token|credential|auth-state|\.json$|\.log$|\.txt$|\.har$)/i;
const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".webp"]);
const SAFE_ERROR_CLASSES = /^(Error:\s*)?(Timed out|TimeoutError|Test timeout|Expect(?:ed)?\b|page\.|locator\.|net::ERR_)/i;
const MAX_PUBLIC_SCREENSHOTS = 10;
const MAX_ERROR_LENGTH = 400;

// Metindeki JSON quoted, key=value, çok satırlı gizli değer, token, anahtar ve e-posta kalıplarını sansürler.
function redactSecrets(text, fallback = "") {
  if (typeof text !== "string" || !text.trim()) return fallback;
  return text
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/"(Authorization|apiKey|token|password|secret|credential|cookie|session)"\s*:\s*"(?:\\.|[^"])*"/gi, '"$1":"[REDACTED]"')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(Authorization|apiKey|token|password|secret|credential)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1=[REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_KEY]")
    .replace(/ya29\.[0-9A-Za-z_-]{15,}/g, "[REDACTED_TOKEN]")
    .replace(/ghp_[0-9A-Za-z]{20,}/g, "[REDACTED_GH_TOKEN]")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PEM]")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Ham hata veya yığın metnindeki tüm gizli kalıpları sansürler ve uzunluğu sınırlar.
export function sanitizeErrorSummary(message) {
  const cleaned = redactSecrets(message, "Ayrıntısız test hatası.");
  return cleaned.length > MAX_ERROR_LENGTH ? `${cleaned.slice(0, MAX_ERROR_LENGTH - 3)}...` : cleaned;
}

// Tanınmayan veya gövde taşıyabilecek ham hata metinlerini genel güvenli sınıfa indirger.
function formatSafeFailureError(rawError) {
  const sanitized = sanitizeErrorSummary(rawError);
  if (!rawError || typeof rawError !== "string" || !rawError.trim()) {
    return "Ayrıntısız test hatası.";
  }
  const firstLine = redactSecrets(rawError.split(/\r?\n/)[0] ?? "");
  if (!SAFE_ERROR_CLASSES.test(firstLine) || /Response body|\{"/i.test(sanitized)) {
    return "Test başarısız (ayrıntılı ham hata yükü güvenlik nedeniyle özetlenmedi).";
  }
  return sanitized;
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
            rawTitle: String(spec.title ?? "Adsız test"),
            rawFile: basename(specFile || "unknown"),
            title: redactSecrets(String(spec.title ?? "Adsız test"), "Adsız test"),
            file: redactSecrets(basename(specFile || "unknown"), "unknown"),
            projectName: redactSecrets(String(testEntry.projectName ?? "unknown"), "unknown"),
            status: redactSecrets(String(lastResult?.status ?? testEntry.status ?? "failed"), "failed"),
            safeError: formatSafeFailureError(rawError),
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

// Dosyanın symlink/traversal olmadan sonuç kökü içinde ve birebir izinli public (dosya, test başlığı) çiftine ait olduğunu doğrular.
export function isAllowedPublicScreenshot(filePath, specFile, specTitle, resultsRoot) {
  if (!filePath || !existsSync(filePath)) return false;
  const allowedTitles = PUBLIC_SCREENSHOT_ALLOWLIST.get(basename(specFile || ""));
  if (!allowedTitles || typeof specTitle !== "string" || !allowedTitles.has(specTitle)) {
    return false;
  }
  let stat;
  try {
    stat = lstatSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return false;
  if (resultsRoot) {
    try {
      const realRoot = realpathSync(resultsRoot);
      const realFile = realpathSync(filePath);
      if (!realFile.startsWith(`${realRoot}${sep}`)) return false;
    } catch {
      return false;
    }
  }
  const ext = extname(filePath).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) return false;
  return !FORBIDDEN_FILE_PATTERNS.test(filePath);
}

// Başarısız CI koşularında önce eski çıktıları siler, yalnız güvenli özet ve allowlist'teki public görselleri yazar.
export function collectCiEvidence(options = {}) {
  const failedStep = redactSecrets(String(options.failedStep || "unknown"), "unknown");
  const outDir = resolve(options.outDir || "ci-evidence");
  const playwrightJsonPath = options.playwrightJsonPath ? resolve(options.playwrightJsonPath) : null;
  const resultsRoot = options.resultsDir ? resolve(options.resultsDir) : null;
  const screenshotsOutDir = join(outDir, "public-screenshots");

  rmSync(outDir, { recursive: true, force: true });
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
        att.contentType.startsWith("image/")
        && isAllowedPublicScreenshot(att.path, failure.rawFile, failure.rawTitle, resultsRoot)
      );
      if (imageAttachment) {
        mkdirSync(screenshotsOutDir, { recursive: true, mode: 0o755 });
        const safeName = `public-${copiedCount + 1}${extname(imageAttachment.path).toLowerCase()}`;
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

  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    failedStep,
    reportParsed,
    failureCount: enrichedFailures.length,
    publicScreenshotCount: copiedFiles.length,
    publicScreenshotAllowlist: Object.fromEntries(
      [...PUBLIC_SCREENSHOT_ALLOWLIST.entries()].map(([file, titles]) => [file, [...titles]])
    ),
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
