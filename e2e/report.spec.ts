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
  const completedReportUrl = page.url();
  await page.getByRole("link", { name: "Yeni analiz oluştur" }).click();
  await expect(page.getByLabel("İşletme adı", { exact: true })).toHaveValue("Sentetik İşletme");
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toHaveValue("");
  await expect(page.getByText("faaliyet-ozeti.txt", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Son işlemi aç" }).click();
  await expect(page).toHaveURL(completedReportUrl);
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

test("geçmişte tekli ve toplu silme onayla, klavyeyle ve iki temada çalışır", async ({ page }, testInfo) => {
  // Üç hazırlama ve üç silme çağrısı CI'daki soğuk emülatörlerde tek ekran testinden uzun sürer.
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/app/new-analysis");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill("history-" + crypto.randomUUID() + "@example.test");
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();

  for (let index = 1; index <= 2; index++) {
    if (index > 1) await page.goto("/app/new-analysis");
    await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles({
      name: "ornek-" + index + ".txt", mimeType: "text/plain",
      buffer: Buffer.from("Sentetik analiz " + index),
    });
    await page.getByLabel("İşletme adı", { exact: true }).fill("Sentetik İşletme");
    await page.getByLabel("Analiz başlığı", { exact: true }).fill("Geçmiş testi " + index);
    await page.getByRole("button", { name: "Belgeleri ayrıştır" }).click();
    await expect(page.getByText("Analize hazır", { exact: true })).toBeVisible({ timeout: 30_000 });
  }

  await page.goto("/app/history");
  const history = page.getByRole("list", { name: "Analiz geçmişi" });
  await expect(history.getByRole("listitem")).toHaveCount(2);
  const archiveSummary = page.getByRole("region", { name: "Arşiv özeti" });
  await expect(archiveSummary).toContainText("Toplam analiz2");
  await expect(archiveSummary).toContainText("Analize hazır2");
  const completedSummary = archiveSummary.locator('[aria-describedby="history-summary-help-1"]');
  await completedSummary.hover();
  await expect(page.getByRole("tooltip", { name: "Belgeleri başarıyla ayrıştırılan ve açılmaya hazır analizler." })).toBeVisible();
  await completedSummary.focus();
  await expect(completedSummary).toBeFocused();
  await page.getByLabel("Arşivde ara").fill("Geçmiş testi 1");
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await expect(page).toHaveURL(/q=Ge%C3%A7mi%C5%9F\+testi\+1/);
  await page.reload();
  await expect(page.getByLabel("Arşivde ara")).toHaveValue("Geçmiş testi 1");
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await expect(page).toHaveURL(/\/app\/history$/);
  await page.screenshot({ path: testInfo.outputPath("history-light.png"), fullPage: true });
  const menuTrigger = page.getByRole("button", { name: "Geçmiş testi 1 için diğer işlemler" });
  await menuTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Analizi aç" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menuTrigger).toBeFocused();
  // Escape odaklamayı menü kapanmadan önce yapabildiği için kapanışın render edilmesini de bekler.
  await expect(menuTrigger).toHaveAttribute("aria-expanded", "false");

  await menuTrigger.click();
  await expect(menuTrigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByLabel("Geçmiş testi 1 işlemleri");
  await expect(menu).toBeVisible();
  if (testInfo.project.name === "mobile-chromium") {
    const menuBottom = await menu.evaluate(element => element.getBoundingClientRect().bottom);
    const navTop = await page.getByRole("navigation", { name: "Mobil navigasyon" })
      .evaluate(element => element.getBoundingClientRect().top);
    expect(menuBottom).toBeLessThan(navTop);
  }
  await menu.getByRole("button", { name: "Analizi sil", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText("Bu işlem geri alınamaz");
  await confirmation.getByRole("button", { name: "Vazgeç" }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(history.getByRole("listitem")).toHaveCount(2);

  await menuTrigger.click();
  await expect(menuTrigger).toHaveAttribute("aria-expanded", "true");
  await menu.getByRole("button", { name: "Analizi sil", exact: true }).click();
  await confirmation.getByRole("button", { name: "Analizi sil", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 analiz ve kaynak belgeleri silindi." })).toBeVisible({ timeout: 30_000 });
  await expect(history.getByRole("listitem")).toHaveCount(1, { timeout: 30_000 });

  await page.getByRole("button", { name: "Seç ve sil" }).click();
  await page.getByRole("button", { name: "Görünenleri seç" }).click();
  await expect(page.getByText("1 analiz seçildi")).toBeVisible();
  await page.getByRole("button", { name: "Karanlık moda geç" }).click();
  await page.screenshot({ path: testInfo.outputPath("history-dark-selection.png"), fullPage: true });
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Seçilenleri sil" }).click();
  await expect(confirmation).toContainText("Bu analizi silmek istiyor musunuz?");
  await confirmation.getByRole("button", { name: "Vazgeç" }).click();
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("1 analiz seçildi")).toBeVisible();
  await page.getByRole("button", { name: "Seçilenleri sil" }).click();
  await confirmation.getByRole("button", { name: "Analizi sil" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 analiz ve kaynak belgeleri silindi." })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Henüz analiziniz yok.")).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});
