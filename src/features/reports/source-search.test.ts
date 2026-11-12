import { expect, it } from "vitest";
import { createSourceSearch } from "./source-search";

it("uses the chosen language for dotted and dotless I rather than forcing Turkish casing", () => {
  expect(createSourceSearch("invoice", "en-US").includes("INVOICE")).toBe(true);
  expect(createSourceSearch("i", "tr-TR").includes("I")).toBe(false);
  expect(createSourceSearch("ı", "tr-TR").includes("I")).toBe(true);
  expect(createSourceSearch("i", "tr-TR").includes("İ")).toBe(true);
});
it("maps expanded casing back to the original text without shifting a later match", () => {
  const text = "İ X INVOICE";
  expect(createSourceSearch("x", "en-US").ranges(text)).toEqual([{ start: 2, end: 3 }]);
  const search = createSourceSearch("invoice", "en-US");
  expect(search.ranges(text).map(range => text.slice(range.start, range.end))).toEqual(["INVOICE"]);
  expect(createSourceSearch("i", "en-US").ranges("İ")).toEqual([{ start: 0, end: 1 }]);
});
it("matches canonically equivalent accents but retains the original decomposed spelling in highlights", () => {
  const text = "Cafe\u0301, CAFÉ";
  const search = createSourceSearch("café", "fr-FR");
  expect(search.includes(text)).toBe(true);
  expect(search.ranges(text).map(range => text.slice(range.start, range.end))).toEqual(["Cafe\u0301", "CAFÉ"]);
});
it("keeps emoji, RTL and non-Latin source text intact and treats query syntax literally", () => {
  for (const [locale, text, query, expected] of [["ar-SA", "📄 تقرير التحليل", "التحليل", "التحليل"], ["zh-CN", "📄 分析结果", "结果", "结果"], ["de-DE", "📄 GRÖẞE", "größe", "GRÖẞE"], ["es-ES", "📄 INFORMACIÓN", "información", "INFORMACIÓN"]]) {
    const search = createSourceSearch(query, locale);
    expect(search.includes(text)).toBe(true);
    expect(search.ranges(text).map(range => text.slice(range.start, range.end)).join("")).toBe(expected);
  }
  expect(createSourceSearch("[a]+", "en-US").ranges("<script>[a]+</script>")).toEqual([{ start: 8, end: 12 }]);
  expect(createSourceSearch(" ", "en-US").ranges("unchanged")).toEqual([]);
});
it("keeps search working but leaves text unmarked when grapheme segmentation is unavailable", () => {
  const original = Object.getOwnPropertyDescriptor(Intl, "Segmenter")!;
  try {
    Object.defineProperty(Intl, "Segmenter", { configurable: true, value: undefined });
    const search = createSourceSearch("café", "en-US");
    expect(search.includes("Cafe\u0301")).toBe(true);
    expect(search.ranges("Cafe\u0301")).toEqual([]);
    expect(createSourceSearch("가", "zh-CN").includes("가")).toBe(true);
    expect(createSourceSearch("가", "zh-CN").ranges("가")).toEqual([]);
  } finally { Object.defineProperty(Intl, "Segmenter", original); }
});

it("keeps a canonically composed Hangul match on its complete original grapheme", () => {
  expect(createSourceSearch("가", "zh-CN").ranges("가")).toEqual([{ start: 0, end: 2 }]);
});
