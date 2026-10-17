import { useSyncExternalStore } from "react";
import trLocale from "./locales/tr.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import zh from "./locales/zh.json";
import ar from "./locales/ar.json";

export const languages = [
  { code: "tr", name: "Türkçe", tag: "tr-TR" }, { code: "en", name: "English", tag: "en-US" },
  { code: "de", name: "Deutsch", tag: "de-DE" }, { code: "es", name: "Español", tag: "es-ES" },
  { code: "zh", name: "简体中文", tag: "zh-CN" }, { code: "ar", name: "العربية", tag: "ar-SA" },
] as const;
export type Locale = typeof languages[number]["code"];
const catalogs: Record<string, Record<string, string>> = { tr: trLocale, en, de, es, zh, ar };
const patterns = Object.keys(en).filter(key => /\{\d+\}/.test(key)).sort((a, b) => b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length).map(key => {
  const indices: string[] = [];
  const escaped = key.split(/(\{\d+\})/).map(part => {
    if (/^\{\d+\}$/.test(part)) { indices.push(part.slice(1, -1)); return "(.+?)"; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { key, indices, expression: new RegExp("^" + escaped + "$") };
});
const listeners = new Set<() => void>();
const storageKey = "incagen-language";
// Yalnız desteklenen dil kodlarını kabul eder; depolama erişimi kapalıysa Türkçe başlangıcı korur.
function initialLocale(): Locale { try { const saved = localStorage.getItem(storageKey); return languages.some(item => item.code === saved) ? saved as Locale : "tr"; } catch { return "tr"; } }
let locale = initialLocale();
export const getLocale = () => locale;
export const localeTag = () => languages.find(item => item.code === locale)!.tag;
// Rota, oturum ve taslakları yeniden oluşturmadan tüm abone görünümleri günceller; sekmeler arasında da çalışır.
export function setLocale(next: Locale) {
  if (!languages.some(item => item.code === next)) return;
  locale = next;
  try { localStorage.setItem(storageKey, next); } catch { /* Dil bellekte kullanılmaya devam eder. */ }
  if (typeof document !== "undefined") { document.documentElement.lang = next; document.documentElement.dir = next === "ar" ? "rtl" : "ltr"; document.title = "Incagen — " + t("Kaynaktan karara."); }
  listeners.forEach(listener => listener());
}
if (typeof window !== "undefined") {
  document.documentElement.lang = locale; document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"; document.title = "Incagen — " + t("Kaynaktan karara.");
  window.addEventListener("storage", event => { if (event.key === storageKey && languages.some(item => item.code === event.newValue)) setLocale(event.newValue as Locale); });
}
// Abonelik yalnız metin sunumunu yeniler; form ve kaynak verisini değiştirmez.
export function useLocale() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getLocale, () => "tr" as Locale); }
// Merkezi metindeki numaralı yer tutucular çeviride yeniden sıralanabilir; React metin kaçışını korur.
export function t<T>(value: T, ...values: unknown[]): T extends string ? string : T {
  if (typeof value !== "string") return value as T extends string ? string : T;
  const pluralKey = typeof values[0] === "number" ? value + "__" + new Intl.PluralRules(localeTag()).select(values[0]) : value;
  let translated = catalogs[locale]?.[pluralKey] ?? catalogs[locale]?.[value] ?? value;
  if (locale !== "tr" && !Object.prototype.hasOwnProperty.call(catalogs[locale], value) && values.length === 0) {
    for (const pattern of patterns) {
      const match = pattern.expression.exec(value);
      if (!match) continue;
      translated = catalogs[locale][pattern.key];
      const captured: unknown[] = [];
      pattern.indices.forEach((index, n) => { captured[Number(index)] = match[n + 1]; });
      values = captured;
      break;
    }
  }
  return translated.replace(/\{(\d+)\}/g, (match, index: string) => values[Number(index)] === undefined ? match : (typeof values[Number(index)] === "number" ? new Intl.NumberFormat(localeTag()).format(values[Number(index)] as number) : String(values[Number(index)]))) as T extends string ? string : T;
}
