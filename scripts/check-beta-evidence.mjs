import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { verifyAcceptanceEvidence } from "./accept-tabular-cloud.mjs";
import { summarizeSingleRun, summarizeUsageAcceptance } from "./summarize-usage-acceptance.mjs";

// Canlı koşunun pozitif süre ve token ölçümü gereksinimini kayıtlı her vakaya uygular.
function hasMeasuredUsage(run) {
  return run.measurementStatus === "measured"
    && [run.calculationMs, run.modelMs, run.totalDurationMs, run.usage?.promptTokens, run.usage?.outputTokens]
      .every(value => value > 0);
}

// Dosya bütünlüğü, insan kararı ve ölçüm durumunu birleştirir. Yayın veya sağlayıcı işlemi yapmaz.
function inspectEvidence(directory, expectedCommit) {
  const evidence = verifyAcceptanceEvidence(directory, { expectedCommit });
  const commitMatched = evidence.verified && expectedCommit !== undefined;
  const measuredRuns = (evidence.runs ?? []).filter(run => hasMeasuredUsage(summarizeSingleRun(run)));
  const measuredLocales = new Set(measuredRuns.map(run => run.locale));
  const usage = measuredRuns.length > 0 ? summarizeUsageAcceptance(measuredRuns) : null;
  const reviews = evidence.verified ? evidence.reviews.map(review => ({
    ...review,
    usageMeasured: measuredLocales.has(review.locale),
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
