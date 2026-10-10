import { z } from "zod";

// Yalnız test referanslarının yapısını doğrular; üretim sonuç veya LLM sözleşmesi değildir.
const rowsSchema = z.array(z.number().int().positive()).min(1).refine(rows => new Set(rows).size === rows.length, "Kaynak satırı yinelenemez.");
const idsSchema = z.array(z.string().min(1)).min(1).refine(ids => new Set(ids).size === ids.length, "Kimlik yinelenemez.");
const base = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  synthetic: z.literal(true),
  objective: z.string().trim().min(1).max(500),
  source: z.object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/), file: z.enum(["sales.csv", "customer-feedback.csv"]),
    sourceId: z.string().min(1), chunkId: z.string().min(1),
    dataRows: z.number().int().positive(), rowStart: z.literal(1), rowEnd: z.number().int().positive(),
  }).strict(),
  definitions: z.record(z.string(), z.unknown()),
  metrics: z.record(z.string(), z.unknown()),
  findings: z.array(z.object({ id: z.string().min(1), claim: z.string().min(1), metricPaths: idsSchema, sourceRows: rowsSchema, denominatorRows: rowsSchema.optional() }).strict()).min(1),
  recommendations: z.array(z.object({ id: z.string().min(1), action: z.string().min(1), basisFindingIds: idsSchema, kind: z.literal("investigation"), sourceRows: rowsSchema.optional(), mustNotClaim: z.string().min(1).optional() }).strict()).min(1),
  charts: z.array(z.object({ id: z.string().min(1), type: z.enum(["bar", "horizontal-bar"]), x: idsSchema, y: z.array(z.number().finite()).min(1), unit: z.enum(["TRY", "yorum"]), metricPath: z.string().min(1), sourceRows: rowsSchema, rules: z.array(z.string().min(1)).min(1) }).strict()).min(1),
  limitations: z.array(z.string().min(1)).min(1),
  forbiddenClaims: z.array(z.string().min(1)).min(1),
});

const referenceSchema = z.discriminatedUnion("caseId", [
  base.extend({ caseId: z.literal("sales-net-revenue-v1"), rowAmountsTry: z.record(z.string(), z.number().finite()) }).strict(),
  base.extend({ caseId: z.literal("feedback-themes-v1"), annotations: z.array(z.object({
    id: z.string().min(1), sourceRow: z.number().int().positive(), quote: z.string().min(1),
    themes: idsSchema, problemThemes: z.array(z.string().min(1)).refine(ids => new Set(ids).size === ids.length),
    sentiment: z.enum(["positive", "negative", "mixed"]),
  }).strict()).min(1) }).strict(),
]);

export type Reference = z.infer<typeof referenceSchema>;

// Nesne/satır referanslarını ve kapsamlarını birlikte doğrular; mevcut satır, ilgili kanıt anlamına gelmez.
export function validateReference(input: unknown): Reference {
  const result = referenceSchema.parse(input);
  if (result.source.rowEnd !== result.source.dataRows) throw new Error("Kaynak satır kapsamı tutarsız.");
  if (result.source.chunkId !== `${result.source.sourceId}:table:0001`) throw new Error("Chunk kimliği kaynağa ait değil.");
  const findingIds = result.findings.map(item => item.id);
  if (new Set(findingIds).size !== findingIds.length) throw new Error("Bulgu kimliği yineleniyor.");
  for (const items of [result.recommendations, result.charts]) {
    if (new Set(items.map(item => item.id)).size !== items.length) throw new Error("Öğe kimliği yineleniyor.");
  }
  for (const item of result.findings) {
    for (const path of item.metricPaths) if (!Object.hasOwn(result.metrics, path)) throw new Error("Bulgu metriği bulunamadı.");
    for (const row of [...item.sourceRows, ...(item.denominatorRows ?? [])]) {
      if (row > result.source.dataRows) throw new Error("Kaynak satırı kapsam dışında.");
    }
  }
  for (const recommendation of result.recommendations) {
    const anchors = recommendation.basisFindingIds.map(id => result.findings.find(item => item.id === id));
    if (anchors.some(item => !item)) throw new Error("Önerinin bulgu dayanağı bulunamadı.");
    const evidence = new Set(anchors.flatMap(item => item!.sourceRows));
    if (recommendation.sourceRows?.some(row => !evidence.has(row))) throw new Error("Öneri kaynağı bulgu dayanağıyla uyuşmuyor.");
  }
  for (const chart of result.charts) {
    const data = result.metrics[chart.metricPath];
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Grafik metriği tablo değil.");
    if (chart.x.length !== chart.y.length) throw new Error("Grafik seri boyutları tutarsız.");
    if (chart.x.some((key, index) => (data as Record<string, unknown>)[key] !== chart.y[index])) throw new Error("Grafik doğrulanmış metriğe eşleşmiyor.");
    if (chart.sourceRows.some(row => row > result.source.dataRows)) throw new Error("Grafik kaynağı kapsam dışında.");
    if (chart.unit !== (result.caseId === "sales-net-revenue-v1" ? "TRY" : "yorum")) throw new Error("Grafik birimi vakayla uyuşmuyor.");
  }
  return result;
}
