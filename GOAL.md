# Incagen — Yaşayan Yol Haritası

Ürün ve sistem davranışı [FLOW.md](FLOW.md) içindedir. Bu belge görevleri, sahipleri, kalite kapılarını ve açık kararları takip eder.

Durumlar: [ ] başlanmadı, [~] devam ediyor, [x] doğrulandı, [!] engelli.
İşe başlamadan sahibi Tarık veya Furkan olarak atanır.

## Aktif milestone: M0 — Temel düzen ve kalite altyapısı

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

- [x] Sahip: Furkan — Tarık'ın yerel CSV rapor hattını güncel main ve Furkan branch'iyle birleştirip doğrula.

Kabul: Tarık'ın sekiz commit'i ve yeni doğrudan main çalışma düzeni korunmalı; lint, frontend/backend build ve birim testleri geçmeli; local/remote main ile local/remote Furkan branch'leri aynı commit'te olmalı.

Doğrulama: lint, frontend/backend build, 22 birim/bileşen testi, 2 emülatör entegrasyon senaryosu ve 6 masaüstü/mobil tarayıcı testi geçti.

### 2026-09-11 — Tarık / Codex: CSV'den gerçek rapora

- [x] Sahip: Tarık — Uzantı güvenliği, kalıcı oturum içi dosya seçimi ve regresyon testleri.
- [x] Sahip: Tarık — Yerel Firebase Auth/Firestore/Storage/Functions ve e-posta/parola oturumu.
- [x] Sahip: Tarık — CSV eşleştirme, backend hesaplama, kota ve idempotent analiz akışı.
- [x] Sahip: Tarık — Sonuç rotası, grafikler, gerçek geçmiş ve kaynaklarla birlikte silme.
- [x] Sahip: Tarık — Türkçe sözlük, emülatör izolasyon testleri, tarayıcı testleri ve kurulum belgeleri.

Kabul: sentetik CSV ile kayıt → yükleme → hesaplanan rapor → geçmiş → silme akışı ve iki kullanıcı izolasyonu doğrulanmalı. AI yorumu ve bulut yayını kapsam dışıdır.

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
- [x] Sahip: Tarık — CSV için Free kota, dosya/satır/boyut sınırları ve İstanbul takvim günü kontrolü.
- [x] Sahip: Tarık — Yerel Storage yükleme, ilerleme, iptal ve aynı oturumda yeniden deneme.
- [x] Sahip: Tarık — Açık CSV eşleştirmesi, hatalı kayıt reddi ve kaynak özeti.
- [ ] Sahip: Atanmadı — Bozuk/parolalı/zararlı dosya kontrolleri ve kaynak referansları.
- [ ] Sahip: Atanmadı — Kısmi hata görünümü ve geçerli dosyalarla devam onayı.

Kalite kapısı: format fixture'ları, kota sınırları, yetkilendirme ve kısmi hata testleri başarılı.

## M3 — AI analiz hattı

- [ ] Sahip: Atanmadı — Servis seçimi sonrası arka plan iş yönetimi.
- [ ] Sahip: Atanmadı — Uygunluk kontrolü ve FLOW.md ana model yapılandırması.
- [ ] Sahip: Atanmadı — Sürümlü JSON Schema, kaynak ve sayısal metrik doğrulama.
- [x] Sahip: Tarık — CSV hattında idempotent kota, hata iadesi ve süre aşımı sonrası kullanıcı tetiklemeli retry.
- [ ] Sahip: Atanmadı — AI için kalıcı kuyruk ve sınırlı otomatik retry.

Kalite kapısı: şema, hata/retry, kota ve kullanıcı izolasyonu entegrasyon testleri başarılı.

## M4 — Sonuçlar ve geçmiş

- [x] Sahip: Tarık — CSV sonucu için KPI, Recharts grafikleri ve erişilebilir tablo karşılıkları.
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
- Dosya boyutu: FLOW.md geçici CSV sınırlarının gerçek yük testleriyle güncellenmesi.
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

- 2026-09-11 — Tarık'ın karar yetkisiyle bugünkü işler Tarık/Codex'e aittir; Furkan'a yeni iş atanmadı. Yerel emülatör, e-posta/parola, UID izolasyonu, TypeScript Functions ve deterministik CSV raporu uygulandı. Kota, geçici sınırlar ve silme davranışı FLOW.md'dedir. AI, gerçek bulut, ödeme ve diğer formatların işlenmesi kapsam dışıdır.
- 2026-09-07 — Tarık'ın onayıyla PR incelemesindeki ürün düzeltmeleri kabul edildi; plan limitleri FLOW.md'de merkezileştirildi, ödeme işi M6'da güncellendi, müşteri segmenti kısıtı kaldırıldı ve ortak değerlendirme gerektiren seçimler açık kararlara taşındı.
- 2026-09-09 — Premium girişinin ödeme entegrasyonuna kadar bilgilendirme göstermesi ve uygulama içi sekmelerin tarayıcı geçmişinde tek çalışma alanı adımı olarak tutulması kabul edildi.
- 2026-09-14 — Günlük geliştirmede kişisel branch'lerden doğrulama sonrası doğrudan main'e push edilmesi; Tarık ve Furkan ayrı kod alanlarında paralel ilerlediğinde veya açıkça istendiğinde PR kullanılması kabul edildi.
