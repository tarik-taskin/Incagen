const fs = require("node:fs");
const path = require("node:path");
const { parseDocument } = require("../functions/lib/parsing/index.js");
const { createCompanyReport } = require("../functions/lib/examples/company-report.js");
const JSZip = require("../functions/node_modules/jszip");
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
  const folder = path.join(root, "fixtures/company-example/v1");
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
  const documents = await Promise.all(manifest.files.map(async item => {
    const document = await parseDocument({ sourceId: item.sourceId, fileName: item.file, contentType: "text/csv", data: fs.readFileSync(path.join(folder, item.file)) });
    if (document.sha256 !== item.sha256) throw new Error("Şirket örneğinin kaynak hash'i değişmiş.");
    return document;
  }));
  for (const period of ["year", "h1", "h2", "q4"]) createCompanyReport(documents, period);
  const companyDestination = path.join(root, "src/features/reports/company-sources.json");
  const companySerialized = JSON.stringify(documents) + "\n";
  const zip = new JSZip();
  for (const item of manifest.files) zip.file(item.file, fs.readFileSync(path.join(folder, item.file)), { date: new Date("2025-12-31T12:00:00Z") });
  zip.file("README.md", fs.readFileSync(path.join(root, "fixtures/company-example/README.md")), { date: new Date("2025-12-31T12:00:00Z") });
  const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
  const archiveDestination = path.join(root, "src/features/reports/atlas-2025-kaynaklar.zip");
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(companyDestination, "utf8") !== companySerialized || !fs.readFileSync(archiveDestination).equals(archive)) throw new Error("Şirket örnek artefaktını yeniden üretin: npm run example:build");
  } else {
    fs.writeFileSync(companyDestination, companySerialized);
    fs.writeFileSync(archiveDestination, archive);
  }
  console.log("Sentetik örnek rapor: parser, metrikler ve kaynak bağları doğrulandı.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
