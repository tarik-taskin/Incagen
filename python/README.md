# Python extraction temeli

PDF, Word, Excel ve düz metin kaynaklarını **kaynak hash'i ve konumlarıyla** mevcut `ParsedDocument v1` sözleşmesine dönüştürür. Yerel ve çevrimdışı çalışır; Gemini çağırmaz, Firebase'e yazmaz ve mevcut TypeScript hazırlama hattının yerine geçmez.

| Paket | Sorumluluk |
|---|---|
| pdfplumber | Metin katmanlı PDF'lerde sayfa metni ve çizgili tablolar |
| python-docx | DOCX gövdesindeki paragraf ve tablolar, belge sırası |
| openpyxl | XLSX çalışma sayfaları ve fiziksel satırlar; formül yürütülmez |
| pandas | Tablo satır/sütun ve eksik hücre profili; finansal anlam/birim tahmin edilmez |
| defusedxml | Office arşivlerindeki XML entity/dış kaynak koruması |

## Kurulum ve kullanım

Python 3.12 ve Node.js proje gereksinimleri gerekir. Sistem paketlerine kurulum yapılmaz:

```bash
python3.12 -m venv python/.venv
python/.venv/bin/python -m pip install --require-hashes -r python/requirements.lock
npm run build:functions
npm run test:python
PYTHONPATH=python/src python/.venv/bin/python -m incagen_extract path/to/document.pdf --source-id file-0
```

Windows'ta sanal ortam komutları `python/.venv/Scripts/python.exe` ile çalıştırılır. `requirements.lock`, `pyproject.toml` içinden `uv pip compile --extra test --universal --generate-hashes` ile üretilir; doğrudan ve geçişli sürümler/hash'ler kilitlidir. Sanal ortam, indirilen Python çalışma zamanı ve yerel araçlar Git dışındadır.

## Kapsam ve sınırlar

- UTF-8 CSV/TSV, TXT/Markdown, XLSX, DOCX ve metin katmanlı PDF desteklenir. Diğer mevcut formatlar TypeScript hattında kalır.
- Ham belge SHA-256'sı, sayfa/çalışma sayfası/Word gövde bölümü ve tablo satır aralığı korunur. Boş Excel satırları atılmaz. Word bölümü `block-N`, gövdenin sıralı paragraf veya tablosudur; sayfa numarası uydurulmaz.
- Excel formülleri yürütülmez ve önbellek değeri kesin sonuç sayılmaz; ilgili hücre `null` ve açık uyarı üretir. CSV sayı biçimleri metin olarak korunur; `1.234,56` sessizce dönüştürülmez.
- Taranmış PDF'de OCR yapılmaz; sayfa `image` parçası ve uyarı olarak korunur. PDF'nin metin ve tablo görünümleri örtüşebilir; aynı kayıt iki kez sayılmamalıdır. PDF hücre çıkarımı kesin finansal metrik kabulü değildir.
- 25 MiB girdi, 250 PDF sayfası, 50 çalışma sayfası, 50.000 tablo satırı, 200 sütun, 500.000 hücre, 1.000 parça ve 1 milyon metin karakteri sınırları vardır. Sınır aşımı sessiz kesme yerine hata verir.
- Office arşivi açılım sınırı, tekrarlı/tehlikeli yollar, dış ilişkiler, entity, makro ve gömülü aktif içerik kontrol edilir. Bu kontroller zararlı yazılım taraması veya süreç izolasyonunun yerine geçmez.

Bu genel extraction aracı TypeScript hazırlama hattının yerine geçmez. CSV/XLSX için aşağıdaki ayrı Cloud Run işçisi eklendi; Docling/OCR, kalıcı iş kuyruğu ve çok belgeli hedefe göre içerik seçimi sonraki kapsamdadır. Python çıktısı sunucu paket kapısından geçmeden modele verilmez. Testler küçük sentetik PDF/DOCX/XLSX/CSV, kaynak eşliği, bozuk/parolalı belge, formül, satır aralığı ve TypeScript sözleşmesini kapsar.

## Seçili tablo hesabı ve özel HTTP işçisi

`incagen_extract.analyze`, CSV/XLSX içinden kullanıcı tarafından seçilen tablo/ölçümü `Decimal` ile hesaplar. `server` modülü sabit HTTP sınırı ve süre/bellek kısıtlı çocuk parser kullanır; model veya veri servisi kimlik bilgisi almaz. Container runtime bağımlılıkları test araçlarından ayrı `requirements.runtime.lock` içindedir. 5 Kasım’da ayrı veri/secret yetkisi olmayan kimlikle özel Cloud Run servisine dağıtıldı; Linux CPU/bellek kısıtlı container kabulü geçti. Gerçek model kalite kabulü sağlayıcının kapasite hatasında kaldığından kullanıcı analizi kapalıdır. Kapsam, hesap kuralları ve somut dağıtım planı [ilk tablo analizi rehberindedir](../docs/TABULAR-ANALYSIS.md).
