import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Buffer } from "node:buffer";
import { chooseLanguage, setTheme } from "./ui-helpers";

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
  await page.getByRole("button", { name: "Müşteri geri bildirimleri", exact: true }).click();
  const objective = "Faaliyet belgesindeki ana konuları ve kaynaklarını görmek istiyorum.";
  await page.getByLabel("Analiz hedefi", { exact: true }).fill(objective);
  for (const mode of ["light", "dark"]) {
    await setTheme(page, { mode: mode as "light" | "dark" });
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("objective-" + mode + ".png"), fullPage: true });
  }
  const nav = page.getByRole("navigation", { name: (page.viewportSize()?.width ?? 0) >= 1024 ? "Ana navigasyon" : "Mobil navigasyon" });
  await nav.getByRole("link", { name: "Ayarlar" }).click();
  await nav.getByRole("link", { name: "Yeni analiz" }).click();
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toHaveValue("Eylül faaliyet analizi");
  await expect(page.getByLabel("Analiz hedefi", { exact: true })).toHaveValue(objective);
  await expect(page.getByText("faaliyet-ozeti.txt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/analyses\//, { timeout: 30000 });
  await expect(page.getByText("Analize hazır", { exact: true })).toBeVisible();
  await expect(page.getByText(objective, { exact: true })).toBeVisible();
  await expect(page.getByText("Belge içerikleri ayrıştırıldı — AI yorumu henüz eklenmedi")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Belgelerin içeriği ayrıştırıldı" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Hazırlanan belgeler" }).getByText("faaliyet-ozeti.txt", { exact: true })).toBeVisible();
  const technical = page.locator("details").filter({ has: page.getByText("Teknik ayrıntılar", { exact: true }) });
  await expect(technical).not.toHaveAttribute("open");
  await page.getByText("Teknik ayrıntılar", { exact: true }).click();
  await expect(technical.getByText("Sentetik faaliyet özeti".length.toLocaleString("tr-TR"), { exact: true }).first()).toBeVisible();
  await page.getByText("Teknik ayrıntılar", { exact: true }).click();
  const completedReportUrl = page.url();
  await page.getByRole("link", { name: "Yeni analiz oluştur" }).click();
  await expect(page.getByText("Sentetik İşletme", { exact: true })).toBeVisible();
  await expect(page.getByLabel("İşletme adı", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Değiştir" }).click();
  await expect(page.getByLabel("İşletme adı", { exact: true })).toHaveValue("Sentetik İşletme");
  await page.getByRole("button", { name: "Bu adı kullan" }).click();
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Analiz hedefi", { exact: true })).toHaveValue("");
  await expect(page.getByText("faaliyet-ozeti.txt", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("new-analysis-reused-business.png"), fullPage: true });
  await page.getByRole("link", { name: "Son işlemi aç" }).click();
  await expect(page).toHaveURL(completedReportUrl);
  for (const mode of ["light", "dark"]) {
    await setTheme(page, { mode: mode as "light" | "dark" });
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
  await expect(page.getByText(objective, { exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Geçmiş" }).click();
  await page.getByRole("link", { name: /Eylül faaliyet analizi/ }).click();
  await expect(page).toHaveURL(reportUrl);
  const reportDeleteTrigger = page.getByRole("button", { name: "Analizi ve belgeleri sil" });
  await reportDeleteTrigger.click();
  await page.mouse.click(2, 2);
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(reportDeleteTrigger).toBeFocused();
  await reportDeleteTrigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(reportDeleteTrigger).toBeFocused();

  await reportDeleteTrigger.click();
  const reportDeleteDialog = page.getByRole("alertdialog");
  const deleteEndpoint = /\/deleteAnalysis(?:\?|$)/;
  const deleteGate = Promise.withResolvers<void>();
  let reportDeleteRequests = 0;
  await page.route(deleteEndpoint, async route => {
    if (route.request().method() === "POST") {
      reportDeleteRequests++;
      await deleteGate.promise;
    }
    await route.continue();
  });
  try {
    await reportDeleteDialog.getByRole("button", { name: "Analizi sil", exact: true }).click();
    await expect(reportDeleteDialog).toBeVisible();
    await expect(reportDeleteDialog.getByRole("button", { name: "Siliniyor…" })).toBeDisabled();
    await expect(reportDeleteDialog.getByRole("button", { name: "Vazgeç" })).toBeDisabled();
    expect(reportDeleteRequests).toBe(1);
    await page.keyboard.press("Escape");
    await page.mouse.click(2, 2);
    await page.keyboard.press("Tab");
    await expect(reportDeleteDialog).toBeVisible();
    expect(await page.evaluate(() => Boolean(document.activeElement && document.activeElement !== document.body && !document.activeElement.closest("dialog")))).toBe(false);
  } finally {
    deleteGate.resolve();
  }
  await expect(page).toHaveURL(/\/app\/history$/);
  await page.unroute(deleteEndpoint);
  await expect(page.getByRole("status").filter({ hasText: "1 analiz ve kaynak belgeleri silindi." })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Henüz analiziniz yok.")).toBeVisible();
  await nav.getByRole("link", { name: "Ayarlar" }).click();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("geçmişte tekli silme onayla, klavyeyle ve iki temada çalışır", async ({ page }, testInfo) => {
  // İki hazırlama ve tekli silme çağrıları CI'daki soğuk emülatörlerde tek ekran testinden uzun sürer.
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
    await page.getByLabel("Analiz hedefi", { exact: true }).fill("Belgedeki ana konuları açıkla.");
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
  await page.mouse.click(2, 2);
  await expect(confirmation).not.toBeVisible();
  await expect(menuTrigger).toBeFocused();
  await expect(history.getByRole("listitem")).toHaveCount(2);

  await menuTrigger.click();
  await expect(menuTrigger).toHaveAttribute("aria-expanded", "true");
  await menu.getByRole("button", { name: "Analizi sil", exact: true }).click();
  const deleteEndpoint = /\/deleteAnalysis(?:\?|$)/;
  const singleGate = Promise.withResolvers<void>();
  await page.route(deleteEndpoint, async route => {
    if (route.request().method() === "POST") await singleGate.promise;
    await route.continue();
  });
  try {
    await confirmation.getByRole("button", { name: "Analizi sil", exact: true }).click();
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Siliniyor…" })).toBeDisabled();
    await expect(confirmation.getByRole("button", { name: "Vazgeç" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(2, 2);
    await expect(confirmation).toBeVisible();
  } finally {
    singleGate.resolve();
  }
  await expect(confirmation).not.toBeVisible({ timeout: 30_000 });
  await page.unroute(deleteEndpoint);
  await expect(page.getByRole("status").filter({ hasText: "1 analiz ve kaynak belgeleri silindi." })).toBeVisible({ timeout: 30_000 });
  await expect(history.getByRole("listitem")).toHaveCount(1, { timeout: 30_000 });

  await page.getByRole("button", { name: "Seç ve sil" }).click();
  await page.getByRole("button", { name: "Görünenleri seç" }).click();
  await expect(page.getByText("1 analiz seçildi")).toBeVisible();
  await setTheme(page, { mode: "dark" });
  await page.screenshot({ path: testInfo.outputPath("history-dark-selection.png"), fullPage: true });
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const bulkDeleteTrigger = page.getByRole("button", { name: "Seçilenleri sil" });
  await bulkDeleteTrigger.click();
  await expect(confirmation).toContainText("Bu analizi silmek istiyor musunuz?");
  await confirmation.getByRole("button", { name: "Vazgeç" }).click();
  await expect(bulkDeleteTrigger).toBeFocused();
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("1 analiz seçildi")).toBeVisible();
  expect(errors).toEqual([]);
});

test("geçmişte toplu silme gerçek ilerleme, arka plan kilidi, Arapça RTL ve kısmi hata tekrarını uygular", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/app/new-analysis");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill("bulk-" + crypto.randomUUID() + "@example.test");
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();

  for (let index = 1; index <= 2; index++) {
    if (index > 1) await page.goto("/app/new-analysis");
    await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles({
      name: "toplu-" + index + ".txt", mimeType: "text/plain",
      buffer: Buffer.from("Toplu sentetik " + index),
    });
    await page.getByLabel("İşletme adı", { exact: true }).fill("Toplu İşletme");
    await page.getByLabel("Analiz başlığı", { exact: true }).fill("Toplu testi " + index);
    await page.getByLabel("Analiz hedefi", { exact: true }).fill("Belgedeki ana konuları açıkla.");
    await page.getByRole("button", { name: "Belgeleri ayrıştır" }).click();
    await expect(page.getByText("Analize hazır", { exact: true })).toBeVisible({ timeout: 30_000 });
  }

  await page.goto("/app/history");
  const history = page.getByRole("list", { name: "Analiz geçmişi" });
  await expect(history.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("button", { name: "Seç ve sil" }).click();
  await page.getByRole("button", { name: "Görünenleri seç" }).click();
  await expect(page.getByText("2 analiz seçildi")).toBeVisible();

  const confirmation = page.getByRole("alertdialog");
  // Arapça RTL üzerinde açılış ve erişilebilirlik kontrolü yapıp Türkçe görünüme döner.
  await chooseLanguage(page, "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "حذف المحدد" }).click();
  await expect(confirmation).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(confirmation).not.toBeVisible();
  await chooseLanguage(page, "tr");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

  await page.getByRole("button", { name: "Seçilenleri sil" }).click();
  const deleteEndpoint = /\/deleteAnalysis(?:\?|$)/;
  const gate1 = Promise.withResolvers<void>();
  const gate2 = Promise.withResolvers<void>();
  const bulkSentIds: string[] = [];
  let bulkCalls = 0;
  await page.route(deleteEndpoint, async route => {
    if (route.request().method() !== "POST") return route.continue();
    bulkCalls++;
    const body = route.request().postDataJSON() as { data?: { id?: string } };
    if (body?.data?.id) bulkSentIds.push(body.data.id);
    if (bulkCalls === 1) {
      await gate1.promise;
      return route.continue();
    }
    await gate2.promise;
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { status: "UNAVAILABLE", message: "Sentetik hata" } }),
    });
  });
  try {
    await confirmation.getByRole("button", { name: "2 analizi sil", exact: true }).click();
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Siliniyor… 1/2" })).toBeDisabled();
    await expect(confirmation.getByRole("button", { name: "Vazgeç" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(2, 2);
    await page.keyboard.press("Tab");
    await expect(confirmation).toBeVisible();
    expect(await page.evaluate(() => Boolean(document.activeElement && document.activeElement !== document.body && !document.activeElement.closest("dialog")))).toBe(false);
    await expect(history.getByRole("checkbox").first()).toBeChecked();
  } finally {
    gate1.resolve();
  }
  await expect(confirmation.getByRole("button", { name: "Siliniyor… 2/2" })).toBeDisabled({ timeout: 30_000 });
  gate2.resolve();

  await expect(confirmation).toBeVisible({ timeout: 30_000 });
  await expect(confirmation.getByRole("heading", { name: "1 analiz silinemedi." })).toBeVisible({ timeout: 30_000 });
  await page.unroute(deleteEndpoint);
  await expect(confirmation).toContainText("1 analiz ve kaynak belgeleri silindi.");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const retryIds: string[] = [];
  await page.route(deleteEndpoint, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { data?: { id?: string } };
      if (body?.data?.id) retryIds.push(body.data.id);
    }
    await route.continue();
  });
  await confirmation.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(confirmation).not.toBeVisible({ timeout: 30_000 });
  await page.unroute(deleteEndpoint);
  expect(retryIds).toEqual([bulkSentIds[1]]);
  await expect(page.getByRole("status").filter({ hasText: "1 analiz ve kaynak belgeleri silindi." })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Henüz analiziniz yok.")).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});
