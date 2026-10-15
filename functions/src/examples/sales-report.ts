import type { ParsedDocument } from "../contracts";
import { buildAnalysisPacket } from "../analysis/input-packet";
import { validateAiResult, type AiResult } from "../analysis/result-contract";

const EXAMPLE_SHA256 = "8e2f42f1c1b5fea077eb14e35b6a78867894de42f81546a7ba42ef2af35baa4d";
const headers = ["event_id", "posted_date", "category", "status", "quantity", "unit_price_try", "discount_try", "original_event_id"] as const;
type Metric = AiResult["metrics"][number];
type Evidence = Metric["evidence"][number];

// Yalnız sürümlü sentetik satış CSV'si için örnek metrik/rapor üretir; genel analiz veya AI motoru değildir.
export function createSalesExample(document: ParsedDocument, objective: string, businessRules: string[]) {
  if (document.sha256 !== EXAMPLE_SHA256 || document.chunks.length !== 1) throw new Error("Örnek rapor yalnız sabit sentetik satış kaynağıyla üretilebilir.");
  const chunk = document.chunks[0];
  if (!chunk.table || JSON.stringify(chunk.table.columns) !== JSON.stringify(headers) || chunk.table.rows.length !== 12) throw new Error("Örnek satış tablosu yapısı değişmiş.");
  const rows = chunk.table.rows.map((cells, index) => {
    const raw = Object.fromEntries(headers.map((key, column) => [key, String(cells[column])])) as Record<(typeof headers)[number], string>;
    if (!/^-?\d+$/.test(raw.quantity) || !/^\d+(?:\.\d{1,2})?$/.test(raw.unit_price_try) || !/^\d+(?:\.\d{1,2})?$/.test(raw.discount_try)) throw new Error("Sayısal örnek alanı geçersiz.");
    if (!["completed", "refunded", "cancelled"].includes(raw.status)) throw new Error("Örnek olay durumu geçersiz.");
    const quantity = Number(raw.quantity), price = Math.round(Number(raw.unit_price_try) * 100), discount = Math.round(Number(raw.discount_try) * 100);
    return { ...raw, row: index + 1, quantity, price, discount, amount: raw.status === "cancelled" ? 0 : quantity * price - discount };
  });
  if (new Set(rows.map(row => row.event_id)).size !== rows.length) throw new Error("Örnek olay kimliği yineleniyor.");
  const eligible = rows.filter(row => row.status !== "cancelled");
  const completed = rows.filter(row => row.status === "completed");
  const sum = (items: typeof rows) => items.reduce((n, row) => n + row.amount, 0) / 100;
  const september = eligible.filter(row => row.posted_date.startsWith("2026-09-"));
  const october = eligible.filter(row => row.posted_date.startsWith("2026-10-"));
  const total = sum(eligible), previous = sum(september), current = sum(october), change = current - previous;
  if (!previous || eligible.length !== september.length + october.length) throw new Error("Örnek dönem kapsamı geçersiz.");
  const anchor = (row: number): Evidence => ({ sourceId: document.sourceId, sha256: document.sha256, chunkId: chunk.id, locator: { ...chunk.locator, rowStart: row, rowEnd: row } });
  const evidence = (items: typeof rows) => items.map(item => anchor(item.row));
  const metrics: Metric[] = [];
  const add = (id: string, label: string, value: number, unit: string, method: string, scope: typeof rows) => {
    metrics.push({ id, label, status: "available", value, unit, method, evidence: evidence(scope) });
  };
  add("net-sales", "Net satış", total, "TRY", "İptaller hariç; satır indirimi ve işlendiği dönemdeki iade dahil net tutarların toplamı.", rows);
  add("september", "Eylül 2026", previous, "TRY", "posted_date Eylül olan, iptal edilmemiş satırların net toplamı.", september);
  add("october", "Ekim 2026", current, "TRY", "posted_date Ekim olan, iptal edilmemiş satırların net toplamı; iade Ekim'de düşülür.", october);
  add("change", "Net satış farkı", change, "TRY", "Ekim net toplamı eksi Eylül net toplamı.", eligible);
  add("growth-percent", "Dönem değişimi", change * 100 / previous, "%", "(Ekim − Eylül) / Eylül × 100; payda Eylül net satışıdır.", eligible);
  const categories = [...new Set(eligible.map(row => row.category))].map(category => ({ category, items: eligible.filter(row => row.category === category) })).sort((a, b) => sum(b.items) - sum(a.items));
  for (const [index, group] of categories.entries()) add(`category-${index}`, group.category === "Kirtasiye" ? "Kırtasiye" : group.category, sum(group.items), "TRY", "İki dönemde aynı kategorideki iptal edilmemiş satırların net toplamı.", group.items);
  add("leading-share", "Lider kategori payı", sum(categories[0].items) * 100 / total, "%", "Lider kategori net toplamı / iki dönemin tüm net satışı × 100.", eligible);
  add("net-units", "Net ürün adedi", eligible.reduce((n, row) => n + row.quantity, 0), "adet", "İptal hariç, negatif iade adedi dahil miktarların toplamı; müşteri sayısı değildir.", eligible);
  add("gross-sales", "Brüt tamamlanmış satış", completed.reduce((n, row) => n + row.quantity * row.price, 0) / 100, "TRY", "Tamamlanan satırlarda adet × fiyat toplamı; indirim/iade düşülmeden önce.", completed);
  add("discounts", "İndirim", completed.reduce((n, row) => n + row.discount, 0) / 100, "TRY", "Tamamlanan satışların satır indirimleri toplamı; adet başına uygulanmaz.", completed.filter(row => row.discount > 0));
  add("refunds", "İade", -sum(rows.filter(row => row.status === "refunded")), "TRY", "İşlenen negatif iade olaylarının mutlak net toplamı.", rows.filter(row => row.status === "refunded"));
  add("cancelled", "İptal edilen olay", rows.filter(row => row.status === "cancelled").length, "olay", "cancelled durumundaki olay sayısı; satış toplamına girmez.", rows.filter(row => row.status === "cancelled"));
  const lookup = (id: string) => metrics.find(metric => metric.id === id)!;
  const value = (id: string) => lookup(id).value!;
  const datasets: AiResult["datasets"] = [
    { id: "monthly", label: "Dönemlere göre net satış", unit: "TRY", points: ["september", "october"].map(id => ({ label: lookup(id).label, metricId: id, value: value(id) })) },
    { id: "categories", label: "Kategorilere göre net satış", unit: "TRY", points: categories.map((_group, index) => ({ label: lookup(`category-${index}`).label, metricId: `category-${index}`, value: value(`category-${index}`) })) },
  ];
  const packet = buildAnalysisPacket({ analysisId: "synthetic-sales-v1", objective, documents: [document], businessRules, metrics, datasets });
  const money = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n) + " TL";
  const statement = (text: string, metricIds: string[], scope: typeof rows) => ({ text, metricIds, evidence: evidence(scope) });
  const result = validateAiResult({
    schemaVersion: 1, analysisId: packet.validationContext.analysisId, objective,
    summary: [statement(`İki örnek dönemde net satış ${money(total)}. Ekim, Eylül'e göre ${money(change)} ve %${value("growth-percent")} artıyor.`, ["net-sales", "change", "growth-percent"], rows), statement("Teknoloji en yüksek net satışı üreten kategori. Bu tablo büyümenin nedenini açıklamak için yeterli değil.", ["category-0", "leading-share"], eligible)],
    findings: [
      { id: "period-change", title: "İkinci dönemde daha yüksek net satış", kind: "observation", statements: [statement(`Eylül ${money(previous)}, Ekim ${money(current)}. ${money(change)} fark, Eylül net satışına göre %${value("growth-percent")} değişime karşılık geliyor.`, ["september", "october", "change", "growth-percent"], eligible)] },
      { id: "category-leader", title: "Teknoloji toplamda öne çıkıyor", kind: "observation", statements: [statement(`${categories.map((_group, index) => `${lookup(`category-${index}`).label} ${money(value(`category-${index}`))}`).join(", ")}. Teknoloji, net toplamın %${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value("leading-share"))}'ünü oluşturuyor.`, [...categories.map((_group, index) => `category-${index}`), "leading-share"], eligible)] },
      { id: "adjustments", title: "Net tutarı indirim ve iade belirliyor", kind: "observation", statements: [statement(`${money(value("gross-sales"))} brüt satıştan ${money(value("discounts"))} indirim ve ${money(value("refunds"))} iade düşülüyor. ${value("cancelled")} iptal satışa katılmıyor; net tutar ${money(total)}.`, ["gross-sales", "discounts", "refunds", "cancelled", "net-sales"], rows)] },
    ],
    recommendations: [{ id: "investigate", action: "Değişimin nedenini değerlendirmek için kampanya, trafik ve maliyet kayıtlarını aynı dönemler üzerinden birlikte inceleyin.", basisFindingIds: ["period-change", "category-leader"] }],
    metrics, datasets,
    charts: [{ id: "period-chart", title: "İki dönemi karşılaştırın", type: "bar", datasetId: "monthly" }, { id: "category-chart", title: "Kategorilerin katkısını görün", type: "horizontal-bar", datasetId: "categories" }],
    limitations: ["12 sentetik olay ve iki yapay tam ay kullanılır; gerçek işletme performansı veya gelecek dönem tahmini değildir.", "Maliyet ve vergi verisi yoktur; net satış kâr olarak yorumlanamaz.", "Müşteri kimliği bulunmaz; ürün adedi ve olay sayısı müşteri sayısı değildir.", "İade Ekim'de işlenmiştir; Eylül kaydı geriye dönük değiştirilmez.", "Bu kaynak büyümenin nedenini veya bir kampanyanın etkisini kanıtlamaz."],
  }, packet.validationContext);
  return { exampleVersion: 1, synthetic: true, title: "Satışların net resmi.", period: "Eylül — Ekim 2026", packet, result };
}
