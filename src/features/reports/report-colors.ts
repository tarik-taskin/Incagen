// Grafik ve açıklama işaretlerinde aynı seri sırasını korur; renkler tema tokenlarından gelir, açık/koyu ve glass otomatik uyar.
export const reportPalette = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export function reportColors() {
  return reportPalette;
}
