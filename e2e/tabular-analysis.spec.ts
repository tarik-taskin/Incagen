import { Buffer } from "node:buffer";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { chooseLanguage, setTheme } from "./ui-helpers";
import tr from "../src/i18n/locales/tr.json" with { type: "json" };
import en from "../src/i18n/locales/en.json" with { type: "json" };
import de from "../src/i18n/locales/de.json" with { type: "json" };
import es from "../src/i18n/locales/es.json" with { type: "json" };
import zh from "../src/i18n/locales/zh.json" with { type: "json" };
import ar from "../src/i18n/locales/ar.json" with { type: "json" };

// İzole demo hesabında gerçek yükleme ve Python hesabını kullanır; sağlayıcı çağrısı emülatörde açıkça taklittir.
async function prepare(page: Page, body: string) {
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
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles({ name: "gelir.csv", mimeType: "text/csv", buffer: Buffer.from(body) });
  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/analyses\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Tablodan net bir özet." })).toBeVisible();
  await expect(page.getByLabel("Hesaplama", { exact: true })).toBeEnabled();
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
  await prepare(page, "Channel,Revenue\nWeb,0.10\nStore,0.20\n");
  await expect(page.getByRole("button", { name: "Analizi oluştur", exact: true })).toBeDisabled();
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
  await expect(report).toContainText("0,3 USD");
  await report.getByText("Veri tablosu", { exact: true }).click();
  await expect(report.getByRole("table")).toContainText("0,20 USD");
  await report.getByRole("button", { name: "Store kaynağı", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Store", exact: true });
  await expect(dialog.getByRole("table")).toContainText("0.20");
  await expect(dialog.getByRole("table")).not.toContainText("0.10");
  await layout(page);
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Özgün belgeyi indir", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("gelir.csv");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const url = page.url(); await page.reload();
  await expect(report).toContainText("0,3 USD");
  const nav = page.getByRole("navigation", { name: info.project.name === "mobile-chromium" ? "Mobil navigasyon" : "Ana navigasyon", exact: true });
  await nav.getByRole("link", { name: "Geçmiş", exact: true }).click();
  await expect(page.getByText("Analiz hazır", { exact: true }).first()).toBeVisible();
  await page.goto(url); await expect(report).toBeVisible();
  await chooseLanguage(page, "ar");
  await expect(page.getByRole("region", { name: ar["Analiz raporu"] })).toBeVisible();
  // Saklanan rapor yeniden çevrilmez ve özgün kaynak/grup adları kaybolmaz.
  await expect(page.getByText("Web", { exact: true }).first()).toBeVisible();
  await setTheme(page, { mode: "dark", style: "glass" });
  await layout(page);
  await page.screenshot({ path: info.outputPath("actual-report-rtl-dark.png"), fullPage: true });
});

test("kayıt sayımı ölçüm seçmeden çalışır; hatalı ölçümden kontrollü yeniden deneme", async ({ page }) => {
  await prepare(page, "Channel,Revenue\nWeb,invalid\nStore,20\n");
  await select(page, "Ölçüm alanı", "Revenue");
  await page.getByRole("button", { name: "Analizi oluştur", exact: true }).click();
  await expect(page.getByText("Seçilen ölçümde boş, geçersiz veya biçimi uyuşmayan hücreler var. Tabloyu ve sayı biçimini kontrol edin.", { exact: true })).toBeVisible({ timeout: 30_000 });
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
