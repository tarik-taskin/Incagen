import { expect, type Locator, type Page } from "@playwright/test";

type Scope = Page | Locator;
type ThemeMode = "light" | "dark" | "system";
type ThemeStyle = "classic" | "glass";

// İlk veri serisinin gerçek SVG yollarını merkezi tema rengiyle seçer; yalnız SVG kabuğunun varlığı yeterli değildir.
export async function chartSeriesPaths(page: Page, id: string, filled = false) {
  const color = await page.evaluate(() => {
    const token = getComputedStyle(document.documentElement).getPropertyValue("--chart-1").trim();
    return `hsl(${token.split(/\s+/).join(", ")})`;
  });
  return page.getByTestId(`chart-${id}`).locator(filled ? `path[fill='${color}']` : `path[fill='${color}'], path[stroke='${color}']`);
}

// Locator verildiyse sahibi olan sayfayı, sayfa verildiyse kendisini döndürür.
function pageOf(scope: Scope): Page {
  return "keyboard" in scope ? scope : scope.page();
}

// Dil seçimini tema uyumlu listeden, görünen dil adından bağımsız olarak dil koduyla yapar.
export async function chooseLanguage(scope: Scope, code: string) {
  const page = pageOf(scope);
  await scope.getByTestId("language-select").first().click();
  await page.locator(`[role="option"][data-locale="${code}"]`).click();
  await expect(page.locator("html")).toHaveAttribute("lang", code);
  await expect(page.locator("[data-radix-popper-content-wrapper]")).toHaveCount(0);
}

// Dil listesindeki seçenek adlarını sırasıyla okur ve listeyi klavyeyle kapatır.
export async function languageOptionNames(page: Page) {
  await page.getByTestId("language-select").first().click();
  const names = await page.getByRole("option").allTextContents();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  return names;
}

// Tema menüsünden renk modunu ve/veya yüzey görünümünü seçer; sonucu html sınıfı ve niteliğinden doğrular.
export async function setTheme(page: Page, { mode, style }: { mode?: ThemeMode; style?: ThemeStyle }) {
  for (const option of [mode && `mode-${mode}`, style && `style-${style}`]) {
    if (!option) continue;
    await page.getByTestId("theme-menu").first().click();
    await page.locator(`[role="menuitemradio"][data-theme-option="${option}"]`).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  }
  const html = page.locator("html");
  if (mode === "dark") await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
  if (mode === "light") await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
  if (style === "glass") await expect(html).toHaveAttribute("data-style", "glass");
  if (style === "classic") await expect(html).not.toHaveAttribute("data-style", "glass");
}
