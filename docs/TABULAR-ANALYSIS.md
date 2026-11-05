# İlk gerçek tablo analizi

**Durum (5 Kasım 2026):** Özel Python Cloud Run işçisi ve analiz Functions uçları kullanıcı onayıyla dağıtıldı. Linux container, IAM ve yerel hesap/rapor kontrolleri geçti. Gerçek Gemini denemeleri `503 / capacity` ile reddedildi; en küçük bağlantı kontrolü de yanıt vermedi. Gerçek modelin altı dilde kalite kabulü tamamlanmadı. Bu nedenle ücretli analiz hem backend hem arayüzde kapalıdır; canlı belge hazırlığı, geçmiş ve örnek raporlar çalışmaya devam eder. Kabul durumu [GOAL](../GOAL.md#2026-11-05--furkan--codex-ilk-gerçek-tablo-analizi) içinde tutulur.

## Kullanıcı akışı ve kapsam

1. Mevcut belge hazırlığı tamamlanır. CSV/XLSX içeren kayıtta analiz ayarları açılır; diğer biçimlerin hazırlık raporu değişmez.
2. Kullanıcı **tek kaynak/çalışma sayfası**, ölçüm sütunu, toplam/ortalama/kayıt sayımı, isteğe bağlı gruplama, sayı biçimi ve birimi seçer. Başlık veya hücre içeriğinden birim/ölçüm tahmin edilmez. Sayım ölçüm sütunu istemez.
3. Python seçilen tabloyu yeniden özgün baytlardan okur; dosya hash'i hazırlık kaydıyla eşleşir. Ondalık hesap defteri oluşturulur.
4. Gemini, analiz hedefi, seçilmiş tablo ve doğrulanmış hesaplarla kısa yorum üretir. Sayısal metrik/grafik/kanıt alanları model çıktısından alınmaz; sunucunun defterinden oluşturulur. Özet, bulgu ve öneri bağlantıları sonuç sözleşmesinden geçmezse rapor kaydedilmez.
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
- Atomik fingerprint: kaynak hash/kimlik + açık ayarlar + rapor dili. Aynı çalışan/tamamlanan istek tekrar kullanılır. Tamamlanmış kapsam değiştirilemez; farklı kapsam yeni çalışma gerektirir.
- Başlangıç açılım sınırı: İstanbul gününde kullanıcı başına iki farklı iş; proje başına **100 deneme/gün**, iş başına **üç deneme**. Başarısız ve zaman aşan denemeler de sayılır. Önceden hesaplanmış bu dar kapsamda model `low` thinking ve en fazla 4.096 çıktı tokenıyla çağrılır; bu ayar canlı kalite kabulünde ayrıca ölçülür. [Resmî thinking seçenekleri](https://aistudio.google.com/docs/thinking?generate-content=true). Otomatik ücretli yeniden deneme yoktur. Bu sınırlar fatura tutarı garantisi değildir.
- Aşamalar hesaplama → yorumlama → kayıt; 180 saniye Functions sınırı, 90 saniye model sınırı ve 240 saniye iş kilidi. Yeni deneme/eski yanıt ve silme yarışları transaction ile korunur. Aktif iş varken kayıt/hesap silme reddedilir; geç gelen sonuç silinen/kapanan hesaba yazılmaz. Kaydedilip sahiplenilemeyen artefakt temizlenir.
- Sonuç/sınırlı kaynak görünümü gzip/hash ile UID'ye ait `derived/…/ai/…` altında, istemciye kapalı tutulur. Yalnız yetkili callable döndürür. Özgün dosya indirme oturumlu Storage SDK kullanır; paylaşılabilir kalıcı download token'ı oluşturmaz.
- Gemini anahtarı yalnız mevcut backend Secret Manager akışındadır. Python runtime hesabına Storage/Firestore/Gemini/Secret Manager rolü verilmez. Ham belge, sağlayıcı yanıtı, token veya anahtar uygulama günlüklerine yazılmaz.
- Demo proje + Functions emülatörü birlikte seçilirse gerçek yerel Python ve açıkça `emulator` etiketli sabit yorum taklidi kullanılır. Demo, üretim sağlayıcı anahtarını okumaz. Bu testler gerçek Gemini kalite kabulü olarak gösterilmez.

## Yayın kapısı ve canlı kabul

- `INCAGEN_TABULAR_ANALYSIS_ENABLED=true` açıkça verilmedikçe sunucu yeni analiz işi rezerve etmez, Python/model çağırmaz. Firebase ortam parametresi Git dışındadır. Yalnız `demo-*` projesi ve Functions emülatörü birlikte bu kapıyı test için aşar.
- `VITE_TABULAR_ANALYSIS_ENABLED=true` açıkça verilmedikçe canlı arayüz yeni analiz ayarlarını göstermez; hazırlık raporu korunur. Var olan AI kaydının okunması bu anahtardan bağımsızdır. Bu arayüz anahtarı güvenlik sınırı değildir; backend kapısı bağımsız uygulanır.
- Model/şema doğrulaması gevşetilmez, sessiz model değişimi ve otomatik ücretli tekrar yapılmaz. Güvenli tanı yalnız HTTP durum kodu, sabit hata kategorisi veya bitiş nedenidir; ham hata, belge ve yanıt metni loglanmaz.
- `scripts/accept-tabular-cloud.mjs` açık opt-in ile altı dilde üç CSV toplamı ve üç XLSX ortalaması çalıştırır; model yanıtı, kesin hesap/kaynak, tekrar çağrı, gerçek rapor/indirme ve temizliği doğrular. İlk model hatasında durur. `--verify-closed` yalnız bir sentetik hazırlık oluşturur; kapının işi rezerve etmeden reddini ve hazırlık arayüzünü doğrular, modele çağrı yapmaz.
- Altı canlı yanıtın insan tarafından kaynak/amaç eşliğinde değerlendirilmesi ve gerçek süre/token ölçümü tamamlanmadan iki yayın anahtarı açılmaz. Tek bir bağlantı testi veya emülatör taklidi kalite kabulü sayılmaz. Test hesapları, ham/türetilmiş dosyalar ve kişisel kayıtlar temizlenir; global maliyet sayaçları sıfırlanmaz.

## Somut dağıtım kapsamı

Aşağıdaki kapsam 5 Kasım açık kullanıcı onayıyla dağıtıldı. Ağ/oturum kullanmadan sabit hedefleri görüntülemek için:

```bash
node scripts/deploy-python-worker.cjs --plan
```

Dağıtım scripti: `incagen-eeef4` / `europe-west1` içinde IAM ile özel `incagen-extract` Cloud Run servisi; ayrı `incagen-extract-runtime` hesabı; tek instance, tek eşzamanlı istek, 1 CPU/1 GiB, sıfıra ölçeklenme. HTTP gövdesi en fazla 25 MiB özgün dosyadır; metadata yalnız ad/kimlik/ayarları taşır. Çocuk parser CPU/bellek/süre sınırlarıyla çalışır; öldürülen parserın geçici dosyasını üst süreç de temizler.

Build için özel `incagen-analysis-build-483199933468` bucket'ı (uniform erişim, public access prevention, bir günlük nesne temizliği) ve `incagen-analysis` image deposu oluşturulur. Mevcut backend/build hesabına yalnız bu kaynaklarda gerekli image writer/source reader ve **işçi servisi üzerinde** invoker rolleri eklenir. Mevcut backend hesabının proje üzerindeki önceden var olan Editor rolü bu dağıtımda değiştirilmedi; yalnız yeni Python runtime hesabının proje/secret rolü bulunmadığı doğrulandı. Container'a yalnız Python kaynakları ve hash kilitli runtime bağımlılıkları girer; Git, ortam dosyaları, test verileri ve venv gönderilmez. Cloud Run image digest ile sabitlenir. İşçi adresi Git dışı Functions ortam dosyasına yazılır. Firebase yükleme listesinden `.env*` ve `.secret.local` açıkça çıkarılır; CLI ortam parametrelerini kaynak arşivinden ayrı uygular. Dağıtım sırasında yeni kaynakların ve IAM politikasının tekrar okunarak doğrulanması gerekir; script çıktısı tek başına kabul değildir.

Yeni callable'lar worker hazır olmadan canlı frontend'e açılmamalıdır. Sonrasında gerçek sentetik CSV/XLSX → Python → Gemini → saklama/yeniden açma/silme kabulü, hesap/kaynak eşliği, süre/token ölçümü ve sınırlı insan kalite değerlendirmesi yapılır. Anahtar yerel kabul scriptine indirilmez. Başarılı canlı kabulden sonra main/furkan, GitHub Quality ve Netlify dosya/commit eşliği doğrulanır. Fatura oluşabilecek işlemler onay kapsamına dahildir.

İlgili kaynaklar: [Python](../python/README.md), [Gemini](GEMINI.md), [AI sonuç sözleşmesi](AI-RESULTS.md), [Functions uygulaması](../functions/src/analysis/tabular-jobs.ts), [Python hesapları](../python/src/incagen_extract/analyze.py).
