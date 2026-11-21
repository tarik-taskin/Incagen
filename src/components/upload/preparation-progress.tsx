import { AlertTriangle, Check, CheckCircle2, LoaderCircle, Upload, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { t, useLocale, localeTag } from "../../i18n/runtime";
import { useWorkspace } from "../../lib/workspace-context";
import { Button } from "../ui/button";

// İşlem aşamasını ve başka ekrana geçen kullanıcı için biten işin gerçek sonucunu tek yerde gösterir.
export function PreparationProgress({ compact = false }: { compact?: boolean }) {
  useLocale();
  const location = useLocation();
  const { busy, phase, progress, uploadingFile, activeId, outcome, dismissOutcome } = useWorkspace();

  if (busy) {
    const preparing = phase === "preparing";
    const uploading = phase === "uploading";
    const title = preparing ? "Belgeler hazırlanıyor" : uploading ? "Dosyalar yükleniyor" : "Çalışma oluşturuluyor";
    const Icon = uploading ? Upload : LoaderCircle;
    return <section aria-label={t("Belge hazırlama durumu")} className={`${compact ? "mb-5" : "mt-5"} rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 dark:border-secondary/20 dark:bg-secondary/[0.04]`}>
      <div role="status" aria-live="polite" aria-atomic="true" className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary dark:text-secondary"><Icon className={`h-4 w-4 ${!uploading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t(title)}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{preparing ? t("Yükleme tamamlandı. Belgelerin içeriği ve kaynakları kontrol ediliyor.") + " " + t("Bu sırada çalışma alanında gezinebilirsiniz.") : uploadingFile ? <><bdi className="break-all">{uploadingFile.name}</bdi> · {t("Dosya {0}/{1}", uploadingFile.index, uploadingFile.total)}</> : t("Belgeleriniz için güvenli çalışma kaydı açılıyor.")}</p>
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

  if (!outcome) return null;
  // Kullanıcı zaten ilgili kaydın sayfasındaysa veya Yeni analiz hata uyarısını gösteriyorsa çift duyuru yapmaz.
  if ((outcome.kind === "ready" || outcome.kind === "review") && location.pathname === `/app/analyses/${outcome.id}`) return null;
  if (!compact && (outcome.kind === "failed" || outcome.kind === "cancelled")) return null;

  const isReady = outcome.kind === "ready";
  const isReview = outcome.kind === "review";
  const isError = outcome.kind === "failed" || outcome.kind === "cancelled";
  const Icon = isReady ? CheckCircle2 : AlertTriangle;

  const heading = isReady
    ? "Belgeleriniz hazır"
    : isReview
      ? "Bazı belgeler inceleme bekliyor"
      : outcome.kind === "cancelled"
        ? "Hazırlama durduruldu"
        : "Belgeler hazırlanamadı";

  const detail = isReady
    ? t("Hazırlık özeti oluşturuldu. İsterseniz şimdi inceleyebilirsiniz.")
    : isReview
      ? t("Bazı dosyalar hazırlanamadı; hazır olanlarla devam etmek için açık onayınız gerekir.")
      : t(outcome.message);

  const actionPath = isReady || isReview ? `/app/analyses/${outcome.id}` : "/app/new-analysis";
  const actionLabel = isReady ? "Hazırlık özetini aç" : isReview ? "İncelemeyi aç" : "Yeni analize dön";

  return (
    <section
      aria-label={t("Belge hazırlama durumu")}
      className={`${compact ? "mb-5" : "mt-5"} rounded-2xl border p-4 ${
        isError
          ? "border-red-500/25 bg-red-500/[0.04]"
          : isReview
            ? "border-amber-500/25 bg-amber-500/[0.05]"
            : "border-emerald-500/25 bg-emerald-500/[0.05]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card ${
            isError
              ? "text-red-700 dark:text-red-300"
              : isReview
                ? "text-amber-700 dark:text-amber-300"
                : "text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div role={outcome.kind === "failed" ? "alert" : "status"} aria-live={outcome.kind === "failed" ? "assertive" : "polite"} aria-atomic="true" className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t(heading)}</p>
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("Kapat")}
          onClick={dismissOutcome}
          className="h-8 w-8 shrink-0 rounded-lg"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-2 ps-12">
        <Link
          to={actionPath}
          onClick={dismissOutcome}
          className="inline-flex min-h-9 items-center rounded-lg px-1 text-xs font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary"
        >
          {t(actionLabel)}
        </Link>
      </div>
    </section>
  );
}
