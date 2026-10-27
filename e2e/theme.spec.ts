import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { chooseLanguage, setTheme } from "./ui-helpers";

test("tema menüsü dört mod/görünüm kombinasyonunda erişilebilir ve seçim kalıcıdır", async ({ page }, testInfo) => {
  await page.goto("/ornek-rapor");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const style of ["classic", "glass"] as const) {
    for (const mode of ["light", "dark"] as const) {
      await setTheme(page, { mode, style });
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const themeColor = await page.locator('meta[name="theme-color"]').getAttribute("content");
      expect(themeColor).toMatch(/^hsl\(/);
      await page.screenshot({ path: testInfo.outputPath(`report-${style}-${mode}.png`) });
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
  const [triggerBox, listBox] = [await trigger.boundingBox(), await listbox.boundingBox()];
  expect(triggerBox && listBox && Math.abs(triggerBox.x - listBox.x) <= 2).toBe(true);
  await page.keyboard.press("Escape");
  await expect(listbox).toHaveCount(0);
  await chooseLanguage(page, "tr");
});
