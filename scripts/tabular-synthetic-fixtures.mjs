import { createRequire } from "node:module";
import { resolve } from "node:path";

const backend = createRequire(resolve("functions/package.json"));
const ExcelJS = backend("exceljs");

// Sentetik CSV ve çok sayfalı XLSX vakalarını bağımsız beklenen grup/toplam/satırlarla üretir.
export async function tabularFixture(kind) {
  if (kind === "csv") {
    return {
      caseId: "synthetic-service-csv-v1",
      name: "synthetic-service-revenue.csv",
      type: "text/csv",
      bytes: Buffer.from("Service,NetRevenue\nCloud,12000.10\nCloud,-500.10\nConsulting,5000.20\nConsulting,2500.30\n"),
      rows: 4,
      measure: "NetRevenue",
      group: "Service",
      groupRows: { Cloud: [2, 3], Consulting: [4, 5] },
      total: 19000.5,
      points: [["Cloud", 11500], ["Consulting", 7500.5]],
      selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" },
      objective: "Compare recorded net revenue across service lines. Explain which profitability conclusions cannot be supported without cost data.",
    };
  }
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Out of scope").addRows([["Team", "Amount"], ["Other", 999999]]);
  workbook.addWorksheet("Services").addRows([["Team", "Amount"], ["A", 10], ["A", 20], ["B", 90]]);
  return {
    caseId: "synthetic-service-xlsx-v1",
    name: "synthetic-service-teams.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    bytes: Buffer.from(await workbook.xlsx.writeBuffer()),
    rows: 3,
    measure: "Amount",
    group: "Team",
    groupRows: { B: [4], A: [2, 3] },
    total: 40,
    points: [["B", 90], ["A", 15]],
    selection: { sheet: "Services", valueColumn: 1, groupColumn: 0, aggregation: "mean", numberFormat: "plain", unit: "EUR" },
    objective: "Compare the unweighted average amount per team on the Services worksheet. Explain which business conclusions need additional evidence.",
  };
}
