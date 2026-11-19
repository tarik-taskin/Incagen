# İlk analiz betası — kapsam ve çıkış kanıtı

Bu plan ödeme altyapısını ve domain işlerini kapsamaz. Aktif işlerin durumu [GOAL.md](../GOAL.md), gerçek ürün davranışı [FLOW.md](../FLOW.md), teknik analiz sözleşmesi [TABULAR-ANALYSIS.md](TABULAR-ANALYSIS.md) içindedir. Burada tamamlanmış kod ile henüz gerçek sağlayıcı üzerinde kanıtlanmamış kabul ayrılır.

## Bugünkü sınır

Belge yükleme/hazırlama, kaynak konumları, geçmiş, indirme ve silme çalışır. Özel Python CSV/XLSX hesap işçisi ve backend Gemini adaptörü dağıtılmıştır. Bunları yeniden kurmak sonraki iş değildir. Genel analiz yayını iki kapıda da kapalıdır; örnek raporlar gerçek model kalite kabulü yerine geçmez.

16 Kasım 2026 tek bağlantı kontrolü `functions/unavailable / timeout` ile sonuçlandı (95.680 ms). 17 Kasım 2026 aşamalı tek bağlantı kontrolünde ise `configuration` (`2.110 ms`) ve `clientAuth` (`3.358 ms`) aşamaları geçti; `callable` (`checkGemini`) aşaması `6.631 ms` içinde `functions/unavailable / busy` döndürdü ve `cleanup` (`9.583 ms`, `verified-clean`) tamamlandı (toplam `21.684 ms`). 19 Kasım 2026 tek bağlantı kontrolünde (`2026-11-19T07:43:08Z`) ise `configuration` (`1.532 ms`) ve `clientAuth` (`1.925 ms`) geçti, `callable` `94.849 ms` içinde `functions/unavailable / timeout` döndürdü (`callAttempted: true`, tekrar çağrı yok) ve `cleanup` (`11.461 ms`, `verified-clean`) tamamlandı (toplam `109.768 ms`). Otomatik tekrar yapılmadı; geçerli yanıt alınmadan kalite/maliyet kabulü tamamlandı sayılmaz. Çevrimdışı analiz değerlendiricisi (`scripts/evaluate-analysis-offline.mjs`), Python-rapor testi (`scripts/python-to-report.test.ts`) ve süre/kullanım kabul özeti (`scripts/summarize-usage-acceptance.mjs`) yalnızca çevrimdışı/kontrollü hazırlığı destekler; gerçek sağlayıcı veya altı dilli model kalite kabulü yerine geçmez. Anahtar değiştirmek, sonucu taklit etmek veya şemayı gevşetmek bu engeli çözmez.

16 Kasım üretim bağımlılığı denetiminde kök ağaçta uyarı yok; Functions ağacında dört orta ve bir düşük kayıt var, yüksek/kritik yok. Yeni düşük `fast-xml-parser` kaydı ve kalan zincirler sonraki kontrollü backend paketinde değerlendirilmeli; bu çalışma bunları giderilmiş saymaz.

## İlk beta için kalan kabul

| Aşama | Gerekli kanıt | Açılış kararı |
| --- | --- | --- |
| Sağlayıcı bağlantısı | Mevcut backend hattında sınırlı sentetik kontrol; geçerli yanıt, süre ve güvenli hata kaydı | Başarılı bağlantı tek başına genel analizi açmaz. |
| Gerçek analiz doğruluğu | CSV ve XLSX için kaynak satırları, toplam/sayım/ortalama, sayı biçimi, eksik değerler ve büyük tutarlar beklenen cevapla karşılaştırılır | Hesap Python'dan gelir; modelin metrik üretmesine izin verilmez. |
| Dil ve anlatım kalitesi | Altı dilde gerçek sonuç; [insan incelemesi tablosu](TABULAR-ANALYSIS.md#gerçek-rapor-insan-incelemesi-tablosu) üzerinden kaynak satırı, gözlem/yorum, eksik veri, kanıtsız neden/tahmin, öneri dayanağı ve dil değerlendirmesi | Bir dilde başarısız kabul tüm dilleri başarılı yapmaz; gerçek sonuç yoksa kalite durumu **`beklemede` (`pending`)** kalır. |
| İş yaşam döngüsü | Gerçek backend'de yenileme, çift tıklama, kota, eşzamanlılık, yetki reddi, hata sonrası güvenli tekrar ve silme yarışı | Başarısız iş ve geciken yanıt kullanıcıya doğru durumla sunulur. |
| Süre ve maliyet | Gerçek token/kullanım ve Python/model/toplam süre; günlük sınırlar, bütçe alarmı ve kontrol edilebilir kapatma | Ölçülmemiş değer sıfır veya tahmin olarak raporlanmaz. |
| Sınırlı beta yayını | Kimlerin erişeceği kararı, kaynak saklama/silme süresi, hata izleme ve destek yolu; son CI ve aynı paketin canlı kabulü | Küçük kullanıcı grubunda ölçümlü açılış; mevcut hazırlık korunur. |

## İnsan incelemesi kabul tablosu ve karar kaydı

Mekanik kabul (`acceptance.json`) yalnız yapısal/sayısal/kaynak hash doğruluğunu kanıtlar; insan incelemesi ayrı karar nesnesiyle (`reportId`, `reportSha256`, `sourceSha256`, `locale` alanlarına bağlı `validateHumanReviewDecision`) kaydedilir. Sentetik anlatımla geçen testler bu insan kabulünü kapatmaz; gerçek model sonucu gelmeden insan incelemesi **`beklemede` (`pending`)** kalır. Ayrıntılı ölçüt tablosu [analiz rehberindedir](TABULAR-ANALYSIS.md#gerçek-rapor-insan-incelemesi-tablosu).

## Sınırlı beta operasyon durumu (19 Kasım salt okunur kontrolü)

Bulut ayarlarında, IAM’de, bütçede, kotada veya saklama politikasında değişiklik yapılmadan repo kaynakları ve mevcut CLI yetkileriyle (`firebase functions:list --project incagen-eeef4`) doğrulanan durum:

| Başlık | Mevcut durum ve kanıt | Eksikse etkisi | İlk beta öncesi gereken doğrulama |
| --- | --- | --- | --- |
| Hata izleme | **Kısmen doğrulandı:** `functions/src/analysis/gemini.ts` ve `tabular-jobs.ts` ham belge/anahtar sızdırmadan yapısal uyarı (`gemini-rejected-response`, `gemini-request-failed`) ve sınıflı `AnalysisFailure` kaydeder; `firebase functions:list` ile 8 v2 fonksiyonun (`europe-west1`, `nodejs22`) dağıtıldığı doğrulandı. **Cloud Monitoring uyarı politikaları (`gcloud monitoring`): `doğrulanamadı`** (`gcloud` kurulu değil / izleme yetkisi CLI’da yok). | 5xx/timeout artışında ekip proaktif bildirim alamayabilir. | GCP Monitoring üzerinde `startAnalysis` / Cloud Run hata oranı ve gecikme uyarı politikasının kurulduğu doğrulanmalı. |
| Süre ve token ölçümü | **Mekanik altyapı doğrulandı / Canlı taban `beklemede`:** `tabular-jobs.ts` `durationMs`, `pythonMs`, `modelMs`, `usage` kaydeder; `scripts/summarize-usage-acceptance.mjs` CSV/XLSX ayrı medyan/en uzun/ortalama ve yinelenen `runId` engelini hesaplar. Canlı Gemini `timeout` (19 Kasım) ve `busy` (17 Kasım) nedeniyle gerçek model süre/token ölçümü yok. | Gerçek üretim p50/p95 gecikmesi ve token maliyeti henüz ölçülmemiştir. | Canlı sağlayıcı yanıtı açıldığında 6 dilde CSV/XLSX ölçüm özeti (`npm run usage:summarize`) alınmalı. |
| Kota ve hız sınırı | **Doğrulandı (kod ve emülatör):** `AI_JOB_LIMITS` (`dailyPerUser: 2`, `dailyGlobal: 100`, `attempts: 3`, `retryDelayMs: 30_000`, `leaseMs: 240_000`) sunucu transaction'ı ile (`users/{uid}/aiQuotas`, `internalAnalysisQuotas`) uygulanır; otomatik ücretli retry kapalıdır (`integration/tabular.test.mjs`). | Yanlışlıkla yüksek faturalı çağrı veya paralel deneme yarışı engellenir; yalnızca beklenen beta kohort büyüklüğüne göre `dailyGlobal: 100` gözden geçirilmelidir. | Beta kohort sayısıyla `dailyGlobal: 100` eşiğinin uyumu ekipçe onaylanmalı. |
| Bütçe alarmı | **`doğrulanamadı`:** Ortamda `gcloud`/Cloud Billing okuma yetkisi bulunmadığından `incagen-eeef4` faturalama bütçesi ve eşik alarmları okunamadı. | Beklenmedik API veya Cloud Run kullanım artışı erken uyarı olmadan maliyet oluşturabilir. | Cloud Billing konsolunda `incagen-eeef4` için %50/%90/%100 bütçe alarmı ve bildirim alıcıları doğrulanmalı. |
| Analizi kapatma yolu | **Doğrulandı:** Çift anahtar (`functions/.env.incagen-eeef4`: `INCAGEN_TABULAR_ANALYSIS_ENABLED=false`, ön yüzde `VITE_TABULAR_ANALYSIS_ENABLED=false`) canlıda kapalıdır; `verify:release`, `tabular-rollout.test.ts` ve kapalı analiz emülatör/arayüz testleri iş/kota ayrılmadığını ve model çağrılmadığını doğrular. | Açılış sonrası acil kapatma backend ortam değişikliği ve fonksiyon/ön yüz dağıtımı gerektirir (~1–2 dk). | Kapatma runbook'u (`INCAGEN_TABULAR_ANALYSIS_ENABLED=false` deploy) ekipçe tek adımda doğrulanmalı. |

### Açık ekip kararları (Beta öncesi netleşecek)

- **Beta erişim kararı (Açık):** İlk tablo betasına hangi kullanıcıların/hesapların erişeceği (davetli test hesapları / claim veya kohort sınırı) ekip kararı olarak belirlenecek; genel kayıtlı kullanıcılara açık bırakılmayacak.
- **Veri saklama süresi kararı (Açık / Bulut TTL `doğrulanamadı`):** Mevcut akışta veriler kullanıcı silene kadar saklanır (`FLOW.md`). Ham kaynaklar (`users/{uid}/analyses/{id}`) ve türetilmiş AI/ayrıştırma artefaktları (`derived/{uid}/analyses/{id}`) için azami saklama süresi ve otomatik Storage lifecycle / Firestore temizlik kuralı beta öncesinde ekipçe kararlaştırılacak.

Kabul koşuları sentetik verilerle yapılır. Hesap ve dosya temizliği günlük üzerinden doğrulanır; gerçek kullanıcı belgeleri teşhis için alınmaz. Sağlayıcı hatasında sınırsız retry veya yayın kapılarını açık bırakma kullanılmaz. Ayrıntılı komutlar [test rehberinde](TESTING.md), kaynak ve model denetimleri [analiz rehberinde](TABULAR-ANALYSIS.md#yayın-kapısı-ve-canlı-kabul) kalır.

## İlk betadan sonra

- PDF/Word/PowerPoint ve birden fazla belgeyi birlikte yorumlama: extraction uyarıları, kaynak bağlama ve rapor düzeni için ayrı kabul. OCR/görsel yorum kapsamı ayrıca kararlaştırılır.
- Google Analytics ve Microsoft Clarity: kullanıcı yetkilendirmesi, kaynak kapsamı, bağlantıyı kaldırma ve hata durumları; Google Ads kapsamda değildir.
- Apple/Microsoft ile giriş: sağlayıcı hesabı/alan adı şartları, hesap eşleme, yeniden doğrulama ve hesap silme kabulü.
- Operasyon: saklama/karantina politikası, yedekleme/geri yükleme denemesi, erişim ve kota araçları. Backend servis hesabının eski geniş rolünün daraltılması ayrı kontrollü değişikliktir.

## Çalışma oturumu tahmini

Sağlayıcı kararlı yanıt vermeye başladığında, ilk **CSV/XLSX analiz betası için yaklaşık 5–7 odaklı oturum** öngörülür. Bu bir teslim tarihi veya garanti değildir; gerçek kalite kabulündeki hatalara göre değişir. Sağlayıcı kapasitesi, hesap/onay ve ekip kararı beklenen takvim günleri bu sayıya dahil değildir.

Yukarıdaki sonraki kapsam da istenirse, ödeme ve domain hariç **toplam yaklaşık 10–16 oturum** daha gerçekçi bir planlama aralığıdır. OCR ve geniş operasyon/ekip yönetimi ayrıca büyüyebilir. Öncelik ilk beta kabulünü bitirmektir; tüm isteğe bağlı özellikler tamamlanmadan da sınırlı beta değerlendirilebilir.
