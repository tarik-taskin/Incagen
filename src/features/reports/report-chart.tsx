import { reportPalette } from "./report-colors";
import { t, useLocale, localeTag, getLocale } from "../../i18n/runtime";
import { useId, useRef, type ReactElement } from "react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Label, LabelList, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useInView, useReducedMotion } from "motion/react";
import { ChartContainer, ChartTooltipCard } from "../../components/ui/chart";
import type { AiResult } from "../../../functions/src/analysis/result-contract";

type Dataset = AiResult["datasets"][number];
interface Props { dataset: Dataset; comparison?: Dataset; type: AiResult["charts"][number]["type"]; onPoint: (metricId: string) => void; testId?: string }
interface Row { label: string; value: number | null; comparison?: number | null; metricId: string; comparisonMetricId?: string }

// Büyük değerleri eksende okunabilir tutar; tooltip ve tabloda tam değer korunur.
function axisNumber(value: number) {
  if (getLocale() !== "tr") return new Intl.NumberFormat(localeTag(), { notation: "compact", maximumFractionDigits: 1 }).format(value);
  if (Math.abs(value) >= 1_000_000_000) return new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 2 }).format(value / 1_000_000_000) + " mlr";
  if (Math.abs(value) >= 1_000_000) return new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 1 }).format(value / 1_000_000) + " mn";
  if (Math.abs(value) >= 10_000) return new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 0 }).format(value / 1000) + " bin";
  return new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 1 }).format(value);
}

// Tooltip'te birimiyle tam değeri gösterir; eksik ölçüm sıfıra çevrilmez.
function fullValue(value: unknown, unit: string) {
  return typeof value === "number" ? `${new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 2 }).format(value)} ${unit === "TRY" ? "TL" : unit}` : "—";
}

// Grafik görünürken başlar; seçili dönemin doğrulanmış değerlerini ve isteğe bağlı bütçeyi shadcn/Recharts ile çizer.
export function ReportChart({ dataset, comparison, type, onPoint, testId = "report-chart" }: Props) {
  useLocale();
  const element = useRef<HTMLDivElement>(null);
  const gradientId = useId().replace(/:/g, "");
  const reducedMotion = useReducedMotion();
  const visible = useInView(element, { once: true, margin: "100px" });
  const animate = !reducedMotion;
  const percent = dataset.unit === "%";
  const rows: Row[] = dataset.points.map((point, index) => ({ label: t(point.label), value: point.value, metricId: point.metricId, comparison: comparison?.points[index]?.value ?? null, comparisonMetricId: comparison?.points[index]?.metricId }));
  const min = Math.min(0, ...dataset.points.map(point => point.value ?? 0));
  const select = (index: number | undefined, secondary = false) => {
    const row = index === undefined ? undefined : rows[index];
    const metricId = secondary ? row?.comparisonMetricId : row?.metricId;
    if (metricId) onPoint(metricId);
  };
  const tooltip = (
    <Tooltip
      cursor={type === "line" ? { strokeDasharray: "3 3" } : true}
      content={({ active, payload, label }) => active && payload?.length ? (
        <ChartTooltipCard
          title={String(type === "donut" ? payload[0].name : label)}
          rows={payload.map(item => ({ name: String(item.dataKey === "comparison" ? t(comparison?.label ?? "") : t(dataset.label)), value: fullValue(item.value, dataset.unit), color: String(item.payload?.fill ?? item.color ?? reportPalette[0]) }))}
        />
      ) : null}
    />
  );

  let chart: ReactElement;
  if (type === "donut") {
    const total = dataset.points.reduce((sum, point) => sum + (point.value ?? 0), 0);
    if (dataset.points.some(point => point.value === null || point.value < 0) || total <= 0) throw new Error("Dağılım grafiği pozitif ve eksiksiz bir toplam gerektirir.");
    chart = (
      <PieChart accessibilityLayer={false}>
        {tooltip}
        <Pie data={rows} dataKey="value" nameKey="label" rootTabIndex={-1} innerRadius="63%" outerRadius="82%" paddingAngle={3} cornerRadius={8} startAngle={90} endAngle={-270} isAnimationActive={animate} onClick={(_, index) => select(index)} className="cursor-pointer">
          {rows.map((row, index) => <Cell key={row.metricId} fill={reportPalette[index % reportPalette.length]} stroke="transparent" />)}
          <Label content={({ viewBox }) => {
            const { cx, cy } = (viewBox ?? {}) as { cx?: number; cy?: number };
            return cx === undefined || cy === undefined ? null : (
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                <tspan x={cx} y={cy - 6} className="fill-foreground text-[25px] font-semibold">{axisNumber(total)}</tspan>
                <tspan x={cx} y={cy + 16} className="fill-muted-foreground text-[9px]">{dataset.unit === "TRY" ? t("NET SATIŞ · TL") : t(dataset.unit)}</tspan>
              </text>
            );
          }} />
        </Pie>
      </PieChart>
    );
  } else if (type === "horizontal-bar") {
    chart = (
      <BarChart accessibilityLayer={false} data={rows} layout="vertical" margin={{ top: 4, right: 76, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} strokeDasharray="4 4" />
        <XAxis type="number" domain={[min, percent ? 100 : "auto"]} tickFormatter={value => axisNumber(value) + (percent ? "%" : "")} tickLine={false} axisLine={false} fontSize={10} tickCount={4} />
        <YAxis type="category" dataKey="label" width={136} tickLine={false} axisLine={false} fontSize={11} />
        {tooltip}
        <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={28} isAnimationActive={animate} onClick={(_, index) => select(index)} className="cursor-pointer">
          {rows.map((row, index) => <Cell key={row.metricId} fill={reportPalette[index % reportPalette.length]} />)}
          <LabelList dataKey="value" position="right" className="fill-muted-foreground" fontSize={11} formatter={(value: unknown) => typeof value === "number" ? axisNumber(value) : "—"} />
        </Bar>
      </BarChart>
    );
  } else {
    const line = type === "line";
    chart = (
      <ComposedChart accessibilityLayer={false} data={rows} margin={{ top: 20, right: 12, bottom: 4, left: 4 }} onClick={state => select(state?.activeTooltipIndex === undefined || state.activeTooltipIndex === null ? undefined : Number(state.activeTooltipIndex))} className="cursor-pointer">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={reportPalette[0]} stopOpacity={0.22} />
            <stop offset="100%" stopColor={reportPalette[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tickMargin={10} interval="preserveStartEnd" />
        <YAxis domain={[min, percent ? 100 : "auto"]} tickFormatter={value => axisNumber(value) + (percent ? "%" : "")} tickLine={false} axisLine={false} fontSize={10} tickCount={4} width={68} />
        {tooltip}
        {line ? <>
          <Area dataKey="value" type="linear" stroke="none" fill={`url(#${gradientId})`} isAnimationActive={animate} connectNulls={false} />
          <Line dataKey="value" type="linear" stroke={reportPalette[0]} strokeWidth={3} dot={false} activeDot={{ r: 5 }} isAnimationActive={animate} connectNulls={false} />
          {comparison && <Line dataKey="comparison" type="linear" stroke={reportPalette[1]} strokeWidth={2} strokeDasharray="6 5" dot={false} activeDot={{ r: 4 }} isAnimationActive={animate} connectNulls={false} />}
        </> : <>
          <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={animate}>
            {rows.map((row, index) => <Cell key={row.metricId} fill={reportPalette[index % reportPalette.length]} />)}
            {rows.length < 5 && <LabelList dataKey="value" position="top" className="fill-muted-foreground" fontSize={11} formatter={(value: unknown) => typeof value === "number" ? axisNumber(value) : "—"} />}
          </Bar>
          {comparison && <Line dataKey="comparison" type="linear" stroke={reportPalette[1]} strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={animate} />}
        </>}
      </ComposedChart>
    );
  }

  // SVG eksen koordinatları LTR kalır; Arapça etiketler yerelleştirilir, dış arayüz RTL düzenini korur.
  return (
    <ChartContainer ref={element} dir="ltr" className="h-64 sm:h-72" aria-hidden="true" data-testid={testId}>
      {visible && <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>}
    </ChartContainer>
  );
}
