# Incagen Hedefleri ve Yaşayan Yol Haritası

Bu dosya Incagen'in uzun vadeli hedeflerini, aktif milestone'unu, görev sahiplerini ve kalite kapılarını takip eden ortak çalışma belgesidir. Ürün ve sistem akışının teknik ayrıntıları `FLOW.md`, kalıcı bağlam `MEMORY.md`, bağlayıcı geliştirme kuralları `RULES.md` içindedir.

## Durum işaretleri

- `[ ]` Başlanmadı
- `[~]` Devam ediyor
- `[x]` Tamamlandı ve doğrulandı
- `[!]` Engelli; nedeni ve ihtiyaç duyulan karar yazılmalı

Bir iş `[~]` durumuna alınmadan önce `Sahip` alanı Tarık veya Furkan olarak doldurulur. Her `main` birleşiminde tamamlanan işler, aktif milestone, riskler ve kararlar güncellenir.

## Ürün hedefi

Incagen; işletme dosyalarını ve bağlı veri kaynaklarını güvenli biçimde işleyerek KOBİ yöneticilerine kanıta dayalı KPI'lar, grafikler, tablolar ve uygulanabilir büyüme önerileri sunar.

İlk işlevsel müşteri profili KOBİ yöneticisidir. E-ticaret ve ajans/danışman profilleri onboarding içinde görünür fakat “Yakında” durumunda pasiftir.

## Başarı ölçütleri

- Davetli bir KOBİ kullanıcısı hesap açıp dosya yükleme, analiz, web raporu, PDF ve geçmiş akışını yardım almadan tamamlayabilir.
- Her önemli bulgu kaynak referansı ve `low`, `medium` veya `high` güven düzeyi taşır.
- Kullanıcı sekmeden ayrılsa bile arka plan işi devam eder ve durum geçmiş ekranından izlenebilir.
- Kullanıcı bir analizi sildiğinde kaynak dosyalar, türetilmiş veriler, sonuç ve PDF kalıcı olarak silinir.
- Kullanıcılar yalnız kendi çalışma alanlarındaki verilere erişebilir.
- Build, lint, otomatik testler ve güvenlik kuralları ilgili milestone kapanmadan başarılı olur.

## Aktif milestone

### M0 — Temel düzen ve kalite altyapısı

Durum: `[~]`  
Amaç: Prototipi güvenli, test edilebilir ve ekipçe paralel geliştirilebilir ürün temeline taşımak.

- [x] Sahip: Tarık — React, TypeScript, Vite, Tailwind ve shadcn/ui tabanını oluştur.
- [x] Sahip: Tarık — Animasyonlu logo, açık/koyu tema ve responsive giriş ekranını oluştur.
- [x] Sahip: Furkan — Ürün/AI akışını, proje hafızasını ve favicon'u ekle.
- [x] Sahip: Tarık — Geniş dosya listesini çoklu seçimle uyumlu hale getir.
- [x] Sahip: Tarık — Stil sahipliği ve global CSS çakışma kurallarını tanımla.
- [x] Sahip: Tarık — Yaşayan roadmap ve doküman sorumluluklarını projeye ekle.
- [ ] Sahip: Atanmadı — React Router ile herkese açık ve korumalı uygulama kabuğunu kur.
- [ ] Sahip: Atanmadı — Türkçe kaynaklarla başlayacak i18n altyapısını kur.
- [ ] Sahip: Atanmadı — Vitest, React Testing Library ve Playwright test tabanını kur.
- [ ] Sahip: Atanmadı — CI üzerinde build, lint ve test kalite kapılarını çalıştır.
- [ ] Sahip: Atanmadı — Avrupa bölgesinde ayrı Firebase dev/prod projelerini ve güvenli environment şablonlarını hazırla.

Kapanış kriterleri:

- Her görev sahibine atanmış ve pull request üzerinden incelenmiş olmalı.
- CI build, lint ve başlangıç testlerini hatasız çalıştırmalı.
- Repoda sır, gerçek müşteri verisi veya ortama özel kimlik bilgisi bulunmamalı.

## Sonraki milestone'lar

### M1 — Kimlik, onboarding ve uygulama kabuğu

- [ ] Sahip: Atanmadı — Firebase Authentication ile Google ve e-posta/parola girişini ekle.
- [ ] Sahip: Atanmadı — Davet kodu doğrulaması ve oturum yönetimini ekle.
- [ ] Sahip: Atanmadı — KOBİ profilini aktif; e-ticaret ve ajans profillerini “Yakında” olarak göster.
- [ ] Sahip: Atanmadı — `/app/new`, `/app/analyses/:id`, `/app/history` ve `/app/settings` korumalı rotalarını oluştur.
- [ ] Sahip: Atanmadı — Tek kullanıcıyla çalışan fakat `workspaceId` üzerinden ekip yapısına hazır veri modelini kur.

Kalite kapısı: korumalı rotalar, oturum yenileme, çıkış, davet ve kullanıcı izolasyonu testleri başarılı olmalı.

### M2 — Çoklu dosya yükleme ve normalizasyon

- [ ] Sahip: Atanmadı — CSV, TSV, XLS/XLSX, ODS, PDF, DOC/DOCX, TXT, RTF, Markdown, PPT/PPTX, JSON, XML ve görseller için doğrulama uygula.
- [ ] Sahip: Atanmadı — Beta limitlerini uygula: ayda 5 analiz, analiz başına 5 dosya, dosya başına 25 MB.
- [ ] Sahip: Atanmadı — Firebase Storage resumable upload, dosya bazlı ilerleme, iptal ve retry ekle.
- [ ] Sahip: Atanmadı — MIME, uzantı, checksum, bozuk/parolalı dosya ve zararlı içerik kontrollerini ekle.
- [ ] Sahip: Atanmadı — Python Cloud Run worker ile dosyaları ortak metin, tablo, görsel ve kaynak referansı modeline dönüştür.
- [ ] Sahip: Atanmadı — Hatalı dosyayı ayrı göster; kullanıcı onayıyla geçerli dosyalarla devam et.

Kalite kapısı: her format için fixture testleri, kota sınırları ve kısmi yükleme hata senaryoları başarılı olmalı.

### M3 — AI analiz hattı

- [ ] Sahip: Atanmadı — Firebase Functions, Cloud Tasks ve Python Cloud Run iş orkestrasyonunu kur.
- [ ] Sahip: Atanmadı — Deterministik kontrollerden sonra yapılandırılabilir Gemini Flash-Lite semantik uygunluk kapısını ekle.
- [ ] Sahip: Atanmadı — Ana analizi `gemini-3.8-flash` ile sürümlenmiş JSON Schema çıktısına bağla.
- [ ] Sahip: Atanmadı — Free için `medium`, Premium için `high` düşünme seviyesi uygula.
- [ ] Sahip: Atanmadı — Şema üretimini en fazla iki kez kontrollü tekrar et; KPI ve oranları backend'de doğrula.
- [ ] Sahip: Atanmadı — Kota tüketimini atomik ve idempotent yap; platform hatasında kotayı iade et.

İş durumları: `draft`, `uploading`, `queued`, `validating`, `normalizing`, `analyzing`, `rendering`, `completed`, `needs_attention`, `failed`, `deleted`.

Kalite kapısı: şema, kaynak referansı, retry, idempotency, kota ve kullanıcı izolasyonu entegrasyon testleri başarılı olmalı.

### M4 — Web raporu, PDF ve geçmiş

- [ ] Sahip: Atanmadı — Shadcn/ui Chart ve Recharts ile KPI, grafik ve tablo raporunu oluştur.
- [ ] Sahip: Atanmadı — Bulgu ve önerilerde kaynak referansı ile güven düzeyini göster.
- [ ] Sahip: Atanmadı — Kanıtsız yorumları kesin bilgi yerine “çıkarım” olarak etiketle.
- [ ] Sahip: Atanmadı — Aynı doğrulanmış JSON'dan Cloud Run üzerinde markalı PDF üret.
- [ ] Sahip: Atanmadı — Geçmiş analizleri tarih, hedef, durum ve işletme adına göre listele ve filtrele.
- [ ] Sahip: Atanmadı — Analiz ve hesap için tam cascade silme akışını uygula.

Kalite kapısı: web ve PDF değerleri aynı olmalı; kaynak bağlantıları çalışmalı; silinen verilere tekrar erişilememeli.

### M5 — Davetli beta ve operasyon

- [ ] Sahip: Atanmadı — Davet, kullanıcı durumu, kota, başarısız iş ve güvenli retry içeren basit admin ekranını oluştur.
- [ ] Sahip: Atanmadı — Firebase App Check, Storage/Firestore Security Rules ve hız sınırlamayı etkinleştir.
- [ ] Sahip: Atanmadı — Hata, job süresi, parser başarısı, model maliyeti ve şema retry oranlarını izle.
- [ ] Sahip: Atanmadı — Maliyet alarmı, yedekleme ve geri yükleme prosedürlerini ekle.
- [ ] Sahip: Atanmadı — Seçilen KOBİ kullanıcılarıyla davetli beta kabul testini yürüt.

Kalite kapısı: güvenlik emülatör testleri, erişim izolasyonu, silme ve uçtan uca beta senaryosu başarılı olmalı.

### M6 — Premium ve entegrasyonlar

- [ ] Sahip: Atanmadı — iyzico abonelik, imzalı webhook ve idempotent plan güncelleme akışını kur.
- [ ] Sahip: Atanmadı — Premium limitlerini uygula: ayda 30 analiz, analiz başına 20 dosya, dosya başına 50 MB.
- [ ] Sahip: Atanmadı — Google Analytics OAuth ve veri normalizasyonunu ekle.
- [ ] Sahip: Atanmadı — Google Analytics tamamlandıktan sonra Microsoft Clarity entegrasyonunu ekle.
- [ ] Sahip: Atanmadı — Premium raporlarda daha derin analiz, karşılaştırma ve önerileri etkinleştir.

Free raporun güvenilir web ve PDF çıktısı korunur; Premium değeri yapay içerik kilitlerinden değil derinlik, kota ve entegrasyonlardan gelir.

Kalite kapısı: ödeme webhook'ları, plan yetkilendirmesi, kota geçişi ve OAuth entegrasyon testleri başarılı olmalı.

## Sabit kararlar

- İlk beta davetli KOBİ kullanıcılarıyla yürütülür.
- Ödeme MVP sonrasında iyzico ile açılır.
- Arka plan analizi için e-posta gönderilmez; durum uygulama ve geçmiş ekranından izlenir.
- Kaynak dosyalar ve sonuçlar kullanıcı silene kadar saklanır.
- Arayüz Türkçe başlar ve i18n ile İngilizceye hazır tutulur.
- Backend Firebase Auth, Firestore, Storage, Functions ve Hosting kullanır; uzun dosya/AI işleri Python Cloud Run'da çalışır.
- Dev ve prod ortamları ayrı, servis bölgeleri Avrupa'dadır.
- AI ve harici servis anahtarları istemciye verilmez.
- Model adları yapılandırmadan yönetilir ve ilgili milestone başında güncelliği doğrulanır.

## Açık riskler

- Geniş Office dosya desteği parser bakım maliyetini artırabilir; format fixture'ları kalite kapısından çıkarılamaz.
- Kullanıcı silene kadar saklama depolama maliyetini ve gizlilik sorumluluğunu artırır; açık silme kontrolleri zorunludur.
- AI maliyeti gerçek beta kullanımı görülmeden kesin tahmin edilemez; kullanım ve token ölçümü Premium öncesi tamamlanmalıdır.
- Model veya fiyat değişiklikleri sabit kod yerine yapılandırma ve sürümlü şema gerektirir.

## Karar günlüğü

- 2026-09-05 — KOBİ profili ilk işlevsel müşteri olarak seçildi; diğer profiller onboarding içinde pasif kalacak.
- 2026-09-05 — MVP kapsamı hesap, çoklu yükleme, arka plan analizi, web/PDF raporu ve geçmiş olarak belirlendi.
- 2026-09-05 — Geniş dosya listesi, Firebase + Python Cloud Run ve Avrupa dev/prod ortamları seçildi.
- 2026-09-05 — Davetli beta, iyzico, Google Analytics önceliği ve görev bazlı ekip sahipliği kararlaştırıldı.
