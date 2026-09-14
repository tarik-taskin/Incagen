# Incagen — Ürün ve Sistem Akışı

## Çalışan yerel dikey akış

E-posta/parola kaydı → korumalı çalışma alanı → CSV seçimi ve sütun eşleştirme → yerel Storage yüklemesi → Functions hesaplaması → Firestore raporu → geçmişten açma veya kaynaklarıyla silme.

Bu sürüm yalnız `demo-incagen` Firebase emülatörleriyle çalışır. Gerçek buluta fallback veya canlı yayına uygunluk iddiası yoktur. Yalnız sentetik veriler kullanılmalıdır. AI yorumu henüz eklenmedi; sayısal sonuçlar gerçek CSV verisinden deterministik hesaplanır.

## Free ve Premium

Ürün limitlerinin belge kaynağı bu tablodur. Frontend plan bilgileri merkezi plan kurallarında, backend uygulanmış Free sınırları ortak analiz sözleşmesinde tutulur; değişiklikte üçü birlikte doğrulanır.

| Özellik | Free | Premium (planlanan) |
|---|---|---|
| Günlük analiz | 10 | 30 |
| Analiz başına dosya | 10 | 30 |
| AI derinliği | Medium | High |
| Harici kaynak | Yok | Önce Google Analytics, sonra Microsoft Clarity |

Premium ödeme ve yetkilendirmeleri henüz uygulanmadı. Mevcut oturumlar Free kabul edilir. Günlük kota sunucunun `Europe/Istanbul` takvim gününe göredir; işlem başında transaction ile rezerve edilir. Başarısız işlemde iade edilir; tamamlanmış analizi silmek kotayı geri getirmez. Aynı istek ve tekrarlanan çalıştırmalar çift kota tüketmez.

## CSV ve rapor davranışı

- Geniş formatlı seçici korunur; bu sürümde yalnız CSV analize gönderilir. Diğer formatlar açık uyarıyla engellenir.
- UTF-8, virgül/noktalı virgül ve tırnaklı alanlar desteklenir. Başlıklar benzersiz olmalıdır.
- Her dosyada tarih ve satış tutarı zorunlu, kategori isteğe bağlı eşleştirilir. Sütunlar birbirinden farklı olmalıdır.
- Tarih: `YYYY-MM-DD` veya `DD.MM.YYYY`; sayı: Türkçe veya noktalı ondalık. Biçimler açık seçilir; belirsiz değerler tahmin edilmez.
- Tek analiz tek para birimi: TRY (varsayılan), USD veya EUR. Kur dönüşümü yapılmaz.
- Geçici geliştirme sınırları: 5 MB/dosya, 20 MB/analiz, 50.000 veri satırı, 100 sütun, 2.000 farklı gün; satır tutarı mutlak 100 milyon para birimini aşamaz.
- Boş satırlar sayılarak atlanır; hatalı dolu satırlar dosya ve CSV kayıt numarasıyla tüm işlemi durdurur. Kayıt numarası, tırnak içinde çok satırlı alanlarda fiziksel satır numarası değildir.
- Sonuç: toplam satış, işlem satırı sayısı, satır başına ortalama, günlük satış, isteğe bağlı kategori dağılımı, kaynak ve boş satır özeti.
- Paralar kuruşla hesaplanır; ortalama kuruşa yuvarlanır. Negatif tutarlar iade/düzeltme olarak toplamda korunur.
- Kategorilerin ilk 20'si ve kalanların toplamı gösterilir. Ortalama, sipariş kimliği olmadığı için sepet ortalaması diye adlandırılmaz.
- Raporda “Hesaplanan veri raporu — AI yorumu henüz eklenmedi” ibaresi zorunludur.

## Teknik sözleşme ve veri sahipliği

TypeScript Cloud Functions kullanılır; bugünkü küçük CSV işlerinde Cloud Tasks ve Python Cloud Run yoktur. Gelecekte bulut için ayrı dev/prod ve `europe-west1` varsayılır; kaynaklar henüz oluşturulmadı. Bölge veya saklama değişiklikleri gerçek veri kullanımı öncesinde yeniden değerlendirilir.

- `createAnalysis`: doğrulanmış başlık, işletme, para birimi, dosya manifesti ve eşleştirmelerle taslak oluşturur; istemcinin UUID istek kimliği ve içerik fingerprint'i tekrarları tekilleştirir.
- `runAnalysis`: kaynak boyutu, içerik türü, UTF-8, CSV, satır ve kota sınırlarını backend'de doğrular; sonucu kaydeder.
- `deleteAnalysis`: silme durumuyla yeni yazmayı kilitler, dosyaları ve raporu siler. İşlem sürerken silme reddedilir; yarım kalan silme tekrar denenebilir.
- İstemci taslağı bellektedir. Sunucuda kayıt `uploading → processing → completed/failed` durumlarından geçer; silmede geçici `deleting` kullanılır.
- Çalışan iş için 150 saniyelik yeniden deneme koruması vardır. Süre aşımı sonrası açık yeniden deneme eski rezervasyonu düzeltir ve yeni deneme kimliği kullanır; eski iş sonucu yeni işi ezemez. Otomatik kalıcı kuyruk henüz yoktur.
- Sonuçlar `users/{uid}/analyses/{id}`, kota `users/{uid}/quotas/{day}`, kaynaklar Storage içinde `users/{uid}/analyses/{id}/{fileId}` altında tutulur.
- Kullanıcı yalnız kendi verilerini okuyabilir. Manifest dışı yükleme ve istemcinin rapor/durum/kota yazması yasaktır. Backend yetkiyi oturum token'ından alır.
- İç sayfa geçişlerinde dosyalar, eşleştirmeler ve yükleme korunur. Çıkışta yükleme iptal edilir ve taslak temizlenir. Sayfa yenilemede yerel dosyalar yeniden seçilmelidir; kaydedilmiş analizler geçmişte kalır.
- Analizler kullanıcı silene kadar tutulur; mevcut emülatör verisi normal durdurmada kalıcı değildir. Gerçek müşteri için saklama/yedek politikası ayrıca onaylanmalıdır.

## Sonraki AI ve entegrasyon aşaması

Kaynak hazırlığı → düşük maliyetli uygunluk kontrolü → Gemini → JSON şeması ve sayısal doğrulama → kanıtlı bulgu/öneriler akışı planlanmıştır. AI anahtarları yalnız backend'de tutulacaktır.

Proje planındaki ana model `gemini-3.8-flash`; 31 Aralık 2026 sonrası model ve fiyatlar yeniden değerlendirilecek. Model erişimi, düşünme seçenekleri ve kampanya koşulları entegrasyon sırasında doğrulanmalıdır; mevcut kod model çağırmaz ve fiyat garantisi vermez. PDF/Office normalizasyonu, PDF raporu, Google girişi ve ödeme gelecekteki işlerdir.
