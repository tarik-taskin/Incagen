# Yardım ve geri bildirim

## Kişisel destek

Çalışma alanının altındaki ve ana sayfa sonundaki **Destek ve yardım**, kısa yanıtları ve iletişim formunu açar. Mobil çalışma alanında aynı giriş içerik sonundadır; üst çubuktaki doğrudan ana sayfa bağlantısı korunur. Yanıtlar tek tek açılır; form ayrı bir adımdır. Pencere dışarı dokunma/Escape ile kapanır, odak geri döner ve gönderilmemiş metin korunur.

Yardım beş odaklı sorudan oluşur; tek yanıt açılır. Belge kapsamı, analiz hedefi ve örnek kaynaklara ek olarak sekme içi dosya korunumu ile kaynak/okuma uyarıları açıklanır. İletişim konuları soru, sorun, öneri, hesap/giriş ve veri/gizlilik olarak beş seçenekle sınırlıdır; konu hem form gönderiminde hem e-posta taslağında korunur. Altı dil kullanıcının yazdığı metni değiştirmez.

Web3Forms formu yalnız e-posta, konu ve kullanıcının yazdığı mesajı gönderir. Analiz kaydı, belgeler, hesap parolası veya kimlik token'ı eklenmez. Başarı için HTTP yanıtı ve `success: true` birlikte gerekir; zaman aşımı, ağ hatası, geçersiz yanıt ve servis reddi metni korur. Otomatik yeniden gönderim yapılmaz. Başarı mesajı servis kabulünü ifade eder; Gmail gelen kutusu teslimatı ayrıca doğrulanır.

Yerel ayarlar git tarafından dışlanan `.env.local` içindedir:

```dotenv
VITE_SUPPORT_EMAIL=your-support-address@example.com
VITE_WEB3FORMS_ACCESS_KEY=your-public-form-id
```

Form kimliği, [Web3Forms'un tanımladığı herkese açık gönderim kimliğidir](https://docs.web3forms.com/getting-started/faq); Gmail parolası veya özel API sırrı değildir. Gerçek değerler repoya yazılmaz. Netlify'da üretim **Builds** kapsamına kaydedilir; değişiklikten sonra derleme ve yayın gerekir. Public Vite değişkenleri frontend'e dahil olur; bu alana sunucu sırları konulmaz. Form kimliği yoksa mevcut e-posta adresiyle e-posta uygulamasında taslak açılır; bu işlem gönderildi olarak gösterilmez.

## Analiz sonu geri bildirimleri

Destek mesajları kişisel iletişimdir ve örnek rapor veri setine eklenmez. İleride gerçek analiz tamamlanınca sunulacak geri bildirim akışı ayrı olacaktır:

1. Giriş yapan kişi yalnız kendi tamamlanmış analizine geri bildirim bırakır; analiz kimliği ve kullanıcı yetkisi sunucuda doğrulanır.
2. Kullanıcı kimliği, analiz kimliği, gösterilecek ad, yorum ve oluşturulma zamanı ayrı bir koleksiyonda saklanır. Rapor/ham belgeler bu kayda kopyalanmaz.
3. Ad ve yorumun rapor örneğinde gösterilmesi için ayrı yayın izni alınır. Destek isteği yayın izni sayılmaz.
4. Yalnız izinli ve incelenmiş kayıtlar yayın veri kümesine alınır. Metin, kaynak sürümü ve hesaplar birlikte sürümlenir; yeni yorumlar mevcut örneğin sayılarına sessizce eklenmez.

Bu, kabul edilen gelecek akışıdır; gerçek analiz sonu toplama endpoint'i veya canlı geri bildirim veritabanı bu görevde oluşturulmaz. Bugünkü [müşteri deneyimi örneği](LOCALIZATION.md#müşteri-deneyimi-örneği) ayrı, sabit bir örnek dosyayla bu sunumu gösterir.
