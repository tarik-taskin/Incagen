import { getLocale, localeTag, t } from "../../i18n/runtime";

// İki ondalıklı metni sayı dönüşümü yapmadan karşılaştırır; işaret ve kuruş kaybını yakalar.
function moneyText(text: string) {
  const [integer, fraction = ""] = text.replace(/^[+-]/, "").split(".");
  return `${text.startsWith("-") ? "-" : ""}${integer.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(2, "0")}`;
}

// Yalnız kesin ve güvenle temsil edilen örnek para hücrelerini biçimler; boşu sıfıra, metni sayıya zorlamaz.
export function sourceCell(value: string | number | boolean | null, column: string, localize: boolean) {
  if (value === null || typeof value === "string" && !value.trim()) return "—";
  if (!localize || !column.endsWith("_try")) return String(value);
  const numeric = typeof value === "number" ? value : typeof value === "string" && /^[+-]?\d+(?:\.\d{1,2})?$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || Math.abs(numeric) > Number.MAX_SAFE_INTEGER / 100 || Number(numeric.toFixed(2)) !== numeric) return String(value);
  if (typeof value === "string" && moneyText(value) !== moneyText(String(numeric))) return value;
  return new Intl.NumberFormat(localeTag(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
}

// Eski kayıtta ölçüm yoksa süre uydurmaz; mevcut sıfır ve alt-saniye ölçümleri seçili dilde kalır.
export function reportDuration(milliseconds: number | undefined) {
  if (milliseconds === undefined || !Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  return t("{0} saniye", Number((milliseconds / 1000).toFixed(1)));
}

// Kaynak birimini ve altı haneye kadar doğrulanmış hassasiyeti korur; yalnız büyük örnek değerleri kısaltır.
export function reportNumber(value: number | null, unit = "TRY", compact = false) {
  if (value === null) return "—";
  const locale = getLocale(), currency = ["TRY", "USD", "EUR"].includes(unit);
  const percent = unit === "%" || unit === "percent";
  const count = unit === "count" || ["yorum", "sipariş"].includes(unit);
  const decimals = currency ? 2 : count ? 0 : 6;
  const shortened = compact && Math.abs(value) >= 10_000;
  const suffixUnit = unit === "number" ? "" : unit === "count" ? t("kayıt", value) : unit;
  if (locale !== "tr") {
    const number = new Intl.NumberFormat(localeTag(), { ...(shortened ? { notation: "compact", compactDisplay: "short" } : {}), minimumFractionDigits: !compact && currency ? 2 : 0, maximumFractionDigits: shortened ? 1 : decimals });
    if (percent) return new Intl.NumberFormat(localeTag(), { style: "percent", maximumFractionDigits: 6 }).format(value / 100);
    if (locale === "ar" && value === 2 && ["yorum", "sipariş", "count"].includes(unit)) return t(unit === "count" ? "kayıt" : unit, value);
    return `${number.format(value)}${suffixUnit ? " " + (currency ? unit : unit === "count" ? suffixUnit : t(suffixUnit, value)) : ""}`;
  }
  const magnitude = shortened && Math.abs(value) >= 1_000_000_000 ? 1_000_000_000 : shortened && Math.abs(value) >= 1_000_000 ? 1_000_000 : shortened ? 1000 : 1;
  const suffix = magnitude === 1_000_000_000 ? " mlr" : magnitude === 1_000_000 ? " mn" : magnitude === 1000 ? " bin" : "";
  const number = new Intl.NumberFormat(localeTag(), { minimumFractionDigits: !compact && currency ? 2 : 0, maximumFractionDigits: shortened ? 1 : decimals }).format(value / magnitude);
  return percent ? `%${number}` : `${number}${suffix}${unit === "TRY" ? " TL" : suffixUnit ? " " + suffixUnit : ""}`;
}
