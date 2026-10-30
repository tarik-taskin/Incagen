# Incagen Proje Hafızası

Incagen işletme verilerinden grafikler, tablolar ve büyüme önerileri üretmeyi amaçlar.

## Kalıcı bağlam

- React, TypeScript, Vite, React Router, Tailwind, shadcn/ui yaklaşımı, Anime.js ve rapor rotasında Motion/ECharts.
- `npm run dev` ve canlı Netlify canlı Firebase projesini (`incagen-eeef4`) kullanır; tam sentetik Auth/Firestore/Storage/Functions akışı `npm run dev:emulator` ile çalışır. Gemini entegrasyonu gelecekteki iştir.
- Marka paleti derin mavi `#09318D`, beyaz ve pembe `#FD91CC`; açık/koyu, grafik, logo ve Liquid Glass tokenları `src/index.css` içinde merkezidir. Pembe ölçülü vurgu için kullanılır; hata/başarı durumları anlamsal renklerini korur.
- Çalışma kuralları AGENTS.md, teknik kurallar RULES.md, davranış/limitler FLOW.md içindedir.
- Zorunlu analiz hedefi (1–500 karakter) taslakta korunur, hazırlık kaydında saklanır ve sonuçta gösterilir; başarılı hazırlık yeni iş için hedefi temizler.
- Kabul edilen sonraki AI mimarisi ve kalite kapısı [FLOW.md](FLOW.md#kabul-edilen-hedef-mimari--2026-10-10) içindedir; Python işçisi ve kaynaklı LLM sonuçları geliştirme hedefidir; bağımsız sentetik rapor ECharts/Motion sunumunu gösterir.
- Özetleme başlangıç referansları [fixtures/analysis-reference](fixtures/analysis-reference/README.md) içindedir; sentetik satış/yorum kaynakları, elle yazılmış cevaplar ve kalite protokolü mevcut parser üzerinden doğrulanır. LLM değerlendirmesi henüz çalıştırılmadı.
- Belge seçimi gerçek bayt toplamını ve kalan kapasiteyi gösterir; hazırlık kontrolü ortak alan kurallarıyla çalışır ve eksik alana odak verir.
- Bağımsız AI sonuç v1 şeması ve güvenilir kaynak/metrik kapısı [docs/AI-RESULTS.md](docs/AI-RESULTS.md) içindedir; model çağrısı veya gerçek kayıt bağlantısı yapılmadı. Analiz veri paketi içerik/konum/uyarıları ve güvenilir hesap bağlamını ayrı tutar; 256 KiB aşımında sessiz kesmez.

- `/ornek-rapor`: 12 aylık 3.612 tablo kaydı, Atlas Teknoloji için CSV/XLSX, PDF/Word/PowerPoint, JSON/Markdown/metin kaynaklarından oluşan dokuz belgeli şirket dosyası; altı grafik/üç finansal tablo ve aramalı/sayfalı kaynak paneli içeren örnek rapor; AI üretimi değildir ve hesaba yazılmaz. Üretim/doğrulama ve korunan sürümler [kaynak rehberindedir](fixtures/company-example/README.md).

- Altı dil için merkezi JSON katalogları, kalıcı seçim ve Arapça RTL: [dil ve rapor rehberi](docs/LOCALIZATION.md). Kimlik/taslak ve özgün kaynak metinleri dil değişiminden etkilenmez.
- Ortak sonuç bölümleri finansal olmayan ve metin ağırlıklı raporları da sunar; finansal ve kaynak ayrıntıları erişilebilir açılır bölümlerde korunur. Müşteri deneyimi v2 örneği 26 olumlu, 5 olumsuz ve 1 karma olmak üzere 32 analiz sonrası geri bildirimini ad/analiz türü, insan etiketleri ve kaynaklı sayımlarla gösterir. Eski sekiz yorumluk değerlendirme ve 32 yorumluk v1 sunumu korunur; ayrıntılar [dil rehberindedir](docs/LOCALIZATION.md#müşteri-deneyimi-örneği).
- Destek, altı dilde kısa yanıtlar ve Web3Forms üzerinden kişisel iletişim sunar; analiz sonrası izinli yayınlanacak geri bildirimlerden ayrıdır. Kurulum ve gelecek veri akışı [destek rehberindedir](docs/SUPPORT.md). Gerçek form ayarları git dışındadır; Gmail parolası kullanılmaz.

- Rota/oturum/veri yüklemeleri ortak, erişilebilir iskeletle sunulur; ileri tarih/durum/sıralama filtreleri açılır alanda, hedef araması görünür aramada kalır.
- Korumalı ekranlar/veri SDK'ları ve genel yardım ihtiyaç halinde yüklenir; başlangıç JS grafiği üretim derlemesinde 400 KiB gzip bütçesi ve modül sınırıyla korunur. Oturum ve taslak yaşam döngüsü değişmez; ölçüm [test rehberindedir](docs/TESTING.md#ilk-açılış-bütçesi).
- Hedef örnekleri seçili dilde eklenir, sayfa/dil gezinmesinde tek adımda geri alınabilir; elle hedef düzenlemek eski geri almayı kaldırır. Kurumsal raporun dönem/bölüm adresleri doğrudan açılır ve tarayıcı geçmişini izler; ayrıntılar [FLOW](FLOW.md#dil-ve-rapor-deneyimi) içindedir.
- Örnek raporlar ortak genişlik/başlık kullanır; landing doğrudan etkileşimli örneğe bağlanır. Yeni analiz tüm girişlerde baştan açılır, rapor bölüm adresleri korunur. Glass yüzeyleri görünür renk derinliğiyle ayrışır; destek beş konu/beş soru sunar. Ayrıntılar [FLOW](FLOW.md#dil-ve-rapor-deneyimi) içindedir.
- Hazırlama oluşturma/aktarım/işleme aşamalarını ayırır; yüzde yalnız gerçek aktarıma aittir. Native ayrılma uyarısı yerel dosya/iş riskinde bağlıdır; çevrimdışı notu otomatik işlem başlatmaz. Sonuçta kapsam/uyarılar görünür, teknik değerler açılır ayrıntıdadır. Davranış ve tarayıcı sınırları [FLOW](FLOW.md#hazırlama-sırasında-kullanıcı-kontrolü) içindedir.
- Kısmi hazırlıkta belge hataları açık kapsam onayı ister; onay token’ı sunucuda doğrulanır, beklerken kota iade edilir ve geçerli alt küme tek hak tüketir. Türetilmiş dosyalar deneme bazında ayrılır.

## Tamamlanan özellikler

- Responsive giriş/çalışma alanı, tema, animasyonlu logo, Premium bilgilendirmesi.
- E-posta/parola kaydı, giriş, korumalı rotalar, bağlı e-postaya şifre yenileme isteği, çıkışta taslağın temizlenmesi ve yerel emülatörde yeniden doğrulamalı hesap silme.
- Oturum içi çoklu iş belgesi seçimi; yalnız gerçekten ayrıştırılan modern formatlardan oluşan ortak plan kapsamı.
- Yerel yükleme; MIME/imza ve güvenli arşiv doğrulaması; metin, tablo, PDF, modern Office ve görsel ayrıştırma.
- Kaynak hash'i ve sayfa/çalışma sayfası/slayt/satır konumlarını taşıyan normalize, sıkıştırılmış server-only artefaktlar.
- Kullanıcıya özel canlı geçmiş, rapor açma ve kaynaklarla silme.
- Free/Premium karşılaştırması; Free 2 analiz/gün, 5 dosya/analiz, 25 MB toplam; gelecekteki Premium 5 analiz/gün, 10 dosya/analiz, 50 MB toplam. Ayrı dosya başı MB sınırı yoktur. Google Analytics ve Microsoft Clarity bağlantıları Ayarlar'da pasif taslaktır.
- Backend kota/idempotency, kullanıcı izolasyonu ve otomatik test altyapısı.

Canlı Netlify ve geliştirme ortamı canlı Firebase backend'ine (`incagen-eeef4`) bağlıdır; sentetik PDF, DOCX ve XLSX ile doğrudan backend çağrıları (çalışma oluşturma, yükleme, hazırlama, geçmiş ve silme) doğrulanmıştır. Arayüzden canlı kullanıcı kabulü tamamlanana kadar Netlify yayını güvenli Auth-only önizleme modunda tutulmaktadır. AI analizi henüz eklenmedi. Kurulum [geliştirici rehberi](docs/DEVELOPMENT.md), kalan işler GOAL.md üzerinden takip edilir.
