# Incagen

**Veriden karara, tek çalışma alanı.**

Incagen, işletme belgelerini, tablolarını ve müşteri geri bildirimlerini ortak bir çalışma alanında düzenler. Her çalışma belirli bir soruya odaklanır; içerik, geldiği belge ve konum bilgisiyle birlikte hazırlanır. Böylece verinin bağlamı korunur ve çalışmalar sonradan izlenebilir.

[Uygulamayı incele](https://incagen.netlify.app) · [Geliştirici rehberi](docs/DEVELOPMENT.md) · [Ürün akışı](FLOW.md)

## Çalışma alanı

- **Hedefi belli çalışmalar.** Analiz başlığı ve hedefi, aynı konuyla ilgili belgeleri tek bir çerçevede toplar.
- **Kaynağı izlenebilir içerik.** Ayrıştırılan içerik belge kimliği, dosya hash'i ve satır, sayfa veya slayt konumuyla ilişkilendirilir.
- **Düzenli arşiv.** Çalışmalar başlık, kaynak, durum ve dönem üzerinden bulunabilir; seçimle veya tek tek yönetilebilir.
- **Tutarlı deneyim.** Açık/koyu tema, mobil yerleşim, klavye erişimi ve azaltılmış hareket tercihi ortak arayüzün parçasıdır.

## Çalışma akışı

1. **Soruyu belirleyin.** Müşteri geri bildirimleri, dönemsel satışlar veya başka bir iş konusu için çalışmanıza başlık ve hedef verin.
2. **İlgili belgeleri bir araya getirin.** Aynı konuya ait tabloları, metinleri, sunumları ve görselleri seçin.
3. **İçeriği kaynaklarıyla hazırlayın.** Dosyalar doğrulanır, okunabilir bölümlere ayrılır; hazırlık özeti kaynak konumlarını ve işleme uyarılarını korur.
4. **Çalışmanıza geri dönün.** Kaydedilmiş hazırlıkları arşivden açın, kaynaklarını inceleyin ve kayıtlarınızı yönetin.

## Belge kapsamı

| İçerik | Formatlar |
| --- | --- |
| Tablolar | CSV, TSV, XLSX |
| Belgeler ve sunumlar | PDF, DOCX, PPTX |
| Metin ve yapılandırılmış veri | TXT, Markdown, JSON |
| Görseller | PNG, JPEG, WebP |

Dosya türüne göre ayrıştırma kapsamı, içerik sınırları ve plan kuralları [ürün sözleşmesinde](FLOW.md#belge-hazırlama-davranışı) tanımlanır.

## Tasarım ilkeleri

**Kaynak önce gelir.** İçerik hazırlanırken belge ile bağlantısı korunur; eksik veya okunamayan kaynaklar işleme uyarılarıyla görünür kalır.

**Kurallar sunucuda uygulanır.** Dosya kabulü, kota ve erişim yetkisi istemciye bırakılmaz. Kullanıcı kayıtları oturum kimliğine göre ayrılır; tekrarlanan istekler tekilleştirilir.

**Kontrol kullanıcıdadır.** Hazırlama kullanıcı tarafından başlatılır. Taslak iç sayfalarda korunur; kalıcı silme işlemleri açık onay ister.

## Teknik temel

| Katman | Teknolojiler |
| --- | --- |
| Arayüz | React, TypeScript, Vite, React Router |
| Tasarım ve hareket | Tailwind CSS, shadcn/ui, Lucide, Anime.js |
| Backend ve veri | Firebase Auth, Firestore, Storage, TypeScript Cloud Functions |
| Sözleşmeler ve doğrulama | Zod, ESLint, Vitest, Testing Library, Playwright, GitHub Actions |

Kurulum, ortam yapılandırması, kaynak dizinleri ve test komutları [geliştirici rehberinde](docs/DEVELOPMENT.md) bulunur.

## Kalite ve geliştirme

Kalite kontrolleri bileşen davranışını, dosya ayrıştırmayı, kullanıcı izolasyonunu, kota ve silme yaşam döngüsünü kapsar. Tarayıcı senaryoları masaüstü/mobil, tema ve erişilebilirlik davranışını doğrular. [CI iş akışı](.github/workflows/quality.yml) bu kontrolleri birleştirir.

[Özetleme referans seti](fixtures/analysis-reference/README.md), kaynaklı AI aşaması için sentetik satış ve müşteri yorumu vakalarını içerir. Beklenen hesaplar, kaynak kanıtları ve değerlendirme ölçütleri birbirinden ayrıdır; referans bütünlüğü model çağrısından bağımsız test edilir. AI özetleme ve grafik mimarisi [FLOW](FLOW.md#kabul-edilen-hedef-mimari--2026-10-10), uygulama kapsamı ve kabul kriterleri [GOAL](GOAL.md) üzerinden takip edilir.

| Belge | Başvuru konusu |
| --- | --- |
| [Geliştirici rehberi](docs/DEVELOPMENT.md) | Kurulum, komutlar ve teknik kaynak haritası |
| [FLOW](FLOW.md) | Ürün davranışı ve sistem mimarisi |
| [GOAL](GOAL.md) | Görev sahipliği, kabul kriterleri ve açık kararlar |
| [RULES](RULES.md) / [AGENTS](AGENTS.md) | Kod, stil ve ekip çalışma kuralları |
| [MEMORY](MEMORY.md) | Kısa kalıcı proje bağlamı |

Katkılar görev sahibi ve kabul kriterleriyle hazırlanır. Sırlar, servis hesabı bilgileri ve gerçek müşteri verileri repoya eklenmez.
