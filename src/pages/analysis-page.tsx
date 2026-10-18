import { useOutsideDismiss } from "../hooks/use-outside-dismiss";
import { PageLoading } from "../components/page-loading";
import { t, useLocale, localeTag } from "../i18n/runtime";
import { useEffect, useRef, useState } from "react";
import { Check, FileCheck2, FilePlus2, Files, HardDrive, Sparkles, TriangleAlert } from "lucide-react";
import { useWorkspace } from "../lib/workspace-context";
import { Link, useNavigate, useParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { Button } from "../components/ui/button";
import { formatFileSize } from "../features/files/file-rules";
import { PLAN_RULES } from "../features/plans/plan-rules";
import { useAnalysis } from "../hooks/use-analyses";
import { getServices } from "../lib/firebase";
import { userError } from "../lib/errors";
import { tr } from "../i18n/tr";

// İş durumunu ve doğrulanmış belge hazırlığını canlı izler; silme öncesi açık kullanıcı onayı ister.
export function AnalysisPage() {
  useLocale();
  const { id = "" } = useParams();
  const { analysis, loading, error } = useAnalysis(id);
  const workspace = useWorkspace();
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useOutsideDismiss(deleteDialog, () => setDeleteOpen(false), deleteOpen && !busy);
  useEffect(() => {
    const dialog = deleteDialog.current;
    if (deleteOpen && !dialog?.open) dialog?.showModal();
    else if (!deleteOpen && dialog?.open) dialog.close();
  }, [deleteOpen]);

  // Başarısız hazırlığı yeniden çalıştırır veya kullanıcı onayıyla analiz kaynaklarını siler.
  async function action(name: "prepareAnalysis" | "deleteAnalysis", reviewToken?: string) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await httpsCallable<unknown, { needsReview?: boolean; ready?: boolean }>(getServices().functions, name, { timeout: 310_000 })({ id, ...(reviewToken ? { reviewToken } : {}) });
      if (name === "prepareAnalysis" && reviewToken && response.data.ready === true && workspace.activeId === id) workspace.completeDraft();
      if (name === "deleteAnalysis") navigate("/app/history", { replace: true });
    } catch (actionFailure) {
      setDeleteOpen(false);
      setActionError(userError(actionFailure));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoading label="Analiz hazırlanıyor…" />;
  if (error || !analysis) return <div><p role="alert">{t(error || "Analiz bulunamadı veya silindi.")}</p><Link className="underline" to="/app/history">{t("Geçmişe dön")}</Link></div>;
  const report = analysis.report;

  return <section aria-labelledby="report-title">
    <Link to="/app/history" className="text-sm text-primary underline dark:text-secondary">{t("← Geçmiş analizler")}</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">{analysis.business}</p><h1 id="report-title" className="mt-1 break-words text-3xl font-semibold">{analysis.title}</h1></div><span role="status" className="rounded-full border border-border bg-card px-4 py-2 text-sm">{t(tr.status[analysis.status])}</span></div>
    {analysis.objective && <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="saved-objective-title"><h2 id="saved-objective-title" className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-secondary">{t("Analiz hedefi")}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{analysis.objective}</p></section>}
    {analysis.status === "completed" && <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm dark:border-secondary/20">{t(tr.analysis.disclaimer)}</p>}
    {(analysis.error || actionError) && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{t(actionError || analysis.error)}</p>}
    {analysis.status === "uploading" && <p className="mt-5 text-sm">{t("Yükleme tamamlanmadıysa Yeni analiz sayfasından aynı belgelerle devam edin.")}</p>}
    {analysis.status === "processing" && <p className="mt-5 text-sm">{t("Belgelerin içeriği ayrıştırılıyor; sayfadan ayrılabilirsiniz. Beş dakikadan uzun sürerse yeniden denemek güvenlidir.")}</p>}
    {analysis.status === "review" && analysis.preparationReview && <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="preparation-review-title">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><TriangleAlert className="h-5 w-5" aria-hidden="true" /></span>
      <h2 id="preparation-review-title" className="mt-4 text-xl font-semibold tracking-tight">{t("Belgeleri gözden geçirin")}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("Bazı belgeler hazırlanamadı. Hazır belgelerle devam edebilir veya dosyalarınızı düzenleyebilirsiniz. Henüz analiz hakkınız kullanılmadı.")}</p>
      <ul className="mt-5 divide-y divide-border rounded-2xl border border-border" aria-label={t("Belge kontrolü")}>
        {analysis.preparationReview.ready.map(source => <li key={source.id} className="flex min-w-0 items-center gap-3 px-4 py-3 text-sm"><Check className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /><span className="min-w-0 break-all">{source.name}</span><span className="ms-auto shrink-0 text-xs text-muted-foreground">{t("Hazır")}</span></li>)}
        {analysis.preparationReview.rejected.map(source => <li key={source.id} className="flex min-w-0 gap-3 px-4 py-3 text-sm"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" /><div className="min-w-0"><p className="break-all font-medium">{source.name}</p><p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{t(source.reason)}</p></div></li>)}
      </ul>
      <div className="mt-5 flex flex-wrap gap-3"><Button disabled={busy} className="h-auto min-h-11 whitespace-normal text-start" onClick={() => action("prepareAnalysis", analysis.preparationReview!.token)}>{busy ? t("Belgeler hazırlanıyor…") : t("Yalnız {0} belgeyle devam et", analysis.preparationReview.ready.length)}</Button><Button asChild variant="outline"><Link to="/app/new-analysis">{t("Dosyaları düzenle")}</Link></Button></div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("Devam ettiğinizde hazırlanabilen belgeler kullanılır; dışarıda kalanlar sonuçta belirtilir.")}</p>
    </section>}
    {analysis.status === "failed" && !!analysis.preparationFailures?.length && <ul className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-5 text-sm" aria-label={t("Hazırlanamayan belgeler")}>{analysis.preparationFailures.map(source => <li key={source.id}><p className="break-all font-medium">{source.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t(source.reason)}</p></li>)}</ul>}
    {analysis.status === "completed" && report && <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5"><Files className="h-5 w-5 text-primary dark:text-secondary" aria-hidden="true" /><p className="mt-3 text-sm text-muted-foreground">{t("Hazırlanan belge")}</p><p className="mt-2 text-2xl font-semibold">{report.fileCount.toLocaleString(localeTag())}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><HardDrive className="h-5 w-5 text-primary dark:text-secondary" aria-hidden="true" /><p className="mt-3 text-sm text-muted-foreground">{t("Toplam kaynak boyutu")}</p><p className="mt-2 text-2xl font-semibold">{formatFileSize(report.totalBytes)}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><FileCheck2 className="h-5 w-5 text-primary dark:text-secondary" aria-hidden="true" /><p className="mt-3 text-sm text-muted-foreground">{t("İçerik parçası")}</p><p className="mt-2 text-2xl font-semibold">{report.totalChunks.toLocaleString(localeTag())}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><FileCheck2 className="h-5 w-5 text-primary dark:text-secondary" aria-hidden="true" /><p className="mt-3 text-sm text-muted-foreground">{t("Ayrıştırılan karakter")}</p><p className="mt-2 text-2xl font-semibold">{report.totalCharacters.toLocaleString(localeTag())}</p></div>
      </div>
      <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6" aria-labelledby="prepared-sources-title">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><FileCheck2 className="h-5 w-5" aria-hidden="true" /></span><div><h2 id="prepared-sources-title" className="font-semibold">{t("Belgelerin içeriği ayrıştırıldı")}</h2><p className="text-sm text-muted-foreground">{t("Dosya imzası, içerik türü ve güvenli ayrıştırma sınırları backend tarafından doğrulandı.")}</p></div></div>
        <ul className="mt-5 divide-y divide-border/70 rounded-2xl border border-border/70" aria-label={t("Hazırlanan belgeler")}>{report.sources.map(source => <li key={source.id} className="px-4 py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="break-all font-medium">{source.name}</span><span className="text-xs text-muted-foreground">{t(source.category)} · {formatFileSize(source.size)} · {source.detectedMime}</span></div><p className="mt-1 text-xs text-muted-foreground">{source.chunkCount.toLocaleString(localeTag())}  {t("parça ·")} {source.characterCount.toLocaleString(localeTag())}  {t("karakter")}{source.metadata.pages ? t(" · {0} sayfa", source.metadata.pages) : ""}{source.metadata.sheets ? t(" · {0} çalışma sayfası", source.metadata.sheets) : ""}{source.metadata.slides ? t(" · {0} slayt", source.metadata.slides) : ""}{source.metadata.width && source.metadata.height ? t(" · {0}×{1}px", source.metadata.width, source.metadata.height) : ""}</p>{source.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-amber-700 dark:text-amber-300">{source.warnings.map((warning, index) => <li key={`${source.id}-warning-${index}`}>{t(warning)}</li>)}</ul>}</li>)}</ul>
      </section>
      {!!report.excludedSources?.length && <details className="mt-5 rounded-2xl border border-border bg-card p-5"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("Kapsam dışında kalan {0} belge", report.excludedSources.length)}</summary><ul className="mt-4 space-y-3 text-xs leading-6 text-muted-foreground">{report.excludedSources.map(source => <li key={source.id}><span className="break-all font-medium text-foreground">{source.name}</span> — {t(source.reason)}</li>)}</ul></details>}
      <section className="mt-6 rounded-3xl border border-primary/15 bg-primary/[0.05] p-5 dark:border-secondary/15 dark:bg-secondary/[0.05]" aria-labelledby="next-step-title">
        <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-secondary" aria-hidden="true" /><div><h2 id="next-step-title" className="font-semibold">{t("Sonraki analiz katmanı")}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("AI yorumları ve {0} bağlantıları henüz etkin değil.", PLAN_RULES.premium.externalSources)}</p></div></div>
      </section>
    </>}
    <div className="mt-6 flex flex-wrap gap-3">
      <Button asChild><Link className="gap-2" to="/app/new-analysis"><FilePlus2 className="h-4 w-4" aria-hidden="true" />  {t("Yeni analiz oluştur")}</Link></Button>
      {["failed", "processing"].includes(analysis.status) && <Button disabled={busy} onClick={() => action("prepareAnalysis")}>{t(tr.analysis.retry)}</Button>}
      <Button variant="outline" disabled={busy} onClick={() => setDeleteOpen(true)}>{t(tr.analysis.delete)}</Button>
    </div>
    <dialog ref={deleteDialog} role="alertdialog" aria-labelledby="analysis-delete-title" aria-describedby="analysis-delete-description" onCancel={event => { if (busy) event.preventDefault(); else setDeleteOpen(false); }} onClose={() => { if (!busy) setDeleteOpen(false); }} className="w-[min(92vw,30rem)] max-w-none rounded-3xl border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm sm:p-7">
      <h2 id="analysis-delete-title" className="text-xl font-semibold">{t("Bu analizi silmek istiyor musunuz?")}</h2>
      <p id="analysis-delete-description" className="mt-3 text-sm leading-6 text-muted-foreground">{t(tr.analysis.confirm)}</p>
      <p className="mt-4 break-words rounded-xl bg-muted px-4 py-3 text-sm font-medium">{analysis.title}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button autoFocus variant="outline" disabled={busy} onClick={() => setDeleteOpen(false)}>{t("Vazgeç")}</Button><Button disabled={busy} onClick={() => action("deleteAnalysis")} className="bg-red-700 text-white hover:bg-red-800">{busy ? t("Siliniyor: {0}/{1}", 0, 1) : t("Analizi sil")}</Button></div>
    </dialog>
  </section>;
}
