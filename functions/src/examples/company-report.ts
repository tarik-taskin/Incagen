import type { ParsedDocument, DocumentChunk } from "../contracts";
import { validateAiResult, type AiResult, type AiResultValidationContext } from "../analysis/result-contract";

type Metric = AiResult["metrics"][number];
type Evidence = Metric["evidence"];
type Row = { values: Record<string, string>; source: ParsedDocument; chunk: DocumentChunk; number: number };
export const COMPANY_PERIODS = { year: { label: "2025 · Tam yıl", months: [1, 12] }, h1: { label: "2025 · İlk 6 ay", months: [1, 6] }, h2: { label: "2025 · Son 6 ay", months: [7, 12] }, q4: { label: "2025 · Son çeyrek", months: [10, 12] } } as const;
export type CompanyPeriod = keyof typeof COMPANY_PERIODS;
const monthLabels = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// Parser'ın gerçek satır numarası ve parçasını kaybetmeden örnek tabloları hesaplanabilir kayıtlara açar.
function sourceRows(source: ParsedDocument): Row[] {
  return source.chunks.flatMap(chunk => {
    if (!chunk.table) throw new Error("Şirket örneğinin tablo parçası eksik.");
    return chunk.table.rows.map((cells, index) => {
      if (cells.length !== chunk.table!.columns.length) throw new Error("Şirket örneğinde sütun uyuşmazlığı.");
      const values = Object.fromEntries(chunk.table!.columns.map((key, column) => [key, String(cells[column])]));
      if (!/^2025-(0[1-9]|1[0-2])$/.test(values.period)) throw new Error("Şirket örneğinde geçersiz dönem.");
      return { values, source, chunk, number: (chunk.locator.rowStart ?? 1) + index };
    });
  });
}

// Yalnız bitişik gerçek satırları birleştirir; kategori/kanal kanıtının arasına başka kayıtlar girmez.
function anchors(rows: Row[]): Evidence {
  const sorted = [...rows].sort((a, b) => a.source.sourceId.localeCompare(b.source.sourceId) || a.number - b.number);
  const result: Evidence = [];
  for (const row of sorted) {
    const previous = result[result.length - 1];
    if (previous?.sourceId === row.source.sourceId && previous.chunkId === row.chunk.id && previous.locator.rowEnd === row.number - 1) previous.locator.rowEnd = row.number;
    else result.push({ sourceId: row.source.sourceId, sha256: row.source.sha256, chunkId: row.chunk.id, locator: { ...row.chunk.locator, rowStart: row.number, rowEnd: row.number } });
  }
  return result;
}

// Örnek mali alanlarını kuruşa çevirir; boş/negatif/geçersiz sayı ve hassasiyet kaybını reddeder.
function amount(row: Row, key: string) {
  const value = row.values[key];
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(`Şirket örneğinde geçersiz sayı: ${key}`);
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("Şirket örneğinde tutar güvenli sayısal sınırı aşıyor.");
  return cents;
}
const sum = (rows: Row[], key: string) => rows.reduce((total, row) => total + amount(row, key), 0);
const net = (rows: Row[]) => sum(rows, "gross_sales_try") - sum(rows, "discount_try") - sum(rows, "refund_try");
const profit = (rows: Row[]) => net(rows) - sum(rows, "cost_of_goods_try");
const integer = (rows: Row[], key: string) => sum(rows, key) / 100;

// Yalnız kurgusal şirket örneğini hesaplar; bütün dönem görünümleri aynı kaynaklardan yeniden türetilir ve doğrulanır.
export function createCompanyReport(documents: ParsedDocument[], period: CompanyPeriod = "year") {
  const salesSource = documents.find(item => item.sourceId === "atlas-sales");
  const budgetSource = documents.find(item => item.sourceId === "atlas-budget");
  const operationSource = documents.find(item => item.sourceId === "atlas-operations");
  if (![3, 5].includes(documents.length) || !salesSource || !budgetSource || !operationSource) throw new Error("Şirket örneğinin üç kaynağı bulunmalı.");
  const allSales = sourceRows(salesSource), allBudget = sourceRows(budgetSource), allOperations = sourceRows(operationSource);
  const enterprise = documents.length === 5;
  if (allSales.length !== (enterprise ? 3456 : 864) || allBudget.length !== 12 || allOperations.length !== (enterprise ? 144 : 72)) throw new Error("Şirket örneğinin kaynak satır sayısı değişti.");
  if (new Set(allSales.map(row => row.values.record_id)).size !== allSales.length) throw new Error("Şirket örneğinde yinelenen satış kaydı.");
  const narrativeSources = documents.filter(source => ["atlas-review", "atlas-commercial"].includes(source.sourceId));
  if (enterprise && (narrativeSources.length !== 2 || !narrativeSources.some(source => source.extension === "pdf" && source.metadata.pages === 7) || !narrativeSources.some(source => source.extension === "docx") || narrativeSources.some(source => !source.chunks.every(chunk => chunk.text?.trim())))) throw new Error("Kurumsal örneğin PDF/Word kaynakları eksik.");
  const briefings = narrativeSources.map(source => {
    const chunk = source.extension === "pdf" ? source.chunks.find(item => item.locator.page === 7)! : source.chunks.find(item => item.text?.includes("Müşteri edinme maliyeti"))!;
    if (!chunk) throw new Error("Yönetim değerlendirmesinin kaynak bölümü eksik.");
    const text = source.extension === "pdf" ? "Kanal yatırımı kararı için brüt marj, sipariş başına katkı ve karşılanabilen talep birlikte incelenmelidir." : "Müşteri edinme maliyeti, tekrar satın alma, kanal komisyonu ve müşteri yaşam boyu değeri bu dosyada ayrı ölçülmemiştir.";
    const excerptChunk = source.chunks.find(item => item.text?.replace(/\s+/g, " ").includes(text));
    if (!excerptChunk) throw new Error("Belge alıntısı özgün kaynakta bulunamadı.");
    return { sourceId: source.sourceId, title: source.extension === "pdf" ? "Kanal yatırımını katkıyla birlikte okuyun." : "Karardan önce eksik bağlamı tamamlayın.", text, evidence: [{ sourceId: source.sourceId, sha256: source.sha256, chunkId: excerptChunk.id, locator: excerptChunk.locator }] };
  });
  const { months, label } = COMPANY_PERIODS[period];
  const contains = (row: Row) => Number(row.values.period.slice(-2)) >= months[0] && Number(row.values.period.slice(-2)) <= months[1];
  const sales = allSales.filter(contains), budgets = allBudget.filter(contains), operations = allOperations.filter(contains);
  for (const row of operations) if (integer([row], "on_time_orders") + integer([row], "late_orders") !== integer([row], "shipped_orders")) throw new Error("Operasyon toplamı tutarsız.");
  if (integer(sales, "orders") !== integer(operations, "shipped_orders")) throw new Error("Satış/operasyon sipariş toplamı uyuşmuyor.");
  const metrics: Metric[] = [];
  const add = (id: string, name: string, value: number, unit: string, method: string, rows: Row[]) => {
    metrics.push({ id, label: name, status: "available", value, unit, method, evidence: anchors(rows) });
    return id;
  };
  const currency = (id: string, name: string, cents: number, rows: Row[], method: string) => add(id, name, cents / 100, "TRY", method, rows);
  currency("net-sales", "Net satış", net(sales), sales, "Brüt satış − satır toplam indirimi − iade tutarı; KDV hariç.");
  currency("gross-sales", "Brüt satış", sum(sales, "gross_sales_try"), sales, "gross_sales_try toplamı; indirim ve iade öncesi.");
  currency("discounts", "İndirimler", sum(sales, "discount_try"), sales, "Satır toplam indirimlerinin toplamı; adet başına uygulanmaz.");
  currency("refunds", "İadeler", sum(sales, "refund_try"), sales, "Seçili döneme işlenen iade tutarlarının toplamı.");
  currency("cost", "Satılan mal maliyeti", sum(sales, "cost_of_goods_try"), sales, "İade sonrası net mal maliyetinin toplamı.");
  currency("gross-profit", "Brüt kâr", profit(sales), sales, "Net satış − satılan mal maliyeti; net kâr değildir.");
  currency("marketing", "Pazarlama", sum(sales, "marketing_try"), sales, "Pazarlama giderlerinin toplamı.");
  currency("fulfillment", "Sipariş karşılama", sum(sales, "fulfillment_try"), sales, "Sipariş karşılama giderlerinin toplamı.");
  currency("contribution", "Katkı tutarı", profit(sales) - sum(sales, "marketing_try") - sum(sales, "fulfillment_try"), sales, "Brüt kâr − pazarlama − sipariş karşılama; işletme gideri/vergi/finansman hariçtir.");
  add("margin", "Brüt kâr marjı", profit(sales) * 100 / net(sales), "%", "Toplam brüt kâr / toplam net satış × 100; satır oranlarının ortalaması değildir.", sales);
  add("orders", "Sipariş", integer(sales, "orders"), "sipariş", "Ayrık ay/bölge/kanal/kategori/segment kırılımlarındaki sipariş toplamı.", sales);
  currency("aov", "Ortalama sipariş", Math.round(net(sales) / integer(sales, "orders")), sales, "Toplam net satış / toplam sipariş; kuruşa yuvarlanır.");
  currency("target", "Satış bütçesi", sum(budgets, "net_sales_budget_try"), budgets, "Seçili aylardaki satış bütçesi toplamı; tahmin değildir.");
  currency("variance", "Bütçe farkı", net(sales) - sum(budgets, "net_sales_budget_try"), [...sales, ...budgets], "Net satış − aynı dönem satış bütçesi.");
  add("target-rate", "Bütçe gerçekleşmesi", net(sales) * 100 / sum(budgets, "net_sales_budget_try"), "%", "Toplam net satış / toplam satış bütçesi × 100.", [...sales, ...budgets]);
  add("on-time", "Zamanında teslimat", integer(operations, "on_time_orders") * 100 / integer(operations, "shipped_orders"), "%", "Toplam zamanında teslim edilen / toplam sevk edilen sipariş × 100; aylık yüzdelerin ortalaması değildir.", operations);
  const monthly = Array.from({ length: months[1] - months[0] + 1 }, (_, index) => {
    const month = months[0] + index, code = `2025-${String(month).padStart(2, "0")}`;
    const rows = sales.filter(row => row.values.period === code), budget = budgets.filter(row => row.values.period === code), ops = operations.filter(row => row.values.period === code);
    currency(`net-${month}`, monthLabels[month - 1], net(rows), rows, "Ayın brüt satış − indirim − iade toplamı.");
    currency(`target-${month}`, monthLabels[month - 1], sum(budget, "net_sales_budget_try"), budget, "Ayın net satış bütçesi.");
    currency(`profit-${month}`, monthLabels[month - 1], profit(rows), rows, "Ayın net satış − net mal maliyeti.");
    add(`ontime-${month}`, monthLabels[month - 1], integer(ops, "on_time_orders") * 100 / integer(ops, "shipped_orders"), "%", "Ayın toplam zamanında teslimatı / toplam sevk edilen sipariş × 100.", ops);
    return { month, label: monthLabels[month - 1], net: net(rows) / 100, budget: sum(budget, "net_sales_budget_try") / 100, profit: profit(rows) / 100, margin: profit(rows) * 100 / net(rows), orders: integer(rows, "orders"), onTime: integer(ops, "on_time_orders") * 100 / integer(ops, "shipped_orders") };
  });
  const groups = (key: string) => [...new Set(sales.map(row => row.values[key]))].map(name => {
    const rows = sales.filter(row => row.values[key] === name);
    const metricId = `${key}-${name}`;
    currency(metricId, name, net(rows), rows, `${name} kırılımında brüt − indirim − iade; seçili dönem toplamı.`);
    return { name, metricId, net: net(rows) / 100, profit: profit(rows) / 100, margin: profit(rows) * 100 / net(rows), orders: integer(rows, "orders"), contribution: (profit(rows) - sum(rows, "marketing_try") - sum(rows, "fulfillment_try")) / 100, share: net(rows) * 100 / net(sales), evidence: anchors(rows) };
  }).sort((a, b) => b.net - a.net);
  const categories = groups("category"), channels = groups("channel"), regions = groups("region");
  const lookup = (id: string) => metrics.find(item => item.id === id)!;
  const dataset = (id: string, name: string, unit: string, ids: string[]): AiResult["datasets"][number] => ({ id, label: name, unit, points: ids.map(metricId => ({ label: lookup(metricId).label, metricId, value: lookup(metricId).value })) });
  const datasets = [dataset("monthly-net", "Aylık net satış", "TRY", monthly.map(row => `net-${row.month}`)), dataset("monthly-target", "Aylık satış bütçesi", "TRY", monthly.map(row => `target-${row.month}`)), dataset("monthly-profit", "Aylık brüt kâr", "TRY", monthly.map(row => `profit-${row.month}`)), dataset("monthly-service", "Zamanında teslimat", "%", monthly.map(row => `ontime-${row.month}`)), dataset("categories", "Kategori katkısı", "TRY", categories.map(row => row.metricId)), dataset("channels", "Kanal dağılımı", "TRY", channels.map(row => row.metricId)), dataset("regions", "Bölgesel net satış", "TRY", regions.map(row => row.metricId))];
  const money = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n) + " TL";
  const pct = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(n);
  const allRows = [...sales, ...budgets, ...operations];
  const statement = (text: string, metricIds: string[]) => ({ text, metricIds, evidence: anchors(allRows) });
  const context: AiResultValidationContext = { analysisId: `atlas-2025-${period}`, objective: "Net satış, bütçe gerçekleşmesi, kanal/kategori katkısı, brüt kârlılık ve teslimat performansını aynı dönem ve kaynak kapsamıyla değerlendir.", sources: documents.map(source => ({ id: source.sourceId, sha256: source.sha256, chunks: source.chunks.map(chunk => ({ id: chunk.id, locator: chunk.locator })) })), metrics, datasets };
  const findings: AiResult["findings"] = [
    { id: "growth", title: "Geliri bütçeyle birlikte değerlendirin", kind: "observation", statements: [statement(`${label} net satışı ${money(net(sales) / 100)}; bütçe gerçekleşmesi %${pct(lookup("target-rate").value!)}. İlk ay ${money(monthly[0].net)}, son ay ${money(monthly[monthly.length - 1].net)} net satış üretiyor.`, ["net-sales", "target-rate", "variance", ...monthly.flatMap(row => [`net-${row.month}`, `target-${row.month}`])])] },
    { id: "mix", title: "Büyümeyi taşıyan kırılımları ayırın", kind: "observation", statements: [statement(`${categories[0].name} ${money(categories[0].net)} ile en yüksek kategori satışını oluşturuyor. ${channels[0].name}, kanal satışlarında %${pct(channels[0].share)} paya sahip. Kanal marjları ve sipariş hacimleri birlikte okunmalı.`, [...categories, ...channels, ...regions].map(row => row.metricId))] },
    { id: "quality", title: "Hacmi, marj ve hizmetle dengeleyin", kind: "observation", statements: [statement(`Brüt kâr ${money(profit(sales) / 100)}, brüt marj %${pct(lookup("margin").value!)}. Pazarlama ve sipariş karşılama sonrasında katkı ${money(lookup("contribution").value!)}; zamanında teslimat %${pct(lookup("on-time").value!)}. Katkı tutarı net kâr değildir.`, ["gross-profit", "margin", "contribution", "on-time", ...monthly.flatMap(row => [`profit-${row.month}`, `ontime-${row.month}`])])] },
  ];
  const result = validateAiResult({ schemaVersion: 1, analysisId: context.analysisId, objective: context.objective, metrics, datasets,
    summary: [statement(`${money(net(sales) / 100)} net satış ve %${pct(lookup("target-rate").value!)} bütçe gerçekleşmesi. ${channels[0].name} en yüksek gelirli kanal; ${categories[0].name} en yüksek gelirli kategori.`, ["net-sales", "target-rate", channels[0].metricId, categories[0].metricId]), statement(`%${pct(lookup("margin").value!)} brüt marjı, %${pct(lookup("on-time").value!)} zamanında teslimatla birlikte izleyin.`, ["margin", "on-time"])], findings,
    recommendations: [{ id: "mix-review", action: "Kanal bütçelerini yalnız gelir büyüklüğüne göre dağıtmayın. Kanal tablosundaki brüt marjı ve sipariş başına katkıyı birlikte değerlendirin; genel giderleri ekleyerek karar modelini tamamlayın.", basisFindingIds: ["mix", "quality"] }],
    charts: [{ id: "trend", title: "Gelirin aylık ritmi", type: "line", datasetId: "monthly-net" }, { id: "category", title: "Kategori katkısı", type: "horizontal-bar", datasetId: "categories" }, { id: "channel", title: "Gelir nereden geliyor?", type: "donut", datasetId: "channels" }, { id: "region", title: "Bölgesel performans", type: "bar", datasetId: "regions" }, { id: "profit", title: "Brüt kârın seyri", type: "line", datasetId: "monthly-profit" }, { id: "service", title: "Teslimat performansı", type: "bar", datasetId: "monthly-service" }],
    limitations: ["Tüm tutarlar TRY ve KDV hariçtir; kaynak satırları aylık kırılım toplamlarıdır, tekil işlem değildir.", "Brüt kâr ve katkı, net kâr değildir. İşletme giderleri, vergi ve finansman maliyetleri bu pakette yoktur.", "Bütçe hedefleriyle gerçekleşenler aynı aylarda karşılaştırılır. Tam yıl seçimi 2025'in 12 ayını kapsar.", "Teslimat oranı toplamlar üzerinden ağırlıklı hesaplanır; müşteri sayısı veya memnuniyet puanı değildir.", "Kanal/kategori ilişkileri gözlemdir; kampanya etkisi veya nedensellik kanıtlanmaz."],
  }, context);
  return { period, periodLabel: label, result, monthly, categories, channels, regions, briefings, sourceRows: sales.length + budgets.length + operations.length };
}
