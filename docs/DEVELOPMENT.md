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

Gemini anahtar/bağlantı kurulumu [Gemini rehberinde](GEMINI.md), izole Python kurulumu ve extraction sınırları [Python rehberindedir](../python/README.md). Anahtar frontend değişkenine konmaz.

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

Canlı kabul için kaynak ağacı önce commit edilmiş ve temiz olmalıdır. Mevcut kapalı analiz yayını:

```bash
VITE_AUTH_ONLY_PREVIEW=false VITE_TABULAR_ANALYSIS_ENABLED=false npm run build -- --mode cloud-preview
npm run verify:release -- --skip-live
```

Vite build'i `dist/release-manifest.json` içine o build'in commit/ağaç kimliğini, etkin yayın bayraklarını, public Firebase yapılandırmasını (API key yerine fingerprint) ve bütün çıktı dosyalarının SHA-256 değerlerini yazar. Manifest kendini hash'lemez. `--skip-live` yalnız yerel paketi doğrular; yayın kabulü değildir. Kirli ağaçtan build, eski commit, yanlış mod veya açık analiz bayrağı reddedilir. Bu, doğrulanan yerel build sürecinin kaydıdır; imzalı tedarik zinciri kanıtı veya kötü niyetli build operatörüne karşı güvenlik sınırı değildir.

Son commit'in GitHub Quality koşusu başarılı olduktan sonra aynı `dist` mevcut Netlify sitesine yeniden build edilmeden yüklenir (`netlify deploy --prod --no-build --dir dist`). Ardından:

```bash
npm run verify:release
```

Tam kabul manifest dosyası dahil bütün sunulan dosyaları, lazy paketleri, fontları ve örnek belgeleri canlıdan indirerek karşılaştırır. Yedi SPA rotası aynı doğrulanmış `index.html` içeriğini sunmalıdır. Yalnız Incagen için birebir bilinen statik Netlify hosting yorumu ayrılır; geniş HTML/whitespace normalizasyonu yapılmaz. Redirect, farklı origin, başlık/gövde timeout'u ve hash farkı başarısızlıktır. `_headers`/`_redirects` hosting kontrol dosyaları public asset diye istenmez. Yeni commit veya yeniden build sonrasında eski paket kabulü kullanılamaz.

Sır taraması sunulan metin dosyalarında belirli backend/özel anahtar işaretlerini arar; bütün sır türlerinin yokluğu garantisi değildir. Firebase web yapılandırması public istemci bilgisidir, Gemini anahtarı değildir. Test fixture'larına gerçek proje anahtarı kopyalanmaz. Tarama kapatılmaz; geçmişteki GitHub uyarısının kapanması dosyadan literal kaldırmakla otomatik kanıtlanmış sayılmaz.

[netlify.toml](../netlify.toml) yalnız `dist` dizinini yayınlar; iç rotalar `index.html` üzerinden açılır. Derleme ortamı mevcut Firebase Web App yapılandırmasıyla eşleşmelidir. Düz `npm run build` derleme kontrolüdür; ortam yapılandırması olmadan hazırlanmış paket canlı yayın olarak kullanılmaz.

Firebase backend'i ayrı dağıtılır:

```bash
npx firebase deploy --only "firestore:rules,storage,functions" --project incagen-eeef4
```

Firebase CLI Node 20+ ister; PowerShell'de `--only` listesi tırnak içinde verilir. Kurallar ve Functions, kodun kullandığı `(default)` Firestore veritabanına ve varsayılan Storage bucket'ına bağlanır. Storage, Functions ve erişim kuralları doğrulanmadan Auth-only sınırı kaldırılmaz. 2 Kasım üretim kabulü ve açık kullanıcı onayı sonrasında mevcut yayın `VITE_AUTH_ONLY_PREVIEW=false` ile belge hazırlığına açıldı. Plan yükseltmesi tek başına backend'in dağıtıldığını veya güvenli olduğunu göstermez. Güncel yayın kapsamı ve sistem davranışı [FLOW](../FLOW.md) içindedir.

## Değişiklik disiplini

[AGENTS](../AGENTS.md)'deki görev/dal/commit akışını ve [RULES](../RULES.md)'deki kod/stil kurallarını izleyin. Belge ve testleri davranış değişikliğiyle birlikte güncelleyin; ürün limitleri ortak sözleşmeden gelir. Sırlar ve gerçek müşteri verileri Git'e eklenmez.

Özetleme çalışmalarında [referans seti](../fixtures/analysis-reference/README.md) kullanılır. Cevap anahtarları değerlendirme içindir, model girdisine veya retrieval bağlamına verilmez. Hedef mimari ve servis kararları [FLOW](../FLOW.md#kabul-edilen-hedef-mimari--2026-10-10) içinde tutulur.
