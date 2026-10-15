# Incagen — Yaşayan Yol Haritası

Ürün ve sistem davranışı [FLOW.md](FLOW.md) içindedir. Bu belge görevleri, sahipleri, kalite kapılarını ve açık kararları takip eder.

Durumlar: [ ] başlanmadı, [~] devam ediyor, [x] doğrulandı, [!] engelli.
İşe başlamadan sahibi Tarık veya Furkan olarak atanır.

## Aktif milestone: M0 — Temel düzen ve kalite altyapısı

### 2026-10-15 — Furkan / Codex: kapsamlı yönetim raporu deneyimi

- [x] Sahip: Furkan — Örnek raporu 12 aylık çok boyutlu şirket veri seti, bütçe ve operasyon kaynaklarıyla genişlet; metrik/grafik/tablo hesaplarını ve kaynak kapsamlarını doğrula.
- [x] Sahip: Furkan — Raporu çoklu grafik, finansal tablolar, filtreler ve Motion geçişleriyle yeniden tasarla; büyük kaynaklarda arama, sayfalama ve kanıt odağı sun.

Kabul: Eski v1 referans verileri korunmalı; yeni şirket ve belgeler örnek olarak tanımlanmalı, gerçek işletme iddiası yapılmamalı. Kullanıcının istemediği tekrarlı uyarı metinleri kaldırılmalı. Her grafik/tablo gerçek örnek kaynaklardan hesaplanmalı; dönem filtreleri tüm ilgili çıktıları birlikte güncellemeli. Kaynaklarda arama/sayfalama doğru satır kimliğini korumalı; grafik, tablo ve kanıt eşleşmeli. Mobil, iki tema, klavye ve azaltılmış hareket doğrulanmalı; AI/Python/servis veya Firebase yapılandırması eklenmemeli. Lint, birim, build/Functions, entegrasyon ve tarayıcı kontrolleri geçmeli; local/remote main/furkan eşit ve Netlify güncel olmalı.

Doğrulama: 46 uygulama + 84 Functions birim testi, lint, frontend/Functions derlemeleri, 3 entegrasyon ve 18/18 masaüstü/mobil senaryo geçti; son metin/para biçimi rötuşundan sonra ilgili 4 tarayıcı senaryosu yeniden geçti. Dört dönem için bağımsız dondurulmuş toplamlar, bütçe/marj/katkı ve ağırlıklı teslimat eşleşti. Tam yıl net satışı 22.591.022,62 TL; 948 kaynak kaydı korunur. Parça sınırını aşan 501. satır araması, belge seçimi, 25 satırlı sayfalama, URL/geri-ileri, ZIP indirme, iki tema, normal/azaltılmış hareket ve erişilebilirlik doğrulandı. Mobil geniş tablo taşması ve native dialog koordinatları düzeltildi; altı grafiğin tamamı görsel olarak incelendi. Halka türü sonuç sözleşmesine eksik/negatif/sıfır/tek parçayı reddeden kapıyla eklendi; JSON Schema eşitliği korundu. ZIP üretimi UTC ve yerel saat diliminde birebir doğrulandı; 51 belge bağlantısı geçerli. Eski referanslar, gerçek backend uçları ve Firebase yapılandırması değişmedi; AI/Python/model çağrısı eklenmedi.

### 2026-10-15 — Furkan / Codex: kaynaklı veri paketi ve etkileşimli örnek rapor

- [x] Sahip: Furkan — Gerçek ayrıştırıcı çıktısından analiz hedefi, kaynak/hash/konum ve içerik paketini üret; güvenilir doğrulama bağlamını model girdisinden ayır ve iki referansla uçtan uca doğrula.
- [x] Sahip: Furkan — Motion ve ECharts ile açıkça sentetik “Örnek rapor” deneyimi sun; doğrulanmış metrikler, grafikler, bulgular ve kaynak satırları aynı veri üzerinden çalışsın.
- [x] Sahip: Furkan — Firebase faturalandırma, Storage, Firestore ve Functions hazırlığını yalnız okuma ile yeniden kontrol et.

Kabul: Kaynak paketinde kesilme/satır atlama sessiz yapılmamalı; yanlış kimlik/hash/konum ve bütçe aşımı reddedilmeli; cevap anahtarları model girdisine alınmamalı. Örnek rapor gerçek kullanıcı analizi veya AI üretimi gibi gösterilmemeli; sunumu kaynak ve metrik doğrulamasından geçmeli. Motion/ECharts yalnız rapor rotasında yüklenmeli, tema ve azaltılmış hareket tercihi korunmalı. Klavye/odak, mobil taşma, kaynak kapsamı ve grafik/veri tablosu eşitliği doğrulanmalı. AI/Python kurulumu, model çağrısı, yeni servis veya Firebase yapılandırma değişikliği yapılmamalı. Lint, birim, Functions/build, entegrasyon ve yerel tarayıcı kontrolleri geçmeli.

Doğrulama: 46 uygulama + 71 Functions birim testi, lint, frontend/Functions derlemeleri, 3 entegrasyon ve son sabit kod turunda 18/18 masaüstü/mobil tarayıcı senaryosu geçti. Doğrudan grafik tıklaması eklendikten sonra ilgili 4 rapor senaryosu ayrıca geçti. Net 2.550 TL, dönemler 1.000/1.550 TL, %55 değişim ve indirim/iade/iptal kapsamları ham CSV hesabı ile bağımsız cevap anahtarı arasında eşleşti; statik artefakt birebir yeniden üretildi. İki tema görselleri, klavye/odak, Escape, normal/azaltılmış hareket ve mobil taşma incelendi. 68 yerel belge bağlantısı doğrulandı. Motion ve grafik kodu ana sayfanın başlangıç ön yüklemelerine dahil değil. Model/Python çağrısı, gerçek hesap kaydı ve Firebase değişikliği yapılmadı.

Firebase kontrolü (2026-10-15 14:18 TRT, yalnız GET): `incagen-eeef4` için `billingEnabled=false`, bir billing hesabı bağlı; Firestore'da bir veritabanı var. Storage bucket sayısı 0; Functions API `403 SERVICE_DISABLED` döndü. Canlı belge backend'i için mevcut engel sürüyor; yapılandırmaya dokunulmadı.

### 2026-10-13 — Furkan / Codex: hazırlık deneyimi ve AI sonuç sözleşmesi

- [x] Sahip: Furkan — Belge seçimini adet/boyut/kalan kapasite özetiyle güçlendir; başlık, çalışma alanı ve hedef eksiklerinde erişilebilir yönlendirme sun.
- [x] Sahip: Furkan — AI sonuç v1 şemasını ve güvenilir kaynak/metrik bağlamıyla çalışan doğrulayıcısını kodla; olumlu ve olumsuz sonuçlarla test et.
- [x] Sahip: Furkan — README ve geliştirici rehberindeki Firebase ortam karşılaştırma tablosunu kaldır; kurulum ve kalite bilgilerini ürün odaklı belge düzeninde koru.
- [x] Sahip: Furkan — Firebase faturalandırma ve mevcut backend servislerini yalnız okuma ile kontrol et; erişim ve hazırlık durumunu ayır.

Kabul: Dosya limitleri ortak sözleşmeden gelmeli; özet seçimle güncellenmeli; eksik alan odağı, hata/başarı taslağı ve backend doğrulaması korunmalı. AI sözleşmesi model çağırmamalı; bilinmeyen kaynak, yanlış hash/konum, bozuk şema ve metrik/grafik çelişkisini reddetmeli. Gerçek LLM metninin semantik doğruluğu otomatik kanıtlanmış sayılmamalı. Yeni servis, AI/Python kurulumu veya Firebase yapılandırma değişikliği yapılmamalı. Belge bağlantıları, lint, birim, Functions/build, entegrasyon ve yerel tarayıcı kontrolleri geçmeli; iki tema, mobil ve klavye davranışı incelenmeli.

AI doğrulaması: 36 sonuç sözleşmesi testiyle iki baz vaka, şema dosyası eşitliği, bilinmeyen/yinelenen kimlik, kaynak hash/parça/konum, yanlış metrik/değer/birim/yöntem, eksik değer, kopuk öneri/grafik ve hatalı güvenilir bağlam reddi doğrulandı. Bağımsız modül mevcut hazırlık uçlarına veya kayıt şemasına bağlanmadı; gerçek LLM değerlendirmesi yapılmadı.

Firebase kontrolü (2026-10-13, yalnız GET): `incagen-eeef4` için `billingEnabled=false`; bir billing hesabı bağlı. Firestore'da bir Native veritabanı var; Storage bucket listesi boş, Functions API `SERVICE_DISABLED` döndü. Bu kontrol faturalandırma/servis/erişim durumunu değiştirmedi; bulut belge hazırlama engeli sürüyor.

Genel doğrulama: lint, 46 uygulama ve 51 Functions testi, frontend/Functions derlemeleri, 3 entegrasyon ve 14/14 masaüstü/mobil tarayıcı senaryosu geçti. Kapasite, ekleme/kaldırma/temizleme, 25 MB sınırı, eksik alan odağı, boşluklu alan reddi ve taslak yaşam döngüsü doğrulandı. Son görsel düzeltmeden sonra ilgili iki tarayıcı senaryosu ve minimum kontroller yeniden geçti. İki tema görüntüleri incelendi; erişilebilirlik, klavye, azaltılmış hareket ve taşma kontrolleri geçti. 50 belge/bölüm bağlantısı ve 20 komut kullanımı doğrulandı. Firebase ortam tablosu kaldırıldı; izole test komutları [test rehberinde](docs/TESTING.md) korunur. AI/Python kurulumu ve yeni servis eklenmedi.

Kapasite sınırı rötuşu: 25 MB tamamen dolduğunda eklenebilir belge mesajı yerine boyut sınırı gösterilir; reddedilen dosya toplamı değiştirmez. Sınır regresyonu, lint, 97 birim testi ve canlı Auth derlemesi yeniden doğrulandı.

### 2026-10-10 — Furkan / Codex: ürün odaklı GitHub README

- [x] Sahip: Furkan — README'yi ürün amacı, çalışma akışı ve kaynak haritasına odakla; ortam karşılaştırması ve ayrıntılı kurulum bilgilerini ayrı geliştirici rehberine taşı.

Kabul: README emülatör/ortam ayrıntılarıyla açılmamalı; uygulanmamış AI özellikleri tamamlanmış gibi gösterilmemeli. Teknik kurulum bilgileri kaybolmamalı, bağlantılar ve komutlar geçerli olmalı. Uygulama ve referans verileri değişmemeli; lint, birim testleri ve derleme geçmeli.

Doğrulama: README'de ortam karşılaştırması, emülatör komutları ve port ayrıntıları yoktur; mevcut teknik rehber [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) içine doğru göreli bağlantılarla taşındı. 41 yerel belge/bölüm bağlantısı, 18 komut kullanımı ve Markdown kod blokları doğrulandı. Lint, 43 uygulama ve 15 Functions testi ile frontend derlemesi geçti; değişiklik yalnız belgelerdedir.

### 2026-10-10 — Furkan / Codex: geliştirici rehberi ve referans kalitesi

- [x] Sahip: Furkan — README'yi mevcut teslimat, iki çalışma modu, tekrarlanabilir kurulum/doğrulama ve belge sahipliği açısından kodla uyumlu bir giriş rehberine dönüştür.
- [x] Sahip: Furkan — Referans setinin iş tanımlarını, kaynak kanıtını ve insan değerlendirmesini kesinleştir; yanlış kaynak/payda/grafik bağlarını yakalayan kontrollerle güçlendir.

Kabul: README çalışmayan yetenekleri vaat etmemeli; komutlar/ortamlar gerçek yapılandırmayla uyuşmalı, sırlar belgelenmemeli. Referans cevapları model girdisinden ayrı tutulmalı; nesnel hesap, insan etiketi ve semantik değerlendirme ayrılmalı. Mevcut v1 verileri/cevapları korunmalı; sürümün anlamını değiştiriyorsa yeni sürüm kullanılmalı. AI bağlantısı, Python kurulumu veya yeni servis eklenmemeli. Lint, test ve build geçmeli.

Doğrulama: 46 yerel belge/bölüm bağlantısı ve 20 komut kullanımı doğrulandı. Lint, 43 uygulama ve 15 Functions testi (8 referans testi dahil), frontend ve Functions derlemeleri geçti. Ham v1 CSV'leri ve cevap anahtarları değişmedi; yanlış kaynak/payda, satır kapsamı, öneri dayanağı, grafik birimi/değeri ve şema sürümü için negatif kontroller geçti. Minimum içerik, puanla telafi edilemeyen ayrı kabul kapısıdır. Protokol/model sonuçları henüz ölçülmedi; üretim doğrulayıcısı veya AI servisi eklenmedi. Asıl değerlendirme kaynağı [referans setidir](fixtures/analysis-reference/README.md).

### 2026-10-10 — Furkan / Codex: analiz hedefi ve özetleme referansları

- [x] Sahip: Furkan — Zorunlu analiz hedefini forma, taslak yaşam döngüsüne ve backend kayıt sözleşmesine ekle; kaydedilmiş çalışmada göster.
- [x] Sahip: Furkan — Sentetik satış ve müşteri yorumları için sürümlü, kaynaklı referans seti; bağımsız beklenen hesaplar, bulgular, sınırlamalar ve LLM değerlendirme ölçütleri hazırla.

Kabul: Eski kayıtlar hedef olmadan açılmalı; yeni hazırlıklarda hedef zorunlu olmalı; hedef sayfalar arasında/hatalarda korunmalı, başarılı hazırlıkta temizlenmeli ve sunucuda uzunluğu doğrulanmalı. Referanslarda gerçek müşteri verisi bulunmamalı; hesaplar mevcut parser üzerinden doğrulanmalı, yorum sınıflandırmaları insan referansı olarak ayrılmalı. AI bağlantısı, Python kurulumu ve yeni servis bu işin kapsamında değildir. Lint, birim, Functions/build, entegrasyon ve yerel tarayıcı kontrolleri geçmeli.

Doğrulama: lint, 43 uygulama ve 11 Functions testi, uygulama/Functions derlemeleri, 3 Firebase entegrasyon testi ve 12/12 masaüstü/mobil tarayıcı senaryosu geçti. Boş/eksik/uzun hedef reddi, hedef değişiminde idempotency koruması, taslak/hata korunumu, kaydetme/yenileme ve başarılı hazırlıkta temizleme doğrulandı. Hedef arayüzü iki temada görsel, erişilebilirlik ve taşma kontrollerinden geçti; “Gerekli” etiketi gösterilmez. Referansların hash, kaynak satırı, bağımsız hesap, insan etiketi sayımı ve grafik/metrik eşleşmesi doğrulandı; gerçek LLM değerlendirmesi yapılmadı. Set ve kalite protokolü [fixtures/analysis-reference](fixtures/analysis-reference/README.md) içindedir.

### 2026-10-10 — Furkan / Codex: kaynaklı AI analiz ve grafik mimarisi

- [x] Sahip: Furkan — Onaylanan dosya türüne göre ayrıştırma, Python hesaplama, LLM yorumlama ve React/ECharts sunum akışını FLOW.md içinde belgele; roadmap ve kalıcı bağlamı bu karara bağla.

Kabul: Bugünkü TypeScript hazırlama hattı ile gelecekte uygulanacak mimari ayrılmalı; kaynak takibi, sayısal doğrulama, kontrollü grafik seçimi, erişilebilir animasyon ve örnek belge kalite kapısı tanımlanmalı. Python/OCR/LLM/ECharts çalışan özellik olarak gösterilmemeli; mevcut komutlar ve plan sınırları değişmemeli.

Doğrulama: FLOW.md, GOAL.md, MEMORY.md ve README.md tutarlılığı incelendi; 12 yerel belge/bölüm bağlantısı ve kod bloklarının kapanışı doğrulandı, `git diff --check` geçti. Değişiklik yalnız belgelerdedir; hedef mimarinin geliştirme işleri açık bırakıldı.

### 2026-10-06 — Furkan / Codex: özetleme öncesi arayüz düzeni

- [x] Sahip: Furkan — Giriş/kayıt üst boşluğunu sıkılaştır; Plan karşılaştırmasındaki henüz sunulmayan AI ve dış bağlantı satırlarını kaldır, Premium metinlerini vaat etmeden sadeleştir.
- [x] Sahip: Furkan — Ayarlar ekranında hesap, bağlantı, oturum ve tehlikeli alan sırasını yeniden tasarla; analiz oluştururken işletme bilgisini çalışma alanı bağlamı olarak gösterip her seferinde yeniden isteme.
- [x] Sahip: Furkan — Mobil/masaüstü ve iki tema doğrulamasından sonra local/remote `main` ile `furkan` dallarını eşitle.

Kabul: Canlı olmayan AI/bağlantı özellikleri aktifmiş gibi sunulmamalı; PayTR sağlayıcısı ve istenmeyen “henüz etkin değil/açık değil” ifadeleri belirtilmemeli. Giriş akışı, Free kotası, işletme ve başlık backend sözleşmesi, taslak korunumu, erişilebilirlik ve hesap silme güvenliği değişmemeli. Lint, test, build ve ilgili tarayıcı/entegrasyon kontrolleri geçmeli.

Doğrulama: lint, 41 uygulama ve 7 Functions testi, üretim derlemesi, 3 Firebase entegrasyon testi ve 12/12 masaüstü/mobil tarayıcı senaryosu geçti. Planın açık tema, ayarların açık/koyu tema ve işletme adının yeniden kullanıldığı analiz ekranının masaüstü/mobil görüntüleri incelendi; iki tema, yatay taşma ve erişilebilirlik tarayıcı kontrolleri geçti.

### 2026-10-01 — Furkan / Codex: kimlik kartı mobil rötuşu ve güncel yayın

- [x] Sahip: Furkan — Giriş ve kayıt ekranındaki “Firebase ile korunan hesap” rozetini kaldır; mobil yazıları çok hafif küçült, masaüstü düzenini koru.
- [x] Sahip: Furkan — Kontrollerin ardından local/remote `main` ve `furkan` dallarını eşitle, güncel uygulamayı Netlify üretimine yayınla.

Kabul: Canlı Auth giriş/kayıt ekranlarında istenmeyen rozet görünmemeli; emülatörün sentetik veri uyarısı korunmalı. Mobil yazı ayarı iki modda okunabilir ve taşmasız olmalı; giriş akışı bozulmamalı. Lint, test, build, entegrasyon ve yerel tarayıcı kontrolleri geçmeli; dört dal aynı commit'te, Netlify yayını bu commit'in derlemesinde olmalı.

Doğrulama: lint, 41 uygulama ve 7 Functions testi, üretim derlemesi, 3 Firebase entegrasyon testi ve 12/12 masaüstü/mobil tarayıcı senaryosu geçti. Canlı Auth rozeti kaldırıldı; emülatörün sentetik veri uyarısı korundu.

### 2026-10-01 — Furkan / Codex: ana ekran adresi ve boş geçmiş çağrısı

- [x] Sahip: Furkan — Ana ekranı yalnız `/` adresinde aç; üstteki yinelenen “Nasıl çalışır?” düğmesini kaldır ve eski bölüm hash'ini temizle.
- [x] Sahip: Furkan — Canlı Auth arşiv kartındaki önizleme dilini kaldır; dürüst, güçlü bir boş durum ve “Analize başla” yönlendirmesi tasarla.

Kabul: Ana ekran ve çalışma alanındaki yardım bağlantısı temiz `/` adresini göstermeli; eski hash yenilemede korunmamalı. Boş durum analize geçiş sunmalı, henüz açık olmayan bulut işlemlerinin çalıştığını iddia etmemeli. Mobil/masaüstü, tema ve klavye erişimi ile testler doğrulanmalı.

Doğrulama: lint, 41 uygulama ve 7 Functions testi, üretim derlemesi, 3 Firebase entegrasyon testi ve 12/12 masaüstü/mobil tarayıcı senaryosu geçti. Canlı Auth boş kartının metni ve yeni analiz bağlantısı ayrıca bileşen testinde doğrulandı.

### 2026-10-01 — Furkan / Codex: navigasyon ve metin son rötuşları

- [x] Sahip: Furkan — Ana sayfa üst navigasyonuna “Nasıl çalışır?” bağlantısını taşı, bölüm içindeki etiketi ve “Bugün kullanılabilir” kutusunu yenile; Auth önizlemesi geçmiş boş durumunu anlaşılır biçimde düzenle.
- [x] Sahip: Furkan — Free kartı üstüne ana sayfa yardım bağlantısını geri koy; çalışma alanı rotaları arasında tarayıcı geri/ileri geçmişini koru; AI karşılaştırma değerlerini Standard ve High olarak göster.

Kabul: Landing navigasyonu ve yardım bağlantısı doğru hedefe gitmeli; geçmiş/plan/ayarlar gezinmesi geri/ileri düğmeleriyle korunmalı. Auth-only geçmiş, kayıt varmış gibi davranmamalı. AI seviyesi gelecekteki kapasite olarak açıkça işaretlenmeli. Açık/koyu tema, mobil/masaüstü ve klavye erişimi korunmalı; lint, birim, tarayıcı ve build kontrolleri geçmeli.

### 2026-10-01 — Furkan / Codex: tanıtım arayüzü ve plan sınırları

- [x] Sahip: Furkan — Landing ve geçmiş başlığını açık tonlu, tutarlı bir düzene taşı; landing anlatımını responsive iki sütunda genişlet ve gereksiz “Nasıl çalışır?”/Free rozetlerini sadeleştir.
- [x] Sahip: Furkan — Free sınırlarını 2 analiz/gün, 5 dosya/analiz, 25 MB/analiz; Premium kapasitesini 5 analiz/gün, 10 dosya/analiz, 50 MB/analiz yap. Bağımsız dosya boyutu üst sınırını kaldır; istemci, backend, Storage kuralları, ürün metni ve testleri eşitle.

Kabul: dosya başına ayrı MB sınırı olmamalı; tek dosya toplam analiz sınırına kadar kabul edilmeli, boş dosya ve parser güvenlik sınırları korunmalı. Free kotası sunucuda uygulanmalı; Premium ödeme/yetkilendirme açılmadan kullanıma açılmamalı. Plan karşılaştırması etkin olmayan özellikleri açık anlatmalı, arayüzde “planlanan” sözcüğü görünmemeli. İki tema, mobil/masaüstü yerleşim, klavye ve mevcut arşiv işlemleri korunmalı; lint, birim, Functions, entegrasyon, tarayıcı ve build kontrolleri geçmeli.

Doğrulama: lint, 40 uygulama ve 7 Functions testi, üretim ve Functions derlemeleri, 3 Firebase entegrasyon testi ve 12/12 masaüstü/mobil tarayıcı senaryosu geçti. Tek dosyada 25 MB sözleşme sınırı, Storage'da 6 MB yükleme, günlük iki hazırlık sonrası kota reddi, iki tema ve mobil taşma kontrol edildi. Canlı Auth önizlemesi nedeniyle bulut veri işlemleri hâlâ etkin değil.

### 2026-09-30 — Furkan / Codex: tanıtım ve geçmiş deneyimi

- [x] Sahip: Furkan — “Nasıl çalışır?” anlatımını, boş ve dolu geçmiş ekranlarını yenile; oturumlu logoyu yeni analize yönlendir ve anlatıma geri dönüş yolu sun.

Kabul: anlatım gerçek belge hazırlama aşamasını doğru göstermeli; canlı Auth önizlemesinde etkin olmayan arşiv veri varmış gibi sunulmamalı; dolu arşivde arama, filtre, seçim ve silme erişimi korunmalı. Masaüstü/mobil, açık/koyu tema, klavye ve azaltılmış hareket kullanımı doğrulanmalı; lint, test ve build geçmeli.

Doğrulama: lint, 40 uygulama ve 7 Functions testi, üretim derlemesi ve Firebase emülatörlerinde 12/12 masaüstü/mobil tarayıcı senaryosu geçti. Boş ve dolu geçmiş ekranları ile anlatım ekranı görsel olarak incelendi; iki temada erişilebilirlik, klavye menüsü, responsive taşma ve azaltılmış hareket kontrolleri geçti. Logo ve yardım bağlantısı masaüstü/mobilde ayrıca doğrulandı. Canlı Auth önizlemesi etkin olmayan arşivi açık durum kartıyla anlatır; canlı hesapla bu turda yeni bir oturum testi yapılmadı.

### 2026-09-30 — Furkan / Codex: yerelde canlı Auth önizlemesi

- [x] Sahip: Furkan — `npm run dev` ile Netlify'daki Firebase Auth projesini yerelde kullan; emülatörlü tam akışı ayrı komutta koru.

Kabul: yerel önizleme aynı `incagen-eeef4` Auth yapılandırmasını Git'e yazılmayan ortam dosyasından okumalı; oturumsuz “Analize başla” giriş modalını açmalı, mevcut oturum çalışma alanına geçmeli; Storage/Functions hazır değilken canlı backend işlemleri engellenmeli. Emülatör ve otomatik test komutları hiçbir durumda canlı projeye bağlanmamalı. Lint, test ve build geçmeli; README ve FLOW.md komut davranışını doğru anlatmalı.

Doğrulama: Netlify ortamındaki sekiz `VITE_` değeri Git dışındaki `.env.cloud-preview.local` dosyasına alındı; `cloud-preview` modu `incagen-eeef4` ve Auth-only, `emulator` modu `demo-incagen` olarak ayrışıyor. Firebase Auth yapılandırma sorgusunda `localhost` yetkili alan adı olarak döndü. Yeni `npm run dev` ayrı portta açıldı; temiz tarayıcı oturumunda “Analize başla” landing üzerindeki giriş modalını gösterdi. Lint, 40 uygulama + 7 Functions testi, üretim derlemesi, çalışan emülatörlerde 3 entegrasyon ve 10/10 masaüstü/mobil tarayıcı senaryosu geçti. Gerçek kullanıcı parolası kullanılmadığından yerel canlı giriş işlemi kullanıcı tarafından yeniden başlatılan sunucuda doğrulanacak.

### 2026-09-28 — Furkan / Codex: Netlify'da tüm uygulama ekranları

- [x] Sahip: Furkan — Auth-only yayında giriş sonrası tam uygulama navigasyonunu ve ekranlarını göster; Firebase tarafında yalnız Auth etkin kalsın.

Kabul: Girişten sonra Yeni analiz, Geçmiş, Ayarlar ve Plan ekranları yerel uygulamayla aynı metinler ve rotalarla canlı URL'de gezilebilir olmalı; emülatörlü tam akış ayrı komutta korunmalı. Canlıda Firestore/Storage/Functions hazır olmadığından bunlara istek gönderilmemeli; belge hazırlama ve hesap silme denenince durum açıklanmalı, geçmiş de veri varmış gibi gösterilmemeli. Kayıt, giriş, çıkış, şifre yenileme, doğrudan rota yenileme, masaüstü/mobil görünüm ve temel kontroller doğrulanmalı. Gerçek backend dağıtımı ayrı engelli iş olarak kalır; ilk yayında PR veya `main` push'u yapılmaz.

Doğrulama: lint, 40 uygulama ve 7 Functions testi, üretim derlemesi ile yerel Firebase emülatörlerinde 10/10 masaüstü/mobil tarayıcı senaryosu geçti. Netlify üretim yayınına gerçek Firebase Auth ile geçici hesap açılıp masaüstü ve mobilde giriş, Yeni analiz, Geçmiş, Plan, Ayarlar ve çıkış doğrulandı; test hesabı temizlendi. Canlı akışta Firestore/Storage/Functions isteği çıkmadı. Belge hazırlama ve hesap silme açık durum mesajıyla engelleniyor. SPA rotaları doğrudan açılıyor; mobil navigasyonu örten Netlify rozeti site ayarından kaldırıldı. Tam canlı analiz ve hesap silme işi, Spark planındaki backend engeli nedeniyle ayrı kalıyor.

### 2026-09-28 — Furkan / Codex: Netlify üzerinde yalnız Auth önizlemesi

- [x] Sahip: Furkan — Mevcut Netlify sitesinde gerçek Firebase e-posta/parola kaydı, giriş, çıkış ve şifre yenilemeyi yayınla; backend bağımlı sayfaları yalnız bu bulut önizlemesinde kapalı tut.

Kabul: Netlify build'i `incagen-eeef4` Web App yapılandırmasını kullanmalı; yerel emülatörlü tam uygulama değişmemeli; oturum açan kullanıcı yalnız hesap önizlemesine ulaşmalı; analiz ve hesap silme eylemleri Cloud Functions/Storage hazır olmadan görünmemeli; canlı URL'de kayıt, giriş, çıkış, şifre yenileme ve SPA yenilemesi doğrulanmalı.

Doğrulama: Netlify ortam değişkenleriyle üretim derlemesi ve `incagen.netlify.app` yayını geçti. Sentetik hesapla canlı kayıt, giriş, çıkış, oturumlu `/app` yenileme ve hem giriş formundan hem hesap sayfasından şifre yenileme isteği doğrulandı; test hesabı silindi. Analiz ve hesap silme yolları bu modda kapalı. Yerel lint, 42 uygulama ve 7 Functions testi, üretim derlemesi ve emülatörlere bağlı 10/10 masaüstü/mobil tarayıcı senaryosu geçti (bir senaryo ilk koşuda zaman aşımına uğrayıp otomatik tekrarda geçti).

### 2026-09-26 — Furkan / Codex: başarılı analiz sonrası temiz taslak

- [x] Sahip: Furkan — Başarılı belge hazırlığından sonra dosya ve analiz başlığı taslağını temizle; işletme adını koru ve sonuçtan yeni analize açık geçiş ekle.

Kabul: taslak yalnız backend hazırlığı başarıyla tamamlandıktan sonra temizlenmeli; seçili dosyalar, reddetme bildirimleri, analiz başlığı, ilerleme ve tekrar kimliği sıfırlanmalı; işletme adı ile son analiz bağlantısı korunmalı; doğrulama/ağ hatası veya iptalde kullanıcının girdileri yeniden deneme için kalmalı; sonuç ekranındaki yeni analiz eylemi temiz forma götürmeli.

Doğrulama: lint, frontend ve Functions production build, 39 uygulama ve 7 Functions/parser testi geçti. Firebase emülatörlü tam kayıt → hazırlama → yeni analiz → son iş → geçmiş → silme → çıkış akışı masaüstü ve mobilde 2/2 geçti; başarılı işlemde dosya/başlık temizliği ve işletme adı korunması, başarısız doğrulamada taslağın kalması doğrulandı.

### 2026-09-26 — Furkan / Codex: arşiv özeti açıklamaları

- [x] Sahip: Furkan — Geçmiş özet kartlarının anlamını hover, klavye odağı ve ekran okuyucu kullanımında kısa açıklama balonlarıyla göster.

Kabul: dört kartın açıklaması durum kapsamını doğru anlatmalı; balon kartın üstünde küçük ve okunaklı görünmeli; mobil genişlikte taşmamalı; yalnız renge veya fare kullanımına bağlı olmamalı.

Doğrulama: lint, production build, 38 uygulama ve 7 Functions/parser testi geçti. Firebase emülatörlü geçmiş senaryosunda tooltip hover ve klavye odağıyla açıldı; masaüstü ve mobil koşu 2/2 geçti, iki tema erişilebilirliği ve yatay taşma kontrolü korundu.

### 2026-09-26 — Furkan / Codex: geçmiş arşivi keşif ve görünürlük

- [x] Sahip: Furkan — Geçmiş ekranına arşiv özeti, yerel arama, durum/tarih filtreleri ve sıralama ekle; görünümü URL üzerinde korunabilir hale getir.

Kabul: özet yalnız kullanıcının canlı analiz listesinden türetilmeli; arama başlık, işletme ve hazırlanmış kaynak belge adlarını kapsamalı; durum ve tarih filtreleri birlikte çalışmalı; sıralama ve filtreler geri/ileri gezinmede korunmalı; boş arşiv ile sonuç bulunamayan görünüm ayrılmalı; toplu seçim yalnız görünür sonuçlarda anlaşılır davranmalı; mobil/masaüstü, iki tema, klavye kullanımı ve erişilebilirlik doğrulanmalı.

Doğrulama: lint, production build, 38 uygulama ve 7 Functions/parser testi geçti. Çalışan Firebase emülatörlerinde önce 8 bağımsız tarayıcı senaryosu, ardından düğme adı beklentisi güncellenen geçmiş senaryosu masaüstü ve mobilde 2/2 geçti; URL yenileme, arşiv özeti, arama temizleme, görünür toplu seçim, iki tema erişilebilirliği ve mobil taşma doğrulandı.

### 2026-09-21 — Furkan / Codex: çalışan Netlify önizlemesi

- [!] Sahip: Furkan — `incagen.netlify.app` üzerinde e-posta/parola kimliği, çıkış ve hesap silme dahil gerçek Firebase servislerine bağlı manuel Netlify yayını hazırla. Engel: `incagen-eeef4` Spark planında; Storage ve Cloud Functions için proje sahibi Blaze faturalandırmasını etkinleştirmeli.

Kabul: localhost emülatör akışı korunmalı; canlı frontend yalnız açıkça verilen Firebase web yapılandırmasını kullanmalı; Auth, Firestore, Storage ve Functions aynı gerçek projeye bağlanmalı; Netlify SPA rotaları yenilemede çalışmalı; giriş, kayıt, çıkış, parola sıfırlama ve hesap silme URL üzerinde doğrulanmalı. Tam backend akışı doğrulanmadan çalışıyor olarak sunulmayacak; yalnız Auth'un etkin olduğu önizleme kodu kullanıcı onayıyla PR açılmadan `main`e alınabilir.

Durum (2026-09-28): Furkan'ın `incagen-eeef4` Firebase projesine erişimi doğrulandı. Web App yapılandırmasındaki yedi `VITE_FIREBASE_*` değeri Netlify sitesine eklendi ve panelde doğrulandı; gerçek değerler repoya yazılmadı. Firebase e-posta/parola sağlayıcısı ve `incagen.netlify.app` yetkili alan adı etkin; yalnız Auth önizlemesi canlıda yayınlandı ve doğrulandı. Firestore varsayılan veritabanı `eur3` konumunda hazır, ancak canlı kurallar henüz varsayılan `allow read, write: if false` durumunda. Storage konsolu Blaze gereksinimi gösteriyor; varsayılan bucket ve dört Cloud Function henüz dağıtılmadı. Faturalandırma açıldıktan sonra Storage bucket'ı oluşturulup repo kuralları/Functions dağıtılacak, ardından tam kullanıcı akışı canlıda doğrulanacak. Kullanıcı, bu engel sürerken yalnız Auth'un çalıştığı tam arayüz önizlemesinin doğrulanan kodunu PR açmadan `main`e göndermeyi ayrıca onayladı; tam backend işi engelli kalır.

### 2026-09-20 — Furkan / Codex: main Quality CI onarımı

- [x] Sahip: Furkan — `067ba99` main push'unda mobil geçmiş testinin düştüğü Quality koşusunu onar ve yeni commit'in CI sonucunu doğrula.

Kabul: lint, birim/bileşen, build, tarayıcı ve Firebase entegrasyon kontrolleri temiz bir ortamda geçmeli; GitHub Quality koşusu yeşil doğrulanmalı; PR açılmadan main ve Furkan dalları eşitlenmeli. Tanı veya uzak koşu erişimi engellenirse somut neden ve eksik doğrulama burada belirtilmeli.

Tanı: `0cd1b0a` ve `481b1d8` Quality koşuları mobil geçmiş testinde, menü açık olmasına rağmen `Analizi sil` tıklamasında düştü. Geçmişteki son karta odaklanınca aşağı açılan menü, `z-30` sabit mobil navigasyonun arkasında kalabiliyordu. Menü mobilde yukarı, masaüstünde aşağı açılıyor ve katman sırası düzeltildi; test mobil menünün navigasyondan yukarıda kaldığını ölçüyor. Escape ve modal kapanışı ile silme sonucu/canlı liste beklemeleri de korunuyor. CI emülatörleri tek tarayıcı işçisiyle kullanıyor; eski Java aksiyonu güncellendi ve Ubuntu koşucusu sabitlendi.

Doğrulama: Node 22 ve CI ayarıyla izole emülatörlerde tam 10 tarayıcı testi, önceki test düzeninde mobil rapor senaryolarında 20/20 tekrar, 3 Firebase entegrasyon, 32 uygulama ve 7 parser testi; lint ve üretim derlemesi geçti. Menünün yukarı konumu ve navigasyonla çakışmaması mobil testte doğrulandı. `7d66f50` main commit'inin GitHub Quality koşusu 1/1 yeşil doğrulandı; local/remote main ve Furkan dalları bu committe eşitlendi.

### 2026-09-20 — Furkan / Codex: ekran metinlerinde son düzenlemeler

- [x] Sahip: Furkan — Plan alt notunu, Ayarlar'daki yerel demo kartını ve bağlantı kartlarındaki “Yakında” rozetlerini kaldır; boş geçmiş başlığını ve yeni analiz açıklamasını mevcut belge hazırlama davranışına uygun hale getir.

Kabul: istenmeyen metinler görünmemeli; yeni analiz açıklaması bu aşamada analizin başlamadığını net söylemeli; boş geçmiş başlığı iş verileriyle ilgili olmalı; mevcut işlemler ve erişilebilirlik korunmalı. Kontroller sonrası PR açmadan doğrudan main'e push edilecek ve local/remote main ile Furkan dalları eşitlenecek.

Doğrulama: lint, üretim derlemesi, 32 uygulama ve 7 parser testi geçti. Masaüstü/mobil 6 tarayıcı senaryosunda istenmeyen metinlerin yokluğu, yeni açıklama ve boş geçmiş başlığı, iki tema erişilebilirliği ve mobil taşma kontrol edildi.

### 2026-09-19 — Furkan / Codex: plan, hesap ve boş geçmiş iyileştirmeleri

- [x] Sahip: Furkan — Plan ekranını sadeleştir, Premium toplamını 60 MB olarak tüm sözleşme ve belgelerde eşitle, Ayarlar'a gerçek hesap silme ile Google Analytics / Microsoft Clarity bağlantı taslaklarını ekle ve boş geçmişi iyileştir.

Kabul: Premium 60 MB merkezi sözleşme, plan ekranı, açıklamalar ve testlerde tutarlı olmalı; istenen Plan metinleri kaldırılmalı ve etkin olmayan Premium eylemi pasif düğme olmalı; hesap silme yeniden kimlik doğrulaması ve açık onay sonrasında Auth, Firestore, ham ve türetilmiş dosyaları temizlemeli; bağlantı eylemleri açıkça pasif kalmalı; boş geçmiş mobil/masaüstü ve iki temada kullanılabilir olmalı. Bu iş yalnız `furkan` dalında tutulacak; PR ve main push kullanıcı onayına kadar yapılmayacak.

Doğrulama: lint, frontend ve Functions derlemeleri, 32 uygulama ve 7 parser testi, 3 Firebase entegrasyon testi ve 10 masaüstü/mobil tarayıcı senaryosu geçti. Yanlış onay/parola, başarılı hesap silme, iki tema erişilebilirliği ve mobil taşma doğrulandı. Premium 60 MB ve pasif bağlantılar ekranlarda kontrol edildi.

### 2026-09-19 — Furkan / Codex: plan karşılaştırması ve yeni analiz sadeleştirmesi

- [x] Sahip: Furkan — Yeni analizdeki yinelenen plan ve yerel ortam metinlerini kaldır; Ayarlar altına Free/Premium farkını gösteren ayrı Plan ekranı ekle.

Kabul: yeni analiz ekranında Free/Premium açıklama kartları ve yerel geliştirme metni görünmemeli; ortak belge formatı cümlesi korunmalı; Plan ekranı merkezi plan kurallarındaki günlük/adet/boyut sınırlarını doğru göstermeli, aynı format kapsamını ve planlanan AI/bağlantı ayrımını açıklamalı; Premium'u etkin veya ücretli gösteren sahte eylem bulunmamalı; masaüstü/mobil navigasyon, iki tema ve erişilebilirlik doğrulanmalı.

Doğrulama: lint, frontend üretim derlemesi, 32 uygulama ve 7 parser testi geçti. Çalışan Firebase emülatörlerinde masaüstü/mobil 8 tarayıcı senaryosu çalıştırıldı; iç bağlantının geri tuşu düzeltmesinden sonra ilgili 2 senaryo tekrar geçti. Plan ekranının iki tema görselleri, mobil taşma ve WCAG A/AA taramaları kontrol edildi.

### 2026-09-19 — Furkan / Codex: geçmişte güvenli silme deneyimi

- [x] Sahip: Furkan — Geçmiş kartlarına tekli silme için bağlamsal işlem menüsü, toplu silme için seçim modu ve açık onay uyarısı ekle.

Kabul: normal listede her karta ayrı çöp kutusu eklenmemeli; tekli ve toplu silme kaynak belgeleriyle birlikte silme sonucunu açıkça bildirmeli; iptal veri değiştirmemeli; toplu işlem kısmi hata yaşarsa başarısız kayıtlar yeniden denenebilir kalmalı; mobil/masaüstü, açık/koyu tema ve klavye erişimi korunmalı.

Doğrulama: lint, frontend/Functions derlemeleri, 32 uygulama ve 7 parser testi, 2 Firebase entegrasyon senaryosu ile 8 masaüstü/mobil tarayıcı testi geçti. Tekli ve iki kayıtlı toplu silme, iptal, klavye menüsü, koyu tema erişilebilirlik taraması ve mobil taşma kontrolü doğrulandı; açık/koyu geçmiş ekranı görselleri incelendi.

### 2026-09-18 — Tarık / Codex: belge ayrıştırma temeli

- [x] Sahip: Tarık — Gerçekte işlenen formatlarla frontend/backend destek matrisini eşitle.
- [x] Sahip: Tarık — Kaynak konumu, parser sürümü, uyarı ve içerik parçalarını taşıyan ortak belge modelini ekle.
- [x] Sahip: Tarık — Metin/veri, CSV/TSV, XLSX, PDF, görsel, DOCX ve PPTX ayrıştırıcılarını güvenli sınırlarla uygula.
- [x] Sahip: Tarık — Ayrıştırılmış özetleri mevcut hazırlama sonucuna bağla; bozuk veya içerikle uyuşmayan dosyaları reddet.

Kabul: yalnız gerçekten ayrıştırılan uzantılar seçilebilmeli; her kaynak kararlı bir hash ve konumlu içerik parçaları üretmeli; arşiv, satır/hücre, metin ve parça sınırları backend'de uygulanmalı; bozuk/parolalı/yanlış tür dosyaları kota iadesiyle başarısız olmalı; sentetik fixture'lar, entegrasyon akışı, lint ve build kontrolleri geçmeli. Gemini çağrısı, tavsiye ve grafik üretimi bu teslimatın kapsamında değildir.

Doğrulama: lint, frontend/backend üretim derlemeleri, 32 frontend testi, 7 parser fixture testi, 2 emülatör entegrasyon senaryosu ve retry gerektirmeyen 6 masaüstü/mobil tarayıcı testi geçti. Her iki üretim bağımlılık ağacı `npm audit --omit=dev` sonucunda temizdir.

### 2026-09-14 — Furkan / Codex: kimlik sonrası hazırlık geçişi

- [x] Sahip: Furkan — Giriş/kayıt sosyal seçeneklerindeki geçici “yakında” metnini kaldır; başarılı Firebase kimlik işleminden sonra 3 saniyelik markalı hazırlık geçişi göster.

Kabul: sosyal ayraç ve pasif sağlayıcıların görünür/erişilebilir adlarında “yakında” bulunmamalı; başarılı giriş ve kayıtta sıralamaya bağlı giriş/kayıt ifadesi içermeyen 20 mesajlık havuzdan rastgele 5 mesaj gösterilmeli; marka renkli yatay ilerleme çubuğu 3 saniyede dolmalı; geçiş boyunca landing URL'si korunup tamamlanınca mevcut hedef rotaya gidilmeli; başarısız kimlik işleminde geçiş açılmamalı; masaüstü, mobil ve azaltılmış hareket kullanımı bozulmamalı.

Doğrulama: lint, production build, 32 birim/bileşen testi ve 6 masaüstü/mobil Firebase tarayıcı senaryosu geçti. Sıralamadan bağımsız 20 benzersiz mesaj, giriş/kayıt ifadesinin yokluğu, tekrarsız 5 mesaj seçimi, 3 saniyelik süre ve rota davranışı doğrulandı.

### 2026-09-14 — Furkan / Codex: tek komutla yerel geliştirme

- [x] Sahip: Furkan — `npm run dev` ile Firebase emülatörlerini ve frontend'i birlikte başlat; giriş ekranındaki bağlantı hatasının eksik backend başlangıcından kaynaklanmasını önle.

Kabul: komut önce Functions'ı derleyip Auth, Firestore, Storage ve Functions emülatörlerini hazır etmeli, ardından Vite'ı başlatmalı; Playwright kendi emülatörleriyle çakışmamalı; hata mesajı doğru başlangıç komutunu göstermeli; README tek ve iki terminal seçeneklerini açıklamalı.

Doğrulama: tek komutla dört Firebase emülatörü ve Vite başarıyla başlatıldı; lint, frontend/Functions production build, 29 birim/bileşen testi ve 6 masaüstü/mobil emülatörlü tarayıcı senaryosu geçti. Playwright'ın `dev:web` ile mevcut emülatörlere bağlandığı ve port çakışması yaratmadığı doğrulandı.

### 2026-09-14 — Furkan / Codex: plan başına belge boyutu sınırları

- [x] Sahip: Furkan — Free analiz toplamını 30 MB, planlanan Premium için ilk toplam sınırı belirle; dosya başına 5 MB ve mevcut adet/günlük limitleri koru. Güncel Premium sınırı üstteki görevle 60 MB'a çıkarıldı.

Kabul: yeni analiz arayüzü ve hata mesajları doğru plan sınırlarını göstermeli; istemci ve backend Free için 30 MB toplamı uygulamalı; Premium plan sınırı ortak sözleşmede tanımlanmalı ancak yetkilendirme açılmadan kullanıcıya uygulanmamalı; FLOW.md ve sınır testleri güncellenmeli.

Doğrulama: lint, frontend/Functions production build, 29 birim/bileşen testi, 2 Firebase emülatör entegrasyon senaryosu ve 6 masaüstü/mobil tarayıcı senaryosu geçti. Tam 30 MB Free isteğinin kabulü, 30 MB + 1 baytın reddi ve o günkü Premium plan değerinin arayüzde gösterimi doğrulandı.

### 2026-09-14 — Furkan / Codex: genel belge hazırlama hattı

- [x] Sahip: Furkan — Yeni analiz deneyimini para birimi ve tabloya özel eşleştirmelerden arındır; desteklenen tüm iş belgesi türlerini frontend, Storage ve Functions boyunca hazırla.

Kabul: dosya seçimi belirli bir tablo formatına özel mesaj veya kontrol göstermemeli; para birimi kaldırılmalı; Free/Premium format kapsamı aynı olmalı ve yalnız adet, analiz derinliği ve planlanan harici bağlantılar farklılaşmalı; backend dosya adı/boyutu/içerik türünü doğrulayıp AI çağrısı yapmadan hazırlık özeti üretmeli; eski satış raporu bileşenleri ve parser bağımlılıkları kaldırılmalı.

Doğrulama: lint, frontend/Functions production build, 27 birim/bileşen testi, 2 Firebase emülatör entegrasyon senaryosu ve 6 masaüstü/mobil tarayıcı senaryosu geçti. Genel belge seçimi, Storage manifest doğrulaması, kota/idempotency, kullanıcı izolasyonu, hazırlık özeti ve kaynaklarıyla silme doğrulandı.

### 2026-09-14 — Furkan / Codex: hesap ve güvenlik ayarları

- [x] Sahip: Furkan — Ayarlar ekranını genişlet; oturum e-postasına parola değiştirme bağlantısı gönderen hesap güvenliği akışını ekle.

Kabul: ayarlar geniş ve responsive bir hesap görünümü sunmalı; kullanıcı bağlı e-posta adresini görmeli; parola sıfırlama isteğinin yüklenme, başarı ve hata durumları açıklanmalı; çıkış ve yerel veri davranışı korunmalı.

Doğrulama: lint, production build, 30 birim/bileşen testi ve 6 masaüstü/mobil tarayıcı senaryosu geçti. Şifre isteğinin doğru e-postaya gitmesi, başarı/hata durumları ve çıkışta modalın açılmaması doğrulandı; kişisel Chrome entegrasyonu kullanılmadı.

### 2026-09-14 — Furkan / Codex: profesyonel kimlik modalı

- [x] Sahip: Furkan — Giriş ve kayıt modalını modern, doğrulamalı ve sağlayıcı seçenekli bir deneyime dönüştür.

Kabul: iki modda e-posta geçerlilik geri bildirimi ve parola görünürlüğü bulunmalı; kayıt modunda parola tekrarı, canlı 8 karakter/büyük harf/rakam/özel karakter ölçütleri ve davet kodu alanı gösterilmeli; Google, Apple ve Microsoft seçenekleri pasif “yakında” arayüzü olarak sunulmalı; mevcut yerel e-posta/parola işlemi korunmalı.

Doğrulama: lint, production build ve yeni form etkileşimlerini kapsayan 27 birim/bileşen testi geçti. Tarayıcı entegrasyonu kullanılmadı; mevcut masaüstü/mobil senaryolar yeni kayıt alanlarına uyarlandı.

### 2026-09-14 — Furkan / Codex: giriş rotasını kaldırma ve çıkış dönüşü

- [x] Sahip: Furkan — `/login` rotasını kaldır; korumalı erişimde landing modalını kullan ve başarılı çıkıştan sonra ana sayfaya dön.

Kabul: çıkış başarılı olduğunda landing modal açılmadan gösterilmeli; oturumsuz korumalı rota landing üzerindeki giriş modalına dönmeli; girişten sonra istenen güvenli uygulama rotasına devam edilmeli; `/login` uygulama rotası olarak bulunmamalı.

Doğrulama: lint, production build ve yönlendirme/çıkış davranışını kapsayan 26 birim/bileşen testi geçti. Tarayıcı entegrasyonu kullanılmadı.

### 2026-09-14 — Furkan / Codex: landing üzerinde kimlik modalı

- [x] Sahip: Furkan — “Analize başla” çağrısında landing sayfasını terk etmeden giriş/kayıt modalını göster.

Kabul: oturumsuz kullanıcı landing üzerinde erişilebilir modalı görmeli; modal kapanabilmeli; başarılı kimlik işleminden sonra yeni analiz alanına geçilmeli; doğrudan korumalı rota erişimi landing üzerindeki aynı modalı kullanmalı.

Doğrulama: lint, production build, 23 birim/bileşen testi ve modal erişilebilirliğini de kapsayan 6 masaüstü/mobil tarayıcı testi geçti; aydınlık ve karanlık tema davranışı doğrulandı.

### 2026-09-14 — Furkan / Codex: Tarık branch entegrasyonu

- [x] Sahip: Furkan — Tarık'ın yerel rapor prototipini güncel main ve Furkan branch'iyle birleştirip doğrula.

Kabul: Tarık'ın sekiz commit'i ve yeni doğrudan main çalışma düzeni korunmalı; lint, frontend/backend build ve birim testleri geçmeli; local/remote main ile local/remote Furkan branch'leri aynı commit'te olmalı.

Doğrulama: lint, frontend/backend build, 22 birim/bileşen testi, 2 emülatör entegrasyon senaryosu ve 6 masaüstü/mobil tarayıcı testi geçti.

### 2026-09-11 — Tarık / Codex: ilk yerel rapor prototipi

- [x] Sahip: Tarık — Uzantı güvenliği, kalıcı oturum içi dosya seçimi ve regresyon testleri.
- [x] Sahip: Tarık — Yerel Firebase Auth/Firestore/Storage/Functions ve e-posta/parola oturumu.
- [x] Sahip: Tarık — Tablo eşleştirme, backend hesaplama, kota ve idempotent analiz akışı; genel belge hazırlama hattı bu prototipin yerini aldı.
- [x] Sahip: Tarık — Sonuç rotası, grafikler, gerçek geçmiş ve kaynaklarla birlikte silme.
- [x] Sahip: Tarık — Türkçe sözlük, emülatör izolasyon testleri, tarayıcı testleri ve kurulum belgeleri.

Kabul: sentetik tablo verisiyle kayıt → yükleme → hesaplanan rapor → geçmiş → silme akışı ve iki kullanıcı izolasyonu doğrulanmalı. AI yorumu ve bulut yayını kapsam dışıdır.

Doğrulama: lint, frontend/backend build, 22 birim/bileşen testi, 2 emülatör entegrasyon senaryosu ve 6 masaüstü/mobil tarayıcı testi geçti. Son tarayıcı koşusunda retry gerekmedi; iki temada axe erişilebilirlik kontrolü yapıldı. GitHub üzerindeki CI sonucu henüz doğrulanmadı.

Durum: [~]

- [x] Sahip: Tarık — React/TypeScript tabanı, animasyonlu logo, responsive giriş ve tema.
- [x] Sahip: Furkan — İlk ürün/AI akışı, proje hafızası ve favicon.
- [x] Sahip: Tarık — Çoklu dosya seçimi ve bileşen odaklı stil düzeni.
- [x] Sahip: Tarık — Ortak roadmap ve belge sorumlulukları.
- [x] Sahip: Tarık — PR #2 inceleme düzeltmeleri: çoğul arayüz, kararların ayrıştırılması, sade belgeler ve temiz branch geçmişi.
  Kabul: lint/build/diff kontrolü temiz; çoklu seçim ve iki tema kontrol edilmiş; PR yalnız ilgili değişiklikleri içeriyor.
- [x] Sahip: Furkan — Router ve responsive uygulama kabuğu; kimlik tabanlı rota koruması M1 Authentication sonrasında eklenecek.
- [x] Sahip: Tarık — Türkçe kaynaklarla i18n temeli; mevcut tüm metinlerin taşınması ve ikinci dil sonraki iştir.
- [x] Sahip: Furkan — Vitest, React Testing Library ve Playwright test altyapısı.
- [x] Sahip: Furkan — GitHub Actions üzerinde lint, birim/bileşen testi, build, masaüstü/mobil tarayıcı ve erişilebilirlik kontrolleri.
- [x] Sahip: Furkan — Günlük branch/main eşitleme ve koşullu PR çalışma düzenini belgele.
- [x] Sahip: Tarık — Buluta kapalı demo emülatörleri ve güvenli environment şablonu.
- [ ] Sahip: Atanmadı — Gerçek dev/prod Firebase kaynakları ve bulut güvenlik doğrulaması.

Kapanış: görevler incelenmiş; CI kontrolleri başarılı; repoda sır veya müşteri verisi yok.

## M1 — Kimlik ve uygulama kabuğu

- [x] Sahip: Tarık — Yerel Firebase e-posta/parola Authentication, oturum yönetimi ve korumalı rotalar.
- [ ] Sahip: Atanmadı — İşletme bilgileri ve analiz hedefini alan onboarding.
- [x] Sahip: Furkan — Yeni analiz, geçmiş ve ayarlar rotaları; sonuç rotası ilgili ekran geliştirilirken eklenecek.
- [x] Sahip: Furkan — Uygulama kabuğunda Premium geçiş çağrısı ve iç navigasyondan landing sayfasına dönen tarayıcı geçmişi.
- [x] Sahip: Tarık — UID tabanlı kullanıcı izolasyonu ve iki hesapla emülatör testleri.
- [ ] Sahip: Atanmadı — Gelecekte workspace tabanlı ekip veri modeli.

Kalite kapısı: oturum yenileme, çıkış, korumalı rotalar ve yetkisiz erişim testleri başarılı.

## M2 — Dosya yükleme ve hazırlama

- [x] Sahip: Furkan — FLOW.md formatları için istemci doğrulaması, tekrar kontrolü, Free plan sınırı ve seçim yönetimi; backend normalizasyonu sonraki adımdır.
- [x] Sahip: Tarık — İlk tablo prototipi için Free kota ve İstanbul takvim günü kontrolü; geçerli genel belge sınırları FLOW.md'ye taşındı.
- [x] Sahip: Tarık — Yerel Storage yükleme, ilerleme, iptal ve aynı oturumda yeniden deneme.
- [x] Sahip: Tarık — İlk tablo prototipinde açık kolon eşleştirmesi ve kaynak özeti; bu akış genel belge hazırlama deneyimiyle değiştirildi.
- [x] Sahip: Tarık — Bozuk, parolalı, türü uyuşmayan ve aktif içerik taşıyan dosyaları reddet; konumlu kaynak referansları üret.
- [ ] Sahip: Atanmadı — Canlı ortam için zararlı yazılım taraması ve karantina politikası.
- [ ] Sahip: Atanmadı — Kısmi hata görünümü ve geçerli dosyalarla devam onayı.

Kalite kapısı: format fixture'ları, kota sınırları, yetkilendirme ve kısmi hata testleri başarılı.

## M3 — AI analiz hattı

- [ ] Sahip: Atanmadı — [FLOW.md hedef mimarisi](FLOW.md#kabul-edilen-hedef-mimari--2026-10-10) için Cloud Run üzerinde Python işçisi ve arka plan iş yönetimi.
- [ ] Sahip: Atanmadı — Dosya türüne göre OCR/görsel okuma, kaynaklı normalizasyon ve Python ile deterministik metrikler; parser/OCR adaylarını örnek belge setiyle değerlendir.
- [ ] Sahip: Atanmadı — Uygunluk kontrolü ve FLOW.md ana model yapılandırması.
- [~] Sahip: Furkan — Sürümlü JSON Schema, kaynak ve sayısal metrik doğrulama. İlk bağımsız v1 kapısı [docs/AI-RESULTS.md](docs/AI-RESULTS.md) içinde tamamlandı; model/hesaplayıcı ve sonuç kayıt hattına entegrasyon ile gerçek çıktı kabulü kaldı.
- [x] Sahip: Tarık — Hazırlama hattında idempotent kota, hata iadesi ve süre aşımı sonrası kullanıcı tetiklemeli retry.
- [ ] Sahip: Atanmadı — AI için kalıcı kuyruk ve sınırlı otomatik retry.

Kalite kapısı: [FLOW.md uygulama sırası ve kalite kapısı](FLOW.md#uygulama-sırası-ve-kalite-kapısı) üzerinden extraction, metrik/kaynak doğruluğu, bulgu dayanağı, süre ve maliyet ölçülmüş; şema, hata/retry, kota ve kullanıcı izolasyonu entegrasyon testleri başarılı.

## M4 — Sonuçlar ve geçmiş

- [x] Sahip: Furkan — Genel belgeler için doğrulanmış kaynak ve hazırlık özeti; AI bulgu ve grafikleri sonraki aşamaya bırakıldı.
- [ ] Sahip: Atanmadı — AI bulgu ve öneri ekranları.
- [~] Sahip: Furkan — [FLOW.md grafik ve hareket davranışı](FLOW.md#grafik-ve-hareket-davranışı) için React/ECharts sunumu, kaynak erişimi ve erişilebilir veri tablosu. Sentetik `/ornek-rapor` kesiti doğrulandı; gerçek doğrulanmış analiz kayıtlarına bağlama ve farklı belge/çıktı türlerinin kabulü kaldı.
- [ ] Sahip: Atanmadı — Kaynak referansı, güven düzeyi ve çıkarım etiketleri.
- [x] Sahip: Tarık — Kullanıcıya özel Firestore geçmişini listeleme ve kayıtlı raporu açma.
- [ ] Sahip: Atanmadı — Geçmiş arama ve filtreleme.
- [x] Sahip: Tarık — Yerel analiz ile kaynak dosyalarının birlikte ve tekrar denenebilir silinmesi.
- [ ] Sahip: Atanmadı — Canlı saklama, yedek ve silme politikaları.
- [ ] Sahip: Atanmadı — PDF kapsam kararı sonrası gerekirse aynı doğrulanmış sonuçtan dışa aktarım.

Kalite kapısı: sonuçlar doğrulanmış verilerle eşleşiyor; kaynaklar çalışıyor; yetkisiz erişim ve silme senaryoları geçiyor.

## M5 — Yayına hazırlık ve operasyon

- [ ] Sahip: Atanmadı — Beta erişim kararı ve kabul senaryoları.
- [ ] Sahip: Atanmadı — Kullanıcı/kota/başarısız iş yönetimi için operasyon araçları.
- [ ] Sahip: Atanmadı — App Check, Security Rules ve hız sınırlama.
- [ ] Sahip: Atanmadı — Hata, iş süresi, parser başarısı ve model maliyetlerini izleme.
- [ ] Sahip: Atanmadı — Maliyet alarmı, yedekleme ve geri yükleme prosedürü.

Kalite kapısı: güvenlik ve uçtan uca testler başarılı; operasyon ve erişim politikaları doğrulanmış.

## M6 — Premium ve entegrasyonlar

- [ ] Sahip: Atanmadı — PayTR ödeme entegrasyonu, doğrulanmış webhook ve idempotent plan güncellemesi.
- [ ] Sahip: Atanmadı — FLOW.md Premium yetki ve limitlerini uygulama.
- [ ] Sahip: Atanmadı — FLOW.md sırasıyla harici kaynak bağlantıları ve veri normalizasyonu.
- [ ] Sahip: Atanmadı — Derin analiz ve karşılaştırmalı öneriler.

Kalite kapısı: ödeme/webhook, plan geçişi, kota ve bağlantı yetkilendirme testleri başarılı. Ödeme entegrasyonu henüz uygulanmamıştır.

## Açık kararlar

Aşağıdakiler sonraki aşamanın açık kararlarıdır. Bugünkü yerel akışın kesinleşen seçimleri FLOW.md ve karar günlüğündedir.

- İş orkestrasyonu: Firebase Functions yanında Cloud Tasks gerekli mi?
- Python işçisi için Cloud Run Job mu, service mi; örnek işlerin süresi, retry ve maliyetine göre seçim.
- Parser/OCR: Docling adayının örnek belgelerde doğrulanması; kalite eşikleri ve analiz başına süre/token/maliyet bütçeleri.
- Beta erişimi: davetli mi, açık mı?
- Authentication: e-posta/parolaya ek Google girişi ne zaman gerekli?
- Ortamlar: ayrı dev/prod ve europe-west1 varsayımının gerçek veri/gizlilik gereksinimleriyle doğrulanması.
- Veri modeli: UID modelinden workspaceId tabanlı ekip desteğine geçiş zamanı.
- PDF: MVP içinde mi, sonraki milestone'da mı?
- Saklama: kullanıcı silene kadar tutma önerisi yerine süre, silme ve yedek politikası birlikte belirlenmeli.
- Dosya boyutu: FLOW.md geçici belge sınırlarının gerçek yük testleriyle güncellenmesi.
- Hedef müşteri profilleri: doğrulanana kadar işletme-genel yaklaşım.

## Açık riskler

- Çok sayıda format parser bakımını ve güvenlik yüzeyini büyütür.
- Saklama/bölge seçimleri gizlilik, maliyet ve operasyonu etkiler; uygulanmadan kararlaştırılmalıdır.
- AI maliyeti, model erişimi ve şema güvenilirliği gerçek testlerle ölçülmelidir.
- Kota/webhook tekrarları çift ücret veya tüketim doğurmamalıdır.
- Firebase CLI geliştirme bağımlılıklarında 7 orta önem uyarısı kaldı; üretim bağımlılık denetimleri temiz. Uyumsuz ana sürümler zorlanmadı.
- Yerel testler bulut IAM/App Check, kalıcı kuyruk ve gerçek veri operasyonunun hazır olduğunu göstermez.
- Firestore istemci paketi 500 kB build uyarısı veriyor; sonraki performans bütçesi çalışmasında küçültülmeli.

## Karar günlüğü

- 2026-10-10 — Furkan'ın onayıyla [FLOW.md hedef mimarisi](FLOW.md#kabul-edilen-hedef-mimari--2026-10-10) kabul edildi: dosya türüne göre ayrıştırma/görsel okuma, Python işçisiyle hesaplama, kaynaklı LLM yorumlama ve React/ECharts ile doğrulanmış grafik sunumu. Mevcut TypeScript hazırlama hattı korunur; bu karar uygulama teslimatı değildir. Cloud Run job/service, parser/OCR ve kalite bütçeleri örnek seti değerlendirmesinde kesinleştirilir.
- 2026-09-18 — Tarık/Codex teslimatında destek kapsamı gerçekten ayrıştırılan CSV/TSV/XLSX, PDF/DOCX/TXT/Markdown, PPTX, JSON ve PNG/JPEG/WebP ile sınırlandı. Ortak sürümlü belge modeli, server-only sıkıştırılmış türetilmiş içerik ve kaynak özeti mevcut hazırlama akışına bağlandı. OCR, görsel anlamlandırma, Gemini, tavsiye ve grafik üretimi sonraki M3/M4 işidir.
- 2026-09-11 — Tarık'ın karar yetkisiyle bugünkü işler Tarık/Codex'e aittir; Furkan'a yeni iş atanmadı. Yerel emülatör, e-posta/parola, UID izolasyonu, TypeScript Functions ve deterministik tablo raporu prototipi uygulandı. Bu prototip daha sonra genel belge hazırlama hattıyla değiştirildi. Kota, geçici sınırlar ve silme davranışı FLOW.md'dedir; AI, gerçek bulut ve ödeme kapsam dışıdır.
- 2026-09-07 — Tarık'ın onayıyla PR incelemesindeki ürün düzeltmeleri kabul edildi; plan limitleri FLOW.md'de merkezileştirildi, ödeme işi M6'da güncellendi, müşteri segmenti kısıtı kaldırıldı ve ortak değerlendirme gerektiren seçimler açık kararlara taşındı.
- 2026-09-09 — Premium girişinin ödeme entegrasyonuna kadar bilgilendirme göstermesi ve uygulama içi sekmelerin tarayıcı geçmişinde tek çalışma alanı adımı olarak tutulması kabul edildi.
- 2026-09-14 — Günlük geliştirmede kişisel branch'lerden doğrulama sonrası doğrudan main'e push edilmesi; Tarık ve Furkan ayrı kod alanlarında paralel ilerlediğinde veya açıkça istendiğinde PR kullanılması kabul edildi.
