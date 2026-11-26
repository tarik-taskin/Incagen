# Gemini backend bağlantısı

Resmî `@google/genai` SDK'sı yalnız Functions tarafındadır. Seçili model `gemini-3.8-flash`; model adı resmî katalogdan doğrulandı. Anahtar kullanıcı tarafından doğrudan Secret Manager'a girildi; canlı backend bağlantısı 2 Kasım 2026 tarihinde tek sabit sentetik çağrıyla doğrulandı. UI ve belge hazırlığı otomatik model çağırmaz; bu bağlantı kabulü analiz kalitesinin kabulü değildir.

## Anahtar kurulumu ve yenileme

İsteğe bağlı yerel, backend-only bağlantı testi (mevcut bulut kurulumu için gerekmez):

```bash
cp functions/.secret.local.example functions/.secret.local
# GEMINI_API_KEY değerini yalnız bu Git dışı dosyada doldurun.
npm run gemini:check
```

Komut yalnız sabit `{"status":"ok","service":"incagen"}` yanıtı ister; belge, hesap verisi veya serbest prompt göndermez. Anahtar yoksa `not-configured`, `liveCallMade:false` ile çıkar (kod 2). Anahtar varsa tek gerçek Gemini çağrısı yapar; başarısızlığın ham sağlayıcı gövdesini/anahtarı yazdırmaz. Bu test gerçek model yanıtını doğrular; analiz kalitesini doğrulamaz.

Bulutta anahtar doğrudan Secret Manager'a girilir; değeri komut argümanına yazmayın, komutun açtığı gizli giriş alanına yapıştırın:

```bash
npx firebase functions:secrets:set GEMINI_API_KEY --project incagen-eeef4
```

Secret Manager'da **yalnız bu secret üzerinde**, `checkGemini` çalışma zamanı servis hesabına `Secret Manager Secret Accessor` rolü verilmelidir. Mevcut çalışma zamanı hesabı `483199933468-compute@developer.gserviceaccount.com`; dağıtımda farklı hesap seçilirse Functions ayarındaki gerçek hesap esas alınır. Proje genelinde erişim veya yeni servis hesabı anahtar dosyası gerekmez. Sonraki istek `latest` sürümünü okur; anahtarın frontend/Netlify değişkenine eklenmesi veya web sitesinin yeniden derlenmesi gerekmez.

2 Kasım kurulumunda bu secret kapsamındaki rol verildi ve tekrar okunarak doğrulandı; herkese açık principal bulunmuyor. Servis hesabı projenin mevcut backend çalışma zamanı hesabıdır, yalnız `checkGemini` için oluşturulmuş ayrı bir kimlik değildir. Anahtar değeri bağlantı testinde yalnız buluttaki function tarafından okundu; yerel dosyaya veya test çıktısına alınmadı.

Cloud callable `checkGemini` için Firebase Auth kullanıcısının güvenilir yönetici tarafından atanmış `incagenDeveloper: true` custom claim'i ve son beş dakikada giriş yapmış olması gerekir. Bu claim istemciden atanamaz. Dağıtım hiçbir mevcut kullanıcıya kendiliğinden yetki vermez. Normal kullanıcıya teşhis düğmesi sunulmaz; API anahtarı istek gövdesiyle alınmaz. Yalnız temel `{}` veri gövdesi kabul edilir.

## Sınırlar ve hata davranışı

- Sabit kontrol prompt'u, `LOW` thinking, en fazla 2.048 çıktı token'ı ve 90 saniye model sınırı; callable süresi 120 saniyedir. Tek istek yapılır, otomatik ücretli retry yok. Bu sınırlar 6 Kasım güncellemesidir; aşağıdaki 2 Kasım kabulü kendi tarihindeki ayarları anlatır.
- UID başına 60 saniyede bir; proje genelinde UTC gününde en fazla 20 kontrol. Sayaçlar transaction ile tutulur; eksik anahtar sayaç tüketmez. Sağlayıcıya gönderilmiş başarısız deneme hak tüketir.
- Anahtarın yokluğu/okunamaması `failed-precondition`; sağlayıcı, zaman aşımı veya geçersiz JSON `unavailable` olur. Geliştirici teşhisinin `geminiFailure` ayrıntısı yalnız sabit hata türüdür; 429/503 `busy`, 408/504 veya yerel deadline `timeout` olarak ayrılır, 400/403 yoğunluk sayılmaz. Ham hata ve yanıt loglanmaz. `maxInstances: 1` ve `concurrency: 1` kullanılır.
- Runtime secret okuması 5 saniye ile sınırlıdır. Yerel emülatör bulut secret'ına düşmez. Bulutta düz ortam `GEMINI_API_KEY` okunmaz.

## İlk analiz adaptörü

`generateValidatedAnalysis(packet, generate)` mevcut analiz veri paketi ve `validateAiResult` kapısını kullanır. 256 KiB girdi, 64 KiB yanıt, 8.192 çıktı token'ı sınırı vardır. Belge içeriği talimat sayılmaz; metrik/veri kümesi yalnız sunucunun doğruladığı defterden gelebilir. Araç/kod yürütme açılmaz, kesilmiş veya filtrelenmiş model sonucu kabul edilmez.

Bu genel yardımcı kullanıcı çalışma uçlarına bağlanmaz; ilk CSV/XLSX hattı aşağıdaki ayrı, doğrulanmış hesap defteriyle çalışan dar yorum adaptörünü kullanır. Kuyruk/idempotency, maliyet ölçümü ve model kalitesi kabulü tamamlanmadan otomatik analiz açılmaz. Şema/kaynak doğrulaması, serbest metindeki bütün anlamsal iddiaların doğru olduğunu kanıtlamaz. Gerçek değerlendirme [referans protokolü](../fixtures/analysis-reference/evaluation.md) ile yapılmalıdır.

Birim testleri sentetik sağlayıcı yanıtlarını kullanır; emülatör testleri yetki, eksik anahtar ve eşzamanlı maliyet sınırını doğrular. Bunlar gerçek Gemini çağrısı yapıldığı anlamına gelmez.

## Canlı bağlantı kabulü — 2 Kasım 2026

Canlı `checkGemini` üzerinden tek sabit sentetik çağrı 200 ve `{status: "ok", model: "gemini-3.8-flash"}` döndü; süre 10,3 saniyeydi. Oturumsuz çağrı 401, normal kullanıcı 403, geliştiricinin özel prompt isteği 400 ve hemen tekrarlanan çağrı 429 aldı. Dolayısıyla reddedilen bu kontroller modele ek istek göndermedi. Runtime'da bir instance, bir eşzamanlı istek ve 60 saniye Functions süresi doğrulandı.

Yalnız bu test için oluşturulan hesaba geçici geliştirici claim'i verildi; kabulden sonra claim kaldırıldı, oturumlar iptal edildi, Auth hesabı ve kişisel teşhis kaydı silindi. Gerçek kullanıcıya geliştirici yetkisi verilmedi. Proje günlük sayacı maliyet sınırını korumak için sıfırlanmadı. Bu kabul, kullanıcı belgelerinden üretilecek analizlerin doğruluğu veya uçtan uca analiz hattının hazır olduğu anlamına gelmez.

Resmî kaynaklar: [SDK ve başlangıç](https://ai.google.dev/gemini-api/docs/get-started), [model kataloğu](https://ai.google.dev/gemini-api/docs/models), [yapılandırılmış çıktı](https://ai.google.dev/gemini-api/docs/structured-output), [Secret Manager erişimi](https://docs.cloud.google.com/secret-manager/docs/access-secret-version).

## Kullanıcı tablosuyla kaynaklı analiz

5 Kasım geliştirmesi, `startAnalysis` üzerinden seçilen tek CSV/XLSX tablosunun doğrulanmış Python hesaplarını modelin kısa yorumuyla birleştirir. Metrik/grafik değerleri modelden alınmaz; anahtar mevcut sunucu secret okuyucusunda kalır. Bu iş akışının limitleri geliştiriciye özel `checkGemini` limitlerinden ayrıdır. Özel worker/callable uçları dağıtıldı. Kullanıcı analizi 90 saniye ile sınırlıdır. Otomatik tekrar yoktur. Gerçek analiz denemeleri `503 / capacity` aldı; minimal bağlantı kontrolü de başarısızdı. Altı dilde canlı model kalite kabulü tamamlanmadığından backend ve arayüz yayın kapıları kapalıdır. Bu durum anahtarın eksik olduğu anlamına gelmez; anahtar değeri teşhis için yerel ortama alınmadı. Güncel kapsam ve onay planı [tablo analizi rehberindedir](TABULAR-ANALYSIS.md).


## Sır indirmeden bulut teşhisi

```bash
INCAGEN_CLOUD_DIAGNOSTIC=1 node scripts/check-gemini-cloud.mjs
```

Komut mevcut Firebase CLI oturumunu ve yalnız public Firebase web yapılandırmasını kullanır. `incagen-eeef4` dışında çalışmaz; sağlayıcı anahtarını okumaz. Yeni UUID içeren sentetik Auth hesabına yalnız test süresince geliştirici claim'i verir, tek sabit backend isteği gönderir, sonra claim'i kaldırır ve hesabı siler. Silindiği Auth metadata üzerinden doğrulanır. `/tmp/incagen-cloud-probe-resources.json` yalnız proje/UID/temizlik durumudur; e-posta, parola ve token içermez. Model veya temizleme hatasında başarılı çıkış verilmez; global maliyet sayacı korunur.

Geliştirici teşhisinin sağlayıcı süresi 300 saniye, Functions süresi 330 saniye ve istemci süresi 340 saniyedir. Sentetik çağrıda Gemini 3.8 Flash için `LOW` düşünme seviyesi ve sağlayıcının varsayılan sıcaklığı kullanılır. Yalnız `checkGemini` revizyonunu yayınlamak için `INCAGEN_CLOSED_FUNCTIONS_DEPLOY=1 npm run backend:functions:deploy -- --diagnostic-only` komutu kullanılır. [Google sorun giderme rehberi](https://ai.google.dev/gemini-api/docs/troubleshooting).

`INCAGEN_CLOUD_DIAGNOSTIC_TRANSPORT=interactions` eklendiğinde geliştirici teşhisi aynı sabit JSON’u Interactions v1 ile ister. `store=false` kullanır ve otomatik tekrar veya devam isteği göndermez. Çıktıda `transport: interactions` sunucu tarafından doğrulanır. Bu kanıt model bağlantısını ölçer. Uygulamanın `generateContent` tabanlı kullanıcı analizinin kalite kabulü ayrı çalışır. [Interactions API](https://aistudio.google.com/api-reference/interactions-api?api-version=v1).

`INCAGEN_CLOUD_DIAGNOSTIC_TRANSPORT=interactions-priority` seçeneği aynı sentetik isteği Priority kuyruğuna yönlendirir. Proje başına günde tek Priority teşhisi atomik olarak ayrılır. Sağlayıcı Standard kuyruğuna düşürürse dönen hizmet seviyesi `serviceTier` alanında görünür. [Priority rehberi](https://aistudio.google.com/docs/priority-inference).

6 Kasım devamında ilk iki 45 saniyelik kontrol doğrulanamadı; yeni güvenli sınıflama bunlardan ikincisini `timeout` olarak ayırdı. Analizle aynı `LOW`/90 saniye ayarıyla yapılan son kontrol `busy` yanıtı aldı. Hesaplar ve geçici yetkiler temizlendi. Gerçek analiz kalite kabulü hâlâ tamamlanmadı; açılış anahtarları kapalı kalır. [Resmî thinking seçenekleri](https://aistudio.google.com/docs/thinking?generate-content=true).

16 Kasım tek sabit sentetik backend kontrolü 95.680 ms içinde `functions/unavailable / timeout` verdi. Tekrar çağrı yapılmadı; geçici geliştirici claim’i kaldırıldı, hesap silindi ve koşuya özel kaynak günlüğü `verified-clean` oldu. Bu sonuç gerçek bağlantı veya analiz kalite kabulü değildir; model/anahtar değiştirilmedi, iki yayın kapısı kapalı kaldı.

17 Kasım 2026 aşamalı güncellemesi: `scripts/check-gemini-cloud.mjs` yalnız izinli sabit alanları (`probe`, `status`, `stage`, `callAttempted`, `code`, `reason`, `durationMs`, `stages`, `cleanup`) raporlar; durum dosyasına `cleaned: true` yalnız `deleteAccount`, `admin lookup` ve `journal.verifyClean` başarıyla tamamlandıktan sonra atomik olarak yazılır ve tam temiz/doğrulanmış olmayan önceki kayıtlar sonraki koşularda korunur. Tek sabit sentetik bulut çağrısında (`21.684 ms` toplam) `configuration` (`2.110 ms`) ve `clientAuth` (`3.358 ms`) geçti; `callable` (`checkGemini`) aşaması `6.631 ms` içinde `functions/unavailable / busy` döndürdü (`callAttempted: true`), tekrar deneme yapılmadı ve `cleanup` (`9.583 ms`, geçici claim kaldırma + hesap silme + `verified-clean`) doğrulandı. İstemci/kimlik/Secret/kota ön adımlarının geçtiği, engelin `checkGemini` sonrasındaki model çağrısında (`busy`) olduğu daraltıldı; iki yayın kapısı kapalıdır (ek canlı Gemini çağrısı açılmadı).

19 Kasım 2026 tek sabit sentetik bulut kontrolü (`2026-11-19T07:43:08Z`): `configuration` (`1.532 ms`) ve `clientAuth` (`1.925 ms`) geçti; `callable` (`checkGemini`) `94.849 ms` içinde `functions/unavailable / timeout` döndürdü (`callAttempted: true`, tekrar çağrı yapılmadı) ve `cleanup` (`11.461 ms`, `temporaryClaimRemoved: true`, `syntheticAccountDeleted: true`, `journalVerifiedClean: true`, `cleaned: true`) doğrulandı (toplam `109.768 ms`). Bağlantı engeli (`timeout`) sürdüğünden ek çağrı yapılmadı, `--smoke` çalıştırılmadı ve iki yayın kapısı kapalı tutuldu.

26 Kasım 2026 güncel tek sentetik kontrol: kapalı backend sürümü doğrulandı. `checkGemini` 95.401 ms sonunda `functions/unavailable / timeout` döndü. Temizlik geçti ve ek model isteği yapılmadı. [Beta kabul durumu](BETA-ACCEPTANCE.md#ilk-beta-için-kalan-kabul).
