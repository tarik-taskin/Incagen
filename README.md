# Incagen

Incagen, işletme verilerini yapay zekâ ile analiz ederek büyüme önerileri sunmayı amaçlayan bir web uygulamasıdır.

## Gereksinimler

- Node.js 18.20 veya üzeri
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
npm run dev      # Geliştirme sunucusunu başlatır
npm run build    # Üretim derlemesini oluşturur
npm run lint     # Kod kalite kontrolünü çalıştırır
npm run preview  # Üretim derlemesini yerelde önizler
```

## Kullanılan teknolojiler

- React 19 ve TypeScript
- Vite 6
- Tailwind CSS
- shadcn/ui yaklaşımı ve Radix UI
- Anime.js
- Lucide React

## Proje yapısı

```text
src/
├── components/       Yeniden kullanılabilir arayüz bileşenleri
│   └── ui/           shadcn/ui tarzı temel bileşenler
├── lib/              Yardımcı fonksiyonlar
├── App.tsx           Ana sayfa ve uygulama akışı
├── index.css         Tema, Tailwind ve genel stiller
└── main.tsx          React başlangıç noktası
```

## Mevcut durum

Ana sayfa, aydınlık/karanlık tema ve Anime.js ile animasyonlu Incagen logosu hazırdır. Belge alanı görsel ve PDF dosyaları için sistem dosya seçicisini açar; dosya yükleme ve yapay zekâ analizi henüz bir servise bağlı değildir.

Kod değişikliği göndermeden önce şu kontrolleri çalıştır:

```bash
npm run build
npm run lint
```
