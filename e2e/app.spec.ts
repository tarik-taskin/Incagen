import { Buffer } from "node:buffer";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Her sayfadaki kritik WCAG A ve AA ihlallerinin test sonucunu durdurmasını sağlar.
async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
}

// Görünür responsive navigasyonu mevcut tarayıcı genişliğine göre seçer.
function getAppNavigation(page: Page) {
  const navigationName = (page.viewportSize()?.width ?? 1280) >= 1024 ? "Ana navigasyon" : "Mobil navigasyon";
  return page.getByRole("navigation", { name: navigationName });
}

test("landing, Premium ve geri dönüş akışı tarayıcı geçmişini doğru yönetir", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Karanlık moda geç" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("link", { name: /Analize başla/ }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await expect(page.getByRole("heading", { name: "Verilerinizi analize hazırlayın" })).toBeVisible();

  await page.getByRole("button", { name: "Premium’a geç" }).click();
  await expect(page.getByRole("region", { name: "Premium üyelik yakında" })).toContainText("PayTR");
  await expectNoAccessibilityViolations(page);
  await page.mouse.click(12, 300);
  await expect(page.getByRole("region", { name: "Premium üyelik yakında" })).toHaveCount(0);

  const navigation = getAppNavigation(page);
  await navigation.getByRole("link", { name: "Geçmiş" }).click();
  await expect(page.getByRole("heading", { name: "Geçmiş analizleriniz" })).toBeVisible();
  await navigation.getByRole("link", { name: "Ayarlar" }).click();
  await expect(page.getByRole("heading", { name: "Çalışma alanı ayarları" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeVisible();
});

test("çoklu dosya seçimi hazırlanır ve listeden kaldırılabilir", async ({ page }) => {
  await page.goto("/app/new-analysis");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("group", { name: "Dosya seçim alanı" }).click({ position: { x: 24, y: 24 } });
  const fileChooser = await fileChooserPromise;

  await fileChooser.setFiles([
    { name: "satis.csv", mimeType: "text/csv", buffer: Buffer.from("month,total") },
    { name: "rapor.pdf", mimeType: "application/pdf", buffer: Buffer.from("report") },
  ]);

  await expect(page.getByText("2/10 dosya analize hazırlanıyor")).toBeVisible();
  await expect(page.getByText("satis.csv")).toBeVisible();
  await expect(page.getByText("rapor.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Analize hazırla" }).click();
  await expect(page.getByRole("status")).toContainText("2 dosya istemci ön kontrolünü geçti");

  await page.getByRole("button", { name: "satis.csv dosyasını kaldır" }).click();
  await expect(page.getByText("satis.csv")).toHaveCount(0);
  await expectNoAccessibilityViolations(page);
});
