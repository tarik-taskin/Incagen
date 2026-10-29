import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";

// Yalnız görünür form başlığını değil, sayfanın gerçek kaydırma konumunu da doğrular.
async function expectAnalysisAtTop(page: Page) {
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  const heading = page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın", exact: true });
  await expect(heading).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const bounds = await heading.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(64);
  expect(bounds!.y).toBeLessThan(220);
}

test("iki örnek aynı başlık, sekme ve içerik eksenini kullanır; landing görsel önizleme yüklemez", async ({ page }, testInfo) => {
  if (!testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 1680, height: 1000 });
  const previewRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("/showcase/")) previewRequests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hazırlanan raporun nasıl göründüğünü inceleyin." })).toHaveCount(0);
  expect(previewRequests).toEqual([]);
  await page.getByRole("link", { name: "Örnek raporu incele", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Performansın");
  const commercial = await page.getByRole("heading", { level: 1 }).boundingBox();
  const nav = await page.getByRole("navigation", { name: "Örnek rapor navigasyonu" }).boundingBox();
  const tabs = await page.getByRole("navigation", { name: "Örnek raporlar" }).boundingBox();
  expect(Math.abs(commercial!.x - tabs!.x)).toBeLessThan(2);
  await page.getByRole("link", { name: "Müşteri deneyimi", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Müşterinin sesinden");
  const feedback = await page.getByRole("heading", { level: 1 }).boundingBox();
  const feedbackNav = await page.getByRole("navigation", { name: "Örnek rapor navigasyonu" }).boundingBox();
  const feedbackTabs = await page.getByRole("navigation", { name: "Örnek raporlar" }).boundingBox();
  expect(Math.abs(feedback!.x - commercial!.x)).toBeLessThan(2);
  expect(Math.abs(feedbackTabs!.y - tabs!.y)).toBeLessThan(2);
  expect(Math.abs(feedbackNav!.width - nav!.width)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath("aligned-feedback.png") });
});

test("ana sayfa alt çağrısı, üst çağrı, plan, rapor ve aktif navigasyon analizi baştan açar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Çalışma alanına geç", exact: true }).click();
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`entry-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expectAnalysisAtTop(page);
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles([{ name: "korunan.txt", mimeType: "text/plain", buffer: Buffer.from("Sentetik belge") }]);
  const navigation = page.getByRole("navigation", { name: page.viewportSize()!.width >= 1024 ? "Ana navigasyon" : "Mobil navigasyon", exact: true });
  await navigation.getByRole("link", { name: "Plan", exact: true }).click();
  await page.getByRole("link", { name: "Yeni analiz aç", exact: true }).click();
  await expectAnalysisAtTop(page);
  await expect(page.getByText("korunan.txt", { exact: true })).toBeVisible();
  await page.getByText("Bir konuya odaklanın.", { exact: true }).scrollIntoViewIfNeeded();
  await navigation.getByRole("link", { name: "Yeni analiz", exact: true }).click();
  await expectAnalysisAtTop(page);
  await expect(page.getByText("korunan.txt", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Nasıl çalışır?", exact: true }).click();
  await page.getByRole("button", { name: "Analize başla", exact: true }).click();
  await expectAnalysisAtTop(page);
  await page.getByRole("link", { name: "Nasıl çalışır?", exact: true }).click();
  await page.getByRole("link", { name: "Örnek raporu incele", exact: true }).click();
  await page.getByRole("link", { name: "Analize başla", exact: true }).click();
  await expectAnalysisAtTop(page);
});

// Sekme gezinmesi geçmişi doldurmamalı; tarayıcının gerçek Geri/İleri davranışı korunmalı.
test("örnek rapor sekmelerinden geri doğrudan ana sayfaya, ileri son örneğe döner", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Örnek raporu incele", exact: true }).click();
  await page.getByRole("link", { name: "Müşteri deneyimi", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Müşterinin sesinden");
  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Verilerinizdeki büyüme fırsatlarını keşfedin.");
  await page.goForward();
  await expect(page).toHaveURL("/ornek-rapor/musteri-deneyimi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Müşterinin sesinden");
  await page.reload();
  for (const name of ["Ticari performans", "Müşteri deneyimi", "Ticari performans", "Müşteri deneyimi"]) {
    await page.getByRole("link", { name, exact: true }).click();
  }
  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Verilerinizdeki büyüme fırsatlarını keşfedin.");
});
