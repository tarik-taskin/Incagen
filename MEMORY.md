# Incagen Proje Hafızası

Incagen, işletmelerin verilerini analiz ederek grafikler, tablolar ve uygulanabilir büyüme önerileri sunmayı amaçlar.

## Teknoloji ve kalıcı bağlam

- Frontend: React, TypeScript, Vite, React Router, Tailwind CSS, shadcn/ui yaklaşımı ve Anime.js.
- Planlanan backend Firebase, ana AI sağlayıcısı Google Gemini'dir; henüz entegre değildir.
- Ana renkler `#4c2a85` ve `#bcedf6`; yardımcı palet `#320E3B`, `#ff0035`, `#DDFBD2`.
- Çalışma kuralları [AGENTS.md](AGENTS.md), teknik kurallar [RULES.md](RULES.md), ürün davranışı [FLOW.md](FLOW.md) içindedir.

## Tamamlanan temel

- Responsive giriş ekranı, açık/koyu tema ve animasyonlu Incagen logosu.
- Yeni analiz, geçmiş ve ayarlar için responsive uygulama kabuğu; görünür Premium çağrısı ve uygulama içinden tarayıcı geri tuşuyla landing sayfasına dönüş.
- FLOW.md formatlarında çoklu dosya seçimi; tekrar, uzantı ve Free plan 10 dosya ön kontrolü.
- Vitest/React Testing Library birim-bileşen testleri, Playwright masaüstü-mobil akışları ve WCAG A/AA kontrolü.
- Pull request ve `main` güncellemelerinde çalışan GitHub Actions kalite iş akışı.

Dosya hazırlığı henüz yükleme veya AI işlemi başlatmaz; Authentication, Firebase backend ve sonuç ekranı uygulanmamıştır.
