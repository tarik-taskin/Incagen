# AI sonuç sözleşmesi · v1

Kaynaklı özetleme hattının ilk kod sözleşmesi [result-contract.ts](../functions/src/analysis/result-contract.ts) içindedir. Modül model çağırmaz, hesap üretmez, kayıt yazmaz ve arayüzü AI raporuna dönüştürmez. Hazırlama raporunun `version: 3` sözleşmesiyle ayrıdır; mevcut kayıtlar değişmez.

## Yapı

[JSON Schema](contracts/ai-result.v1.schema.json), kod şemasından üretilir; test iki kaynağın eşitliğini korur. Alan adları ve v1 sürümü sabittir; bilinmeyen alanlar reddedilir.

| Alan | Anlamı |
| --- | --- |
| `schemaVersion`, `analysisId`, `objective` | Sürüm ve sonucu ait olduğu çalışma/hedefe bağlayan kimlik |
| `summary` | Kanıt ve metrik referanslarıyla kısa ifadeler |
| `findings` | `observation` veya `interpretation` türündeki kaynaklı bulgular |
| `recommendations` | Sonuçtaki bulgulara bağlı eylemler |
| `metrics` | Güvenilir hesaplayıcının değer, birim, yöntem ve kanıt kayıtları |
| `datasets` | Her noktası bir doğrulanmış metriğe bağlı veri kümeleri |
| `charts` | Veri kümesi kimliği kullanan `bar`, `horizontal-bar`, `line` önerileri |
| `limitations` | Kapsam ve belirsizlikleri açıklayan, boş bırakılamayan alan |

Özet ve bulgu ifadeleri `text`, `evidence` ve `metricIds` taşır. Sayısal bir iddia yapılandırılmış metriğe bağlanır; serbest metinden rakam çekip sessizce doğrulanmış sayılmaz. Sayısal içerik yoksa metrik/veri kümesi/grafik dizileri boş olabilir. Öneri yoksa boş dizi kullanılır; olmayan bir eylem uydurulmaz.

Kaynak kanıtı `sourceId`, SHA-256, `chunkId` ve konum içerir. Konum en az bir sayfa, slayt, çalışma sayfası, bölüm veya satır aralığı taşır. Satırlar 1 tabanlıdır; iki sınır da belirtilir. Belge türüne ait olmayan bir konum boyutu eklenemez.

## Güven sınırı

```ts
const validated = validateAiResult(modelOutput, trustedContext);
```

`trustedContext` backend'in aynı analize ait kaynak kayıtlarından ve hesaplayıcının doğrulanmış çıktısından oluşturulur. **Modelden veya istemciden gelen metrikler bu bağlamın yerine kullanılamaz.** Hedefi değişmiş bir çalışma için eski sonuç kabul edilmez; bu ilk sözleşme analiz kimliği ve hedefi eşler.

Doğrulayıcı şunları kontrol eder:

- Kaynak kimliği, hash ve parçanın aynı kaynağa ait olması; sayfa/bölüm/sayfa adı eşitliği ve alt satır aralığının parça içinde kalması.
- Sonuçta ve güvenilir bağlamda kimliklerin tekilliği; yinelenen kanıt ve bağlantıların reddi.
- Metriğin değer, birim, hesap yöntemi ve kanıtlarının güvenilir kayıtla eşitliği. Yapılandırılmış sayılara yuvarlama toleransı uygulanmaz; gösterim yuvarlaması renderer'a aittir.
- İfade kanıtının kullandığı metriğin kapsamını da taşıması; dosyada bulunan ilgisiz bir satır tek başına yeterli değildir.
- Önerilerin mevcut bulgulara bağlanması; veri kümesi noktalarının aynı birim/değer/metrik kimliğiyle eşleşmesi.
- Grafiğin sonuçtaki veri kümesine bağlanması ve metriklerinin kaynaklı özet/bulgularda bulunması.
- Sayısal değeri bulunmayan veri kümesinden grafik önerilmemesi; çizgi için en az iki kullanılabilir nokta olması.

Hata durumunda doğrulayıcı istisna üretir; çağıran hatayı kontrollü eksik sonuç/hata durumuna çevirmelidir. Sadece JSON Schema kontrolünden geçen veri başarılı rapor olarak kaydedilmez. Bu modül mevcut Functions uçlarına bağlanmış değildir; model entegrasyonunda bu kapının çağrılması ayrıca zorunludur.

## Eksik değer ve semantik inceleme

Bir metrik `available` ise sonlu sayı, `unavailable` ise `null` ve açıklayıcı `reason` taşır. Eksik değer sıfır yapılmaz; gerçek sıfır ve negatif değerler korunur. Oran pay/payda kapsamı ve dönem seçimi hesaplayıcının yöntem/kanıt kayıtlarından gelir.

Yapı doğrulaması, Türkçe metnin doğru yorumlandığını veya önerinin yararlı olduğunu kanıtlamaz. Metinde kaynaksız bir sayı, nedensellik veya yanlış duygu anlamı bulunabilir; bunlar [referans değerlendirme protokolünün](../fixtures/analysis-reference/evaluation.md) konusudur. İçerik metin olarak saklanır/gösterilir; modelin önerdiği kod çalıştırılmaz ve HTML enjekte edilmez.

v1 grafik önerileri tek seri içindir; erişilebilir tablo, eksen davranışı, grafik türünün anlamsal uygunluğu ve animasyon React/ECharts aşamasında ayrıca doğrulanır. Farklı birim, para birimi veya eksik değer sessizce birleştirilmez. Kesin alan anlamı değişirse yeni sürüm ve açık dönüştürme gerekir; eski hazırlık kayıtlarına bu şema zorla uygulanmaz.
