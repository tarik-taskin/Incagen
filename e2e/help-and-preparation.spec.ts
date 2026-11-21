import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import tr from "../src/i18n/locales/tr.json" with { type: "json" };
import en from "../src/i18n/locales/en.json" with { type: "json" };
import de from "../src/i18n/locales/de.json" with { type: "json" };
import es from "../src/i18n/locales/es.json" with { type: "json" };
import zh from "../src/i18n/locales/zh.json" with { type: "json" };
import ar from "../src/i18n/locales/ar.json" with { type: "json" };
import { chooseLanguage, setTheme } from "./ui-helpers";

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
    await chooseLanguage(page, code);
    const trigger = page.getByRole("button", { name: catalog["Destek ve yardım"], exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: catalog["Destek ve yardım"], exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("details")).toHaveCount(5);
    await dialog.getByText(catalog["Çalışmalarımı ve kaynak belgelerimi nasıl yönetirim?"], { exact: true }).click();
    await expect(dialog.locator("details[open]")).toHaveCount(1);
    await dialog.getByText(catalog["Sonuçların dayanaklarını nasıl doğrularım?"], { exact: true }).click();
    await expect(dialog.locator("details[open]")).toHaveCount(1);
    await dialog.getByText(catalog["Analiz hedefini nasıl netleştirebilirim?"], { exact: true }).click();
    await expect(dialog.locator("details[open]")).toHaveCount(1);
    await expect(dialog.locator("details[open]")).toContainText(catalog["Yanıt aradığınız soruyu; dönem, karşılaştırma ve karar bağlamıyla belirtin. Örneğin “Son iki dönemde gelir ve maliyetler nasıl değişti, hangi hizmet alanları öne çıktı?” gibi bir hedef, incelemenin odağını belirler. Birbiriyle ilişkili belgeleri seçin ve tek bir ana soruya odaklanın; hedefiniz çalışmanızla birlikte saklanır."]);
    await checkPage(page);
    await dialog.getByText(catalog["Analiz hedefini nasıl netleştirebilirim?"], { exact: true }).click();
    await dialog.getByRole("button", { name: catalog["Bize yazın"], exact: true }).click();
    await dialog.getByRole("combobox", { name: catalog["Konu"], exact: true }).click();
    await expect(dialog.getByRole("option")).toHaveCount(5);
    await dialog.getByRole("option", { name: catalog["Veriler ve gizlilik"], exact: true }).click();
    await expect(dialog.getByRole("combobox", { name: catalog["Konu"], exact: true })).toHaveText(catalog["Veriler ve gizlilik"]);
    await dialog.getByRole("button", { name: catalog["Yardıma dön"], exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await chooseLanguage(page, "tr");
  await page.getByRole("button", { name: "Destek ve yardım", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Destek ve yardım", exact: true });
  await dialog.getByText("Örnek raporları nasıl değerlendirebilirim?", { exact: true }).click();
  await expect(dialog.locator("details[open]")).toHaveCount(1);
  await expect(dialog).not.toContainText("Müşteri yorumlarımı nasıl eklerim?");
  await expect(dialog).not.toContainText("kurgusal");
  await page.screenshot({ path: testInfo.outputPath("help-light.png") });
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
  await setTheme(page, { mode: "dark" });
  await page.getByRole("button", { name: "Destek ve yardım", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Destek ve yardım", exact: true });
  await checkPage(page);
  await page.screenshot({ path: testInfo.outputPath("help-dark.png") });
  await dialog.getByRole("button", { name: "Bize yazın", exact: true }).click();
  await dialog.getByLabel("E-posta", { exact: true }).fill("feedback@example.test");
  await dialog.getByRole("combobox", { name: "Konu", exact: true }).click();
  await dialog.getByRole("option", { name: "Bir önerim var", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Konu", exact: true })).toHaveText("Bir önerim var");
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
  await setTheme(page, { mode: "light" });
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
  await page.reload();
  await expect(page.getByRole("heading", { name: "Belgeleri gözden geçirin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dosyaları düzenle", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Belgeleri yeniden seç", exact: true })).toBeVisible();
  await expect(page.getByText(/Özgün yerel dosyalar bu tarayıcı oturumunda artık bulunmuyor/)).toBeVisible();
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
  await page.getByRole("combobox", { name: "Tarihe göre filtrele", exact: true }).click();
  await page.getByRole("option", { name: "Son 7 gün", exact: true }).click();
  await expect(page).toHaveURL(/period=7d/);
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Arşivde ara" })).toHaveValue("faaliyet icindeki");
  await expect(page.getByRole("combobox", { name: "Tarihe göre filtrele", exact: true })).toHaveText("Son 7 gün");
  await page.getByRole("link", { name: /Kaynak kontrolü/ }).click();
  await expect(page).toHaveURL(/q=faaliyet\+icindeki/);
  await expect(page).toHaveURL(/period=7d/);
  await page.getByRole("link", { name: "← Geçmiş analizler", exact: true }).click();
  await expect(page).toHaveURL(/q=faaliyet\+icindeki/);
  await expect(page).toHaveURL(/period=7d/);
  await expect(page.getByRole("searchbox", { name: "Arşivde ara" })).toHaveValue("faaliyet icindeki");
  await checkPage(page);
});

test("kısmi incelemeden sonra temizlenen taslakta yeni B çalışması A onayı ve B hatasından etkilenmez", async ({ page }, testInfo) => {
  await page.goto("/app/new-analysis");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`review-isolation-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);

  await page.getByLabel("İşletme adı", { exact: true }).fill("Sentetik İşletme");
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("A Çalışması");
  await page.getByLabel("Analiz hedefi", { exact: true }).fill("A hedefi");
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles([
    { name: "faaliyet.txt", mimeType: "text/plain", buffer: Buffer.from("A geçerli belge içeriği") },
    { name: "bozuk.pdf", mimeType: "application/pdf", buffer: Buffer.from("Geçersiz PDF") },
  ]);
  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgeleri gözden geçirin" })).toBeVisible({ timeout: 30000 });

  await page.getByRole("link", { name: "Dosyaları düzenle", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await page.getByRole("button", { name: "Tümünü temizle", exact: true }).click();
  await expect(page.getByText("bozuk.pdf", { exact: true })).toHaveCount(0);

  await page.getByLabel("Analiz başlığı", { exact: true }).fill("B Çalışması");
  await page.getByLabel("Analiz hedefi", { exact: true }).fill("B hedefi");
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles({
    name: "b-dosya.txt", mimeType: "text/plain", buffer: Buffer.from("B yeni çalışma belgesi"),
  });

  // B'nin createAnalysis isteğini beklet; ilk başarısız olduktan sonra yeniden denemede aynı requestId'yi doğrula.
  let bCalls = 0;
  const requestIds: string[] = [];
  let releaseBFail!: () => void;
  const bFailGate = new Promise<void>(resolve => { releaseBFail = resolve; });
  await page.route("**/createAnalysis", async route => {
    const body = route.request().postDataJSON() as { data?: { title?: string; requestId?: string } };
    if (body?.data?.title === "B Çalışması") {
      bCalls++;
      if (body.data.requestId) requestIds.push(body.data.requestId);
      if (bCalls === 1) {
        await bFailGate;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Unavailable", status: "UNAVAILABLE" } }) });
        return;
      }
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page.getByRole("region", { name: "Belge hazırlama durumu", exact: true })).toContainText("Çalışma oluşturuluyor");
  await page.getByRole("link", { name: "Son işlemi aç", exact: true }).click();

  // B oluşturulup temizlenmiş A ile ilgili artık hiçbir düzenleme bağı olmamalı.
  await expect(page.getByRole("heading", { name: "Belgeleri gözden geçirin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dosyaları düzenle", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Belgeleri yeniden seç", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Yalnız 1 belgeyle devam et", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgelerin içeriği ayrıştırıldı" })).toBeVisible({ timeout: 30000 });

  // A tamamlandıktan sonra Yeni Analiz'e dönüşte B hâlâ korunuyor olmalı; sonra B createAnalysis hata versin.
  const nav = page.getByRole("navigation", { name: testInfo.project.name === "mobile-chromium" ? "Mobil navigasyon" : "Ana navigasyon" });
  await nav.getByRole("link", { name: "Yeni analiz", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await expect(page.getByText("b-dosya.txt", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toHaveValue("B Çalışması");
  await expect(page.getByLabel("Analiz hedefi", { exact: true })).toHaveValue("B hedefi");

  releaseBFail();
  await expect(page.getByRole("alert")).not.toBeEmpty({ timeout: 15000 });
  await expect(page.getByText("b-dosya.txt", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toHaveValue("B Çalışması");
  await expect(page.getByLabel("Analiz hedefi", { exact: true })).toHaveValue("B hedefi");

  // Yeniden dene: B ilk isteğindeki requestId ile devam edip tamamlanır.
  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/analyses\//, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "B Çalışması" })).toBeVisible();
  expect(requestIds).toHaveLength(2);
  expect(requestIds[1]).toBe(requestIds[0]);
});

test("B başarısızlığından sonra aynı özgün dosyalar ve başlık yeniden seçildiğinde eski A onayı yeni taslağı silmez", async ({ page }, testInfo) => {
  const validPath = testInfo.outputPath("faaliyet.txt");
  const invalidPath = testInfo.outputPath("bozuk.pdf");
  writeFileSync(validPath, "A geçerli özgün faaliyet içeriği");
  writeFileSync(invalidPath, "PDF olmayan geçersiz içerik");

  await page.goto("/app/new-analysis");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`reselect-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);

  await page.getByLabel("İşletme adı", { exact: true }).fill("Sentetik İşletme");
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("A Özgün Başlık");
  await page.getByLabel("Analiz hedefi", { exact: true }).fill("A özgün hedefi");
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles([validPath, invalidPath]);
  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgeleri gözden geçirin" })).toBeVisible({ timeout: 30000 });

  // Dosyaları değiştirmeden B başlığıyla yeni hazırlık başlat ve B hazırlama çağrısını kontrollü başarısız yap.
  await page.getByRole("link", { name: "Dosyaları düzenle", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("B Başarısız İş");

  let failNextPrepare = true;
  await page.route("**/prepareAnalysis", async route => {
    if (failNextPrepare) {
      failNextPrepare = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Unavailable", status: "UNAVAILABLE" } }) });
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
  await expect(page.getByRole("alert")).not.toBeEmpty({ timeout: 20000 });

  // Tümünü temizle ve A ile birebir aynı başlık, hedef ve özgün disk dosyalarını yeniden seç.
  await page.getByRole("button", { name: "Tümünü temizle", exact: true }).click();
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("A Özgün Başlık");
  await page.getByLabel("Analiz hedefi", { exact: true }).fill("A özgün hedefi");
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles([validPath, invalidPath]);
  await expect(page.getByText("faaliyet.txt", { exact: true })).toBeVisible();
  await expect(page.getByText("bozuk.pdf", { exact: true })).toBeVisible();

  // Geçmişten eski A'yı aç ve hazır belgeyle devam et.
  const nav = page.getByRole("navigation", { name: testInfo.project.name === "mobile-chromium" ? "Mobil navigasyon" : "Ana navigasyon" });
  await nav.getByRole("link", { name: "Geçmiş", exact: true }).click();
  await page.getByRole("link", { name: /A Özgün Başlık/ }).click();
  await expect(page.getByRole("heading", { name: "Belgeleri gözden geçirin" })).toBeVisible();
  await page.getByRole("button", { name: "Yalnız 1 belgeyle devam et", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Belgelerin içeriği ayrıştırıldı" })).toBeVisible({ timeout: 30000 });

  // Yeni Analiz'e dönüldüğünde yeniden seçilen taslak korunmuş olmalı.
  await nav.getByRole("link", { name: "Yeni analiz", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);
  const selectedFiles = page.getByRole("list", { name: "Seçilen dosyalar" });
  await expect(selectedFiles.getByText("faaliyet.txt", { exact: true })).toBeVisible();
  await expect(selectedFiles.getByText("bozuk.pdf", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Analiz başlığı", { exact: true })).toHaveValue("A Özgün Başlık");
  await expect(page.getByLabel("Analiz hedefi", { exact: true })).toHaveValue("A özgün hedefi");
});

test("ready: false bekleme bildirimi Geçmiş ekranında kayıt emülatörde tamamlanınca otomatik hazır sonucuna geçer", async ({ page }, testInfo) => {
  await page.goto("/app/new-analysis");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(`live-watch-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123!");
  await page.getByLabel("Parola tekrarı", { exact: true }).fill("Synthetic123!");
  await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/new-analysis$/);

  await page.getByLabel("İşletme adı", { exact: true }).fill("Sentetik İşletme");
  await page.getByLabel("Analiz başlığı", { exact: true }).fill("Canlı Takip");
  await page.getByLabel("Analiz hedefi", { exact: true }).fill("Gerçek kayıt tamamlamasını izle");
  await page.getByLabel("Analiz edilecek dosyaları seç").setInputFiles({
    name: "takip.txt", mimeType: "text/plain", buffer: Buffer.from("Canlı takip belgesi metin içeriği."),
  });

  let capturedAuth = "";
  let capturedUid = "";
  let capturedAnalysisId = "";
  let intercepted = false;
  let releasePrepare!: () => void;
  const prepareGate = new Promise<void>(resolve => { releasePrepare = resolve; });
  let markPrepareSeen!: () => void;
  const prepareSeen = new Promise<void>(resolve => { markPrepareSeen = resolve; });
  await page.route("**/prepareAnalysis", async route => {
    if (!intercepted) {
      intercepted = true;
      capturedAuth = route.request().headers().authorization ?? "";
      const tokenPayload = JSON.parse(Buffer.from(capturedAuth.replace(/^Bearer\s+/i, "").split(".")[1], "base64url").toString("utf8")) as { user_id?: string };
      capturedUid = tokenPayload.user_id ?? "";
      capturedAnalysisId = (route.request().postDataJSON() as { data?: { id?: string } })?.data?.id ?? "";
      markPrepareSeen();
      await prepareGate;
      const docUrl = `http://127.0.0.1:8080/v1/projects/demo-incagen/databases/(default)/documents/users/${capturedUid}/analyses/${capturedAnalysisId}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`;
      const patch = await fetch(docUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
        body: JSON.stringify({ fields: { status: { stringValue: "processing" }, updatedAt: { integerValue: String(Date.now()) } } }),
      });
      expect(patch.ok).toBe(true);
    }
    await route.continue();
  });

  const prepareResponsePromise = page.waitForResponse("**/prepareAnalysis");
  try {
    await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
    await prepareSeen;

    // Hazırlama yanıtı dönmeden Geçmiş'e geç; sunucu { ready: false } yanıtını Geçmiş ekranındayken al.
    const nav = page.getByRole("navigation", { name: testInfo.project.name === "mobile-chromium" ? "Mobil navigasyon" : "Ana navigasyon" });
    await nav.getByRole("link", { name: "Geçmiş", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/history$/);

    releasePrepare();
    await prepareResponsePromise;
  } finally {
    releasePrepare();
  }

  const statusBanner = page.getByRole("region", { name: "Belge hazırlama durumu", exact: true });
  await expect(statusBanner.getByRole("link", { name: "İşlemi izle", exact: true })).toBeVisible({ timeout: 20000 });
  await expect(statusBanner.getByRole("button", { name: "Kapat", exact: true })).toBeVisible();
  const card = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /Canlı Takip/ }) });
  await expect(card).toContainText("Veriler hesaplanıyor");

  // Aynı kaydı arka planda gerçek Firebase Functions emülatöründe tamamla (lease süresini aşmış gibi updatedAt=1 yapıp prepareAnalysis çalıştır).
  const expireUrl = `http://127.0.0.1:8080/v1/projects/demo-incagen/databases/(default)/documents/users/${capturedUid}/analyses/${capturedAnalysisId}?updateMask.fieldPaths=updatedAt`;
  await fetch(expireUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ fields: { updatedAt: { integerValue: "1" } } }),
  });
  const fnResponse = await fetch("http://127.0.0.1:5001/demo-incagen/europe-west1/prepareAnalysis", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: capturedAuth },
    body: JSON.stringify({ data: { id: capturedAnalysisId } }),
  });
  expect(fnResponse.ok).toBe(true);

  await expect(card).toContainText("Analize hazır", { timeout: 20000 });
  await expect(statusBanner).toContainText("Belgeleriniz hazır", { timeout: 20000 });
  await expect(statusBanner.getByRole("link", { name: "Hazırlık özetini aç", exact: true })).toBeVisible();
  await expect(statusBanner.getByRole("link", { name: "İşlemi izle", exact: true })).toHaveCount(0);

  await statusBanner.getByRole("link", { name: "Hazırlık özetini aç", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/analyses/${capturedAnalysisId}$`), { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "Belgelerin içeriği ayrıştırıldı" })).toBeVisible();
});
