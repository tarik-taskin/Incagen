# Şirket raporu örneği · v1

Atlas Perakende bu gösterim için kullanılan kurgusal bir işletmedir. Paket 2025'in 12 ayı için 864 satış kırılımı, 12 bütçe kaydı ve 72 operasyon satırı içerir. Satış satırları tekil sipariş değil; ay × bölge × kanal × kategori × müşteri segmenti toplamlarıdır. Sipariş ve adet farklı ölçülerdir.

Tüm tutarlar TRY, KDV hariçtir. Net satış = brüt satış − satır toplam indirimi − iade tutarı. Satılan mal maliyeti iade sonrası net maliyettir. Brüt kâr = net satış − mal maliyeti. Katkı = brüt kâr − pazarlama − sipariş karşılama; işletme giderleri/vergi/finansman olmadığı için net kâr değildir. Bütçe onaylı örnek hedef, gelecek tahmini değildir. Zamanında teslimat oranının paydası sevk edilen sipariştir; ay oranlarının ortalaması alınmaz.

Kaynaklar `scripts/create-company-fixtures.cjs` ile kararlı formüllerden üretilir; rastgelelik, müşteri kimliği veya gerçek şirket verisi yoktur. Mevcut `analysis-reference/v1` vakaları değişmez. `npm run example:build` kaynakları gerçek CSV parser'ından geçirir, rapor artefaktını ve üç kaynak CSV'sini içeren ZIP'i üretir. Dönemler için hesaplar aynı saf örnek hesaplayıcısından gelir; gerçek AI veya backend entegrasyonu değildir.

`expected.json` bağımsız toplama testi için dondurulmuş sayısal beklentidir; rapor üreticisi tarafından okunmaz. Manifest hash'leri ve yeniden üretilebilir artefaktlar test edilir. Kaynak satırı kanıtları yalnız bitişik satırları, aynı parser parçası içinde sıkıştırır; aradaki ilgisiz satırları kapsayacak şekilde genişletmez.
