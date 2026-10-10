# Incagen

İşletme belgelerini, tablolarını ve geri bildirimlerini kaynağı izlenebilir bir çalışma alanında hazırlayan uygulama. Hedef, bu içerikleri doğrulanmış hesaplar ve kaynaklı yapay zekâ yorumlarıyla karar desteğine dönüştürmek.

**Mevcut teslimat:** belge seçimi, güvenli içerik ayrıştırma, kaynaklı hazırlık özeti ve analiz arşivi. AI özetleme, OCR ve grafik üretimi henüz uygulanmadı.

[Canlı arayüz](https://incagen.netlify.app) · [Ürün ve sistem akışı](FLOW.md) · [Yol haritası](GOAL.md) · [Özetleme referansları](fixtures/analysis-reference/README.md)

## Nerede ne çalışıyor?

| Yetenek | Canlı site / `npm run dev` | Yerel emülatör |
| --- | --- | --- |
| Landing, çalışma alanı, tema ve mobil navigasyon | Kullanılabilir | Kullanılabilir |
| E-posta/parola kaydı, giriş ve çıkış | Gerçek Firebase Auth | Sentetik test hesabı |
| Şifre yenileme | Gerçek e-posta bağlantısı | E-posta teslimatı yapılmaz |
| Belge yükleme, ayrıştırma ve kaynak özeti | Backend işlemleri kapalı | Çalışır |
| Kayıtlı geçmiş, belge/analiz ve hesap silme | Backend işlemleri kapalı | Çalışır |
| AI özetleme, OCR, öneri ve grafik üretimi | Uygulanmadı | Uygulanmadı |

Canlı site şu anda **Auth önizlemesidir**. Tam belge hattı `demo-incagen` emülatörlerinde doğrulanır; canlı Firebase hesabınız emülatörde bulunmaz. Google/Apple/Microsoft giriş entegrasyonları, dış veri bağlantıları ve Premium ödeme tamamlanmış özellikler değildir. Güncel geliştirme kapsamının asıl kaynağı [GOAL.md](GOAL.md), ürün davranışının asıl kaynağı [FLOW.md](FLOW.md)'dir.

## Yerelde tam akışı çalıştırın

Gereksinimler: Git, npm, **Node.js 22.19+ (22 serisi) veya 24**, **Java 21+**. Functions çalışma zamanı ve CI Node 22 kullanır. İlk kurulumda paket, Chromium ve Firebase emülatör indirmeleri için internet gerekir.

Repo kökünde:

```bash
npm ci
npm --prefix functions ci
npx playwright install chromium
npm run dev:emulator
```

Vite'ın terminalde gösterdiği adresi açıp sentetik bir hesap oluşturun. Bu mod Firebase CLI hesabı, gerçek servis anahtarı veya faturalandırma gerektirmez. Takip edilen [.env.emulator](.env.emulator) yalnız `demo-incagen` ve loopback adreslerine izin verir; eksik servisi canlı bulutla tamamlamaz.

İlk deneme için [satış CSV'sini](fixtures/analysis-reference/v1/sales.csv) veya [müşteri yorumlarını](fixtures/analysis-reference/v1/customer-feedback.csv) seçin. İşletme adını çalışma alanı için bir kez belirtin; her çalışma için başlık ve **1–500 karakterlik analiz hedefi** girin. “Belgeleri ayrıştır” sonrası kaynak hash'i, içerik türü ve parça/konum bilgilerini inceleyin. Bu sonuç **AI özeti değildir**.

Taslak sayfalar arasında korunur. Başarılı hazırlık dosya, başlık ve hedefi temizler; işletme adı aynı oturumda kalır. Sayfa yenilemesinde yerel dosyalar yeniden seçilmelidir. Normal emülatör kapanışında test verileri kalıcı değildir.

## Canlı Auth ile arayüzü çalıştırın

[.env.example](.env.example) dosyasını Git dışında tutulan `.env.cloud-preview.local` olarak kopyalayın; Firebase Web App değerlerini mevcut Netlify projesinin ortam ayarlarından alın. Mod `cloud`, `VITE_AUTH_ONLY_PREVIEW` değeri `true` olmalıdır.

```bash
cp .env.example .env.cloud-preview.local
# Dosyadaki boş Firebase Web App değerlerini doldurun.
npm run dev
```

Bu komut yalnız Vite'ı başlatır; Java ve emülatör gerekmez. Yerel arayüz ve canlı site aynı Auth projesini kullanır, ancak farklı tarayıcı kökenlerinde ayrı oturum açılır. Storage/Firestore/Functions işlemleri bu modda gönderilmez. Web App yapılandırmasıyla servis hesabı/özel anahtar birbirine karıştırılmamalıdır; backend sırları hiçbir `VITE_` değişkenine veya Git'e yazılmaz.

## Doğrulama

```bash
npm run lint
npm run test:run
npm run build
```

`test:run` hem uygulama hem Functions/parser testlerini kapsar. Functions değişikliklerinde ayrıca `npm run build:functions`; backend veya kullanıcı akışı değişikliklerinde aşağıdaki iki komut da çalıştırılır:

```bash
npm run test:integration
npm run test:local
```

Bu iki komut kendi emülatörlerini başlatır; **sırayla çalıştırın ve önce manuel emülatörleri kapatın**. Güvenlik/kota/yaşam döngüsü testleri ve Chromium masaüstü/mobil, tema, erişilebilirlik kontrolleri sentetik verilerle yürütülür. [GitHub Actions](.github/workflows/quality.yml) aynı kalite kapılarını `main` push'ları ve `main` hedefli PR'larda çalıştırır.

| Ek komut | Kullanımı |
| --- | --- |
| `npm run emulators` + ayrı terminalde `npm run dev:web` | Backend ve frontend'i ayrı izleme |
| `npm run test:functions` | Tüm parser ve referans bütünlük testleri |
| `npm run test:references` | Yalnız özetleme referans seti kontrolleri |
| `npm run test:e2e` | Zaten çalışan emülatörler üzerinde tarayıcı testleri |
| `npm run build -- --mode emulator` | Yerel emülatör için frontend derlemesi |
| `npm run build -- --mode cloud-preview` | Git dışındaki canlı Auth ayarlarıyla frontend derlemesi |
| `npm run preview` | Son derlenmiş frontend'i yerelde inceleme; backend başlatmaz |

Düz `npm run build`, derleme kontrolüdür; Firebase ortamı verilmeden çalışır ama bu paket tek başına kullanıma hazır bir canlı yayın değildir. Netlify [yapılandırması](netlify.toml) `dist` dizinini yayınlar ve SPA rotalarını `index.html`'e yönlendirir. Canlı build aynı Auth ortam değişkenleriyle hazırlanmalıdır; yalnız frontend yayını Firebase backend'i dağıtmaz.

## Mimari ve kaynak haritası

Bugünkü hat: **Auth → doğrulanmış analiz isteği → manifestle eşleşen yükleme → format ayrıştırıcıları → kaynaklı hazırlık özeti → kullanıcıya özel arşiv**. Normalize içerik server-only Storage alanında, kaynak özeti Firestore'da tutulur. İstemci kota, sonuç veya hazırlık durumunu yazamaz.

| Konum | Sorumluluğu |
| --- | --- |
| [src](src) | React/TypeScript, Router, Tailwind, ortak UI, oturum ve taslak yönetimi |
| [functions/src/contracts.ts](functions/src/contracts.ts) | Paylaşılan istek, format, limit ve belge sözleşmeleri |
| [functions/src/parsing](functions/src/parsing) | CSV/XLSX, PDF, modern Office, metin/JSON ve görsel metadata ayrıştırma |
| [functions/src/index.ts](functions/src/index.ts) | Yetkili oluşturma/hazırlama/silme uçları, kota ve idempotency |
| [integration](integration) / [e2e](e2e) | Firebase izolasyonu, yaşam döngüsü ve tarayıcı doğrulaması |
| [fixtures/analysis-reference](fixtures/analysis-reference/README.md) | Sentetik kaynaklar, beklenen sonuçlar ve LLM değerlendirme protokolü |

Sonraki hattın kararı [FLOW.md hedef mimarisinde](FLOW.md#kabul-edilen-hedef-mimari--2026-10-10): dosya türüne göre extraction/vision, Python ile deterministik hesaplar, kaynaklı LLM yorumlama, backend doğrulaması ve React/ECharts sunumu. Python/ECharts kurulumu veya LLM çağrısı mevcut teslimatın parçası değildir.

## Sınırlar ve sorun giderme

- Hazırlık metin ve tablo içeriğini ayrıştırır; metinsiz PDF/görselleri OCR ile okumaz. Desteklenen format, parser güvenlik sınırı ve Free/Premium kapasitesi [FLOW.md](FLOW.md#belge-hazırlama-davranışı) içindedir; uygulanan limitler [ortak sözleşmeden](functions/src/contracts.ts) gelir.
- “Firebase ortamı yapılandırılmadı/eksik” hatasında çalışma modunu ve Git dışındaki ortam dosyasını kontrol edip Vite'ı yeniden başlatın.
- Canlı hesabın emülatörde giriş yapamaması beklenir; emülatör için yeni sentetik hesap oluşturun.
- Port çakışmasında kendi açık emülatörünüzü kapatın. Servis portları: 9099, 8080, 9199, 5001; yardımcı portlar: 4400, 4500, 9150. Tarayıcı test sunucusu 4173 kullanır.
- Hesap silme yalnız tam yerel akışta çalışır; yeniden parola doğrulaması ve açık onay ister. Ham/türetilmiş içerikleri, analizleri ve Auth hesabını kaldırır. Bulut IAM/App Check ve gerçek saklama politikası emülatör testleriyle doğrulanmış sayılmaz.

## Katkı ve belge düzeni

İşe başlamadan [AGENTS.md](AGENTS.md)'deki dal/görev/commit akışını, teknik değişikliklerde [RULES.md](RULES.md)'yi izleyin. Sahiplik ve kabul kriterleri [GOAL.md](GOAL.md), ürün/teknik davranış [FLOW.md](FLOW.md), kısa kalıcı bağlam [MEMORY.md](MEMORY.md) içinde tutulur. README bu kaynakları çoğaltmak yerine projeye giriş sağlar.

Sırlar, servis hesabı bilgileri ve gerçek müşteri verileri repoya eklenmez. Referans cevap anahtarları da model girdisine verilmez; [referans rehberi](fixtures/analysis-reference/README.md) bu ayrımı ve değerlendirme kapsamını tanımlar.
