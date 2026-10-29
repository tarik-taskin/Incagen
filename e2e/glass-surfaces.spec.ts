import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { setTheme } from "./ui-helpers";

// Saydam arka planın gerçek kullanım ekranlarında metin ve kontrolleri okunmaz yapmadığını sınar.
async function expectReadable(page: Page) {
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

test("landing, giriş ve yardım dört görünümde okunur; azaltılmış saydamlık cam efektini kapatır", async ({ page }, testInfo) => {
  await page.goto("/");
  for (const style of ["classic", "glass"] as const) {
    for (const mode of ["light", "dark"] as const) {
      await setTheme(page, { mode, style });
      await expectReadable(page);
      await page.screenshot({ path: testInfo.outputPath(`landing-${style}-${mode}.png`) });
      await page.getByRole("button", { name: "Analize başla", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Giriş yap", exact: true })).toBeVisible();
      await expectReadable(page);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Destek ve yardım", exact: true }).click();
      const help = page.getByRole("dialog", { name: "Destek ve yardım", exact: true });
      const question = help.locator("details").filter({ hasText: "Kaynakları ve okuma uyarılarını nerede bulurum?" });
      if (await question.getAttribute("open") === null) await question.locator("summary").click();
      await expect(question).toHaveAttribute("open");
      await expectReadable(page);
      await page.screenshot({ path: testInfo.outputPath(`help-${style}-${mode}.png`) });
      await page.keyboard.press("Escape");
    }
  }
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }, { name: "prefers-reduced-motion", value: "reduce" }] });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches)).toBe(true);
    const fallback = await page.evaluate(() => ({
      backdrop: getComputedStyle(document.querySelector(".surface")!).backdropFilter,
      background: getComputedStyle(document.body, "::before").display,
      alpha: getComputedStyle(document.documentElement).getPropertyValue("--glass-alpha").trim(),
    }));
    expect(fallback).toEqual({ backdrop: "none", background: "none", alpha: "1" });
    await expectReadable(page);
  } finally {
    await session.send("Emulation.setEmulatedMedia", { features: [] });
    await session.detach();
  }
});
