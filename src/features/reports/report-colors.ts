// ECharts'in renk ayrıştırıcısı için tema tokenını virgüllü HSL biçimine çevirir; SSR/testte güvenli renk döndürür.
export function reportTone(token: string, fallback: string) {
  const value = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  return value ? `hsl(${value.split(/\s+/).join(", ")})` : fallback;
}

// Grafik ve açıklama işaretleri aynı merkezi seri tokenlarını kullanır; iş verisi ve seri sırası değişmez.
export function reportColors(theme: "light" | "dark") {
  const fallback = theme === "dark" ? ["#40bcf7", "#fb9d70", "#76cbbf", "#a3b5c7"] : ["#0683b2", "#e94f1e", "#208477", "#617a98"];
  return fallback.map((color, index) => reportTone(`chart-${index + 1}`, color));
}
