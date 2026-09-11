import Papa from "papaparse";
import { LIMITS, type ColumnMapping, type Report } from "./contracts";

// Kullanıcı veri hatalarını platform hatalarından ayırır; dosya içeriğini loglara taşımaz.
export class CsvError extends Error {}

// CSV başlığını ayrıştırır; yinelenen/boş sütun isimlerini belirsiz eşleştirmeye bırakmaz.
export function readCsv(text: string, delimiter: "," | ";") {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { delimiter, skipEmptyLines: false });
  if (parsed.errors.length) throw new CsvError(`CSV biçimi bozuk (kayıt ${(parsed.errors[0].row ?? 0) + 1}).`);
  const rows = parsed.data;
  const headers = rows.shift()?.map(h => h.trim()) ?? [];
  if (headers.length < 2 || headers.length > 100 || headers.some(h => !h || h.length > 100) || new Set(headers).size !== headers.length) {
    throw new CsvError("Başlık en az iki, en fazla 100 benzersiz ve dolu sütun içermeli.");
  }
  return { headers, rows };
}

// Seçilen biçimi tam eşleşmeyle kuruşa dönüştürür; kayan noktalı para toplamlarını engeller.
export function parseCents(input: string, format: ColumnMapping["numberFormat"]) {
  const value = input.trim();
  const pattern = format === "tr" ? /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/ : /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
  if (!pattern.test(value)) throw new CsvError("Tutar seçilen sayı biçimine uymuyor.");
  const normalized = format === "tr" ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  const [whole, fraction = ""] = normalized.replace("-", "").split(".");
  const cents = (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) * (normalized.startsWith("-") ? -1 : 1);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 1e12) throw new CsvError("Tutar güvenli sınırı aşıyor.");
  return cents;
}

// Takvimde var olmayan tarihleri reddedip bütün değerleri ISO gününe dönüştürür.
export function parseDate(input: string, format: ColumnMapping["dateFormat"]) {
  const value = input.trim();
  const parts = (format === "iso" ? /^(\d{4})-(\d{2})-(\d{2})$/ : /^(\d{2})\.(\d{2})\.(\d{4})$/).exec(value);
  if (!parts) throw new CsvError("Tarih seçilen biçime uymuyor.");
  const [year, month, day] = format === "iso" ? [+parts[1], +parts[2], +parts[3]] : [+parts[3], +parts[2], +parts[1]];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 2100 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new CsvError("Geçersiz takvim tarihi.");
  return date.toISOString().slice(0, 10);
}

// Doğrulanmış CSV kayıtlarından kaynak izli ve boyutu sınırlı gerçek satış raporu üretir.
export function calculateReport(sources: { name: string; text: string; mapping: ColumnMapping }[]): Report {
  const daily = new Map<string, number>();
  const categories = new Map<string, number>();
  const report: Report = { version: 1, totalCents: 0, rowCount: 0, averageCents: 0, daily: [], categories: [], sources: [] };
  for (const source of sources) {
    const { headers, rows } = readCsv(source.text, source.mapping.delimiter);
    const dateIndex = headers.indexOf(source.mapping.dateColumn);
    const amountIndex = headers.indexOf(source.mapping.amountColumn);
    const categoryIndex = source.mapping.categoryColumn ? headers.indexOf(source.mapping.categoryColumn) : -1;
    if (dateIndex < 0 || amountIndex < 0 || (source.mapping.categoryColumn && categoryIndex < 0)) throw new CsvError(`${source.name}: Eşleştirilen sütun bulunamadı.`);
    let count = 0;
    let blankRows = 0;
    for (const [index, row] of rows.entries()) {
      if (row.every(cell => !cell.trim())) { blankRows++; continue; }
      try {
        if (row.length !== headers.length) throw new CsvError("Sütun sayısı başlıkla eşleşmiyor.");
        if (++report.rowCount > LIMITS.rows) throw new CsvError("Analiz toplamda 50.000 satırı aşamaz.");
        const day = parseDate(row[dateIndex], source.mapping.dateFormat);
        const cents = parseCents(row[amountIndex], source.mapping.numberFormat);
        report.totalCents += cents;
        if (!Number.isSafeInteger(report.totalCents)) throw new CsvError("Toplam tutar güvenli sınırı aşıyor.");
        daily.set(day, (daily.get(day) ?? 0) + cents);
        if (daily.size > 2000) throw new CsvError("Rapor en fazla 2.000 farklı gün içerebilir.");
        if (categoryIndex >= 0) {
          const category = row[categoryIndex].trim() || "Belirtilmemiş";
          if (category.length > 100) throw new CsvError("Kategori 100 karakteri aşamaz.");
          categories.set(category, (categories.get(category) ?? 0) + cents);
        }
        count++;
      } catch (error) {
        throw new CsvError(`${source.name}, kayıt ${index + 2}: ${error instanceof Error ? error.message : "Geçersiz veri."}`);
      }
    }
    if (!count) throw new CsvError(`${source.name}: Veri satırı bulunamadı.`);
    report.sources.push({ name: source.name, rows: count, blankRows });
  }
  report.averageCents = Math.round(report.totalCents / report.rowCount);
  report.daily = [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, cents]) => ({ date, cents }));
  const sorted = [...categories].sort((a, b) => b[1] - a[1]);
  report.categories = sorted.slice(0, 20).map(([category, cents]) => ({ category, cents }));
  if (sorted.length > 20) report.categories.push({ category: "Diğer (ilk 20 dışında)", cents: sorted.slice(20).reduce((sum, [, n]) => sum + n, 0) });
  return report;
}
