import { expect, test } from "@playwright/test";
import en from "../src/i18n/locales/en.json" with { type: "json" };
import de from "../src/i18n/locales/de.json" with { type: "json" };
import es from "../src/i18n/locales/es.json" with { type: "json" };
import zh from "../src/i18n/locales/zh.json" with { type: "json" };
import ar from "../src/i18n/locales/ar.json" with { type: "json" };
import tr from "../src/i18n/locales/tr.json" with { type: "json" };

// İşletim sisteminin font ölçüleri değişse de uzun çevirilerin gerçek mobil genişliğe sığmasını doğrular.
for (const font of ["sans-serif", "monospace"]) {
  test(`rapor mobil çevirileri ${font} fontuyla taşmaz`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Dar ekran regresyonu.");
    for (const width of [320, 412]) {
      await page.setViewportSize({ width, height: 915 });
      for (const [code, catalog] of Object.entries({ tr, en, de, es, zh, ar })) {
        await page.goto("/ornek-rapor");
        await page.getByRole("combobox").selectOption(code);
        await page.addStyleTag({ content: `:root { font-family: ${font}; }` });
        if (code === "es" && width === 412 && font === "sans-serif") await page.screenshot({ path: testInfo.outputPath("spanish-mobile-header.png") });
        await page.getByRole("link", { name: catalog["Kaynaklar"], exact: true }).click();
        await expect(page.locator("#source-details")).toHaveAttribute("open");
        const geometry = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          overflowing: [...document.querySelectorAll("body *")].filter(el => { if (!el.checkVisibility()) return false; const right = el.getBoundingClientRect().right; if (right <= document.documentElement.clientWidth + 0.5) return false; for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) { if (getComputedStyle(parent).overflowX !== "visible" && parent.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5) return false; } return true; }).slice(0, 10).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 100) })),
        }));
        expect(geometry.width, JSON.stringify({ code, width, font, overflowing: geometry.overflowing })).toBeLessThanOrEqual(width);
      }
    }
  });
}
