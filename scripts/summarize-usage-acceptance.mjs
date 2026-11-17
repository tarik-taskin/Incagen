import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Değerin geçerli, negatif olmayan sonlu bir süre ölçümü (gerçek 0 dahil) olup olmadığını kontrol eder.
function readValidDuration(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

// Değerin geçerli, negatif olmayan tam sayı token ölçümü (gerçek 0 dahil) olup olmadığını kontrol eder.
function readValidTokenCount(value) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

// Açık fiyat tarifesinin zorunlu kimlik, tarih, para birimi ve birim fiyat alanlarını doğrular.
export function validatePricingInput(pricing) {
  if (!pricing) return null;
  if (typeof pricing !== "object" || Array.isArray(pricing)) {
    throw new Error("Geçersiz fiyat tarifesi nesnesi.");
  }
  const { model, effectiveDate, currency, inputPer1MTokens, outputPer1MTokens } = pricing;
  if (typeof model !== "string" || !model.trim()
    || typeof effectiveDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
    || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)
    || typeof inputPer1MTokens !== "number" || !Number.isFinite(inputPer1MTokens) || inputPer1MTokens < 0
    || typeof outputPer1MTokens !== "number" || !Number.isFinite(outputPer1MTokens) || outputPer1MTokens < 0) {
    throw new Error("Fiyat tarifesi model, YYYY-MM-DD tarih, 3 harfli para birimi ve negatif olmayan fiyatları içermelidir.");
  }
  return { model: model.trim(), effectiveDate, currency, inputPer1MTokens, outputPer1MTokens };
}

// Tekil sentetik analiz koşusunu süre, token kullanımı, ölçülmeyen alanlar ve isteğe bağlı fiyat tahminiyle özetler.
export function summarizeSingleRun(run, pricingInput) {
  const unmeasuredFields = [];
  const measurementErrors = [];

  const pythonProvided = run?.pythonMs !== undefined && run?.pythonMs !== null;
  const modelProvided = run?.modelMs !== undefined && run?.modelMs !== null;
  const durationProvided = run?.durationMs !== undefined && run?.durationMs !== null;

  const calculationMs = readValidDuration(run?.pythonMs);
  const modelMs = readValidDuration(run?.modelMs);
  const totalDurationMs = readValidDuration(run?.durationMs);

  if (!pythonProvided) unmeasuredFields.push("pythonMs");
  else if (calculationMs === null) measurementErrors.push("Geçersiz pythonMs süresi.");

  if (!modelProvided) unmeasuredFields.push("modelMs");
  else if (modelMs === null) measurementErrors.push("Geçersiz modelMs süresi.");

  if (!durationProvided) unmeasuredFields.push("durationMs");
  else if (totalDurationMs === null) measurementErrors.push("Geçersiz durationMs süresi.");

  // Alt sürelerin toplamı toplam süreden belirgin biçimde büyük olamaz.
  if (calculationMs !== null && modelMs !== null && totalDurationMs !== null && calculationMs + modelMs > totalDurationMs) {
    measurementErrors.push("Alt süreler toplamı toplam süreyi aşıyor (pythonMs + modelMs > durationMs).");
  }

  let usage = null;
  if (run?.usage === undefined || run?.usage === null) {
    unmeasuredFields.push("usage");
  } else if (typeof run.usage !== "object" || Array.isArray(run.usage)) {
    measurementErrors.push("Geçersiz usage nesnesi.");
  } else {
    const promptTokens = readValidTokenCount(run.usage.promptTokens);
    const outputTokens = readValidTokenCount(run.usage.outputTokens);
    const totalTokens = readValidTokenCount(run.usage.totalTokens);
    if (promptTokens === null || outputTokens === null || totalTokens === null) {
      measurementErrors.push("Token alanları geçerli negatif olmayan tam sayı değil.");
    } else if (promptTokens + outputTokens !== totalTokens) {
      measurementErrors.push("Token tutarsızlığı: promptTokens + outputTokens !== totalTokens.");
    } else {
      usage = { promptTokens, outputTokens, totalTokens };
    }
  }

  const errorType = typeof run?.error === "string" && run.error.trim() ? run.error.trim() : null;
  const pricing = validatePricingInput(pricingInput);

  let estimatedCost;
  if (!pricing) {
    estimatedCost = { status: "hesaplanamadı", reason: "Açık model/tarih/para birimi ve birim fiyat girdisi verilmedi." };
  } else if (measurementErrors.length > 0) {
    estimatedCost = { status: "hesaplanamadı", reason: "Geçersiz veya tutarsız ölçüm verisi." };
  } else if (!usage) {
    estimatedCost = { status: "hesaplanamadı", reason: "Token kullanımı ölçülmedi." };
  } else if (run?.model !== pricing.model) {
    estimatedCost = { status: "hesaplanamadı", reason: `Model uyuşmazlığı: koşu (${String(run?.model ?? "yok")}), tarife (${pricing.model}).` };
  } else {
    const amount = Number(
      ((usage.promptTokens / 1_000_000) * pricing.inputPer1MTokens
        + (usage.outputTokens / 1_000_000) * pricing.outputPer1MTokens).toFixed(6)
    );
    estimatedCost = {
      status: "estimated",
      amount,
      currency: pricing.currency,
      model: pricing.model,
      effectiveDate: pricing.effectiveDate,
      note: "Yalnız kayıtlı token × açık birim fiyat hesabıdır; gerçek fatura tahsilatı değildir.",
    };
  }

  let measurementStatus;
  if (measurementErrors.length > 0) {
    measurementStatus = "invalid-measurement";
  } else if (run?.status === "failed") {
    measurementStatus = "failed";
  } else if (unmeasuredFields.length === 0) {
    measurementStatus = "measured";
  } else {
    measurementStatus = "partial";
  }

  return {
    runId: String(run?.runId ?? run?.attemptId ?? "unknown"),
    status: String(run?.status ?? "unknown"),
    model: typeof run?.model === "string" ? run.model : null,
    calculationMs,
    modelMs,
    totalDurationMs,
    usage,
    error: errorType,
    unmeasuredFields,
    measurementErrors,
    estimatedCost,
    measurementStatus,
  };
}

// Kayıtlı sentetik koşu listesini süre/kullanım istatistikleriyle yeniden üretilebilir rapora dönüştürür.
export function summarizeUsageAcceptance(runs, options = {}) {
  if (!Array.isArray(runs) || runs.length === 0) {
    throw new Error("En az bir kayıtlı analiz koşusu gereklidir.");
  }
  const pricing = validatePricingInput(options.pricing);
  const items = runs.map(run => summarizeSingleRun(run, pricing));
  const invalidRuns = items.filter(i => i.measurementStatus === "invalid-measurement");
  const validRuns = items.filter(i => i.measurementStatus !== "invalid-measurement");

  const validCalc = validRuns.map(i => i.calculationMs).filter(v => v !== null);
  const validModel = validRuns.map(i => i.modelMs).filter(v => v !== null);
  const validTotal = validRuns.map(i => i.totalDurationMs).filter(v => v !== null);
  const validUsage = validRuns.map(i => i.usage).filter(v => v !== null);

  const avg = list => (list.length > 0 ? Number((list.reduce((a, b) => a + b, 0) / list.length).toFixed(2)) : null);
  const invalidCount = invalidRuns.length;

  return {
    reportSchemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runCount: items.length,
    invalidMeasurementCount: invalidCount,
    excludedInvalidRunIds: invalidRuns.map(i => i.runId),
    measuredCounts: {
      calculationMs: validCalc.length,
      modelMs: validModel.length,
      totalDurationMs: validTotal.length,
      usage: validUsage.length,
    },
    averages: {
      calculationMs: avg(validCalc),
      modelMs: avg(validModel),
      totalDurationMs: avg(validTotal),
      totalTokens: avg(validUsage.map(u => u.totalTokens)),
    },
    pricingUsed: pricing,
    overallStatus: invalidCount > 0 ? "invalid" : (items.every(i => i.measurementStatus === "measured") ? "complete" : "partial"),
    runs: items,
  };
}

function parseArgs(argv) {
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
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !existsSync(args.input)) {
    console.error(JSON.stringify({ error: "Kayıtlı koşu dosyası (--input) bulunamadı." }));
    process.exit(1);
  }
  const runs = JSON.parse(readFileSync(args.input, "utf8"));
  const pricing = args.pricing && existsSync(args.pricing) ? JSON.parse(readFileSync(args.pricing, "utf8")) : undefined;
  const report = summarizeUsageAcceptance(runs, { pricing });
  const text = JSON.stringify(report, null, 2);
  if (args.output) writeFileSync(args.output, text + "\n", "utf8");
  console.log(text);
  if (report.overallStatus === "invalid") process.exitCode = 1;
}
