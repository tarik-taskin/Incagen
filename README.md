# Incagen

İşletme verilerinden analiz ve büyüme önerileri üretmeyi amaçlayan uygulama. Mevcut teslimat: yerel hesap, CSV yükleme, gerçek sayısal rapor, grafikler, geçmiş ve kaynaklarıyla silme. Gemini ve canlı bulut entegrasyonu henüz yoktur.

## Gereksinimler

- Node.js 22.19+ (22 LTS önerilir; yerel testler Node 24 ile de çalışır), npm 10+, Git.
- Java 21+; `java -version` ve `node --version` ile kontrol edin.
- İlk kurulumda npm, Firebase emülatörleri ve Playwright indirmeleri için internet.
- Boş yerel portlar: 9099, 8080, 9199, 5001; emülatör yardımcı portları 4400, 4500, 9150. Test Vite sunucusu 4173 kullanır.

## Kurulum ve çalıştırma

```bash
npm ci
npm --prefix functions ci
npx playwright install chromium
```

Bir terminalde backend'i başlatın:

```bash
npm run emulators
```

İkinci terminalde frontend'i başlatın:

```bash
npm run dev
```

Vite'ın gösterdiği yerel adresi açın. Yeni hesap oluşturun; gerçek e-posta/parola yerine sentetik test bilgileri kullanın. Firebase login, API anahtarı veya faturalandırma gerekmez.

Varsayılan geliştirme modu emülatördür. İsteğe bağlı `.env.example` dosyasını `.env.local` olarak kopyalayabilirsiniz. Bu sürüm yalnız `demo-incagen`, loopback adresi ve emülatör modunu kabul eder; eksik servisleri gerçek bulutla tamamlamaz.

### İlk rapor

1. Yeni analiz ekranından sentetik örnek CSV'yi indirin ve seçin.
2. İşletme ve rapor başlığını doldurun.
3. Ayırıcı: noktalı virgül; tarih: DD.MM.YYYY; sayı: Türkçe.
4. Tarih → Tarih, tutar → Tutar, kategori → Kategori eşleştirmelerini seçin.
5. Rapor oluşturun. Örnek dosyada beklenen toplam **2.244,75 TRY**, satır sayısı **5**.
6. Geçmişten raporu tekrar açın; silme kaynak dosyaları da kaldırır.

Dosyalar iç navigasyonda korunur; tarayıcı yenilemesinde yeniden seçilir. Emülatör kapandığında test hesap ve raporları normalde kaybolur. Kalıcı müşteri depolaması değildir.

## Komutlar

| Komut | Amaç |
|---|---|
| `npm run dev` | Yerel frontend |
| `npm run emulators` | Backend derleme ve yerel servisler |
| `npm run lint` | Kod kalite kontrolü |
| `npm run test:run` | Birim/bileşen testleri |
| `npm run build` | Frontend üretim derlemesi |
| `npm run build:functions` | Backend derlemesi |
| `npm run test:integration` | Kendi emülatörünü açan güvenlik/kota/rapor testleri |
| `npm run test:local` | Kendi emülatörünü açan masaüstü/mobil tarayıcı testleri |
| `npm run test:e2e` | Zaten çalışan emülatörlerle tarayıcı testleri |

`test:integration` ve `test:local` öncesinde manuel emülatörü kapatın; bu komutları aynı anda çalıştırmayın. Testler sentetik hesaplar oluşturur. GitHub Actions bu kontrolleri temiz ortamda yürütür.

Üretim derlemesi tek başına canlı kullanıma hazır değildir. Yerel üretim önizlemesi için build sırasında açıkça `VITE_FIREBASE_MODE=emulator` verilmelidir; aksi halde hesap ekranı yapılandırma uyarısı verir.

## Yapı ve teknoloji

React, TypeScript, Vite, React Router, Tailwind, shadcn/ui yaklaşımı, Anime.js, Recharts ve Firebase. Vitest/Testing Library, Playwright/axe ve Firebase emülatör testleri kullanılır.

- `src/pages`, `src/components`: ekranlar ve ortak arayüz.
- `src/hooks`, `src/lib`: oturum, taslak, servis ve canlı kayıt bağları.
- `src/i18n`: Türkçe mesaj sözlüğü temeli; İngilizce henüz yoktur.
- `functions/src`: paylaşılan analiz sözleşmesi, CSV hesaplama ve backend uçları.
- `integration`, `e2e`: güvenlik/yaşam döngüsü ve tarayıcı testleri.
- `public/samples`: yalnız sentetik demo CSV.

Belgeler: [hedefler](GOAL.md), [akış](FLOW.md), [kurallar](RULES.md), [kalıcı bağlam](MEMORY.md), [ekip düzeni](AGENTS.md).

Değişiklikleri `main`e göndermeden önce en az şu kontrolleri çalıştırın:

```bash
npm run lint
npm run test:run
npm run build
```

Functions değiştiyse `npm run build:functions`; backend veya kullanıcı akışı değiştiyse ilgili `npm run test:integration` ve `npm run test:local` kontrollerini de çalıştırın.

## Bilinen sınırlar

Yalnız CSV işlenir; boyut ve kota sınırları FLOW.md'dedir. AI, PDF/Office ayrıştırma, Google girişi, Premium ödeme ve canlı yayına geçiş tamamlanmadı. Emülatör testi bulut IAM/App Check testi yerine geçmez.

Bağımlılık denetiminde uygulama ve Functions üretim bağımlılıkları temizdir; Firebase CLI geliştirme zincirinde orta önem seviyesinde uyarılar bulunmaktadır. CLI'yi eski ana sürüme zorlayan `audit fix --force` uygulanmadı. `gaxios → uuid` ve `express → qs` için kontrollü override'lar mevcut API kullanımıyla test edilmiştir.
