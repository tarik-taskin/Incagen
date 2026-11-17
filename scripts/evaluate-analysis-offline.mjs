import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiResultSchema, validateAiResult } from "../functions/lib/analysis/result-contract.js";

const DEFAULT_FIXTURE_DIR = resolve("fixtures/analysis-reference");

// Metin veya dosya tamponunun SHA-256 özetini hesaplar.
export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

// Değerin noktalı yolunu (ör. monthlyNetSalesTry.2026-09) güvenli biçimde okur.
function readPathValue(root, pathText) {
  let current = root;
  for (const segment of pathText.split(".")) {
    if (!current || typeof current !== "object" || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
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

// Politikadaki requiredMetricPaths ile aday çıktıdaki metrikleri tolerans kuralına göre eşler.
function evaluateNumericIntegrity(candidate, expectedReference, casePolicy, tolerances) {
  const candidateMetrics = new Map((candidate.metrics ?? []).map(metric => [metric.id, metric]));
  const expectedMetrics = expectedReference.metrics ?? {};
  const missingPaths = [];
  const mismatches = [];

  for (const path of casePolicy.requiredMetricPaths ?? []) {
    const expectedValue = readPathValue(expectedMetrics, path);
    if (expectedValue === undefined) {
      missingPaths.push(path);
      continue;
    }
    const candidateMetric = candidateMetrics.get(path)
      ?? (candidate.metrics ?? []).find(metric => metric.id === path || metric.label === path);
    if (!candidateMetric) {
      missingPaths.push(path);
      continue;
    }
    if (candidateMetric.status !== "available" || typeof candidateMetric.value !== "number") {
      mismatches.push(`${path}: aday metrik değeri kullanılabilir değil.`);
      continue;
    }
    const expectedUnit = path.toLowerCase().includes("percent") ? "%" : (expectedReference.caseId === "sales-net-revenue-v1" ? "TRY" : "yorum");
    const isPercent = expectedUnit === "%";
    const tolerance = isPercent ? Number(tolerances.displayedPercentagePoints ?? 0.005) : 0;
    if (expectedUnit === "TRY") {
      const candidateCents = Math.round(candidateMetric.value * 100);
      const expectedCents = Math.round(Number(expectedValue) * 100);
      if (candidateCents !== expectedCents || candidateMetric.unit !== "TRY") {
        mismatches.push(`${path}: beklenen ${expectedValue} TRY, aday ${candidateMetric.value} ${candidateMetric.unit}.`);
      }
    } else if (Math.abs(candidateMetric.value - Number(expectedValue)) > tolerance) {
      mismatches.push(`${path}: beklenen ${expectedValue}, aday ${candidateMetric.value} (tolerans ${tolerance}).`);
    }
  }

  if (mismatches.length > 0) {
    return { status: "fail", reason: `Sayısal tutarsızlık: ${mismatches.join(" ")}` };
  }
  if (missingPaths.length > 0) {
    return { status: "fail", reason: `Politikadaki zorunlu metrikler eksik: ${missingPaths.join(", ")}.` };
  }
  return { status: "pass", reason: `Politikadaki tüm ${casePolicy.requiredMetricPaths.length} zorunlu metrik beklenen değer ve toleranslarla eşleşti.` };
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

  // Cevap anahtarını modele karıştırmadan yalnız kaynak ve güvenilir metrik bağlamıyla validateAiResult çalıştır.
  const trustedContext = options.trustedContext ?? {
    analysisId: candidate.analysisId,
    objective: taskCase.objective,
    sources: [{
      id: expectedReference.source.sourceId,
      sha256: sourceCsvSha256,
      chunks: [{
        id: expectedReference.source.chunkId,
        locator: { rowStart: expectedReference.source.rowStart, rowEnd: expectedReference.source.rowEnd },
      }],
    }],
    metrics: structuredClone(candidate.metrics ?? []),
    datasets: structuredClone(candidate.datasets ?? []),
  };

  try {
    validateAiResult(candidate, trustedContext);
    gates.schema = { status: "pass", reason: "Üretim AI sonuç şeması v1 ve alan tipleri doğrulandı." };
    gates["source-grounding"] = { status: "pass", reason: "Kaynak kimliği, SHA-256, parça/satır kapsamı ve öneri dayanakları doğrulandı." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Doğrulama hatası.";
    gates.schema = { status: "pass", reason: "Temel JSON Schema v1 uyumlu." };
    if (/Halka|Grafik/i.test(message)) {
      gates["source-grounding"] = { status: "pass", reason: "Kaynak kimliği, SHA-256 ve parça kapsamı geçerli." };
      gates["chart-integrity"] = { status: "fail", reason: `Üretim doğrulayıcı reddi: ${message}` };
    } else if (/metriği|veri kümesi/i.test(message)) {
      gates["source-grounding"] = { status: "pass", reason: "Kaynak kimliği, SHA-256 ve parça kapsamı geçerli." };
      gates["numeric-integrity"] = { status: "fail", reason: `Üretim doğrulayıcı reddi: ${message}` };
    } else {
      gates["source-grounding"] = { status: "fail", reason: `Üretim doğrulayıcı reddi: ${message}` };
    }
  }

  if (gates["numeric-integrity"].status !== "fail") {
    gates["numeric-integrity"] = evaluateNumericIntegrity(candidate, expectedReference, casePolicy, policy.tolerances ?? {});
  }

  // Grafik kapısı: üretim doğrulayıcı geçti; ek olarak vaka grafik türü kuralını kontrol et.
  if (gates["chart-integrity"].status !== "fail") {
    const expectedChartTypes = new Set((expectedReference.charts ?? []).map(item => item.type));
    const invalidChart = (candidate.charts ?? []).find(chart => !expectedChartTypes.has(chart.type));
    if ((expectedReference.charts?.length ?? 0) > 0 && (!candidate.charts || candidate.charts.length === 0)) {
      gates["chart-integrity"] = { status: "fail", reason: "Baz vakada beklenen grafik önerisi eksik." };
    } else if (invalidChart) {
      gates["chart-integrity"] = { status: "fail", reason: `Vaka kurallarına aykırı grafik türü: ${invalidChart.type}.` };
    } else {
      gates["chart-integrity"] = { status: "pass", reason: "Grafik türü, seri değerleri, birim ve metrik bağlantıları doğrulandı." };
    }
  }

  // Semantik / insan incelemesi kapıları asla otomatik 'pass' sayılmaz.
  const hasSummary = (candidate.summary?.length ?? 0) > 0;
  const hasFindings = (candidate.findings?.length ?? 0) > 0;
  const hasLimitations = (candidate.limitations?.length ?? 0) > 0;
  if (!hasSummary || !hasFindings || !hasLimitations || gates["numeric-integrity"].status !== "pass") {
    gates["minimum-content"] = { status: "fail", reason: "Zorunlu özet, bulgu, sınırlama veya minimum metriklerden biri eksik." };
  } else {
    gates["minimum-content"] = {
      status: "needs-review",
      reason: `Yapısal içerik ve metrik yolları mevcut; ${(casePolicy.requiredFindingIds ?? []).length} zorunlu bulgu anlamı insan incelemesi gerektirir.`,
    };
  }

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
