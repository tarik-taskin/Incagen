# Incagen Proje Hafızası

Bu dosya, yeni çalışma oturumlarında projenin temel bağlamını tekrar anlatmaya gerek kalmadan devam edebilmek için tutulur.

## Temel bilgiler

- Incagen, işletmelerin yüklediği müşteri ve operasyon verilerini analiz ederek grafikler, tablolar ve uygulanabilir öneriler sunacak bir web uygulamasıdır.
- Frontend React, TypeScript, Vite ve Tailwind CSS ile geliştirilmektedir.
- Backend için Firebase; uzun dosya ve AI işleri için Python Cloud Run; yapay zekâ yorumları için Google Gemini API kullanılacaktır.
- İlk işlevsel müşteri profili KOBİ yöneticisidir. E-ticaret ve ajans/danışman seçenekleri onboarding içinde pasif “Yakında” durumunda bulunacaktır.

## Kalıcı kurallar

1. Her ana function'ın tepesine ne yaptığını ve temel mantığını kısa şekilde açıklayan bir yorum satırı eklenir.
2. GitHub'da `main`, `furkan` ve `tarik` branchleri bulunur. Furkan ve Tarık kendi branchlerinde çalışır; tamamlanan değişiklikler kontrol edildikten sonra `main` branchine alınır.
3. API anahtarları, servis hesabı bilgileri ve müşteri verileri repoya eklenmez.
4. `index.html` içine CSS yazılmaz. Bu dosya yalnızca HTML iskeleti, metadata ve kaynak bağlantıları için kullanılır.
5. Global tasarım tokenları ve gerçekten uygulama genelinde geçerli temel kurallar `src/index.css` içindeki Tailwind katmanlarında tutulur. `button`, `input`, `a` gibi elementleri topluca biçimlendiren global seçiciler kullanılmaz.
6. Bileşen stilleri ilgili React bileşeninde Tailwind sınıflarıyla; tekrar kullanılan varyantlar shadcn/ui ve CVA yaklaşımıyla yönetilir. Ayrıntılı ve bağlayıcı kurallar için her görevde `RULES.md` okunur.
7. Aktif milestone, görev sahipleri ve kalite kapıları `GOAL.md` üzerinden takip edilir; bu dosya her `main` birleşiminde güncellenir.

## Mevcut durum

- Responsive açılış ekranı, açık/koyu tema ve animasyonlu Incagen logosu hazırdır.
- Tarayıcı sekmesi Incagen favicon'unu kullanır.
- Dosya seçici tablo, belge, sunum, yapılandırılmış veri ve görsel türlerinde birden fazla dosya seçilebilecek şekilde hazırlanmıştır.
- Dosya yükleme, Firebase, Gemini ve sonuç ekranı henüz uygulanmamıştır.
- Aktif çalışma `GOAL.md` içindeki M0 temel düzen ve kalite altyapısı milestone'udur.
