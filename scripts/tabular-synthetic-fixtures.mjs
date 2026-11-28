import { createRequire } from "node:module";
import { resolve } from "node:path";

const backend = createRequire(resolve("functions/package.json"));
const ExcelJS = backend("exceljs");

// Canlı koşu ve çevrimdışı inceleme için bağımsız, sabit sentetik cevap anahtarını verir.
export function tabularFixtureContract(kind) {
  if (kind === "csv") {
    return {
      caseId: "synthetic-service-csv-v1",
      name: "synthetic-service-revenue.csv",
      type: "text/csv",
      rows: 4,
      previews: [{ sheet: null, columns: ["Service", "NetRevenue"], values: [["Cloud", "12000.10"], ["Cloud", "-500.10"], ["Consulting", "5000.20"], ["Consulting", "2500.30"]] }],
      measure: "NetRevenue",
      group: "Service",
      groupRows: { Cloud: [2, 3], Consulting: [4, 5] },
      total: 19000.5,
      points: [["Cloud", 11500], ["Consulting", 7500.5]],
      selection: { sheet: null, valueColumn: 1, groupColumn: 0, aggregation: "sum", numberFormat: "plain", unit: "USD" },
      objective: "Compare recorded net revenue across service lines. Explain which profitability conclusions cannot be supported without cost data.",
    };
  }
  if (kind !== "xlsx") throw new Error("Unknown synthetic table format.");
  return {
    caseId: "synthetic-service-xlsx-v1",
    name: "synthetic-service-teams.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rows: 3,
    previews: [
      { sheet: "Out of scope", columns: ["Team", "Amount"], values: [["Other", 999999]] },
      { sheet: "Services", columns: ["Team", "Amount"], values: [["A", 10], ["A", 20], ["B", 90]] },
    ],
    measure: "Amount",
    group: "Team",
    groupRows: { B: [4], A: [2, 3] },
    total: 40,
    points: [["B", 90], ["A", 15]],
    selection: { sheet: "Services", valueColumn: 1, groupColumn: 0, aggregation: "mean", numberFormat: "plain", unit: "EUR" },
    objective: "Compare the unweighted average amount per team on the Services worksheet. Explain which business conclusions need additional evidence.",
  };
}

// Sentetik CSV ve XLSX dosyalarını kabul sözleşmesindeki girdilerden üretir.
export async function tabularFixture(kind) {
  const contract = tabularFixtureContract(kind);
  if (kind === "csv") {
    const [{ columns, values }] = contract.previews;
    return { ...contract, bytes: Buffer.from([columns, ...values].map(row => row.join(",")).join("\n") + "\n") };
  }
  const workbook = new ExcelJS.Workbook();
  for (const { sheet, columns, values } of contract.previews) {
    workbook.addWorksheet(sheet).addRows([columns, ...values]);
  }
  return { ...contract, bytes: Buffer.from(await workbook.xlsx.writeBuffer()) };
}
