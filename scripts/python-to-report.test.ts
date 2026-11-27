import { createElement, type ReactNode } from "react";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTabularPacket, interpretTable } from "../functions/src/analysis/tabular-result";
import { probeSyntheticTable } from "../functions/src/analysis/tabular-probe";
import type { GeminiGenerate } from "../functions/src/analysis/gemini";
import { workerResultSchema, type ResultLocale, type TableSelection, type WorkerResult } from "../functions/src/analysis/tabular-contract";
import { parseCsvTablePreview } from "../functions/src/analysis/tabular-storage";
import { parseDocument } from "../functions/src/parsing";
import { AdaptiveReport } from "../src/features/reports/result-sections";
import { reportNumber } from "../src/features/reports/report-format";
import { setLocale } from "../src/i18n/runtime";
import { tabularFixture as fixture } from "./tabular-synthetic-fixtures.mjs";

vi.mock("../src/hooks/use-theme", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("../src/features/reports/report-chart", () => ({
  ReportChart: ({ dataset }: { dataset: { id: string; unit: string; points: { label: string; value: number | null }[] } }) =>
    createElement("div", { "data-testid": `chart-${dataset.id}` }, `${dataset.unit}:${dataset.points.map(p => `${p.label}=${p.value}`).join(",")}`),
}));
vi.mock("../src/features/reports/report-primitives", () => ({
  ReportReveal: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

const LOCALES: readonly ResultLocale[] = ["tr", "en", "de", "es", "zh", "ar"];

const CONTROLLED_NARRATIVES: Record<ResultLocale, { summary: string; title: string; finding: string; limitation: string }> = {
  tr: {
    summary: "Seçili hizmet satırları doğrulanmış grup toplamlarıyla özetlendi.",
    title: "Kayıtlı ölçüm dağılımı",
    finding: "Gruplar arası fark kaynak satırlarından doğrulandı.",
    limitation: "Maliyet verisi olmadığından kârlılık sonucu çıkarılamaz.",
  },
  en: {
    summary: "Selected service lines were summarized with verified group metrics.",
    title: "Recorded measure distribution",
    finding: "Differences across groups are verified directly from source rows.",
    limitation: "Profitability conclusions require cost data outside this table.",
  },
  de: {
    summary: "Ausgewählte Leistungszeilen wurden mit geprüften Gruppenwerten zusammengefasst.",
    title: "Erfasste Kennzahlenverteilung",
    finding: "Gruppenunterschiede sind anhand der Quellzeilen belegt.",
    limitation: "Aussagen zur Profitabilität erfordern fehlende Kostendaten.",
  },
  es: {
    summary: "Las líneas seleccionadas se resumieron con métricas de grupo verificadas.",
    title: "Distribución de la medida registrada",
    finding: "Las diferencias entre grupos se verifican en las filas de origen.",
    limitation: "Las conclusiones de rentabilidad requieren datos de costos ausentes.",
  },
  zh: {
    summary: "已使用经过验证的分组指标汇总所选服务行。",
    title: "已记录指标分布",
    finding: "各组之间的差异已从源数据行核实。",
    limitation: "表外缺少成本数据，无法得出盈利结论。",
  },
  ar: {
    summary: "لُخِّصت بنود الخدمة المحددة بمقاييس مجموعات موثقة.",
    title: "توزيع المقياس المسجل",
    finding: "تُحقَّق الفروق بين المجموعات من صفوف المصدر مباشرة.",
    limitation: "استنتاجات الربحية تتطلب بيانات تكاليف غير متوفرة هنا.",
  },
};

// İzole Python işçisini gerçek CSV/XLSX baytları ve açık seçimle çalıştırıp çıkış kodunu ve JSON çıktısını döner.
function runPythonWorker(bytes: Buffer, fileName: string, selection: TableSelection): { status: number | null; body: { error?: string; result?: WorkerResult } } {
  const metadata = Buffer.from(JSON.stringify({ sourceId: "file-0", fileName, selection })).toString("base64");
  const child = spawnSync(resolve("python/.venv/bin/python"), ["-m", "incagen_extract.worker_cli"], {
    input: bytes,
    env: {
      PATH: process.env.PATH,
      PYTHONPATH: resolve("python/src"),
      INCAGEN_WORKER_METADATA: metadata,
      OPENBLAS_NUM_THREADS: "1",
    },
    encoding: "utf8",
    timeout: 30_000,
  });
  return { status: child.status, body: JSON.parse(child.stdout) as { error?: string; result?: WorkerResult } };
}

const smokeNarrative = JSON.stringify({ summary: [{ text: "The selected group totals differ.", metricIds: ["aggregate"] }],
  findings: [{ id: "finding-1", title: "Distribution", text: "Review the recorded amounts.", metricIds: ["aggregate"] }],
  recommendations: [], limitations: ["Costs are unavailable in this table."] });

it.each([["csv", 31], ["xlsx", 40]] as const)("runs the real Python ledger for the fixed %s provider smoke", async (format, aggregate) => {
  const model = vi.fn<GeminiGenerate>(async () => smokeNarrative);
  let tick = 0;
  const result = await probeSyntheticTable(format, onUsage => async request => {
    onUsage({ promptTokens: 120, outputTokens: 30, totalTokens: 150 });
    return model(request);
  }, async (bytes, _source, name, selection) => {
    return workerResultSchema.parse(runPythonWorker(bytes, name, selection).body.result);
  }, () => ++tick);
  expect(result).toMatchObject({ tableFormat: format, rows: 3, groups: 2, aggregate, sourceRowsVerified: true, usage: { totalTokens: 150 } });
  expect(model).toHaveBeenCalledOnce();
  expect(result).not.toHaveProperty("summary");
});

it("rejects changed physical source evidence before dispatching the smoke to Gemini", async () => {
  const model = vi.fn();
  await expect(probeSyntheticTable("csv", model, async (bytes, _source, name, selection) => {
    const worker = workerResultSchema.parse(runPythonWorker(bytes, name, selection).body.result);
    worker.metrics[1].evidence[0].locator.rowStart = 1;
    return worker;
  })).rejects.toMatchObject({ code: "invalid-data" });
  expect(model).not.toHaveBeenCalled();
});

// Çıktı içindeki kaynak kanıtlarının beklenen sayfa ve fiziksel satır aralığıyla birebir eşleşmesini doğrular.
function collectPhysicalRows(
  evidence: readonly { sourceId: string; sha256: string; chunkId: string; locator: { sheet?: string; rowStart?: number; rowEnd?: number } }[],
  expectedSha256: string,
  expectedSheet: string | null,
) {
  const rows: number[] = [];
  for (const anchor of evidence) {
    expect(anchor.sourceId).toBe("file-0");
    expect(anchor.sha256).toBe(expectedSha256);
    expect(anchor.locator.sheet ?? null).toBe(expectedSheet);
    for (let row = anchor.locator.rowStart!; row <= anchor.locator.rowEnd!; row += 1) {
      rows.push(row);
    }
  }
  return rows.sort((a, b) => a - b);
}

afterEach(() => {
  cleanup();
  setLocale("tr");
});

describe("gerçek Python hesaplayıcısından altı dilli üretim rapor biçimine uçtan uca akış", () => {
  it("hazırlık, önizleme ve Python baştaki boş satırda, ayraçta ve yinelenen başlıklarda anlaşır", async () => {
    const sourceId = "file-0";
    const fileName = "gelir.csv";
    const data = Buffer.from('\r\n"Ekip; adı";Gelir;Gelir;Gelir (2);\r\n"Alfa\r\nekip";2;3;4;a\r\n\r\nBeta;4;5;6;b\r\n');
    const prepared = await parseDocument({ sourceId, fileName, contentType: "text/csv", data });
    const preview = parseCsvTablePreview(data, { id: sourceId, name: fileName });
    const selection = { sheet: null, valueColumn: 1, groupColumn: null, aggregation: "sum", numberFormat: "plain", unit: "number" } as const;
    const { status, body } = runPythonWorker(data, fileName, selection);
    expect(status).toBe(0);
    const worker = workerResultSchema.parse(body.result);
    const columns = ["Ekip; adı", "Gelir", "Gelir (2)", "Gelir (2) (2)", "Sütun 5"];
    expect(prepared.chunks[0].table?.columns).toEqual(columns);
    expect(preview.columns).toEqual(columns);
    expect(worker.document.chunks[0].table?.columns).toEqual(columns);
    expect(preview.sampleRows?.map(row => row.row)).toEqual([3, 5, 6]);
    const metric = worker.metrics.find(item => item.id === "aggregate")!;
    expect(metric.value).toBe(6);
    expect(collectPhysicalRows(metric.evidence, worker.document.sha256, null)).toEqual([3, 6]);
  });

  it("CSV ve çok sayfalı XLSX vakalarını Python işçisi, createTabularPacket, interpretTable ve üretim biçimleyicisinden altı dilde geçirir", async () => {
    for (const kind of ["csv", "xlsx"] as const) {
      const sample = await fixture(kind);
      const expectedSha256 = createHash("sha256").update(sample.bytes).digest("hex");
      const { status, body: rawResponse } = runPythonWorker(sample.bytes, sample.name, sample.selection);
      expect(status).toBe(0);
      expect(rawResponse.error).toBeUndefined();
      const worker = workerResultSchema.parse(rawResponse.result);

      expect(worker.scope.sheet).toBe(sample.selection.sheet);
      expect(worker.scope.rows).toBe(sample.rows);
      expect(worker.document.sha256).toBe(expectedSha256);
      expect(worker.document.chunks.every(chunk => (chunk.locator.sheet ?? null) === sample.selection.sheet)).toBe(true);
      expect(JSON.stringify(worker)).not.toContain("Out of scope");
      expect(JSON.stringify(worker)).not.toContain("999999");

      for (const locale of LOCALES) {
        const packet = createTabularPacket(`py-to-report-${kind}-${locale}`, sample.objective, worker, locale);
        const text = CONTROLLED_NARRATIVES[locale];
        const result = await interpretTable(packet, locale, async () => JSON.stringify({
          summary: [{ text: text.summary, metricIds: ["aggregate", "group-1"] }],
          findings: [{ id: "finding-1", title: text.title, text: text.finding, metricIds: ["aggregate", "group-2"] }],
          recommendations: [],
          limitations: [text.limitation],
        }));

        expect(result.metrics.find(m => m.id === "aggregate")?.value).toBe(sample.total);
        expect(result.metrics.find(m => m.id === "aggregate")?.unit).toBe(sample.selection.unit);
        expect(result.charts).toHaveLength(1);
        expect(result.charts[0].type).toBe("horizontal-bar");
        expect(result.datasets[0].unit).toBe(sample.selection.unit);
        expect(result.datasets[0].points.map(p => [p.label, p.value])).toEqual(sample.points);

        for (const [groupLabel, expectedRows] of Object.entries(sample.groupRows)) {
          const metric = result.metrics.find(m => m.label === groupLabel);
          expect(metric).toBeDefined();
          expect(collectPhysicalRows(metric!.evidence, expectedSha256, sample.selection.sheet)).toEqual(expectedRows);
        }

        setLocale(locale);
        const formattedAggregate = reportNumber(sample.total, sample.selection.unit);
        const view = render(createElement(AdaptiveReport, {
          result,
          sources: [worker.document],
          featuredMetricIds: ["aggregate", "rows"],
          translateContent: false,
          compactMetrics: false,
        }));
        expect(view.container.textContent).toContain(formattedAggregate);
        expect(view.getByTestId("chart-groups").textContent).toBe(`${sample.selection.unit}:${sample.points.map(([l, v]) => `${l}=${v}`).join(",")}`);
        for (const [label] of sample.points) {
          expect(view.container.textContent).toContain(label);
        }
        view.unmount();
      }
    }
  });

  it("yanlış Excel çalışma sayfasını ve bozulmuş kaynak/sayfa kanıt bağını reddeder", async () => {
    const xlsxSample = await fixture("xlsx");
    const wrongSheetRun = runPythonWorker(xlsxSample.bytes, xlsxSample.name, { ...xlsxSample.selection, sheet: "WrongSheet" });
    expect(wrongSheetRun.status).toBe(1);
    expect(wrongSheetRun.body.error).toBe("table-not-found");
    expect(() => workerResultSchema.parse(wrongSheetRun.body.result)).toThrow();

    const validRun = runPythonWorker(xlsxSample.bytes, xlsxSample.name, xlsxSample.selection);
    expect(validRun.status).toBe(0);
    const worker = workerResultSchema.parse(validRun.body.result);

    const brokenAnchorWorker = structuredClone(worker);
    brokenAnchorWorker.metrics[2].evidence[0].locator.sheet = "Out of scope";
    expect(() => createTabularPacket("bad-sheet-anchor", xlsxSample.objective, brokenAnchorWorker, "tr")).toThrow();

    const wrongRowWorker = structuredClone(worker);
    wrongRowWorker.metrics[1].evidence[0].locator.rowEnd = 99;
    expect(() => createTabularPacket("bad-row-anchor", xlsxSample.objective, wrongRowWorker, "en")).toThrow();
  });
});
