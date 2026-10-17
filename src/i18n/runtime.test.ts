import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import tr from "./locales/tr.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import zh from "./locales/zh.json";
import ar from "./locales/ar.json";
import { getLocale, languages, localeTag, setLocale, t } from "./runtime";
import { reportNumber } from "../features/reports/report-format";

afterEach(() => setLocale("tr"));
describe("merkezi dil kaynakları", () => {
  it("altı dilin anahtarları, yer tutucuları ve boş olmayan metinleri eşleşir", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{\d+\}/g)].map(item => item[0]).sort();
    for (const catalog of [en, de, es, zh, ar]) {
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(tr).sort());
      for (const [key, value] of Object.entries(catalog)) { expect(value.trim().length, key).toBeGreaterThan(0); expect(placeholders(value), key).toEqual(placeholders(key)); }
    }
  });
  it("statik arayüz çeviri çağrılarında eksik metin kaynağı bırakmaz", () => {
    const missing = new Set<string>();
    // TS AST kullanır; yorumlar, import yolları ve kullanıcı içeriği çeviri anahtarı sayılmaz.
    function scan(dir: string) {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name);
        if (item.isDirectory() && item.name !== "locales") scan(file);
        else if (/\.tsx?$/.test(file) && !file.includes(".test.")) {
          const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
          function visit(node: ts.Node) { if (ts.isCallExpression(node) && node.expression.getText(source) === "t" && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && !Object.prototype.hasOwnProperty.call(tr, node.arguments[0].text)) missing.add(node.arguments[0].text); ts.forEachChild(node, visit); }
          visit(source);
        }
      }
    }
    scan(path.resolve("src")); expect([...missing]).toEqual([]);
  });
  it("dil adlarını da seçili dilde gösterir; tercihi ve RTL yönünü korur", () => {
    setLocale("zh"); expect(languages.map(item => t(item.name))).toEqual(["土耳其语", "英语", "德语", "西班牙语", "简体中文", "阿拉伯语"]);
    setLocale("ar"); expect(document.documentElement.dir).toBe("rtl"); expect(document.documentElement.lang).toBe("ar"); expect(localeTag()).toBe("ar-SA"); expect(localStorage.getItem("incagen-language")).toBe("ar");
    setLocale("de"); expect(document.documentElement.dir).toBe("ltr"); expect(getLocale()).toBe("de");
  });
  it("yer tutucuları sıralar, mevcut hataları yerelleştirir ve bilinmeyen içeriği aynen korur", () => {
    setLocale("en"); expect(t("{0} ile {1}", "Google", "Sign in")).toBe("Sign in with Google");
    expect(t("Free planda bir analiz için en fazla 5 dosya seçebilirsiniz.")).toBe("Free allows up to 5 files per analysis.");
    expect(t("<script>alert('x')</script>")).toBe("<script>alert('x')</script>"); expect(t(12)).toBe(12); expect(t("{0} dosya", 1)).toBe("1 file"); expect(t("{0} dosya", 2)).toBe("2 files");
    expect(reportNumber(null, "%")).toBe("—"); expect(reportNumber(0, "%")).toBe("0%"); expect(reportNumber(1250)).toBe("1,250.00 TRY");
    expect(reportNumber(1, "yorum")).toBe("1 comment");
    setLocale("ar"); expect(reportNumber(2, "yorum")).toBe("تعليقان");
    setLocale("de"); expect(reportNumber(1250)).toBe("1.250,00 TRY");
  });
});
