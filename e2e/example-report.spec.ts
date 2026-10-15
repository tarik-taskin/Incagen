import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("sentetik raporda grafik, tablo ve kaynak aynı sayıları sunar; odak ve iki tema korunur", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Örnek raporu incele" }).click();
  await expect(page).toHaveURL(/\/ornek-rapor$/);
  await expect(page.getByRole("heading", { name: "Satışların net resmi." })).toBeVisible();
  await expect(page.getByText("Gerçek işletme verisi içermez. Hesabınıza kaydedilmez.")).toBeVisible();
  await expect(page.getByTestId("report-chart").locator("svg")).toBeVisible();
  await page.getByTestId("report-chart").locator("path[fill='#7351b5']").first().click();
  await expect(page.getByRole("dialog", { name: "Eylül 2026" }).getByRole("row")).toHaveCount(5);
  await page.keyboard.press("Escape");
  const net = page.getByRole("button", { name: /Net satış 2.550 TL/ });
  await expect(net).toBeVisible();
  await net.click();
  const dialog = page.getByRole("dialog", { name: "Net satış" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("row")).toHaveCount(13);
  await expect(dialog.getByText("Net tutar", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("region", { name: "sales.csv kaynak satırları" })).toContainText("S001");
  let accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(net).toBeFocused();

  await page.getByRole("button", { name: "Veri tablosu" }).click();
  const table = page.getByRole("table", { name: "Dönemlere göre net satış, TRY" });
  await expect(table).toContainText("1.000 TL");
  await expect(table).toContainText("1.550 TL");
  await page.getByRole("button", { name: "Ekim 2026 kaynağını incele" }).click();
  await expect(page.getByRole("dialog", { name: "Ekim 2026" }).getByRole("row")).toHaveCount(7);
  await page.getByLabel("Bağlam için tüm satırları göster").check();
  await expect(page.getByRole("dialog").getByRole("row")).toHaveCount(13);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Kategoriler", exact: true }).click();
  await expect(page.getByRole("table", { name: "Kategorilere göre net satış, TRY" })).toContainText("1.100 TL");
  await expect(page.getByRole("table", { name: "Kategorilere göre net satış, TRY" })).toContainText("750 TL");
  await expect(page.getByRole("table", { name: "Kategorilere göre net satış, TRY" })).toContainText("700 TL");
  await page.getByRole("button", { name: "Teknoloji kaynağını incele" }).click();
  await expect(page.getByRole("dialog", { name: "Teknoloji" }).getByRole("row")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await page.getByText("Kapsam, yöntem ve sınırlar", { exact: true }).click();
  await expect(page.getByText(/net satış kâr olarak yorumlanamaz/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("example-light.png"), fullPage: true });

  await page.getByRole("button", { name: "Karanlık moda geç" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByTestId("report-chart").locator("svg")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("example-dark.png"), fullPage: true });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Satışların net resmi." })).toBeVisible();
  await page.getByRole("link", { name: "Analize başla" }).click();
  await expect(page.getByRole("dialog", { name: "Giriş yap" })).toBeVisible();
});

test("normal hareket tercihiyle grafik değişimi ve kaynak paneli kullanılabilir kalır", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/ornek-rapor");
  await expect(page.getByTestId("report-chart").locator("svg")).toBeVisible();
  await page.getByRole("button", { name: "Kategoriler", exact: true }).click();
  await page.getByRole("button", { name: /Teknoloji 1.100 TL/ }).click();
  await expect(page.getByRole("dialog", { name: "Teknoloji" })).toBeVisible();
  await page.getByRole("button", { name: "Kaynak incelemesini kapat" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
