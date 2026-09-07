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
3. Varsayılan tercih Tailwind utility ve bileşen scope'lu stillerdir. `button`, `input`, `a`, `svg`, `h1` gibi global element seçicileri yalnız gerçekten uygulama genelinde gerekli olduğunda kullanılabilir: gerekçesi ve etki alanı kod yanında belgelenmeli, uygun Tailwind katmanında tutulmalı ve shadcn/CVA varyantları ile iki temada çakışmadığı doğrulanmalıdır. Tarayıcı normalizasyonunu Tailwind Preflight yönetir; mevcut reset gereksiz yere tekrarlanmaz.
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

## Teknik güvenlik

- AI ve harici servis sırları yalnız backend'de tutulur; frontend paketine veya loglara yazılmaz.
- Dosya kabulü, kota ve erişim yetkisi backend'de doğrulanır; istemci kontrolleri güvenlik sınırı değildir.
- Kullanıcılar arasında veri izolasyonu ve silme davranışı ilgili değişikliklerin testlerinde doğrulanır.
