# Incagen

İşletme verilerinden analiz ve büyüme önerileri üretmeyi amaçlayan uygulama. Mevcut teslimat: yerel hesap, çoklu iş belgesi yükleme, gerçek içerik ayrıştırma, kaynak konumlu hazırlık özeti, geçmiş ve kaynaklarıyla silme. Canlı Netlify'da aynı uygulama ekranları ve Firebase Auth kullanılabilir; Gemini ve bulut analiz altyapısı henüz yoktur.

## Gereksinimler

- Node.js 22.19+ (22 LTS önerilir; yerel testler Node 24 ile de çalışır), npm 10+, Git.
- Tam emülatör akışı için Java 21+; `java -version` ve `node --version` ile kontrol edin.
- İlk kurulumda npm, Firebase emülatörleri ve Playwright indirmeleri için internet.
- Boş yerel portlar: 9099, 8080, 9199, 5001; emülatör yardımcı portları 4400, 4500, 9150. Test Vite sunucusu 4173 kullanır.

## Kurulum ve çalıştırma

```bash
npm ci
npm --prefix functions ci
npx playwright install chromium
```

Canlı Firebase Auth ve Netlify ile aynı, yalnız Auth'un açık olduğu arayüz önizlemesini başlatın:

```bash
npm run dev
```

İlk çalıştırmadan önce `.env.example` içindeki sekiz `VITE_` değişkenini `.env.cloud-preview.local` dosyasına koyun; değerleri Netlify sitesinin ortam ayarlarından alın. Bu dosya Git tarafından yok sayılır. `npm run dev` yalnız Vite'ı açar, `incagen-eeef4` Firebase Auth'a bağlanır ve canlı Storage/Functions hazır olmadığından belge hazırlama, geçmiş ve hesap silme işlemlerini kapalı tutar. Netlify ve localhost farklı tarayıcı kökenleri olduğundan her birinde ayrı oturum açılır.

Sentetik verilerle tam belge/analiz akışını emülatörlerde çalıştırmak için:

```bash
npm run dev:emulator
```

Bu komut önce Functions'ı derler ve dört emülatörü hazırlar, ardından Vite adresini gösterir. Servisleri ayrı terminallerde izlemek isterseniz backend'i `npm run emulators`, frontend'i ikinci terminalde şu komutla başlatabilirsiniz:

```bash
npm run dev:web
```

Emülatör modunda Vite'ın gösterdiği yerel adresi açın ve sentetik test hesabı oluşturun; canlı Firebase hesabı emülatörde bulunmaz. Emülatör için Firebase CLI girişi, gerçek API anahtarı veya faturalandırma gerekmez.

`dev:emulator` ve `dev:web`, `.env.emulator` içindeki `demo-incagen` projesini yalnız loopback adresinde kullanır; eksik servisleri gerçek bulutla tamamlamaz.

### İlk belge hazırlığı

1. Yeni analiz ekranından sentetik PDF/DOCX/PPTX, CSV/TSV/XLSX, TXT/MD/JSON veya PNG/JPEG/WebP seçin.
2. Çalışma alanı için işletme adını oturumda ilk kullanımda belirtin; aynı oturumun sonraki analizlerinde bu ad hazır gelir ve gerektiğinde değiştirilebilir. Her analiz için konuya özel bir başlık girin. 1–500 karakter arasında bir analiz hedefi belirtin; bu hedef taslakla korunur ve kaydedilen çalışmada gösterilir.
3. Belgeleri ayrıştırın; backend manifestin yanında dosya imzasını, arşiv güvenliğini ve gerçek içeriği doğrular.
4. Sonuçta kaynak hash'i, gerçek MIME, parça/karakter ve sayfa/çalışma sayfası/slayt bilgilerini inceleyin.
5. Geçmişten hazırlık özetini tekrar açın; silme ham kaynakları ve türetilmiş içerikleri birlikte kaldırır.

Dosyalar iç navigasyonda korunur; tarayıcı yenilemesinde yeniden seçilir. Emülatör kapandığında test hesap ve raporları normalde kaybolur. Kalıcı müşteri depolaması değildir.

## Komutlar

| Komut | Amaç |
|---|---|
| `npm run dev` | Canlı Firebase Auth'lu, backend işlemleri kapalı yerel önizleme |
| `npm run dev:emulator` | Frontend ve tüm yerel Firebase servisleri |
| `npm run dev:web` | Zaten çalışan emülatörlerle yalnız frontend |
| `npm run emulators` | Backend derleme ve yerel servisler |
| `npm run lint` | Kod kalite kontrolü |
| `npm run test:run` | Birim/bileşen testleri |
| `npm run test:functions` | Belge parser fixture testleri |
| `npm run build` | Frontend üretim derlemesi |
| `npm run build:functions` | Backend derlemesi |
| `npm run test:integration` | Kendi emülatörünü açan güvenlik/kota/rapor testleri |
| `npm run test:local` | Kendi emülatörünü açan masaüstü/mobil tarayıcı testleri |
| `npm run test:e2e` | Zaten çalışan emülatörlerle tarayıcı testleri |

`test:integration` ve `test:local` öncesinde manuel emülatörü kapatın; bu komutları aynı anda çalıştırmayın. Testler sentetik hesaplar oluşturur. GitHub Actions bu kontrolleri temiz ortamda yürütür.

Üretim derlemesi tek başına canlı kullanıma hazır değildir. Yerel emülatör üretim önizlemesi için build sırasında açıkça `--mode emulator` verilmelidir; aksi halde hesap ekranı yapılandırma uyarısı verir.

### Canlı uygulama önizlemesi

`incagen.netlify.app` ve `npm run dev` aynı `VITE_FIREBASE_MODE=cloud`, Firebase Web App yapılandırması ve `VITE_AUTH_ONLY_PREVIEW=true` ayarlarını kullanır. Landing, Yeni analiz, Geçmiş, Ayarlar ve Plan ekranları aynı rotalarda açılır. Gerçek Firebase e-posta/parola kaydı, giriş, çıkış ve e-postayla şifre yenileme çalışır. Storage, Firestore ve Cloud Functions hazır olana kadar belge hazırlama, geçmiş verisi ve hesap silme isteği sunucuya gönderilmez; denendiğinde durum açıkça belirtilir. Netlify ayarları serviste, yerel kopyaları Git dışındaki `.env.cloud-preview.local` dosyasında tutulur. Tam sentetik akış `npm run dev:emulator` ile korunur.

## Yapı ve teknoloji

React, TypeScript, Vite, React Router, Tailwind, shadcn/ui yaklaşımı, Anime.js ve Firebase. Vitest/Testing Library, Playwright/axe ve Firebase emülatör testleri kullanılır.

Sonraki AI aşamasının kabul edilen mimarisi ve kalite kriterleri [FLOW.md](FLOW.md#kabul-edilen-hedef-mimari--2026-10-10) içindedir. Python işçisi ve ECharts bu hedefin parçalarıdır; mevcut kurulumda henüz kullanılmazlar.

Özetleme için sentetik satış ve müşteri yorumu [referans seti](fixtures/analysis-reference/README.md), kaynaklı beklenen sonuçlar ve değerlendirme şablonuyla hazırdır. `npm run test:functions` parser/kaynak/hesap tutarlılığını doğrular; LLM veya Python çalıştırmaz.

- `src/pages`, `src/components`: ekranlar ve ortak arayüz.
- `src/hooks`, `src/lib`: oturum, taslak, servis ve canlı kayıt bağları.
- `src/i18n`: Türkçe mesaj sözlüğü temeli; İngilizce henüz yoktur.
- `functions/src/parsing`: metin, tablo, PDF, modern Office ve görsel ayrıştırıcıları.
- `functions/src`: paylaşılan belge sözleşmesi, içerik doğrulama ve backend uçları.
- `integration`, `e2e`: güvenlik/yaşam döngüsü ve tarayıcı testleri.

Belgeler: [hedefler](GOAL.md), [akış](FLOW.md), [kurallar](RULES.md), [kalıcı bağlam](MEMORY.md), [ekip düzeni](AGENTS.md).

Değişiklikleri `main`e göndermeden önce en az şu kontrolleri çalıştırın:

```bash
npm run lint
npm run test:run
npm run build
```

Functions değiştiyse `npm run build:functions`; backend veya kullanıcı akışı değiştiyse ilgili `npm run test:integration` ve `npm run test:local` kontrollerini de çalıştırın.

## Bilinen sınırlar

AI yorumu ve görsel OCR henüz yapılmaz; metin katmanı olmayan sayfalar sonraki AI aşaması için işaretlenir. Eski Office/ODS/RTF/XML/GIF/SVG/HEIC formatları güvenli dönüştürme hattı gelene kadar kabul edilmez. Format, parser, boyut ve kota sınırları FLOW.md'dedir. Google Analytics, Microsoft Clarity, Google girişi, Premium ödeme ve canlı yayına geçiş tamamlanmadı. Emülatör testi bulut IAM/App Check testi yerine geçmez.

Ayarlar'daki hesap silme işlemi yalnız yerel emülatörde çalışır. Parola ve açık onay ister; hesabı, analiz kayıtlarını, kaynak belgeleri ve hazırlanmış içerikleri kalıcı olarak kaldırır.

Bağımlılık denetiminde uygulama ve Functions üretim bağımlılıkları temizdir; Firebase CLI geliştirme zincirinde orta önem seviyesinde uyarılar bulunmaktadır. CLI'yi eski ana sürüme zorlayan `audit fix --force` uygulanmadı. `gaxios → uuid` ve `express → qs` için kontrollü override'lar mevcut API kullanımıyla test edilmiştir.
