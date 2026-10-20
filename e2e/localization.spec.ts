import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import en from "../src/i18n/locales/en.json" with { type: "json" };
import de from "../src/i18n/locales/de.json" with { type: "json" };
import es from "../src/i18n/locales/es.json" with { type: "json" };
import zh from "../src/i18n/locales/zh.json" with { type: "json" };
import ar from "../src/i18n/locales/ar.json" with { type: "json" };

for (const [code, catalog] of Object.entries({ en, de, es, zh, ar })) {
  test(`${code}: dil seçimi, kimlik taslağı, yerelleştirilmiş menü ve örnek rapor`, async ({ page }, testInfo) => {
    const text = (key: keyof typeof en) => catalog[key];
    await page.goto("/");
    await page.getByRole("combobox", { name: "Dil", exact: true }).selectOption(code);
    await expect(page.locator("html")).toHaveAttribute("lang", code);
    await expect(page.locator("html")).toHaveAttribute("dir", code === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { name: text("Verilerinizdeki büyüme fırsatlarını keşfedin."), exact: true })).toBeVisible();
    const options = page.getByRole("combobox").locator("option");
    await expect(options).toHaveText(["Türkçe", "English", "Deutsch", "Español", "简体中文", "العربية"].map(name => catalog[name as keyof typeof catalog]));
    await page.getByRole("button", { name: text("Analize başla"), exact: true }).click();
    const modal = page.getByRole("dialog");
    await modal.getByLabel(text("E-posta"), { exact: true }).fill("sample@example.test");
    await modal.getByRole("combobox").selectOption("tr");
    await expect(modal.getByLabel("E-posta", { exact: true })).toHaveValue("sample@example.test");
    await modal.getByRole("combobox").selectOption(code);
    await expect(modal.getByLabel(text("E-posta"), { exact: true })).toHaveValue("sample@example.test");
    await modal.getByRole("button", { name: text("Giriş penceresini kapat") }).click();
    await page.getByRole("link", { name: text("Örnek raporu incele"), exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(text("büyük resmi."));
    await expect(page.locator("#financial-details")).not.toHaveAttribute("open");
    await page.getByRole("link", { name: text("Finansal detay"), exact: true }).click();
    await expect(page.locator("#financial-details")).toHaveAttribute("open");
    await expect(page.getByRole("table", { name: text("Kanal performansı"), exact: true })).toBeVisible();
    await page.getByRole("link", { name: text("Kaynaklar"), exact: true }).click();
    await expect(page.locator("#source-details")).toHaveAttribute("open");
    await expect(page.getByRole("heading", { name: text("Yıllık performans raporu"), exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: testInfo.outputPath(`${code}-sources.png`) });
    await page.reload();
    await expect(page.getByRole("combobox")).toHaveValue(code);
    await page.getByRole("link", { name: text("Müşteri deneyimi"), exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(text("net önceliklere."));
    await expect(page.getByRole("heading", { name: text("Özetleri ve önerileri netleştirin"), exact: true })).toBeVisible();
    const legend = page.getByRole("list", { name: text("Yorumların duygusu"), exact: true });
    await expect(legend.getByRole("button")).toHaveCount(3);
    await expect(legend).toContainText(text("Olumsuz"));
    await expect(legend).toContainText(text("Olumlu"));
    await expect(legend).toContainText(text("Karma"));
    const checks = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(checks.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.getByRole("button", { name: text("Karanlık moda geç"), exact: true }).click();
    for (const id of ["problems", "sentiments", "themes"]) {
      await expect(page.getByTestId(`chart-${id}`)).toHaveAttribute("dir", "ltr");
      await page.getByTestId(`chart-${id}`).scrollIntoViewIfNeeded();
      await expect(page.getByTestId(`chart-${id}`).locator("path[fill='#bba6f5'], path[stroke='#bba6f5']").first()).toBeVisible();
    }
    await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${code}-feedback-dark.png`), fullPage: true });
  });
}

test("geri bildirim örneği, kaynaklı yorumlar ve eksik ölçüm", async ({ page }, testInfo) => {
  await page.goto("/ornek-rapor/musteri-deneyimi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Müşterinin sesinden,net önceliklere.");
  await expect(page.getByRole("button", { name: /Memnuniyet puanı/ })).toContainText("—");
  await expect(page.getByRole("button", { name: /Memnuniyet puanı/ })).not.toContainText("0%");
  await expect(page.getByRole("button", { name: /İncelenen yorum/ })).toContainText("32 yorum");
  const finding = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "İyi bir özet, daha derin bir ihtiyaç" }) });
  await finding.getByRole("button", { name: "Kaynakları incele" }).click();
  const reader = page.getByRole("dialog");
  await expect(reader.getByRole("rowheader", { name: /7/ })).toBeVisible();
  await expect(reader.getByText("Yönetici özeti ana resmi net verdi; ancak müşteri segmentleri için daha ayrıntılı bir karşılaştırmaya ihtiyaç duydum. Sonuç iyi bir başlangıç oldu, karar için ek kırılımlar gerekliydi.", { exact: true })).toBeVisible();
  await expect(reader.getByRole("status")).toHaveText("1–1 / 1 kayıt");
  await page.keyboard.press("Escape");
  await expect(finding.getByRole("button", { name: "Kaynakları incele" })).toBeFocused();
  await page.getByText("Yorum defteri", { exact: true }).click();
  await expect(page.getByRole("blockquote")).toHaveCount(32);
  await page.screenshot({ path: testInfo.outputPath("feedback-ledger.png"), fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Örnek yorumları indir" }).click();
  expect((await download).suggestedFilename()).toBe("customer-feedback.csv");
});

test("çalışma alanında altı dil, taslak korunumu ve yerelleştirilmiş silme onayı", async ({ page }, testInfo) => {
  await page.goto("/app/new-analysis");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`locale-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("Yeni analiz");
  await page.getByLabel("Analiz hedefi", { exact: true }).fill("Özgün hedef metnim");
  for (const [code, catalog] of Object.entries({ en, de, es, zh, ar })) {
    await page.getByRole("combobox").first().selectOption(code);
    await expect(page.getByLabel(catalog["Analiz başlığı"], { exact: true })).toHaveValue("Yeni analiz");
    await expect(page.getByLabel(catalog["Analiz hedefi"], { exact: true })).toHaveValue("Özgün hedef metnim");
    await page.getByRole("button", { name: catalog["Satış değişimi"], exact: true }).click();
    const exampleGoal = catalog["Satışların dönemler arasında nasıl değiştiğini ve hangi kategorilerin öne çıktığını görmek istiyorum."];
    await expect(page.getByLabel(catalog["Analiz hedefi"], { exact: true })).toHaveValue(exampleGoal);
    if (code === "en") {
      await page.screenshot({ path: testInfo.outputPath("objective-undo-light.png"), fullPage: true });
      await page.getByRole("button", { name: catalog["Karanlık moda geç"], exact: true }).click();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("objective-undo-dark.png"), fullPage: true });
      await page.getByRole("button", { name: catalog["Aydınlık moda geç"], exact: true }).click();
    }
    await page.getByRole("link", { name: catalog["Ayarlar"], exact: true }).click();
    await expect(page.getByRole("heading", { name: catalog["Çalışma alanı ayarları"], exact: true })).toBeVisible();
    await page.getByRole("button", { name: catalog["Hesabı sil"], exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByLabel(catalog["Mevcut parola"], { exact: true }).fill("Synthetic123!");
    const confirmation = dialog.locator("#delete-account-confirmation");
    await confirmation.fill("HESABIMI SİL");
    await expect(dialog.getByRole("button", { name: catalog["Hesabı kalıcı olarak sil"], exact: true })).toBeDisabled();
    await confirmation.fill(catalog["HESABIMI SİL"]);
    await expect(dialog.getByRole("button", { name: catalog["Hesabı kalıcı olarak sil"], exact: true })).toBeEnabled();
    if (testInfo.project.name === "mobile-chromium") await page.touchscreen.tap(2, 2); else await page.mouse.click(2, 2);
    await expect(dialog).not.toBeVisible();
    await page.getByRole("link", { name: catalog["Plan"], exact: true }).click();
    await expect(page.getByRole("heading", { name: catalog["Planınızı ve sınırlarınızı görün"], exact: true })).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: catalog["Google Analytics ve Microsoft Clarity"] })).toHaveCount(1);
    await page.getByRole("link", { name: catalog["Geçmiş"], exact: true }).click();
    await expect(page.getByRole("heading", { name: catalog["Geçmiş analizleriniz"], exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    if (code === "ar") await page.screenshot({ path: testInfo.outputPath("arabic-workspace.png"), fullPage: true });
    await page.getByRole("link", { name: catalog["Yeni analiz"], exact: true }).click();
    await expect(page.getByLabel(catalog["Analiz başlığı"], { exact: true })).toHaveValue("Yeni analiz");
    await expect(page.getByLabel(catalog["Analiz hedefi"], { exact: true })).toHaveValue(exampleGoal);
    await page.getByRole("button", { name: catalog["Geri al"], exact: true }).click();
    await expect(page.getByLabel(catalog["Analiz hedefi"], { exact: true })).toHaveValue("Özgün hedef metnim");
  }
  await page.getByRole("combobox").first().selectOption("tr");
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toHaveValue("Yeni analiz");
});
