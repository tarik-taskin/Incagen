import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import gold from "../fixtures/company-example/v3/expected.json" with { type: "json" };
import { chartSeriesPaths, setTheme } from "./ui-helpers";

// Raporun tamamı ve açık dialog için kritik erişilebilirlik ihlallerini durdurur.
async function accessibility(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations).toEqual([]);
}
const exactMoney = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " TL";

test("şirket raporu grafikleri, tabloları ve büyük kaynak aramasını aynı kapsamda tutar", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Örnek raporu incele" }).click();
  await expect(page.getByRole("heading", { name: "Performansın büyük resmi." })).toBeVisible();
  await expect(page.getByText("Gerçek işletme verisi içermez. Hesabınıza kaydedilmez.")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const net = page.getByRole("button", { name: `Net satış ${exactMoney(gold.year.net)}`, exact: true });
  await expect(net).toBeVisible();
  await net.click();
  let dialog = page.getByRole("dialog", { name: "Net satış", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("row")).toHaveCount(26);
  await expect(dialog.getByRole("status")).toHaveText("1–25 / 3.456 kayıt");
  await dialog.getByRole("button", { name: "Sonraki kaynak sayfası" }).click();
  await expect(dialog.getByRole("status")).toHaveText("26–50 / 3.456 kayıt");
  await dialog.getByRole("textbox", { name: "Kaynak satırlarında ara" }).fill("ATL-00501");
  await expect(dialog.getByRole("status")).toHaveText("1–1 / 1 kayıt");
  await expect(dialog.getByRole("rowheader", { name: /501/ })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Kaynak satırlarında ara" }).fill("ATL-03456");
  await expect(dialog.getByRole("rowheader", { name: /3456/ })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Kaynak satırlarında ara" }).fill("olmayan-kayit");
  await expect(dialog.getByText("Aramanızla eşleşen kaynak satırı yok.")).toBeVisible();
  await accessibility(page);
  await dialog.getByRole("button", { name: "Kaynak aramasını temizle" }).click();
  await page.screenshot({ path: testInfo.outputPath("source-explorer.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(net).toBeFocused();
  await net.click();
  await page.getByRole("dialog").getByRole("heading", { name: "Net satış", exact: true }).click();
  await expect(dialog).toBeVisible();
  if (testInfo.project.name === "mobile-chromium") await page.touchscreen.tap(2, 2); else await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  await expect(net).toBeFocused();

  await page.getByTestId("chart-trend").scrollIntoViewIfNeeded();
  await expect((await chartSeriesPaths(page, "trend")).first()).toBeVisible();
  await page.getByRole("button", { name: "Aylık net satış veri tablosu" }).click();
  await expect(page.getByRole("table", { name: "Aylık net satış, TRY" }).locator("tbody tr")).toHaveCount(12);
  await page.getByRole("button", { name: "Aylık net satış Oca kaynağı" }).click();
  await expect(page.getByRole("dialog", { name: "Oca", exact: true }).getByRole("status")).toHaveText("1–25 / 288 kayıt");
  await page.getByLabel("Tüm kaynak satırları").check();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText("1–25 / 3.456 kayıt");
  await page.keyboard.press("Escape");

  for (const id of ["category", "channel", "region", "profit", "service"]) {
    await page.getByTestId(`chart-${id}`).scrollIntoViewIfNeeded();
    await expect((await chartSeriesPaths(page, id)).first()).toBeVisible();
  }
  await (await chartSeriesPaths(page, "category", true)).first().click();
  await expect(page.getByRole("dialog", { name: "Bulut hizmetleri", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Finansal detay", exact: true }).click();
  await expect(page.getByRole("table", { name: "Kanal performansı", exact: true }).locator("tbody tr")).toHaveCount(3);
  await expect(page.getByRole("table", { name: "Gelirden katkıya hesap mutabakatı" })).toContainText(exactMoney(gold.year.contribution));

  await page.getByRole("button", { name: "Son çeyrek", exact: true }).click();
  await expect(page).toHaveURL(/period=q4/);
  await expect(page.getByRole("button", { name: `Net satış ${exactMoney(gold.q4.net)}`, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Finansal detay", exact: true }).click();
  await expect(page.getByRole("table", { name: "Aylık performans, 2025 · Son çeyrek" }).locator("tbody tr")).toHaveCount(3);
  await expect(page.getByText("903 kayıt inceleniyor")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Son çeyrek", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Tam yıl", exact: true }).click();
  await expect(page.getByRole("button", { name: `Net satış ${exactMoney(gold.year.net)}`, exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Son çeyrek", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(page.getByRole("button", { name: "Tam yıl", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "Kaynaklar", exact: true }).click();
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Satış bütçesi", exact: true }) }).getByRole("button", { name: "Belgeyi incele" }).click();
  dialog = page.getByRole("dialog", { name: "Satış bütçesi", exact: true });
  await expect(dialog.getByRole("row")).toHaveCount(13);
  await page.keyboard.press("Escape");
  for (const [title, format, query] of [["Yıllık performans raporu", "PDF", "Kanal yatırımı"], ["Ticari değerlendirme", "DOCX", "Müşteri edinme maliyeti"]]) {
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await expect(card).toContainText(format);
    await card.getByRole("button", { name: "Belgeyi incele", exact: true }).click();
    const reader = page.getByRole("dialog", { name: title, exact: true });
    await expect(reader.getByRole("article").first()).toBeVisible();
    if (format === "PDF") await expect(reader.getByRole("article")).toHaveCount(7);
    await reader.getByRole("textbox", { name: "Belge metninde ara" }).fill(query);
    await expect(reader.locator("mark").first()).toBeVisible();
    await reader.getByRole("textbox", { name: "Belge metninde ara" }).fill("olmayan-kayit");
    await expect(reader.getByText("Belgede aramanızla eşleşen bölüm yok.")).toBeVisible();
    await reader.getByRole("textbox", { name: "Belge metninde ara" }).fill("");
    await accessibility(page);
    const received = page.waitForEvent("download");
    await reader.getByRole("link", { name: `${title} özgün dosyasını indir` }).click();
    const file = await received;
    expect(file.suggestedFilename()).toMatch(format === "PDF" ? /\.pdf$/ : /\.docx$/);
    expect(await file.failure()).toBeNull();
    await page.screenshot({ path: testInfo.outputPath(`document-reader-${format}.png`) });
    await page.keyboard.press("Escape");
    await expect(card.getByRole("button", { name: "Belgeyi incele", exact: true })).toBeFocused();
  }
  await page.getByRole("link", { name: "Kaynaklar", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("enterprise-library.png") });
  for (const id of ["trend", "category", "channel", "region", "profit", "service"]) {
    await page.getByTestId(`chart-${id}`).scrollIntoViewIfNeeded();
    await expect((await chartSeriesPaths(page, id)).first()).toBeVisible();
  }
  await page.getByRole("link", { name: "Genel bakış", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= (window.visualViewport?.width ?? innerWidth))).toBe(true);
  await accessibility(page);
  await page.screenshot({ path: testInfo.outputPath("company-overview-light.png") });
  await page.screenshot({ path: testInfo.outputPath("company-full-light.png"), fullPage: true });
  await setTheme(page, { mode: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await accessibility(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= (window.visualViewport?.width ?? innerWidth))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("company-full-dark.png"), fullPage: true });
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Ticari değerlendirme", exact: true }) }).getByRole("button", { name: "Belgeyi incele" }).click();
  await expect(page.getByRole("dialog", { name: "Ticari değerlendirme", exact: true })).toBeVisible();
  await accessibility(page);
  await page.screenshot({ path: testInfo.outputPath("document-reader-dark.png") });
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Analize başla", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Giriş yap" })).toBeVisible();
});

test("hareketli raporda filtre, kaynak sekmeleri ve indirme kullanılabilir kalır", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/ornek-rapor");
  await page.getByRole("button", { name: "İlk 6 ay", exact: true }).click();
  await expect(page.getByRole("button", { name: `Net satış ${exactMoney(gold.h1.net)}`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Bütçe gerçekleşmesi/ }).click();
  const dialog = page.getByRole("dialog", { name: "Bütçe gerçekleşmesi", exact: true });
  await dialog.getByRole("button", { name: /Satış bütçesi 12 satır/ }).click();
  await expect(dialog.getByRole("status")).toHaveText("1–6 / 6 kayıt");
  await page.getByRole("button", { name: "Kaynak incelemesini kapat" }).click();
  await expect(dialog).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: /Örnek belgeleri indir/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("atlas-teknoloji-2025.zip");
  expect(await download.failure()).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= (window.visualViewport?.width ?? innerWidth))).toBe(true);
});

// Her formatın özgün dosyası, kaynak konumu ve araması gerçek örnek paketinden açılır.
test("Excel, sunum ve yapılandırılmış metin kaynakları özgün formatlarında açılır", async ({ page }, testInfo) => {
  await page.goto("/ornek-rapor");
  await page.getByRole("link", { name: "Kaynaklar", exact: true }).click();
  const library = page.locator("#kaynaklar");
  await expect(library.getByRole("article")).toHaveCount(9);
  for (const [title, format, query] of [["Satış bütçesi", "xlsx", "2025-01"], ["Yönetim sunumu", "pptx", "hizmet"], ["Rapor bağlamı", "json", "service_orders"], ["Hesap yöntemleri", "md", "Brüt kâr"], ["Yönetim devir notu", "txt", "Finans"]]) {
    const card = library.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await card.getByRole("button", { name: "Belgeyi incele", exact: true }).click();
    const reader = page.getByRole("dialog", { name: title, exact: true });
    if (format === "xlsx") {
      await expect(reader.getByRole("table").getByRole("row")).toHaveCount(13);
      await reader.getByRole("textbox", { name: "Kaynak satırlarında ara" }).fill(query);
      await expect(reader.getByRole("status")).toHaveText("1–1 / 1 kayıt");
    } else {
      if (format === "pptx") { await expect(reader.getByRole("article")).toHaveCount(3); await expect(reader.getByText("Slayt 1", { exact: true })).toBeVisible(); }
      await reader.getByRole("textbox", { name: "Belge metninde ara" }).fill(query);
      await expect(reader.locator("mark").first()).toBeVisible();
    }
    const pending = page.waitForEvent("download");
    await reader.getByRole("link", { name: `${title} özgün dosyasını indir`, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
    expect(await download.failure()).toBeNull();
    if (format === "pptx") await page.screenshot({ path: testInfo.outputPath("presentation-source.png") });
    await page.keyboard.press("Escape");
    await expect(card.getByRole("button", { name: "Belgeyi incele", exact: true })).toBeFocused();
  }
  await accessibility(page);
});

test("örnek raporda bağlantıyı kopyala mevcut görünümü korur ve tarayıcı geçmişini bozmaz", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  // 1. Ana sayfadan ticari örneğe geç
  await page.goto("/");
  await page.getByRole("link", { name: "Örnek raporu incele" }).click();
  await expect(page).toHaveURL(/\/ornek-rapor$/);

  // 2. Müşteri deneyimi örneğine geç
  await page.getByRole("link", { name: "Müşteri deneyimi", exact: true }).click();
  await expect(page).toHaveURL(/\/ornek-rapor\/musteri-deneyimi$/);

  // Müşteri deneyiminde "Bağlantıyı kopyala" butonunu kontrol et ve tıkla
  const feedbackCopyBtn = page.getByRole("button", { name: "Bağlantıyı kopyala" });
  await expect(feedbackCopyBtn).toBeVisible();
  await feedbackCopyBtn.click();
  await expect(page.getByRole("status")).toHaveText("Bağlantı kopyalandı");
  const feedbackClipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(feedbackClipboard).toContain("/ornek-rapor/musteri-deneyimi");

  // 3. Mevcut akışı doğrula: ana sayfa → ticari örnek → müşteri deneyimi → tarayıcı Geri → ana sayfa
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  // 4. İleri basınca müşteri deneyimine dönmeli
  await page.goForward();
  await expect(page).toHaveURL(/\/ornek-rapor\/musteri-deneyimi$/);

  // 5. Ticari örneğe dön, dönem seç ve açık bölümle bağlantıyı kopyala
  await page.getByRole("link", { name: "Ticari performans", exact: true }).click();
  await expect(page).toHaveURL(/\/ornek-rapor$/);

  const copyBtn = page.getByRole("button", { name: "Bağlantıyı kopyala" });
  await expect(copyBtn).toBeVisible();

  await page.getByRole("button", { name: "Son çeyrek", exact: true }).click();
  await expect(page).toHaveURL(/period=q4/);

  // Linkin güncel dönem parametresini aldığını bekle ve tıkla
  const sectionLink = page.getByRole("link", { name: "Finansal detay", exact: true });
  await expect(sectionLink).toHaveAttribute("href", /period=q4/);
  await sectionLink.click();
  await expect(page).toHaveURL(/period=q4.*#finansal-detay/);

  await copyBtn.click();
  await expect(page.getByRole("status")).toHaveText("Bağlantı kopyalandı");
  const commercialClipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(commercialClipboard).toContain("/ornek-rapor?period=q4#finansal-detay");

  // 6. Paylaşılan adresi doğrudan yeni sayfada açınca aynı görünüm oluşmalı
  await page.goto(commercialClipboard);
  await expect(page.getByRole("button", { name: "Son çeyrek", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table", { name: "Kanal performansı", exact: true })).toBeVisible();
});
