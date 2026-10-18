import type { ParsedDocument } from "../contracts";
import { buildAnalysisPacket } from "../analysis/input-packet";
import { validateAiResult, type AiResult } from "../analysis/result-contract";

export interface FeedbackAnnotation { id: string; sourceRow: number; quote: string; themes: string[]; problemThemes: string[]; sentiment: string }
const themes = { clarity: "Özet ve anlatım", evidence: "Doğruluk ve kaynaklar", decisions: "Karar desteği", depth: "Analiz derinliği" };
const sentiments = { positive: "Olumlu", negative: "Olumsuz", mixed: "Karma" };

// İnsan etiketlerini özgün yorumlarla eşler; model çalıştırmadan sayımları ve kaynaklı örnek sonucu üretir.
export function createFeedbackExample(document: ParsedDocument, annotations: FeedbackAnnotation[], sourceSha256: string) {
  if (sourceSha256 !== "2037d5496b1e6e9c5bf5d2fcff61375505c0cbba60b1654e4f8701e661f0c4b1" || document.sha256 !== sourceSha256 || document.sourceId !== "reference-feedback" || document.chunks.length !== 1) throw new Error("Geri bildirim örneğinin kaynağı değişmiş.");
  const chunk = document.chunks[0];
  if (!chunk.table || chunk.table.columns.join() !== "feedback_id,received_date,reviewer_name,analysis_type,comment" || chunk.table.rows.length !== 32 || annotations.length !== 32) throw new Error("Geri bildirim referans kapsamı geçersiz.");
  const seen = new Set<number>();
  for (const item of annotations) {
    const row = chunk.table.rows[item.sourceRow - 1];
    if (!row || seen.has(item.sourceRow) || row[0] !== item.id || row[4] !== item.quote || typeof row[2] !== "string" || !row[2].trim() || typeof row[3] !== "string" || !row[3].trim() || !item.quote.trim() || !Object.hasOwn(sentiments, item.sentiment) || !item.themes.length || new Set(item.themes).size !== item.themes.length || new Set(item.problemThemes).size !== item.problemThemes.length || item.themes.some(theme => !Object.hasOwn(themes, theme)) || item.problemThemes.some(theme => !item.themes.includes(theme))) throw new Error("İnsan etiketi yorumla eşleşmiyor.");
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
  const objective = "Tamamlanan analizlerden sonra paylaşılan geri bildirimleri incele; sonuç kalitesini, karar desteğini ve iyileştirme önceliklerini kaynaklarıyla özetle.";
  const packet = buildAnalysisPacket({ analysisId: "synthetic-post-analysis-feedback-v2", objective, documents: [document], businessRules: ["Etiketler insan referansıdır; model çıktısı değildir.", "Tema sözleri ile sorunları ayrı say; payda 32 benzersiz yorumdur.", "Çoklu temalar aynı bütünü paylaşmaz; tema grafiğinde pasta kullanma."], metrics, datasets });
  const statement = (text: string, metricIds: string[] = [], items = ordered) => ({ text, metricIds, evidence: evidence(items) });
  const result = validateAiResult({ schemaVersion: 1, analysisId: packet.validationContext.analysisId, objective,
    summary: [statement("32 analiz sonrası geri bildirimin 26’sı olumlu. Anlaşılır özetler, kaynakları kontrol edebilme ve karar hazırlığına katkı öne çıkıyor. İyileştirme talepleri daha çok özetin dili ve önerilerin somutluğu üzerinde toplanıyor.", metrics.filter(item => item.status === "available").map(item => item.id))],
    findings: [
      { id: "clarity", title: "Özetleri ve önerileri netleştirin", kind: "interpretation", statements: [statement("Özetin dili ve önerilerin somutluğu için ikişer iyileştirme talebi var. Analiz derinliği ve kaynak açıklığı için birer yorum bulunuyor. Bu sayımlar geri bildirim sıklığını gösterir; ticari etkiyi ölçmez.", ["problem-clarity", "problem-decisions", "problem-depth", "problem-evidence"])] },
      { id: "positive", title: "Sonucun işe yaradığı noktaları koruyun", kind: "observation", statements: [statement("26 olumlu yorum; anlaşılır özetleri, kontrol edilebilir kaynakları ve toplantı ya da karar hazırlığına katkıyı anlatıyor. Bunlar doğrulanmış iş sonuçları veya ölçülmüş yatırım getirisi değildir.", ["positive-comments"], ordered.filter(item => item.sentiment === "positive"))] },
      { id: "mixed", title: "İyi bir özet, daha derin bir ihtiyaç", kind: "interpretation", statements: [statement("F007 yönetici özetini yararlı buluyor, segment karşılaştırmasını ise yetersiz görüyor. Aynı yorumdaki olumlu deneyim ve iyileştirme talebi ayrı korunuyor.", [], ordered.filter(item => item.id === "F007"))] },
      { id: "evidence", title: "Önerinin dayanağını görünür tutun", kind: "observation", statements: [statement("F008 bir önerinin hangi veri grubuna dayandığını yeniden kontrol etmek zorunda kaldığını belirtiyor. Bu geri bildirim bir doğruluk denetimi değil; kaynak bağının açıklığına ilişkin bir kullanıcı deneyimi.", [], ordered.filter(item => item.id === "F008"))] },
    ],
    recommendations: [
      { id: "clarity-review", action: "Yönetici özetindeki teknik ifadeleri ve tekrarları sadeleştirin; önerilerdeki ilk adımı kısa bir uygulama örneğiyle somutlaştırın.", basisFindingIds: ["clarity"] },
      { id: "evidence-review", action: "Önerilerin dayandığı veri gruplarını ve kaynak bağlantılarını gözden geçirin; F008’deki deneyimin nerede oluştuğunu doğrulayın.", basisFindingIds: ["evidence"] },
    ], metrics, datasets,
    charts: [{ id: "problems", title: "Hangi sorunlar tekrar ediyor?", type: "horizontal-bar", datasetId: "problems" }, { id: "sentiments", title: "Deneyimin farklı tonları", type: "donut", datasetId: "sentiments" }, { id: "themes", title: "Konuşulan konular", type: "horizontal-bar", datasetId: "themes" }],
    limitations: ["32 yorum müşteri kitlesini temsil etmez; duygu dağılımı NPS veya CSAT değildir.", "Tema ve duygu etiketleri insan değerlendirme referansıdır. Otomatik sınıflandırma yapılmamıştır.", "Bir yorum birden çok temaya atanabilir. Tema sayıları ve yüzdeleri tek bir bütünün parçaları değildir.", "Maliyet, müşteri sayısı, finansal etki ve ortalama yanıt süresi için veri yoktur."],
  }, packet.validationContext);
  return { result, sources: [document], annotations: ordered, validationContext: packet.validationContext };
}
