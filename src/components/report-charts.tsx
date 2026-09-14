import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import type { Report } from "../../functions/src/contracts";

// Rapor grafiklerini metin/tablo karşılıklarıyla sunar; renk tek bilgi taşıyıcısı değildir.
export function ReportCharts({ report, currency }: { report: Report; currency: string }) {
  const daily = report.daily.map(d => ({ ...d, amount: d.cents / 100 }));
  const categories = report.categories.map(d => ({ ...d, amount: d.cents / 100 }));
  return <div className="mt-6 grid gap-6 xl:grid-cols-2">
    <section className="min-w-0 rounded-3xl border border-border bg-card p-5" aria-labelledby="daily-title">
      <h2 id="daily-title" className="font-semibold">Günlük satış ({currency})</h2>
      <div className="mt-5 h-64" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><LineChart accessibilityLayer={false} data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis tick={{ fill: "hsl(var(--muted-foreground))" }} dataKey="date" minTickGap={40} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} width={65} /><Tooltip cursor={false} contentStyle={{ background: "hsl(var(--card))", color: "hsl(var(--foreground))", borderColor: "hsl(var(--border))" }} /><Line dataKey="amount" name="Satış" stroke="hsl(var(--chart-accent))" strokeWidth={3} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
      <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Günlük değerleri tablo olarak göster</summary><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left"><caption className="sr-only">Günlük satış tablosu</caption><thead><tr><th>Tarih</th><th>Tutar ({currency})</th></tr></thead><tbody>{daily.map(d => <tr key={d.date}><td className="py-1">{d.date}</td><td>{d.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table></div></details>
    </section>
    {categories.length > 0 && <section className="min-w-0 rounded-3xl border border-border bg-card p-5" aria-labelledby="categories-title">
      <h2 id="categories-title" className="font-semibold">Kategori dağılımı ({currency})</h2>
      <div className="mt-5 h-64" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart accessibilityLayer={false} data={categories}><CartesianGrid strokeDasharray="3 3" /><XAxis tick={{ fill: "hsl(var(--muted-foreground))" }} dataKey="category" /><YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} width={65} /><Tooltip cursor={false} contentStyle={{ background: "hsl(var(--card))", color: "hsl(var(--foreground))", borderColor: "hsl(var(--border))" }} /><Bar dataKey="amount" name="Satış" fill="hsl(var(--chart-accent))" isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
      <ul className="mt-3 space-y-1 text-sm">{categories.map(d => <li key={d.category} className="flex justify-between gap-3"><span className="break-words">{d.category}</span><span className="shrink-0">{d.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span></li>)}</ul>
    </section>}
  </div>;
}
