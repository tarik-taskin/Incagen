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

- Sabit kontrol prompt'u, 512 çıktı token'ı, 45 saniye model zaman aşımı ve bir istek; otomatik ücretli retry yok.
- UID başına 60 saniyede bir; proje genelinde UTC gününde en fazla 20 kontrol. Sayaçlar transaction ile tutulur; eksik anahtar sayaç tüketmez. Sağlayıcıya gönderilmiş başarısız deneme hak tüketir.
- Anahtarın yokluğu/okunamaması `failed-precondition`; sağlayıcı, zaman aşımı veya geçersiz JSON `unavailable` olur. Ham hata ve yanıt loglanmaz. `maxInstances: 1` ve `concurrency: 1` kullanılır.
- Runtime secret okuması 5 saniye ile sınırlıdır. Yerel emülatör bulut secret'ına düşmez. Bulutta düz ortam `GEMINI_API_KEY` okunmaz.

## İlk analiz adaptörü

`generateValidatedAnalysis(packet, generate)` mevcut analiz veri paketi ve `validateAiResult` kapısını kullanır. 256 KiB girdi, 64 KiB yanıt, 8.192 çıktı token'ı sınırı vardır. Belge içeriği talimat sayılmaz; metrik/veri kümesi yalnız sunucunun doğruladığı defterden gelebilir. Araç/kod yürütme açılmaz, kesilmiş veya filtrelenmiş model sonucu kabul edilmez.

Bu yardımcı henüz kullanıcı çalışma uçlarına veya rapor kayıtlarına bağlanmadı. Kuyruk/idempotency, maliyet ölçümü ve model kalitesi kabulü tamamlanmadan otomatik analiz açılmaz. Şema/kaynak doğrulaması, serbest metindeki bütün anlamsal iddiaların doğru olduğunu kanıtlamaz. Gerçek değerlendirme [referans protokolü](../fixtures/analysis-reference/evaluation.md) ile yapılmalıdır.

Birim testleri sentetik sağlayıcı yanıtlarını kullanır; emülatör testleri yetki, eksik anahtar ve eşzamanlı maliyet sınırını doğrular. Bunlar gerçek Gemini çağrısı yapıldığı anlamına gelmez.

## Canlı bağlantı kabulü — 2 Kasım 2026

Canlı `checkGemini` üzerinden tek sabit sentetik çağrı 200 ve `{status: "ok", model: "gemini-3.8-flash"}` döndü; süre 10,3 saniyeydi. Oturumsuz çağrı 401, normal kullanıcı 403, geliştiricinin özel prompt isteği 400 ve hemen tekrarlanan çağrı 429 aldı. Dolayısıyla reddedilen bu kontroller modele ek istek göndermedi. Runtime'da bir instance, bir eşzamanlı istek ve 60 saniye Functions süresi doğrulandı.

Yalnız bu test için oluşturulan hesaba geçici geliştirici claim'i verildi; kabulden sonra claim kaldırıldı, oturumlar iptal edildi, Auth hesabı ve kişisel teşhis kaydı silindi. Gerçek kullanıcıya geliştirici yetkisi verilmedi. Proje günlük sayacı maliyet sınırını korumak için sıfırlanmadı. Bu kabul, kullanıcı belgelerinden üretilecek analizlerin doğruluğu veya uçtan uca analiz hattının hazır olduğu anlamına gelmez.

Resmî kaynaklar: [SDK ve başlangıç](https://ai.google.dev/gemini-api/docs/get-started), [model kataloğu](https://ai.google.dev/gemini-api/docs/models), [yapılandırılmış çıktı](https://ai.google.dev/gemini-api/docs/structured-output), [Secret Manager erişimi](https://docs.cloud.google.com/secret-manager/docs/access-secret-version).

## Kullanıcı tablosuyla kaynaklı analiz

5 Kasım geliştirmesi, `startAnalysis` üzerinden seçilen tek CSV/XLSX tablosunun doğrulanmış Python hesaplarını modelin kısa yorumuyla birleştirir. Metrik/grafik değerleri modelden alınmaz; anahtar mevcut sunucu secret okuyucusunda kalır. Bu iş akışının limitleri geliştiriciye özel `checkGemini` limitlerinden ayrıdır. Kod yerelde doğrulanıyor; yeni üretim worker/callable dağıtımı ve canlı kalite kabulü bekleniyor. Güncel kapsam ve onay planı [tablo analizi rehberindedir](TABULAR-ANALYSIS.md).
