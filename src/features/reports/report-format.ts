// Finansal değerleri tabloda tam, kartlarda kısa ve bütün görünümlerde Türkçe biçimlendirir.
export function reportNumber(value: number | null, unit = "TRY", compact = false) {
  if (value === null) return "—";
  const magnitude = compact && Math.abs(value) >= 1_000_000 ? 1_000_000 : compact && Math.abs(value) >= 10_000 ? 1000 : 1;
  const suffix = magnitude === 1_000_000 ? " mn" : magnitude === 1000 ? " bin" : "";
  const number = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: !compact && unit === "TRY" ? 2 : 0, maximumFractionDigits: compact ? 1 : unit === "TRY" || unit === "%" ? 2 : 0 }).format(value / magnitude);
  return unit === "%" ? `%${number}` : `${number}${suffix}${unit === "TRY" ? " TL" : unit ? " " + unit : ""}`;
}

