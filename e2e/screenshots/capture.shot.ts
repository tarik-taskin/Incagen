import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

type Mode = "light" | "dark";

const docsDir = path.resolve("docs/screenshots");

// Liquid Glass görünümünü ve istenen modu ilk çizimden önce uygular.
async function useTheme(page: Page, mode: Mode) {
  await page.addInitScript(([theme]) => {
    localStorage.setItem("incagen-theme", theme);
    localStorage.setItem("incagen-style", "glass");
  }, [mode]);
}

// Görünen alanı README için webp olarak kaydeder; ana sayfaya ekran görüntüsü eklemez.
async function save(page: Page, name: string, mode: Mode) {
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot();
  await sharp(png).webp({ quality: 82 }).toFile(path.join(docsDir, `${name}-${mode}.webp`));
}

// Bölümü başlığının hemen altından görünür alana alır; grafiklerin geç başlaması için kısa süre bekler.
async function scrollTo(page: Page, selector: string, offset = 96) {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.evaluate(([target, top]) => {
    const element = document.querySelector(target as string);
    if (element) window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - (top as number), behavior: "auto" });
  }, [selector, offset]);
  await page.waitForTimeout(700);
}

test.beforeAll(async () => {
  await mkdir(docsDir, { recursive: true });
});

for (const mode of ["light", "dark"] as const) {
  test(`örnek rapor görselleri (${mode})`, async ({ page }) => {
    await useTheme(page, mode);
    await page.goto("/ornek-rapor");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(600);
    await save(page, "report-overview", mode);

    for (const id of ["trend", "category", "channel", "region"]) await scrollTo(page, `[data-testid="chart-${id}"]`, 360);
    await scrollTo(page, "#ticari-performans", 88);
    await save(page, "report-charts", mode);

    await page.getByRole("link", { name: "Finansal detay", exact: true }).click();
    await expect(page.locator("#financial-details")).toHaveAttribute("open");
    await scrollTo(page, "#financial-details", 76);
    await save(page, "report-table", mode);

    await page.goto("/ornek-rapor/musteri-deneyimi");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(600);
    await save(page, "feedback-report", mode);
  });

  test(`çalışma alanı görseli (${mode})`, async ({ page }) => {
    await useTheme(page, mode);
    await page.goto("/app/new-analysis");
    await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
    await page.getByLabel("E-posta", { exact: true }).fill(`screens-${crypto.randomUUID()}@example.test`);
    await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
    await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
    await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();
    await page.getByLabel("İşletme adı", { exact: true }).fill("Atlas Teknoloji");
    await page.getByLabel("Analiz başlığı", { exact: true }).fill("2025 yıllık performans");
    await page.getByLabel("Analiz hedefi", { exact: true }).fill("Satışların dönemler arasında nasıl değiştiğini ve hangi kategorilerin öne çıktığını görmek istiyorum.");
    await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles([
      { name: "aylik-satislar.csv", mimeType: "text/csv", buffer: Buffer.from("ay,net_satis\nOcak,212000000\nŞubat,224000000\n") },
      { name: "yonetim-notu.txt", mimeType: "text/plain", buffer: Buffer.from("Sentetik yönetim notu: kanal karması ve bütçe gerçekleşmesi.") },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await save(page, "workspace", mode);
  });
}
