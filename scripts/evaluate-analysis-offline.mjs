import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiResultSchema, validateAiResult } from "../functions/lib/analysis/result-contract.js";
import { parseDelimitedDocument } from "../functions/lib/parsing/delimited.js";

const DEFAULT_FIXTURE_DIR = resolve("fixtures/analysis-reference");

// Metin veya dosya tamponunun SHA-256 özetini hesaplar.
export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

// Vaka sözleşmesine göre beklenen referans metrik ağacından birim ve tür kataloğu üretir.
function buildExpectedMetricCatalog(expectedReference) {
  const caseId = expectedReference.caseId;
  if (caseId !== "sales-net-revenue-v1" && caseId !== "feedback-themes-v1") {
    throw new Error(`Metrik birim sözleşmesi tanımsız vaka: ${String(caseId)}`);
  }
  const catalog = new Map();

  function inferSpec(path, numericValue) {
    if (path.includes("Percent")) {
      return { value: numericValue, unit: "%", kind: "percent" };
    }
    if (caseId === "sales-net-revenue-v1") {
      if (path.split(".").some(segment => segment.endsWith("Try"))) {
        return { value: numericValue, unit: "TRY", kind: "money" };
      }
      return { value: numericValue, unit: "adet", kind: "count" };
    }
    return { value: numericValue, unit: "yorum", kind: "count" };
  }

  function walk(node, prefix) {
    if (typeof node === "number" && Number.isFinite(node)) {
      catalog.set(prefix, inferSpec(prefix, node));
      return;
    }
    if (node && typeof node === "object" && !Array.isArray(node)) {
      for (const [key, child] of Object.entries(node)) {
        walk(child, prefix ? `${prefix}.${key}` : key);
      }
      return;
    }
    throw new Error(`Beklenen referansta geçersiz metrik değeri (${prefix}).`);
  }

  walk(expectedReference.metrics ?? {}, "");
  return catalog;
}

// Tek bir aday metriğini katalog değeri, birim sözleşmesi ve kuruş altı duyarlık olmadan doğrular.
function verifyMetricAgainstSpec(metric, spec, tolerances) {
  if (!metric || metric.status !== "available" || typeof metric.value !== "number" || !Number.isFinite(metric.value)) {
    return `${metric?.id ?? "bilinmeyen"}: aday metrik değeri kullanılabilir değil.`;
  }
  if (metric.unit !== spec.unit) {
    return `${metric.id}: beklenen birim ${spec.unit}, aday birim ${metric.unit}.`;
  }
  if (spec.kind === "money") {
    const decimalMatch = /^-?\d+(?:\.(\d+))?$/.exec(String(metric.value));
    const fractionalDigits = decimalMatch?.[1]?.length ?? 0;
    const candidateCents = metric.value * 100;
    const roundedCents = Math.round(candidateCents);
    if (fractionalDigits > 2 || Math.abs(candidateCents - roundedCents) > 1e-9 || metric.value !== spec.value) {
      return `${metric.id}: beklenen ${spec.value} ${spec.unit}, aday ${metric.value} ${metric.unit}.`;
    }
    return null;
  }
  if (spec.kind === "count") {
    if (!Number.isInteger(metric.value) || metric.value !== spec.value) {
      return `${metric.id}: beklenen ${spec.value} ${spec.unit}, aday ${metric.value} ${metric.unit}.`;
    }
    return null;
  }
  const tolerance = Number(tolerances.displayedPercentagePoints ?? 0.005);
  if (Math.abs(metric.value - spec.value) > tolerance) {
    return `${metric.id}: beklenen ${spec.value} %, aday ${metric.value} % (tolerans ${tolerance}).`;
  }
  return null;
}

// Zorunlu yolların yanında aday çıktıdaki tüm metrikleri referans kataloğa göre doğrular.
function evaluateNumericIntegrity(candidate, catalog, casePolicy, tolerances) {
  const candidateMetrics = candidate.metrics ?? [];
  const metricById = new Map();
  const duplicateIds = [];
  for (const metric of candidateMetrics) {
    if (metricById.has(metric.id)) duplicateIds.push(metric.id);
    metricById.set(metric.id, metric);
  }
  if (duplicateIds.length > 0) {
    return { status: "fail", reason: `Yinelenen metrik kimlikleri: ${duplicateIds.join(", ")}.` };
  }

  const missingPaths = [];
  const mismatches = [];

  for (const path of casePolicy.requiredMetricPaths ?? []) {
    const spec = catalog.get(path);
    if (!spec) {
      missingPaths.push(path);
      continue;
    }
    const candidateMetric = metricById.get(path);
    if (!candidateMetric) {
      missingPaths.push(path);
      continue;
    }
    const issue = verifyMetricAgainstSpec(candidateMetric, spec, tolerances);
    if (issue) mismatches.push(issue);
  }

  for (const metric of candidateMetrics) {
    const spec = catalog.get(metric.id);
    if (!spec) {
      mismatches.push(`${metric.id}: kaynak referansta doğrulanmamış ek metrik (${metric.value} ${metric.unit}).`);
      continue;
    }
    if ((casePolicy.requiredMetricPaths ?? []).includes(metric.id)) continue;
    const issue = verifyMetricAgainstSpec(metric, spec, tolerances);
    if (issue) mismatches.push(issue);
  }

  if (mismatches.length > 0) {
    return { status: "fail", reason: `Sayısal tutarsızlık: ${mismatches.join(" ")}` };
  }
  if (missingPaths.length > 0) {
    return { status: "fail", reason: `Politikadaki zorunlu metrikler eksik: ${missingPaths.join(", ")}.` };
  }
  return { status: "pass", reason: `Politikadaki tüm ${casePolicy.requiredMetricPaths.length} zorunlu metrik ve aday çıktıdaki ${candidateMetrics.length} metrik doğrulandı.` };
}

// Grafik türü yanında veri kümesinin yalnız doğrulanmış katalog metriklerine bağlandığını denetler.
function evaluateChartIntegrity(candidate, expectedReference, catalog) {
  const expectedChartTypes = new Set((expectedReference.charts ?? []).map(item => item.type));
  const charts = candidate.charts ?? [];
  if ((expectedReference.charts?.length ?? 0) > 0 && charts.length === 0) {
    return { status: "fail", reason: "Baz vakada beklenen grafik önerisi eksik." };
  }
  const datasetMap = new Map((candidate.datasets ?? []).map(ds => [ds.id, ds]));
  const metricMap = new Map((candidate.metrics ?? []).map(metric => [metric.id, metric]));

  for (const chart of charts) {
    if (!expectedChartTypes.has(chart.type)) {
      return { status: "fail", reason: `Vaka kurallarına aykırı grafik türü: ${chart.type}.` };
    }
    const dataset = datasetMap.get(chart.datasetId);
    if (!dataset) {
      return { status: "fail", reason: `Grafik (${chart.id}) tanımsız veri kümesine bağlı: ${chart.datasetId}.` };
    }
    for (const point of dataset.points ?? []) {
      const spec = catalog.get(point.metricId);
      const metric = metricMap.get(point.metricId);
      if (!spec || !metric) {
        return { status: "fail", reason: `Grafik (${chart.id}) kaynakta doğrulanmamış metriğe bağlı: ${point.metricId}.` };
      }
      if (dataset.unit !== spec.unit || metric.unit !== spec.unit || point.value !== metric.value) {
        return { status: "fail", reason: `Grafik (${chart.id}) seri birimi/değeri doğrulanmış metrikle uyuşmuyor (${point.metricId}).` };
      }
    }
  }
  return { status: "pass", reason: "Grafik türü, seri değerleri, birim ve metrik bağlantıları doğrulandı." };
}

// Parser kaynağı ve beklenen katalogdan aday çıktıyı kopyalamayan bağımsız güvenilir bağlam üretir.
function buildTrustedContextFromCatalog({ candidate, objective, sourceDescriptor, catalog, tolerances }) {
  const trustedMetrics = [];
  const trustedMetricById = new Map();

  for (const metric of candidate.metrics ?? []) {
    const spec = catalog.get(metric.id);
    if (!spec) continue;
    const withinPercentTol = spec.kind === "percent"
      && typeof metric.value === "number"
      && Math.abs(metric.value - spec.value) <= Number(tolerances.displayedPercentagePoints ?? 0.005);
    const trustedEvidence = Array.isArray(metric.evidence) && metric.evidence.every(item => (
      item
      && item.sourceId === sourceDescriptor.id
      && item.sha256 === sourceDescriptor.sha256
      && item.chunkId === sourceDescriptor.chunks[0].id
      && item.locator
      && typeof item.locator.rowStart === "number"
      && typeof item.locator.rowEnd === "number"
      && item.locator.rowStart >= sourceDescriptor.chunks[0].locator.rowStart
      && item.locator.rowEnd <= sourceDescriptor.chunks[0].locator.rowEnd
    ))
      ? structuredClone(metric.evidence)
      : [{
          sourceId: sourceDescriptor.id,
          sha256: sourceDescriptor.sha256,
          chunkId: sourceDescriptor.chunks[0].id,
          locator: sourceDescriptor.chunks[0].locator,
        }];

    const trustedMetric = {
      id: metric.id,
      label: metric.label,
      unit: spec.unit,
      method: metric.method,
      status: "available",
      value: withinPercentTol ? metric.value : spec.value,
      evidence: trustedEvidence,
    };
    trustedMetrics.push(trustedMetric);
    trustedMetricById.set(trustedMetric.id, trustedMetric);
  }

  const trustedDatasets = [];
  for (const dataset of candidate.datasets ?? []) {
    const validPoints = [];
    let datasetValid = Array.isArray(dataset.points) && dataset.points.length > 0;
    for (const point of dataset.points ?? []) {
      const tm = trustedMetricById.get(point.metricId);
      if (!tm || tm.unit !== dataset.unit) {
        datasetValid = false;
        break;
      }
      validPoints.push({
        label: point.label,
        metricId: tm.id,
        value: tm.value,
      });
    }
    if (datasetValid) {
      trustedDatasets.push({
        id: dataset.id,
        label: dataset.label,
        unit: dataset.unit,
        points: validPoints,
      });
    }
  }

  return {
    analysisId: candidate.analysisId,
    objective,
    sources: [sourceDescriptor],
    metrics: trustedMetrics,
    datasets: trustedDatasets,
  };
}

// Mevcut Git HEAD commit SHA'sını alır; Git yoksa veya başarısız olursa bilinmeyen işareti döner.
function resolveGitCommit(explicitCommit) {
  if (explicitCommit) return explicitCommit;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

// Değerlendirme politikasındaki her kapıyı başlangıçta çalıştırılmadı (not-run) olarak hazırlar.
function initialGates(hardGates) {
  const gates = {};
  for (const gate of hardGates) {
    gates[gate] = { status: "not-run", reason: "Henüz değerlendirilmedi." };
  }
  return gates;
}

// Kayıtlı aday sonucu ağ/model çağrısı olmadan fixture ve politika sürümüyle değerlendirir.
export function evaluateAnalysisOffline(options) {
  const fixtureDir = resolve(options.fixtureDir ?? DEFAULT_FIXTURE_DIR);
  const policyPath = resolve(options.policyPath ?? join(fixtureDir, "evaluation-policy.json"));
  const tasksPath = resolve(options.tasksPath ?? join(fixtureDir, "v1", "tasks.json"));

  const policyRaw = readFileSync(policyPath, "utf8");
  const policy = JSON.parse(policyRaw);
  const policySha256 = sha256Hex(Buffer.from(policyRaw, "utf8"));
  const tasks = JSON.parse(readFileSync(tasksPath, "utf8"));

  const hardGates = Array.isArray(policy.hardGates) && policy.hardGates.length > 0
    ? policy.hardGates
    : ["schema", "minimum-content", "numeric-integrity", "source-grounding", "scope-and-uncertainty", "mixed-and-counter-evidence", "chart-integrity"];
  const gates = initialGates(hardGates);

  const sourceCommit = resolveGitCommit(options.commitSha);
  const baseRecord = {
    recordSchemaVersion: 1,
    evaluatedAt: new Date().toISOString(),
    sourceCommit,
    caseId: options.caseId ?? null,
    policyId: "analysis-reference-evaluation-policy",
    policyVersion: policy.policyVersion ?? null,
    policyStatus: policy.status ?? "unknown",
    resultSchemaVersion: 1,
    hashes: {
      policySha256,
      sourceCsvSha256: null,
      expectedReferenceSha256: null,
      candidateOutputSha256: null,
    },
    gates,
    humanReviewRequired: true,
    humanReviewFocus: [],
    scoredBy: "offline-evaluator-gates-only",
    overallDecision: "fail",
  };

  if (options.expectedPolicyVersion !== undefined && policy.policyVersion !== options.expectedPolicyVersion) {
    gates.schema = { status: "fail", reason: `Politika sürümü uyuşmuyor: beklenen ${options.expectedPolicyVersion}, bulunan ${policy.policyVersion}.` };
    return baseRecord;
  }

  const taskCase = (tasks.cases ?? []).find(item => item.caseId === options.caseId);
  const casePolicy = (policy.cases ?? []).find(item => item.caseId === options.caseId);
  if (!taskCase || !casePolicy) {
    gates.schema = { status: "fail", reason: `Bilinmeyen veya politikada tanımsız vaka: ${String(options.caseId)}.` };
    return baseRecord;
  }
  baseRecord.humanReviewFocus = casePolicy.humanReviewFocus ?? [];

  const expectedFileName = taskCase.sourceFile === "sales.csv" ? "sales.expected.json" : "customer-feedback.expected.json";
  const expectedPath = join(fixtureDir, "v1", expectedFileName);
  const csvPath = join(fixtureDir, "v1", taskCase.sourceFile);
  if (!existsSync(expectedPath) || !existsSync(csvPath)) {
    gates.schema = { status: "fail", reason: "Vaka fixture veya cevap anahtarı dosyaları eksik." };
    return baseRecord;
  }

  const csvBytes = readFileSync(csvPath);
  const sourceCsvSha256 = sha256Hex(csvBytes);
  const expectedRaw = readFileSync(expectedPath, "utf8");
  const expectedReference = JSON.parse(expectedRaw);
  baseRecord.hashes.sourceCsvSha256 = sourceCsvSha256;
  baseRecord.hashes.expectedReferenceSha256 = sha256Hex(Buffer.from(expectedRaw, "utf8"));

  if (sourceCsvSha256 !== expectedReference.source?.sha256) {
    gates["source-grounding"] = { status: "fail", reason: "Kaynak CSV SHA-256 özeti beklenen referans hash'i ile uyuşmuyor." };
    return baseRecord;
  }
  if (options.expectedInputSha256 && sourceCsvSha256 !== options.expectedInputSha256) {
    gates["source-grounding"] = { status: "fail", reason: `Belirtilen girdi hash'i (${options.expectedInputSha256}) kaynak dosyayla uyuşmuyor.` };
    return baseRecord;
  }

  let candidate = options.candidateData;
  let candidateRawText = "";
  if (candidate === undefined) {
    if (!options.candidatePath || !existsSync(options.candidatePath)) {
      gates.schema = { status: "fail", reason: "Aday sonuç dosyası bulunamadı." };
      return baseRecord;
    }
    candidateRawText = readFileSync(options.candidatePath, "utf8");
    baseRecord.hashes.candidateOutputSha256 = sha256Hex(Buffer.from(candidateRawText, "utf8"));
    try {
      candidate = JSON.parse(candidateRawText);
    } catch {
      gates.schema = { status: "fail", reason: "Aday çıktı geçerli JSON değil." };
      return baseRecord;
    }
  } else {
    candidateRawText = JSON.stringify(candidate);
    baseRecord.hashes.candidateOutputSha256 = sha256Hex(Buffer.from(candidateRawText, "utf8"));
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    gates.schema = { status: "fail", reason: "Aday çıktı JSON nesnesi olmalıdır." };
    return baseRecord;
  }

  // Modelin kendini puanlaması veya cevap anahtarı sızıntısı geçersiz koşudur.
  if ("selfScore" in candidate || "answerKey" in candidate || "evaluationPolicy" in candidate) {
    gates.schema = { status: "fail", reason: "Geçersiz koşu: model öz-puanı veya cevap anahtarı sızıntısı tespit edildi." };
    return baseRecord;
  }

  const parsedSchema = aiResultSchema.safeParse(candidate);
  if (!parsedSchema.success) {
    gates.schema = { status: "fail", reason: `Üretim sonuç şeması v1 doğrulanamadı: ${parsedSchema.error.issues[0]?.message ?? "şema hatası"}` };
    return baseRecord;
  }

  // Kaynak CSV'yi üretim CSV ayrıştırıcısıyla bağımsız doğrulayarak satır sınırını ve hash'i sabitle.
  const parsedCsv = parseDelimitedDocument({
    sourceId: expectedReference.source.sourceId,
    fileName: taskCase.sourceFile,
    extension: "csv",
    contentType: "text/csv",
    data: csvBytes,
  });
  const parsedRowEnd = parsedCsv.chunks.reduce((maxRow, chunk) => Math.max(maxRow, chunk.locator?.rowEnd ?? 0), 0);
  if (parsedCsv.sha256 !== sourceCsvSha256 || parsedRowEnd !== expectedReference.source.dataRows) {
    gates["source-grounding"] = { status: "fail", reason: "Ayrıştırılan kaynak CSV satır sayısı veya SHA-256 özeti referansla uyuşmuyor." };
    return baseRecord;
  }

  const sourceDescriptor = {
    id: expectedReference.source.sourceId,
    sha256: parsedCsv.sha256,
    chunks: [{
      id: expectedReference.source.chunkId,
      locator: { rowStart: expectedReference.source.rowStart, rowEnd: parsedRowEnd },
    }],
  };
  const catalog = buildExpectedMetricCatalog(expectedReference);
  const tolerances = policy.tolerances ?? {};

  // Aday kendi referansını üretemez: trustedContext yalnız parser ve referans kataloğundan kurulur.
  const trustedContext = options.trustedContext ?? buildTrustedContextFromCatalog({
    candidate,
    objective: taskCase.objective,
    sourceDescriptor,
    catalog,
    tolerances,
  });

  gates.schema = { status: "pass", reason: "Üretim AI sonuç şeması v1 ve alan tipleri doğrulandı." };
  gates["numeric-integrity"] = evaluateNumericIntegrity(candidate, catalog, casePolicy, tolerances);
  gates["chart-integrity"] = evaluateChartIntegrity(candidate, expectedReference, catalog);

  try {
    validateAiResult(candidate, trustedContext);
    gates["source-grounding"] = {
      status: "needs-review",
      structuralStatus: "pass",
      semanticStatus: "needs-review",
      reason: "Kaynak kimliği, SHA-256, parça/satır kapsamı ve öneri dayanakları yapısal olarak doğrulandı; kanıtların iddiayı anlamsal olarak desteklediği insan incelemesi gerektirir.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Doğrulama hatası.";
    if (/Halka|Grafik/i.test(message)) {
      gates["chart-integrity"] = { status: "fail", reason: `Üretim doğrulayıcı reddi: ${message}` };
    } else if (/metriği|veri kümesi/i.test(message)) {
      if (gates["numeric-integrity"].status !== "fail") {
        gates["numeric-integrity"] = { status: "fail", reason: `Üretim doğrulayıcı reddi: ${message}` };
      }
    } else {
      gates["source-grounding"] = {
        status: "fail",
        structuralStatus: "fail",
        semanticStatus: "not-run",
        reason: `Üretim doğrulayıcı reddi: ${message}`,
      };
    }
  }

  const mechanicalFailed = [
    gates.schema.status,
    gates["numeric-integrity"].status,
    gates["chart-integrity"].status,
    gates["source-grounding"].status,
  ].some(status => status === "fail");
  if (mechanicalFailed) {
    return baseRecord;
  }

  // Semantik / insan incelemesi kapıları asla otomatik 'pass' sayılmaz.
  const hasSummary = (candidate.summary?.length ?? 0) > 0;
  const hasFindings = (candidate.findings?.length ?? 0) > 0;
  const hasLimitations = (candidate.limitations?.length ?? 0) > 0;
  if (!hasSummary || !hasFindings || !hasLimitations || gates["numeric-integrity"].status !== "pass") {
    gates["minimum-content"] = { status: "fail", reason: "Zorunlu özet, bulgu, sınırlama veya minimum metriklerden biri eksik." };
    return baseRecord;
  }
  gates["minimum-content"] = {
    status: "needs-review",
    reason: `Yapısal içerik ve metrik yolları mevcut; ${(casePolicy.requiredFindingIds ?? []).length} zorunlu bulgu anlamı insan incelemesi gerektirir.`,
  };

  gates["scope-and-uncertainty"] = {
    status: "needs-review",
    reason: "Yasak çıkarımlar, neden-sonuç veya genelleme ihlalleri için insan incelemesi gerektirir.",
  };
  gates["mixed-and-counter-evidence"] = {
    status: "needs-review",
    reason: "Karma duygu/olumlu karşı örnek ve istisna koruması insan incelemesi gerektirir.",
  };

  const gateStatuses = Object.values(gates).map(item => item.status);
  if (gateStatuses.some(status => status === "fail" || status === "not-run")) {
    baseRecord.overallDecision = "fail";
  } else if (gateStatuses.some(status => status === "needs-review")) {
    baseRecord.overallDecision = "needs-review";
  } else {
    baseRecord.overallDecision = "pass";
  }

  return baseRecord;
}

function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith("--") && i + 1 < argv.length) {
      args[key.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const args = parseCliArgs(process.argv.slice(2));
  const record = evaluateAnalysisOffline({
    caseId: args.case,
    candidatePath: args.candidate,
    policyPath: args.policy,
    expectedPolicyVersion: args["policy-version"] ? Number(args["policy-version"]) : undefined,
    expectedInputSha256: args["input-sha256"],
  });
  const output = JSON.stringify(record, null, 2);
  if (args.output) {
    writeFileSync(args.output, output + "\n", "utf8");
  }
  console.log(output);
  if (record.overallDecision === "fail" || record.overallDecision === "not-run") {
    process.exitCode = 1;
  }
}
