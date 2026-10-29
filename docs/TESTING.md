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

## Hazırlama deneyimi

[`WorkspaceProvider` testleri](../src/components/workspace-provider.test.tsx) kayıt açma, bayt bazında aktarım ve bekleyen hazırlığı bağımsız çözülen ağ çağrılarıyla sınar; %100 aktarım tek başına tamamlanmış sonuç sayılmaz. İptal/hata sonrası dosya korunumu, yeniden denemede aynı istek kimliği ve başarılı taslak temizliği kontrol edilir. Native ayrılma dinleyicisinin risk/temizleme/unmount ömrü [hook testinde](../src/hooks/use-before-unload.test.tsx), altı dilde çevrimdışı olayları ve teknik ayrıntıların görünürlüğü ilgili bileşen testlerindedir.

[`preparation-experience.spec.ts`](../e2e/preparation-experience.spec.ts), gerçek yerel backend akışını test ağ kapılarıyla aşama bazında inceler; altı dil, RTL, iki tema, klavye, masaüstü/mobil ve çevrimdışı/yeniden bağlantıda taslak korunur. Native sekme kapatma onayı Chromium masaüstünde test edilir; mobil işletim sistemlerinde diyaloğun garanti edildiği iddia edilmez. Teknik bilgiler yalnız açılınca görünür; belge uyarıları gizlenmez. Testler gerçek müşteri verisi veya e-posta gönderimi kullanmaz.

## Bağımlılık denetimi

CI, iki paket ağacında üretim bağımlılıkları için yüksek/kritik uyarıları engeller:

```bash
npm audit --omit=dev --audit-level=high
npm --prefix functions audit --omit=dev --audit-level=high
```

Bu eşik orta önem uyarılarını gizlemez; denetim bunları çıktı olarak verir. 2026-10-18 bakımında `@grpc/grpc-js` 1.14.6, `proxy-addr` 2.0.8 ve `brace-expansion` düzeltilmiş dallara taşındı. gRPC override'ı, Firebase istemcisinin eski Node alt bağımlılığını yeniden çözmesini önler. Sürüm gerekçeleri [gRPC](https://github.com/advisories/GHSA-m9gg-hp2v-232j), [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) ve [brace-expansion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) duyurularındadır. Ana Firebase/Office API sürümleri korundu; Firebase CLI ve uyumlu alt bağımlılıklar güncellendi.

2026-10-26 bakımında yeni [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) ve [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828) kayıtları nedeniyle duran üretim kapısı, Zod 4.6.7 ve body-parser 1.20.9/2.4.0 ile düzeltildi. Express'in iki ana dalı kendi uyumlu parser sürümünü kullanır; yeni override eklenmedi. Geliştirme ağacında Vite 6.4.5, Vitest 5.0.5 ve uyumlu Undici/Hono/fast-uri alt bağımlılıkları da güncellendi; doğrudan bağımlılıkların ana sürümleri korundu.

26 Ekim denetiminde iki üretim ağacında da **0 uyarı** vardı. Önceden izlenen Mammoth CLI zinciri bu denetimde raporlanmıyordu; bu gözlem ilgili kodun değiştirildiği anlamına gelmez. Tüm geliştirme bağımlılıklarını içeren kök denetimde **6 orta önem kaydı**, 0 yüksek/kritik kalmıştı:

- Firebase CLI'nin `@google-cloud/pubsub → @opentelemetry/core` telemetri zinciri: 3 kayıt. Önerilen otomatik çözüm Firebase CLI'yi 15'ten 14'e düşürdüğünden uygulanmaz.
- Tailwind 3'ün `postcss-nested → postcss-selector-parser` CSS araç zinciri: 3 kayıt. Otomatik çözüm Tailwind 4 geçişi istediğinden ayrı uyumluluk işi olarak tutulur.

Bu geliştirme araçları yayınlanan tarayıcı paketinin üretim bağımlılıkları değildir; bu ayrım riskin sıfır olduğu anlamına gelmez. `audit fix --force` kullanılmaz; kalan kayıtlar ana sürüm geçişinden önce yeniden değerlendirilir.

29 Ekim yayın denetiminde Firestore Web SDK'sının `re2js` 2.8.6 alt bağımlılığı, mevcut `^2.8.3` aralığı içinde 2.9.1'e alındı. [Yeni denetim kaydı](https://github.com/advisories/GHSA-gg6h-894w-4m9c) 2.8.7 öncesindeki isteğe bağlı `LOOKBEHINDS` eşleştirmesini etkiler. Uygulama bu seçeneği doğrudan kullanmaz; güncelleme bir uygulama açığının kanıtlandığı iddiası değildir. Firebase SDK sürümü, ürün kodu ve CI eşiği değişmedi. İki üretim ağacı yeniden **0 uyarı** verdi. Tam kök denetimde geliştirme araçlarına ait **7 orta**, 0 yüksek/kritik kayıt vardır: Firebase CLI/telemetri zincirinde 3, Hono node-server, Express, qs ve PostCSS selector parser'da birer kayıt. Bunlar güncel duyuru ve uyumluluklarıyla ayrı bakımda değerlendirilir; 26 Ekim sayıları tarihsel kayıttır.

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

Functions kodunun ilk yüklemesi yavaş disklerde (örneğin OneDrive klasörü) 10 saniyeyi aşarsa emülatör "Timeout after 10000" ile fonksiyonları yüklemez. Bu durumda aynı komutlardan önce yalnız yerel kabukta `FUNCTIONS_DISCOVERY_TIMEOUT=60` tanımlayın; repo ayarı değişmez.

Kimlik, yetki, kota ve silme kontrolleri entegrasyon paketindedir. Tarayıcı paketi masaüstü/mobil, açık/koyu tema, klavye, erişilebilirlik ve taslak yaşam döngüsünü sınar. Google ile giriş, emülatörün sahte hesap penceresiyle ilk giriş, yeniden giriş ve Google doğrulamalı hesap silme olarak sınanır; gerçek Google hesabı kullanılmaz. Test hizmetleri `demo-incagen` ile loopback adreslerine kilitlidir; eksik servis gerçek bulutla tamamlanmaz. Normal kapanışta test verileri kalıcı değildir.

## Görsel inceleme

Uygulama akışını sentetik bir hesapla incelemek için:

```bash
npm run dev:emulator
```

Terminaldeki adresi kullanın. Gerçek Auth hesabıyla test hesabı ayrı tutulur. Servis portları 9099, 8080, 9199 ve 5001; yardımcı portlar 4400, 4500 ve 9150'dir. Playwright sunucusu 4173 kullanır.

Tarayıcı testleri dil ve tema seçimini [`e2e/ui-helpers.ts`](../e2e/ui-helpers.ts) üzerinden yapar (`chooseLanguage`, `setTheme`); seçenekler görünen addan bağımsız `data-locale` ve `data-theme-option` ile bulunur. [`theme.spec.ts`](../e2e/theme.spec.ts) dört mod/görünüm kombinasyonunda axe ve kalıcılığı, [`report-tables.spec.ts`](../e2e/report-tables.spec.ts) tablo sıralamasını sınar. Glass kabulünde aynı modun gerçek ekran görüntüleri de karşılaştırılır; görünür renk farkı, axe ve elle görsel incelemeyle birlikte değerlendirilir. [`layout-and-entry.spec.ts`](../e2e/layout-and-entry.spec.ts), 1680 px masaüstünde ve dar ekranda rapor hizasını; alt/üst landing, plan, rapor ve aktif navigasyondan analiz girişini gerçek scrollY ve başlık konumuyla sınar. Mevcut bölüm adresi/geri-ileri paketi de korunur.

README görselleri normal takımın dışındaki [`e2e/screenshots/capture.shot.ts`](../e2e/screenshots/capture.shot.ts) ile üretilir: `npm run screenshots` emülatörü başlatır, sentetik hesap ve kurgusal örnek raporla Liquid Glass görünümünde açık/koyu ekranları yakalar ve webp olarak yalnız `docs/screenshots/` altına yazar. Ana sayfa bu ekran görüntülerini yüklemez.

Stil değişikliğinde iki mod ve iki görünüm, mobil taşma, klavye odağı ve `prefers-reduced-motion` davranışı incelenir. Testlerin geçmesi bulut IAM/App Check, gerçek saklama politikası veya LLM'nin anlamsal doğruluğunu kanıtlamaz. Ayrı kabul kriterleri [GOAL](../GOAL.md) ve [AI değerlendirme protokolünde](../fixtures/analysis-reference/evaluation.md) tutulur.

## Dil ve farklı rapor türleri

[Çok dilli arayüz ve rapor rehberi](LOCALIZATION.md), katalogları ve özgün içerik sınırını tanımlar. `src/i18n/runtime.test.ts` altı dilin anahtar/yer tutucularını ve statik kullanım kapsamını kontrol eder. `e2e/localization.spec.ts` dil menüsünü, form taslağını, örnekleri ve çalışma alanını masaüstü/mobilde doğrular. İnsan etiketli yorum hesapları `functions/src/examples/feedback-report.test.ts` içinde bağımsız cevaplarla karşılaştırılır.

```bash
node scripts/build-feedback-example.cjs --check
```
