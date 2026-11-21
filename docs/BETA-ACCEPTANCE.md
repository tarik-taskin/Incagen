# İlk analiz betası — kapsam ve çıkış kanıtı

Bu plan ödeme altyapısını ve domain işlerini kapsamaz. Aktif işlerin durumu [GOAL.md](../GOAL.md), gerçek ürün davranışı [FLOW.md](../FLOW.md), teknik analiz sözleşmesi [TABULAR-ANALYSIS.md](TABULAR-ANALYSIS.md) içindedir. Burada tamamlanmış kod ile henüz gerçek sağlayıcı üzerinde kanıtlanmamış kabul ayrılır.

## Bugünkü sınır

Belge yükleme/hazırlama, kaynak konumları, geçmiş, indirme ve silme çalışır. Özel Python CSV/XLSX hesap işçisi ve backend Gemini adaptörü dağıtılmıştır. Bunları yeniden kurmak sonraki iş değildir. Genel analiz yayını iki kapıda da kapalıdır; örnek raporlar gerçek model kalite kabulü yerine geçmez.

16 Kasım 2026 tek bağlantı kontrolü `functions/unavailable / timeout` ile sonuçlandı (95.680 ms). 17 Kasım 2026 aşamalı tek bağlantı kontrolünde ise `configuration` (`2.110 ms`) ve `clientAuth` (`3.358 ms`) aşamaları geçti; `callable` (`checkGemini`) aşaması `6.631 ms` içinde `functions/unavailable / busy` döndürdü ve `cleanup` (`9.583 ms`, `verified-clean`) tamamlandı (toplam `21.684 ms`). Kayıtlı **en güncel canlı Gemini sağlayıcı kontrolü `19 Kasım 2026` (`2026-11-19T07:43:08Z`)** tarihlidir: `configuration` (`1.532 ms`) ve `clientAuth` (`1.925 ms`) geçti, `callable` `94.849 ms` içinde `functions/unavailable / timeout` döndürdü (`callAttempted: true`, tekrar çağrı yok) ve `cleanup` (`11.461 ms`, `verified-clean`) tamamlandı (toplam `109.768 ms`). **`21 Kasım 2026` çalışma paketi kapsamı yalnızca kod, çevrimdışı/emülatör doğrulamaları ve ön yüz akışıdır**; bu oturumda yeni canlı Gemini çağrısı, Cloud Run/IAM/bütçe değişikliği veya insan kalite onayı yapılmamıştır, genel analiz kapıları kapalıdır. Otomatik tekrar yapılmadı; geçerli yanıt alınmadan kalite/maliyet kabulü tamamlandı sayılmaz. Çevrimdışı analiz değerlendiricisi (`scripts/evaluate-analysis-offline.mjs`), Python-rapor testi (`scripts/python-to-report.test.ts`) ve süre/kullanım kabul özeti (`scripts/summarize-usage-acceptance.mjs`) yalnızca çevrimdışı/kontrollü hazırlığı destekler; gerçek sağlayıcı veya altı dilli model kalite kabulü yerine geçmez. Anahtar değiştirmek, sonucu taklit etmek veya şemayı gevşetmek bu engeli çözmez.

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

## Sınırlı beta operasyon durumu ve ekip karar matrisi

Bulut ayarlarında, IAM’de, bütçede, kotada veya saklama politikasında değişiklik yapılmadan repo kaynakları ve 19 Kasım salt okunur `firebase functions:list --project incagen-eeef4` çıktısıyla doğrulanan durum (21 Kasım paketinde yeni bulut değişikliği yapılmamıştır):

| Başlık | Gerekli karar / doğrulama | Sorumlu ekip | Mevcut durum | Kabul kanıtı |
| --- | --- | --- | --- | --- |
| Beta erişimi | İlk tablo betasına hangi hesapların/davetli kohortun erişeceğinin ve `dailyGlobal: 100` eşiğinin onaylanması (genel kullanıcılara kapalı) | Ürün + Backend | `beklemede` | Onaylı kohort/erişim kuralı ve kapalı mod dışındaki geçiş kaydı |
| Veri saklama ve silme kapsamı | Ham (`users/{uid}/analyses/{id}`) ve türetilmiş (`derived/{uid}/analyses/{id}`) kayıtlar için azami saklama süresi (TTL) ve otomatik Storage/Firestore temizliği; kullanıcı silmesinin kapsamı | Ürün + Güvenlik / Backend | `doğrulanamadı` (Bulut TTL yok; `FLOW.md` kullanıcı silene kadar saklar) | Onaylı saklama süresi kararı + Storage lifecycle / temizlik doğrulaması |
| Bütçe alarmı | `incagen-eeef4` faturalama hesabında %50/%90/%100 bütçe eşiği ve e-posta/Slack alıcılarının tanımlanması | Altyapı / Proje Sahibi | `doğrulanamadı` (`gcloud`/Cloud Billing okuma yetkisi CLI’da yok) | Cloud Billing bütçe politikası ekran görüntüsü veya salt okunur politika kaydı |
| Hata izleme | `startAnalysis` / Cloud Run 5xx, timeout ve reddedilen Gemini yanıtları için uyarı politikalarının kurulması | Altyapı / Backend | **Kısmen doğrulandı** (`gemini-rejected-response` / `gemini-request-failed` ve `AnalysisFailure` kodda var; Cloud Monitoring uyarıları `doğrulanamadı`) | GCP Monitoring uyarı politikası kimliği ve test bildirimi kaydı |
| Süre ve token ölçümü | Sağlayıcı yanıtı açıldığında 6 dilde CSV ve XLSX gerçek çalışma süresi (`pythonMs`, `modelMs`, `durationMs`) ve token ölçümü | Ürün + Backend | `beklemede` (mekanik kayıt kodda var; 17 Kasım `busy` ve 19 Kasım `timeout` nedeniyle canlı ölçüm yok) | Ölçümlü örneklemle geçen `npm run usage:summarize` + insan inceleme kaydı |
| Kota, hız sınırı ve kapatma yolu | Sunucu transaction kotası (`dailyPerUser: 2`, `dailyGlobal: 100`) ve çift kapatma kapısının (`INCAGEN_TABULAR_ANALYSIS_ENABLED`, `VITE_TABULAR_ANALYSIS_ENABLED`) korunması | Backend + Yayın | **Kısmen doğrulandı (ön yüz + kod/emülatör; canlı sunucu kapısı ayrı kabulde)** | `verify:release` yalnız canlı ön yüz bayraklarını (`VITE_TABULAR_ANALYSIS_ENABLED=false`, `VITE_AUTH_ONLY_PREVIEW=false`) ve Netlify paket/manifest/rota eşliğini kanıtlar; `tabular-rollout.test.ts` ve `integration/tabular.test.mjs` kod/emülatör kilidini doğrular; canlı sunucu kapısı (`INCAGEN_TABULAR_ANALYSIS_ENABLED=false`) ise ayrı `functions/.env.incagen-eeef4` dağıtım kontrolü ve `accept-tabular-cloud` kapalı mod kabulüne bağlıdır. |

### İlk oturum sentetik doğrulama sırası ve durma kriterleri

Sağlayıcı yanıt vermeye başladığında yapılacak ilk kontrollü sentetik oturum sırası ([TESTING.md](TESTING.md), [DEVELOPMENT.md](DEVELOPMENT.md), [GEMINI.md](GEMINI.md)):

1. **Ön koşul ve temizlik:** `verify:release` ile canlı ön yüz yayın bayraklarının kapalı olduğunu ve Netlify paket/manifest/rota eşliğini, `tabular-rollout.test.ts` / `integration/tabular.test.mjs` ile backend kapısı kilidini ve ayrı backend kabul adımından (`functions/.env.incagen-eeef4` dağıtım kontrolü / `accept-tabular-cloud` kapalı mod) canlı sunucu kapısının kapalı kaldığını doğrula; önceki sentetik hesap/dosya temizliğinin `verified-clean` olduğunu kontrol et.
2. **Tek sentetik bağlantı kontrolü:** `check-gemini-cloud` akışıyla tek kontrollü istek gönder; otomatik tekrar yapma. Hata veya timeout gelirse oturumu durdur ve güvenli hata kodunu kaydet.
3. **Tek CSV/XLSX sentetik çalışma + 6 dil örneklemi:** Yalnız onaylı küçük sentetik veriyle çalıştır; `usage:summarize` çıktısında ölçümsüz/sıfır alan varsa kabul verme.
4. **Mekanik + insan incelemesi ayrımı:** `acceptance.json` sonrası her rapor için [insan incelemesi kararını](TABULAR-ANALYSIS.md#gerçek-rapor-insan-incelemesi-tablosu) (`reportId`, `reportSha256`, `sourceSha256`, `locale`, tarih, commit) kaydet; geçersiz veya eksik dil varsa genel betayı açma.
5. **Durma kriterleri:** Tekrarlayan `busy`/`timeout`, bütçe alarmı veya hata izleme eksiği, kota/sahip sızıntısı ya da hesap/dosya kalıntısı (`cleanup != verified-clean`) görüldüğünde testler hemen durdurulur ve kapılar kapalı tutulur.

Kabul koşuları sentetik verilerle yapılır. Hesap ve dosya temizliği günlük üzerinden doğrulanır; gerçek kullanıcı belgeleri teşhis için alınmaz. Sağlayıcı hatasında sınırsız retry veya yayın kapılarını açık bırakma kullanılmaz. Ayrıntılı komutlar [test rehberinde](TESTING.md), kaynak ve model denetimleri [analiz rehberinde](TABULAR-ANALYSIS.md#yayın-kapısı-ve-canlı-kabul) kalır.

## İlk betadan sonra

- PDF/Word/PowerPoint ve birden fazla belgeyi birlikte yorumlama: extraction uyarıları, kaynak bağlama ve rapor düzeni için ayrı kabul. OCR/görsel yorum kapsamı ayrıca kararlaştırılır.
- Google Analytics ve Microsoft Clarity: kullanıcı yetkilendirmesi, kaynak kapsamı, bağlantıyı kaldırma ve hata durumları; Google Ads kapsamda değildir.
- Apple/Microsoft ile giriş: sağlayıcı hesabı/alan adı şartları, hesap eşleme, yeniden doğrulama ve hesap silme kabulü.
- Operasyon: saklama/karantina politikası, yedekleme/geri yükleme denemesi, erişim ve kota araçları. Backend servis hesabının eski geniş rolünün daraltılması ayrı kontrollü değişikliktir.

## Çalışma oturumu tahmini

Sağlayıcı kararlı yanıt vermeye başladığında, ilk **CSV/XLSX analiz betası için yaklaşık 5–7 odaklı oturum** öngörülür. Bu bir teslim tarihi veya garanti değildir; gerçek kalite kabulündeki hatalara göre değişir. Sağlayıcı kapasitesi, hesap/onay ve ekip kararı beklenen takvim günleri bu sayıya dahil değildir.

Yukarıdaki sonraki kapsam da istenirse, ödeme ve domain hariç **toplam yaklaşık 10–16 oturum** daha gerçekçi bir planlama aralığıdır. OCR ve geniş operasyon/ekip yönetimi ayrıca büyüyebilir. Öncelik ilk beta kabulünü bitirmektir; tüm isteğe bağlı özellikler tamamlanmadan da sınırlı beta değerlendirilebilir.
