import { Buffer } from "node:buffer";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import tr from "../src/i18n/locales/tr.json" with { type: "json" };
import en from "../src/i18n/locales/en.json" with { type: "json" };
import de from "../src/i18n/locales/de.json" with { type: "json" };
import es from "../src/i18n/locales/es.json" with { type: "json" };
import zh from "../src/i18n/locales/zh.json" with { type: "json" };
import ar from "../src/i18n/locales/ar.json" with { type: "json" };
import { chooseLanguage, setTheme } from "./ui-helpers";

// Yalnız izole test ortamında benzersiz sentetik hesap ve yükleme taslağı oluşturur.
async function openDraft(page: Page) {
  await page.goto("/app/new-analysis");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`preparation-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();
  await page.getByLabel("İşletme adı", { exact: true }).fill("Sentetik Teknoloji");
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("Belge kapsamı");
  await page.getByLabel("Analiz hedefi", { exact: true }).fill("Belgedeki konuları kaynaklarıyla incele");
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles({ name: "kapsam.txt", mimeType: "text/plain", buffer: Buffer.from("Sentetik hizmet faaliyetleri ve kaynak kontrolü.") });
}

// Ekranı gereksiz bekleme eklemeden ağ olayında tutmak için testin açtığı bir kapı üretir.
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function checkLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
}

test("oluşturma, gerçek yükleme ve hazırlama ayrı görünür; rota/dil değişimi işlemi kesmez; teknik bilgiler saklanır", async ({ page }, testInfo) => {
  await openDraft(page);
  const creation = gate(), upload = gate(), preparation = gate();
  await page.route("**/createAnalysis", async route => { await creation.promise; await route.continue(); });
  await page.route(/http:\/\/127\.0\.0\.1:9199\/v0\/b\/.+\/o/, async route => {
    if (["POST", "PUT"].includes(route.request().method())) await upload.promise;
    await route.continue();
  });
  await page.route("**/prepareAnalysis", async route => { await preparation.promise; await route.continue(); });
  try {
    await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
    const status = page.getByRole("region", { name: "Belge hazırlama durumu", exact: true });
    await expect(status).toContainText("Çalışma oluşturuluyor");
    await expect(status.getByRole("progressbar")).toHaveCount(0);
    await expect(status.getByRole("link", { name: "İşlemi izle", exact: true })).toHaveCount(0);
    creation.release();
    await expect(status).toContainText("Dosyalar yükleniyor");
    await expect(status).toContainText("kapsam.txt");
    await expect(status.getByRole("progressbar")).toHaveAttribute("value", "0");
    await checkLayout(page);
    await page.screenshot({ path: testInfo.outputPath("upload-stage.png"), fullPage: true });
    upload.release();
    await expect(status).toContainText("Belgeler hazırlanıyor");
    await expect(status.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yüklemeyi iptal et", exact: true })).toHaveCount(0);
    for (const [code, catalog] of Object.entries({ tr, en, de, es, zh, ar })) {
      await chooseLanguage(page, code);
      await expect(page.getByRole("region", { name: catalog["Belge hazırlama durumu"], exact: true })).toContainText(catalog["Belgeler hazırlanıyor"]);
      await checkLayout(page);
      if (code === "ar") await page.screenshot({ path: testInfo.outputPath("preparation-rtl.png"), fullPage: true });
    }
    await chooseLanguage(page, "tr");
    const nav = page.getByRole("navigation", { name: testInfo.project.name === "mobile-chromium" ? "Mobil navigasyon" : "Ana navigasyon" });
    await nav.getByRole("link", { name: "Geçmiş", exact: true }).click();
    await expect(status).toHaveCount(1);
    await expect(status).toContainText("Belgeler hazırlanıyor");
    await setTheme(page, { mode: "dark" });
    await checkLayout(page);
    await page.screenshot({ path: testInfo.outputPath("preparation-compact-dark.png"), fullPage: true });
    await nav.getByRole("link", { name: "Yeni analiz", exact: true }).click();
    preparation.release();
    await expect(page).toHaveURL(/\/app\/analyses\//, { timeout: 30000 });
    await expect(page.getByText("Analize hazır", { exact: true })).toBeVisible();
    const details = page.locator("details").filter({ has: page.getByText("Teknik ayrıntılar", { exact: true }) });
    await expect(details).not.toHaveAttribute("open");
    await expect(page.getByRole("list", { name: "Hazırlanan belgeler" }).getByText("kapsam.txt")).toBeVisible();
    await checkLayout(page);
    await page.screenshot({ path: testInfo.outputPath("prepared-dark.png"), fullPage: true });
    await page.getByText("Teknik ayrıntılar", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(details.getByText("text/plain", { exact: true })).toBeVisible();
    await setTheme(page, { mode: "light" });
    await checkLayout(page);
    await page.screenshot({ path: testInfo.outputPath("prepared-details-light.png"), fullPage: true });
  } finally { creation.release(); upload.release(); preparation.release(); }
});

test("çevrimdışı uyarısı altı dilde tek kalır; yeniden bağlantı ve iç gezinme taslağı değiştirmez", async ({ page, context }, testInfo) => {
  await openDraft(page);
  let operations = 0;
  page.on("request", request => { if (request.url().endsWith("/createAnalysis")) operations++; });
  const nav = page.getByRole("navigation", { name: testInfo.project.name === "mobile-chromium" ? "Mobil navigasyon" : "Ana navigasyon" });
  await nav.getByRole("link", { name: "Geçmiş", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Geçmiş analizleriniz", exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Yeni analiz", exact: true }).click();
  await context.setOffline(true);
  try {
    for (const [code, catalog] of Object.entries({ tr, en, de, es, zh, ar })) {
      await chooseLanguage(page, code);
      await expect(page.getByText(catalog["Çevrimdışı görünüyorsunuz"], { exact: true })).toHaveCount(1);
      await expect(page.getByLabel(catalog["Analiz hedefi"], { exact: true })).toHaveValue("Belgedeki konuları kaynaklarıyla incele");
      await checkLayout(page);
    }
    await chooseLanguage(page, "tr");
    await setTheme(page, { mode: "dark" });
    await checkLayout(page);
    await page.screenshot({ path: testInfo.outputPath("offline-dark.png"), fullPage: true });
    await nav.getByRole("link", { name: "Geçmiş", exact: true }).click();
    await expect(page.getByText("Çevrimdışı görünüyorsunuz", { exact: true })).toHaveCount(1);
    await nav.getByRole("link", { name: "Yeni analiz", exact: true }).click();
    await expect(page.getByText("kapsam.txt", { exact: true })).toBeVisible();
    expect(operations).toBe(0);
  } finally { await context.setOffline(false); }
  await expect(page.getByText("Çevrimdışı görünüyorsunuz", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toHaveValue("Belge kapsamı");
  expect(operations).toBe(0);
});

test("yerel dosyalar sekme kapatmada native onay ister; temizlenince yenileme onay istemez", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Native ayrılma diyaloğu tarayıcı ve cihaz desteğine bağlıdır.");
  await openDraft(page);
  await page.getByLabel("Analiz başlığı", { exact: true }).click();
  const pending = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  const dialog = await pending;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  expect(page.isClosed()).toBe(false);
  await expect(page.getByText("kapsam.txt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tümünü temizle", exact: true }).click();
  let prompts = 0;
  page.on("dialog", async next => { prompts++; await next.dismiss(); });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın", exact: true })).toBeVisible();
  expect(prompts).toBe(0);
});
