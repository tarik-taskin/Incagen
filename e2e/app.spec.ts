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
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);

  await expect(page.getByText(/Müşteri geri bildirimleri ya da finans verileri/)).toBeVisible();
  await expect(page.getByText(/dosya başına.*MB/i)).toHaveCount(0);
  await expect(page.getByText("Yerel geliştirme ortamı — yalnız sentetik veriler kullanın.")).toHaveCount(0);
}

test("landing, Premium ve geri dönüş akışı tarayıcı geçmişini doğru yönetir", async ({ page }, testInfo) => {
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

  const navigation = getAppNavigation(page);
  await navigation.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByRole("heading", { name: "Planınızı ve sınırlarınızı görün" })).toBeVisible();
  await expect(page.getByText("AI analiz katmanı")).toHaveCount(0);
  await expect(page.getByText("Harici veri bağlantıları")).toHaveCount(0);
  await expectNoAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("plan-dark.png"), fullPage: true });
  await navigation.getByRole("link", { name: "Yeni analiz" }).click();

  await page.getByRole("button", { name: "Premium’a geç" }).click();
  await expect(page.getByRole("region", { name: "Premium ile daha geniş alan" })).toContainText("toplam 50 MB");
  await expectNoAccessibilityViolations(page);
  await page.mouse.click(12, 300);
  await expect(page.getByRole("region", { name: "Premium ile daha geniş alan" })).toHaveCount(0);
  await page.getByRole("button", { name: "Premium’a geç" }).click();
  await page.getByRole("link", { name: "Planları karşılaştır" }).click();
  await expect(page.getByRole("heading", { name: "Planınızı ve sınırlarınızı görün" })).toBeVisible();
  await navigation.getByRole("link", { name: "Yeni analiz" }).click();

  await navigation.getByRole("link", { name: "Geçmiş" }).click();
  await expect(page.getByRole("heading", { name: "Geçmiş analizleriniz" })).toBeVisible();
  await navigation.getByRole("link", { name: "Ayarlar" }).click();
  await expect(page.getByRole("heading", { name: "Çalışma alanı ayarları" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/app\/history$/);
  await expect(page.getByRole("heading", { name: "Geçmiş analizleriniz" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/app\/history$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/app\/settings$/);
});

test("Nasıl çalışır bölümü ve oturumlu logo çalışma alanına döner", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Nasıl çalışır?" })).toHaveCount(0);
  await page.goto("/#nasil-calisir");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Dağınık dosyalardan/ })).toBeVisible();
  await expect(page.getByText("Bugün kullanılabilir")).toHaveCount(0);
  await expect(page.getByText("Bir konu. Daha net bir bakış.")).toBeVisible();
  await expectNoAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("how-it-works-light.png"), fullPage: true });
  await page.getByRole("link", { name: "Incagen ana sayfa" }).click();
  await page.getByRole("button", { name: /Analize başla/ }).click();
  await register(page);
  await getAppNavigation(page).getByRole("link", { name: "Geçmiş" }).click();
  await page.getByRole("link", { name: "Yeni analize git" }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await page.getByRole("link", { name: "Nasıl çalışır?" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeVisible();
});

test("farklı belge türleri hazırlanır ve listeden kaldırılabilir", async ({ page }, testInfo) => {
  await page.goto("/app/new-analysis");
  await register(page);
  const navigation = getAppNavigation(page);
  await navigation.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByRole("heading", { name: "Free" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Premium" })).toBeVisible();
  await expect(page.getByText("AI analiz katmanı")).toHaveCount(0);
  await expect(page.getByText("Harici veri bağlantıları")).toHaveCount(0);
  await expectNoAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("plan-light.png"), fullPage: true });
  await navigation.getByRole("link", { name: "Yeni analiz" }).click();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("group", { name: "Dosya seçim alanı" }).click({ position: { x: 24, y: 24 } });
  const fileChooser = await fileChooserPromise;

  await fileChooser.setFiles([
    { name: "faaliyet.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("sheet") },
    { name: "rapor.pdf", mimeType: "application/pdf", buffer: Buffer.from("report") },
  ]);

  await expect(page.getByText("2/5 dosya analize hazırlanıyor")).toBeVisible();
  await expect(page.getByText("faaliyet.xlsx", { exact: true })).toBeVisible();
  await expect(page.getByText("rapor.pdf")).toBeVisible();
  await page.getByRole("button", { name: "faaliyet.xlsx dosyasını kaldır" }).click();
  await expect(page.getByText("faaliyet.xlsx", { exact: true })).toHaveCount(0);
  await expectNoAccessibilityViolations(page);
});

test("hazırlık özeti kapasiteyi ve eksik alan odağını iki temada korur", async ({ page }, testInfo) => {
  await page.goto("/app/new-analysis");
  await register(page);
  const summary = page.getByRole("region", { name: "Belge kapasitesi" });
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles([
    { name: "kaynak.txt", mimeType: "text/plain", buffer: Buffer.alloc(2 * 1024 ** 2, "a") },
    { name: "ikinci.txt", mimeType: "text/plain", buffer: Buffer.from("Sentetik örnek") },
  ]);
  await expect(summary.getByText("2 MB", { exact: true })).toBeVisible();
  await expect(summary.getByText("23 MB", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page.getByLabel("İşletme adı", { exact: true })).toBeFocused();
  await page.getByLabel("İşletme adı", { exact: true }).fill("Sentetik İşletme");
  await page.getByRole("button", { name: "Analiz başlığı alanını tamamla" }).click();
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toBeFocused();
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("Kaynak incelemesi");
  await page.getByRole("button", { name: "Analiz hedefi alanını tamamla" }).click();
  await expect(page.getByLabel("Analiz hedefi", { exact: true })).toBeFocused();
  await page.getByLabel("Analiz hedefi", { exact: true }).fill("İlgili kaynakların ana konularını incele.");
  await expect(page.getByText("Belgeleriniz ve çalışma ayrıntılarınız hazırlamaya hazır.")).toBeVisible();
  for (const mode of ["light", "dark"]) {
    const dark = await page.locator("html").evaluate(element => element.classList.contains("dark"));
    if (dark !== (mode === "dark")) await page.getByRole("button", { name: /moda geç/ }).click();
    await expectNoAccessibilityViolations(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.screenshot({ path: testInfo.outputPath(`preparation-${mode}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "kaynak.txt dosyasını kaldır" }).click();
  await expect(summary.getByRole("progressbar")).toHaveAttribute("value", String(Buffer.byteLength("Sentetik örnek")));
  await page.getByRole("button", { name: "Tümünü temizle" }).click();
  await expect(summary.getByText("0 B", { exact: true })).toBeVisible();
  await expect(page.getByText("Çalışma ayrıntıları hazır. Başlamak için belgelerinizi ekleyin.")).toBeVisible();
});

test("boş geçmiş, bağlantı taslakları ve doğrulanmış hesap silme", async ({ page }, testInfo) => {
  await page.goto("/app/new-analysis");
  await register(page);
  await expect(page.getByText("Yorum ve öneriler bu aşamada üretilmez.", { exact: false })).toBeVisible();
  await expect(page.getByText("AI çağrısı henüz yapılmaz.")).toHaveCount(0);
  const navigation = getAppNavigation(page);
  await navigation.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByText("50 MB")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Premium'a geç" })).toBeDisabled();
  await expect(page.getByText("Premium özellikler planlama aşamasında")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Belge formatları iki planda da aynı" })).toHaveCount(0);
  await expect(page.getByText("Premium ödeme, High AI analizi", { exact: false })).toHaveCount(0);

  await navigation.getByRole("link", { name: "Geçmiş" }).click();
  await expect(page.getByRole("heading", { name: "İlk çalışmanız burada yerini alsın." })).toBeVisible();
  await expect(page.getByRole("link", { name: "İlk analizini hazırla" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("empty-history.png"), fullPage: true });
  await page.getByRole("button", { name: "Karanlık moda geç" }).click();
  await expectNoAccessibilityViolations(page);
  await page.screenshot({ path: testInfo.outputPath("empty-history-dark.png"), fullPage: true });

  await navigation.getByRole("link", { name: "Ayarlar" }).click();
  await expect(page.getByRole("heading", { name: "Google Analytics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Microsoft Clarity" })).toBeVisible();
  const settingsOrder = await page.locator("#connections-title, #session-settings-title").allTextContents();
  expect(settingsOrder).toEqual(["Kaynakları bir araya getirin", "Aktif oturum"]);
  await expect(page.getByText("Yerel demo ortamı")).toHaveCount(0);
  await expect(page.getByText("Yakında", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hesabı bağla" })).toHaveCount(2);
  for (const button of await page.getByRole("button", { name: "Hesabı bağla" }).all()) await expect(button).toBeDisabled();
  await expectNoAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("settings-connections-dark.png"), fullPage: true });
  await page.getByRole("button", { name: "Aydınlık moda geç" }).click();
  await expectNoAccessibilityViolations(page);
  await page.screenshot({ path: testInfo.outputPath("settings-connections.png"), fullPage: true });

  await page.getByRole("button", { name: "Hesabı sil", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Hesabınızı kalıcı olarak silin" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Hesabı kalıcı olarak sil" })).toBeDisabled();
  await dialog.getByLabel("Mevcut parola").fill("Wrong123!");
  await dialog.getByLabel(/Onaylamak için/).fill("HESABIMI SİL");
  await dialog.getByRole("button", { name: "Hesabı kalıcı olarak sil" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByLabel("Mevcut parola").fill("Synthetic123!");
  await dialog.getByRole("button", { name: "Hesabı kalıcı olarak sil" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeVisible();
});
