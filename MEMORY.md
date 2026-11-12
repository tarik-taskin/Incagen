# Incagen Proje Hafızası

- 12 Kasım devamı: Kaynak araması yerel harf kuralları/Unicode karakter konumlarıyla çalışır; görünen Arapça satır numaraları aranabilir. Rapor/arşiv sıralaması seçili dili kullanır; arşiv hazırlık incelemesi, hata ve dışlanan dosya adlarını da arar. Veri/yetki/model kapıları değişmez.


- 12 Kasım: Kaynak incelemesi hash/konum ve rapor kimliğiyle ayrılır; Excel çalışma sayfaları/farklı sütun şemaları karışmaz. Test komutları kısa, koşuya özel geçici dizinde çalışır. Tek Gemini kontrolü zaman aşımı verdi; gerçek analiz kapalıdır. İlk CSV/XLSX beta ile sonraki kapsamın kabulü [beta planında](docs/BETA-ACCEPTANCE.md) ayrılmıştır.

- 11 Kasım: tekil raporun işlem/dialog durumu kullanıcı ve kayıtla ayrılır; geç yanıt başka ekranı yönlendirmez veya yeni taslağı temizlemez. Rapor başlığı ortak lease saatini kullanır. Tablo seçimi kaynak/sayfa kimliğine, form/sonuç ayrıca denemeye bağlıdır. Kaynak tutarlarında eksik/geçersiz değer sıfıra çevrilmez, fiziksel satır numaraları binlik gruplama kullanmaz; ölçülmemiş süre gösterilmez. [Davranış](FLOW.md#analiz-denemesi-ve-özgün-belge-indirme), [görevler](GOAL.md#2026-11-11--furkan--codex-rapor-yaşam-döngüsü-ve-gösterim-doğruluğu).

- 10 Kasım: tek Gemini teşhisi 7.458 ms'de `busy` verdi; geçici hesap/claim temizlendi, gerçek analiz kapalı kaldı. Git index'i/çalışma dosyalarında değer yazdırmadan credential kontrolü CI ve yayın kabulüne bağlandı. Uyumlu CLI/CSS/qs yamaları kilitlendi; kök tam audit 26→22 orta, üretim kökü 0/Functions 4 orta. Analiz lease/yeniden deneme saati hedefli dış durum aboneliğiyle izlenir; otomatik çağrı/polling yok. Arşiv tarih sınırları reaktif; destek servis sınırı iptal/geç yanıtları reddeder. Python defteri integer kuruşla bağımsız sınanır (45 test). Canlı sentetik testlerin kaynak kimlikleri artık koşuya özel, Git dışı özel günlüklerde korunur; temiz işareti üç servis metadata kabulüne bağlıdır. [Görev ve açık engeller](GOAL.md#2026-11-10--furkan--codex-analiz-kabulü-ve-teslim-korumaları).

- 9 Kasım bağımsız inceleme: eski Quality mailleri son başarılı koşudan ayrıldı; release testlerindeki gerçek public Firebase key literal'leri sentetik veriyle değiştirildi (backend Gemini sırrı sızıntısı doğrulanmadı, alert API erişimi 404). Vite build provenance ve bütün public dosya/yedi rota hash kabulü eklendi; geniş HTML normalizasyonu ve dirty bypass kaldırıldı. Yeni snapshot sonrası geçmiş lease saati ve hash beklerken indirme iptal testleri tamamlandı. [Kabul ve sınırlar](docs/DEVELOPMENT.md#yayın), [görevler](GOAL.md#2026-11-09--furkan--codex-bağımsız-teslim-incelemesi-ve-yayın-kabulü).

- 6 Kasım: Gemini bulut teşhisi kalıcı ve açık opt-in isteyen bir script oldu; anahtar indirilmez, geçici hesap/claim temizlenir. Son `LOW`/90 saniyelik deneme `busy` verdiği için gerçek analiz kapalı. Yoğunluk/zaman aşımında 30 saniyelik sunucu beklemesi, sessiz kabul hatası düzeltmesi ve belgeye özel indirme durumu eklendi. [Güncel görevler](GOAL.md#2026-11-06--furkan--codex-canlı-analiz-kabulü-ve-hata-dayanıklılığı).

- 5 Kasım: CSV/XLSX Python hesabı → Gemini yorumu → özel rapor/geçmiş hattı ve örnek rapor keşif rehberi eklendi. Onaylı özel Cloud Run/Functions dağıtımı ve yerel/izole testler geçti. Gerçek Gemini `503 / capacity` nedeniyle kalite kabulü tamamlanamadı; `INCAGEN_TABULAR_ANALYSIS_ENABLED` ve `VITE_TABULAR_ANALYSIS_ENABLED` canlıda kapalı, hazırlık akışı korunur. Devam noktası [GOAL](GOAL.md#2026-11-05--furkan--codex-ilk-gerçek-tablo-analizi) ve [yayın kapısı](docs/TABULAR-ANALYSIS.md#yayın-kapısı-ve-canlı-kabul).

Incagen işletme verilerinden grafikler, tablolar ve büyüme önerileri üretmeyi amaçlar.

## Kalıcı bağlam

- React, TypeScript, Vite, React Router, Tailwind, shadcn/ui yaklaşımı, Anime.js ve rapor rotasında Motion/ECharts.
- `npm run dev` ve canlı Netlify canlı Firebase projesini (`incagen-eeef4`) kullanır; tam sentetik Auth/Firestore/Storage/Functions akışı `npm run dev:emulator` ile çalışır. Gemini anahtarı doğrudan Secret Manager'dadır; sınırlı geliştirici kontrolüyle gerçek `gemini-3.8-flash` bağlantısı 2 Kasım'da doğrulandı. Dar CSV/XLSX hattı kodda bağlıdır; kullanıcıya açılış ve gerçek analiz kalitesi kabulü sağlayıcı kapasite hatası nedeniyle bekler; [backend rehberi](docs/GEMINI.md).
- Ana renkler `#4c2a85`, `#bcedf6`; yardımcı renkler `#320E3B`, `#ff0035`, `#DDFBD2`.
- Renk denemeleri kullanıcı talebiyle kaldırıldı; özgün mor palet ve Klasik/Glass korunur. Ana sayfada ortalanmış başlık ve üç adımlı yatay yerleşim kullanılır; ürün davranışı değişmez.
- Çalışma kuralları AGENTS.md, teknik kurallar RULES.md, davranış/limitler FLOW.md içindedir.
- Zorunlu analiz hedefi (1–500 karakter) taslakta korunur, hazırlık kaydında saklanır ve sonuçta gösterilir; başarılı hazırlık yeni iş için hedefi temizler.
- Kabul edilen sonraki AI mimarisi ve kalite kapısı [FLOW.md](FLOW.md#kabul-edilen-hedef-mimari--2026-10-10) içindedir; CSV/XLSX Python işçisi dağıtıldı, kullanıcıya açılış gerçek model kalite kabulüne bağlıdır; bağımsız sentetik rapor ECharts/Motion sunumunu gösterir.
- Özetleme başlangıç referansları [fixtures/analysis-reference](fixtures/analysis-reference/README.md) içindedir; sentetik satış/yorum kaynakları, elle yazılmış cevaplar ve kalite protokolü mevcut parser üzerinden doğrulanır. LLM değerlendirmesi henüz çalıştırılmadı.
- Belge seçimi gerçek bayt toplamını ve kalan kapasiteyi gösterir; hazırlık kontrolü ortak alan kurallarıyla çalışır ve eksik alana odak verir.
- Bağımsız AI sonuç v1 şeması ve güvenilir kaynak/metrik kapısı [docs/AI-RESULTS.md](docs/AI-RESULTS.md) içindedir; CSV/XLSX için kaynaklı Python/Gemini/kayıt bağlantısı kodda eklendi; onaylı backend dağıtıldı; sağlayıcı kapasitesi ve canlı kalite kabulü bekleniyor ([kapsam ve plan](docs/TABULAR-ANALYSIS.md)). Analiz veri paketi içerik/konum/uyarıları ve güvenilir hesap bağlamını ayrı tutar; 256 KiB aşımında sessiz kesmez.

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

- Python 3.12 extraction ortamı, hash kilitli PDF/Word/Excel/metin paketleri ve mevcut kaynak sözleşmesine geçen sentetik testler [python rehberindedir](python/README.md). Özel CSV/XLSX Cloud Run işçisi dağıtıldı; OCR ve otomatik kullanıcı analizi açılmadı.

## Tamamlanan özellikler

- Responsive giriş/çalışma alanı, tema, animasyonlu logo, Premium bilgilendirmesi.
- E-posta/parola kaydı, giriş, korumalı rotalar, bağlı e-postaya şifre yenileme isteği, çıkışta taslağın temizlenmesi ve yerel emülatörde yeniden doğrulamalı hesap silme.
- Oturum içi çoklu iş belgesi seçimi; yalnız gerçekten ayrıştırılan modern formatlardan oluşan ortak plan kapsamı.
- Yerel yükleme; MIME/imza ve güvenli arşiv doğrulaması; metin, tablo, PDF, modern Office ve görsel ayrıştırma.
- Kaynak hash'i ve sayfa/çalışma sayfası/slayt/satır konumlarını taşıyan normalize, sıkıştırılmış server-only artefaktlar.
- Kullanıcıya özel canlı geçmiş, rapor açma ve kaynaklarla silme.
- Free/Premium karşılaştırması; Free 2 analiz/gün, 5 dosya/analiz, 25 MB toplam; gelecekteki Premium 5 analiz/gün, 10 dosya/analiz, 50 MB toplam. Ayrı dosya başı MB sınırı yoktur. Google Analytics ve Microsoft Clarity bağlantıları Ayarlar'da pasif taslaktır.
- Backend kota/idempotency, kullanıcı izolasyonu ve otomatik test altyapısı.

Canlı Netlify ve geliştirme ortamı canlı Firebase backend'ine (`incagen-eeef4`) bağlıdır. 2 Kasım'da gerçek Netlify arayüzünden PDF/DOCX/XLSX hazırlama, geçmiş/yenileme, kaynak silme ve iki hesap izolasyonu geçti; kullanıcının açık onayıyla Auth-only sınırı kaldırıldı. Google'ın normal tarayıcı kabulü kullanıcı tarafından doğrulandı; hata ayıklama penceresindeki dönüş sınırı ayrı tutulur. Kullanıcı analizine AI yorumu henüz bağlanmadı. Kurulum [geliştirici rehberi](docs/DEVELOPMENT.md), kalan işler GOAL.md üzerinden takip edilir.
