import type { ParsedDocument } from "../contracts";
import { buildAnalysisPacket } from "../analysis/input-packet";
import { validateAiResult, type AiResult } from "../analysis/result-contract";

export interface FeedbackAnnotation { id: string; sourceRow: number; quote: string; themes: string[]; problemThemes: string[]; sentiment: string }
const themes = { usability: "Kullanım kolaylığı", support: "Destek", reporting: "Rapor ve kaynaklar", performance: "Performans" };
const sentiments = { positive: "Olumlu", negative: "Olumsuz", mixed: "Karma" };

// İnsan etiketlerini özgün yorumlarla eşler; model çalıştırmadan sayımları ve kaynaklı örnek sonucu üretir.
export function createFeedbackExample(document: ParsedDocument, annotations: FeedbackAnnotation[], sourceSha256: string) {
  if (sourceSha256 !== "2753a33117cf0ec965c962473da64efb8aa9a99ab4619412bd7c1f122ecddae6" || document.sha256 !== sourceSha256 || document.sourceId !== "reference-feedback" || document.chunks.length !== 1) throw new Error("Geri bildirim örneğinin kaynağı değişmiş.");
  const chunk = document.chunks[0];
  if (!chunk.table || chunk.table.columns.join() !== "feedback_id,received_date,comment" || chunk.table.rows.length !== 32 || annotations.length !== 32) throw new Error("Geri bildirim referans kapsamı geçersiz.");
  const seen = new Set<number>();
  for (const item of annotations) {
    const row = chunk.table.rows[item.sourceRow - 1];
    if (!row || seen.has(item.sourceRow) || row[0] !== item.id || !String(row[2]).includes(item.quote) || !item.quote.trim() || !Object.hasOwn(sentiments, item.sentiment) || !item.themes.length || new Set(item.themes).size !== item.themes.length || new Set(item.problemThemes).size !== item.problemThemes.length || item.themes.some(theme => !Object.hasOwn(themes, theme)) || item.problemThemes.some(theme => !item.themes.includes(theme))) throw new Error("İnsan etiketi yorumla eşleşmiyor.");
    seen.add(item.sourceRow);
  }
  const ordered = [...annotations].sort((a, b) => a.sourceRow - b.sourceRow);
  const evidence = (items: FeedbackAnnotation[]) => items.map(item => ({ sourceId: document.sourceId, sha256: document.sha256, chunkId: chunk.id, locator: { ...chunk.locator, rowStart: item.sourceRow, rowEnd: item.sourceRow } }));
  const all = evidence(ordered);
  const metrics: AiResult["metrics"] = [];
  const add = (id: string, label: string, value: number, unit = "yorum", method = "İnsan referansındaki benzersiz yorumların sayımı.", items = ordered) => metrics.push({ id, label, value, unit, method, status: "available", evidence: evidence(items) });
  add("comments", "İncelenen yorum", ordered.length);
  add("negative-share", "Olumsuz yorum payı", ordered.filter(item => item.sentiment === "negative").length / ordered.length * 100, "%", "İnsan etiketlerinde olumsuz yorum / 32 benzersiz yorum × 100; müşteri kitlesinin memnuniyet oranı değildir.");
  add("problem-comments", "Sorun bildirilen yorum", ordered.filter(item => item.problemThemes.length).length, "yorum", undefined, ordered.filter(item => item.problemThemes.length));
  add("positive-comments", "Olumlu yorum", ordered.filter(item => item.sentiment === "positive").length, "yorum", undefined, ordered.filter(item => item.sentiment === "positive"));
  for (const [id, label] of Object.entries(themes)) {
    add(`theme-${id}`, label, ordered.filter(item => item.themes.includes(id)).length, "yorum", undefined, ordered.filter(item => item.themes.includes(id)));
    add(`problem-${id}`, label, ordered.filter(item => item.problemThemes.includes(id)).length, "yorum", undefined, ordered.filter(item => item.problemThemes.includes(id)));
  }
  for (const [id, label] of Object.entries(sentiments)) add(`sentiment-${id}`, label, ordered.filter(item => item.sentiment === id).length, "yorum", undefined, ordered.filter(item => item.sentiment === id));
  metrics.push({ id: "csat", label: "Memnuniyet puanı", value: null, unit: "%", status: "unavailable", reason: "Kaynakta puanlama sorusu veya CSAT ölçümü yok.", method: "Ölçüm bulunmadığında yorum duygusundan puan türetilmez.", evidence: all });
  const dataset = (id: string, label: string, prefix: string, labels: Record<string, string>): AiResult["datasets"][number] => ({ id, label, unit: "yorum", points: Object.entries(labels).map(([key, name]) => ({ label: name, metricId: `${prefix}-${key}`, value: metrics.find(item => item.id === `${prefix}-${key}`)!.value })) });
  const datasets = [dataset("problems", "Sorun temaları", "problem", themes), dataset("sentiments", "Yorumların duygusu", "sentiment", sentiments), dataset("themes", "Konuşulan konular", "theme", themes)];
  const objective = "Yorumlardaki tekrar eden sorunları, olumlu deneyimleri ve iyileştirme önceliklerini kaynaklarıyla özetle.";
  const packet = buildAnalysisPacket({ analysisId: "synthetic-feedback-v1", objective, documents: [document], businessRules: ["Etiketler insan referansıdır; model çıktısı değildir.", "Tema sözleri ile sorunları ayrı say; payda 32 benzersiz yorumdur.", "Çoklu temalar aynı bütünü paylaşmaz; tema grafiğinde pasta kullanma."], metrics, datasets });
  const statement = (text: string, metricIds: string[] = [], items = ordered) => ({ text, metricIds, evidence: evidence(items) });
  const result = validateAiResult({ schemaVersion: 1, analysisId: packet.validationContext.analysisId, objective,
    summary: [statement("Olumlu deneyimler çoğunlukta: 32 yorumun 26’sı olumlu. Kullanım kolaylığı, rapor kalitesi ve destek öne çıkıyor; ilk kullanım akışındaki küçük pürüzler iyileştirme alanı.", metrics.filter(item => item.status === "available").map(item => item.id))],
    findings: [
      { id: "usability", title: "İlk kullanımı daha da kolaylaştırın", kind: "interpretation", statements: [statement("32 yorumun üçünde kaynaklara ulaşma, hedefi anlama veya mobil filtreleri bulma konusunda pürüzler var. Bu öncelik yalnız örnekteki tekrar sıklığına dayanıyor.", ["problem-usability", "comments"])] },
      { id: "positive", title: "İyi deneyimin de izini sürün", kind: "observation", statements: [statement("26 olumlu yorumda anlaşılır raporlar, kaynaklara erişim, akıcı kullanım ve destek öne çıkıyor. Olumlu yorumlar sorun sayımına eklenmiyor.", ["positive-comments"])] },
      { id: "mixed", title: "Bir yorum, iki farklı deneyim", kind: "interpretation", statements: [statement("F007 grafikleri anlaşılır buluyor, mobil filtrelere ulaşmak için fazla kaydırdığını söylüyor. Rapor kalitesiyle kullanım pürüzü ayrı tutuluyor.", [], ordered.filter(item => item.id === "F007"))] },
      { id: "performance", title: "Büyük belge deneyimini ölçün", kind: "observation", statements: [statement("F008 büyük belgelerde kaynak listesinin bazen geç açıldığını belirtiyor. Kaynakta süre ölçümü yok; yorumdan kesin bir gecikme değeri çıkarılmıyor.", [], ordered.filter(item => item.id === "F008"))] },
    ],
    recommendations: [
      { id: "usability-review", action: "Kaynak erişimini, analiz hedefi ipuçlarını ve mobil filtrelerin görünürlüğünü kullanım testleriyle değerlendirin.", basisFindingIds: ["usability"] },
      { id: "performance-review", action: "Büyük belgelerde kaynak listesinin açılış süresini ölçün; F008’deki deneyimi ölçümle doğrulayın.", basisFindingIds: ["performance"] },
    ], metrics, datasets,
    charts: [{ id: "problems", title: "Hangi sorunlar tekrar ediyor?", type: "horizontal-bar", datasetId: "problems" }, { id: "sentiments", title: "Deneyimin farklı tonları", type: "donut", datasetId: "sentiments" }, { id: "themes", title: "Konuşulan konular", type: "horizontal-bar", datasetId: "themes" }],
    limitations: ["32 yorum müşteri kitlesini temsil etmez; duygu dağılımı NPS veya CSAT değildir.", "Tema ve duygu etiketleri insan değerlendirme referansıdır. Otomatik sınıflandırma yapılmamıştır.", "Bir yorum birden çok temaya atanabilir. Tema sayıları ve yüzdeleri tek bir bütünün parçaları değildir.", "Maliyet, müşteri sayısı, finansal etki ve ortalama yanıt süresi için veri yoktur."],
  }, packet.validationContext);
  return { result, sources: [document], annotations: ordered, validationContext: packet.validationContext };
}
