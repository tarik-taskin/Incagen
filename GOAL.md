# Incagen — Yaşayan Yol Haritası

Ürün ve sistem davranışı [FLOW.md](FLOW.md) içindedir. Bu belge görevleri, sahipleri, kalite kapılarını ve açık kararları takip eder.

Durumlar: [ ] başlanmadı, [~] devam ediyor, [x] doğrulandı, [!] engelli.
İşe başlamadan sahibi Tarık veya Furkan olarak atanır.

## Aktif milestone: M0 — Temel düzen ve kalite altyapısı

### 2026-09-28 — Furkan / Codex: Netlify'da tüm uygulama ekranları

- [x] Sahip: Furkan — Auth-only yayında giriş sonrası tam uygulama navigasyonunu ve ekranlarını göster; Firebase tarafında yalnız Auth etkin kalsın.

Kabul: Girişten sonra Yeni analiz, Geçmiş, Ayarlar ve Plan ekranları yerel uygulamayla aynı metinler ve rotalarla canlı URL'de gezilebilir olmalı; `npm run dev` emülatörlü tam akışı korunmalı. Canlıda Firestore/Storage/Functions hazır olmadığından bunlara istek gönderilmemeli; belge hazırlama ve hesap silme denenince durum açıklanmalı, geçmiş de veri varmış gibi gösterilmemeli. Kayıt, giriş, çıkış, şifre yenileme, doğrudan rota yenileme, masaüstü/mobil görünüm ve temel kontroller doğrulanmalı. Gerçek backend dağıtımı ayrı engelli iş olarak kalır; PR veya `main` push'u yapılmaz.

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

Kabul: localhost emülatör akışı korunmalı; canlı frontend yalnız açıkça verilen Firebase web yapılandırmasını kullanmalı; Auth, Firestore, Storage ve Functions aynı gerçek projeye bağlanmalı; Netlify SPA rotaları yenilemede çalışmalı; giriş, kayıt, çıkış, parola sıfırlama ve hesap silme URL üzerinde doğrulanmalı. Hazırlık `furkan` dalında commitlenebilir; canlı doğrulama tamamlanmadan `main`e push yapılmayacak ve PR açılmayacak.

Durum (2026-09-28): Furkan'ın `incagen-eeef4` Firebase projesine erişimi doğrulandı. Web App yapılandırmasındaki yedi `VITE_FIREBASE_*` değeri Netlify sitesine eklendi ve panelde doğrulandı; gerçek değerler repoya yazılmadı. Firebase e-posta/parola sağlayıcısı ve `incagen.netlify.app` yetkili alan adı etkin; yalnız Auth önizlemesi canlıda yayınlandı ve doğrulandı. Firestore varsayılan veritabanı `eur3` konumunda hazır, ancak canlı kurallar henüz varsayılan `allow read, write: if false` durumunda. Storage konsolu Blaze gereksinimi gösteriyor; varsayılan bucket ve dört Cloud Function henüz dağıtılmadı. Faturalandırma açıldıktan sonra Storage bucket'ı oluşturulup repo kuralları/Functions dağıtılacak, ardından tam kullanıcı akışı canlıda doğrulanacak.

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

- [ ] Sahip: Atanmadı — Servis seçimi sonrası arka plan iş yönetimi.
- [ ] Sahip: Atanmadı — Uygunluk kontrolü ve FLOW.md ana model yapılandırması.
- [ ] Sahip: Atanmadı — Sürümlü JSON Schema, kaynak ve sayısal metrik doğrulama.
- [x] Sahip: Tarık — Hazırlama hattında idempotent kota, hata iadesi ve süre aşımı sonrası kullanıcı tetiklemeli retry.
- [ ] Sahip: Atanmadı — AI için kalıcı kuyruk ve sınırlı otomatik retry.

Kalite kapısı: şema, hata/retry, kota ve kullanıcı izolasyonu entegrasyon testleri başarılı.

## M4 — Sonuçlar ve geçmiş

- [x] Sahip: Furkan — Genel belgeler için doğrulanmış kaynak ve hazırlık özeti; AI bulgu ve grafikleri sonraki aşamaya bırakıldı.
- [ ] Sahip: Atanmadı — AI bulgu ve öneri ekranları.
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
- Uzun dosya/AI işleri: Python Cloud Run mı, başka bir servis mi?
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

- 2026-09-18 — Tarık/Codex teslimatında destek kapsamı gerçekten ayrıştırılan CSV/TSV/XLSX, PDF/DOCX/TXT/Markdown, PPTX, JSON ve PNG/JPEG/WebP ile sınırlandı. Ortak sürümlü belge modeli, server-only sıkıştırılmış türetilmiş içerik ve kaynak özeti mevcut hazırlama akışına bağlandı. OCR, görsel anlamlandırma, Gemini, tavsiye ve grafik üretimi sonraki M3/M4 işidir.
- 2026-09-11 — Tarık'ın karar yetkisiyle bugünkü işler Tarık/Codex'e aittir; Furkan'a yeni iş atanmadı. Yerel emülatör, e-posta/parola, UID izolasyonu, TypeScript Functions ve deterministik tablo raporu prototipi uygulandı. Bu prototip daha sonra genel belge hazırlama hattıyla değiştirildi. Kota, geçici sınırlar ve silme davranışı FLOW.md'dedir; AI, gerçek bulut ve ödeme kapsam dışıdır.
- 2026-09-07 — Tarık'ın onayıyla PR incelemesindeki ürün düzeltmeleri kabul edildi; plan limitleri FLOW.md'de merkezileştirildi, ödeme işi M6'da güncellendi, müşteri segmenti kısıtı kaldırıldı ve ortak değerlendirme gerektiren seçimler açık kararlara taşındı.
- 2026-09-09 — Premium girişinin ödeme entegrasyonuna kadar bilgilendirme göstermesi ve uygulama içi sekmelerin tarayıcı geçmişinde tek çalışma alanı adımı olarak tutulması kabul edildi.
- 2026-09-14 — Günlük geliştirmede kişisel branch'lerden doğrulama sonrası doğrudan main'e push edilmesi; Tarık ve Furkan ayrı kod alanlarında paralel ilerlediğinde veya açıkça istendiğinde PR kullanılması kabul edildi.
