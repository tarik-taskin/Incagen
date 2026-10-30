import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { chooseLanguage, setTheme } from "./ui-helpers";
import sharp from "sharp";

for (const style of ["classic", "glass"] as const) {
  for (const mode of ["light", "dark"] as const) {
    test(`marka paneli ve giriş/kayıt penceresi okunabilir (${style}, ${mode})`, async ({ page }) => {
      await page.goto("/");
      await setTheme(page, { mode, style });
      await expect(page.locator("#landing-title")).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
      await page.getByRole("button", { name: "Analize başla", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
      await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Hesap oluştur", exact: true })).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole("button", { name: "Giriş penceresini kapat", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
  }
}

test("tema menüsü dört mod/görünüm kombinasyonunda erişilebilir ve seçim kalıcıdır", async ({ page }, testInfo) => {
  await page.goto("/ornek-rapor");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const classic = new Map<string, Uint8Array>();
  for (const style of ["classic", "glass"] as const) {
    for (const mode of ["light", "dark"] as const) {
      await setTheme(page, { mode, style });
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const themeColor = await page.locator('meta[name="theme-color"]').getAttribute("content");
      expect(themeColor).toMatch(/^hsl\(/);
      const screenshot = await page.screenshot({ path: testInfo.outputPath(`report-${style}-${mode}.png`) });
      if (style === "classic") classic.set(mode, screenshot);
      else {
        // Gerçek çizimde fark arar; yalnız data-style niteliğinin değişmesi bu kabul için yeterli değildir.
        const original = await sharp(classic.get(mode)!).resize({ width: 240 }).removeAlpha().raw().toBuffer();
        const glass = await sharp(screenshot).resize({ width: 240 }).removeAlpha().raw().toBuffer();
        let changed = 0;
        for (let i = 0; i < original.length; i += 3) {
          if (Math.abs(original[i] - glass[i]) + Math.abs(original[i + 1] - glass[i + 1]) + Math.abs(original[i + 2] - glass[i + 2]) > 30) changed++;
        }
        expect(changed / (original.length / 3), `${mode}: Glass görünür bir yüzey farkı oluşturmalı`).toBeGreaterThan(0.12);
      }
    }
  }
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
  await expect(page.locator("html")).toHaveAttribute("data-style", "glass");
  expect(await page.evaluate(() => [localStorage.getItem("incagen-theme"), localStorage.getItem("incagen-style")])).toEqual(["dark", "glass"]);
});

test("tema ve dil menüleri klavyeyle kullanılır; Arapçada liste sağdan hizalanır", async ({ page }) => {
  await page.goto("/");
  const themeMenu = page.getByTestId("theme-menu");
  await expect(themeMenu).toBeEnabled();
  await themeMenu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: "Sistem" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(themeMenu).toBeFocused();

  await chooseLanguage(page, "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const trigger = page.getByTestId("language-select");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  // Açılış animasyonu ölçeklendiği için konum oturana kadar yeniden ölçülür.
  await expect.poll(async () => {
    const [triggerBox, listBox] = [await trigger.boundingBox(), await listbox.boundingBox()];
    return triggerBox && listBox ? Math.abs(triggerBox.x - listBox.x) : Number.POSITIVE_INFINITY;
  }).toBeLessThanOrEqual(2);
  await page.keyboard.press("Escape");
  await expect(listbox).toHaveCount(0);
  await chooseLanguage(page, "tr");
});
