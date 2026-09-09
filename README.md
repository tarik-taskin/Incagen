# Incagen

Incagen, işletme verilerini yapay zekâ ile analiz ederek büyüme önerileri sunmayı amaçlayan bir web uygulamasıdır.

## Gereksinimler

- Node.js 22.13 veya üzeri
- npm 10 veya üzeri
- Git

## Kurulum

Projeyi klonladıktan sonra proje klasöründe aşağıdaki komutları çalıştır:

```bash
npm install
npm run dev
```

Uygulama terminalde gösterilen yerel adreste, varsayılan olarak `http://localhost:5173` üzerinde açılır.

## Kullanılabilir komutlar

```bash
npm run dev       # Geliştirme sunucusunu başlatır
npm run lint      # Kod kalite kontrolünü çalıştırır
npm run test:run  # Birim ve bileşen testlerini tek sefer çalıştırır
npm run test:e2e  # Masaüstü/mobil tarayıcı ve erişilebilirlik testlerini çalıştırır
npm run build     # Üretim derlemesini oluşturur
npm run preview   # Üretim derlemesini yerelde önizler
```

Playwright tarayıcısı ilk kullanımda `npx playwright install chromium` komutuyla kurulur.

## Kullanılan teknolojiler

- React 19, TypeScript ve React Router
- Vite 6 ve Tailwind CSS
- shadcn/ui yaklaşımı, Radix UI ve Lucide React
- Anime.js
- Vitest, React Testing Library, Playwright ve axe-core

## Proje yapısı

```text
src/
├── components/       Yeniden kullanılabilir arayüz ve yerleşim bileşenleri
├── features/         Ürün alanına ait saf kurallar ve modeller
├── hooks/            Yeniden kullanılabilir React durum yönetimi
├── pages/            Rota seviyesindeki ekranlar
├── test/             Ortak test kurulumu
├── App.tsx           Uygulama rotaları
└── main.tsx          React başlangıç noktası
e2e/                  Gerçek tarayıcı senaryoları
.github/workflows/     Pull request kalite iş akışları
```

## Mevcut durum

Ana sayfa, açık/koyu tema, responsive uygulama kabuğu ve yeni analiz çalışma alanı hazırdır. Dosya alanı desteklenen türlerde çoklu seçim yapar; yinelenen ve desteklenmeyen dosyaları açıklar, Free planın analiz başına 10 dosya sınırını uygular. Bu kontroller kullanıcı deneyimi içindir; dosya yükleme, Authentication, Firebase backend ve yapay zekâ analizi henüz bağlı değildir.

Ayrıntılar: [hedefler](GOAL.md), [ürün ve sistem akışı](FLOW.md), [teknik kurallar](RULES.md), [kalıcı bağlam](MEMORY.md) ve [ekip/agent çalışma düzeni](AGENTS.md).

PR açmadan önce şu kontrolleri çalıştır:

```bash
npm run lint
npm run test:run
npm run build
npm run test:e2e
```
