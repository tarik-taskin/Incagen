import { useState } from "react";
import { Download } from "lucide-react";
import type { AiResult } from "../../../functions/src/analysis/result-contract";
import { Button } from "../../components/ui/button";
import { t } from "../../i18n/runtime";
import { downloadBlob } from "./download-blob";
import { createMetricsCsv } from "./metrics-csv";
import type { ReportSource } from "./source-dialog";

export type MetricsCsvAction = { fileName: string; canDownload?: () => boolean };

// Rapor zaten açıkken yerel CSV oluşturur. Gerçek raporda etkin oturum tıklama anında kontrol edilir.
export function MetricsCsvDownload({ metrics, sources, fileName, canDownload }: MetricsCsvAction & {
  metrics: AiResult["metrics"];
  sources: ReportSource[];
}) {
  const [failed, setFailed] = useState(false);
  if (metrics.length === 0) return null;

  function download() {
    try {
      if (canDownload && !canDownload()) throw new Error("Report session changed.");
      const csv = createMetricsCsv(metrics, sources);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), fileName);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
    {failed && <p role="alert" className="text-sm text-destructive">{t("CSV hazırlanamadı. Raporu yeniden açıp deneyin.")}</p>}
    <Button type="button" variant="outline" className="min-h-11 gap-2 whitespace-normal text-start" onClick={download}>
      <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
      {t("Hesapları CSV olarak indir")}
    </Button>
  </div>;
}
