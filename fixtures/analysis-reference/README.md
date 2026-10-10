# Özetleme referans seti

İki küçük, tamamen sentetik vaka: **net satış hesabı** ve **müşteri yorumlarının kaynaklı özeti**. Setin amacı, gelecekteki LLM hattının sayıları, kaynakları ve yorum sınırlarını aynı sabit kanıt üzerinden değerlendirmek. Gerçek müşteri verisi içermez.

**Bugün doğrulanan:** ham CSV ayrıştırma, kaynak hash/konumları, bağımsız hesaplar ve cevap anahtarlarının tutarlılığı. **Henüz ölçülmeyen:** LLM kalitesi, OCR, grafik sunumu, süre ve maliyet. Testlerin geçmesi modelin başarılı olduğu anlamına gelmez.

## Seti kullanma

```bash
npm run test:references
```

Repo kökünde, mevcut Node bağımlılıklarıyla çalışır; Firebase, Python ve AI anahtarı gerekmez. Bu kontroller `npm run test:run` içinde de yer alır.

| Dosya | Rol | Model girdisi? |
| --- | --- | --- |
| [v1/tasks.json](v1/tasks.json) | Her vakanın hedefi ve açık iş kuralları | Evet: yalnız seçilen vaka |
| [v1/sales.csv](v1/sales.csv) | 12 sentetik satış/iade/iptal olayı | Evet: satış vakası |
| [v1/customer-feedback.csv](v1/customer-feedback.csv) | 8 sentetik yorum | Evet: yorum vakası |
| [Satış cevap anahtarı](v1/sales.expected.json) / [yorum cevap anahtarı](v1/customer-feedback.expected.json) | Elle yazılmış hesap, bulgu, kaynak, sınırlama ve grafik verisi | **Hayır** |
| [evaluation-policy.json](evaluation-policy.json) | Gerekli bulgular/metrikler, kapılar, tolerans ve puanlama | **Hayır** |
| [contract.ts](contract.ts) | Yalnız testte kullanılan referans yapı doğrulaması | **Hayır** |

Model görevinde CSV'yi mevcut parser'dan geçirin; seçilen `tasks.json` girdisinin `objective` ve `businessRules` alanlarını kullanın. `sourceFile` yalnız doğru dosyayı seçer; gerçek yüklemede dosya kimliği/konumları mevcut kaynak sözleşmesinden gelir. Bu README, cevap anahtarları ve değerlendirme belgeleri retrieval bağlamına da alınmaz. Gelecekteki doğrulanmış hesaplayıcının metriklerini modele vermek mümkündür; **beklenen cevabı hesaplanmış sonuç gibi kopyalamak değerlendirmeyi geçersiz kılar**.

## Satış vakası

İş tanımı [tasks.json](v1/tasks.json), satır bazlı cevaplar [sales.expected.json](v1/sales.expected.json) içindedir. `discount_try` satır toplamına uygulanır; iptal sıfır sayılır; negatif adetli iade `posted_date` döneminde düşülür. R001, Eylül'deki S001 satışının Ekim'de işlenen tek adet iadesidir. İki dönem yapay tam aydır; gerçek takvimdeki bugün veya kısmi ay performansı değildir.

| Kontrol | Elle hesaplanan sonuç | Kaynak veri satırları |
| --- | --- | --- |
| Eylül net satış | 200 + 500 + 150 + 150 = **1.000 TRY** | 1–4; iptal 5 hariç |
| Ekim net satış | 300 + 600 + 200 + 400 + (200 − 50) − 100 = **1.550 TRY** | 6–11; iptal 12 hariç |
| Toplam net satış | 2.700 − 50 indirim − 100 iade = **2.550 TRY** | 1–12, dahil/hariç kuralıyla |
| Aylık değişim | 550 TRY; 550 / 1.000 × 100 = **%55** | 1–4 ve 6–11 |
| Kategori lideri | Teknoloji **1.100 TRY**, net toplamın **%43,14**'ü | Pay 2,7; payda 1–4 ve 6–11 |
| Olay / net adet | 9 satış + 1 iade + 2 iptal = 12 olay; **17 net adet** | 1–12 |

Hedefi yanıtlayan özet aylık değişimi, kategori liderini ve düzeltmelerin toplam üzerindeki etkisini açıklamalı. Kâr, müşteri sayısı, kampanya etkisi veya gelecek ay tahmini için veri yok. Öneri, ek operasyon verisiyle araştırılacak bir adım olarak yazılmalı. Grafik iki ayı sıfır tabanlı sütunla karşılaştırmalı; tahmin veya yapay trend eklememeli.

## Müşteri yorumları vakası

Duygu ve tema etiketleri [insan referansıdır](v1/customer-feedback.expected.json); NLP ile doğrulanmış nesnel ölçümler değildir. Tema ile sorun ayrı değerlendirilir. F007 ürün tasarımını övüp paket hasarı bildirir; iki tema ve karma duygu korunur, ürün arızası çıkarılmaz.

| Kontrol | Sonuç | Kanıt |
| --- | --- | --- |
| Teslimat/paketleme sözü | 4/8 = **%50** | F001, F004, F006, F007 |
| Teslimat/paketleme sorunu | 3/8 = **%37,5** | F001, F004, F007; payda tüm 8 yorum |
| Diğer sorunlar | Destek / ürün / fatura: her biri 1/8 | F002 / F003 / F008 |
| Olumlu karşı örnekler | Aynı gün çözülen destek; zamanında teslimat | F005 / F006 |
| Genel duygu | 5 olumsuz, 2 olumlu, 1 karma | İnsan etiketleri, F001–F008 |
| Çoklu tema | 9 atama; tema yüzdeleri toplamı **%112,5** | F007 iki temalı |

Hedefi yanıtlayan özet tekrar eden sorunları, olumlu deneyimleri, F007'nin karma anlamını ve F008'in fatura farkını korumalı. Sıklık ticari önem veya ciddiyet değildir; kayıp tutarı bilinmiyor. NPS/CSAT, genel müşteri memnuniyetsizliği veya ortalama destek süresi çıkarılamaz. Sorun grafiği 3 / 1 / 1 / 1 değerlerini yatay sütunla göstermeli; çoklu temalar pasta grafik olarak sunulmamalı.

Etiketler için eş anlamlı ifadeler kabul edilir. Farklı bir sınıflandırma kaynakla savunulabiliyorsa otomatik doğru/yanlış kararı verilmez: insan incelemesine alınır, anahtar modele uydurulmaz. Tam konu sözlüğü ve bu görevin sınıflandırma tanımı `tasks.json` içindedir.

## Kaynak ve hesap sözleşmesi

- Satırlar normalize tablodaki **1 tabanlı veri satırlarıdır**; başlık sayılmaz. R001 → veri satırı 11 → CSV fiziksel satırı 12. Bu eşleme, tek satırlı kayıtlar kullanan bu iki CSV içindir; genel CSV'de fiziksel satır ve kayıt aynı olmak zorunda değildir.
- `sourceId` testte sabittir; gerçek yüklemede atanmış dosya kimliğine eşlenir. Dosya SHA-256'sı ham baytları, chunk kimliği ayrıştırılmış tabloyu tanımlar. `sourceRows` bulgunun kanıtı, `denominatorRows` oranın payda kapsamıdır.
- Satış referans hesabı kuruşla yapılır; yorum sayıları insan etiketlerinden türetilir. Satış, adet ve yüzde birimleri ayrı tutulur. Ölçüm, sınıflandırma ve öneri birbirinin yerine geçmez.
- Beklenen grafik verisi gelecekteki sunum kontrolü içindir; mevcut uygulamanın grafik ürettiğini göstermez. Referans şeması ve `contract.ts` **üretim sonuç doğrulayıcısı değildir**.

Testler doğru veriyi kabul etmenin yanında yanlış satır, yinelenen/kesirli kaynak konumu, yanlış payda, kopuk öneri dayanağı, yanlış birim ve değiştirilmiş grafik değerini reddeder. Metindeki anlam, önerinin faydası veya duygu sınıfının doğruluğu kod tarafından kanıtlanmış sayılmaz; bunlar insan değerlendirmesinin konusudur.

## LLM değerlendirmesi ve sürümleme

Uygulama protokolü, puanlama örnekleri ve kötü girdi senaryoları [evaluation.md](evaluation.md) içinde; koşu kaydı [review-template.md](review-template.md) ile tutulur. Sayısal eşikler ve minimum içerik için asıl kaynak [evaluation-policy.json](evaluation-policy.json)'dır. Başlangıç önerisi: **her baz vaka için üç koşunun her birinde tüm kapılar + en az 90/100**. Ölçülmüş bir model skoru değildir.

v1'in CSV'leri ve elle yazılmış cevapları korunur. Veri, hedef, sınıflandırma veya hesap anlamı değişirse eski sürümü koruyarak v2 oluşturun. Değerlendirme politikasında anlamlı değişiklik ayrıca `policyVersion` artırır; aynı veri farklı politikayla değerlendirildiyse sonuçlar eşdeğer koşu sayılmaz. Cevaplar test veya model çıktısından otomatik güncellenmez.

Bu set Excel, PDF/OCR, karma para birimi, büyük dosya, yük/maliyet veya gerçek müşteri dağılımını kapsamaz. İki açık örnekte iyi sonuç, genel güvenilirlik kanıtı değildir; sonraki aşamada görülmemiş sentetik vakalar ve farklı formatlar eklenmelidir. Mimari bağlantı: [FLOW.md kalite kapısı](../../FLOW.md#uygulama-sırası-ve-kalite-kapısı).
