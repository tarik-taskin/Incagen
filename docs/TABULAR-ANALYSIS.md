# İlk gerçek tablo analizi

**Durum (10 Kasım 2026):** Özel Python Cloud Run işçisi ve analiz Functions uçları kullanıcı onayıyla dağıtıldı. Linux container, IAM ve yerel hesap/rapor kontrolleri geçti. 5 Kasım gerçek Gemini denemeleri `503 / capacity` ile reddedildi; sonraki sınırlı kontroller `timeout`/`busy` aldı. 10 Kasım tek sabit sentetik kontrol de 7.458 ms'de `busy` döndü; tekrar yapılmadı ve geçici hesap/claim temizlendi. Gerçek modelin altı dilde kalite kabulü tamamlanmadı. Bu nedenle ücretli analiz hem backend hem arayüzde kapalıdır; canlı belge hazırlığı, geçmiş ve örnek raporlar çalışmaya devam eder. Kabul durumu [GOAL](../GOAL.md#2026-11-10--furkan--codex-analiz-kabulü-ve-teslim-korumaları) içinde tutulur.

## Kullanıcı akışı ve kapsam

1. Mevcut belge hazırlığı tamamlanır. CSV/XLSX içeren kayıtta analiz ayarları açılır; diğer biçimlerin hazırlık raporu değişmez.
2. Kullanıcı **tek kaynak/çalışma sayfası**, ölçüm sütunu, toplam/ortalama/kayıt sayımı, isteğe bağlı gruplama, sayı biçimi ve birimi seçer. Başlık veya hücre içeriğinden birim/ölçüm tahmin edilmez. Sayım ölçüm sütunu istemez.
3. Python seçilen tabloyu yeniden özgün baytlardan okur; dosya hash'i hazırlık kaydıyla eşleşir. Ondalık hesap defteri oluşturulur.
4. Gemini, analiz hedefi, rapor dili, seçilen ölçüm ve gruplama başlıkları, kayıt sayıları ve doğrulanmış özet metriklerle kısa yorum üretir. Gruplu özetler grup etiketini ve hesaplanan sonucu içerir. Ham kayıtlar, dosya adı, hash, analiz kimliği ve kaynak konumları sunucuda kalır. Metrikler, grafikler ve kaynaklar sunucunun defterinden oluşturulur. Model en fazla üç bulgu üretir. Özet, bulgu ve öneri bağlantıları sonuç sözleşmesinden geçmezse rapor kaydedilmez.
5. Sonuç yalnız kullanıcının kaydında saklanır. Kart → kaynak satırları → oturumlu özgün dosya indirme çalışır. Geçmiş/yenileme yeni model çağrısı başlatmaz. Arayüz dili değişince saklanan rapor çevrilmez; üretildiği dil belirtilir.

İlk sürüm çok belgeli çıkarım, OCR, serbest hesaplama kodu, tahmin veya PDF/Word kaynaklarından model analizi yapmaz. Bu dosyaların mevcut hazırlığı korunur. Çok belgeli örnek rapor, gerçek analizin bugünkü kapsamının taahhüdü değildir.

## Hesap doğruluğu

- Seçilen tabloda en fazla **5.000 kayıt, 12 grup**, metrik başına en fazla **256 kesin kaynak aralığı**. Daha parçalı veya büyük kapsam açık hatadır; satır sessizce kesilmez.
- `plain`: `1234.56`; `tr`: `1.234,56`; `en`: `1,234.56`. Yerel biçimlerde yanlış binlik gruplama reddedilir. Yerel Excel sayıları hücrenin sayısal değerinden okunur.
- Python `Decimal`; yalnız nihai sonuçta yarı-çift yuvarlama. Para girdileri en fazla iki ondalık, para sonucu iki; diğer sonuçlar altı ondalık. Bir hücre mutlak değeri en fazla 10¹², sonuç en fazla 9×10¹².
- Sıfır ve negatif değerler korunur. Boş/geçersiz seçili ölçüm, boş gruplama veya formül hücresi hesaplamayı durdurur. Makro, formül ve dış kaynak çalıştırılmaz. Tamamen boş satırlar sayımdan çıkarılır ve kapsamda ayrıca sayılır. Grup adları özgün haliyle korunur; başında/sonunda boşluk olan grup adları temizlenmesi için reddedilir. JSON sayı gösteriminde sonucun ondalık hassasiyeti kaybolacaksa sonuç reddedilir.
- Ortalama satır ağırlıklıdır; grup ortalamalarının ortalaması toplam ortalama yerine kullanılmaz. Tek seçili Excel sayfası dışındaki veriler toplama girmez.
- Modelin prose metninde Unicode sayısal karakterler reddedilir; tam sayılar ayrı metriklerde gösterilir. Bilinmeyen metrik, bozuk öneri bağlantısı, ek/uydurulmuş alan ve sahte kaynaklar reddedilir. Bu yapısal/sayısal kapı **serbest yorumun semantik doğruluğunu garanti etmez**; canlı insan kalite kabulü ayrıca gerekir.

## Güvenlik ve iş yaşam döngüsü

- `getAnalysisTables`, `startAnalysis`, `getAnalysisResult`: Auth UID ve sahibi olunan tamamlanmış hazırlık kaydı zorunlu. İstemci dosya yolu, çalışma kodu, API anahtarı veya serbest prompt gönderemez.
- Davetli `startAnalysis` ön kontrolü (`checkOnly`) yalnız seçilen hazırlanmış kaynağın bütünlüğünü, sayfayı ve sütun indekslerini denetler. Python, model, analiz işi ve kota rezervasyonu başlatmaz. Yeni analizde aynı kontrol rezervasyondan önce çalışır ve rezervasyon o hazırlık sürümüne bağlanır. Çalışan veya tamamlanmış aynı kapsam tekrar kullanılır. Seçili hücrelerin hesaplanabilirliği Python aşamasında doğrulanır.
- Atomik fingerprint: kaynak hash/kimlik + açık ayarlar + rapor dili. Aynı çalışan/tamamlanan istek tekrar kullanılır. Tamamlanmış kapsam değiştirilemez; farklı kapsam yeni çalışma gerektirir.
- Başlangıç açılım sınırı: İstanbul gününde kullanıcı başına iki farklı iş; Pasifik gününde proje başına **12 deneme**, iş başına **üç deneme**. Eski proje sayaçları geçişte örtüşen İstanbul günleriyle birlikte hesaplanır. Başarısız ve zaman aşan denemeler de sayılır. Önceden hesaplanmış bu dar kapsamda model `low` thinking ve en fazla 4.096 çıktı tokenıyla çağrılır; bu ayar canlı kalite kabulünde ayrıca ölçülür. [Resmî thinking seçenekleri](https://aistudio.google.com/docs/thinking?generate-content=true). Otomatik ücretli yeniden deneme yoktur. Sunucu, sağlayıcı hız sınırında iki dakikalık, kapasite veya zaman aşımında 30 saniyelik `retryAfter` saklar ve çağrı yanıtında döndürür. 429 ve 503 sonrasında proje genelinde de aynı kısa bekleme uygulanır. Bekleme dolmadan yeni iş/deneme/kota rezerve edilmez; süre dolması da kendiliğinden istek göndermez. Eski kayıtlarda bu alanın bulunmaması desteklenir. Bu sınırlar fatura tutarı garantisi değildir.
- Aşamalar hesaplama → yorumlama → kayıt; 180 saniye Functions sınırı, 90 saniye model sınırı ve 240 saniye iş kilidi. Yeni deneme/eski yanıt ve silme yarışları transaction ile korunur. Aktif iş varken kayıt/hesap silme reddedilir; geç gelen sonuç silinen/kapanan hesaba yazılmaz. Kaydedilip sahiplenilemeyen artefakt temizlenir.
- Sonuç ve kaynak anlık görüntüsü gzip/hash ile UID'ye ait `derived/…/ai/…` altında tutulur. Yazma ve okuma aynı 2 MiB gzip ve 4 MiB açılmış JSON sınırını kullanır. Model öncesi kaynak bütçesinde sonuç için ayrılan alan da hesaba katılır. Yalnız yetkili callable raporu döndürür. Özgün dosya indirme oturumlu Storage SDK kullanır.
- Gemini anahtarı yalnız mevcut backend Secret Manager akışındadır. Python runtime hesabına Storage/Firestore/Gemini/Secret Manager rolü verilmez. Ham belge, sağlayıcı yanıtı, token veya anahtar uygulama günlüklerine yazılmaz. `inputBytes` gönderilen kullanıcı JSON’unun UTF-8 bayt sayısıdır. Geçersiz model çıktısı doğrulama hatasıdır ve sağlayıcı yoğunluğundan ayrı izlenir.
- Demo proje + Functions emülatörü birlikte seçilirse gerçek yerel Python ve açıkça `emulator` etiketli sabit yorum taklidi kullanılır. Demo, üretim sağlayıcı anahtarını okumaz. Bu testler gerçek Gemini kalite kabulü olarak gösterilmez.

## Yayın kapısı ve canlı kabul

- Yeni ücretli iş, `INCAGEN_TABULAR_ANALYSIS_ENABLED=true` ve doğrulanmış Firebase ID token’ında `incagenTabularBeta: true` gerektirir. Sunucu ikisini de rezervasyon ve Python/model erişiminden önce denetler. Firebase ortam parametresi Git dışındadır. İzole demo projesi ve Functions emülatörü birlikteyken testler gerçek davet gerektirmez.
- `VITE_TABULAR_ANALYSIS_ENABLED=true` açıkça verilmedikçe canlı arayüz yeni analiz ayarlarını göstermez; hazırlık raporu korunur. Var olan AI kaydının okunması bu anahtardan bağımsızdır. Bu arayüz anahtarı güvenlik sınırı değildir; backend kapısı bağımsız uygulanır.
- Tablo kataloğu erişim kararını yalnız kendi kaydını okuyan hesaba döndürür. Davet verilince arayüzdeki **Erişimi kontrol et** düğmesi ID token’ını tazeler ve katalog durumunu yeniden okur. Hazırlanan belgeler ve saklanan sonuçlar erişilebilir kalır. Davet geri alındığında eski ID token geçerlilik süresinin sonuna kadar önceki claim’i taşıyabilir. Acil durdurma için sunucu kapısını kullanın.
- Model/şema doğrulaması gevşetilmez, sessiz model değişimi ve otomatik ücretli tekrar yapılmaz. Güvenli tanı yalnız HTTP durum kodu, sabit hata kategorisi veya bitiş nedenidir; ham hata, belge ve yanıt metni loglanmaz.
- `scripts/accept-tabular-cloud.mjs` açık opt-in ister. `--verify-closed` bir CSV ve bir XLSX hazırlığında ücretli iş rezervasyonu olmadan reddi doğrular. `--smoke` tek Türkçe CSV analiz isteği gönderir. Bayraksız tam kabul altı dilde üç CSV toplamı ve üç XLSX ortalaması çalıştırır. Sonuçların kapsamı, ölçümü, grafik değerleri, fiziksel kaynak satırları ve kullanım bilgisi bağımsız beklentiyle karşılaştırılır. İlk hata koşuyu durdurur. Sonuçlar, durum özeti ve kaynak temizliği koşuya özel [kabul kayıtlarında](TESTING.md#canlı-analiz-kabul-kayıtları) izlenir.
- Sentetik test penceresinde arka uç yalnız doğrulanmış davetlilere çalışabilir ve arayüz ana Netlify yayını dışında tutulur. Beta kullanıcılarına açmak için altı canlı yanıtın insan incelemesi, gerçek süre/token ölçümü ve [operasyon kararları](BETA-ACCEPTANCE.md#sınırlı-beta-operasyon-durumu-ve-ekip-karar-matrisi) tamamlanır. Acil kapatma yolu sunucu bayrağını `false` ile dağıtmak ve ana arayüz paketinde analiz bayrağını kapalı tutmaktır. Tek bir bağlantı testi veya emülatör taklidi kalite kabulü sayılmaz. Sentetik anlatımla geçen testler (`scripts/python-to-report.test.ts`), altı dildeki gerçek model kabulünü kapatmaz. Test hesapları, ham/türetilmiş dosyalar ve kişisel kayıtlar temizlenir; global maliyet sayaçları sıfırlanmaz.

### Gerçek rapor insan incelemesi tablosu

Gerçek model yanıtı alındığında her altı dil (`tr`, `en`, `de`, `es`, `zh`, `ar`) için inceleyen kişi, otomatik mekanik kabulden (`acceptance.json`) ayrı olarak `reportId` + `reportSha256` + `sourceSha256` değerlerine bağlı ayrı insan incelemesi kaydı doldurur. Gerçek canlı model sonucu alınmadıkça genel kalite durumu **`beklemede` (`pending`)** kalır.

| Ölçüt | İnceleme sorusu | Geçme koşulu |
| --- | --- | --- |
| 1. Kaynak satırı desteği | İddianın bağlandığı kaynak satırları (`rowStart`–`rowEnd`, `sheet`) iddiayı gerçekten destekliyor mu? | Seçili sayfa ve fiziksel satırlar metin iddiasıyla birebir tutarlı; ilgisiz veya dışarıda bırakılmış sayfa/satır dayanak gösterilmemiş. |
| 2. Gözlem ve yorum ayrımı | Doğrudan gözlenen sayı/dağılım ile analitik yorum açıkça ayrılıyor mu? | Gözlemler ölçülen metrikten ayrışmıyor; yorum ifadeleri kesin olgu gibi sunulmuyor. |
| 3. Eksik veri sınırı | Kapsam dışındaki veriler (maliyet, kâr, eksik dönem/satır sınırları) açıkça belirtilmiş mi? | Eksik veya tablo dışı boyutlar `limitations` ve ilgili metinde yer alıyor; sessiz sıfırlama veya tam kapsam iddiası yok. |
| 4. Kanıtsız neden/tahmin reddi | Veriden çıkmayan nedensellik, kesin gelecek tahmini veya dış olgu iddiası var mı? | Kanıtsız “artış şundan kaynaklandı” veya gelecek garantisi ifadeleri bulunmuyor. |
| 5. Öneri dayanağı | Sunulan öneriler (`recommendations`) doğrulanmış bulgu (`basisFindingIds`) ve kaynaklara dayanıyor mu? | Kaynaksız, genel geçer veya ilgisiz eylem önerisi yok. |
| 6. Dil ve anlatım kalitesi | İlgili dilde (`tr`/`en`/`de`/`es`/`zh`/`ar`) terim, akıcılık ve sayı dışılığı kuralları korunuyor mu? | Doğal, anlaşılır anlatım; düz metne gömülü uydurma/ek rakam yok; tek bir dildeki yetersizlik tüm dilleri geçirmiş sayılmaz. |

## Somut dağıtım kapsamı

Aşağıdaki kapsam 5 Kasım açık kullanıcı onayıyla dağıtıldı. Ağ/oturum kullanmadan sabit hedefleri görüntülemek için:

```bash
node scripts/deploy-python-worker.cjs --plan
```

Dağıtım scripti: `incagen-eeef4` / `europe-west1` içinde IAM ile özel `incagen-extract` Cloud Run servisi; ayrı `incagen-extract-runtime` hesabı; tek instance, tek eşzamanlı istek, 1 CPU/1 GiB, sıfıra ölçeklenme. HTTP gövdesi en fazla 25 MiB özgün dosyadır; metadata yalnız ad/kimlik/ayarları taşır. Çocuk parser CPU/bellek/süre sınırlarıyla çalışır; öldürülen parserın geçici dosyasını üst süreç de temizler.

Build için özel `incagen-analysis-build-483199933468` bucket'ı (uniform erişim, public access prevention, bir günlük nesne temizliği) ve `incagen-analysis` image deposu oluşturulur. Mevcut backend/build hesabına yalnız bu kaynaklarda gerekli image writer/source reader ve **işçi servisi üzerinde** invoker rolleri eklenir. Mevcut backend hesabının proje üzerindeki önceden var olan Editor rolü bu dağıtımda değiştirilmedi; yalnız yeni Python runtime hesabının proje/secret rolü bulunmadığı doğrulandı. Container'a yalnız Python kaynakları ve hash kilitli runtime bağımlılıkları girer; Git, ortam dosyaları, test verileri ve venv gönderilmez. Cloud Run image digest ile sabitlenir. İşçi adresi Git dışı Functions ortam dosyasına yazılır. Firebase yükleme listesinden `.env*` ve `.secret.local` açıkça çıkarılır; CLI ortam parametrelerini kaynak arşivinden ayrı uygular. Dağıtım sırasında yeni kaynakların ve IAM politikasının tekrar okunarak doğrulanması gerekir; script çıktısı tek başına kabul değildir.

Yeni callable'lar worker hazır olmadan canlı frontend'e açılmamalıdır. Sonrasında gerçek sentetik CSV/XLSX → Python → Gemini → saklama/yeniden açma/silme kabulü, hesap/kaynak eşliği, süre/token ölçümü ve sınırlı insan kalite değerlendirmesi yapılır. Anahtar yerel kabul scriptine indirilmez. Başarılı canlı kabulden sonra main/furkan, GitHub Quality ve Netlify dosya/commit eşliği doğrulanır. Fatura oluşabilecek işlemler onay kapsamına dahildir.

İlgili kaynaklar: [Python](../python/README.md), [Gemini](GEMINI.md), [AI sonuç sözleşmesi](AI-RESULTS.md), [Functions uygulaması](../functions/src/analysis/tabular-jobs.ts), [Python hesapları](../python/src/incagen_extract/analyze.py).
