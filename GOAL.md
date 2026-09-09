# Incagen — Yaşayan Yol Haritası

Ürün ve sistem davranışı [FLOW.md](FLOW.md) içindedir. Bu belge görevleri, sahipleri, kalite kapılarını ve açık kararları takip eder.

Durumlar: [ ] başlanmadı, [~] devam ediyor, [x] doğrulandı, [!] engelli.
İşe başlamadan sahibi Tarık veya Furkan olarak atanır.

## Aktif milestone: M0 — Temel düzen ve kalite altyapısı

Durum: [~]

- [x] Sahip: Tarık — React/TypeScript tabanı, animasyonlu logo, responsive giriş ve tema.
- [x] Sahip: Furkan — İlk ürün/AI akışı, proje hafızası ve favicon.
- [x] Sahip: Tarık — Çoklu dosya seçimi ve bileşen odaklı stil düzeni.
- [x] Sahip: Tarık — Ortak roadmap ve belge sorumlulukları.
- [x] Sahip: Tarık — PR #2 inceleme düzeltmeleri: çoğul arayüz, kararların ayrıştırılması, sade belgeler ve temiz branch geçmişi.
  Kabul: lint/build/diff kontrolü temiz; çoklu seçim ve iki tema kontrol edilmiş; PR yalnız ilgili değişiklikleri içeriyor.
- [~] Sahip: Furkan — Router ve korumalı uygulama kabuğu.
- [ ] Sahip: Atanmadı — Türkçe kaynaklarla i18n temeli.
- [~] Sahip: Furkan — Vitest, React Testing Library ve Playwright test altyapısı.
- [~] Sahip: Furkan — CI build/lint/test kalite kapıları.
- [ ] Sahip: Atanmadı — Ortam/bölge kararı sonrası Firebase ortamları ve güvenli environment şablonu.

Kapanış: görevler incelenmiş; CI kontrolleri başarılı; repoda sır veya müşteri verisi yok.

## M1 — Kimlik ve uygulama kabuğu

- [ ] Sahip: Atanmadı — Giriş yöntemleri kararı sonrası Firebase Authentication ve oturum yönetimi.
- [ ] Sahip: Atanmadı — İşletme bilgileri ve analiz hedefini alan onboarding.
- [ ] Sahip: Atanmadı — Yeni analiz, sonuç, geçmiş ve ayarlar rotaları.
- [ ] Sahip: Atanmadı — Kullanıcı izolasyonu; ekip veri modeli kararı sonrası şema.

Kalite kapısı: oturum yenileme, çıkış, korumalı rotalar ve yetkisiz erişim testleri başarılı.

## M2 — Dosya yükleme ve hazırlama

- [~] Sahip: Furkan — FLOW.md formatları için istemci doğrulaması ve seçim yönetimi; backend normalizasyonu sonraki adımdır.
- [ ] Sahip: Atanmadı — FLOW.md plan limitlerini backend'de uygula; boyut ve kota sıfırlama kararlarını önce tamamla.
- [ ] Sahip: Atanmadı — Storage yükleme, ilerleme, iptal ve yeniden deneme.
- [ ] Sahip: Atanmadı — Bozuk/parolalı/zararlı dosya kontrolleri ve kaynak referansları.
- [ ] Sahip: Atanmadı — Kısmi hata görünümü ve geçerli dosyalarla devam onayı.

Kalite kapısı: format fixture'ları, kota sınırları, yetkilendirme ve kısmi hata testleri başarılı.

## M3 — AI analiz hattı

- [ ] Sahip: Atanmadı — Servis seçimi sonrası arka plan iş yönetimi.
- [ ] Sahip: Atanmadı — Uygunluk kontrolü ve FLOW.md ana model yapılandırması.
- [ ] Sahip: Atanmadı — Sürümlü JSON Schema, kaynak ve sayısal metrik doğrulama.
- [ ] Sahip: Atanmadı — Sınırlı retry, idempotent kota tüketimi ve platform hatasında iade.

Kalite kapısı: şema, hata/retry, kota ve kullanıcı izolasyonu entegrasyon testleri başarılı.

## M4 — Sonuçlar ve geçmiş

- [ ] Sahip: Atanmadı — shadcn/ui grafik, KPI, tablo ve öneri ekranları.
- [ ] Sahip: Atanmadı — Kaynak referansı, güven düzeyi ve çıkarım etiketleri.
- [ ] Sahip: Atanmadı — Firestore geçmişini listeleme ve filtreleme.
- [ ] Sahip: Atanmadı — Saklama/silme kararı sonrası ilişkili verilerin temizlenmesi.
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

Aşağıdakiler öneridir, kesin mimari veya tamamlanmış özellik değildir. İlgili işe başlamadan ekip kararı kaydedilir.

- İş orkestrasyonu: Firebase Functions yanında Cloud Tasks gerekli mi?
- Uzun dosya/AI işleri: Python Cloud Run mı, başka bir servis mi?
- Beta erişimi: davetli mi, açık mı?
- Authentication: Google ve e-posta/parola seçeneklerinden hangileri?
- Ortamlar ve servis bölgesi: ayrı dev/prod projeleri ve Avrupa bölgesi önerileri.
- Veri modeli: tek kullanıcı modeli ve gelecekte workspaceId tabanlı ekip desteği.
- PDF: MVP içinde mi, sonraki milestone'da mı?
- Saklama: kullanıcı silene kadar tutma önerisi yerine süre, silme ve yedek politikası birlikte belirlenmeli.
- Dosya boyutu: geliştirme/test sonuçlarına göre sınırlar.
- Günlük kota: saat dilimi, sıfırlama anı ve devam eden işlere etkisi.
- Hedef müşteri profilleri: doğrulanana kadar işletme-genel yaklaşım.

## Açık riskler

- Çok sayıda format parser bakımını ve güvenlik yüzeyini büyütür.
- Saklama/bölge seçimleri gizlilik, maliyet ve operasyonu etkiler; uygulanmadan kararlaştırılmalıdır.
- AI maliyeti, model erişimi ve şema güvenilirliği gerçek testlerle ölçülmelidir.
- Kota/webhook tekrarları çift ücret veya tüketim doğurmamalıdır.

## Karar günlüğü

- 2026-09-07 — Tarık'ın onayıyla PR incelemesindeki ürün düzeltmeleri kabul edildi; plan limitleri FLOW.md'de merkezileştirildi, ödeme işi M6'da güncellendi, müşteri segmenti kısıtı kaldırıldı ve ortak değerlendirme gerektiren seçimler açık kararlara taşındı.
