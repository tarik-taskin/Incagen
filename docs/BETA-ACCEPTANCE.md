# İlk analiz betası — kapsam ve çıkış kanıtı

Bu plan ödeme altyapısını ve domain işlerini kapsamaz. Aktif işlerin durumu [GOAL.md](../GOAL.md), gerçek ürün davranışı [FLOW.md](../FLOW.md), teknik analiz sözleşmesi [TABULAR-ANALYSIS.md](TABULAR-ANALYSIS.md) içindedir. Burada tamamlanmış kod ile henüz gerçek sağlayıcı üzerinde kanıtlanmamış kabul ayrılır.

## Bugünkü sınır

Belge yükleme/hazırlama, kaynak konumları, geçmiş, indirme ve silme çalışır. Özel Python CSV/XLSX hesap işçisi ve backend Gemini adaptörü dağıtılmıştır. Bunları yeniden kurmak sonraki iş değildir. Genel analiz yayını iki kapıda da kapalıdır; örnek raporlar gerçek model kalite kabulü yerine geçmez.

12 Kasım 2026 tek bağlantı kontrolü `functions/unavailable / timeout` ile sonuçlandı (93.359 ms). Otomatik tekrar yapılmadı; sentetik hesap ve geçici geliştirici claim'i temizlendi. Geçerli yanıt alınmadan kalite/maliyet kabulü tamamlandı sayılmaz. Anahtar değiştirmek, sonucu taklit etmek veya şemayı gevşetmek bu engeli çözmez.

12 Kasım üretim bağımlılığı denetiminde kök ağaçta uyarı yok; Functions ağacında dört orta ve bir düşük kayıt var, yüksek/kritik yok. Yeni düşük `fast-xml-parser` kaydı ve kalan zincirler sonraki kontrollü backend paketinde değerlendirilmeli; bu çalışma bunları giderilmiş saymaz.

## İlk beta için kalan kabul

| Aşama | Gerekli kanıt | Açılış kararı |
| --- | --- | --- |
| Sağlayıcı bağlantısı | Mevcut backend hattında sınırlı sentetik kontrol; geçerli yanıt, süre ve güvenli hata kaydı | Başarılı bağlantı tek başına genel analizi açmaz. |
| Gerçek analiz doğruluğu | CSV ve XLSX için kaynak satırları, toplam/sayım/ortalama, sayı biçimi, eksik değerler ve büyük tutarlar beklenen cevapla karşılaştırılır | Hesap Python'dan gelir; modelin metrik üretmesine izin verilmez. |
| Dil ve anlatım kalitesi | Altı dilde gerçek sonuç; kaynak doğruluğu, gözlem/yorum ayrımı, somut öneri ve desteklenmeyen iddia için insan değerlendirmesi | Bir dilde başarısız kabul tüm dilleri başarılı yapmaz. |
| İş yaşam döngüsü | Gerçek backend'de yenileme, çift tıklama, kota, eşzamanlılık, yetki reddi, hata sonrası güvenli tekrar ve silme yarışı | Başarısız iş ve geciken yanıt kullanıcıya doğru durumla sunulur. |
| Süre ve maliyet | Gerçek token/kullanım ve Python/model/toplam süre; günlük sınırlar, bütçe alarmı ve kontrol edilebilir kapatma | Ölçülmemiş değer sıfır veya tahmin olarak raporlanmaz. |
| Sınırlı beta yayını | Kimlerin erişeceği kararı, kaynak saklama/silme süresi, hata izleme ve destek yolu; son CI ve aynı paketin canlı kabulü | Küçük kullanıcı grubunda ölçümlü açılış; mevcut hazırlık korunur. |

Kabul koşuları sentetik verilerle yapılır. Hesap ve dosya temizliği günlük üzerinden doğrulanır; gerçek kullanıcı belgeleri teşhis için alınmaz. Sağlayıcı hatasında sınırsız retry veya yayın kapılarını açık bırakma kullanılmaz. Ayrıntılı komutlar [test rehberinde](TESTING.md), kaynak ve model denetimleri [analiz rehberinde](TABULAR-ANALYSIS.md#yayın-kapısı-ve-canlı-kabul) kalır.

## İlk betadan sonra

- PDF/Word/PowerPoint ve birden fazla belgeyi birlikte yorumlama: extraction uyarıları, kaynak bağlama ve rapor düzeni için ayrı kabul. OCR/görsel yorum kapsamı ayrıca kararlaştırılır.
- Google Analytics ve Microsoft Clarity: kullanıcı yetkilendirmesi, kaynak kapsamı, bağlantıyı kaldırma ve hata durumları; Google Ads kapsamda değildir.
- Apple/Microsoft ile giriş: sağlayıcı hesabı/alan adı şartları, hesap eşleme, yeniden doğrulama ve hesap silme kabulü.
- Operasyon: saklama/karantina politikası, yedekleme/geri yükleme denemesi, erişim ve kota araçları. Backend servis hesabının eski geniş rolünün daraltılması ayrı kontrollü değişikliktir.

## Çalışma oturumu tahmini

Sağlayıcı kararlı yanıt vermeye başladığında, ilk **CSV/XLSX analiz betası için yaklaşık 5–7 odaklı oturum** öngörülür. Bu bir teslim tarihi veya garanti değildir; gerçek kalite kabulündeki hatalara göre değişir. Sağlayıcı kapasitesi, hesap/onay ve ekip kararı beklenen takvim günleri bu sayıya dahil değildir.

Yukarıdaki sonraki kapsam da istenirse, ödeme ve domain hariç **toplam yaklaşık 10–16 oturum** daha gerçekçi bir planlama aralığıdır. OCR ve geniş operasyon/ekip yönetimi ayrıca büyüyebilir. Öncelik ilk beta kabulünü bitirmektir; tüm isteğe bağlı özellikler tamamlanmadan da sınırlı beta değerlendirilebilir.
