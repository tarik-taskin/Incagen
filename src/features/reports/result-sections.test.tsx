import { afterEach } from "vitest";
import { setLocale, t } from "../../i18n/runtime";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AiResult } from "../../../functions/src/analysis/result-contract";
import example from "./feedback-example.json";
import { AdaptiveReport, ReportDetails } from "./result-sections";

vi.mock("../../hooks/use-theme", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("./report-chart", () => ({ ReportChart: ({ dataset }: { dataset: { label: string } }) => <div data-testid="adaptive-chart">{dataset.label}</div> }));
vi.mock("./report-primitives", () => ({ ReportReveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

describe("uyarlanabilir sonuç sunumu", () => {
  afterEach(() => setLocale("tr"));
  it("Arapça ikil sayımın yerel ifadesine gereksiz sayı eklemez", () => {
    setLocale("ar");
    const result = structuredClone(example.result) as AiResult;
    result.metrics.find(metric => metric.id === "comments")!.value = 2;
    render(<AdaptiveReport result={result} sources={example.sources} featuredMetricIds={["comments"]} />);
    const metric = screen.getByRole("button", { name: new RegExp(t("İncelenen yorum")) });
    expect(metric).toHaveAccessibleName(new RegExp("تعليقان"));
    expect(metric).not.toHaveTextContent("٢");
  });
  it("finans kimlikleri gerektirmeden farklı metrik ve grafikler sunar; eksik değeri sıfır yapmaz", () => {
    render(<AdaptiveReport result={example.result as AiResult} sources={example.sources} featuredMetricIds={["comments", "csat"]} />);
    expect(screen.getByRole("button", { name: /Memnuniyet puanı/ })).toHaveTextContent("—");
    expect(screen.getByRole("button", { name: /Memnuniyet puanı/ })).not.toHaveTextContent("0%");
    expect(screen.getAllByTestId("adaptive-chart")).toHaveLength(3);
    expect(screen.queryByText("Net satış")).not.toBeInTheDocument();
    expect(screen.getAllByText("Yorum", { exact: true })).toHaveLength(2);
  });
  it("sayısal veri içermeyen raporu boş grafik veya uydurma kart olmadan gösterir", () => {
    const result = structuredClone(example.result) as AiResult;
    result.metrics = []; result.datasets = []; result.charts = [];
    for (const statement of [...result.summary, ...result.findings.flatMap(item => item.statements)]) statement.metricIds = [];
    render(<AdaptiveReport result={result} sources={example.sources} />);
    expect(screen.queryByLabelText("Öne çıkan metrikler")).not.toBeInTheDocument();
    expect(screen.queryByTestId("adaptive-chart")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "İlk kullanımı daha da kolaylaştırın" })).toBeVisible();
  });
  it("öneriyi onu destekleyen bulguyla birleştirir ve ayrıntıları kapalı başlatır", () => {
    const { container } = render(<AdaptiveReport result={example.result as AiResult} sources={example.sources} />);
    const detail = [...container.querySelectorAll("details")].find(item => item.textContent?.includes("Sonraki adımlar"))!;
    expect(detail.open).toBe(false);
    fireEvent.click(detail.querySelector("summary")!);
    expect(detail.open).toBe(true);
    expect(screen.getByRole("button", { name: "İlk kullanımı daha da kolaylaştırın" })).toBeVisible();
  });
  it("ayrıntı içeriğini DOM'da koruyan yerel disclosure kullanır", () => {
    const { container } = render(<ReportDetails title="Ayrıntılar" description="Hesap ve kanıt"><p>Korunmuş bilgi</p></ReportDetails>);
    expect(container.querySelector("details")?.open).toBe(false);
    expect(screen.getByText("Korunmuş bilgi")).toBeInTheDocument();
  });
});
