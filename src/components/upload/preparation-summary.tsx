import { t, useLocale } from "../../i18n/runtime";
import { Check, Files, HardDrive, Target } from "lucide-react";
import { LIMITS } from "../../../functions/src/contracts";
import { formatCapacity, type getPreparationState, type DraftField } from "../../features/files/preparation-state";

type PreparationState = ReturnType<typeof getPreparationState>;

// Seçim kapasitesini okunabilir değerler ve erişilebilir ilerleme göstergesiyle sunar.
export function SelectionSummary({ count, state }: { count: number; state: PreparationState }) {
  useLocale();
  return <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm" aria-labelledby="selection-summary-title">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
      <h2 id="selection-summary-title" className="flex items-center gap-2 text-sm font-semibold"><Files className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" />  {t("Belge kapasitesi")}</h2>
      <span className="rounded-full border border-primary/15 bg-primary/[0.05] px-3 py-1 text-xs font-medium text-primary dark:border-secondary/20 dark:text-secondary">{!state.remainingBytes ? t("Boyut sınırına ulaştınız") : state.remainingFiles ? t("{0} belge daha ekleyebilirsiniz", state.remainingFiles) : t("Belge sayısı sınırına ulaştınız")}</span>
    </div>
    <dl className="grid grid-cols-3 gap-3 px-5 py-5 sm:gap-6 sm:px-6">
      <div><dt className="text-xs text-muted-foreground">{t("Seçilen belge")}</dt><dd className="mt-2 text-xl font-semibold tabular-nums sm:text-2xl">{count}<span className="ms-1 text-sm font-normal text-muted-foreground">/ {LIMITS.files}</span></dd></div>
      <div><dt className="text-xs text-muted-foreground">{t("Toplam boyut")}</dt><dd className="mt-2 break-words text-lg font-semibold tabular-nums sm:text-2xl">{formatCapacity(state.totalBytes)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t("Kalan alan")}</dt><dd className="mt-2 break-words text-lg font-semibold tabular-nums sm:text-2xl">{formatCapacity(state.remainingBytes)}</dd></div>
    </dl>
    <div className="px-5 pb-5 sm:px-6">
      <progress className="block h-2 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary dark:[&::-webkit-progress-value]:bg-secondary dark:[&::-moz-progress-bar]:bg-secondary" aria-label={t("Belge boyutu kapasitesi")} aria-valuetext={t("{0} kullanıldı; {1} kaldı", formatCapacity(state.totalBytes), formatCapacity(state.remainingBytes))} value={Math.min(state.totalBytes, LIMITS.totalBytes)} max={LIMITS.totalBytes} />
      <p className="mt-2 flex items-center gap-1.5 text-xs leading-5 text-muted-foreground"><HardDrive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />  {t("Bir çalışma için toplam")} {formatCapacity(LIMITS.totalBytes)}  {t("alan.")}</p>
    </div>
  </section>;
}

// Hazırlanmış ve eksik çalışma alanlarını gösterir; eksik alana doğrudan klavye odağı sağlar.
export function DraftReadiness({ state, busy, onFocusField }: { state: PreparationState; busy: boolean; onFocusField: (field: DraftField) => void }) {
  useLocale();
  return <section className="mt-5 rounded-2xl border border-border/80 bg-muted/25 p-3.5" aria-labelledby="draft-readiness-title">
    <h3 id="draft-readiness-title" className="flex items-center gap-2 text-xs font-semibold"><Target className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" />  {t("Hazırlık kontrolü")}</h3>
    <ul className="mt-3 space-y-2 text-xs">{state.fields.map(item => <li key={item.field} className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2"><span className={item.valid ? "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-secondary/15 dark:text-secondary" : "h-4 w-4 shrink-0 rounded-full border border-border"} aria-hidden="true">{item.valid && <Check className="h-3 w-3" />}</span>{t(item.label)}</span>
      {item.valid ? <span className="text-muted-foreground">{t("Hazır")}</span> : <button type="button" disabled={busy} className="min-h-8 rounded-lg px-2 font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 dark:text-secondary dark:focus-visible:ring-secondary" aria-label={t("{0} alanını tamamla", t(item.label))} onClick={() => onFocusField(item.field)}>{t("Tamamla")}</button>}
    </li>)}</ul>
    <p id="preparation-help" className="mt-3 border-t border-border/70 pt-3 text-xs leading-5 text-muted-foreground" aria-live="polite">{busy ? t("Belgeleriniz hazırlanıyor; çalışma ayrıntıları korunuyor.") : state.ready ? t("Belgeleriniz ve çalışma ayrıntılarınız hazırlamaya hazır.") : !state.withinCapacity ? t("Seçiminizi belge ve toplam boyut sınırlarına göre düzenleyin.") : state.firstInvalidField ? t("Başlamadan önce çalışma ayrıntılarını tamamlayın.") : t("Çalışma ayrıntıları hazır. Başlamak için belgelerinizi ekleyin.")}</p>
  </section>;
}
