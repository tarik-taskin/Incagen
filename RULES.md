# Incagen Geliştirme Kuralları

Bu kurallar uygulama büyürken tema, bileşen ve sayfa stillerinin birbirini yanlışlıkla ezmesini önlemek için bağlayıcıdır.

## Stil sahipliği

1. `index.html` içine `<style>` etiketi veya satır içi bileşen CSS'i eklenmez. `index.html` yalnızca HTML iskeleti, metadata, favicon ve gerekli dış kaynak bağlantılarını içerir.
2. `src/index.css` yalnızca şu uygulama geneli ihtiyaçlar için kullanılır:
   - Tailwind direktifleri ve katmanları
   - Açık/koyu tema tasarım tokenları
   - Sayfa kökü ve `body` için temel kurallar
   - Birden fazla bileşenin gerçekten paylaştığı, isimlendirilmiş yardımcı sınıflar
   - Erişilebilirlik için genel `prefers-reduced-motion` davranışı
3. `button`, `input`, `a`, `svg`, `h1` gibi HTML elementlerini doğrudan hedefleyen yeni global görünüm kuralları yazılmaz. Tarayıcı normalizasyonunu Tailwind Preflight yönetir.
4. Bir bileşenin boyutu, rengi, kenarlığı, hover/focus durumu ve animasyonu ilgili React bileşenindeki Tailwind sınıflarında tanımlanır.
5. Tekrarlanan bileşen varyantları shadcn/ui düzeni ve CVA ile merkezi olarak yönetilir. Aynı bileşen için sayfa seviyesinde ikinci bir stil sistemi oluşturulmaz.
6. Üçüncü taraf bir kütüphane CSS gerektiriyorsa kurallar benzersiz bir üst sınıf altında scope edilir; global element seçicileriyle uygulamanın geri kalanı etkilenmez.
7. `!important` yalnızca erişilebilirlik gibi zorunlu bir global override için ve nedeni açıkça belgelenerek kullanılabilir.

## Tailwind katmanları

- Temel token ve reset ekleri `@layer base` içinde tutulur.
- Yeniden kullanılabilir, isimlendirilmiş bileşen sınıfları gerekiyorsa `@layer components` kullanılır.
- Küçük yardımcı sınıflar `@layer utilities` içinde tutulur.
- Bir stil mevcut Tailwind utility sınıfıyla ifade edilebiliyorsa yeni global CSS kuralı eklenmez.

## Değişiklik kontrolü

Arayüz veya stil değişikliğinden sonra en az şu kontroller yapılır:

1. Aydınlık ve karanlık tema kontrol edilir.
2. Klavye ile focus görünürlüğü kontrol edilir.
3. Mobil ve masaüstü yerleşimde taşma olmadığı doğrulanır.
4. Hover, focus ve animasyon geçişlerinin kesintisiz olduğu kontrol edilir.
5. `prefers-reduced-motion` tercihinde içerik görünür ve kullanılabilir kalır.
6. `npm run build` ve `npm run lint` başarılı olmalıdır.

## Branch ve paylaşım

- Geliştirme `tarik` veya `furkan` branch'inde yapılır.
- Tamamlanan değişiklikler küçük, amaç odaklı commit'lere ayrılır.
- `main` için normal paylaşım akışı pull request ve en az bir ekip arkadaşı onayıdır.
- API anahtarları, kimlik bilgileri ve gerçek müşteri verileri hiçbir branch'e commit edilmez.
