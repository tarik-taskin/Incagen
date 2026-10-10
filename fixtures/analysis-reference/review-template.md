# Referans koşusu değerlendirme kaydı

Bu şablon LLM bağlantısı sonrasında doldurulur; boş alanlar ölçülmüş sonuç değildir.

| Alan | Değer |
| --- | --- |
| Koşu kimliği / tarih / inceleyen | |
| Git commit / fixture sürümü / politika sürümü / vaka kimliği | |
| Kaynak ve cevap anahtarı SHA-256 | |
| Model sağlayıcı / model tam sürümü | |
| İstem sürümü / üretim sonuç şeması sürümü | |
| Model ayarları / varsa seed / parser-hesaplayıcı sürümü | |
| Cevap anahtarının modele verilmediği doğrulaması | |
| Toplam süre / girdi-çıktı token / maliyet ve para birimi (ölçülmediyse not-measured) | |
| Ham cevap artefaktı / doğrulanmış sonuç artefaktı | |

## Zorunlu kapılar

| Kapı | pass / fail / needs-review / not-run | Kanıt veya hata, kaynak satırı |
| --- | --- | --- |
| Üretim sonuç şeması | | |
| Minimum bulgu/metrik/kapsam içeriği | | |
| Sayı, iş kuralı, payda ve tolerans | | |
| Kaynak kimliği/hash/locator doğruluğu | | |
| Kapsam, belirsizlik ve yasak çıkarımlar | | |
| Karma anlam ve karşı örnekler | | |
| Grafik ile metrik eşleşmesi | | |
| Varyantta eksik/yanıltıcı girdi davranışı | | |

## Puanlama

[Politikadaki](evaluation-policy.json) full / partial / zero ankora göre puanlayın; partial üst sınırın yarısıdır. Her kesintiyi çıktı alıntısı ve kaynakla gerekçelendirin. Baz vakada kapı atlanamaz; varyantın gerektirdiği N/A alanını ve nedenini ayrıca yazın.

| Boyut | Puan / üst sınır | Kesinti gerekçesi ve örnek |
| --- | --- | --- |
| Sayısal doğruluk | /25 | |
| Kaynak güvenilirliği | /25 | |
| Kapsam ve belirsizlik | /20 | |
| Bulgular ve eylemler | /15 | |
| Grafik uygunluğu | /10 | |
| Anlatım | /5 | |
| Toplam | /100 | |

Karar: pass / fail / needs-review / not-run. Cevap sızıntısı varsa invalid-run; kabul hesabına katılmaz.

Minimum içerik kontrolü: gerekli bulgu anlamları / metrikler / kapsam notları karşılandı mı? Eksik olanlar:

Üç koşunun ayrı sonuçları ve en düşük puanı:

| Koşu | Kapılar | Puan | Karar |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

İkinci inceleyen ve anlaşmazlık kararı:

İzlenecek düzeltme ve yeniden koşulacak vakalar:

Varyant varsa: baz vaka, uygulanan değişiklik, yeni girdi hash'i, beklenen kontrollü durum ve gözlenen davranış:
