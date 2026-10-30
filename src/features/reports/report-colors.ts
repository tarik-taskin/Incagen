// ECharts'in renk ayrıştırıcısı için tema tokenını virgüllü HSL biçimine çevirir; SSR/testte güvenli renk döndürür.
export function reportTone(token: string, fallback: string) {
  const value = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  return value ? `hsl(${value.split(/\s+/).join(", ")})` : fallback;
}

// Grafik ve açıklama işaretleri aynı merkezi seri tokenlarını kullanır; iş verisi ve seri sırası değişmez.
export function reportColors(theme: "light" | "dark") {
  const fallback = theme === "dark" ? ["#85b4ff", "#f890ca", "#7ccfcf", "#9aaacb"] : ["#0c43bb", "#ca2f87", "#248489", "#6382b6"];
  return fallback.map((color, index) => reportTone(`chart-${index + 1}`, color));
}
