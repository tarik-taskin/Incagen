# Referans koşusu değerlendirme kaydı

Bu şablon LLM bağlantısı sonrasında doldurulur; boş alanlar ölçülmüş sonuç değildir.

| Alan | Değer |
| --- | --- |
| Koşu kimliği / tarih / inceleyen | |
| Git commit / fixture sürümü / vaka kimliği | |
| Kaynak SHA-256 | |
| Model sağlayıcı / model tam sürümü | |
| İstem sürümü / üretim sonuç şeması sürümü | |
| Model ayarları / parser-hesaplayıcı sürümü | |
| Cevap anahtarının modele verilmediği doğrulaması | |
| Toplam süre / girdi-çıktı token / maliyet ve para birimi | |
| Ham cevap artefaktı / doğrulanmış sonuç artefaktı | |

## Zorunlu kapılar

| Kapı | Geçti / kaldı | Kanıt veya hata, kaynak satırı |
| --- | --- | --- |
| Üretim sonuç şeması | | |
| Sayı, iş kuralı, payda ve tolerans | | |
| Kaynak kimliği/hash/locator doğruluğu | | |
| Kapsam, belirsizlik ve yasak çıkarımlar | | |
| Karma anlam ve karşı örnekler | | |
| Grafik ile metrik eşleşmesi | | |
| Varyantta eksik/yanıltıcı girdi davranışı | | |

## Puanlama

| Boyut | Puan / üst sınır | Kesinti gerekçesi ve örnek |
| --- | --- | --- |
| Sayısal doğruluk | /25 | |
| Kaynak güvenilirliği | /25 | |
| Kapsam ve belirsizlik | /20 | |
| Bulgular ve eylemler | /15 | |
| Grafik uygunluğu | /10 | |
| Anlatım | /5 | |
| Toplam | /100 | |

Karar: geçer / başarısız / insan incelemesi gerekiyor.

Üç koşunun ayrı sonuçları ve en düşük puanı:

| Koşu | Kapılar | Puan | Karar |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

İkinci inceleyen ve anlaşmazlık kararı:

İzlenecek düzeltme ve yeniden koşulacak vakalar:
