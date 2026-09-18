import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Buffer } from "node:buffer";

test("kayıt, belge hazırlığı, geçmiş, silme ve çıkış", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/app/new-analysis");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog", { name: "Giriş yap" })).toBeVisible();
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`report-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles({
    name: "faaliyet-ozeti.txt", mimeType: "text/plain",
    buffer: Buffer.from("Sentetik faaliyet özeti"),
  });
  await page.getByLabel("İşletme adı", { exact: true }).fill("Sentetik İşletme");
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("Eylül faaliyet analizi");
  const nav = page.getByRole("navigation", { name: (page.viewportSize()?.width ?? 0) >= 1024 ? "Ana navigasyon" : "Mobil navigasyon" });
  await nav.getByRole("link", { name: "Ayarlar" }).click();
  await nav.getByRole("link", { name: "Yeni analiz" }).click();
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toHaveValue("Eylül faaliyet analizi");
  await expect(page.getByText("faaliyet-ozeti.txt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/analyses\//, { timeout: 30000 });
  await expect(page.getByText("Analize hazır", { exact: true })).toBeVisible();
  await expect(page.getByText("Belge içerikleri ayrıştırıldı — AI yorumu henüz eklenmedi")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Belgelerin içeriği ayrıştırıldı" })).toBeVisible();
  await expect(page.getByText("faaliyet-ozeti.txt", { exact: true })).toBeVisible();
  await expect(page.getByText("Sentetik faaliyet özeti".length.toLocaleString("tr-TR"), { exact: true })).toBeVisible();
  for (const mode of ["light", "dark"]) {
    const dark = await page.locator("html").evaluate(e => e.classList.contains("dark"));
    if (dark !== (mode === "dark")) await page.getByRole("button", { name: /moda geç/ }).click();
    await expect(page.locator("html")).toHaveClass(mode === "dark" ? /dark/ : /^(?!.*dark).*$/);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("report-" + mode + ".png"), fullPage: true });
  }
  const reportUrl = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Eylül faaliyet analizi" })).toBeVisible();
  await nav.getByRole("link", { name: "Geçmiş" }).click();
  await page.getByRole("link", { name: /Eylül faaliyet analizi/ }).click();
  await expect(page).toHaveURL(reportUrl);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Analizi ve belgeleri sil" }).click();
  await expect(page.getByText("Henüz analiziniz yok.")).toBeVisible();
  await nav.getByRole("link", { name: "Ayarlar" }).click();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
