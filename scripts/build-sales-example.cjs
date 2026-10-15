const fs = require("node:fs");
const path = require("node:path");
const { parseDocument } = require("../functions/lib/parsing/index.js");
const { createSalesExample } = require("../functions/lib/examples/sales-report.js");

// Gerçek parser ve doğrulayıcıdan geçen sentetik örneği statik rapor artefaktına dönüştürür; AI çağırmaz.
async function main() {
  const root = path.resolve(__dirname, "..");
  const data = fs.readFileSync(path.join(root, "fixtures/analysis-reference/v1/sales.csv"));
  const tasks = JSON.parse(fs.readFileSync(path.join(root, "fixtures/analysis-reference/v1/tasks.json"), "utf8"));
  const task = tasks.cases.find(item => item.caseId === "sales-net-revenue-v1");
  const document = await parseDocument({ sourceId: "reference-sales", fileName: "sales.csv", contentType: "text/csv", data });
  const example = createSalesExample(document, task.objective, task.businessRules);
  const destination = path.join(root, "src/features/reports/sales-example.json");
  const serialized = JSON.stringify(example, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(destination, "utf8") !== serialized) throw new Error("Statik örnek raporu yeniden üretin: npm run example:build");
  } else fs.writeFileSync(destination, serialized);
  console.log("Sentetik örnek rapor: parser, metrikler ve kaynak bağları doğrulandı.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
