import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().trim().min(1).max(4000);
const ids = z.array(id).max(100);
export const sourceLocatorSchema = z.object({
  page: z.number().int().positive().optional(), sheet: z.string().trim().min(1).max(200).optional(),
  slide: z.number().int().positive().optional(), section: z.string().trim().min(1).max(200).optional(),
  rowStart: z.number().int().positive().optional(), rowEnd: z.number().int().positive().optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Kaynak konumu boş olamaz.")
  .refine(value => (value.rowStart === undefined) === (value.rowEnd === undefined), "Satır aralığının iki sınırı da belirtilmeli.")
  .refine(value => value.rowStart === undefined || value.rowEnd! >= value.rowStart, "Satır aralığı ters olamaz.");
const evidenceSchema = z.object({ sourceId: id, sha256: hash, chunkId: id, locator: sourceLocatorSchema }).strict();
const evidenceList = z.array(evidenceSchema).min(1).max(100);
const metricBase = z.object({ id, label: z.string().trim().min(1).max(200), unit: z.string().trim().min(1).max(32), method: text, evidence: evidenceList }).strict();
const metricSchema = z.discriminatedUnion("status", [
  metricBase.extend({ status: z.literal("available"), value: z.number().finite() }).strict(),
  metricBase.extend({ status: z.literal("unavailable"), value: z.null(), reason: text }).strict(),
]);
const datasetSchema = z.object({
  id, label: z.string().trim().min(1).max(200), unit: z.string().trim().min(1).max(32),
  points: z.array(z.object({ label: z.string().trim().min(1).max(200), metricId: id, value: z.number().finite().nullable() }).strict()).min(1).max(500),
}).strict();
const statementSchema = z.object({ text, evidence: evidenceList, metricIds: ids }).strict();

// Sonuç v1 yapılandırılmış veridir; yürütülebilir kod alanı, bilinmeyen alan ve sınır dışı içerik kabul etmez.
export const aiResultSchema = z.object({
  schemaVersion: z.literal(1), analysisId: id, objective: z.string().trim().min(1).max(500),
  summary: z.array(statementSchema).min(1).max(10),
  findings: z.array(z.object({ id, title: z.string().trim().min(1).max(200), kind: z.enum(["observation", "interpretation"]), statements: z.array(statementSchema).min(1).max(10) }).strict()).min(1).max(50),
  recommendations: z.array(z.object({ id, action: text, basisFindingIds: ids.min(1) }).strict()).max(30),
  metrics: z.array(metricSchema).max(100), datasets: z.array(datasetSchema).max(20),
  charts: z.array(z.object({ id, title: z.string().trim().min(1).max(200), type: z.enum(["bar", "horizontal-bar", "line"]), datasetId: id }).strict()).max(20),
  limitations: z.array(text).min(1).max(30),
}).strict();

// Güvenilir bağlam backend/parser/hesaplayıcı tarafından sağlanır; model çıktısından oluşturulmaz.
const validationContextSchema = z.object({
  analysisId: id, objective: z.string().trim().min(1).max(500),
  sources: z.array(z.object({ id, sha256: hash, chunks: z.array(z.object({ id, locator: sourceLocatorSchema }).strict()).min(1).max(1000) }).strict()).min(1).max(20),
  metrics: z.array(metricSchema).max(100), datasets: z.array(datasetSchema).max(20),
}).strict();

export type AiResult = z.infer<typeof aiResultSchema>;
export type AiResultValidationContext = z.infer<typeof validationContextSchema>;
type Evidence = z.infer<typeof evidenceSchema>;
type Metric = z.infer<typeof metricSchema>;
type Dataset = z.infer<typeof datasetSchema>;

// Model sağlayıcısının yapı kontrolü için dışa aktarılır; kaynak/metrik doğrulaması ayrıca çalıştırılmalıdır.
export const aiResultJsonSchema = z.toJSONSchema(aiResultSchema, { target: "draft-2020-12" });

// Eşit içerikleri alan sırasından bağımsız karşılaştırır; metin ve dizi sırası korunur.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map(item => JSON.parse(canonical(item))));
  if (value !== null && typeof value === "object") return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, JSON.parse(canonical(item))])));
  return JSON.stringify(value);
}

// Bağlam ve sonuç içindeki kimlikleri tekilleştirir; ilk öğeyi sessizce seçmez.
function registry<T extends { id: string }>(items: T[], name: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    if (result.has(item.id)) throw new Error(`${name}: yinelenen kimlik.`);
    result.set(item.id, item);
  }
  return result;
}

// Kaynakta olmayan boyutları reddeder; tabloda yalnız güvenilir parçanın içindeki alt satır aralığına izin verir.
function validateEvidence(evidence: Evidence[], sources: Map<string, AiResultValidationContext["sources"][number]>) {
  const seen = new Set<string>();
  for (const item of evidence) {
    const key = canonical(item);
    if (seen.has(key)) throw new Error("Kaynak kanıtı yineleniyor.");
    seen.add(key);
    const source = sources.get(item.sourceId);
    if (!source || source.sha256 !== item.sha256) throw new Error("Kaynak kimliği/hash eşleşmiyor.");
    const chunk = source.chunks.find(part => part.id === item.chunkId);
    if (!chunk) throw new Error("Kaynak parçası bulunamadı.");
    const expected = chunk.locator;
    if (Object.keys(item.locator).sort().join() !== Object.keys(expected).sort().join()) throw new Error("Kaynak konumunun boyutları değiştirilemez.");
    for (const key of ["page", "sheet", "slide", "section"] as const) {
      if (item.locator[key] !== expected[key]) throw new Error("Kaynak konumu eşleşmiyor.");
    }
    if (expected.rowStart !== undefined && (item.locator.rowStart! < expected.rowStart || item.locator.rowEnd! > expected.rowEnd!)) throw new Error("Kaynak satırı parçanın dışında.");
  }
}

// Sayısal/metin yorumu karışmasını önler: veri kümesinin her noktası tek bir doğrulanmış metriğe bağlıdır.
function validateDataset(dataset: Dataset, metrics: Map<string, Metric>) {
  const labels = new Set<string>();
  for (const point of dataset.points) {
    if (labels.has(point.label)) throw new Error("Veri kümesi etiketi yineleniyor.");
    labels.add(point.label);
    const metric = metrics.get(point.metricId);
    if (!metric || metric.value !== point.value || metric.unit !== dataset.unit) throw new Error("Veri kümesi/metrik değeri veya birimi eşleşmiyor.");
  }
}

// Parser ve hesaplayıcı bağlamını modelden bağımsız doğrular; paket üreticisi de aynı kapıyı kullanır.
export function validateAiResultContext(trustedInput: unknown): AiResultValidationContext {
  const context = validationContextSchema.parse(trustedInput);
  const sources = registry(context.sources, "Kaynak");
  for (const source of sources.values()) registry(source.chunks, "Kaynak parçası");
  const trustedMetrics = registry(context.metrics, "Güvenilir metrik");
  const trustedDatasets = registry(context.datasets, "Güvenilir veri kümesi");
  for (const metric of trustedMetrics.values()) validateEvidence(metric.evidence, sources);
  for (const dataset of trustedDatasets.values()) validateDataset(dataset, trustedMetrics);
  return context;
}

// Sonucu güvenilir girdiye bağlar; geçerli yapı, serbest metnin anlamsal doğruluğunun kanıtı değildir.
export function validateAiResult(input: unknown, trustedInput: unknown): AiResult {
  const context = validateAiResultContext(trustedInput);
  const result = aiResultSchema.parse(input);
  if (result.analysisId !== context.analysisId || result.objective !== context.objective) throw new Error("Sonuç farklı çalışmaya/hedefe ait.");
  const sources = registry(context.sources, "Kaynak");
  const trustedMetrics = registry(context.metrics, "Güvenilir metrik");
  const trustedDatasets = registry(context.datasets, "Güvenilir veri kümesi");
  const metrics = registry(result.metrics, "Sonuç metriği");
  const datasets = registry(result.datasets, "Sonuç veri kümesi");
  const findings = registry(result.findings, "Bulgu");
  registry(result.recommendations, "Öneri");
  registry(result.charts, "Grafik");
  for (const metric of metrics.values()) {
    const expected = trustedMetrics.get(metric.id);
    if (!expected || canonical(metric) !== canonical(expected)) throw new Error("Sonuç metriği doğrulanmış hesapla eşleşmiyor.");
  }
  for (const dataset of datasets.values()) {
    const expected = trustedDatasets.get(dataset.id);
    if (!expected || canonical(dataset) !== canonical(expected)) throw new Error("Sonuç veri kümesi doğrulanmış hesapla eşleşmiyor.");
    validateDataset(dataset, metrics);
  }
  const usedMetricIds = new Set<string>();
  for (const statement of [...result.summary, ...result.findings.flatMap(finding => finding.statements)]) {
    validateEvidence(statement.evidence, sources);
    if (new Set(statement.metricIds).size !== statement.metricIds.length) throw new Error("İfade metriği yineleniyor.");
    for (const metricId of statement.metricIds) {
      const metric = metrics.get(metricId);
      if (!metric) throw new Error("İfade metriği sonuçta bulunamadı.");
      usedMetricIds.add(metricId);
      // İfadenin kanıtı, metrik pay/payda kapsamını da taşımalıdır; var olan ilgisiz satır yeterli değildir.
      for (const anchor of metric.evidence) {
        const covered = statement.evidence.some(item => item.sourceId === anchor.sourceId && item.chunkId === anchor.chunkId
          && item.sha256 === anchor.sha256 && (anchor.locator.rowStart === undefined
            ? canonical(item.locator) === canonical(anchor.locator)
            : item.locator.rowStart! <= anchor.locator.rowStart && item.locator.rowEnd! >= anchor.locator.rowEnd!));
        if (!covered) throw new Error("İfade kanıtı metrik kapsamını içermiyor.");
      }
    }
  }
  for (const recommendation of result.recommendations) {
    if (new Set(recommendation.basisFindingIds).size !== recommendation.basisFindingIds.length || recommendation.basisFindingIds.some(key => !findings.has(key))) throw new Error("Önerinin bulgu dayanağı eksik veya yineleniyor.");
  }
  for (const chart of result.charts) {
    const dataset = datasets.get(chart.datasetId);
    if (!dataset) throw new Error("Grafik veri kümesi sonuçta bulunamadı.");
    const available = dataset.points.filter(point => point.value !== null).length;
    if (!available || (chart.type === "line" && available < 2)) throw new Error("Grafik türü için yeterli doğrulanmış sayısal değer yok.");
    for (const point of dataset.points) if (!usedMetricIds.has(point.metricId)) throw new Error("Grafik metriği kaynaklı bulgu/özette kullanılmıyor.");
  }
  return result;
}
