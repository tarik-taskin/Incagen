import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateAnalysisOffline } from "./evaluate-analysis-offline.mjs";

const salesExpected = JSON.parse(readFileSync("fixtures/analysis-reference/v1/sales.expected.json", "utf8"));
const feedbackExpected = JSON.parse(readFileSync("fixtures/analysis-reference/v1/customer-feedback.expected.json", "utf8"));

function validSalesCandidate() {
  const anchor = {
    sourceId: salesExpected.source.sourceId,
    sha256: salesExpected.source.sha256,
    chunkId: salesExpected.source.chunkId,
    locator: { rowStart: 1, rowEnd: salesExpected.source.dataRows },
  };
  const metricDefs = [
    ["netSalesTry", "Toplam net satış", salesExpected.metrics.netSalesTry, "TRY"],
    ["monthlyNetSalesTry.2026-09", "Eylül net satış", salesExpected.metrics.monthlyNetSalesTry["2026-09"], "TRY"],
    ["monthlyNetSalesTry.2026-10", "Ekim net satış", salesExpected.metrics.monthlyNetSalesTry["2026-10"], "TRY"],
    ["monthlyChangeTry", "Aylık değişim", salesExpected.metrics.monthlyChangeTry, "TRY"],
    ["monthlyChangePercent", "Aylık değişim yüzdesi", salesExpected.metrics.monthlyChangePercent, "%"],
    ["categoryNetSalesTry.Teknoloji", "Teknoloji net satış", salesExpected.metrics.categoryNetSalesTry.Teknoloji, "TRY"],
    ["discountsTry", "İndirimler", salesExpected.metrics.discountsTry, "TRY"],
    ["refundsTry", "İadeler", salesExpected.metrics.refundsTry, "TRY"],
  ];
  const metrics = metricDefs.map(([id, label, value, unit]) => ({
    id,
    label,
    unit,
    method: "Doğrulanmış sentetik hesap.",
    status: "available",
    value,
    evidence: [anchor],
  }));
  const datasets = [{
    id: "monthly",
    label: "Aylık net satışlar",
    unit: "TRY",
    points: [
      { label: "2026-09", metricId: "monthlyNetSalesTry.2026-09", value: salesExpected.metrics.monthlyNetSalesTry["2026-09"] },
      { label: "2026-10", metricId: "monthlyNetSalesTry.2026-10", value: salesExpected.metrics.monthlyNetSalesTry["2026-10"] },
    ],
  }];
  const statement = {
    text: "Eylül ve Ekim ayları sentetik net satış hesapları karşılaştırıldı.",
    evidence: [anchor],
    metricIds: metrics.map(item => item.id),
  };
  return {
    schemaVersion: 1,
    analysisId: "offline-eval-sales-1",
    objective: salesExpected.objective,
    summary: [statement],
    findings: [{ id: "finding-1", title: "Dönem değişimi", kind: "observation", statements: [statement] }],
    recommendations: [{ id: "action-1", action: "Operasyon ve maliyet verileriyle nedenleri inceleyin.", basisFindingIds: ["finding-1"] }],
    metrics,
    datasets,
    charts: [{ id: "chart-1", title: "Aylık net satışlar", type: "bar", datasetId: "monthly" }],
    limitations: ["Sentetik iki aylık veri; kâr ve müşteri sayısı bilinmiyor."],
  };
}

function validFeedbackCandidate() {
  const anchor = {
    sourceId: feedbackExpected.source.sourceId,
    sha256: feedbackExpected.source.sha256,
    chunkId: feedbackExpected.source.chunkId,
    locator: { rowStart: 1, rowEnd: feedbackExpected.source.dataRows },
  };
  const metrics = [
    { id: "comments", label: "Toplam yorum", unit: "yorum", method: "Benzersiz yorum sayımı.", status: "available", value: 8, evidence: [anchor] },
    { id: "problemMentions.delivery", label: "Teslimat sorunu", unit: "yorum", method: "İnsan etiketi sayımı.", status: "available", value: 3, evidence: [anchor] },
    { id: "problemMentionPercent.delivery", label: "Teslimat sorunu yüzdesi", unit: "%", method: "Payda 8 yorum.", status: "available", value: 37.5, evidence: [anchor] },
  ];
  const datasets = [{
    id: "problems",
    label: "Sorun sayıları",
    unit: "yorum",
    points: [
      { label: "Teslimat", metricId: "problemMentions.delivery", value: 3 },
    ],
  }];
  const statement = {
    text: "Sekiz sentetik müşteri yorumunda teslimat ve diğer temalar özetlendi.",
    evidence: [anchor],
    metricIds: metrics.map(item => item.id),
  };
  return {
    schemaVersion: 1,
    analysisId: "offline-eval-feedback-1",
    objective: feedbackExpected.objective,
    summary: [statement],
    findings: [{ id: "finding-1", title: "Teslimat sorunları", kind: "observation", statements: [statement] }],
    recommendations: [{ id: "action-1", action: "Paketleme sürecini inceleyin.", basisFindingIds: ["finding-1"] }],
    metrics,
    datasets,
    charts: [{ id: "chart-1", title: "Sorun dağılımı", type: "horizontal-bar", datasetId: "problems" }],
    limitations: ["Sekiz sentetik yorum; tüm müşterilere genellenemez."],
  };
}

test("evaluates valid sales and feedback candidates without auto-passing human semantic gates", () => {
  const salesRecord = evaluateAnalysisOffline({ caseId: "sales-net-revenue-v1", candidateData: validSalesCandidate() });
  assert.equal(salesRecord.recordSchemaVersion, 1);
  assert.equal(salesRecord.policyVersion, 1);
  assert.ok(salesRecord.sourceCommit.length > 0);
  assert.equal(salesRecord.hashes.sourceCsvSha256, salesExpected.source.sha256);
  assert.ok(salesRecord.hashes.candidateOutputSha256);
  assert.equal(salesRecord.gates.schema.status, "pass");
  assert.equal(salesRecord.gates["source-grounding"].status, "pass");
  assert.equal(salesRecord.gates["numeric-integrity"].status, "pass");
  assert.equal(salesRecord.gates["chart-integrity"].status, "pass");
  assert.equal(salesRecord.gates["minimum-content"].status, "needs-review");
  assert.equal(salesRecord.gates["scope-and-uncertainty"].status, "needs-review");
  assert.equal(salesRecord.gates["mixed-and-counter-evidence"].status, "needs-review");
  assert.equal(salesRecord.overallDecision, "needs-review");

  const feedbackRecord = evaluateAnalysisOffline({ caseId: "feedback-themes-v1", candidateData: validFeedbackCandidate() });
  assert.equal(feedbackRecord.gates["numeric-integrity"].status, "pass");
  assert.equal(feedbackRecord.gates["chart-integrity"].status, "pass");
  assert.equal(feedbackRecord.overallDecision, "needs-review");
});

test("rejects wrong case, wrong policy version, bad input hash, self-score and missing fields", () => {
  assert.equal(evaluateAnalysisOffline({ caseId: "missing-case", candidateData: validSalesCandidate() }).overallDecision, "fail");
  assert.equal(evaluateAnalysisOffline({ caseId: "sales-net-revenue-v1", expectedPolicyVersion: 99, candidateData: validSalesCandidate() }).overallDecision, "fail");
  assert.equal(evaluateAnalysisOffline({ caseId: "sales-net-revenue-v1", expectedInputSha256: "0".repeat(64), candidateData: validSalesCandidate() }).overallDecision, "fail");

  const selfScored = { ...validSalesCandidate(), selfScore: 100 };
  const selfScoreRecord = evaluateAnalysisOffline({ caseId: "sales-net-revenue-v1", candidateData: selfScored });
  assert.equal(selfScoreRecord.overallDecision, "fail");
  assert.match(selfScoreRecord.gates.schema.reason, /öz-puanı/);

  const missingField = validSalesCandidate();
  missingField.limitations = [];
  assert.equal(evaluateAnalysisOffline({ caseId: "sales-net-revenue-v1", candidateData: missingField }).overallDecision, "fail");
});

test("rejects numeric mismatch and forbidden chart type at the specific gate", () => {
  const wrongNumber = validSalesCandidate();
  wrongNumber.metrics[0].value = 2549.99;
  const numRecord = evaluateAnalysisOffline({ caseId: "sales-net-revenue-v1", candidateData: wrongNumber });
  assert.equal(numRecord.gates["numeric-integrity"].status, "fail");
  assert.equal(numRecord.overallDecision, "fail");

  const donutFeedback = validFeedbackCandidate();
  donutFeedback.charts[0].type = "donut";
  const chartRecord = evaluateAnalysisOffline({ caseId: "feedback-themes-v1", candidateData: donutFeedback });
  assert.equal(chartRecord.gates["chart-integrity"].status, "fail");
  assert.equal(chartRecord.overallDecision, "fail");
});

test("CLI returns non-zero exit code on invalid JSON and zero on structurally valid candidate needing review", () => {
  const dir = mkdtempSync(join(tmpdir(), "incagen-eval-cli-"));
  try {
    const badJsonPath = join(dir, "bad.json");
    writeFileSync(badJsonPath, "{not valid json", "utf8");
    const badRun = spawnSync(process.execPath, [
      "scripts/evaluate-analysis-offline.mjs",
      "--case", "sales-net-revenue-v1",
      "--candidate", badJsonPath,
    ], { encoding: "utf8" });
    assert.equal(badRun.status, 1);
    assert.equal(JSON.parse(badRun.stdout).overallDecision, "fail");

    const goodPath = join(dir, "good.json");
    const outPath = join(dir, "report.json");
    writeFileSync(goodPath, JSON.stringify(validSalesCandidate()), "utf8");
    const okRun = spawnSync(process.execPath, [
      "scripts/evaluate-analysis-offline.mjs",
      "--case", "sales-net-revenue-v1",
      "--candidate", goodPath,
      "--output", outPath,
    ], { encoding: "utf8" });
    assert.equal(okRun.status, 0);
    const report = JSON.parse(readFileSync(outPath, "utf8"));
    assert.equal(report.overallDecision, "needs-review");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
