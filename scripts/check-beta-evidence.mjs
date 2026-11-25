import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { verifyAcceptanceEvidence } from "./accept-tabular-cloud.mjs";

// Yalnız yerel kanıtları okur ve rapor metni veya inceleme notu göstermeden karar durumlarını özetler.
function checkEvidence(args) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string" },
      "expected-commit": { type: "string" },
    },
  });
  const expectedCommit = values["expected-commit"];
  if (!values.input?.trim() || (expectedCommit !== undefined && !/^[a-f0-9]{40}$/.test(expectedCommit))) {
    throw new Error("Kanıt dizini ve isteğe bağlı tam Git commit SHA’sı gereklidir.");
  }

  const evidence = verifyAcceptanceEvidence(values.input, { expectedCommit });
  const report = {
    status: evidence.status,
    mechanicalVerified: evidence.verified,
    mode: evidence.mode ?? evidence.readOnlySummary?.mode ?? null,
    gitCommit: evidence.gitCommit ?? null,
    commitMatched: evidence.verified && expectedCommit !== undefined,
    reviews: evidence.verified ? evidence.reviews : [],
    errors: evidence.errors,
  };
  console.log(JSON.stringify(report, null, 2));
  return evidence.verified ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = checkEvidence(process.argv.slice(2));
  } catch {
    console.error("Kullanım: npm run acceptance:check -- --input <kanıt-dizini> [--expected-commit <tam-sha>]");
    process.exitCode = 1;
  }
}
