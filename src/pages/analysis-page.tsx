import type { Analysis } from "../../functions/src/contracts";
import { AnalysisDeleteDialog } from "../components/analysis-delete-dialog";
import { useWorkspaceDeletion, type DeleteItem } from "../lib/workspace-deletion-context";
import { OperationStatus } from "../components/operation-status";
import { analysisDisplayStatus } from "../features/reports/analysis-status";
import { PageLoading } from "../components/page-loading";
import { t, useLocale } from "../i18n/runtime";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { Check, FilePlus2, TriangleAlert } from "lucide-react";
import { useWorkspace } from "../lib/workspace-context";
import { Link, useNavigate, useParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { Button } from "../components/ui/button";
import { PreparedDocuments } from "../components/prepared-documents";
import { useAnalysis } from "../hooks/use-analyses";
import { useDeadlineReached } from "../hooks/use-deadline-reached";
import { getServices } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { userError } from "../lib/errors";
import { tr } from "../i18n/tr";

const TabularAnalysisPanel = lazy(() => import("../features/reports/tabular-analysis-panel").then(module => ({ default: module.TabularAnalysisPanel })));

// Yerel işlem ve dialog durumunu hem oturum hem kayıt değişiminde yeni bir ekrana ayırır.
export function AnalysisPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  return <AnalysisScreen key={JSON.stringify([user?.uid, id])} id={id} />;
}

// İş durumunu ve doğrulanmış belge hazırlığını canlı izler; silme öncesi açık kullanıcı onayı ister.
function AnalysisScreen({ id }: { id: string }) {
  useLocale();
  const { analysis, loading, error } = useAnalysis(id);
  const workspace = useWorkspace();
  const context = useRef<typeof workspace | null>(workspace);
  const actionPending = useRef(false);
  useLayoutEffect(() => {
    context.current = workspace;
    return () => { context.current = null; };
  }, [workspace]);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const { progress, pendingIds, accountPending } = useWorkspaceDeletion();
  const deleting = pendingIds.has(id);
  // Ortak lease sinyali snapshot/sekme dönüşünde günceller; saat kopyası veya polling tutmaz.
  useDeadlineReached(analysis?.ai?.status === "running" ? analysis.ai.leaseUntil : undefined);
  const navigate = useNavigate();
  const [deleteSnapshot, setDeleteSnapshot] = useState<{ items: DeleteItem[]; analysis: Analysis } | null>(null);
  const visibleAnalysis = analysis ?? deleteSnapshot?.analysis;
  const deleteTarget = deleteSnapshot?.items ?? null;

  // Hazırlığı mevcut kayıt ve çalışma bağlamında yeniden çalıştırır.
  async function prepare(reviewToken?: string) {
    if (actionPending.current || deleting) return;
    actionPending.current = true;
    setBusy(true);
    setActionError("");
    try {
      const response = await httpsCallable<unknown, { needsReview?: boolean; ready?: boolean }>(getServices().functions, "prepareAnalysis", { timeout: 310_000 })({ id, ...(reviewToken ? { reviewToken } : {}) });
      if (!context.current) return;
      if (reviewToken && response.data.ready === true && context.current.activeId === id) context.current.completeDraft();
    } catch (actionFailure) {
      if (!context.current) return;
      setActionError(userError(actionFailure));
    } finally {
      actionPending.current = false;
      if (context.current) setBusy(false);
    }
  }

  // Silme penceresini Firestore kaydı erken kalksa bile sonuç gelene kadar açık tutar.
  const deletionDialog = (
    <AnalysisDeleteDialog
      idPrefix="analysis-delete"
      items={deleteTarget}
      description={tr.analysis.confirm}
      disabled={busy}
      onClose={() => setDeleteSnapshot(null)}
      onSuccess={() => {
        setDeleteSnapshot(null);
        if (context.current) navigate("/app/history", { replace: true });
      }}
    />
  );

  if (loading) return <>{deletionDialog}<PageLoading label="Analiz hazırlanıyor…" /></>;
  if (error || !visibleAnalysis) return <>{deletionDialog}<div><p role="alert">{t(error || "Analiz bulunamadı veya silindi.")}</p><Link className="underline" to="/app/history">{t("Geçmişe dön")}</Link></div></>;
  const report = visibleAnalysis.report;
  const tabular = (import.meta.env.VITE_TABULAR_ANALYSIS_ENABLED === "true" || Boolean(visibleAnalysis.ai))
    && report?.sources.some(source => /\.(csv|xlsx)$/i.test(source.name));
  const status = analysisDisplayStatus(visibleAnalysis).label;

  return <section aria-labelledby="report-title">
    <Link to="/app/history" className="text-sm text-primary underline dark:text-secondary">{t("← Geçmiş analizler")}</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">{visibleAnalysis.business}</p><h1 id="report-title" className="mt-1 break-words text-3xl font-semibold">{visibleAnalysis.title}</h1></div><span role="status" className="rounded-full border border-border bg-card px-4 py-2 text-sm">{t(status)}</span></div>
    {visibleAnalysis.objective && <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="saved-objective-title"><h2 id="saved-objective-title" className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-secondary">{t("Analiz hedefi")}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{visibleAnalysis.objective}</p></section>}
    {visibleAnalysis.status === "completed" && !tabular && <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm dark:border-secondary/20">{t(tr.analysis.disclaimer)}</p>}
    {(visibleAnalysis.error || actionError) && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{t(actionError || visibleAnalysis.error)}</p>}
    {visibleAnalysis.status === "uploading" && <p className="mt-5 text-sm">{t("Yükleme tamamlanmadıysa Yeni analiz sayfasından aynı belgelerle devam edin.")}</p>}
    {(busy || visibleAnalysis.status === "processing") && <div className="mt-5"><OperationStatus>{t("Belgelerin içeriği ayrıştırılıyor; sayfadan ayrılabilirsiniz. Beş dakikadan uzun sürerse yeniden denemek güvenlidir.")}</OperationStatus></div>}
    {visibleAnalysis.status === "deleting" && !deleting && !deleteTarget && <div className="mt-5"><OperationStatus>{t("Analiz siliniyor…")}</OperationStatus></div>}
    {visibleAnalysis.status === "review" && visibleAnalysis.preparationReview && <section className="surface mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="preparation-review-title">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><TriangleAlert className="h-5 w-5" aria-hidden="true" /></span>
      <h2 id="preparation-review-title" className="mt-4 text-xl font-semibold tracking-tight">{t("Belgeleri gözden geçirin")}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("Bazı belgeler hazırlanamadı. Hazır belgelerle devam edebilir veya dosyalarınızı düzenleyebilirsiniz. Henüz analiz hakkınız kullanılmadı.")}</p>
      <ul className="mt-5 divide-y divide-border rounded-2xl border border-border" aria-label={t("Belge kontrolü")}>
        {visibleAnalysis.preparationReview.ready.map(source => <li key={source.id} className="flex min-w-0 items-center gap-3 px-4 py-3 text-sm"><Check className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /><span className="min-w-0 break-all">{source.name}</span><span className="ms-auto shrink-0 text-xs text-muted-foreground">{t("Hazır")}</span></li>)}
        {visibleAnalysis.preparationReview.rejected.map(source => <li key={source.id} className="flex min-w-0 gap-3 px-4 py-3 text-sm"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" /><div className="min-w-0"><p className="break-all font-medium">{source.name}</p><p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{t(source.reason)}</p></div></li>)}
      </ul>
      <div className="mt-5 flex flex-wrap gap-3"><Button disabled={busy || deleting} className="h-auto min-h-11 whitespace-normal text-start" onClick={() => prepare(visibleAnalysis.preparationReview!.token)}>{busy ? t("Belgeler hazırlanıyor…") : t("Yalnız {0} belgeyle devam et", visibleAnalysis.preparationReview.ready.length)}</Button><Button asChild variant="outline"><Link to="/app/new-analysis">{t("Dosyaları düzenle")}</Link></Button></div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("Devam ettiğinizde hazırlanabilen belgeler kullanılır; dışarıda kalanlar sonuçta belirtilir.")}</p>
    </section>}
    {visibleAnalysis.status === "failed" && !!visibleAnalysis.preparationFailures?.length && <ul className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-5 text-sm" aria-label={t("Hazırlanamayan belgeler")}>{visibleAnalysis.preparationFailures.map(source => <li key={source.id}><p className="break-all font-medium">{source.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t(source.reason)}</p></li>)}</ul>}
    {visibleAnalysis.status === "completed" && report && <>
      {tabular ? <><Suspense fallback={<PageLoading label="Analiz yükleniyor…" />}><TabularAnalysisPanel key={id} analysis={visibleAnalysis} /></Suspense><details className="mt-6 rounded-2xl border border-border bg-card p-5"><summary className="w-fit cursor-pointer rounded text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("Hazırlanan belgeler")}</summary><PreparedDocuments report={report} /></details></> : <PreparedDocuments key={id} report={report} />}
      {!!report.excludedSources?.length && <details className="mt-5 rounded-2xl border border-border bg-card p-5"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("Kapsam dışında kalan {0} belge", report.excludedSources.length)}</summary><ul className="mt-4 space-y-3 text-xs leading-6 text-muted-foreground">{report.excludedSources.map(source => <li key={source.id}><span className="break-all font-medium text-foreground">{source.name}</span> — {t(source.reason)}</li>)}</ul></details>}
    </>}
    <div className="mt-6 flex flex-wrap gap-3">
      <Button asChild><Link className="gap-2" to="/app/new-analysis"><FilePlus2 className="h-4 w-4" aria-hidden="true" />  {t("Yeni analiz oluştur")}</Link></Button>
      {["failed", "processing"].includes(visibleAnalysis.status) && <Button disabled={busy || deleting} onClick={() => prepare()}>{busy ? t("Belgeler hazırlanıyor…") : t(tr.analysis.retry)}</Button>}
      <Button variant="outline" disabled={busy || accountPending || progress !== null || deleteTarget !== null || visibleAnalysis.status === "deleting"} onClick={() => setDeleteSnapshot({ items: [{ id, title: visibleAnalysis.title }], analysis: visibleAnalysis })}>{deleting ? t("Analiz siliniyor…") : t(tr.analysis.delete)}</Button>
    </div>
    {deletionDialog}
  </section>;
}
