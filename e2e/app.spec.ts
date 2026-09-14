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

// Her senaryoyu bağımsız sentetik hesapla gerçek Auth emülatöründe başlatır.
async function register(page: Page) {
  await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`browser-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Çalışma alanınıza geçiş yapılıyor");
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();

  await expect(page.getByText("5 MB/dosya · 30 MB/analiz")).toBeVisible();
  await expect(page.getByText("5 MB/dosya · 50 MB/analiz")).toBeVisible();
}

test("landing, Premium ve geri dönüş akışı tarayıcı geçmişini doğru yönetir", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Karanlık moda geç" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: /Analize başla/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog", { name: "Giriş yap" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await register(page);
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();

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

test("farklı belge türleri hazırlanır ve listeden kaldırılabilir", async ({ page }) => {
  await page.goto("/app/new-analysis");
  await register(page);
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("group", { name: "Dosya seçim alanı" }).click({ position: { x: 24, y: 24 } });
  const fileChooser = await fileChooserPromise;

  await fileChooser.setFiles([
    { name: "faaliyet.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("sheet") },
    { name: "rapor.pdf", mimeType: "application/pdf", buffer: Buffer.from("report") },
  ]);

  await expect(page.getByText("2/10 dosya analize hazırlanıyor")).toBeVisible();
  await expect(page.getByText("faaliyet.xlsx", { exact: true })).toBeVisible();
  await expect(page.getByText("rapor.pdf")).toBeVisible();
  await page.getByRole("button", { name: "faaliyet.xlsx dosyasını kaldır" }).click();
  await expect(page.getByText("faaliyet.xlsx", { exact: true })).toHaveCount(0);
  await expectNoAccessibilityViolations(page);
});
