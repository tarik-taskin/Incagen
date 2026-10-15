import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sales from "../../../fixtures/analysis-reference/v1/sales.expected.json";
import feedback from "../../../fixtures/analysis-reference/v1/customer-feedback.expected.json";
import { aiResultJsonSchema, aiResultSchema, validateAiResult, type AiResult, type AiResultValidationContext } from "./result-contract";

// İki bağımsız doğrulanan cevap anahtarından yalnız test girdisi üretir; anahtarlar üretime/model bağlamına taşınmaz.
function sample(kind: "sales" | "feedback") {
  const reference = kind === "sales" ? sales : feedback;
  const source = { id: reference.source.sourceId, sha256: reference.source.sha256, chunks: [{ id: reference.source.chunkId, locator: { rowStart: 1, rowEnd: reference.source.dataRows } }] };
  const anchor = (rowStart: number, rowEnd = rowStart) => ({ sourceId: source.id, sha256: source.sha256, chunkId: source.chunks[0].id, locator: { rowStart, rowEnd } });
  const metrics: AiResult["metrics"] = kind === "sales" ? [
    { id: "september", label: "Eylül net satış", unit: "TRY", method: "İptal hariç net satış; satır toplamı.", status: "available", value: sales.metrics.monthlyNetSalesTry["2026-09"], evidence: [anchor(1, 4)] },
    { id: "october", label: "Ekim net satış", unit: "TRY", method: "İptal hariç; indirim ve işlenen iade dahil net satış.", status: "available", value: sales.metrics.monthlyNetSalesTry["2026-10"], evidence: [anchor(6, 11)] },
  ] : [{ id: "delivery", label: "Teslimat sorunu", unit: "yorum", method: "İnsan etiketleriyle benzersiz sorun yorumu sayısı.", status: "available", value: feedback.metrics.problemMentions.delivery, evidence: feedback.findings[0].sourceRows.map(row => anchor(row)) }];
  const datasets: AiResult["datasets"] = [{ id: "comparison", label: "Kaynaklı karşılaştırma", unit: metrics[0].unit, points: metrics.map(metric => ({ label: metric.label, metricId: metric.id, value: metric.value })) }];
  const context: AiResultValidationContext = { analysisId: `analysis-${kind}`, objective: reference.objective, sources: [source], metrics, datasets };
  const statement = { text: "Sentetik kaynağın doğrulanmış değerleri karşılaştırılıyor.", evidence: [anchor(1, reference.source.dataRows)], metricIds: metrics.map(metric => metric.id) };
  const result: AiResult = {
    schemaVersion: 1, analysisId: context.analysisId, objective: context.objective,
    summary: [statement], findings: [{ id: "finding-1", title: "Kaynaklı bulgu", kind: "observation", statements: [statement] }],
    recommendations: [{ id: "action-1", action: "Kaynak kapsamını koruyarak operasyon kayıtlarıyla inceleyin.", basisFindingIds: ["finding-1"] }],
    metrics: structuredClone(metrics), datasets: structuredClone(datasets), charts: [{ id: "chart-1", title: "Karşılaştırma", type: kind === "sales" ? "bar" : "horizontal-bar", datasetId: "comparison" }],
    limitations: ["Sentetik kaynak; ölçüm kapsamı dışına genellenemez."],
  };
  return { result, context };
}

describe("AI sonuç v1: yapı, kaynak ve doğrulanmış hesap bağları", () => {
  it.each(["sales", "feedback"] as const)("%s referansını kabul eder; girdileri değiştirmez", kind => {
    const { result, context } = sample(kind);
    const before = JSON.stringify({ result, context });
    expect(validateAiResult(result, context)).toEqual(result);
    expect(JSON.stringify({ result, context })).toBe(before);
  });

  it("ayrık kaynak aralıkları 256 ile sınırlı kalır", () => {
    const { result } = sample("sales");
    const expanded = structuredClone(result);
    expanded.metrics[0].evidence = Array.from({ length: 256 }, () => result.metrics[0].evidence[0]);
    expect(aiResultSchema.safeParse(expanded).success).toBe(true);
    expanded.metrics[0].evidence.push(result.metrics[0].evidence[0]);
    expect(aiResultSchema.safeParse(expanded).success).toBe(false);
  });

  it("yayımlanmış JSON Schema'yı kodun tek kaynağıyla eşit tutar", () => {
    const published = JSON.parse(readFileSync(new URL("../../../docs/contracts/ai-result.v1.schema.json", import.meta.url), "utf8"));
    expect(published).toEqual(aiResultJsonSchema);
    expect(published.additionalProperties).toBe(false);
  });

  it.each([
    ["şema sürümü", (r: AiResult) => ({ ...r, schemaVersion: 2 })],
    ["başka çalışma", (r: AiResult) => ({ ...r, analysisId: "other" })],
    ["başka hedef", (r: AiResult) => ({ ...r, objective: "Başka soru" })],
    ["fazladan kod alanı", (r: AiResult) => ({ ...r, code: "throw new Error()" })],
    ["boş özet", (r: AiResult) => ({ ...r, summary: [] })],
    ["sınırlamasız sonuç", (r: AiResult) => ({ ...r, limitations: [] })],
    ["bilinmeyen kaynak", (r: AiResult) => { r.summary[0].evidence[0].sourceId = "missing"; return r; }],
    ["yanlış hash", (r: AiResult) => { r.summary[0].evidence[0].sha256 = "a".repeat(64); return r; }],
    ["başka kaynak parçası", (r: AiResult) => { r.summary[0].evidence[0].chunkId = "missing"; return r; }],
    ["sınır dışı satır", (r: AiResult) => { r.summary[0].evidence[0].locator.rowEnd = 13; return r; }],
    ["ters satır", (r: AiResult) => { r.summary[0].evidence[0].locator.rowEnd = 0; return r; }],
    ["uydurulmuş sayfa", (r: AiResult) => { r.summary[0].evidence[0].locator.page = 1; return r; }],
    ["eksik konum boyutu", (r: AiResult) => { delete r.summary[0].evidence[0].locator.rowEnd; return r; }],
    ["yinelenen kanıt", (r: AiResult) => { r.summary[0].evidence.push(structuredClone(r.summary[0].evidence[0])); return r; }],
    ["doğru ama ilgisiz satır", (r: AiResult) => { r.summary[0].evidence[0].locator = { rowStart: 2, rowEnd: 2 }; return r; }],
    ["yanlış hesap", (r: AiResult) => { r.metrics[0].value = 1001; return r; }],
    ["sayısal taşma", (r: AiResult) => { r.metrics[0].value = Infinity; return r; }],
    ["sahte birim", (r: AiResult) => { r.metrics[0].unit = "USD"; return r; }],
    ["modelin değiştirdiği hesap yöntemi", (r: AiResult) => { r.metrics[0].method = "İptalleri dahil et."; return r; }],
    ["sonuçta olmayan metrik", (r: AiResult) => { r.metrics = []; return r; }],
    ["yinelenen kimlik", (r: AiResult) => { r.metrics.push(structuredClone(r.metrics[0])); return r; }],
    ["yinelenen ifade metriği", (r: AiResult) => { r.summary[0].metricIds.push(r.summary[0].metricIds[0]); return r; }],
    ["kopuk öneri", (r: AiResult) => { r.recommendations[0].basisFindingIds = ["missing"]; return r; }],
    ["yinelenen öneri dayanağı", (r: AiResult) => { r.recommendations[0].basisFindingIds = ["finding-1", "finding-1"]; return r; }],
    ["grafikte yanlış değer", (r: AiResult) => { r.datasets[0].points[0].value = 999; return r; }],
    ["grafikte uydurma dönem", (r: AiResult) => { r.datasets[0].points[0].label = "Kasım tahmini"; return r; }],
    ["grafikte başka veri kümesi", (r: AiResult) => { r.charts[0].datasetId = "missing"; return r; }],
    ["kaynaklı metinde kullanılmayan grafik metriği", (r: AiResult) => { r.summary[0].metricIds = []; r.findings[0].statements[0].metricIds = []; return r; }],
  ])("%s reddedilir", (_name, mutate) => {
    const { result, context } = sample("sales");
    expect(() => validateAiResult(mutate(structuredClone(result)), context)).toThrow();
  });

  it("metin vakasında sayısal veri/grafik zorlamaz", () => {
    const { result, context } = sample("feedback");
    context.metrics = []; context.datasets = [];
    result.metrics = []; result.datasets = []; result.charts = [];
    result.summary[0].metricIds = []; result.findings[0].statements[0].metricIds = [];
    expect(validateAiResult(result, context)).toEqual(result);
  });

  it("eksik değeri sıfıra çevirmeyi reddeder; gerçek sıfırı ve negatif iadeyi korur", () => {
    for (const value of [0, -100]) {
      const { result, context } = sample("sales");
      context.metrics[0].value = value; context.datasets[0].points[0].value = value;
      result.metrics[0].value = value; result.datasets[0].points[0].value = value;
      expect(validateAiResult(result, context).metrics[0].value).toBe(value);
    }
    const { result, context } = sample("sales");
    context.metrics[0] = { ...context.metrics[0], status: "unavailable", value: null, reason: "Kaynak eksik." };
    context.datasets[0].points[0].value = null;
    result.metrics = structuredClone(context.metrics); result.datasets = structuredClone(context.datasets);
    expect(validateAiResult(result, context).metrics[0].value).toBeNull();
    result.datasets[0].points[0].value = 0;
    expect(() => validateAiResult(result, context)).toThrow();
  });

  it("hatalı güvenilir bağlamı da reddeder", () => {
    const { result, context } = sample("sales");
    const duplicate = structuredClone(context); duplicate.sources.push(structuredClone(context.sources[0]));
    expect(() => validateAiResult(result, duplicate)).toThrow();
    const invalidChunk = structuredClone(context); invalidChunk.sources[0].chunks.push(structuredClone(context.sources[0].chunks[0]));
    expect(() => validateAiResult(result, invalidChunk)).toThrow();
    const wrongDataset = structuredClone(context); wrongDataset.datasets[0].points[0].value = 2;
    expect(() => validateAiResult(result, wrongDataset)).toThrow();
    const wrongEvidence = structuredClone(context); wrongEvidence.metrics[0].evidence[0].sha256 = "b".repeat(64);
    expect(() => validateAiResult(result, wrongEvidence)).toThrow();
  });

  it("grafikte tümü eksik veriyi ve tek noktalı çizgi önerisini reddeder", () => {
    const { result, context } = sample("feedback");
    result.charts[0].type = "line";
    expect(() => validateAiResult(result, context)).toThrow();
    result.charts[0].type = "horizontal-bar";
    context.metrics[0] = { ...context.metrics[0], status: "unavailable", value: null, reason: "Kaynak eksik." };
    context.datasets[0].points[0].value = null;
    result.metrics = structuredClone(context.metrics); result.datasets = structuredClone(context.datasets);
    expect(() => validateAiResult(result, context)).toThrow();
    result.charts = [];
    expect(validateAiResult(result, context).metrics[0].value).toBeNull();
  });

  it("sayfa ve çalışma sayfası boyutlarını da gerçek parça konumuna bağlar", () => {
    const { result, context } = sample("feedback");
    const pageLocator = { page: 2 };
    context.sources[0].chunks[0].locator = pageLocator;
    for (const metric of context.metrics) metric.evidence = [{ ...metric.evidence[0], locator: pageLocator }];
    result.metrics = structuredClone(context.metrics);
    for (const statement of [...result.summary, ...result.findings.flatMap(finding => finding.statements)]) statement.evidence = [{ ...statement.evidence[0], locator: pageLocator }];
    expect(validateAiResult(result, context)).toEqual(result);
    result.summary[0].evidence[0].locator = { page: 3 };
    expect(() => validateAiResult(result, context)).toThrow();
    result.summary[0].evidence[0].locator = { sheet: "Olmayan sayfa" };
    expect(() => validateAiResult(result, context)).toThrow();
  });
});


describe("halka grafiği kapsamı", () => {
  it("doğrulanmış pozitif parçaları kabul eder", () => {
    const { result, context } = sample("sales");
    result.charts[0].type = "donut";
    expect(validateAiResult(result, context).charts[0].type).toBe("donut");
  });
  it.each(["negative", "missing", "zero", "single"])("uygunsuz parçaları reddeder: %s", kind => {
    const { result, context } = sample("sales");
    result.charts[0].type = "donut";
    if (kind === "single") { context.datasets[0].points.pop(); result.datasets[0].points.pop(); }
    else {
      for (const target of [context, result]) {
        target.metrics[0] = kind === "missing" ? { ...target.metrics[0], status: "unavailable", value: null, reason: "Eksik" } : { ...target.metrics[0], status: "available", value: kind === "negative" ? -1 : 0 };
        target.datasets[0].points[0].value = target.metrics[0].value;
        if (kind === "zero") { target.metrics[1].value = 0; target.datasets[0].points[1].value = 0; }
      }
    }
    expect(() => validateAiResult(result, context)).toThrow(/Halka/);
  });
});
