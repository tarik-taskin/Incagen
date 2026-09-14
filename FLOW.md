# Incagen — Ürün ve Sistem Akışı

## Çalışan yerel dikey akış

E-posta/parola kaydı → korumalı çalışma alanı → farklı iş belgelerini seçme → yerel Storage yüklemesi → Functions manifest doğrulaması → Firestore hazırlık özeti → geçmişten açma veya kaynaklarıyla silme.

Bu sürüm yalnız `demo-incagen` Firebase emülatörleriyle çalışır. Gerçek buluta fallback veya canlı yayına uygunluk iddiası yoktur. Yalnız sentetik veriler kullanılmalıdır. AI yorumu ve belge içerik ayrıştırması henüz eklenmedi; mevcut backend dosya manifestini doğrular ve kaynakları analize hazırlar.

## Free ve Premium

Ürün limitlerinin belge kaynağı bu tablodur. Frontend plan bilgileri merkezi plan kurallarında, backend uygulanmış Free sınırları ortak analiz sözleşmesinde tutulur; değişiklikte üçü birlikte doğrulanır.

| Özellik | Free | Premium (planlanan) |
|---|---|---|
| Günlük analiz | 10 | 30 |
| Analiz başına dosya | 10 | 30 |
| Belge formatları | Tablo, belge, sunum, veri ve görsel | Tablo, belge, sunum, veri ve görsel |
| AI derinliği | Medium | High |
| Harici kaynak | Yok | Önce Google Analytics, sonra Microsoft Clarity |

Premium ödeme ve yetkilendirmeleri henüz uygulanmadı. Mevcut oturumlar Free kabul edilir. Günlük kota sunucunun `Europe/Istanbul` takvim gününe göredir; işlem başında transaction ile rezerve edilir. Başarısız işlemde iade edilir; tamamlanmış analizi silmek kotayı geri getirmez. Aynı istek ve tekrarlanan çalıştırmalar çift kota tüketmez.

## Belge hazırlama davranışı

- Free ve Premium aynı format kapsamını kullanır: tablolar, PDF/Word/metin belgeleri, sunumlar, JSON/XML verileri ve yaygın görsel formatları.
- Çalıştırılabilir veya ürün kapsamı dışındaki dosya türleri kabul edilmez. Uzantı kontrolü istemcide ve backend sözleşmesinde aynı listeden uygulanır.
- Geçici geliştirme sınırları iki planda da 5 MB/dosya ve 20 MB/analizdir. Analiz başına adet sınırı Free için 10, Premium için 30'dur.
- Dosya adı, boyutu ve içerik türü değişmez manifestte tutulur. Storage yalnız manifestte bulunan ve manifestle tam eşleşen kaynağı kabul eder.
- Mevcut sürüm belge içeriğini ayrıştırmaz veya AI sonucu üretmez. Hazırlık özeti belge adedi, toplam boyut ve doğrulanmış kaynak listesini gösterir.
- Sonuç ekranında “Belgeler hazırlandı — AI yorumu henüz eklenmedi” ibaresi zorunludur.

## Teknik sözleşme ve veri sahipliği

TypeScript Cloud Functions kullanılır; bugünkü belge hazırlığında Cloud Tasks ve Python Cloud Run yoktur. Gelecekte bulut için ayrı dev/prod ve `europe-west1` varsayılır; kaynaklar henüz oluşturulmadı. Bölge veya saklama değişiklikleri gerçek veri kullanımı öncesinde yeniden değerlendirilir.

- `createAnalysis`: doğrulanmış başlık, işletme ve dosya manifestiyle taslak oluşturur; istemcinin UUID istek kimliği ve içerik fingerprint'i tekrarları tekilleştirir.
- `prepareAnalysis`: kaynak boyutu, içerik türü, manifest ve kota sınırlarını backend'de doğrular; hazırlık özetini kaydeder.
- `deleteAnalysis`: silme durumuyla yeni yazmayı kilitler, dosyaları ve raporu siler. İşlem sürerken silme reddedilir; yarım kalan silme tekrar denenebilir.
- İstemci taslağı bellektedir. Sunucuda kayıt `uploading → processing → completed/failed` durumlarından geçer; silmede geçici `deleting` kullanılır.
- Çalışan iş için 150 saniyelik yeniden deneme koruması vardır. Süre aşımı sonrası açık yeniden deneme eski rezervasyonu düzeltir ve yeni deneme kimliği kullanır; eski iş sonucu yeni işi ezemez. Otomatik kalıcı kuyruk henüz yoktur.
- Sonuçlar `users/{uid}/analyses/{id}`, kota `users/{uid}/quotas/{day}`, kaynaklar Storage içinde `users/{uid}/analyses/{id}/{fileId}` altında tutulur.
- Kullanıcı yalnız kendi verilerini okuyabilir. Manifest dışı yükleme ve istemcinin rapor/durum/kota yazması yasaktır. Backend yetkiyi oturum token'ından alır.
- İç sayfa geçişlerinde seçilen dosyalar ve yükleme durumu korunur. Çıkışta yükleme iptal edilir ve taslak temizlenir. Sayfa yenilemede yerel dosyalar yeniden seçilmelidir; kaydedilmiş analizler geçmişte kalır.
- Oturumdaki kullanıcı şifre değiştirme isteğini yalnız bağlı e-posta adresi için başlatabilir. Canlı Firebase ortamında bağlantı e-postayla iletilir; mevcut yerel emülatör gerçek e-posta teslim etmez.
- Analizler kullanıcı silene kadar tutulur; mevcut emülatör verisi normal durdurmada kalıcı değildir. Gerçek müşteri için saklama/yedek politikası ayrıca onaylanmalıdır.

## Sonraki AI ve entegrasyon aşaması

Kaynak hazırlığı → düşük maliyetli uygunluk kontrolü → Gemini → sürümlü sonuç şeması ve sayısal doğrulama → kanıtlı bulgu/öneriler akışı planlanmıştır. AI anahtarları yalnız backend'de tutulacaktır.

Proje planındaki ana model `gemini-3.8-flash`; 31 Aralık 2026 sonrası model ve fiyatlar yeniden değerlendirilecek. Model erişimi, düşünme seçenekleri ve kampanya koşulları entegrasyon sırasında doğrulanmalıdır; mevcut kod model çağırmaz ve fiyat garantisi vermez. PDF/Office normalizasyonu, PDF raporu, Google girişi ve ödeme gelecekteki işlerdir.
