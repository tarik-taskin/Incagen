# Proje çalışma talimatları

## Görev başlangıcı ve belgeler

Önce çalışma dalını, çalışma ağacını ve bu dosyayı kontrol et. Kapsama göre ilgili belgeleri oku:

- [GOAL.md](GOAL.md): aktif milestone, görev sahipliği, kabul kriterleri, riskler ve açık kararlar.
- [MEMORY.md](MEMORY.md): kısa kalıcı bağlam ve tamamlanmış özellikler.
- [RULES.md](RULES.md): kod ve stil değişiklikleri için teknik kurallar.
- [FLOW.md](FLOW.md): ürün akışı, plan limitleri ve sistem davranışı.
- [README.md](README.md): kurulum, komutlar ve proje yapısı.

Bilgiyi tekrarlamak yerine asıl kaynağa bağlantı ver. Her geliştirme işi GOAL.md içinde bulunmalı; başlamadan sahibi Tarık veya Furkan olarak atanıp [~] yapılmalı. Yalnız gerekli kontroller ve kabul kriterleri doğrulanınca [x] kullan. Engelin nedenini ve beklenen kararı [!] işinin yanında yaz.

## Kod ve güvenlik

- Her ana function'ın üstüne amacını ve temel mantığını kısa bir yorumla açıkla.
- API anahtarları, servis hesabı bilgileri, kimlik bilgileri ve gerçek müşteri verileri repoya eklenmez.
- Teknik değişikliklerde RULES.md, ürün davranışında FLOW.md tutarlılığını kontrol et.

## Commit ve ekip düzeni

- Tarık ve Furkan kendi branch'lerinde çalışır; sahiplik görev bazında belirlenir.
- Her çalışma başlangıcında remote güncellenir; local `main`, `origin/main` ile fast-forward eşitlenir ve kişisel branch güncel `main` üzerine alınır. Kişisel branch'in remote karşılığı (`origin/furkan` veya `origin/tarik`) kullanılıyorsa onun durumu da kontrol edilir.
- Normal akışta değişiklikler kişisel branch'te hazırlanır ve kontrollerden sonra doğrudan `main`e push edilir. Push öncesinde `origin/main` yeniden kontrol edilir; yeni commit varsa önce kişisel branch'e alınır. `main`e force push yapılmaz.
- Push sonrasında local `main`, `origin/main`, aktif kişisel branch ve kullanılan remote kişisel branch aynı commit'e eşitlenir.
- Tarık ve Furkan ayrı kod alanlarında paralel çalışmaya başladığında değişiklikler PR ile birleştirilir. Bunun dışında PR yalnız açıkça istendiğinde açılır.
- `main`e push öncesinde en az `npm run lint`, `npm run test:run` ve `npm run build` çalıştırılır; kullanıcı akışını etkileyen değişikliklerde `npm run test:e2e` de çalıştırılır.
- Her görev sonunda veya uzun işlerde anlamlı bir amaç tamamlanınca değişiklikleri inceleyip `git add .` ve commit yap.
- Mesaj örnekleri: `feat(frontend/employees): limit shift list`, `fix(frontend/bills): fix Turkish labels`.
- Commit gövdesine büyüklüğüne göre 2–6 açıklama maddesi ekle. Commit'ler tek bir işlevi veya amacı karşılayacak kadar küçük olsun; büyük planlarda yaklaşık 8–9, küçük değişikliklerde 1–2 commit yeterlidir.
- Genel akışı önemli ölçüde etkilemeyen mevcut küçük değişiklikleri inceleyerek uygun commit'e dahil et; ilgisiz veya anlamı belirsiz kullanıcı değişikliklerini koru.
- Son yanıtta yapılan commit'leri belirt.
- Her `main` güncellemesinde GOAL.md durumunu kontrol et; yalnız değişen görev, milestone, risk veya gerçek ürün/teknik kararları güncelle. Sırf push/merge kaydı için belge commit'i oluşturma.
