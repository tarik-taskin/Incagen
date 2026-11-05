import { getLocale, localeTag, t } from "../../i18n/runtime";

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
