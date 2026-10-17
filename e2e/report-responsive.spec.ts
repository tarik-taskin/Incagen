import { expect, test } from "@playwright/test";
import en from "../src/i18n/locales/en.json" with { type: "json" };
import de from "../src/i18n/locales/de.json" with { type: "json" };
import es from "../src/i18n/locales/es.json" with { type: "json" };
import zh from "../src/i18n/locales/zh.json" with { type: "json" };
import ar from "../src/i18n/locales/ar.json" with { type: "json" };
import tr from "../src/i18n/locales/tr.json" with { type: "json" };

// Kırpılan tablo ve dekorları ayırır; sayfa taşarsa görünür sorumlu öğeleri hata mesajına ekler.
function pageGeometry() {
  const viewport = document.documentElement.clientWidth;
  const overflowing = [...document.querySelectorAll("body *")].filter(element => {
    if (!element.checkVisibility()) return false;
    const bounds = element.getBoundingClientRect();
    if (bounds.left >= -0.5 && bounds.right <= viewport + 0.5) return false;
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const parentBounds = parent.getBoundingClientRect();
      if (getComputedStyle(parent).overflowX !== "visible" && parentBounds.left >= -0.5 && parentBounds.right <= viewport + 0.5) return false;
    }
    return true;
  }).slice(0, 10).map(element => ({ tag: element.tagName, class: element.getAttribute("class"), text: element.textContent?.slice(0, 100) }));
  return { width: document.documentElement.scrollWidth, overflowing };
}

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
        const geometry = await page.evaluate(pageGeometry);
        expect(geometry.width, JSON.stringify({ code, width, font, overflowing: geometry.overflowing })).toBeLessThanOrEqual(width);
        await page.getByRole("link", { name: catalog["Müşteri deneyimi"], exact: true }).click();
        await expect(page.getByRole("heading", { level: 1 })).toContainText(catalog["net önceliklere."]);
        const feedback = await page.evaluate(pageGeometry);
        expect(feedback.width, JSON.stringify({ code, width, font, report: "feedback", overflowing: feedback.overflowing })).toBeLessThanOrEqual(width);
      }
    }
  });
}
