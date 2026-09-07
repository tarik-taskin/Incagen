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
- main değişiklikleri PR ve en az bir ekip arkadaşı onayıyla birleştirilir; koruma aşılmaz.
- Her görev sonunda veya uzun işlerde anlamlı bir amaç tamamlanınca değişiklikleri inceleyip `git add .` ve commit yap.
- Mesaj örnekleri: `feat(frontend/employees): limit shift list`, `fix(frontend/bills): fix Turkish labels`.
- Commit gövdesine büyüklüğüne göre 2–6 açıklama maddesi ekle. Commit'ler tek bir işlevi veya amacı karşılayacak kadar küçük olsun; büyük planlarda yaklaşık 8–9, küçük değişikliklerde 1–2 commit yeterlidir.
- Genel akışı önemli ölçüde etkilemeyen mevcut küçük değişiklikleri inceleyerek uygun commit'e dahil et; ilgisiz veya anlamı belirsiz kullanıcı değişikliklerini koru.
- Son yanıtta yapılan commit'leri belirt.
- Her main birleşiminde GOAL.md durumunu kontrol et; yalnız değişen görev, milestone, risk veya gerçek ürün/teknik kararları güncelle. Sırf PR/merge kaydı için belge commit'i oluşturma.
