# Dil ve rapor sunumu

## Metin kaynakları

Arayüz metinlerinin merkezi kaynağı [`src/i18n/locales`](../src/i18n/locales) klasörüdür. `tr.json`, `en.json`, `de.json`, `es.json`, `zh.json` ve `ar.json` aynı anahtarları taşır. Çince kaynak basitleştirilmiş Çincedir. Türkçe kaynak cümle anahtar olarak kullanılır; anlamı değişen bir metin tüm dillerde birlikte güncellenir.

[`t`](../src/i18n/runtime.ts) sabit metinleri ve `{0}`, `{1}` gibi yeniden sıralanabilir yer tutucuları çözer. `__one`, `__two`, `__few`, `__many` biçimleri mevcutsa sayı ilk yer tutucu olduğunda `Intl.PluralRules` ile seçilir. Yer tutucular React metni olarak gösterilir; HTML çalıştırılmaz. Mevcut taslak/hata metinleri için yalnız merkezi katalogda tanımlı tam kalıplar eşlenir. Bilinmeyen içerik aynen korunur. Dil kaynakları ağ üzerinden bir çeviri servisine gönderilmez.

```tsx
const locale = useLocale();
<button>{t("İndir")}</button>
<p>{t("{0} dosya", count)}</p>
```

`useLocale()` bileşeni dil değişimlerine abone eder. Metin çevirileri render sırasında uygulanır; modül düzeyindeki sabitler önceden çevrilmez. Düğmelerde kısa, o dilde doğal eylemler kullanılır. Çeviriler geliştirme sırasında hazırlanmıştır; yaygın kullanıma açılmadan önce anadil konuşurlarının ürün içinde dil incelemesi faydalıdır.

## Tercih ve yön

Seçim `incagen-language` altında tarayıcıda tutulur; yeni oturumda korunur, açık sekmeler arasında eşitlenir. Başlangıç dili Türkçedir. `html.lang` ve `html.dir`, belge başlığı, sayılar, yüzdeler ve tarihler seçimle güncellenir. Arapça sağdan sola düzen kullanır. Yerleşimler `start/end`, `ps/pe`, `ms/me`, `text-start/end` gibi yön bağımsız sınıflara dayanır.

Dil seçimi rota, oturum, form girdisi, parola veya seçili dosyaları sıfırlamaz. Kimlik modalında da dil değiştirilebilir. Hesap silmede kullanıcı seçili dildeki onay metnini yazar; istemci bu onayı doğruladıktan sonra mevcut backend onay sabitini gönderir. Yeniden kimlik doğrulama ve sunucu güvenlik kontrolleri korunur.

Hedef örnekleri seçildiği anda `t(example.value)` ile yerelleştirilir. Alana eklendikten sonra diğer kullanıcı girdileri gibi korunur; dil değişimi metni yeniden yazmaz. Örnek denemelerinden önceki hedef çalışma alanı taslağında tutulur, elle hedef düzenlemesinde geçerliliğini kaybeder. Geri alma eylemi ve bildirimi de altı dilde sunulur.

Yazı tipi Geist'tir; Türkçe karakterler latin-ext alt kümesiyle gelir. Arapça metin görününce Noto Sans Arabic iner, Çince sistem yazı tipine düşer; dosyalar `unicode-range` ile yalnız gerektiğinde indirilir. Radix menü ve seçimleri dil yönünü `LocaleDirection` üzerinden alır; Arapçada açılır listeler sağdan hizalanır.

## Kaynak ve sunum ayrımı

Kullanıcı başlıkları, işletme adları, dosya adları, özgün yorumlar, CSV hücreleri ve PDF/Word alıntıları çevrilmez. Türkçe örnek belgelerin metinleri kaynak dilinde kalır. Arayüz açıklamaları ve kontrollü örnek analiz metinleri yerelleştirilir. [`companyDisplay`](../src/features/reports/company-display.ts) yalnız örneğin sunum cümlelerini biçimlendirir; hesaplar, kimlikler, hash ve konumlar değişmez. Yeni kullanıcı raporunun/model çıktısının otomatik çevirisi bu değişikliğin kapsamında değildir.

`TRY` para birimi korunur; dil değişimi kur dönüşümü yapmaz. `null` metrik `—` ile ve gerekçesiyle gösterilir, sıfıra dönüşmez.

## Sade rapor düzeni

[`AdaptiveReport`](../src/features/reports/result-sections.tsx), `AiResult` içindeki metrik, grafik, özet, bulgu ve önerileri kullanır; finansal metrik kimliklerine bağlı değildir. Sayısal çıktısı olmayan rapor boş grafik veya uydurma metrik olmadan gösterilir. Şirket örneği kendi finansal tablolarını bu ortak sunumun yanında korur.

[`ReportDetails`](../src/features/reports/result-sections.tsx), ayrıntıları yerel `details/summary` ile kapalı başlatır. İçerik DOM'da kalır; klavye ile açılabilir. Rapordaki bölüm bağlantısı ilgili ayrıntıyı açarak hedefe gider. Dönem değişimi yeni hesap kapsamını oluşturur ve ayrıntıları yeniden kapatır. Finansal tablolar, yönetim notları, kaynak kütüphanesi, hesap yöntemleri ve öneri dayanakları silinmez.

Kurumsal raporun bölüm adresleri dönem sorgusunu korur; doğrudan bağlantı, yeniden yükleme, aynı bağlantıyı tekrar seçme ve tarayıcı geçmişi kapalı ayrıntıları açar. Başlangıç açıklaması ve bölüm başlıkları kısaltılmıştır; kaynak seçimi ipucu altı kartta tekrarlanmak yerine bir kez sunulur. Sayısal rapor ve özgün kaynak içerikleri bu sadeleştirmeden etkilenmez.

## Müşteri deneyimi örneği

`/ornek-rapor/musteri-deneyimi`, [32 analiz sonrası geri bildirimden oluşan v2 örnek dosyasını](../fixtures/analysis-reference/examples/customer-feedback.v2.csv) kullanır: 26 olumlu, 5 olumsuz, 1 karma yorum. Özet/anlatım, doğruluk/kaynaklar, karar desteği ve analiz derinliği değerlendirilir; tema/dil/ayar veya destek görüşmesi yorumları değildir. Ad-soyad ve analiz türü kaynakta korunur. Tüm kimlikler ve deneyimler örnek amaçlı kurgudur; gerçek müşteri veya doğrulanmış ticari başarı iddiası değildir. UI bu kapsamı “örnek rapor/örnek dosya” olarak tanımlar. Önceki [sekiz yorumluk değerlendirme referansı](../fixtures/analysis-reference/README.md) ve [32 yorumluk v1 sunumu](../fixtures/analysis-reference/examples/customer-feedback.csv) değişmez. [V2 insan etiketleri](../fixtures/analysis-reference/annotations/customer-feedback.v2.json) ile [bağımsız beklenen toplamlar](../fixtures/analysis-reference/examples/customer-feedback.v2.expected.json) ayrı dosyalardır. [Örnek hesaplayıcı](../functions/src/examples/feedback-report.ts), etiketleri özgün yorum kimliği, satır, tam alıntı ve hash ile eşler; tema sözü, sorun ve duygu sayılarını ayrı hesaplar. Bu etiketler genel bir sınıflandırıcı veya AI çıktısı değildir.

Sorun oranlarının paydası 32 benzersiz yorumdur. Çoklu temalara pasta grafik uygulanmaz; yalnız ayrık duygu kategorileri halka grafik kullanır. CSAT ölçümü bulunmadığından puan üretilmez. Sayım metrikleri yalnız eşleşen yorumlara bağlanır; oran paydaları tüm kapsamı korur. Kaynak incelemesi ve önerilerin bağlı olduğu bulgular ortak bileşenlerle açılır. Her iki örnek mobilde de aynı rapor seçiciden erişilebilir.

```bash
npm run example:build
node scripts/build-feedback-example.cjs --check
npm run test:run
npm run test:local
```

Testler dil anahtarı/yer tutucu eşitliğini, statik çeviri çağrılarının kapsamını, RTL ve kalıcılığı, form taslağını, kaynağın değişmeden kalmasını, sayımları ve eksik ölçümleri doğrular. Tarayıcı kontrolleri masaüstü/mobil, iki tema, azaltılmış hareket ve erişilebilirliği kapsar. Ürün davranışı [FLOW.md](../FLOW.md), kalite akışı [TESTING.md](TESTING.md) içindedir.

## Pencere kapatma

Açılır kaynak, giriş, analiz/geçmiş ve hesap silme pencereleri dışarıda başlayıp dışarıda biten birincil fare/dokunma hareketiyle kapanır. İçerideki tıklama ve dışarı taşan sürükleme kapatmaz. Escape ve odak dönüşü korunur; devam eden silme işlemi kapatılarak kesilmez. Analiz sayfası da tarayıcı `confirm` kutusu yerine uygulamanın erişilebilir onay penceresini kullanır.
