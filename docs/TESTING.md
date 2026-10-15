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
