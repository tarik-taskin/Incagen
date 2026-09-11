import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Buffer } from "node:buffer";

test("kayıt, CSV, gerçek rapor, geçmiş, silme ve çıkış", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/app/new-analysis");
  await expect(page).toHaveURL(/login/);
  await page.getByRole("button", { name: "Hesabım yok, hesap oluştur" }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`report-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verilerinizi analize hazırlayın" })).toBeVisible();
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles({
    name: "satis.csv", mimeType: "text/csv",
    buffer: Buffer.from("Tarih;Tutar;Kategori\n01.09.2026;1.234,50;Mağaza\n02.09.2026;10,25;Web"),
  });
  await page.getByLabel("İşletme adı", { exact: true }).fill("Sentetik İşletme");
  await page.getByLabel("Rapor başlığı", { exact: true }).fill("Eylül satış raporu");
  await page.getByLabel("satis.csv Tarih sütunu", { exact: true }).selectOption("Tarih");
  await page.getByLabel("satis.csv Satış tutarı sütunu", { exact: true }).selectOption("Tutar");
  await page.getByLabel("satis.csv Kategori sütunu (isteğe bağlı)", { exact: true }).selectOption("Kategori");
  const nav = page.getByRole("navigation", { name: (page.viewportSize()?.width ?? 0) >= 1024 ? "Ana navigasyon" : "Mobil navigasyon" });
  await nav.getByRole("link", { name: "Ayarlar" }).click();
  await nav.getByRole("link", { name: "Yeni analiz" }).click();
  await expect(page.getByLabel("Rapor başlığı", { exact: true })).toHaveValue("Eylül satış raporu");
  await expect(page.getByText("satis.csv", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Rapor oluştur", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/analyses\//, { timeout: 30000 });
  await expect(page.getByText("Tamamlandı", { exact: true })).toBeVisible();
  await expect(page.getByText(/1.244,75/).first()).toBeVisible();
  await expect(page.getByText("Hesaplanan veri raporu — AI yorumu henüz eklenmedi")).toBeVisible();
  for (const mode of ["light", "dark"]) {
    const dark = await page.locator("html").evaluate(e => e.classList.contains("dark"));
    if (dark !== (mode === "dark")) await page.getByRole("button", { name: /moda geç/ }).click();
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
  await expect(page.getByRole("heading", { name: "Eylül satış raporu" })).toBeVisible();
  await nav.getByRole("link", { name: "Geçmiş" }).click();
  await page.getByRole("link", { name: /Eylül satış raporu/ }).click();
  await expect(page).toHaveURL(reportUrl);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Analizi ve dosyaları sil" }).click();
  await expect(page.getByText("Henüz analiziniz yok.")).toBeVisible();
  await nav.getByRole("link", { name: "Ayarlar" }).click();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
  expect(errors).toEqual([]);
});
