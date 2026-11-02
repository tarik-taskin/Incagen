# Gemini backend bağlantısı

Resmî `@google/genai` SDK'sı yalnız Functions tarafındadır. Seçili model `gemini-3.8-flash`; model adı resmî katalogdan doğrulandı. UI ve belge hazırlığı otomatik model çağırmaz. API anahtarı bu teslimatta girilmez; gerçek sağlayıcı kabulü anahtar eklendikten sonra yapılır.

## Anahtarı sonradan girme

Yerel, backend-only bağlantı testi:

```bash
cp functions/.secret.local.example functions/.secret.local
# GEMINI_API_KEY değerini yalnız bu Git dışı dosyada doldurun.
npm run gemini:check
```

Komut yalnız sabit `{"status":"ok","service":"incagen"}` yanıtı ister; belge, hesap verisi veya serbest prompt göndermez. Anahtar yoksa `not-configured`, `liveCallMade:false` ile çıkar (kod 2). Anahtar varsa tek gerçek Gemini çağrısı yapar; başarısızlığın ham sağlayıcı gövdesini/anahtarı yazdırmaz. Bu test gerçek model yanıtını doğrular; analiz kalitesini doğrulamaz.

Bulutta aynı anahtar Secret Manager'a konur:

```bash
npx firebase functions:secrets:set GEMINI_API_KEY --project incagen-eeef4
```

Secret Manager'da **yalnız bu secret üzerinde**, `checkGemini` çalışma zamanı servis hesabına `Secret Manager Secret Accessor` rolü verilmelidir. Mevcut çalışma zamanı hesabı `483199933468-compute@developer.gserviceaccount.com`; dağıtımda farklı hesap seçilirse Functions ayarındaki gerçek hesap esas alınır. Proje genelinde erişim veya yeni servis hesabı anahtar dosyası gerekmez. Sonraki istek `latest` sürümünü okur; anahtarın frontend/Netlify değişkenine eklenmesi veya web sitesinin yeniden derlenmesi gerekmez.

Cloud callable `checkGemini` için Firebase Auth kullanıcısının güvenilir yönetici tarafından atanmış `incagenDeveloper: true` custom claim'i ve son beş dakikada giriş yapmış olması gerekir. Bu claim istemciden atanamaz. Dağıtım hiçbir mevcut kullanıcıya kendiliğinden yetki vermez. Normal kullanıcıya teşhis düğmesi sunulmaz; API anahtarı istek gövdesiyle alınmaz. Yalnız temel `{}` veri gövdesi kabul edilir.

## Sınırlar ve hata davranışı

- Sabit kontrol prompt'u, 512 çıktı token'ı, 45 saniye model zaman aşımı ve bir istek; otomatik ücretli retry yok.
- UID başına 60 saniyede bir; proje genelinde UTC gününde en fazla 20 kontrol. Sayaçlar transaction ile tutulur; eksik anahtar sayaç tüketmez. Sağlayıcıya gönderilmiş başarısız deneme hak tüketir.
- Anahtarın yokluğu/okunamaması `failed-precondition`; sağlayıcı, zaman aşımı veya geçersiz JSON `unavailable` olur. Ham hata ve yanıt loglanmaz. `maxInstances: 1` ve `concurrency: 1` kullanılır.
- Runtime secret okuması 5 saniye ile sınırlıdır. Yerel emülatör bulut secret'ına düşmez. Bulutta düz ortam `GEMINI_API_KEY` okunmaz.

## İlk analiz adaptörü

`generateValidatedAnalysis(packet, generate)` mevcut analiz veri paketi ve `validateAiResult` kapısını kullanır. 256 KiB girdi, 64 KiB yanıt, 8.192 çıktı token'ı sınırı vardır. Belge içeriği talimat sayılmaz; metrik/veri kümesi yalnız sunucunun doğruladığı defterden gelebilir. Araç/kod yürütme açılmaz, kesilmiş veya filtrelenmiş model sonucu kabul edilmez.

Bu yardımcı henüz kullanıcı çalışma uçlarına veya rapor kayıtlarına bağlanmadı. Kuyruk/idempotency, maliyet ölçümü ve model kalitesi kabulü tamamlanmadan otomatik analiz açılmaz. Şema/kaynak doğrulaması, serbest metindeki bütün anlamsal iddiaların doğru olduğunu kanıtlamaz. Gerçek değerlendirme [referans protokolü](../fixtures/analysis-reference/evaluation.md) ile yapılmalıdır.

Birim testleri sentetik sağlayıcı yanıtlarını kullanır; emülatör testleri yetki, eksik anahtar ve eşzamanlı maliyet sınırını doğrular. Bunlar gerçek Gemini çağrısı yapıldığı anlamına gelmez.

Resmî kaynaklar: [SDK ve başlangıç](https://ai.google.dev/gemini-api/docs/get-started), [model kataloğu](https://ai.google.dev/gemini-api/docs/models), [yapılandırılmış çıktı](https://ai.google.dev/gemini-api/docs/structured-output), [Secret Manager erişimi](https://docs.cloud.google.com/secret-manager/docs/access-secret-version).
