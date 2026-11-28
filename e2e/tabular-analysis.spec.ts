import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { chooseLanguage, setTheme } from "./ui-helpers";
import tr from "../src/i18n/locales/tr.json" with { type: "json" };
import en from "../src/i18n/locales/en.json" with { type: "json" };
import de from "../src/i18n/locales/de.json" with { type: "json" };
import es from "../src/i18n/locales/es.json" with { type: "json" };
import zh from "../src/i18n/locales/zh.json" with { type: "json" };
import ar from "../src/i18n/locales/ar.json" with { type: "json" };

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const ExcelJS = require("exceljs");
const { parse: parseCsv } = require("csv-parse/sync") as {
  parse(csv: string, options: { bom: boolean; columns: boolean }): Record<string, string>[];
};

// Chromium’un gerçekten indirdiği rapor CSV’sini tekrar ayrıştırır.
async function downloadMetrics(page: Page, fileName: string) {
  const button = page.getByRole("button", { name: "Hesapları CSV olarak indir", exact: true });
  await expect(button).toBeVisible();
  const event = page.waitForEvent("download");
  await button.press("Enter");
  const download = await event;
  expect(download.suggestedFilename()).toBe(fileName);
  return parseCsv(await readFile(await download.path(), "utf8"), { bom: true, columns: true });
}

// İzole demo hesabında gerçek yükleme ve Python hesabını kullanır; sağlayıcı çağrısı emülatörde açıkça taklittir.
async function prepare(page: Page, body: string | Buffer, fileName = "gelir.csv", mimeType = "text/csv") {
  await page.goto("/app/new-analysis");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`tabular-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();
  await page.getByLabel("İşletme adı", { exact: true }).fill("Sentetik Teknoloji");
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("Gelir değerlendirmesi");
  await page.getByLabel("Analiz hedefi", { exact: true }).fill("Kanallara göre gelirleri değerlendir");
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles({ name: fileName, mimeType, buffer: typeof body === "string" ? Buffer.from(body) : body });
  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/analyses\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Tablodan net bir özet." })).toBeVisible();
  await expect(page.getByLabel("Analiz tablosu", { exact: true })).toBeEnabled();
}

// Radix seçimlerini klavyeyle erişilebilir etiketinden yapar.
async function select(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

// Sonuç ve modal için erişilebilirlik ile yatay taşmayı aynı görünümde denetler.
async function layout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
}

test("gerçek hesap → kaynaklı rapor → geçmiş/yenileme; altı dil ve özgün hücreler korunur", async ({ page }, info) => {
  await prepare(page, "Channel,Revenue\nWeb,0.10\n\nStore,0.20\n");
  await expect(page.getByRole("button", { name: "Analizi oluştur", exact: true })).toBeDisabled();
  // Arada boş satır olan geçerli CSV'de önizleme fiziksel dosya satırlarını (2 ve 4) gösterir.
  await page.getByText("Tablo önizlemesi", { exact: true }).click();
  const preview = page.getByRole("table", { name: "Seçili tablodan örnek satırlar" });
  await expect(preview.getByRole("columnheader", { name: "Dosya satırı", exact: true })).toBeVisible();
  await expect(preview.getByRole("rowheader", { name: "2", exact: true })).toBeVisible();
  await expect(preview.getByRole("rowheader", { name: "4", exact: true })).toBeVisible();
  await page.getByText("Tablo önizlemesi", { exact: true }).click();
  await select(page, "Ölçüm alanı", "Revenue");
  await select(page, "Gruplama", "Channel");
  await select(page, "Birim", "USD · $");
  for (const [code, catalog] of Object.entries({ tr, en, de, es, zh, ar })) {
    await chooseLanguage(page, code);
    await expect(page.getByLabel(catalog["Ölçüm alanı"], { exact: true })).toContainText("Revenue");
    await expect(page.getByLabel(catalog["Gruplama"], { exact: true })).toContainText("Channel");
    await expect(page.getByRole("button", { name: catalog["Analizi oluştur"], exact: true })).toBeEnabled();
    await layout(page);
  }
  await chooseLanguage(page, "tr");
  await page.getByRole("button", { name: "Analizi oluştur", exact: true }).click();
  const report = page.getByRole("region", { name: "Analiz raporu", exact: true });
  await expect(report).toBeVisible({ timeout: 30_000 });
  await expect(report).toContainText("0,30 USD");
  const metrics = await downloadMetrics(page, "incagen-analysis-metrics.csv");
  expect(metrics.find(row => row.metric_id === "aggregate")).toMatchObject({ value: "0.3", unit: "USD" });
  const store = metrics.find(row => row.label === "Store");
  expect(store).toMatchObject({ value: "0.2", unit: "USD" });
  expect(JSON.parse(store!.source_locations)).toContainEqual(expect.objectContaining({
    file_name: "gelir.csv", row_start: 4, row_end: 4,
  }));
  await report.getByText("Veri tablosu", { exact: true }).click();
  await expect(report.getByRole("table")).toContainText("0,20 USD");
  await report.getByRole("button", { name: "Store kaynağı", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Store", exact: true });
  await expect(dialog.getByRole("table")).toContainText("0.20");
  await expect(dialog.getByRole("table")).not.toContainText("0.10");
  await expect(dialog.getByRole("rowheader", { name: /4/ })).toBeVisible();
  await layout(page);
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Özgün belgeyi indir", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("gelir.csv");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const url = page.url(); await page.reload();
  await expect(report).toContainText("0,30 USD");
  const nav = page.getByRole("navigation", { name: info.project.name === "mobile-chromium" ? "Mobil navigasyon" : "Ana navigasyon", exact: true });
  await nav.getByRole("link", { name: "Geçmiş", exact: true }).click();
  await expect(page.getByText("Analiz hazır", { exact: true }).first()).toBeVisible();
  await page.goto(url); await expect(report).toBeVisible();
  await chooseLanguage(page, "ar");
  await expect(page.getByRole("region", { name: ar["Analiz raporu"] })).toBeVisible();
  // Saklanan rapor yeniden çevrilmez ve özgün kaynak/grup adları kaybolmaz.
  const chart = page.getByTestId("chart-group-chart");
  await chart.scrollIntoViewIfNeeded();
  await expect(chart.getByText("Web", { exact: true })).toBeVisible();
  await setTheme(page, { mode: "dark", style: "glass" });
  await layout(page);
  await page.screenshot({ path: info.outputPath("actual-report-rtl-dark.png"), fullPage: true });
});

test("kayıt sayımı ölçüm seçmeden çalışır; hatalı ölçümden kontrollü yeniden deneme", async ({ page }) => {
  await prepare(page, "Channel,Revenue\nWeb,invalid\nStore,20\n");
  await select(page, "Ölçüm alanı", "Revenue");
  await page.getByRole("button", { name: "Analizi oluştur", exact: true }).click();
  await expect(page.getByText("Seçilen sayı biçimi bu sütundaki değerlerle uyuşmuyor. Sayı biçimini (1234.56 / 1.234,56 / 1,234.56) değiştirip yeniden deneyin.", { exact: true })).toBeVisible({ timeout: 30_000 });
  await select(page, "Hesaplama", "Kayıt sayısı");
  await expect(page.getByLabel("Ölçüm alanı", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Yeniden dene", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  const report = page.getByRole("region", { name: "Analiz raporu", exact: true });
  await expect(report).toBeVisible({ timeout: 30_000 });
  await expect(report).toContainText("2 kayıt");
  await expect(report.locator("[data-testid^=chart-]")).toHaveCount(0);
  await layout(page);
});

test("çok sayfalı Excel'de önizleme, satır ağırlıklı ortalama, sayfa kaynağı ve yenileme/geçmiş dönüşü korunur", async ({ page }, info) => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Kapsam Dışı").addRows([["Ekip", "Gelir"], ["Disari", 999999]]);
  const longColumn = "Açıklama".repeat(16);
  workbook.addWorksheet("Hizmetler").addRows([
    ["Ekip", "Gelir", "Gelir", "Gelir (2)", longColumn],
    ["Alfa", 10, 1, 2, "Birinci"],
    ["Alfa", 20], ["Alfa", 30], ["Beta", 100],
  ]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  await prepare(page, buffer, "hizmet-gelir.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  await select(page, "Analiz tablosu", "hizmet-gelir.xlsx · Hizmetler");

  // Hesaplamadan önce seçili Excel sayfasının sütunları, dosya satırları ve küçük satır örneği incelenebilir.
  await page.getByText("Tablo önizlemesi", { exact: true }).click();
  const preview = page.getByRole("table", { name: "Seçili tablodan örnek satırlar" });
  const scrollArea = page.getByRole("region", { name: "Seçili tablodan örnek satırlar" });
  await scrollArea.focus();
  await expect(scrollArea).toBeFocused();
  await expect(preview.getByRole("columnheader", { name: "Gelir (2) (2)", exact: true })).toBeVisible();
  await expect(preview.getByRole("columnheader", { name: longColumn, exact: true })).toBeVisible();
  await layout(page);
  await expect(preview.getByRole("columnheader", { name: "Dosya satırı", exact: true })).toBeVisible();
  await expect(preview.getByRole("rowheader", { name: "2", exact: true })).toBeVisible();
  await expect(preview.getByRole("rowheader", { name: "5", exact: true })).toBeVisible();
  await expect(preview).toContainText("Alfa");
  await expect(preview).toContainText("100");
  await expect(preview).not.toContainText("999999");

  await select(page, "Hesaplama", "Ortalama");
  await select(page, "Ölçüm alanı", "Gelir");
  await select(page, "Gruplama", "Ekip");
  await select(page, "Birim", "EUR · €");
  await page.getByRole("button", { name: "Analizi oluştur", exact: true }).click();

  // Gerçek satır ağırlıklı ortalama: (10 + 20 + 30 + 100) / 4 = 40,00 EUR (grup ortalamalarının ortalaması 60,00 değil).
  const report = page.getByRole("region", { name: "Analiz raporu", exact: true });
  await expect(report).toBeVisible({ timeout: 30_000 });
  await expect(report).toContainText("40,00 EUR");
  const metrics = await downloadMetrics(page, "incagen-analysis-metrics.csv");
  const aggregate = metrics.find(row => row.metric_id === "aggregate");
  expect(aggregate).toMatchObject({ value: "40", unit: "EUR" });
  expect(JSON.parse(aggregate!.source_locations)).toContainEqual(expect.objectContaining({
    file_name: "hizmet-gelir.xlsx", sheet: "Hizmetler", row_start: 2, row_end: 5,
  }));
  await expect(report).toContainText("Hizmetler");

  await report.getByText("Veri tablosu", { exact: true }).click();
  await expect(report.getByRole("table")).toContainText("100,00 EUR");
  await expect(report.getByRole("table")).toContainText("20,00 EUR");
  await report.getByRole("button", { name: "Alfa kaynağı", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Alfa", exact: true });
  await expect(dialog).toContainText("Hizmetler");
  const sourceTable = dialog.getByRole("table");
  await expect(sourceTable).toContainText("10");
  await expect(sourceTable).toContainText("20");
  await expect(sourceTable).toContainText("30");
  await expect(sourceTable).not.toContainText("Beta");
  await expect(sourceTable).not.toContainText("999999");
  await layout(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // Yenileme ve Geçmiş dönüşünde aynı doğrulanmış Excel sonucu korunur.
  const url = page.url();
  await page.reload();
  await expect(report).toContainText("40,00 EUR");
  const nav = page.getByRole("navigation", { name: info.project.name === "mobile-chromium" ? "Mobil navigasyon" : "Ana navigasyon", exact: true });
  await nav.getByRole("link", { name: "Geçmiş", exact: true }).click();
  await expect(page.getByText("Analiz hazır", { exact: true }).first()).toBeVisible();
  await page.goto(url);
  await expect(report).toContainText("40,00 EUR");
  // Rapor dili Türkçe iken arayüz Arapça RTL'e çevrildiğinde sayfa adı, grup etiketleri ve kaynak satırları korunur.
  await chooseLanguage(page, "ar");
  const rtlReport = page.getByRole("region", { name: ar["Analiz raporu"], exact: true });
  await expect(rtlReport).toBeVisible();
  await expect(rtlReport).toContainText("Hizmetler");
  await rtlReport.getByText(ar["Veri tablosu"], { exact: true }).click();
  const rtlTable = rtlReport.getByRole("table");
  await expect(rtlTable.getByRole("rowheader", { name: "Alfa", exact: true })).toHaveAttribute("dir", "auto");
  await expect(rtlTable.getByRole("rowheader", { name: "Beta", exact: true })).toHaveAttribute("dir", "auto");
  await layout(page);
  await chooseLanguage(page, "tr");
});

test("iki örnek raporda kısa keşif rehberi isteğe bağlı ve klavyeyle erişilebilirdir", async ({ page }) => {
  for (const route of ["/ornek-rapor", "/ornek-rapor/musteri-deneyimi"]) {
    await page.goto(route);
    const summary = page.locator("summary").filter({ hasText: "Bu raporu nasıl inceleyebilirim?" });
    const guide = page.locator("details").filter({ has: summary });
    await expect(guide).not.toHaveAttribute("open");
    await summary.focus(); await expect(summary).toBeFocused(); await page.keyboard.press("Enter");
    await expect(guide).toHaveAttribute("open", "");
    await expect(guide.getByRole("listitem")).toHaveCount(3);
    await layout(page);
    await chooseLanguage(page, "ar");
    await expect(page.getByText(ar["Bu raporu nasıl inceleyebilirim?"], { exact: true })).toBeVisible();
    await layout(page);
    await chooseLanguage(page, "tr");
  }
});

test("davet erişimi yenilenirken tablo kapsamı korunur ve analiz kendiliğinden başlamaz", async ({ page }) => {
  let access = "invite-required";
  let startCalls = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname.endsWith("/startAnalysis")) startCalls += 1;
  });
  await page.route("**/getAnalysisTables", async route => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, result: { ...data.result, access } } });
  });
  await prepare(page, "Channel,Revenue\nWeb,1.50\nStore,2.50\n");
  await select(page, "Ölçüm alanı", "Revenue");
  await expect(page.getByText(/Bu hesap tablo analizi betasına dahil değil/)).toBeVisible();
  const start = page.getByRole("button", { name: "Analizi oluştur", exact: true });
  await expect(start).toBeDisabled();
  await page.getByText("Tablo önizlemesi", { exact: true }).click();
  const preview = page.getByRole("table", { name: "Seçili tablodan örnek satırlar" });
  await expect(preview).toContainText("1.50");

  access = "available";
  await page.getByRole("button", { name: "Erişimi kontrol et" }).click();
  await expect(start).toBeEnabled();
  await expect(page.getByLabel("Ölçüm alanı", { exact: true })).toContainText("Revenue");
  await expect(preview).toBeVisible();
  expect(startCalls).toBe(0);
});


test("herkese açık müşteri deneyimi örneği boş değeri koruyan hesap CSV’si sunar", async ({ page }) => {
  await page.goto("/ornek-rapor/musteri-deneyimi");
  const rows = await downloadMetrics(page, "incagen-example-feedback-metrics.csv");
  expect(rows.find(row => row.metric_id === "comments")).toMatchObject({ value: "32", status: "available" });
  expect(rows.find(row => row.metric_id === "csat")).toMatchObject({ value: "", status: "unavailable" });
  await expect(page.getByRole("link", { name: "Örnek yorumları indir" })).toBeVisible();
  await layout(page);
});

test("320 px dar ekranda TR ve AR RTL tablo kurulumu ile kapsam özeti taşma olmadan okunur", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 680 });
  const longName = "VeryLongRegionalRevenueWorksheet_2026.csv";
  const longCol = "Gross_Recurring_Amount_USD";
  await prepare(page, `Team,${longCol}\nAlfa,120.50\nBeta,80.25\n`, longName);
  await select(page, "Ölçüm alanı", longCol);
  await select(page, "Gruplama", "Team");
  const scope = page.getByLabel("Kapsam özeti", { exact: true });
  await expect(scope).toContainText(longName);
  await expect(scope).toContainText(longCol);
  await layout(page);

  await chooseLanguage(page, "ar");
  const rtlScope = page.getByLabel(ar["Kapsam özeti"], { exact: true });
  await expect(rtlScope).toContainText(longName);
  await expect(rtlScope).toContainText(longCol);
  await setTheme(page, { mode: "dark", style: "glass" });
  await layout(page);
  await chooseLanguage(page, "tr");
});
