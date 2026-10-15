import { useEffect, useRef } from "react";
import { init, use as registerCharts, graphic, type EChartsCoreOption } from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, TitleComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { useInView, useReducedMotion } from "motion/react";
import { useTheme } from "../../hooks/use-theme";
import type { AiResult } from "../../../functions/src/analysis/result-contract";

registerCharts([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, TitleComponent, SVGRenderer]);
type Dataset = AiResult["datasets"][number];
interface Props { dataset: Dataset; comparison?: Dataset; type: AiResult["charts"][number]["type"]; onPoint: (metricId: string) => void; testId?: string }

// Büyük değerleri eksende okunabilir tutar; tooltip ve tabloda tam değer korunur.
function axisNumber(value: number) {
  if (Math.abs(value) >= 1_000_000) return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value / 1_000_000) + " mn";
  if (Math.abs(value) >= 10_000) return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value / 1000) + " bin";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

// Grafik görünürken başlar; seçili dönemin doğrulanmış değerlerini ve isteğe bağlı bütçeyi birlikte çizer.
export function ReportChart({ dataset, comparison, type, onPoint, testId = "report-chart" }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof init> | null>(null);
  const selection = useRef(onPoint);
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const visible = useInView(element, { once: true, margin: "100px" });
  useEffect(() => { selection.current = onPoint; }, [onPoint]);
  useEffect(() => {
    if (!element.current) return;
    const instance = init(element.current, undefined, { renderer: "svg" });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element.current);
    return () => { observer.disconnect(); instance.dispose(); chart.current = null; };
  }, []);
  useEffect(() => {
    const instance = chart.current;
    if (!instance || !visible) return;
    const horizontal = type === "horizontal-bar", dark = theme === "dark", percent = dataset.unit === "%";
    const ink = dark ? "#c7bed5" : "#756383";
    const colors = dark ? ["#bba6f5", "#80d5d5", "#edb68c", "#96b8ee"] : ["#7351b5", "#328c91", "#bd7d50", "#608cc7"];
    const category = { type: "category", data: dataset.points.map(point => point.label), boundaryGap: type !== "line", axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: ink, fontSize: 11, margin: 14, hideOverlap: true } };
    const value = { type: "value", splitNumber: 3, min: Math.min(0, ...dataset.points.map(point => point.value ?? 0)), ...(percent ? { max: 100 } : {}), axisLabel: { color: ink, fontSize: 10, hideOverlap: true, formatter: (n: number) => axisNumber(n) + (percent ? "%" : "") }, splitLine: { lineStyle: { color: dark ? "#392b48" : "#ece7f2", type: "dashed" } } };
    const series = (data: Dataset, secondary = false) => ({
      id: data.id, name: data.label, type: type === "line" ? "line" : "bar", smooth: false, connectNulls: false,
      symbol: "circle", symbolSize: 6, showSymbol: false, barMaxWidth: horizontal ? 28 : 34,
      lineStyle: { color: secondary ? colors[1] : colors[0], width: secondary ? 2 : 3, type: secondary ? "dashed" : "solid" },
      ...(type === "line" && !secondary ? { areaStyle: { color: new graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: dark ? "#bba6f538" : "#7351b530" }, { offset: 1, color: "#7351b500" }]) } } : {}),
      label: { show: horizontal || dataset.points.length < 5, position: horizontal ? "right" : "top", color: ink, fontSize: 11, formatter: (params: { value: unknown }) => typeof params.value === "number" ? axisNumber(params.value) : "—" },
      data: data.points.map((point, index) => ({ name: point.label, value: point.value, itemStyle: { color: type === "line" ? (secondary ? colors[1] : colors[0]) : colors[index % colors.length], borderRadius: horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0] } })), emphasis: { focus: "series" }, cursor: "pointer",
    });
    let option: EChartsCoreOption = {
      animation: !reducedMotion, animationDuration: 1050, animationDurationUpdate: 650, animationEasing: "cubicOut", animationDelay: (index: number) => index * 22,
      grid: { left: 4, right: horizontal ? 66 : 12, top: 20, bottom: 8, containLabel: true },
      tooltip: { trigger: type === "line" ? "axis" : "item", renderMode: "richText", confine: true, backgroundColor: dark ? "#251732" : "#ffffff", borderColor: dark ? "#463254" : "#e2daec", textStyle: { color: dark ? "#eee8f7" : "#320e3b", fontSize: 12 }, valueFormatter: (n: unknown) => typeof n === "number" ? `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n)} ${dataset.unit === "TRY" ? "TL" : dataset.unit}` : "—" },
      xAxis: horizontal ? value : category, yAxis: horizontal ? { ...category, inverse: true } : value, series: comparison ? [series(dataset), series(comparison, true)] : [series(dataset)],
    };
    if (type === "donut") {
      const total = dataset.points.reduce((n, point) => n + (point.value ?? 0), 0);
      if (dataset.points.some(point => point.value === null || point.value < 0) || total <= 0) throw new Error("Dağılım grafiği pozitif ve eksiksiz bir toplam gerektirir.");
      option = { ...option, xAxis: undefined, yAxis: undefined, grid: undefined,
        title: { text: axisNumber(total), subtext: "NET SATIŞ · TL", left: "center", top: "40%", textStyle: { fontSize: 25, fontWeight: 600, color: dark ? "#e8f8fb" : "#320e3b" }, subtextStyle: { color: ink, fontSize: 9 } },
        tooltip: { ...option.tooltip as object, trigger: "item" },
        series: [{ id: dataset.id, name: dataset.label, type: "pie", radius: ["63%", "82%"], center: ["50%", "49%"], padAngle: 3, startAngle: 90, label: { show: false }, emphasis: { scaleSize: 7 }, itemStyle: { borderRadius: 8 }, data: dataset.points.map((point, index) => ({ name: point.label, value: point.value, itemStyle: { color: colors[index % colors.length] } })) }],
      };
    }
    instance.setOption(option, { notMerge: true });
    const select = (event: { dataIndex?: number; seriesIndex?: number }) => {
      const data = event.seriesIndex === 1 && comparison ? comparison : dataset;
      if (event.dataIndex !== undefined && data.points[event.dataIndex]) selection.current(data.points[event.dataIndex].metricId);
    };
    instance.on("click", select);
    return () => { instance.off("click", select); };
  }, [dataset, comparison, type, theme, reducedMotion, visible]);
  return <div ref={element} className="h-64 w-full sm:h-72" aria-hidden="true" data-testid={testId} />;
}
