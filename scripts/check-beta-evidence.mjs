import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { verifyAcceptanceEvidence } from "./accept-tabular-cloud.mjs";
import { summarizeSingleRun, summarizeUsageAcceptance } from "./summarize-usage-acceptance.mjs";

// Her vaka için eksik, tutarsız ve gerçekten sıfır ölçümleri birbirinden ayırır.
function inspectMeasurement(run) {
  const usage = summarizeSingleRun(run);
  const zero = Object.entries({ pythonMs: usage.calculationMs, modelMs: usage.modelMs, durationMs: usage.totalDurationMs,
    promptTokens: usage.usage?.promptTokens, outputTokens: usage.usage?.outputTokens })
    .filter(([, value]) => value === 0).map(([name]) => name);
  return {
    ready: usage.measurementStatus === "measured" && zero.length === 0,
    missing: usage.unmeasuredFields,
    invalid: usage.measurementErrors,
    zero,
  };
}

// Dosya bütünlüğü, insan kararı ve ölçüm durumunu birleştirir. Yayın veya sağlayıcı işlemi yapmaz.
function inspectEvidence(directory, expectedCommit) {
  const evidence = verifyAcceptanceEvidence(directory, { expectedCommit });
  const commitMatched = evidence.verified && expectedCommit !== undefined;
  const runs = evidence.runs ?? [];
  const measurementByCase = new Map(runs.map(run => [run.caseId, inspectMeasurement(run)]));
  const measuredRuns = runs.filter(run => measurementByCase.get(run.caseId).ready);
  const usage = measuredRuns.length > 0 ? summarizeUsageAcceptance(measuredRuns) : null;
  const reviews = evidence.verified ? evidence.reviews.map(review => ({
    ...review,
    usageMeasured: measurementByCase.get(review.caseId)?.ready === true,
    measurement: measurementByCase.get(review.caseId),
  })) : [];
  const blockers = [];
  if (!evidence.verified) blockers.push("invalid-evidence");
  else if (evidence.mode !== "full") blockers.push("full-run-required");
  else {
    if (!commitMatched) blockers.push("expected-commit-required");
    if (reviews.some(review => review.status === "pending")) blockers.push("pending-human-review");
    if (reviews.some(review => review.status === "rejected")) blockers.push("rejected-human-review");
    if (reviews.some(review => !review.usageMeasured)) blockers.push("incomplete-usage-measurements");
  }
  return {
    status: evidence.status,
    mechanicalVerified: evidence.verified,
    mode: evidence.mode ?? evidence.readOnlySummary?.mode ?? null,
    gitCommit: evidence.gitCommit ?? null,
    commitMatched,
    reviews,
    closedChecks: evidence.verified ? evidence.closedChecks : [],
    usage: reviews.length > 0 ? {
      measuredCases: measuredRuns.length,
      totalDurationMs: usage ? { median: usage.medians.totalDurationMs, max: usage.maxima.totalDurationMs } : null,
      totalTokens: usage ? { median: usage.medians.totalTokens, max: usage.maxima.totalTokens } : null,
    } : null,
    evidenceReady: blockers.length === 0,
    blockers,
    errors: evidence.errors,
  };
}

// Varsayılan durum çıktısı bekleyen kararları gösterir. Sıkı mod yalnız tam kanıtta başarılı olur.
function checkEvidence(args) {
  const { values, tokens } = parseArgs({
    args,
    tokens: true,
    options: {
      input: { type: "string" },
      "expected-commit": { type: "string" },
      "require-ready": { type: "boolean" },
    },
  });
  const expectedCommit = values["expected-commit"];
  if (new Set(tokens.map(token => token.name)).size !== tokens.length
    || !values.input?.trim() || (expectedCommit !== undefined && !/^[a-f0-9]{40}$/.test(expectedCommit))) {
    throw new Error("Kanıt dizini ve isteğe bağlı tam Git commit SHA’sı gereklidir.");
  }

  const report = inspectEvidence(values.input, expectedCommit);
  console.log(JSON.stringify(report, null, 2));
  return report.mechanicalVerified && (!values["require-ready"] || report.evidenceReady) ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = checkEvidence(process.argv.slice(2));
  } catch {
    console.error("Kullanım: npm run acceptance:check -- --input <kanıt-dizini> [--expected-commit <tam-sha>] [--require-ready]");
    process.exitCode = 1;
  }
}
