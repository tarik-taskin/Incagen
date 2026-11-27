import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

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
  if (pricing === undefined || pricing === null) return null;
  if (typeof pricing !== "object" || Array.isArray(pricing)) {
    throw new Error("Geçersiz fiyat tarifesi nesnesi.");
  }
  const { model, effectiveDate, currency, inputPer1MTokens, outputPer1MTokens } = pricing;
  const effectiveTime = typeof effectiveDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
    ? Date.parse(`${effectiveDate}T00:00:00.000Z`) : NaN;
  if (typeof model !== "string" || !model.trim()
    || !Number.isFinite(effectiveTime) || new Date(effectiveTime).toISOString().slice(0, 10) !== effectiveDate
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
  } else if (run?.status === "completed" && unmeasuredFields.length === 0) {
    measurementStatus = "measured";
  } else {
    measurementStatus = "partial";
  }

  return {
    runId: String(run?.runId ?? run?.attemptId ?? "unknown"),
    status: String(run?.status ?? "unknown"),
    ...(["tr", "en", "de", "es", "zh", "ar"].includes(run?.locale) ? { locale: run.locale } : {}),
    ...(["csv", "xlsx"].includes(run?.format) ? { format: run.format } : {}),
    model: typeof run?.model === "string" ? run.model : null,
    calculationMs,
    modelMs,
    totalDurationMs,
    ...(Number.isSafeInteger(run?.inputBytes) && run.inputBytes > 0 ? { inputBytes: run.inputBytes } : {}),
    usage,
    error: errorType,
    unmeasuredFields,
    measurementErrors,
    estimatedCost,
    measurementStatus,
  };
}

// Küçük ve sıfır olmayan liste için ortalama, medyan (tipik değer) ve en uzun süreyi hesaplar.
function computeDistribution(values) {
  if (values.length === 0) return { sampleCount: 0, mean: null, median: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? sorted[middle]
    : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
  const mean = Number((sorted.reduce((sum, item) => sum + item, 0) / sorted.length).toFixed(2));
  return {
    sampleCount: sorted.length,
    mean,
    median: Number(median.toFixed(2)),
    max: sorted[sorted.length - 1],
  };
}

// Geçerli ve tamamlanmış tek format (CSV/XLSX) koşuları için örnek sayısı, tipik/medyan ve en uzun süreyi özetler.
function summarizeFormatGroup(groupRuns) {
  const sampleCount = groupRuns.length;
  const measuredRuns = groupRuns.filter(i => i.measurementStatus === "measured");
  const measuredSampleCount = measuredRuns.length;
  const calc = computeDistribution(groupRuns.map(i => i.calculationMs).filter(v => v !== null));
  const model = computeDistribution(groupRuns.map(i => i.modelMs).filter(v => v !== null));
  const total = computeDistribution(groupRuns.map(i => i.totalDurationMs).filter(v => v !== null));
  const tokens = computeDistribution(groupRuns.map(i => i.usage?.totalTokens ?? null).filter(v => v !== null));
  return {
    sampleCount,
    measuredSampleCount,
    smallSample: measuredSampleCount < 6,
    sampleNote: measuredSampleCount === 0
      ? "Süre ve tokenları tam ölçülmüş örnek yok."
      : measuredSampleCount < 6
        ? "Küçük veya kısmi ölçümlü örneklem; geniş kullanıcı trafiği veya kesin SLA temsili değildir."
        : "İlk temel ölçülmüş örneklem eşiği (6+) karşılandı; üretim SLA garantisi değildir.",
    typicalDurationMs: total.median,
    calculationMs: calc,
    modelMs: model,
    totalDurationMs: total,
    totalTokens: tokens,
  };
}

// Kayıtlı sentetik koşu listesini süre/kullanım istatistikleriyle yeniden üretilebilir rapora dönüştürür.
export function summarizeUsageAcceptance(runs, options = {}) {
  if (!Array.isArray(runs) || runs.length === 0) {
    throw new Error("En az bir kayıtlı analiz koşusu gereklidir.");
  }
  const pricing = validatePricingInput(options.pricing);
  const seenRunIds = new Set();
  const duplicateRunIds = [];
  const items = runs.map(run => {
    const summarized = summarizeSingleRun(run, pricing);
    const isDuplicate = summarized.runId !== "unknown" && seenRunIds.has(summarized.runId);
    if (summarized.runId !== "unknown") seenRunIds.add(summarized.runId);
    if (isDuplicate) duplicateRunIds.push(summarized.runId);
    return isDuplicate ? { ...summarized, duplicateOfFirst: true } : summarized;
  });

  const uniqueItems = items.filter(i => !i.duplicateOfFirst);
  const invalidRuns = uniqueItems.filter(i => i.measurementStatus === "invalid-measurement");
  const completedRuns = uniqueItems.filter(i => i.status === "completed" && i.measurementStatus !== "invalid-measurement");
  const measuredCompletedRuns = completedRuns.filter(i => i.measurementStatus === "measured");

  const validCalc = completedRuns.map(i => i.calculationMs).filter(v => v !== null);
  const validModel = completedRuns.map(i => i.modelMs).filter(v => v !== null);
  const validTotal = completedRuns.map(i => i.totalDurationMs).filter(v => v !== null);
  const validUsage = completedRuns.map(i => i.usage).filter(v => v !== null);

  const calcStats = computeDistribution(validCalc);
  const modelStats = computeDistribution(validModel);
  const totalStats = computeDistribution(validTotal);
  const tokenStats = computeDistribution(validUsage.map(u => u.totalTokens));
  const invalidCount = invalidRuns.length;

  return {
    reportSchemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runCount: items.length,
    uniqueRunCount: uniqueItems.length,
    completedCount: uniqueItems.filter(i => i.status === "completed").length,
    validCompletedCount: completedRuns.length,
    measuredSampleCount: measuredCompletedRuns.length,
    failedCount: uniqueItems.filter(i => i.status === "failed").length,
    unfinishedCount: uniqueItems.filter(i => i.status !== "completed" && i.status !== "failed").length,
    invalidMeasurementCount: invalidCount,
    excludedInvalidRunIds: invalidRuns.map(i => i.runId),
    duplicateRunIds: [...new Set(duplicateRunIds)],
    excludedDuplicateCount: duplicateRunIds.length,
    sampleConfidence: measuredCompletedRuns.length < 6 ? "small-sample" : "baseline-met",
    sampleNote: measuredCompletedRuns.length === 0
      ? "Süre ve tokenları tam ölçülmüş tamamlanmış koşu bulunmuyor."
      : measuredCompletedRuns.length < 6
        ? `Yalnız ${measuredCompletedRuns.length} tam ölçülmüş (süre + token) koşu içerir; küçük örneklem büyük veri veya SLA temsili olarak sunulamaz.`
        : `${measuredCompletedRuns.length} tam ölçülmüş sentetik koşu özeti.`,
    measuredCounts: {
      calculationMs: calcStats.sampleCount,
      modelMs: modelStats.sampleCount,
      totalDurationMs: totalStats.sampleCount,
      usage: tokenStats.sampleCount,
    },
    averages: {
      calculationMs: calcStats.mean,
      modelMs: modelStats.mean,
      totalDurationMs: totalStats.mean,
      totalTokens: tokenStats.mean,
    },
    medians: {
      calculationMs: calcStats.median,
      modelMs: modelStats.median,
      totalDurationMs: totalStats.median,
      totalTokens: tokenStats.median,
    },
    maxima: {
      calculationMs: calcStats.max,
      modelMs: modelStats.max,
      totalDurationMs: totalStats.max,
      totalTokens: tokenStats.max,
    },
    byFormat: {
      csv: summarizeFormatGroup(completedRuns.filter(i => i.format === "csv")),
      xlsx: summarizeFormatGroup(completedRuns.filter(i => i.format === "xlsx")),
    },
    pricingUsed: pricing,
    overallStatus: invalidCount > 0 ? "invalid" : (uniqueItems.every(i => i.measurementStatus === "measured") ? "complete" : "partial"),
    runs: items,
  };
}

// Fiyat veya çıktı argümanı eksik ya da yinelenmişse kullanım özeti oluşturulmaz.
function usageArgs(argv) {
  const { values, tokens } = parseArgs({
    args: argv, tokens: true, options: {
      input: { type: "string" }, pricing: { type: "string" }, output: { type: "string" },
    },
  });
  if (!values.input?.trim() || Object.values(values).some(value => !value.trim())
    || tokens.length !== new Set(tokens.map(token => token.name)).size) throw new Error("Invalid usage arguments.");
  return values;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  try {
    const args = usageArgs(process.argv.slice(2));
    const runs = JSON.parse(readFileSync(args.input, "utf8"));
    const pricing = args.pricing ? JSON.parse(readFileSync(args.pricing, "utf8")) : undefined;
    const report = summarizeUsageAcceptance(runs, { pricing });
    const text = JSON.stringify(report, null, 2);
    if (args.output) writeFileSync(args.output, text + "\n", "utf8");
    console.log(text);
    if (report.overallStatus === "invalid") process.exitCode = 1;
  } catch {
    console.error(JSON.stringify({ error: "Koşu girdisi, belirtilen fiyat dosyası veya çıktı yolu geçersiz." }));
    process.exitCode = 1;
  }
}
