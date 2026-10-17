// Grafik ve açıklama işaretlerinde aynı seri sırasını ve iki temanın aynı renklerini korur.
export function reportColors(theme: "light" | "dark") {
  return theme === "dark" ? ["#bba6f5", "#80d5d5", "#edb68c", "#96b8ee"] : ["#7351b5", "#328c91", "#bd7d50", "#608cc7"];
}
