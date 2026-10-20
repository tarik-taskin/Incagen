# Test ve doğrulama

Testler sentetik verilerle çalışır. Gerçek Firebase projesi veya müşteri hesabı test hedefi değildir; izolasyon ayarları değiştirilmez.

## Hızlı kontroller

```bash
npm run lint
npm run test:run
npm run build
npm run build:functions
```

`test:run`, uygulama ve Functions testlerini birlikte çalıştırır. `npm run test:references` yalnız referans bütünlüğünü; `npm run test:functions` ayrıştırıcı ve AI sonuç sözleşmesini de kontrol eder. Sonuç sözleşmesi ve analiz paketi testleri AI çağrısı yapmaz. Küçük satış ve kapsamlı şirket örneği özgün CSV/PDF/DOCX belgelerinden yeniden üretilip statik artefaktla ve bağımsız cevaplarla karşılaştırılır. Şirket örneğinde dört dönem kapsamı, farklı parser parçalarındaki kanıt aralıkları, ağırlıklı oranlar ve ZIP/tekli indirme bütünlüğü, PDF sayfaları ve Word metnindeki alıntılar doğrulanır. PDF/DOCX tasarım üretimi için belge aracı kullanılır; uygulama testleri kaydedilmiş dosyaları ayrıştırır ve Python gerektirmez. Kaynaklar değişirse `npm run example:build` ile artefaktı yenileyin; sürüm değişimi kuralları referans rehberindedir. Örnek rapor tarayıcı kontrolleri grafik/tablo eşitliği, dönem ve URL geçmişi, büyük kaynaklarda arama/sayfalama, indirme, odak/Escape, iki tema, normal/azaltılmış hareket ve mobil taşmayı kapsar.

## İlk açılış bütçesi

[`startupBudget`](../scripts/startup-budget.ts) her üretim derlemesinde başlangıç girişini ve bütün statik JS importlarını izler. Korumalı ekranlar veya Firestore/Storage/Functions kodu bu grafiğe girerse derleme durur. Parçalar ayrı ayrı gzip ile ölçülür; toplam sınır 400 KiB'dir. Bu ölçü ağ ve cihazdan bağımsız paket boyutudur; gerçek açılış süresi veya Core Web Vitals sonucu değildir.

2026-10-20 aynı canlı önizleme ayarlarıyla önce/sonra karşılaştırması: 490.644 → 294.783 gzip bayt (yaklaşık %40 azalma). Auth oturumu korunur; veri servisleri ve korumalı ekranlar gerektiğinde yüklenir. Genel yardım da ilk istekte yüklenir ve kapanınca mesaj taslağı korunur.

[`e2e/startup-and-report-links.spec.ts`](../e2e/startup-and-report-links.spec.ts) ana sayfayı korumalı ekran modüllerini engelleyerek açar, yardım taslağını ve raporun bölüm adreslerini sınar. Hedef örnekleri için altı dilde ekleme/geri alma ve kullanıcı düzenlemesini koruma bileşen testlerindedir; çalışma alanı gezinmesi, iki tema ve mobil kabulü tarayıcı paketinde doğrulanır.

## Bağımlılık denetimi

CI, iki paket ağacında üretim bağımlılıkları için yüksek/kritik uyarıları engeller:

```bash
npm audit --omit=dev --audit-level=high
npm --prefix functions audit --omit=dev --audit-level=high
```

Bu eşik orta önem uyarılarını gizlemez; denetim bunları çıktı olarak verir. 2026-10-18 bakımında `@grpc/grpc-js` 1.14.6, `proxy-addr` 2.0.8 ve `brace-expansion` düzeltilmiş dallara taşındı. gRPC override'ı, Firebase istemcisinin eski Node alt bağımlılığını yeniden çözmesini önler. Sürüm gerekçeleri [gRPC](https://github.com/advisories/GHSA-m9gg-hp2v-232j), [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) ve [brace-expansion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) duyurularındadır. Ana Firebase/Office API sürümleri korundu; Firebase CLI ve uyumlu alt bağımlılıklar güncellendi.

Kalan uyarılar ve erişim sınırları:

- Functions: `mammoth → argparse → sprintf-js` zincirinde aynı kök uyarıdan türeyen üç orta önem kaydı vardır. `sprintf-js` için düzeltilmiş npm sürümü henüz yoktur. Uygulama yalnız Mammoth'un `extractRawText({ buffer })` kütüphane API'sini çağırır; `argparse`, Mammoth'un `bin/mammoth` komut satırı girişinde kullanılır ve bu giriş çalıştırılmaz. [Duyuru](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) kapanana veya uyumlu üst paket düzeltmesi gelene kadar izlenir; bu, denetimin tamamen temiz olduğu anlamına gelmez.
- Kök paketin geliştirme ağacında Tailwind'in dosya/desen ve CSS ayrıştırma araçları ile Firebase CLI telemetri bağımlılığından gelen 10 kayıt (6 yüksek, 4 orta) kalır. Bunlar yayınlanan tarayıcı paketinin üretim bağımlılıkları değildir. Kalan öneriler Tailwind 4 geçişi veya Firebase CLI ana sürüm düşürmesi istediğinden `audit fix --force` uygulanmaz; ayrı uyumluluk çalışmasıyla ele alınır.

Denetim zamanla değişir. Yeni uyarıda yalnız sayıya bakılmaz; etkilenen sürüm, gerçek çağrı yolu ve düzeltmenin uyumu yeniden kontrol edilir. Kontroller kapatılmaz veya uyarılar bastırılmaz.

## Entegrasyon ve tarayıcı

Node gereksinimine ek olarak Java 21+ ve Chromium gerekir. İlk kurulumda:

```bash
npx playwright install chromium
```

Aşağıdaki komutlar kendi izole Firebase test servislerini başlatır. Port çakışmasını önlemek için önce manuel test servislerini kapatın ve komutları sırayla çalıştırın:

```bash
npm run test:integration
npm run test:local
```

Kimlik, yetki, kota ve silme kontrolleri entegrasyon paketindedir. Tarayıcı paketi masaüstü/mobil, açık/koyu tema, klavye, erişilebilirlik ve taslak yaşam döngüsünü sınar. Test hizmetleri `demo-incagen` ile loopback adreslerine kilitlidir; eksik servis gerçek bulutla tamamlanmaz. Normal kapanışta test verileri kalıcı değildir.

## Görsel inceleme

Uygulama akışını sentetik bir hesapla incelemek için:

```bash
npm run dev:emulator
```

Terminaldeki adresi kullanın. Gerçek Auth hesabıyla test hesabı ayrı tutulur. Servis portları 9099, 8080, 9199 ve 5001; yardımcı portlar 4400, 4500 ve 9150'dir. Playwright sunucusu 4173 kullanır.

Stil değişikliğinde iki tema, mobil taşma, klavye odağı ve `prefers-reduced-motion` davranışı incelenir. Testlerin geçmesi bulut IAM/App Check, gerçek saklama politikası veya LLM'nin anlamsal doğruluğunu kanıtlamaz. Ayrı kabul kriterleri [GOAL](../GOAL.md) ve [AI değerlendirme protokolünde](../fixtures/analysis-reference/evaluation.md) tutulur.

## Dil ve farklı rapor türleri

[Çok dilli arayüz ve rapor rehberi](LOCALIZATION.md), katalogları ve özgün içerik sınırını tanımlar. `src/i18n/runtime.test.ts` altı dilin anahtar/yer tutucularını ve statik kullanım kapsamını kontrol eder. `e2e/localization.spec.ts` dil menüsünü, form taslağını, örnekleri ve çalışma alanını masaüstü/mobilde doğrular. İnsan etiketli yorum hesapları `functions/src/examples/feedback-report.test.ts` içinde bağımsız cevaplarla karşılaştırılır.

```bash
node scripts/build-feedback-example.cjs --check
```
