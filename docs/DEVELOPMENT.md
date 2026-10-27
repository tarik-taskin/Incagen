# Geliştirici rehberi

Incagen'in arayüzü, belge hazırlama hattı ve sonuç sözleşmeleri aynı kaynak ve yetki modelini paylaşır. Bu rehber kurulum, kod sahipliği ve yayın disiplinini açıklar; ürün davranışı [FLOW](../FLOW.md), görevler ve kabul kriterleri [GOAL](../GOAL.md) üzerinden takip edilir.

## Kurulum

Node.js 22.19+ (22 serisi) veya 24, npm ve Git gerekir. Functions çalışma zamanı ve CI Node 22 kullanır.

Repo kökünde:

```bash
npm ci
npm --prefix functions ci
cp .env.example .env.cloud-preview.local
```

Git dışında tutulan ortam dosyasındaki Firebase Web App değerlerini proje ayarlarından doldurun; ardından:

```bash
npm run dev
```

Terminaldeki adresi açın. Varsayılan geliştirme komutu gerçek Firebase Auth yapılandırmasını kullanır. Ortam değişikliklerinden sonra Vite yeniden başlatılır. Servis hesabı, özel anahtar veya AI sağlayıcı anahtarı hiçbir `VITE_` değişkenine yazılmaz.

## Kodun sorumlulukları

| Kaynak | Sorumluluk |
| --- | --- |
| [src/pages](../src/pages) | Ürün ekranları ve rota davranışı |
| [src/components](../src/components) | Ortak arayüz, kimlik ve çalışma taslağı |
| [src/features/reports](../src/features/reports) | Doğrulanmış sonuç görünümü, grafik ve kaynak paneli |
| [src/features/files](../src/features/files) | Dosya seçimi, kapasite ve hazırlık kontrolü |
| [functions/src/contracts.ts](../functions/src/contracts.ts) | İstek, format, limit ve belge sözleşmeleri |
| [functions/src/parsing](../functions/src/parsing) | İçerik doğrulama ve kaynak konumlu ayrıştırma |
| [functions/src/analysis](../functions/src/analysis) | Analiz veri paketi, AI sonuç v1 şeması ve güvenilir bağlam doğrulaması |
| [functions/src/index.ts](../functions/src/index.ts) | Yetkili oluşturma, hazırlama ve silme uçları |
| [integration](../integration) / [e2e](../e2e) | Yetki, yaşam döngüsü ve tarayıcı kontrolleri |

Analiz başlığı, çalışma alanı ve hedef ortak alan kurallarına göre doğrulanır. Kapasite göstergesi kabul edilmiş dosyaların gerçek boyutlarından türetilir; istemci kontrolü sunucu doğrulamasının yerini almaz. Taslak sayfalar arasında korunur; başarıda dosyalar, başlık ve hedef temizlenir. Sayfa yenilemesinde dosyalar yeniden seçilir.

Normalize içerik kullanıcıya kapalı Storage alanında tutulur; Firestore kaynak ve hazırlık özetini taşır. İstemci sonuç, kota veya hazırlık durumunu yazmaz. Sürümlü AI çıktısı ancak [sonuç doğrulayıcısından](AI-RESULTS.md) geçerse sonraki hatta kullanılabilir; bu modül model çağrısı veya otomatik yayın yapmaz.

## Kalite kapısı

```bash
npm run lint
npm run test:run
npm run build
```

Functions değişikliğinde `npm run build:functions`; backend veya kullanıcı akışı değişikliğinde entegrasyon ve tarayıcı kontrolleri de çalıştırılır. Kurulum ve çalıştırma ayrıntıları [test rehberindedir](TESTING.md). [GitHub Actions](../.github/workflows/quality.yml) `main` push'ları ve `main` hedefli PR'larda kalite kapısını uygular.

## Yayın

Frontend için:

```bash
npm run build -- --mode cloud-preview
```

[netlify.toml](../netlify.toml) yalnız `dist` dizinini yayınlar; iç rotalar `index.html` üzerinden açılır. Derleme ortamı mevcut Firebase Web App yapılandırmasıyla eşleşmelidir. Düz `npm run build` derleme kontrolüdür; ortam yapılandırması olmadan hazırlanmış paket canlı yayın olarak kullanılmaz.

Firebase backend'i ayrı dağıtılır:

```bash
npx firebase deploy --only "firestore:rules,storage,functions" --project incagen-eeef4
```

Firebase CLI Node 20+ ister; PowerShell'de `--only` listesi tırnak içinde verilir. Kurallar ve Functions, kodun kullandığı `(default)` Firestore veritabanına ve varsayılan Storage bucket'ına bağlanır. Storage, Functions, erişim kuralları ve faturalandırma doğrulanmadan `VITE_AUTH_ONLY_PREVIEW=true` koruması kaldırılmaz. Plan yükseltmesi tek başına backend'in dağıtıldığını veya güvenli olduğunu göstermez. Güncel yayın kapsamı ve sistem davranışı [FLOW](../FLOW.md) içindedir.

## Değişiklik disiplini

[AGENTS](../AGENTS.md)'deki görev/dal/commit akışını ve [RULES](../RULES.md)'deki kod/stil kurallarını izleyin. Belge ve testleri davranış değişikliğiyle birlikte güncelleyin; ürün limitleri ortak sözleşmeden gelir. Sırlar ve gerçek müşteri verileri Git'e eklenmez.

Özetleme çalışmalarında [referans seti](../fixtures/analysis-reference/README.md) kullanılır. Cevap anahtarları değerlendirme içindir, model girdisine veya retrieval bağlamına verilmez. Hedef mimari ve servis kararları [FLOW](../FLOW.md#kabul-edilen-hedef-mimari--2026-10-10) içinde tutulur.
