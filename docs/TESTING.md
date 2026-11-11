# Test ve doğrulama

Varsayılan testler sentetik verilerle, yalıtılmış yerel servislerde çalışır; gerçek projeye geçiş yapmaz. Canlı kabul yalnız açık opt-in ve ayrı sentetik hesaplarla çalıştırılır; mevcut müşteri hesapları test hedefi değildir.

## Hızlı kontroller

```bash
npm run check:secrets
npm run lint
npm run test:run
npm run build
npm run build:functions
```

`test:run`, uygulama ve Functions testlerini birlikte çalıştırır. `npm run test:references` yalnız referans bütünlüğünü; `npm run test:functions` ayrıştırıcı ve AI sonuç sözleşmesini de kontrol eder. Sonuç sözleşmesi ve analiz paketi testleri AI çağrısı yapmaz. Küçük satış ve kapsamlı şirket örneği özgün CSV/PDF/DOCX belgelerinden yeniden üretilip statik artefaktla ve bağımsız cevaplarla karşılaştırılır. Şirket örneğinde dört dönem kapsamı, farklı parser parçalarındaki kanıt aralıkları, ağırlıklı oranlar ve ZIP/tekli indirme bütünlüğü, PDF sayfaları ve Word metnindeki alıntılar doğrulanır. PDF/DOCX tasarım üretimi için belge aracı kullanılır; uygulama testleri kaydedilmiş dosyaları ayrıştırır ve Python gerektirmez. Kaynaklar değişirse `npm run example:build` ile artefaktı yenileyin; sürüm değişimi kuralları referans rehberindedir. Örnek rapor tarayıcı kontrolleri grafik/tablo eşitliği, dönem ve URL geçmişi, büyük kaynaklarda arama/sayfalama, indirme, odak/Escape, iki tema, normal/azaltılmış hareket ve mobil taşmayı kapsar.

## Yayın paketi kabul testleri

`node --test scripts/check-source-credentials.test.mjs`, izole Git index'lerinde stage/çalışma dosyası farkını, silinen dosyayı, Git dışı ortamı, tab/newline içeren isimleri, symlink sınırını ve CLI redaksiyonunu sınar. Git alt süreçlerinde `stdio: pipe`, Node'un stderr'i catch öncesinde terminale yansıtmasını engeller; kaynak ve yayın CLI'leri bozuk sentetik Git yolu ile sınanır. Operasyonel dosya/Git hataları da dosya adındaki credential'ı taşımayan sabit bir hata üretir; yayın öncesi kirli ağaç reddi raw porcelain çıktısını günlüklemez. Gerçek anahtar kullanılmaz; Google/GitHub/AWS/OAuth/PEM biçimleri çalışma anında üretilir. Tek başına `npm run check:secrets`, gerçek repo index'ini ve takip edilen çalışma dosyalarını salt okunur tarar. Bu testler `test:run` içinde de çalışır.

`npm run test:run`, arayüz/Functions testlerinden sonra `node scripts/verify-release.test.mjs` çalıştırır. Bu paket gerçek proje anahtarı veya canlı sağlayıcı kullanmaz; izole geçici Git ağacı ve sentetik dosyalarla kirli ağaç/eski revizyon, eksik build manifesti, yanlış Firebase alanı, açık analiz bayrağı, değiştirilmiş lazy JS/font/örnek belge, yanlış 200/HTML yanıtı ve sınırlı hosting yorumu davranışını sınar. Timeout testi gerçek loopback HTTP bağlantısında hem başlıkları hem yarım kalan yanıt gövdesini sınar; localhost socket izni gerekir. Test dizinleri ve socket'ler kapanır. [Canlı komutlar ve sınırlar](DEVELOPMENT.md#yayın).

`live-analysis-download.test.tsx`, Storage cevabı ve hash hesaplaması beklerken oturum değişimi veya panel kapanmasının dosya indirme yan etkisini engellediğini doğrular. AbortSignal burada SDK ağ isteğini veya Web Crypto hesaplamasını fiziksel olarak durdurma garantisi değildir; eski sonuç artık Blob/anchor indirmesini tetiklemez. `history-page.lifecycle.test.tsx`, yeni snapshot gelmeyen lease sonunu ve uzun boş bekleme sonrası gelen yeni snapshot'ın aynı render zamanı ile filtre/sayaç/etiket güncellemesini sınar.

`tabular-retry.test.tsx`, kesin son tarih sınırını, uzun bekleme sonrası yeni snapshot'ı, arka planda geciken zamanlayıcıyı ve panel kapanırken timer/listener temizliğini sınar. Son tarih sinyali `useSyncExternalStore` ile izlenir; saat render'da state'e kopyalanmaz. Süre bitince yalnız mevcut arayüz/katalog durumu değişir; yeni model çağrısı yapılmadığı ayrıca doğrulanır.

`history-page.lifecycle.test.tsx` ayrıca 7/30/90 günlük filtre sınırını yeni snapshot olmadan aşar; satır görünümden çıkarken genel arşiv sayacı korunur. Destek servis testleri geçersiz/uzun adresi, boş/uzun mesajı ve iptal öncesi/sonrası geç yanıtı sınar; testler gerçek destek mesajı göndermez.

Python kabulünde sabit tohumlu 429 kayıtlık hizmet defteri, üç sayı biçiminde toplam/ortalama, negatif ve sıfır tutarlar, eşit olmayan gruplar ve boş satırlar üzerinden sınanır. Beklenen cevaplar integer kuruş ve `Fraction` ile bağımsız hesaplanır; her kanıt aralığı özgün fiziksel satırlara ve doğru parser parçasına kadar karşılaştırılır. Model çağrısı yapılmaz.

`node --test scripts/acceptance-resources.test.mjs` koşuya özel günlüklerin birbirini ezmediğini, dosya/dizin izinlerini, kimlik kapsamını ve başarısız metadata kontrolünde temiz işareti verilmediğini doğrular. Canlı testler `.incagen-local/` içinde 0600 dosya/0700 dizinle yalnız sentetik UID/analiz kimliklerini saklar; bu dizin Git dışındadır. Şifre, e-posta, token veya sağlayıcı sırrı kaydedilmez. Auth/Firestore/Storage metadata kabulü geçmeden `verified-clean` yazılmaz. Yarım bir koşunun günlüğünü silmek kaynakları temizlemez; operatör önce kaydedilmiş kapsamı doğrulamalıdır. Sürecin sunucu yanıtı henüz istemciye ulaşmadan kesilmesi gibi dağıtık sistem sınırları tamamen ortadan kalkmaz.

10 Kasım kabulü: lint, 149 arayüz + 141 Functions, 45 Python, 15 yayın, 11 kaynak koruması ve 5 günlük testi geçti. Son yerel seri tarayıcı koşusu retry kapalı **75 geçti / 0 hata / 3 mevcut platform atlaması**; entegrasyon **9 geçti**. Canlı sentetik kabul PDF/DOCX/XLSX, geçmiş/yenileme, hesaplar arası erişim reddi ve kaynak silmeyi kapsadı. Kapalı analiz kabulü ücretli iş ayırmadı ve modele çağrı yapmadı; üç günlüğün dört hesabı için metadata temizliği doğrulandı.

İlk iki Linux CI kopyalama senaryosunda birer retry ile yeşil oldu; bunlar hatasız ilk geçiş sayılmadı. Kısa canlı bölge tarayıcı içinde tıklamadan önce kaydedilir; gerçek pano/URL ve mesajın kaybolması da sınanır. İkinci koşunun boş duyuru kaydı üzerine lazy rota kontrollü tutuldu: URL yeni rotadayken eski raporun ortak düğmesi hâlâ görünürdü. Test artık yeni rapora özgü başlığı/aktif sekmeyi bekler ve aynı modül gecikmesini içerir. İki görünümde üçer tekrar retry kapalı geçti (6/6); düzeltmenin tam Linux kabulü 75 ilk geçiş ve üç mevcut platform atlamasıyla, retry olmadan tamamlandı. Uygulama davranışı veya timeout sınırı değişmedi. Ayrı tek Gemini teşhisi `busy` verdi; bu sonuç gerçek analiz kalite kabulü değildir ve iki yayın kapısı kapalı kaldı.

## Rapor bağlamı ve özgün değerler

`analysis-page.lifecycle.test.tsx`, gerçek React Router geçişinde eski silme yanıtının yeni rapordan çıkarmamasını, eski hata/dialog/bekleme durumunun taşınmamasını ve farklı taslağın korunmasını sınar. Aynı hesap/kayıtta normal silme ve hata sonrası tekrar çalışır. Başlığın lease bitişi, yeni/yenilenmiş snapshot, arka plandan dönüş ve unmount kabulü otomatik servis çağrısı olmadan yapılır.

`tabular-session.test.tsx`, kaynak/sayfa seçimini katalog sıralamasından bağımsız denetler; kaldırılmış kaynak, olmayan sütun, yeni deneme/hesap/kayıt ve eski özel sonuç geçişlerini sınar. `source-dialog.test.tsx`, boş/metin/mantıksal tutarla gerçek sıfır ayrımını, Arapça sayfalama ve özgün fiziksel satır kimliğini, boş belge sözcük sayımını doğrular. `report-format.test.ts` büyük parasal metnin sayı dönüşümünde kuruş kaybını reddeder; altı dilde ölçülen süre ve kaynak biçimi sınanır. Kaynak indirme testi ayrıca rapora yalnız kaydedilen sürelerin bağlandığını doğrular. Kaynak dosyalar ve backend/model çağrı sözleşmesi bu çalışmada değiştirilmez.

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

10 Kasım 2026 bakımında mevcut sürüm sınırları içinde `@hono/node-server` 2.1.6, `postcss-selector-parser` 6.1.6 ve `qs` 6.17.1 kilitlendi. `qs` 6 override'ı CLI'nin iç bağımlılıklarını da kapsar; runtime SDK veya Office ana sürümü değiştirilmedi. Uyumlu yamaların dayanakları: [Hono](https://github.com/advisories/GHSA-rmxm-3fg6-px4f), [CSS parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), [qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw). Temiz `npm ci --ignore-scripts` kurulumu geçti. Üretim kökü **0**, Functions **4 orta**; geliştirme dahil kök **26 → 22 orta** etkilenen paket, yüksek/kritik **0**. Kalan `glob`/`minimatch` ve CLI telemetri zincirlerinde uyumsuz ana sürüm/downgrade zorlanmadı; Functions kilit dosyası değişmedi. Bu sayılar bağımsız açık sayısı değildir ve önceki tarihli kayıtları geçersiz kılmaz.

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

Tarayıcı kabulü tek worker ve sıfır retry ile çalışır; ilk hatanın tekrar denemeyle gizlenmesine izin verilmez. Her iki komut `scripts/run-emulator-tests.mjs` üzerinden koşuya özel, `0700` izinli kısa bir geçici dizin kullanır. macOS'ta `/private/tmp/inctest-*`, Linux'ta `/tmp/inctest-*` seçilir; üst kabuğun `TMPDIR` değeri değişmez. Böylece farklı koşular ortak Storage geçici alanını paylaşmaz ve macOS Functions Unix socket yolu gereksiz uzamaz.

Başlatıcı alt sürecin hata kodunu korur. SIGINT/SIGTERM önce Firebase CLI'a iletilir; normal kapanış beklenir, asılı kapanışta 30 saniye sonra yalnız bu koşunun süreç grubu sonlandırılır. Temizlik yalnız oluşturulan dizini kapsar; farklı projenin süreçleri/dosyaları silinmez. Altı süreç testi başarı, hata, spawn hatası, iki koşunun dizin izolasyonu ve iki kapanış sinyalini doğrular. TCP portları yine ortaktır: entegrasyon ve tarayıcı komutlarını aynı anda çalıştırmayın.

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

## Analiz bağlantıları ve canlı kabul

- `npm run test:python`: hash kilitli Python ortamında extraction ve mevcut TypeScript kaynak sözleşmesi kabulü. Önce `npm run build:functions` çalıştırılır. [Kurulum ve kapsam](../python/README.md).
- Gemini adaptörünün birim testleri sağlayıcıyı taklit eder; anahtar veya gerçek model çağrısı kullanmaz. `integration/gemini.test.mjs` geliştirici claim'ini, eksik anahtarı ve atomik maliyet sınırını yalnız `demo-incagen` üzerinde doğrular. Gerçek kısa bağlantı kontrolü ayrı `npm run gemini:check` komutudur; [anahtar kurulumu](GEMINI.md).
- `INCAGEN_CLOUD_ACCEPTANCE=1 INCAGEN_ACCEPTANCE_URL=http://127.0.0.1:4177 npm run test:cloud`, yalnız açık opt-in ile canlı `incagen-eeef4` projesini kullanır. Yerel sunucu `VITE_AUTH_ONLY_PREVIEW=false npm run dev -- --host 127.0.0.1 --port 4177` ile açılır. Bu komut herkese açık yayın yapmaz. Onaylı üretim yayını sonrasında URL `https://incagen.netlify.app` olabilir.
- Canlı kabul testi UUID içeren iki sentetik hesap ve küçük PDF/DOCX/XLSX belgeleri oluşturur. Arayüzden hazırlama, yenileme, geçmişten açma ve silme; bağımsız hesapla Firestore/Storage/Functions erişim reddi test edilir. Yalnız oluşturduğu hesaplar `finally` içinde temizlenir. CI canlı teste girmez; iz/kimlik bilgisi dosyası kaydetmez.
- Google'ın normal tarayıcıdaki gerçek hesap kabulü ile otomasyon/hata ayıklama oturumu ayrı tutulur. Kullanıcının normal tarayıcıda doğruladığı kabul, otomatik uçtan uca kanıt olarak gösterilmez.

2 Kasım 2026 üretim denetiminde kök paket ağacı 0 uyarı, Functions ağacı 9 orta önem kaydı verdi; yüksek/kritik kayıt yok. Orta kayıtlar Office arşivleme zincirindeki `glob`/`minimatch` ve bir `google-gax` alt zincirine aittir. CI eşiği değiştirilmedi; uyumsuz Office ana sürümü düşürme veya zorlanmış override uygulanmadı. Önceki 29 Ekim 0 uyarı kaydı kendi tarihindeki durumdur.

### İlk gerçek tablo analizi kontrolleri

`integration/tabular.test.mjs`, demo projesinde gerçek Python hesabını; CSV ondalık toplamı, seçili XLSX sayfasında satır ağırlıklı ortalamayı, tekrar çağrı/yeniden deneme, yetki/kota ve silme yarışını doğrular. Model yanıtı emülatörde sabit taklittir. `e2e/tabular-analysis.spec.ts` gerçek upload → rapor → kaynak/indirme → geçmiş/yenileme, hatalı ölçümden sayım ile devam, RTL/Glass ve iki örneğin klavye rehberini kontrol eder. Canlı Python/Gemini kalite kabulünün yerine geçmez. [Kapsam ve yayın kapısı](TABULAR-ANALYSIS.md).

5 Kasım 2026 üretim bağımlılık denetimi: kökte 0, Functions'ta 4 orta kayıt (`google-gax` → `rimraf`/`glob`/`minimatch` zinciri); yüksek/kritik yok. Bu oturumda uyumsuz bağımlılık yükseltmesi veya zorlanmış override yapılmadı. Önceki tarihli sayımlar tarihsel kayıttır.


5 Kasım devam kabulü: özel worker’ın Cloud Build içindeki ağsız/1 GiB/tek CPU Linux testi geçti; gerçek digest, ayrı runtime kimliği, max instance/eşzamanlılık ve IAM politikası tekrar okundu. Runtime hesabının proje ve Gemini secret rolü yoktur. Mevcut backend hesabındaki önceden var olan Editor rolü değiştirilmedi. Yeni Functions ortamında sağlayıcı anahtarı bulunmadığı, kaynak arşivinin `.env*`/`.secret.local` içermediği doğrulandı. Canlı PDF/DOCX/XLSX hazırlama, geçmiş/yenileme, çapraz hesap reddi ve silme kabulü geçti.

Gerçek Gemini analiz denemeleri `503 / capacity` ile durdu; en küçük sabit bağlantı kontrolü de başarısız oldu. Tamamlanmış gerçek model yanıtı, altı dilde kalite puanı veya başarılı model maliyet ölçümü raporlanmaz. Sentetik test hesapları ve ham/türetilmiş dosyaları `finally` sonrasında bağımsız metadata kontrolleriyle silinmiş doğrulandı; geçici teşhis claim’i kaldırıldı. Kodun model taklidi testleri bu dış servis engelinin yerine geçmez.

`INCAGEN_LIVE_MODEL_ACCEPTANCE=1 INCAGEN_ACCEPTANCE_URL=http://127.0.0.1:4177 node scripts/accept-tabular-cloud.mjs --verify-closed`, sunucu/arayüz kapalıyken hazırlığı ve iş rezervasyonu oluşmadan reddi doğrular; model çağrısı yapmaz. Tam altı dilli kabul aynı komutun `--verify-closed` olmadan çalışmasıdır; yalnız onaylı test penceresinde sunucu kapısı ve yerel `VITE_TABULAR_ANALYSIS_ENABLED=true` açılır. Tam başarılı cevaplar insan değerlendirmesinden geçmeden genel canlı açılış yapılmaz. CI gerçek sağlayıcı veya müşteri hesabı kullanmaz.

Kapalı-yayın canlı kabulü geçti: normal kullanıcının geçerli CSV hazırlığında `startAnalysis` yapılandırma durumuyla reddedildi; `ai` işi oluşmadı, model çağrısı yapılmadı. Arayüz kaynaklı hazırlık görünümünü korudu. Sentetik hesap, Firestore kaydı ve Storage prefixleri bağımsız metadata okumalarıyla temizlenmiş doğrulandı. Son birim sayıları 106 frontend + 134 Functions; Python 39, demo entegrasyon 8.

Son dondurulmuş tarayıcı paketi 75 geçti / mevcut 3 platform atlaması ile tamamlandı. Kapalı canlı derleme ilk açılışta 323.326 gzip bayt ile 409.600 bayt bütçesinin altında kaldı.


### 6 Kasım — geçici hata ve indirme dayanıklılığı

`gemini.test.ts`, 429/503 yoğunluk ve 408/504/yerel deadline zaman aşımını ayırır; kalıcı 400/403 veya hata metnindeki rastgele “capacity” kelimesi geçici yoğunluk sayılmaz. Sağlayıcı gövdesinin log/istemciye taşınmadığı ve tek SDK denemesi korunur. `integration/tabular.test.mjs` bekleme dolmadan deneme ve kullanıcı/proje kotası oluşmadığını, sonrasında yalnız açık çağrının kabul edildiğini sınar. `tabular-retry.test.tsx`, bekleme bitince yalnız düğmenin açıldığını ve yeni iş oluşmadan reddedilen çağrının sessiz kalmadığını doğrular.

`source-download.test.tsx`, hızlı çift tıklama, güvenli hata/manuel tekrar, kaynak değişiminde eski isteğin geç gelen hatasının yalıtılması ve İngilizce eylem metnini sınar. Mevcut masaüstü/mobil rapor kabulü özgün dosya indirmesini, altı dil, tema, RTL ve erişilebilirliği korur.

Yerel kabul: 111 frontend + 141 Functions testi, 39 Python, 9 entegrasyon ve 75 tarayıcı senaryosu geçti; mevcut 3 platform senaryosu atlandı. Son hata kabulü düzeltmesinden sonra ilgili tablo/rapor paketi masaüstü/mobil 6/6 tekrar geçti. Kapalı canlı derlemede ilk açılış 324.010 gzip bayttır (bütçe 409.600). Gerçek Gemini bağlantısı `timeout`/`busy` nedeniyle doğrulanamadı; model kalite puanı veya başarılı analiz çağrısı raporlanmaz. `INCAGEN_CLOUD_DIAGNOSTIC=1 node scripts/check-gemini-cloud.mjs` yalnız tek sentetik backend isteği yapar, anahtar okumaz; geçici hesabını ve claim'ini temizler.
