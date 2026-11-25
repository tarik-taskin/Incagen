import type { AiResult } from "../../../functions/src/analysis/result-contract";
import type { ReportSource } from "./source-dialog";
import { matchesEvidence } from "./source-view";

const headers = ["metric_id", "label", "value", "unit", "status", "reason", "method", "source_locations"];

// Alıntılama CSV yapısını korur. Formül gibi okunabilecek metne tablo uygulamaları için düz metin işareti ekler.
function csvCell(value: string | number | null) {
  if (value === null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid metric value.");
    return String(value);
  }
  const normalized = value.normalize("NFKC");
  const looksLikeFormula = /^[\p{White_Space}\p{Cf}\p{Cc}]*[=+@-]/u.test(normalized);
  const text = looksLikeFormula || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

// Bir metriğin tüm dayanakları aynı hücrede kalır. Dosya sürümü ve kaynak aralığı mevcut kuraldan geçmelidir.
function sourceLocations(metric: AiResult["metrics"][number], sources: ReadonlyMap<string, ReportSource>) {
  return JSON.stringify(metric.evidence.map(anchor => {
    const source = sources.get(anchor.sourceId);
    if (!source || !matchesEvidence(source, anchor)) throw new Error("Metric evidence does not match its source.");
    const { page, sheet, slide, section, rowStart, rowEnd } = anchor.locator;
    return {
      source_id: source.sourceId, file_name: source.fileName, page, sheet, slide, section,
      row_start: rowStart, row_end: rowEnd,
    };
  }));
}

// Hazır rapordan çalışır. Arayüz dilini, ham belgeyi veya model anlatısını CSV satırına taşımaz.
export function createMetricsCsv(metrics: AiResult["metrics"], sources: readonly ReportSource[]) {
  const byId = new Map(sources.map(source => [source.sourceId, source]));
  const rows = metrics.map(metric => [
    metric.id, metric.label, metric.value, metric.unit, metric.status,
    metric.status === "unavailable" ? metric.reason : "",
    metric.method, sourceLocations(metric, byId),
  ].map(csvCell).join(","));
  // UTF-8 BOM ve CRLF, yerel metinleri yaygın hesap tablosu uygulamalarında okunabilir tutar.
  return `\uFEFF${[headers.join(","), ...rows].join("\r\n")}\r\n`;
}
