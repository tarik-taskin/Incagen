import { expect, test } from "@playwright/test";
import { setTheme } from "./ui-helpers";

test("ana sayfa çalışma alanı kodu olmadan açılır; ilk açılan yardım gönderilmemiş metni korur", async ({ page }) => {
  const forbiddenRequests: string[] = [];
  await page.route(/\/src\/(?:pages\/(?:new-analysis|history|settings|plan|analysis)-page|components\/(?:require-auth|workspace-provider|layout\/app-shell))\.tsx/, async route => {
    forbiddenRequests.push(route.request().url());
    await route.abort();
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Destek ve yardım", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Destek ve yardım", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Bize yazın", exact: true }).click();
  await dialog.getByLabel("Mesajınız", { exact: true }).fill("Göndermediğim destek taslağı");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Destek ve yardım", exact: true }).click();
  await expect(dialog.getByLabel("Mesajınız", { exact: true })).toHaveValue("Göndermediğim destek taslağı");
  expect(forbiddenRequests).toEqual([]);
});

test("rapor bölüm adresleri doğrudan açılır; dönem, yeniden açma ve geri/ileri doğru bölümü korur", async ({ page }, testInfo) => {
  await page.goto("/ornek-rapor?period=q4#kaynaklar");
  await expect(page.locator("#source-details")).toHaveAttribute("open");
  await expect(page.locator("#kaynaklar")).toBeInViewport();
  await expect(page.getByRole("heading", { name: "Yıllık performans raporu", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Son çeyrek", exact: true })).toHaveAttribute("aria-pressed", "true");
  const finance = page.getByRole("link", { name: "Finansal detay", exact: true });
  await finance.click();
  await expect(page).toHaveURL(/\?period=q4#finansal-detay$/);
  await expect(page.locator("#financial-details")).toHaveAttribute("open");
  await page.getByText("Finansal tablolar", { exact: true }).click();
  await expect(page.locator("#financial-details")).not.toHaveAttribute("open");
  await finance.click();
  await expect(page.locator("#financial-details")).toHaveAttribute("open");
  await page.goBack();
  await expect(page).toHaveURL(/\?period=q4#kaynaklar$/);
  await expect(page.locator("#source-details")).toHaveAttribute("open");
  await page.goForward();
  await expect(page).toHaveURL(/\?period=q4#finansal-detay$/);
  await page.reload();
  await expect(page.locator("#financial-details")).toHaveAttribute("open");
  await expect(page.getByRole("table", { name: "Aylık performans, 2025 · Son çeyrek", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Tam yıl", exact: true }).click();
  await expect(page).toHaveURL(/\/ornek-rapor$/);
  await expect(page.locator("#financial-details")).not.toHaveAttribute("open");
  await expect(page.getByText("Grafik veya tablodan bir değer seçerek kaynağı açın.", { exact: true })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("report-overview-light.png"), fullPage: true });
  await setTheme(page, { mode: "dark" });
  await page.screenshot({ path: testInfo.outputPath("report-overview-dark.png"), fullPage: true });
});
