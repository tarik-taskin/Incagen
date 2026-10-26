import { ChevronDown, FileCheck2, Files, HardDrive } from "lucide-react";
import type { Report } from "../../functions/src/contracts";
import { formatFileSize } from "../features/files/file-rules";
import { localeTag, t, useLocale } from "../i18n/runtime";

// Kapsam ve uyarıları görünür tutar; her teknik değeri isteğe bağlı, klavyeyle açılan ayrıntıda korur.
export function PreparedDocuments({ report }: { report: Report }) {
  useLocale();
  const number = (value: number) => value.toLocaleString(localeTag());
  return <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card" aria-labelledby="prepared-sources-title">
    <div className="p-5 sm:p-6">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary dark:bg-secondary/10 dark:text-secondary"><FileCheck2 className="h-5 w-5" aria-hidden="true" /></span><div><h2 id="prepared-sources-title" className="font-semibold tracking-tight">{t("Belgelerin içeriği ayrıştırıldı")}</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">{t("Belge kapsamını ve okuma notlarını inceleyin. Ayrıntılı dosya bilgileri aşağıda korunur.")}</p></div></div>
      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-4 border-t border-border/60 pt-4 text-sm">
        <div><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Files className="h-3.5 w-3.5" aria-hidden="true" />{t("Hazırlanan belge")}</dt><dd className="mt-1.5 text-xl font-semibold tabular-nums">{number(report.fileCount)}</dd></div>
        <div><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><HardDrive className="h-3.5 w-3.5" aria-hidden="true" />{t("Toplam kaynak boyutu")}</dt><dd className="mt-1.5 text-xl font-semibold tabular-nums">{formatFileSize(report.totalBytes)}</dd></div>
      </dl>
    </div>
    <ul className="divide-y divide-border/60 border-t border-border/60" aria-label={t("Hazırlanan belgeler")}>
      {report.sources.map(source => <li key={source.id} className="px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 break-all text-sm font-medium"><bdi>{source.name}</bdi></p><span className="text-xs text-muted-foreground">{t(source.category)} · {formatFileSize(source.size)}</span></div>
        {(source.metadata.pages || source.metadata.sheets || source.metadata.slides || source.metadata.width && source.metadata.height) ? <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {[
            source.metadata.pages ? t("{0} sayfa", source.metadata.pages) : "",
            source.metadata.sheets ? t("{0} çalışma sayfası", source.metadata.sheets) : "",
            source.metadata.slides ? t("{0} slayt", source.metadata.slides) : "",
            source.metadata.width && source.metadata.height ? t("{0}×{1}px", source.metadata.width, source.metadata.height) : "",
          ].filter(Boolean).join(" · ")}
        </p> : null}
        {source.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 ps-4 text-xs leading-6 text-amber-800 dark:text-amber-300" aria-label={t("Okuma notları")}>{source.warnings.map((warning, index) => <li key={index}>{t(warning)}</li>)}</ul>}
      </li>)}
    </ul>
    <details className="group border-t border-border/60">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-b-3xl px-5 py-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 [&::-webkit-details-marker]:hidden">{t("Teknik ayrıntılar")}<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary>
      <div className="space-y-5 border-t border-border/60 p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-4 text-xs"><div><dt className="text-muted-foreground">{t("İçerik parçası")}</dt><dd className="mt-1 font-semibold tabular-nums">{number(report.totalChunks)}</dd></div><div><dt className="text-muted-foreground">{t("Ayrıştırılan karakter")}</dt><dd className="mt-1 font-semibold tabular-nums">{number(report.totalCharacters)}</dd></div></dl>
        {report.sources.map(source => <div key={source.id} className="min-w-0"><p className="break-all text-xs font-semibold"><bdi>{source.name}</bdi></p><dl className="mt-2 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-3">
          <div className="min-w-0"><dt className="text-muted-foreground">{t("İçerik türü")}</dt><dd className="mt-1 break-all"><bdi>{source.detectedMime}</bdi></dd></div>
          <div><dt className="text-muted-foreground">{t("İçerik parçası")}</dt><dd className="mt-1 tabular-nums">{number(source.chunkCount)}</dd></div>
          <div><dt className="text-muted-foreground">{t("Ayrıştırılan karakter")}</dt><dd className="mt-1 tabular-nums">{number(source.characterCount)}</dd></div>
        </dl></div>)}
        <p className="text-xs leading-6 text-muted-foreground">{t("Dosya imzası, içerik türü ve güvenli ayrıştırma sınırları backend tarafından doğrulandı.")}</p>
      </div>
    </details>
  </section>;
}
