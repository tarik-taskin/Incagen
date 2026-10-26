import { Check, FileCheck2, LoaderCircle, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { t, useLocale, localeTag } from "../../i18n/runtime";
import { useWorkspace } from "../../lib/workspace-context";

// İşlem aşamasını gerçek olaylardan gösterir; yalnız dosya aktarımı ölçülebilir yüzde taşır.
export function PreparationProgress({ compact = false }: { compact?: boolean }) {
  useLocale();
  const { busy, phase, progress, uploadingFile, activeId } = useWorkspace();
  if (!busy) return null;
  const preparing = phase === "preparing";
  const uploading = phase === "uploading";
  const title = preparing ? "Belgeler hazırlanıyor" : uploading ? "Dosyalar yükleniyor" : "Çalışma oluşturuluyor";
  const Icon = preparing ? FileCheck2 : uploading ? Upload : LoaderCircle;
  return <section aria-label={t("Belge hazırlama durumu")} className={`${compact ? "mb-5" : "mt-5"} rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 dark:border-secondary/20 dark:bg-secondary/[0.04]`}>
    <div role="status" aria-live="polite" aria-atomic="true" className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary dark:text-secondary"><Icon className={`h-4 w-4 ${phase === "creating" ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t(title)}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{preparing ? t("Yükleme tamamlandı. Belgelerin içeriği ve kaynakları kontrol ediliyor.") : uploadingFile ? <><bdi className="break-all">{uploadingFile.name}</bdi> · {t("Dosya {0}/{1}", uploadingFile.index, uploadingFile.total)}</> : t("Belgeleriniz için güvenli çalışma kaydı açılıyor.")}</p>
      </div>
      {uploading && <span aria-hidden="true" className="shrink-0 text-sm font-semibold tabular-nums text-primary dark:text-secondary">{new Intl.NumberFormat(localeTag(), { style: "percent", maximumFractionDigits: 0 }).format(progress / 100)}</span>}
    </div>
    {uploading && <progress aria-label={t("Yükleme ilerlemesi")} className="mt-3 h-1.5 w-full overflow-hidden rounded-full accent-primary dark:accent-secondary" value={progress} max={100} />}
    {!compact && <ol aria-label={t("Hazırlama aşamaları")} className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-[11px] leading-5">
      {["Yükleme", "Hazırlama", "Hazır"].map((step, index) => <li key={step} aria-current={index === (preparing ? 1 : 0) ? "step" : undefined} className={`flex items-center gap-1.5 ${index <= (preparing ? 1 : 0) ? "font-medium text-primary dark:text-secondary" : "text-muted-foreground"}`}>
        {preparing && index === 0 ? <Check className="h-3 w-3 shrink-0" aria-hidden="true" /> : <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${index === (preparing ? 1 : 0) ? "bg-current" : "bg-muted-foreground/30"}`} />}{t(step)}
      </li>)}
    </ol>}
    {compact && phase !== "creating" && activeId && <Link className="mt-2 inline-flex min-h-9 items-center rounded-lg px-1 text-xs font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary" to={"/app/analyses/" + activeId}>{t("İşlemi izle")}</Link>}
  </section>;
}
