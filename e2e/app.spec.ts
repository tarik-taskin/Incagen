import { Buffer } from "node:buffer";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Her sayfadaki kritik WCAG A ve AA ihlallerinin test sonucunu durdurmasını sağlar.
async function expectNoAccessibilityViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
}

test("landing sayfasından dosya hazırlama alanına geçilir ve tema değişir", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Karanlık moda geç" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("link", { name: /Analize başla/ }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await expect(page.getByRole("heading", { name: "Verilerinizi analize hazırlayın" })).toBeVisible();
});

test("çoklu dosya seçimi hazırlanır ve listeden kaldırılabilir", async ({ page }) => {
  await page.goto("/app/new-analysis");
  const input = page.getByLabel("Analiz edilecek dosyaları seç");

  await input.setInputFiles([
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
