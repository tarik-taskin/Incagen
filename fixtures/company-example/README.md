# Atlas Teknoloji kaynak dosyası

2025 teknoloji ve profesyonel hizmetler örneği. Dokuz belge, sekiz format ve 3.612 tablo kaydı aynı dönem/kapsama aittir. Şirket ve veriler bu örnek için hazırlanmıştır; gerçek müşteri kaydı içermez.

## Güncel paket v3

| Belge | İçerik | Kapsam |
| --- | --- | --- |
| `atlas-performans-2025.pdf` | Yıllık performans raporu | 7 sayfa: gelir, bütçe, hizmet alanı, kanal, bölge, mali mutabakat |
| `atlas-ticari-degerlendirme-2025.docx` | Ticari değerlendirme | 5 sayfa: kanal ekonomisi, hizmet portföyü, kontrol ve karar planı |
| `atlas-satis-2025.csv` | Ayrıntılı mali kayıtlar | 3.456 satır: 12 ay × 4 bölge × 3 kanal × 8 hizmet alanı × 3 segment |
| `atlas-butce-2025.xlsx` | Yıllık bütçe girdileri | Bir sayfa, 12 aylık hedef; düzenlenebilir sayısal hücreler |
| `atlas-operasyon-2025.csv` | Hizmet operasyonu | 144 ay/bölge/kanal kaydı: tamamlanan, zamanında ve geciken işler |
| `atlas-yonetim-2025.pptx` | Yönetim sunumu | 3 slayt; düzenlenebilir metinler ve hizmet portföyü tablosu |
| `atlas-rapor-baglami-2025.json` | Veri sözlüğü | Şirket modeli, alan tanımları, dönem ve kapsam sınırları |
| `atlas-hesap-yontemi-2025.md` | Hesap yöntemleri | Mali formüller, paydalar ve çift sayımı önleyen kurallar |
| `atlas-yonetim-devir-notu-2025.txt` | Ekip devir notu | Finans, satış ve hizmet operasyonu için takip başlıkları |

PDF/Word/sunum aynı kayıtların yönetim görünümüdür; tekrar edilen toplamlar hesaplara yeniden eklenmez. JSON, Markdown ve metin belge bağlamı sağlar. Görsel kaynak yoktur. Kaynak CSV bütçesi yalnız üretim ara girdisidir; yayımlanan pakette bütçenin özgün kaynağı XLSX'tir.

## Hesaplar ve yorum sınırı

Tutarlar TRY, KDV hariçtir. Net satış = brüt gelir − satır indirimi − hizmet kredisi. Bu alanlar satır toplamıdır; faturalanabilir birimle yeniden çarpılmaz. Brüt kâr = net satış − doğrudan hizmet maliyeti. Katkı = brüt kâr − satış/pazarlama − hizmet operasyonu. Doğrudan maliyet ve operasyon ayrı gider sınıflarıdır. Genel gider/vergi/finansman olmadığı için katkı net kâr değildir.

Hizmet işleri ayrık aylık kırılımlarda tanımlıdır; tekil müşteri veya sözleşme sayısı değildir. Faturalanabilir birim alanı hizmet türüne göre farklı anlamlar taşır ve fiziksel ürün toplamı olarak sunulmaz. Zamanında tamamlanma = toplam zamanında tamamlanan / toplam tamamlanan hizmet işi × 100; aylık oranların ortalaması alınmaz. Bütçe ve gerçekler aynı aylar için karşılaştırılır. Abonelik/ARR, müşteri kaybı, sözleşme yenileme veya kampanya nedenselliği bu paketten hesaplanmaz.

Dönem filtresi yalnız üç sayısal kaynağa birlikte uygulanır. PDF, Word ve sunum yıllık belgeler olarak kalır. PDF sayfası, Excel sayfası/satırı, PowerPoint slaytı ve metin bölümü gerçek parser konumudur. Word için fiziksel sayfa konumu iddia edilmez.

## Yeniden üretim ve doğrulama

1. `node scripts/create-company-fixtures.cjs --technology`: v3 CSV girdileri.
2. `scripts/create-technology-documents.py --font-dir <DejaVu-font-klasörü>`: bağımsız Decimal toplamları, PDF ve Word. Yalnız belge yazarlığında ReportLab/python-docx gerekir.
3. `scripts/create-technology-office.mjs`: Codex'in bundled artifact runtime'ıyla Excel ve sunum. `INCAGEN_ARTIFACT_MODULES`, `INCAGEN_ARTIFACT_PYTHON`, `INCAGEN_PRESENTATION_SKILL` yolları yazar ortamından verilir. Önizlemeler ve doğrulama raporu geçici klasörde tutulur.
4. `node scripts/complete-technology-sources.cjs`: doğrulanmış Office çıktılarını, bağlam ve metin kaynaklarını manifestte birleştirir; ZIP zamanlarını ve eşdeğer SpreadsheetML ad alanını normalize eder. Gömülü nesne veya makro gerektirmez.
5. `npm run example:build`: dokuz özgün dosyayı gerçek ayrıştırıcılardan geçirir; hash/konumlar, tekli indirme ve ZIP artefaktlarını üretir.
6. `node scripts/build-sales-example.cjs --check`: kaydedilmiş kaynaklarla dağıtılan artefaktların bayt eşitliği.

Normal uygulama/CI derlemesi Python, LibreOffice veya artifact runtime gerektirmez. [V3 bağımsız cevapları](v3/expected.json) istemci tarafından okunmaz; dört dönemin metrik/grafik/tablo toplamları bu cevaplarla test edilir. Doküman sayıları, alıntılar, gerçek hash ve konumlar kontrol edilir. Ayrık kanıt satırları aradaki ilgisiz kayıtları kapsayan sahte aralığa dönüştürülmez.

## Korunan sürümler

[V2 perakende kaynakları](v2/manifest.json) ve [cevapları](v2/expected.json), [v1 kaynakları](v1/manifest.json) ve [v1 cevapları](expected.json) değişmez. `--enterprise` v2'yi, varsayılan komut v1'i üretir. Daha küçük [satış ve yorum referansları](../analysis-reference/README.md) da kendi sürümleriyle korunur.
