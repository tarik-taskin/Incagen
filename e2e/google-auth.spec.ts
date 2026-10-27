import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Görünür responsive navigasyonu mevcut tarayıcı genişliğine göre seçer.
function getAppNavigation(page: Page) {
  const navigationName = (page.viewportSize()?.width ?? 1280) >= 1024 ? "Ana navigasyon" : "Mobil navigasyon";
  return page.getByRole("navigation", { name: navigationName });
}

// Auth emülatörünün sahte Google penceresinde yeni sentetik hesap oluşturur.
async function addEmulatorGoogleAccount(popup: Page, email: string) {
  await popup.getByRole("button", { name: /add new account/i }).click();
  await popup.getByLabel(/^email/i).fill(email);
  await popup.getByLabel(/display name/i).fill("Sentetik Google");
  await popup.getByRole("button", { name: /sign in with google/i }).click();
}

// Google düğmesine basar ve açılan emülatör penceresinde verilen işlemi yürütür.
async function continueWithGoogle(page: Page, trigger: () => Promise<void>, choose: (popup: Page) => Promise<void>) {
  const popupOpened = page.waitForEvent("popup");
  await trigger();
  const popup = await popupOpened;
  await popup.waitForLoadState();
  await choose(popup);
}

test("Google ile ilk giriş hesap açar, yeniden girişte aynı hesaba döner ve Google doğrulamasıyla silinir", async ({ page }) => {
  const email = `google-${crypto.randomUUID()}@example.test`;

  await page.goto("/app/new-analysis");
  await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
  await continueWithGoogle(page, () => page.getByRole("button", { name: "Google ile giriş yap" }).click(), popup => addEmulatorGoogleAccount(popup, email));
  await expect(page.getByRole("status")).toContainText("Çalışma alanınıza geçiş yapılıyor");
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();

  await getAppNavigation(page).getByRole("link", { name: "Ayarlar" }).click();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: /^Google$/ })).toBeVisible();
  await expect(page.getByText(/Bu hesap Google ile giriş yapıyor/)).toBeVisible();
  await expect(page.getByRole("button", { name: "E-postaya bağlantı gönder" })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Analize başla" }).click();
  await expect(page.getByRole("dialog", { name: "Giriş yap" })).toBeVisible();
  await continueWithGoogle(page, () => page.getByRole("button", { name: "Google ile giriş yap" }).click(), popup => popup.getByText(email).click());
  await expect(page.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeVisible();

  await getAppNavigation(page).getByRole("link", { name: "Ayarlar" }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole("button", { name: "Hesabı sil", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Hesabınızı kalıcı olarak silin" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Mevcut parola")).toHaveCount(0);
  await dialog.getByLabel(/Onaylamak için/).fill("HESABIMI SİL");
  await continueWithGoogle(page, () => dialog.getByRole("button", { name: "Hesabı kalıcı olarak sil" }).click(), popup => popup.getByText(email).click());
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeVisible();
});
