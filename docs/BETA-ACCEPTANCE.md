# İlk analiz betası — kapsam ve çıkış kanıtı

Bu plan ödeme altyapısını ve domain işlerini kapsamaz. Aktif işlerin durumu [GOAL.md](../GOAL.md), gerçek ürün davranışı [FLOW.md](../FLOW.md), teknik analiz sözleşmesi [TABULAR-ANALYSIS.md](TABULAR-ANALYSIS.md) içindedir. Burada tamamlanmış kod ile henüz gerçek sağlayıcı üzerinde kanıtlanmamış kabul ayrılır.

## Bugünkü sınır

Belge yükleme/hazırlama, kaynak konumları, geçmiş, indirme ve silme çalışır. Özel Python CSV/XLSX hesap işçisi ve backend Gemini adaptörü dağıtılmıştır. Bunları yeniden kurmak sonraki iş değildir. Genel analiz yayını iki kapıda da kapalıdır; örnek raporlar gerçek model kalite kabulü yerine geçmez.

16 Kasım 2026 tek bağlantı kontrolü `functions/unavailable / timeout` ile sonuçlandı (95.680 ms). 17 Kasım 2026 aşamalı tek bağlantı kontrolünde ise `configuration` (`2.110 ms`) ve `clientAuth` (`3.358 ms`) aşamaları geçti; `callable` (`checkGemini`) aşaması `6.631 ms` içinde `functions/unavailable / busy` döndürdü ve `cleanup` (`9.583 ms`, `verified-clean`) tamamlandı (toplam `21.684 ms`). 19 Kasım 2026 canlı Gemini kontrolünde (`2026-11-19T07:43:08Z`): `configuration` (`1.532 ms`) ve `clientAuth` (`1.925 ms`) geçti, `callable` `94.849 ms` içinde `functions/unavailable / timeout` döndürdü (`callAttempted: true`, tekrar çağrı yok) ve `cleanup` (`11.461 ms`, `verified-clean`) tamamlandı (toplam `109.768 ms`). **`21 Kasım` ve `22 Kasım 2026` çalışma paketlerinin kapsamı yalnızca yerel kod, Firebase emülatörü doğrulamaları ve ön yüz Netlify yayınıdır**; bu oturumlarda yeni canlı Gemini çağrısı, Firebase Functions/Cloud Run dağıtımı, IAM/bütçe değişikliği veya gerçek model insan kalite onayı yapılmamıştır, genel analiz kapıları kapalıdır. 22 Kasım oturumunda örnek rapordan doğrudan satış CSV erişimi, Yeni Analiz belge hazırlama/tablo kapsamı ayrımı, hesaplama öncesi 5 satırlık yetkili tablo önizlemesi, kararlı tablo/sayfa seçimi, sabit güvenli Python hata kodları, iki sayfalı Excel satır ağırlıklı ortalama tarayıcı kabulü, denetlenebilir rapor kapsamı ve `getAnalysisResult` okuma bütünlük doğrulaması yerelde ve emülatörde kanıtlandı. Otomatik tekrar yapılmadı; geçerli canlı sağlayıcı yanıtı alınmadan gerçek Gemini kalite/maliyet veya canlı operasyon kabulü tamamlandı sayılmaz. Çevrimdışı analiz değerlendiricisi (`scripts/evaluate-analysis-offline.mjs`), Python-rapor testi (`scripts/python-to-report.test.ts`) ve süre/kullanım kabul özeti (`scripts/summarize-usage-acceptance.mjs`) yalnızca çevrimdışı/kontrollü hazırlığı destekler; gerçek sağlayıcı veya altı dilli model kalite kabulü yerine geçmez. Anahtar değiştirmek, sonucu taklit etmek veya şemayı gevşetmek bu engeli çözmez.

**26 Kasım 2026 güncel kanıtı:** Cloud Run işçisi ve dört kapalı Firebase Function doğrulandı (backend `6601c49`). Tek Gemini 3.8 Flash bağlantı denemesi `functions/unavailable / timeout` döndü (95.401 ms). Teşhis hesabı, geçici claim ve kaynak günlüğü temizliği doğrulandı. Kapalı kabulde (`5346048`) CSV ve iki sayfalı XLSX için katalog, fiziksel satırlar ve tarayıcı hazırlığı geçti. Bu iki hazırlıkta model çağrısı veya ücretli rezervasyon oluşmadı. Gerçek analiz, altı dilde insan incelemesi ve token ölçümü bekliyor.

**27 Kasım 2026:** Gemini 3.8 Flash için Standard taşımalarda zaman aşımı/kapasite hatası, Priority’de 429 görüldü. Tek 3.6 Flash karşılaştırması da 503 kapasite hatası döndü. Test kaynaklarının temizliği doğrulandı. Canlı bağlantı kabulü geçerli 3.8 Flash yanıtı bekliyor. [Teşhis kaydı](GEMINI.md#sır-indirmeden-bulut-teşhisi).

27 Kasım’da günlük kota yenilendikten sonra yapılan tek 3.8 Flash Standard kontrolü başarılı olmadı. Bulut günlükleri 12.210 ms’de HTTP 503 kapasite yanıtını doğruladı. Geçici deneme kaynakları temizlendi. [Teşhis kaydı](GEMINI.md#sır-indirmeden-bulut-teşhisi)

**27 Kasım yeni secret sürümü:** Standard `generateContent` ile Gemini 3.8 Flash sabit JSON cevabı verdi. Callable süresi 21.717 ms. Geçici hesap, geliştirici claim’i ve kaynak günlüğü temizliği doğrulandı. Kullanıcı raporu ve altı dilde kalite kabulü ayrı aşamalardır. [Sentetik tablo akışı](GEMINI.md#kapalı-üretimde-sentetik-tablo-kontrolü)

16 Kasım üretim bağımlılığı denetiminde kök ağaçta uyarı yok; Functions ağacında dört orta ve bir düşük kayıt var, yüksek/kritik yok. Yeni düşük `fast-xml-parser` kaydı ve kalan zincirler sonraki kontrollü backend paketinde değerlendirilmeli; bu çalışma bunları giderilmiş saymaz.

## İlk beta için kalan kabul

Yerel, emülatör ve 26 Kasım kapalı canlı kanıtlarıyla birlikte ilk beta için kalan kontroller:

| Aşama | Sahip | Mevcut doğrulama | Açık canlı kanıt ve gereken araç | Açılış kararı |
| --- | --- | --- | --- | --- |
| Tek sentetik bağlantı kontrolü | Furkan / Backend | Yeni secret sürümüyle `gemini-3.8-flash` bağlantısı ve geçici kaynak temizliği 27 Kasım’da doğrulandı. | Geçen callable 21.717 ms. Tek sentetik vaka ve temizliği teşhis çıktısında kayıtlı. | Gerçek rapor ve operasyon kabulü ayrı tamamlanır. |
| CSV ve XLSX gerçek analiz doğruluğu | Furkan / Backend | Gerçek Python + emülatör sentetik modeliyle düz/boş satırlı/tırnak içi satır sonlu CSV ve iki sayfalı XLSX (`Hizmetler` satır ağırlıklı ortalama `40,00 EUR`, `Kapsam Dışı` hariç), fiziksel satır eşlikli ve 512 KiB bütçe korumalı önizleme, güvenli hata kodları ve `getAnalysisResult` yapısal/kaynak/grafik bütünlük doğrulaması (`validateStoredArtifact` + `validateAiResult`) masaüstü/mobil E2E + entegrasyonda geçti. | Canlı sağlayıcıda `INCAGEN_LIVE_MODEL_ACCEPTANCE=1 INCAGEN_ACCEPTANCE_URL=... node scripts/accept-tabular-cloud.mjs` (`--smoke` ardından bayraksız tam kabul) ile `gemini-3.8-flash` CSV ve çok sayfalı XLSX fiziksel kanıt, kaynak/hash eşliği ve `verifyAcceptanceEvidence` geçişi. | Hesap Python'dan gelir; modelin metrik üretmesine izin verilmez. Emülatör sonucu ve okuma bütünlük kontrolü canlı model kalite kabulü yerine geçmez. |
| Altı dilde insan incelemesi | Ürün + Furkan | Ön yüz 6 dil ve Arapça RTL, kayıtlı rapor dilinin korunması ve doğrulanmış hesap / model yorumu ayrımı birim + E2E ile doğrulandı; `scripts/accept-tabular-cloud.mjs` içindeki `validateHumanReviewDecision` mekanik testleri geçti. | Altı dilde gerçek `gemini-3.8-flash` çıktıları için [insan incelemesi tablosu](TABULAR-ANALYSIS.md#gerçek-rapor-insan-incelemesi-tablosu) üzerinden `validateHumanReviewDecision` ile doğrulanan `reportId`, `reportSha256`, `sourceSha256`, `gitCommit`, `locale`, `reviewedAt` karar kayıtları. | Bir dilde başarısız kabul tüm dilleri başarılı yapmaz; gerçek sonuç yoksa durum **`beklemede` (`pending`)** kalır. |
| İş yaşam döngüsü ve bütünlük | Furkan / Backend | Emülatörde yenileme, Geçmiş dönüşü, çift tıklama, kota, eşzamanlılık, yetki reddi, bekleme sonrası güvenli tekrar, silme yarışı ve saklanan v1 artefaktı bütünlük kontrolü (`validateStoredArtifact` + `validateAiResult`: parça sayfa/satır aralığı, grafik/veri kümesi referansları) geçti. | Kapalı canlı dağıtım ve CSV/XLSX hazırlık kabulü 26 Kasım’da geçti. Açık model modunda canlı çalışma ve sonuç okuma hâlâ bekliyor. | Başarısız iş ve geciken yanıt uygun durumla sunulur. Gerçek model koşusu ayrıca değerlendirilecek. |
| Gerçek süre ve token ölçümü | Ürün + Backend | `summarize-usage-acceptance.test.mjs` (`7/7`) ve eksik ölçüm uydurmama kontrolleri geçti; `LiveAnalysisReport` eksik süre/token alanlarını gizler. | Gerçek `gemini-3.8-flash` oturumu sonrası ölçümlü CSV ve XLSX örnekleriyle `npm run usage:summarize -- --input <koşu-dizini>/runs.json` raporu (`measuredSampleCount`, `medians`, `maxima`). | Ölçülmemiş değer sıfır veya tahmin olarak raporlanmaz; canlı ölçüm olmadan **`beklemede`**. |
| Bütçe alarmı | Altyapı / Proje Sahibi | Değişiklik yapılmadı (CLI'da Cloud Billing okuma yetkisi yok). | `incagen-eeef4` faturalama hesabında %50/%90/%100 bütçe eşiği ve alıcı tanımını gösteren salt okunur politika kaydı / ekran görüntüsü. | Bütçe alarmı doğrulanmadan genel açılış yapılmaz (`doğrulanamadı`). |
| Hata izleme | Altyapı / Backend | Kodda sabit hata kodları (`AnalysisFailure`, `WorkerError`, `gemini-rejected-response`, `gemini-request-failed`) ham veri sızdırmadan test edildi. | GCP Cloud Monitoring üzerinde `startAnalysis` / Cloud Run 5xx, timeout ve reddedilen Gemini yanıtları için uyarı politikası kimliği ve test bildirimi kaydı. | Kod loglaması canlı uyarı politikası yerine geçmez (`kısmen doğrulandı`). |
| Sınırlı beta yayını | Ürün + Güvenlik / Yayın | Ön yüz kapalı analiz bayraklarıyla (`VITE_TABULAR_ANALYSIS_ENABLED=false`) Netlify `verify:release` eşliği doğrulandı. | Beta kohort erişim kararı, ham/türetilmiş veri saklama (TTL) politikası ve kapalı mod dışına geçiş onayı. | Küçük kullanıcı grubunda ölçümlü açılış; mevcut hazırlık korunur. |

## Kapalı üretimde kaydedilen rapor provası

Sabit bağlantı ve tablo teşhisinden sonra normal kullanıcı analizi kapalıyken tek koşuya özel rapor provası yapılabilir. Ön koşul aynı Git SHA’sında Netlify paket eşliği, kapalı Firebase analiz uçları ve üretimdeki teşhis revizyonudur. Aracın geçici hesabına normal beta veya geliştirici yetkisi verilmez. Kısa ömürlü claim yalnız hazırlığı tamamlanan tek sentetik kayıt, dosya SHA’sı, biçim ve dil için geçerlidir.

```bash
INCAGEN_LIVE_MODEL_ACCEPTANCE=1 INCAGEN_ACCEPTANCE_ROUTE=synthetic \
  INCAGEN_ACCEPTANCE_URL=https://incagen.netlify.app node scripts/accept-tabular-cloud.mjs --smoke
```

İlk gerçek CSV koşusu geçince `--smoke` kaldırılarak altı dilli mekanik paket alınabilir. Her vaka gerçek yükleme, hazırlık, kaynak satırı, iş rezervasyonu, aynı üretim Gemini adaptörü, saklanan sonuç, tekrar okuma ve temizlik kullanır. CSV ve XLSX raporlarının tarayıcıda açılması, kaynak indirmesinin SHA eşliği ve yenilemede yeni model isteği çıkmaması ayrıca doğrulanır. Altı vakalı mekanik koşuda en fazla altı model isteği vardır. İlk hatada koşu durur. Geçici claim bir kez başarısız olan vaka için yeni deneme hakkı vermez.

Bu kanıtla birlikte `npm run acceptance:check` çıktısındaki insan incelemesi ve operasyon koşulları açık kaldığı sürece genel analiz kapalıdır.

## İnsan incelemesi kabul tablosu ve karar kaydı

Mekanik kabul (`acceptance.json`) yalnız yapısal/sayısal/kaynak hash doğruluğunu kanıtlar; insan incelemesi ayrı karar nesnesiyle (`reportId`, `reportSha256`, `sourceSha256`, `locale` alanlarına bağlı `validateHumanReviewDecision`) kaydedilir. Sentetik anlatımla geçen testler bu insan kabulünü kapatmaz; gerçek model sonucu gelmeden insan incelemesi **`beklemede` (`pending`)** kalır. Ayrıntılı ölçüt tablosu [analiz rehberindedir](TABULAR-ANALYSIS.md#gerçek-rapor-insan-incelemesi-tablosu).

## Sınırlı beta operasyon durumu ve ekip karar matrisi

26 Kasım salt okunur denetiminde proje kapsamında uyarı politikası sayısı sıfırdı. Firestore TTL yapılandırması ve Storage lifecycle kuralı bulunmadı. Storage’da 604.800 saniyelik (7 günlük) soft delete etkin. Cloud Billing bütçe sorgusu HTTP 403 döndü. [Cloud Monitoring](https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.alertPolicies/list) · [Firestore TTL alanları](https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.collectionGroups.fields/list) · [Storage bucket metadata](https://cloud.google.com/storage/docs/json_api/v1/buckets/get) · [Cloud Billing bütçeleri](https://cloud.google.com/billing/docs/reference/budget/rest/v1/billingAccounts.budgets/list)

| Başlık | Gerekli karar / doğrulama | Sorumlu ekip | Mevcut durum | Kabul kanıtı |
| --- | --- | --- | --- | --- |
| Beta erişimi | İlk tablo betasına hangi hesapların/davetli kohortun erişeceğinin ve `dailyGlobal: 12` eşiğinin onaylanması (genel kullanıcılara kapalı) | Ürün + Backend | Davet kuralı kodda ve emülatörde doğrulandı. Kapalı sunucu doğrulandı. Gerçek kohort ve açık mod kararı bekliyor. | Onaylı kohort, salt okunur sunucu ön kontrolü ve davetsiz hesabın rezervasyon görmediğine dair kayıt |
| Veri saklama ve silme kapsamı | Ham (`users/{uid}/analyses/{id}`) ve türetilmiş (`derived/{uid}/analyses/{id}`) kayıtlar için azami saklama süresi (TTL) ve otomatik Storage/Firestore temizliği; kullanıcı silmesinin kapsamı | Ürün + Güvenlik / Backend | TTL ve lifecycle yok. Storage soft delete süresi 7 gün. Saklama süresi onayı bekliyor. | Onaylı saklama süresi kararı + Storage lifecycle / temizlik doğrulaması |
| Bütçe alarmı | `incagen-eeef4` faturalama hesabında %50/%90/%100 bütçe eşiği ve e-posta/Slack alıcılarının tanımlanması | Altyapı / Proje Sahibi | `doğrulanamadı` (Cloud Billing sorgusu HTTP 403) | Cloud Billing bütçe politikası ekran görüntüsü veya salt okunur politika kaydı |
| Hata izleme | `startAnalysis` / Cloud Run 5xx, timeout ve reddedilen Gemini yanıtları için uyarı politikalarının kurulması | Altyapı / Backend | Uygulama hata kodları var. Projede Cloud Monitoring uyarı politikası bulunmadı. | GCP Monitoring uyarı politikası kimliği ve test bildirimi kaydı |
| Süre ve token ölçümü | Sağlayıcı yanıtı açıldığında 6 dilde CSV ve XLSX gerçek çalışma süresi (`pythonMs`, `modelMs`, `durationMs`) ve token ölçümü | Ürün + Backend | `beklemede` (mekanik kayıt kodda var; 26 Kasım `timeout` nedeniyle başarılı canlı analiz ölçümü yok) | Ölçümlü örneklemle geçen `npm run usage:summarize` + insan inceleme kaydı |
| Kota, hız sınırı ve kapatma yolu | Sunucu transaction kotası (`dailyPerUser: 2`, `dailyGlobal: 12`) ve çift kapatma kapısının (`INCAGEN_TABULAR_ANALYSIS_ENABLED`, `VITE_TABULAR_ANALYSIS_ENABLED`) korunması | Backend + Yayın | **Kapalı mod canlıda doğrulandı.** Açık mod kota kabulü bekliyor. | `verify:release` yalnız canlı ön yüz bayraklarını (`VITE_TABULAR_ANALYSIS_ENABLED=false`, `VITE_AUTH_ONLY_PREVIEW=false`) ve Netlify paket/manifest/rota eşliğini kanıtlar; `tabular-rollout.test.ts` ve `integration/tabular.test.mjs` kod/emülatör kilidini doğrular; canlı sunucu kapısı (`INCAGEN_TABULAR_ANALYSIS_ENABLED=false`) ise ayrı dağıtım metadata kontrolü ve iki formatlı `scripts/accept-tabular-cloud.mjs --verify-closed` ile 26 Kasım’da doğrulandı. |

İlk beta bütçesi Pasifik gününde proje başına 12 analiz denemesidir. Teşhis için ayrı günlük dört istek sınırı vardır. Hazırlık ve kişisel analiz kotaları İstanbul günündedir. Bir Git veya Firebase yayını beta erişimini kendiliğinden açmaz. [Tablo analizi sınırları](TABULAR-ANALYSIS.md)

### İlk oturum sentetik doğrulama sırası ve durma kriterleri

Kapalı backend için [dar kapsamlı yayın ve sürüm kanıtı](DEVELOPMENT.md#kapalı-analiz-backend-yayını) kullanılabilir. Cloud Run/Functions metadata denetimi ve sentetik kapalı mod kabulü, gerçek Gemini ve kohort onayından ayrı kaydedilir.

Sağlayıcı yanıt vermeye başladığında yapılacak ilk kontrollü sentetik oturum sırası ([TESTING.md](TESTING.md), [DEVELOPMENT.md](DEVELOPMENT.md), [GEMINI.md](GEMINI.md)):

1. **Ön koşul ve temizlik:** `verify:release` ile canlı ön yüz yayın bayraklarının kapalı olduğunu ve Netlify paket/manifest/rota eşliğini, `tabular-rollout.test.ts` / `integration/tabular.test.mjs` ile backend kapısı kilidini ve ayrı backend kabul adımından (`functions/.env.incagen-eeef4` dağıtım kontrolü / `scripts/accept-tabular-cloud.mjs --verify-closed`) canlı sunucu kapısının kapalı kaldığını doğrula; önceki sentetik hesap/dosya temizliğinin `verified-clean` olduğunu kontrol et.
2. **Tek sentetik bağlantı kontrolü:** `INCAGEN_CLOUD_DIAGNOSTIC=1 node scripts/check-gemini-cloud.mjs` ile `gemini-3.8-flash` üzerinde tek kontrollü istek gönder; otomatik tekrar yapma. Hata veya timeout gelirse oturumu durdur ve güvenli hata kodunu kaydet.
3. **Tek CSV/XLSX sentetik çalışma + 6 dil örneklemi:** Yalnız onaylı küçük sentetik veriyle `scripts/accept-tabular-cloud.mjs` (`--smoke`, ardından bayraksız tam kabul) çalıştır; `npm run usage:summarize -- --input <koşu-dizini>/runs.json` çıktısında ölçümsüz/sıfır alan varsa kabul verme.
4. **İnsan ve kullanım kanıtı:** Rapora bağlı insan kararlarını kaydet ve [çevrimdışı kabul denetimini](TESTING.md#yerel-beta-kanıtını-kontrol-etme) beklenen commit SHA’sı ve `--require-ready` ile çalıştır. Tüm dil, kaynak, insan kararı ve ölçüm kanıtları tamamlanınca operasyon kontrollerine geç.
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
