import { getLocale, localeTag, t } from "../../i18n/runtime";
// Değeri seçili dilde sunar; kaynak para birimi değişmez, Türkçe gösterim geriye uyumludur.
export function reportNumber(value: number | null, unit = "TRY", compact = false) {
  if (value === null) return "—";
  const locale = getLocale();
  if (locale !== "tr") {
    const number = new Intl.NumberFormat(localeTag(), { ...(compact ? { notation: "compact", compactDisplay: "short" } : {}), minimumFractionDigits: !compact && unit === "TRY" ? 2 : 0, maximumFractionDigits: compact ? 1 : unit === "TRY" || unit === "%" ? 2 : 0 });
    if (unit === "%") return new Intl.NumberFormat(localeTag(), { style: "percent", maximumFractionDigits: 2 }).format(value / 100);
    if (locale === "ar" && value === 2 && ["yorum", "sipariş"].includes(unit)) return t(unit, value);
    return `${number.format(value)}${unit ? " " + (unit === "TRY" ? "TRY" : t(unit, value)) : ""}`;
  }
  const magnitude = compact && Math.abs(value) >= 1_000_000_000 ? 1_000_000_000 : compact && Math.abs(value) >= 1_000_000 ? 1_000_000 : compact && Math.abs(value) >= 10_000 ? 1000 : 1;
  const suffix = magnitude === 1_000_000_000 ? " mlr" : magnitude === 1_000_000 ? " mn" : magnitude === 1000 ? " bin" : "";
  const number = new Intl.NumberFormat(localeTag(), { minimumFractionDigits: !compact && unit === "TRY" ? 2 : 0, maximumFractionDigits: compact ? 1 : unit === "TRY" || unit === "%" ? 2 : 0 }).format(value / magnitude);
  return unit === "%" ? `%${number}` : `${number}${suffix}${unit === "TRY" ? " TL" : unit ? " " + unit : ""}`;
}
