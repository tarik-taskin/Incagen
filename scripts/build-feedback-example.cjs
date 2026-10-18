const fs = require("node:fs");
const { parseDocument } = require("../functions/lib/parsing/index.js");
const { createFeedbackExample } = require("../functions/lib/examples/feedback-report.js");
// İnsan etiketli referansı gerçek parser'dan geçirir; beklenen hesap dosyasını üretime dahil etmez.
async function main() {
  const labels = JSON.parse(fs.readFileSync("fixtures/analysis-reference/annotations/customer-feedback.v2.json", "utf8"));
  const data = fs.readFileSync("fixtures/analysis-reference/examples/customer-feedback.v2.csv");
  const document = await parseDocument({ sourceId: "reference-feedback", fileName: "customer-feedback.csv", contentType: "text/csv", data });
  const { result, sources, annotations } = createFeedbackExample(document, labels.annotations, labels.sourceSha256);
  const output = JSON.stringify({ result, sources, annotations }, null, 2) + "\n";
  const destination = "src/features/reports/feedback-example.json";
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(destination, "utf8") !== output) throw new Error("Geri bildirim örneğini yeniden üretin.");
  } else fs.writeFileSync(destination, output);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
