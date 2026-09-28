# Incagen Proje Hafızası

Incagen işletme verilerinden grafikler, tablolar ve büyüme önerileri üretmeyi amaçlar.

## Kalıcı bağlam

- React, TypeScript, Vite, React Router, Tailwind, shadcn/ui yaklaşımı ve Anime.js.
- Yerel Firebase Auth/Firestore/Storage ve TypeScript Functions; canlı Netlify'da yalnız Firebase Auth önizlemesi. Gemini entegrasyonu gelecekteki iştir.
- Ana renkler `#4c2a85`, `#bcedf6`; yardımcı renkler `#320E3B`, `#ff0035`, `#DDFBD2`.
- Çalışma kuralları AGENTS.md, teknik kurallar RULES.md, davranış/limitler FLOW.md içindedir.

## Tamamlanan özellikler

- Responsive giriş/çalışma alanı, tema, animasyonlu logo, Premium bilgilendirmesi.
- E-posta/parola kaydı, giriş, korumalı rotalar, bağlı e-postaya şifre yenileme isteği, çıkışta taslağın temizlenmesi ve yerel emülatörde yeniden doğrulamalı hesap silme.
- Oturum içi çoklu iş belgesi seçimi; yalnız gerçekten ayrıştırılan modern formatlardan oluşan ortak plan kapsamı.
- Yerel yükleme; MIME/imza ve güvenli arşiv doğrulaması; metin, tablo, PDF, modern Office ve görsel ayrıştırma.
- Kaynak hash'i ve sayfa/çalışma sayfası/slayt/satır konumlarını taşıyan normalize, sıkıştırılmış server-only artefaktlar.
- Kullanıcıya özel canlı geçmiş, rapor açma ve kaynaklarla silme.
- Free/Premium karşılaştırması; planlanan Premium toplamı 60 MB. Google Analytics ve Microsoft Clarity bağlantıları Ayarlar'da pasif taslaktır.
- Backend kota/idempotency, kullanıcı izolasyonu ve otomatik test altyapısı.

Tam belge/analiz akışı yalnız demo emülatörleri ve sentetik veriler içindir. Canlı Netlify'da yalnız hesap akışı açılır; AI analizi yoktur. Kurulum README.md, kalan işler GOAL.md üzerinden takip edilir.
