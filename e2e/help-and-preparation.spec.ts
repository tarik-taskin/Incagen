import { Buffer } from "node:buffer";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import tr from "../src/i18n/locales/tr.json" with { type: "json" };
import en from "../src/i18n/locales/en.json" with { type: "json" };
import de from "../src/i18n/locales/de.json" with { type: "json" };
import es from "../src/i18n/locales/es.json" with { type: "json" };
import zh from "../src/i18n/locales/zh.json" with { type: "json" };
import ar from "../src/i18n/locales/ar.json" with { type: "json" };

// Dar ekranda genişleyen innerWidth yerine gerçek viewport sınırını ve erişilebilirliği denetler.
async function checkPage(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
}

test("yardım altı dilde sade kalır; gerçek servis yerine kontrollü teslimat yanıtını test eder", async ({ page }, testInfo) => {
  const bodies: unknown[] = [];
  let succeeds = false;
  await page.route("https://api.web3forms.com/submit", async route => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status: succeeds ? 200 : 429, contentType: "application/json", body: JSON.stringify({ success: succeeds }) });
  });
  await page.goto("/");
  for (const [code, catalog] of Object.entries({ tr, en, de, es, zh, ar })) {
    await page.getByRole("combobox").selectOption(code);
    const trigger = page.getByRole("button", { name: catalog["Destek ve yardım"], exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: catalog["Destek ve yardım"], exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByText(catalog["Analiz hedefini nasıl yazmalıyım?"], { exact: true }).click();
    await expect(dialog.locator("details[open]")).toHaveCount(1);
    await expect(dialog.locator("details[open]")).toContainText(catalog["Belgelerinizden ne öğrenmek istediğinizi açık bir soruyla anlatın. Yalnızca ‘özetle’ yazmak yerine hangi dönemi, karşılaştırmayı veya karar konusunu merak ettiğinizi belirtin. Örneğin ‘İki dönem arasında satışlar nasıl değişti ve hangi kategoriler öne çıktı?’ diyebilirsiniz. Hedefiniz bu çalışmayla birlikte saklanır."]);
    await checkPage(page);
    await dialog.getByText(catalog["Analiz hedefini nasıl yazmalıyım?"], { exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await page.getByRole("combobox").selectOption("tr");
  await page.getByRole("button", { name: "Destek ve yardım", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Destek ve yardım", exact: true });
  await dialog.getByText("Örnek raporlar hangi verileri kullanıyor?", { exact: true }).click();
  await expect(dialog.locator("details[open]")).toHaveCount(1);
  await expect(dialog).not.toContainText("Müşteri yorumlarımı nasıl eklerim?");
  await expect(dialog).not.toContainText("kurgusal");
  await page.screenshot({ path: testInfo.outputPath("help-light.png") });
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Karanlık moda geç", exact: true }).click();
  await page.getByRole("button", { name: "Destek ve yardım", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Destek ve yardım", exact: true });
  await checkPage(page);
  await page.screenshot({ path: testInfo.outputPath("help-dark.png") });
  await dialog.getByRole("button", { name: "Bize yazın", exact: true }).click();
  await dialog.getByLabel("E-posta", { exact: true }).fill("feedback@example.test");
  await dialog.getByLabel("Konu", { exact: true }).selectOption("feedback");
  await dialog.getByLabel("Mesajınız", { exact: true }).fill("İncelemek istediğim kaynak hakkında bir sorum var.");
  await dialog.getByRole("button", { name: "Mesajı gönder", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Mesajınız korundu");
  await expect(dialog.getByLabel("Mesajınız", { exact: true })).toHaveValue("İncelemek istediğim kaynak hakkında bir sorum var.");
  await expect(dialog.getByRole("heading", { name: "Mesajınız bize ulaştı" })).toHaveCount(0);
  succeeds = true;
  await dialog.getByRole("button", { name: "Mesajı gönder", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Mesajınız bize ulaştı");
  await page.screenshot({ path: testInfo.outputPath("support-success-dark.png") });
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  await checkPage(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Aydınlık moda geç", exact: true }).click();
  await page.getByRole("button", { name: "Destek ve yardım", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Mesajınız bize ulaştı");
  await checkPage(page);
  await page.screenshot({ path: testInfo.outputPath("support-success-light.png") });
});

test("rota yüklenirken erişilebilir iskelet görünür; içerik açılınca beklemeden kaldırılır", async ({ page }, testInfo) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/src/pages/example-report-page.tsx*", async route => { await gate; await route.continue(); });
  await page.goto("/ornek-rapor", { waitUntil: "domcontentloaded" });
  try {
    await expect(page.getByRole("status", { name: "Örnek rapor yükleniyor…" })).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await checkPage(page);
    await page.screenshot({ path: testInfo.outputPath("report-loading.png"), fullPage: true });
  } finally { release(); }
  await expect(page.getByRole("heading", { level: 1 })).toContainText("büyük resmi.");
  await expect(page.getByRole("status", { name: "Örnek rapor yükleniyor…" })).toHaveCount(0);
});

test("bozuk belge açık onay ister, taslak korunur, geçerli belgeyle sonuç ve hedef araması çalışır", async ({ page }, testInfo) => {
  await page.goto("/app/new-analysis");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`partial-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await page.getByLabel("İşletme adı", { exact: true }).fill("Sentetik İşletme");
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("Kaynak kontrolü");
  await page.getByLabel("Analiz hedefi", { exact: true }).fill("Faaliyet içindeki öncelikleri belirle");
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles([{ name: "faaliyet.txt", mimeType: "text/plain", buffer: Buffer.from("Sentetik faaliyet belgesi") }, { name: "bozuk.pdf", mimeType: "application/pdf", buffer: Buffer.from("PDF olmayan örnek içerik") }]);
  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgeleri gözden geçirin" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Onay bekliyor", { exact: true })).toBeVisible();
  await checkPage(page);
  await page.screenshot({ path: testInfo.outputPath("partial-review.png"), fullPage: true });
  await page.getByRole("link", { name: "Dosyaları düzenle", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await expect(page.getByRole("textbox", { name: "Analiz hedefi", exact: true })).toHaveValue("Faaliyet içindeki öncelikleri belirle");
  await expect(page.getByText("bozuk.pdf", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Son işlemi aç", exact: true }).click();
  await page.getByRole("button", { name: "Yalnız 1 belgeyle devam et", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgelerin içeriği ayrıştırıldı" })).toBeVisible();
  await page.getByText("Kapsam dışında kalan 1 belge", { exact: true }).click();
  await expect(page.getByText("bozuk.pdf", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Yeni analiz oluştur", exact: true }).click();
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toHaveValue("");
  const navigation = page.getByRole("navigation", { name: (page.viewportSize()?.width ?? 0) >= 1024 ? "Ana navigasyon" : "Mobil navigasyon" });
  await navigation.getByRole("link", { name: "Geçmiş", exact: true }).click();
  await page.getByRole("searchbox", { name: "Arşivde ara", exact: true }).fill("faaliyet icindeki");
  await expect(page.getByRole("link").filter({ hasText: "Kaynak kontrolü" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Tarihe göre filtrele", exact: true })).not.toBeVisible();
  await page.getByText("Filtreler", { exact: true }).click();
  await page.getByRole("combobox", { name: "Tarihe göre filtrele", exact: true }).selectOption("7d");
  await expect(page).toHaveURL(/period=7d/);
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Arşivde ara" })).toHaveValue("faaliyet icindeki");
  await expect(page.getByRole("combobox", { name: "Tarihe göre filtrele", exact: true })).toHaveValue("7d");
  await checkPage(page);
});
