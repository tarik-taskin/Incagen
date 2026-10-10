# Incagen Proje Hafızası

Incagen işletme verilerinden grafikler, tablolar ve büyüme önerileri üretmeyi amaçlar.

## Kalıcı bağlam

- React, TypeScript, Vite, React Router, Tailwind, shadcn/ui yaklaşımı ve Anime.js.
- `npm run dev` ve canlı Netlify aynı Firebase Auth önizlemesini kullanır; tam sentetik Auth/Firestore/Storage/Functions akışı `npm run dev:emulator` ile çalışır. Gemini entegrasyonu gelecekteki iştir.
- Ana renkler `#4c2a85`, `#bcedf6`; yardımcı renkler `#320E3B`, `#ff0035`, `#DDFBD2`.
- Çalışma kuralları AGENTS.md, teknik kurallar RULES.md, davranış/limitler FLOW.md içindedir.
- Zorunlu analiz hedefi (1–500 karakter) taslakta korunur, hazırlık kaydında saklanır ve sonuçta gösterilir; başarılı hazırlık yeni iş için hedefi temizler.
- Kabul edilen sonraki AI mimarisi ve kalite kapısı [FLOW.md](FLOW.md#kabul-edilen-hedef-mimari--2026-10-10) içindedir; Python işçisi, kaynaklı LLM sonuçları ve React/ECharts sunumu geliştirme hedefidir.
- Özetleme başlangıç referansları [fixtures/analysis-reference](fixtures/analysis-reference/README.md) içindedir; sentetik satış/yorum kaynakları, elle yazılmış cevaplar ve kalite protokolü mevcut parser üzerinden doğrulanır. LLM değerlendirmesi henüz çalıştırılmadı.

## Tamamlanan özellikler

- Responsive giriş/çalışma alanı, tema, animasyonlu logo, Premium bilgilendirmesi.
- E-posta/parola kaydı, giriş, korumalı rotalar, bağlı e-postaya şifre yenileme isteği, çıkışta taslağın temizlenmesi ve yerel emülatörde yeniden doğrulamalı hesap silme.
- Oturum içi çoklu iş belgesi seçimi; yalnız gerçekten ayrıştırılan modern formatlardan oluşan ortak plan kapsamı.
- Yerel yükleme; MIME/imza ve güvenli arşiv doğrulaması; metin, tablo, PDF, modern Office ve görsel ayrıştırma.
- Kaynak hash'i ve sayfa/çalışma sayfası/slayt/satır konumlarını taşıyan normalize, sıkıştırılmış server-only artefaktlar.
- Kullanıcıya özel canlı geçmiş, rapor açma ve kaynaklarla silme.
- Free/Premium karşılaştırması; Free 2 analiz/gün, 5 dosya/analiz, 25 MB toplam; gelecekteki Premium 5 analiz/gün, 10 dosya/analiz, 50 MB toplam. Ayrı dosya başı MB sınırı yoktur. Google Analytics ve Microsoft Clarity bağlantıları Ayarlar'da pasif taslaktır.
- Backend kota/idempotency, kullanıcı izolasyonu ve otomatik test altyapısı.

Tam belge/analiz akışı yalnız demo emülatörleri ve sentetik veriler içindir. Canlı Netlify tüm ekranları gösterir, fakat backend işlemleri etkin değildir; AI analizi yoktur. Kurulum README.md, kalan işler GOAL.md üzerinden takip edilir.
