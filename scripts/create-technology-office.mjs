import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../fixtures/company-example/v3');
const stage = '/tmp/incagen-technology-office';
const runtime = process.env.INCAGEN_ARTIFACT_MODULES;
if (!runtime) throw new Error('Bundled artifact runtime klasörünü INCAGEN_ARTIFACT_MODULES ile belirtin.');
process.env.RUNTIME_NODE_MODULES = runtime;
const requireRuntime = createRequire(path.join(runtime, 'package.json'));
const { Workbook, SpreadsheetFile, Presentation, PresentationFile } = await import(pathToFileURL(requireRuntime.resolve('@oai/artifact-tool')).href);
const expected = JSON.parse(await fs.readFile(path.join(root, 'expected.json'), 'utf8'));
const g = expected.year;
const number = n => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n);
const money = n => number(n) + ' TL';
await fs.mkdir(stage, { recursive: true });

// Bütçeyi tek ve düzenlenebilir girdi sayfasında korur; hesap sonucunu kaynak gibi çoğaltmaz.
const workbook = await Workbook.fromCSV(await fs.readFile(path.join(root, 'atlas-butce-2025.csv'), 'utf8'), { sheetName: 'Bütçe 2025' });
const sheet = workbook.worksheets.getItem('Bütçe 2025');
const budget = (await fs.readFile(path.join(root, 'atlas-butce-2025.csv'), 'utf8')).trim().split('\n').slice(1).map(line => Number(line.split(',')[1]));
sheet.getRange('B2:B13').values = budget.map(value => [value]);
sheet.getRange('A1:B13').format.font = { name: 'DejaVu Sans', size: 11, color: '#251B38' };
sheet.getRange('A1:B13').format.rowHeight = 27;
sheet.getRange('A1:B1').format.fill = '#60429B';
sheet.getRange('A1:B1').format.font = { bold: true, color: '#FFFFFF', size: 11 };
sheet.getRange('A:A').format.columnWidth = 20;
sheet.getRange('B:B').format.columnWidth = 30;
sheet.getRange('B2:B13').setNumberFormat('#,##0.00');
for (let row = 2; row <= 13; row += 2) sheet.getRange(`A${row}:B${row}`).format.fill = '#F1EEF7';
sheet.freezePanes.freezeRows(1); sheet.showGridLines = false; sheet.tabColor = '#60429B';
workbook.recalculate();
await fs.writeFile(path.join(stage, 'budget.png'), new Uint8Array(await (await workbook.render({ sheetName: 'Bütçe 2025', range: 'A1:B13', scale: 1.5, format: 'png' })).arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(stage, 'atlas-butce-2025.xlsx'));

// Yönetim sunumunu aynı bağımsız toplamlarla ve düzenlenebilir yerel tablolarla oluşturur.
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
// Sunuma yazılan metni yerel ve düzenlenebilir bir metin kutusunda konumlandırır.
function text(slide, value, x, y, width, height, size = 24, bold = false, color = '#251B38') {
  const item = slide.shapes.add({ geometry: 'textbox', position: { left: x, top: y, width, height }, fill: 'none', line: { fill: 'none', width: 0 } });
  item.text = value; item.text.style = { typeface: 'DejaVu Sans', fontSize: size, bold, color };
  return item;
}
// Marka, başlık ve dönem açıklaması için ortak slayt çerçevesi oluşturur.
function slide(title, subtitle) {
  const s = deck.slides.add(); s.background.fill = '#F8F7FB';
  text(s, 'ATLAS TEKNOLOJİ / 2025', 64, 36, 1100, 28, 16, true, '#60429B');
  text(s, title, 64, 92, 1152, 75, 42, true);
  text(s, subtitle, 64, 177, 1152, 62, 22, false, '#6C647D');
  return s;
}
deck.theme.defaultFont = 'DejaVu Sans';
const first = slide('2025 hizmet performansı', 'Yönetim değerlendirmesi · 1 Ocak–31 Aralık 2025 · TRY, KDV hariç');
text(first, money(g.net), 64, 285, 1100, 84, 56, true, '#60429B');
text(first, `Net satış  /  Bütçe gerçekleşmesi %${number(g.net / g.budget * 100)}`, 64, 378, 1120, 44, 25);
text(first, `Brüt marj %${number(g.margin)}  ·  Zamanında tamamlanma %${number(g.onTime)}`, 64, 465, 1120, 44, 25);
text(first, `${number(g.orders)} tamamlanan hizmet işi. Tekil müşteri veya sözleşme sayısı değildir.`, 64, 557, 1100, 60, 21, false, '#6C647D');
const second = slide('Hizmet portföyünün gelir dağılımı', 'Aynı dönemin sekiz hizmet alanı · Net satış, milyon TL');
const groups = Object.entries(g.category).sort((a, b) => b[1] - a[1]);
const table = second.tables.add({ rows: 9, columns: 3, left: 64, top: 260, width: 1140, height: 350, columnWidths: [520, 360, 260], values: [['Hizmet alanı', 'Net satış · milyon TL', 'Gelir payı'], ...groups.map(([name, value]) => [name, number(value / 1e6), '%' + number(value / g.net * 100)])] });
for (let row = 0; row < 9; row++) for (let col = 0; col < 3; col++) {
  const cell = table.getCell(row, col); cell.fill = row === 0 ? '#60429B' : row % 2 ? '#F1EEF7' : '#FFFFFF';
  cell.text.style = { typeface: 'DejaVu Sans', fontSize: 19, bold: row === 0, color: row === 0 ? '#FFFFFF' : '#251B38' };
}
const skill = process.env.INCAGEN_PRESENTATION_SKILL;
if (!skill) throw new Error('Sunum skill klasörünü belirtin.');
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);
text(second, 'Kaynak: atlas-satis-2025.csv · Aylık kırılım toplamları, aynı kapsamın farklı görünümleri toplanmaz.', 64, 638, 1140, 48, 16, false, '#6C647D');
const third = slide('Karar ve takip öncelikleri', 'Gelir büyüklüğü, marj ve hizmet kapasitesi birlikte değerlendirilir');
text(third, '01  Kanal ekonomisi', 64, 283, 1100, 38, 29, true);
text(third, 'Doğrudan satış, iş ortakları ve dijital kanalı hizmet işi başına katkıyla karşılaştırın.', 64, 333, 1100, 55, 24);
text(third, '02  Hizmet kapasitesi', 64, 423, 1100, 38, 29, true);
text(third, 'Ekip kapasitesi ve gecikme nedenlerini tamamlayın. Sözleşme yenileme ve müşteri kaybı bu pakette ölçülmez.', 64, 473, 1100, 75, 24);
text(third, 'Kaynak: atlas-performans-2025.pdf, s.7 · atlas-ticari-degerlendirme-2025.docx', 64, 625, 1140, 50, 16, false, '#6C647D');
for (const [i, s] of deck.slides.items.entries()) await fs.writeFile(path.join(stage, `slide-${i + 1}.png`), new Uint8Array(await (await deck.export({ slide: s, format: 'png', scale: 1 })).arrayBuffer()));
const candidatePath = path.join(stage, 'candidate.pptx');
await (await PresentationFile.exportPptx(deck)).save(candidatePath);
await fs.mkdir(path.join(stage, 'final'), { recursive: true });
const finalPath = path.join(stage, 'final', `atlas-yonetim-2025-${Date.now()}.pptx`);
await finalizePresentation({ workspaceDir: stage, candidatePath, finalPath, pythonExecutable: process.env.INCAGEN_ARTIFACT_PYTHON, integrityValidatorPath: path.join(skill, 'container_tools/inspect_presentation_package_integrity.py'), layoutValidatorPath: path.join(skill, 'container_tools/inspect_presentation_layout_geometry.py'), layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-heading-fit', '--require-native-table-slide', '2'], explicitTotalSlideCount: 3, requiredNativeTableOwnerSlides: [2], fontPolicy: { basis: 'design', families: ['DejaVu Sans'] }, verifyArtifactToolImport: true, receiptPath: path.join(stage, `validation-${Date.now()}.json`) });
await fs.copyFile(finalPath, path.join(stage, 'atlas-yonetim-2025.pptx'));
console.log(JSON.stringify({ budgetRows: budget.length, budgetTotal: budget.reduce((a, b) => a + b, 0), slideCount: deck.slides.items.length, stage }));
