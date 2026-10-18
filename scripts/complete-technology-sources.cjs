const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const JSZip = require('../functions/node_modules/jszip');
const root = path.resolve(__dirname, '../fixtures/company-example/v3');

// Office yazarından doğrulanmış çıktıları sabit ZIP zamanlarıyla kaynak paketine alır; dış dosyaları değiştirmez.
async function office(name) {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join('/tmp/incagen-technology-office', name)));
  for (const item of Object.values(zip.files)) {
    item.date = new Date('2025-12-31T12:00:00Z');
    // ExcelJS tüketicileri için SpreadsheetML önekini eşdeğer varsayılan ad alanına dönüştürür.
    if (name.endsWith('.xlsx') && item.name.endsWith('.xml') && item.name.startsWith('xl/')) {
      const xml = (await item.async('string')).replace('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace(/(<\/?)x:/g, '$1');
      zip.file(item.name, xml, { date: new Date('2025-12-31T12:00:00Z') });
    }
    if (item.name === 'docProps/core.xml') {
      const text = (await item.async('string')).replace(/(<dcterms:(?:created|modified)[^>]*>)[^<]+/g, '$12025-12-31T12:00:00Z');
      zip.file(item.name, text, { date: new Date('2025-12-31T12:00:00Z') });
    }
  }
  fs.writeFileSync(path.join(root, name), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
}

// Şirket bağlamı ve hesap tanımlarını ayrı kaynaklarda tutar; tekrar eden mali toplamları yeniden saymaz.
async function main() {
  await office('atlas-butce-2025.xlsx');
  await office('atlas-yonetim-2025.pptx');
  const context = { company: 'Atlas Teknoloji', reporting_year: 2025, currency: 'TRY', vat: 'excluded', business_model: 'Teknoloji ve profesyonel hizmetler', period: { start: '2025-01-01', end: '2025-12-31' }, dimensions: { regions: ['Marmara', 'Ege', 'İç Anadolu', 'Akdeniz'], channels: ['Doğrudan satış', 'İş ortakları', 'Dijital kanal'], customer_segments: ['Girişim', 'KOBİ', 'Kurumsal'] }, definitions: { service_orders: 'Tamamlanan ayrık hizmet işleri; tekil müşteri veya sözleşme sayısı değildir.', billable_units: 'Hizmet alanına göre farklı faturalama birimleri. Alanlar arasında fiziksel ürün adedi gibi toplanmaz.', service_credit_try: 'Hizmet düzeyi veya ticari düzeltme kapsamında gelirden düşülen kredi tutarı.', direct_cost_try: 'Hizmet sunumuna doğrudan yüklenen uzmanlık ve altyapı maliyetleri.', service_delivery_try: 'Doğrudan maliyete dahil olmayan hizmet koordinasyonu ve operasyon gideri.' }, exclusions: ['ARR/MRR', 'Müşteri kaybı', 'Sözleşme yenileme', 'Tekil müşteri sayısı', 'Net kâr'], table_records: 3612 };
  fs.writeFileSync(path.join(root, 'atlas-rapor-baglami-2025.json'), JSON.stringify(context, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'atlas-hesap-yontemi-2025.md'), `# Atlas Teknoloji / Hesap tanımları\n\nDönem 1 Ocak–31 Aralık 2025; para birimi TRY, KDV hariç.\n\n## Mali hesaplar\n\nNet satış = brüt gelir − indirim − hizmet kredisi. Her alan aylık satır toplamıdır; faturalanabilir birimle yeniden çarpılmaz.\nBrüt kâr = net satış − doğrudan hizmet maliyeti.\nKatkı = brüt kâr − satış/pazarlama − hizmet operasyonu. Doğrudan maliyet ve operasyon birbirinden ayrı gider sınıflarıdır. Genel yönetim, vergi ve finansman bu pakette yoktur; katkı net kâr değildir.\n\n## Oranlar ve hacim\n\nBrüt marj = toplam brüt kâr / toplam net satış × 100.\nBütçe gerçekleşmesi = toplam net satış / aynı ayların bütçesi × 100.\nZamanında tamamlanma = zamanında tamamlanan işler / tamamlanan işler × 100. Aylık oranların basit ortalaması alınmaz.\nHizmet işleri aylık bölge, kanal, hizmet alanı ve segment kırılımlarında ayrık tanımlanır. Aynı müşteri birden çok hizmet işi üretebilir.\n\n## Kaynak ve kapsam\n\nSatış kayıtları CSV, bütçe XLSX ve hizmet operasyonu CSV sayısal dayanaklardır. PDF, Word ve PowerPoint aynı toplamların yönetim görünümleridir; ayrı gelir eklemezler. JSON bağlamı, bu hesap notu ve devir notu sayısal hesaplara yeni satış kaydı eklemez.\nDönem filtresi üç ana tabloya birlikte uygulanır; yıllık yönetim belgeleri yıl kapsamını korur. Kanal ve hizmet alanı birbiriyle aynı gelirin farklı kırılımlarıdır ve birbirine eklenmez.\n`);
  fs.writeFileSync(path.join(root, 'atlas-yonetim-devir-notu-2025.txt'), `ATLAS TEKNOLOJİ / YÖNETİM DEVİR NOTU\n2025 kapanışı\n\nFinans: Brüt gelir, indirim ve hizmet kredisi aynı ay ve kırılımda uzlaştırılır. Doğrudan maliyet ile hizmet operasyonu farklı gider sınıflarıdır; aynı gider iki alana yazılmaz.\n\nTicari ekip: Kanal bütçelerini yalnız ciroya göre dağıtmayın. Doğrudan satış, iş ortakları ve dijital kanal için brüt marj ve hizmet işi başına katkıyı birlikte inceleyin.\n\nHizmet operasyonu: Zamanında ve geciken işlerin toplamını tamamlanan hizmet işiyle karşılaştırın. Gecikme nedenleri ekip ve teknik olay bazında ayrıca toplanmalıdır.\n\nSonraki değerlendirme: Sözleşme yenileme, müşteri kaybı ve hizmet kullanımını değerlendirmek için müşteri/sözleşme kimliği, başlangıç-bitiş tarihi ve ekip kapasitesi eklenmelidir. Mevcut dosyalardan ARR, müşteri yaşam boyu değeri veya nedensel kampanya etkisi çıkarılmaz.\n\nKaynak sırası: Yıllık PDF görünümü, Word değerlendirmesi, PowerPoint yönetim özeti; ardından CSV/XLSX sayısal kayıtları ve JSON/Markdown tanımlar. Yıllık belgeler alt dönem filtresiyle yeniden yazılmış gibi yorumlanmaz.\n`);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  const files = manifest.files.filter(item => ['atlas-sales', 'atlas-operations', 'atlas-review', 'atlas-commercial'].includes(item.sourceId));
  files.splice(1, 0, { sourceId: 'atlas-budget', file: 'atlas-butce-2025.xlsx', rows: 12 });
  files.push({ sourceId: 'atlas-executive', file: 'atlas-yonetim-2025.pptx', slides: 3 }, { sourceId: 'atlas-context', file: 'atlas-rapor-baglami-2025.json' }, { sourceId: 'atlas-methodology', file: 'atlas-hesap-yontemi-2025.md' }, { sourceId: 'atlas-handoff', file: 'atlas-yonetim-devir-notu-2025.txt' });
  manifest.files = files.map(item => ({ ...item, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, item.file))).digest('hex') }));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${manifest.files.length} belge, görsel kaynak yok.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
