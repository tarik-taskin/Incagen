# Atlas Perakende kaynak dosyası

Atlas Perakende bu gösterim için kurgulanan bir işletmedir. Örnek rapor 2025'in 12 ayını kapsar; gerçek müşteri veya şirket verisi içermez. Kaynaklar ve hesaplar sürümlüdür.

## Güncel paket v2

| Belge | İçerik | Kapsam |
| --- | --- | --- |
| `atlas-performans-2025.pdf` | Yıllık yönetim raporu | 7 sayfa; aylık hedefler, kategori, kanal, bölge, hizmet ve mali mutabakat |
| `atlas-ticari-degerlendirme-2025.docx` | Ticari değerlendirme | 5 sayfa; kanal ekonomisi, portföy, risk ve kontrol noktaları, karar planı |
| `atlas-satis-2025.csv` | Ayrıntılı mali kırılımlar | 3.456 satır; 12 ay × 4 bölge × 3 kanal × 8 kategori × 3 segment |
| `atlas-butce-2025.csv` | Net satış bütçesi | 12 aylık hedef |
| `atlas-operasyon-2025.csv` | Sevkiyat ve teslimat | 144 ay × bölge × kanal kaydı |

Toplam 3.612 tablo kaydı vardır. PDF ve Word içindeki tekrar eden toplamlar bu sayıya eklenmez ve mali hesaplarda tekrar sayılmaz. Satış satırları tekil sipariş değil, aylık kırılım toplamıdır. Siparişler bu kırılımlarda ayrık tanımlanır. Sipariş, ürün adedi ve müşteri sayısı birbirinin yerine kullanılmaz.

## Hesap tanımları

Tutarlar TRY ve KDV hariçtir. Net satış = brüt satış − satır indirimi − iade. İndirim ve iadeler satır toplamıdır; adet ile yeniden çarpılmaz. Satılan mal maliyeti iade sonrası net maliyettir. Brüt kâr = net satış − mal maliyeti. Katkı = brüt kâr − pazarlama − sipariş karşılama; genel gider/vergi/finansman olmadığı için net kâr değildir. Bütçe hedefi gelecek tahmini değildir. Teslimat oranı toplam zamanında teslim edilen / toplam sevk edilen sipariş üzerinden ağırlıklı hesaplanır.

Tablolar seçilen döneme filtrelenir. PDF ve Word yıllık belgeler olarak kalır; rapordaki yönetim notlarında yıllık kapsam açıkça gösterilir. PDF sayfa konumu gerçek parser çıktısından gelir. Word parser'ı metin bölümlerini korur; fiziksel sayfa konumu iddia edilmez. Tam belge özgün dosya olarak indirilebilir.

## Üretim ve doğrulama

- `node scripts/create-company-fixtures.cjs --enterprise`: v2 CSV'leri kararlı formüllerle üretir.
- `scripts/create-company-documents.py --font-dir <DejaVu-font-klasörü>`: belge üretim ortamında PDF/DOCX'i oluşturur. `python-docx` ve ReportLab yalnız bu yazar aracının bağımlılıklarıdır; uygulamaya Python servisi veya model çağrısı eklemez.
- `npm run example:build`: **kaydedilmiş beş özgün dosyayı gerçek parser'lardan** geçirir, hash'leri doğrular ve normalize kaynak, tekli indirme ve ZIP artefaktlarını üretir. Normal uygulama/CI derlemesi Python veya LibreOffice gerektirmez.
- `node scripts/build-sales-example.cjs --check`: kaydedilmiş dosyalarla artefaktların eşitliğini denetler.

[v2 beklenen toplamları](v2/expected.json) Python Decimal ile TypeScript hesaplayıcısından bağımsız hesaplanmıştır; istemci ve rapor üreticisi cevap anahtarını okumaz. PDF/Word içindeki sayılar aynı CSV'lerden bağımsız hesaplanır; birim testleri sayı ve alıntıların normalize içerikte bulunduğunu kontrol eder. Manifest dosyaların SHA-256 değerlerini taşır; ZIP ve tekli indirmeler özgün baytlarla karşılaştırılır.

Kaynak kanıtları yalnız bitişik satırları aynı parser parçasında birleştirir. Ayrık kayıtları kapsayan sahte aralık oluşturulmaz. Çok boyutlu örneğin kanıt listesi başına 256 aralık üst sınırı vardır; fazlası sessiz kesilmez. Bu bağımsız örnek gerçek AI çıktısı veya kullanıcı hesabı analizi değildir.

## Korunan önceki sürüm

[v1 kaynakları](v1/manifest.json) ve [bağımsız v1 toplamları](expected.json) korunur: 864 satış, 12 bütçe, 72 operasyon kaydı. `node scripts/create-company-fixtures.cjs` varsayılan olarak bu sürümü üretir. Daha küçük [satış ve müşteri yorumları referansları](../analysis-reference/README.md) da değişmez.
