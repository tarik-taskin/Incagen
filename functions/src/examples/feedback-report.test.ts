import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import labels from "../../../fixtures/analysis-reference/annotations/customer-feedback.v2.json";
import gold from "../../../fixtures/analysis-reference/examples/customer-feedback.v2.expected.json";
import artifact from "../../../src/features/reports/feedback-example.json";
import { parseDocument } from "../parsing";
import { validateAiResult } from "../analysis/result-contract";
import { createFeedbackExample } from "./feedback-report";

// Kaynak parser'ı ve insan etiketlerini kullanır; hesap beklentileri yalnız bağımsız cevap dosyasından gelir.
async function example() {
  const document = await parseDocument({ sourceId: "reference-feedback", fileName: "customer-feedback.csv", contentType: "text/csv", data: readFileSync(new URL("../../../fixtures/analysis-reference/examples/customer-feedback.v2.csv", import.meta.url)) });
  return { document, output: createFeedbackExample(document, labels.annotations, labels.sourceSha256) };
}
describe("insan etiketli geri bildirim raporu", () => {
  it("tema sözü, sorun ve duygu sayılarını bağımsız referansla eşleştirir", async () => {
    const { output } = await example();
    const value = (id: string) => output.result.metrics.find(item => item.id === id)!.value;
    expect(value("comments")).toBe(gold.comments);
    expect(value("negative-share")).toBe(gold.negativeCommentPercent);
    expect(value("positive-comments")).toBe(gold.positiveComments);
    expect(value("problem-comments")).toBe(gold.problemComments);
    for (const [id, count] of Object.entries(gold.problemMentions)) expect(value(`problem-${id}`)).toBe(count);
    for (const [id, count] of Object.entries(gold.themeMentions)) expect(value(`theme-${id}`)).toBe(count);
    for (const [id, count] of Object.entries(gold.sentimentCounts)) expect(value(`sentiment-${id}`)).toBe(count);
    expect(Number(value("positive-comments")) / Number(value("comments"))).toBe(0.8125);
    expect(output.result.metrics.find(item => item.id === "sentiment-negative")!.evidence.map(item => item.locator.rowStart)).toEqual([1, 2, 3, 4, 8]);
    expect(output.result.metrics.find(item => item.id === "csat")).toMatchObject({ status: "unavailable", value: null });
    expect(output.result.charts.filter(item => item.type === "donut").map(item => item.datasetId)).toEqual(["sentiments"]);
    expect(output.result.metrics.find(item => item.id === "problem-depth")!.evidence.map(item => item.locator.rowStart)).toEqual([7]);
  });
  it("özgün yorumları ve doğrulanmış sonucu artefakta aynen taşır", async () => {
    const { output } = await example();
    expect(output.result).toEqual(validateAiResult(output.result, output.validationContext));
    expect({ result: output.result, sources: output.sources, annotations: output.annotations }).toEqual(artifact);
    expect(output.result.findings.find(item => item.id === "mixed")!.statements[0].evidence.map(item => item.locator.rowStart)).toEqual([7]);
    expect(output.annotations.find(item => item.id === "F007")).toMatchObject({ sentiment: "mixed", themes: ["clarity", "depth"], problemThemes: ["depth"] });
  });
  it("yanlış hash, eksik/yinelenen etiket, yanlış alıntı ve desteklenmeyen sınıfları reddeder", async () => {
    const { document } = await example();
    expect(() => createFeedbackExample(document, labels.annotations, "0".repeat(64))).toThrow();
    expect(() => createFeedbackExample(document, labels.annotations.slice(1), labels.sourceSha256)).toThrow();
    for (const patch of [{ sourceRow: 2 }, { quote: "olmayan alıntı" }, { sentiment: "unknown" }, { themes: ["unknown"] }, { problemThemes: ["evidence"] }, { themes: ["clarity", "clarity"] }]) {
      const altered = structuredClone(labels.annotations); Object.assign(altered[0], patch);
      expect(() => createFeedbackExample(document, altered, labels.sourceSha256)).toThrow();
    }
  });
});
