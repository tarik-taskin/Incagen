# Proje çalışma talimatları

her görev bitiminde ya da uzun görevlerde belli amaçla yapılan değişiklikler bittiğinde git add . ; git commit -m "feat(frontend/employees): limit shift list" (bir örnek daha: fix(frontend/bills): fix Turkish labels) şeklinde bir commit atacaksın. commitler atomik olmasa da genel olarak bir işlevi ya da amacı karşılayacak kadar küçük olmalıdır. büyük planlar için 8,9 commit küçük değişiklikler için 1-2 commit yeterli. değişikliklerin büyüklüğüne bağlı olarak her commit mesajından sonra 2-6 adet açıklama maddesi de mesaja dahil edilecek. ayrıca yaptığın commit ya da commitleri en sonda belirtmeni istiyorum. projede genel akışı kullanıcı tarafından fazla etkilemeyen commit edilmemiş küçük değişiklikler tespit edersen bunları da commit'lere dahil et. Her göreve başlamadan önce proje kökündeki `GOAL.md`, `MEMORY.md`, `RULES.md`, `FLOW.md` ve `AGENTS.md` dosyalarını oku.

## Proje belgeleri ve amaçları

Her görevin başında belgeler aşağıdaki sırayla okunur:

1. `AGENTS.md`: Agent çalışma biçimini, commit standardını, belge sorumluluklarını ve ekip koordinasyonunu belirler.
2. `GOAL.md`: Aktif milestone'u, uzun vadeli hedefleri, görev durumlarını, sahipleri, kalite kapılarını, riskleri ve karar günlüğünü tutar.
3. `MEMORY.md`: Yeni oturumların projeyi tekrar keşfetmeden devam edebilmesi için kalıcı ürün bağlamını ve mevcut durumu özetler.
4. `RULES.md`: Stil, güvenlik, branch ve kalite konusunda bağlayıcı geliştirme kurallarını tanımlar.
5. `FLOW.md`: Kullanıcı akışını, plan farklarını, veri hattını ve teknik mimari kararlarını açıklar.
6. `README.md`: Yeni ekip üyeleri için kurulum, komutlar ve proje yapısını anlatır.

Belgelerin sorumlulukları birbirine karıştırılmaz. Roadmap ayrıntısı `GOAL.md`, sistem akışı `FLOW.md`, kalıcı bağlam `MEMORY.md`, bağlayıcı kurallar `RULES.md` içinde tutulur. Bir karar birden fazla belgeyi etkiliyorsa her belgede yalnız o belgenin amacına uygun kısmı güncellenir.

## Goal çalışma düzeni

- Bir iş geliştirmeye başlamadan önce `GOAL.md` içinde bulunmalı veya eklenmelidir.
- İş `[~]` durumuna alınmadan önce sahibi `Tarık` ya da `Furkan` olarak atanır.
- Tamamlandı işareti yalnız kod, gerekli testler ve kabul kriterleri doğrulandıktan sonra kullanılır.
- Engelli işler `[!]` olarak işaretlenir; engelin nedeni ve ihtiyaç duyulan karar aynı maddede belirtilir.
- Her `main` pull request birleşiminde tamamlanan işler, aktif milestone, riskler ve karar günlüğü güncellenir.
- Yeni teknik kararlar mevcut `RULES.md` ve `FLOW.md` ile çelişmemelidir; çelişiyorsa aynı pull request içinde belgeler birlikte düzeltilir.

## Ekip ve Git akışı

- Görev sahipliği milestone başında veya iş başlamadan önce görev bazında belirlenir; kalıcı frontend/backend sahipliği yoktur.
- Tarık ve Furkan kendi branch'lerinde çalışır ve kritik değişiklikleri karşılıklı inceler.
- `main` için normal akış pull request ve en az bir ekip arkadaşı onayıdır.
- Commit mesajları conventional commit biçiminde ve yapılan amacı anlatacak küçüklükte olmalıdır.
