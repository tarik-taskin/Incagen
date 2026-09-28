# Incagen — Ürün ve Sistem Akışı

## Çalışan yerel dikey akış

E-posta/parola kaydı → korumalı çalışma alanı → farklı iş belgelerini seçme → yerel Storage yüklemesi → Functions içerik doğrulaması ve ayrıştırma → kaynak konumlu hazırlık özeti → geçmişten açma veya kaynaklarıyla silme.

Tam analiz akışı yalnız `demo-incagen` Firebase emülatörleriyle çalışır; gerçek buluta fallback yoktur. Yerel akışta yalnız sentetik veriler kullanılmalıdır. Backend desteklenen belgelerin içeriğini deterministik olarak ayrıştırır; AI yorumu henüz eklenmedi.

Canlı Netlify derlemesi aynı uygulama ekranlarını ve rotalarını gösterir; gerçek Firebase e-posta/parola kaydı, giriş, çıkış ve şifre yenileme bağlantısı çalışır. Şimdilik yalnız Auth servisi etkin olduğundan belge hazırlama ve hesap silme sunucuya gönderilmez; geçmiş verisi okunmaz ve ekranda durum açıklanır. Tam bulut akışı için Storage, Cloud Functions ve güvenlik kuralları ayrıca dağıtılıp doğrulanmalıdır.

## Free ve Premium

Ürün limitlerinin belge kaynağı bu tablodur. Frontend plan bilgileri merkezi plan kurallarında, backend uygulanmış Free sınırları ortak analiz sözleşmesinde tutulur; değişiklikte üçü birlikte doğrulanır.

| Özellik | Free | Premium (planlanan) |
|---|---|---|
| Günlük analiz | 10 | 30 |
| Analiz başına dosya | 10 | 30 |
| Dosya başına boyut | 5 MB | 5 MB |
| Analiz başına toplam boyut | 30 MB | 60 MB |
| Belge formatları | Tablo, belge, sunum, veri ve görsel | Tablo, belge, sunum, veri ve görsel |
| AI derinliği | Medium | High |
| Harici kaynak | Yok | Önce Google Analytics, sonra Microsoft Clarity |

Premium ödeme ve yetkilendirmeleri henüz uygulanmadı. Mevcut oturumlar Free kabul edilir. Günlük kota sunucunun `Europe/Istanbul` takvim gününe göredir; işlem başında transaction ile rezerve edilir. Başarısız işlemde iade edilir; tamamlanmış analizi silmek kotayı geri getirmez. Aynı istek ve tekrarlanan çalıştırmalar çift kota tüketmez.

Uygulamadaki Plan sekmesi aktif Free sınırlarını ve Premium için planlanan kapasiteyi karşılaştırır. Premium ödeme, AI derinliği ve harici veri bağlantıları etkin özellik gibi sunulmaz.

## Belge hazırlama davranışı

- Free ve Premium aynı gerçek format kapsamını kullanır: CSV/TSV/XLSX, PDF/DOCX/TXT/Markdown, PPTX, JSON ve PNG/JPEG/WebP.
- Eski DOC/XLS/PPT, ODS, RTF, XML, GIF, SVG ve HEIC/HEIF güvenli dönüştürme hattı eklenene kadar kabul edilmez.
- Çalıştırılabilir veya ürün kapsamı dışındaki dosya türleri kabul edilmez. Uzantı kontrolü istemcide ve backend sözleşmesinde aynı listeden uygulanır.
- Geçici geliştirme sınırları iki planda da 5 MB/dosya; analiz toplamı Free için 30 MB, planlanan Premium için 60 MB'dır. Analiz başına adet sınırı Free için 10, Premium için 30'dur. Premium yetkilendirmesi gelene kadar backend yalnız Free sınırını uygular.
- Dosya adı, boyutu ve içerik türü değişmez manifestte tutulur. Storage yalnız manifestte bulunan ve manifestle tam eşleşen kaynağı kabul eder; backend ayrıca gerçek dosya imzasını doğrular.
- Metin ve JSON UTF-8; tablolar satır/sütun; XLSX çalışma sayfası; PDF sayfa; PPTX slayt; görseller boyut konumuyla normalize edilir. DOCX okunabilir metne dönüştürülür.
- Formüller ve makrolar çalıştırılmaz. Parolalı, bozuk, türü uyuşmayan, yol geçişli, aşırı genişleyen veya gömülü çalıştırılabilir nesne taşıyan dosyalar reddedilir.
- Ayrıştırma sınırları: dosya başına 1 milyon metin karakteri, 50.000 tablo satırı, 200 sütun, 500.000 hücre, 50 XLSX sayfası, 250 PDF sayfası/slayt, 2.000 arşiv kaydı ve 40 MB açılmış arşiv boyutu. Görseller en fazla 40 milyon pikseldir.
- Normalize içerik gzip JSON olarak kullanıcı okumasına kapalı `derived/{uid}/analyses/{id}` alanında tutulur. Firestore yalnız hash, gerçek MIME, kategori, konum/karakter sayıları ve uyarıları taşıyan özeti saklar.
- Görseller ve metin katmanı olmayan PDF/sunum sayfaları kaynak konumuyla işaretlenir; OCR ve görsel anlamlandırma sonraki AI aşamasındadır.
- Sonuç ekranında “Belge içerikleri ayrıştırıldı — AI yorumu henüz eklenmedi” ibaresi zorunludur.

## Teknik sözleşme ve veri sahipliği

TypeScript Cloud Functions kullanılır; bugünkü belge hazırlığında Cloud Tasks ve Python Cloud Run yoktur. Gelecekte bulut için ayrı dev/prod ve `europe-west1` varsayılır; kaynaklar henüz oluşturulmadı. Bölge veya saklama değişiklikleri gerçek veri kullanımı öncesinde yeniden değerlendirilir.

- `createAnalysis`: doğrulanmış başlık, işletme ve dosya manifestiyle taslak oluşturur; istemcinin UUID istek kimliği ve içerik fingerprint'i tekrarları tekilleştirir.
- `prepareAnalysis`: kaynak boyutu, içerik türü, imza, arşiv ve parser sınırlarını backend'de doğrular; normalize artefaktı ve hazırlık özetini kaydeder.
- `deleteAnalysis`: silme durumuyla yeni yazmayı kilitler, dosyaları ve raporu siler. İşlem sürerken silme reddedilir; yarım kalan silme tekrar denenebilir.
- `deleteAccount`: son 5 dakika içinde parola ile yeniden doğrulanmış ve açık onay vermiş kullanıcı için yeni analiz/yükleme yazmasını kilitler; aktif işlem varsa beklemesini ister. Ham ve türetilmiş dosyaları, Firestore kullanıcı alt koleksiyonlarını, ardından Auth hesabını siler. Temizlik başarısızsa Auth hesabı kalır ve yeniden denenebilir.
- Geçmişte tekli silme kartın işlem menüsünden, toplu silme seçim modundan yapılır. Her ikisi de geri alınamaz silme uyarısı ister; toplu işlem kayıtları sırayla siler ve başarısız kalanları yeniden deneme için seçili bırakır.
- Geçmiş özeti ve arama/filtreleme yalnız kullanıcının canlı Firestore listesinden istemcide türetilir; ek kullanıcı verisi veya sorgu açmaz. Arama başlık, işletme ve hazırlanmış kaynak adlarını kapsar. Durum, dönem ve sıralama seçimleri URL'de korunur; toplu “Görünenleri seç” işlemi yalnız o an filtrelenen kayıtları kapsar.
- İstemci taslağı bellektedir. Sayfalar arası geçişte korunur; backend hazırlığı başarıyla tamamlanınca seçili dosyalar, analiz başlığı ve geçici yükleme durumu temizlenirken işletme adı ile son analiz bağlantısı oturumda kalır. Doğrulama/ağ hatası veya iptalde dosya ve başlık yeniden deneme için korunur. Sunucuda kayıt `uploading → processing → completed/failed` durumlarından geçer; silmede geçici `deleting` kullanılır.
- Çalışan iş için 330 saniyelik yeniden deneme koruması vardır; bu eşik 300 saniyelik Function zaman aşımını güvenli payla kapsar. Süre aşımı sonrası açık yeniden deneme eski rezervasyonu düzeltir ve yeni deneme kimliği kullanır; eski iş sonucu yeni işi ezemez. Otomatik kalıcı kuyruk henüz yoktur.
- Sonuçlar `users/{uid}/analyses/{id}`, kota `users/{uid}/quotas/{day}`, ham kaynaklar `users/{uid}/analyses/{id}/{fileId}`, server-only türetilmiş içerikler `derived/{uid}/analyses/{id}` altında tutulur. Silme iki Storage alanını da temizler.
- Kullanıcı yalnız kendi verilerini okuyabilir. Manifest dışı yükleme ve istemcinin rapor/durum/kota yazması yasaktır. Backend yetkiyi oturum token'ından alır.
- İç sayfa geçişlerinde seçilen dosyalar ve yükleme durumu korunur. Çıkışta yükleme iptal edilir ve taslak temizlenir. Sayfa yenilemede yerel dosyalar yeniden seçilmelidir; kaydedilmiş analizler geçmişte kalır.
- Oturumdaki kullanıcı şifre değiştirme isteğini yalnız bağlı e-posta adresi için başlatabilir. Canlı Firebase ortamında bağlantı e-postayla iletilir; mevcut yerel emülatör gerçek e-posta teslim etmez.
- Ayarlar'da Google Analytics ve Microsoft Clarity bağlantıları yalnız pasif arayüzdür; OAuth veya veri senkronizasyonu yoktur.
- Analizler kullanıcı silene kadar tutulur; mevcut emülatör verisi normal durdurmada kalıcı değildir. Gerçek müşteri için saklama/yedek politikası ayrıca onaylanmalıdır.

## Sonraki AI ve entegrasyon aşaması

Kaynak ayrıştırma → deterministik metrikler → düşük maliyetli uygunluk kontrolü → Gemini → sürümlü sonuç şeması ve sayısal doğrulama → kanıtlı bulgu/öneriler akışı planlanmıştır. AI anahtarları yalnız backend'de tutulacaktır.

Proje planındaki ana model `gemini-3.8-flash`; 31 Aralık 2026 sonrası model ve fiyatlar yeniden değerlendirilecek. Model erişimi, düşünme seçenekleri ve kampanya koşulları entegrasyon sırasında doğrulanmalıdır; mevcut kod model çağırmaz ve fiyat garantisi vermez. OCR/görsel anlamlandırma, PDF raporu, Google girişi ve ödeme gelecekteki işlerdir.
