# Incagen Proje Hafızası

Bu dosya, yeni çalışma oturumlarında projenin temel bağlamını tekrar anlatmaya gerek kalmadan devam edebilmek için tutulur.

## Temel bilgiler

- Incagen, işletmelerin yüklediği müşteri ve operasyon verilerini analiz ederek grafikler, tablolar ve uygulanabilir öneriler sunacak tek sayfalık bir web uygulamasıdır.
- Frontend React, TypeScript, Vite ve Tailwind CSS ile geliştirilmektedir.
- Backend için Firebase, yapay zekâ yorumları için Google Gemini API kullanılacaktır.

## Kalıcı kurallar

1. Her ana function'ın tepesine ne yaptığını ve temel mantığını kısa şekilde açıklayan bir yorum satırı eklenir.
2. GitHub'da `main`, `furkan` ve `tarik` branchleri bulunur. Furkan ve Tarık kendi branchlerinde çalışır; tamamlanan değişiklikler kontrol edildikten sonra `main` branchine alınır.
3. API anahtarları, servis hesabı bilgileri ve müşteri verileri repoya eklenmez.
4. `index.html` içine CSS yazılmaz. Bu dosya yalnızca HTML iskeleti, metadata ve kaynak bağlantıları için kullanılır.
5. Global tasarım tokenları ve gerçekten uygulama genelinde geçerli temel kurallar `src/index.css` içindeki Tailwind katmanlarında tutulur. `button`, `input`, `a` gibi elementleri topluca biçimlendiren global seçiciler kullanılmaz.
6. Bileşen stilleri ilgili React bileşeninde Tailwind sınıflarıyla; tekrar kullanılan varyantlar shadcn/ui ve CVA yaklaşımıyla yönetilir. Ayrıntılı ve bağlayıcı kurallar için her görevde `RULES.md` okunur.

## Mevcut durum

- Responsive açılış ekranı, açık/koyu tema ve animasyonlu Incagen logosu hazırdır.
- Tarayıcı sekmesi Incagen favicon'unu kullanır.
- Dosya seçici tablo, belge, sunum, yapılandırılmış veri ve görsel türlerinde birden fazla dosya seçilebilecek şekilde hazırlanmıştır.
- Dosya yükleme, Firebase, Gemini ve sonuç ekranı henüz uygulanmamıştır.
