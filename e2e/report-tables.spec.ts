import { expect, test } from "@playwright/test";

test("finansal tablolar sütuna göre sıralanır, sırayı duyurur ve kaynak sırasına döner", async ({ page }) => {
  await page.goto("/ornek-rapor");
  await page.getByRole("link", { name: "Finansal detay", exact: true }).click();
  const table = page.getByRole("table", { name: "Kanal performansı", exact: true });
  await expect(table).toBeVisible();
  const header = table.getByRole("columnheader", { name: "Net satış", exact: true });
  const rowNames = () => table.locator("tbody th").allTextContents();
  const original = await rowNames();
  await expect(header).toHaveAttribute("aria-sort", "none");

  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  const ascending = await rowNames();
  await header.getByRole("button").press("Enter");
  await expect(header).toHaveAttribute("aria-sort", "descending");
  expect(await rowNames()).toEqual([...ascending].reverse());
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "none");
  expect(await rowNames()).toEqual(original);

  const monthly = page.getByRole("table", { name: /Aylık performans/ });
  const margin = monthly.getByRole("columnheader", { name: "Brüt marj", exact: true });
  await margin.getByRole("button").click();
  await expect(margin).toHaveAttribute("aria-sort", "ascending");
  await expect(monthly.getByRole("rowheader", { name: /Dönem toplamı/ })).toBeVisible();
});
