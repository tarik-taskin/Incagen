import { useEffect, useRef } from "react";
import { init, use as registerCharts, type EChartsCoreOption } from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { useReducedMotion } from "motion/react";
import { useTheme } from "../../hooks/use-theme";
import type { AiResult } from "../../../functions/src/analysis/result-contract";

registerCharts([BarChart, LineChart, GridComponent, TooltipComponent, SVGRenderer]);

interface Props {
  dataset: AiResult["datasets"][number];
  type: AiResult["charts"][number]["type"];
  onPoint: (metricId: string) => void;
}

// Eksik grafik değeri sıfırmış gibi gösterilmez; yalnız gerçek sayılar biçimlendirilir.
function chartNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value) : "—";
}

// Doğrulanmış veri kümesini sıfır tabanlı eksenle çizer; metrik seçimini kaynak incelemesine iletir.
export function ReportChart({ dataset, type, onPoint }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof init> | null>(null);
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const selection = useRef(onPoint);
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
    if (!instance) return;
    const horizontal = type === "horizontal-bar";
    const dark = theme === "dark";
    const ink = dark ? "#d4cbe1" : "#756383";
    const colors = dark ? ["#bba6f5", "#a2e5e8", "#e8bd9c"] : ["#7351b5", "#43a6ac", "#bf855e"];
    const category = { type: "category", data: dataset.points.map(point => point.label), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: ink, fontSize: 12, margin: 16 } };
    const value = { type: "value", splitNumber: 3, min: Math.min(0, ...dataset.points.map(point => point.value ?? 0)), axisLabel: { color: ink, fontSize: 11, hideOverlap: true, formatter: (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n) }, splitLine: { lineStyle: { color: dark ? "#392b48" : "#ece7f2", type: "dashed" } } };
    const option: EChartsCoreOption = {
      animation: !reducedMotion, animationDuration: 650, animationDurationUpdate: 300, animationEasing: "cubicOut",
      grid: { left: 12, right: horizontal ? 64 : 20, top: 32, bottom: 12, containLabel: true },
      tooltip: { trigger: "item", renderMode: "richText", confine: true, valueFormatter: (n: unknown) => `${chartNumber(n)} ${dataset.unit === "TRY" ? "TL" : dataset.unit}` },
      xAxis: horizontal ? value : category,
      yAxis: horizontal ? { ...category, inverse: true } : value,
      series: [{
        type: type === "line" ? "line" : "bar", smooth: false, connectNulls: false, barMaxWidth: horizontal ? 38 : 86,
        label: { show: true, position: horizontal ? "right" : "top", color: ink, fontSize: 12, formatter: (params: { value: unknown }) => chartNumber(params.value) },
        data: dataset.points.map((point, index) => ({ value: point.value, itemStyle: { color: colors[index % colors.length], borderRadius: horizontal ? [0, 7, 7, 0] : [7, 7, 0, 0] } })),
        emphasis: { focus: "self", itemStyle: { opacity: 0.8 } }, cursor: "pointer",
      }],
    };
    instance.setOption(option, { notMerge: true });
    const select = (event: { dataIndex?: number }) => {
      if (event.dataIndex !== undefined) selection.current(dataset.points[event.dataIndex].metricId);
    };
    instance.on("click", select);
    return () => { instance.off("click", select); };
  }, [dataset, type, theme, reducedMotion]);

  // Eşdeğer erişilebilir veri tablosu üst bileşendedir; SVG ekran okuyucuda yinelenmez.
  return <div ref={element} className="h-72 w-full sm:h-80" aria-hidden="true" data-testid="report-chart" />;
}
