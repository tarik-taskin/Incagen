import { useState } from "react";
import { FileCheck2, Files, HardDrive, Sparkles } from "lucide-react";
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
  const { id = "" } = useParams();
  const { analysis, loading, error } = useAnalysis(id);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Başarısız hazırlığı yeniden çalıştırır veya kullanıcı onayıyla analiz kaynaklarını siler.
  async function action(name: "prepareAnalysis" | "deleteAnalysis") {
    if (name === "deleteAnalysis" && !window.confirm(tr.analysis.confirm)) return;
    setBusy(true);
    setActionError("");
    try {
      await httpsCallable(getServices().functions, name, { timeout: 310_000 })({ id });
      if (name === "deleteAnalysis") navigate("/app/history", { replace: true });
    } catch (actionFailure) {
      setActionError(userError(actionFailure));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Analiz hazırlanıyor…</p>;
  if (error || !analysis) return <div><p role="alert">{error || "Analiz bulunamadı veya silindi."}</p><Link className="underline" to="/app/history">Geçmişe dön</Link></div>;
  const report = analysis.report;

  return <section aria-labelledby="report-title">
    <Link to="/app/history" className="text-sm text-primary underline dark:text-secondary">← Geçmiş analizler</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">{analysis.business}</p><h1 id="report-title" className="mt-1 break-words text-3xl font-semibold">{analysis.title}</h1></div><span role="status" className="rounded-full border border-border bg-card px-4 py-2 text-sm">{tr.status[analysis.status]}</span></div>
    <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm dark:border-secondary/20">{tr.analysis.disclaimer}</p>
    {(analysis.error || actionError) && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{actionError || analysis.error}</p>}
    {analysis.status === "uploading" && <p className="mt-5 text-sm">Yükleme tamamlanmadıysa Yeni analiz sayfasından aynı belgelerle devam edin.</p>}
    {analysis.status === "processing" && <p className="mt-5 text-sm">Belgelerin içeriği ayrıştırılıyor; sayfadan ayrılabilirsiniz. Beş dakikadan uzun sürerse yeniden denemek güvenlidir.</p>}
    {analysis.status === "completed" && report && <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5"><Files className="h-5 w-5 text-primary dark:text-secondary" aria-hidden="true" /><p className="mt-3 text-sm text-muted-foreground">Hazırlanan belge</p><p className="mt-2 text-2xl font-semibold">{report.fileCount.toLocaleString("tr-TR")}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><HardDrive className="h-5 w-5 text-primary dark:text-secondary" aria-hidden="true" /><p className="mt-3 text-sm text-muted-foreground">Toplam kaynak boyutu</p><p className="mt-2 text-2xl font-semibold">{formatFileSize(report.totalBytes)}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><FileCheck2 className="h-5 w-5 text-primary dark:text-secondary" aria-hidden="true" /><p className="mt-3 text-sm text-muted-foreground">İçerik parçası</p><p className="mt-2 text-2xl font-semibold">{report.totalChunks.toLocaleString("tr-TR")}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><FileCheck2 className="h-5 w-5 text-primary dark:text-secondary" aria-hidden="true" /><p className="mt-3 text-sm text-muted-foreground">Ayrıştırılan karakter</p><p className="mt-2 text-2xl font-semibold">{report.totalCharacters.toLocaleString("tr-TR")}</p></div>
      </div>
      <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6" aria-labelledby="prepared-sources-title">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><FileCheck2 className="h-5 w-5" aria-hidden="true" /></span><div><h2 id="prepared-sources-title" className="font-semibold">Belgelerin içeriği ayrıştırıldı</h2><p className="text-sm text-muted-foreground">Dosya imzası, içerik türü ve güvenli ayrıştırma sınırları backend tarafından doğrulandı.</p></div></div>
        <ul className="mt-5 divide-y divide-border/70 rounded-2xl border border-border/70" aria-label="Hazırlanan belgeler">{report.sources.map(source => <li key={source.id} className="px-4 py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="break-all font-medium">{source.name}</span><span className="text-xs text-muted-foreground">{source.category} · {formatFileSize(source.size)} · {source.detectedMime}</span></div><p className="mt-1 text-xs text-muted-foreground">{source.chunkCount.toLocaleString("tr-TR")} parça · {source.characterCount.toLocaleString("tr-TR")} karakter{source.metadata.pages ? ` · ${source.metadata.pages} sayfa` : ""}{source.metadata.sheets ? ` · ${source.metadata.sheets} çalışma sayfası` : ""}{source.metadata.slides ? ` · ${source.metadata.slides} slayt` : ""}{source.metadata.width && source.metadata.height ? ` · ${source.metadata.width}×${source.metadata.height}px` : ""}</p>{source.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-300">{source.warnings.map((warning, index) => <li key={`${source.id}-warning-${index}`}>{warning}</li>)}</ul>}</li>)}</ul>
      </section>
      <section className="mt-6 rounded-3xl border border-primary/15 bg-primary/[0.05] p-5 dark:border-secondary/15 dark:bg-secondary/[0.05]" aria-labelledby="next-step-title">
        <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-secondary" aria-hidden="true" /><div><h2 id="next-step-title" className="font-semibold">Sonraki analiz katmanı</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">AI yorumları henüz bağlı değil. Premium plan için planlanan kaynak bağlantıları: {PLAN_RULES.premium.externalSources}.</p></div></div>
      </section>
    </>}
    <div className="mt-6 flex flex-wrap gap-3">
      {["failed", "processing"].includes(analysis.status) && <Button disabled={busy} onClick={() => action("prepareAnalysis")}>{tr.analysis.retry}</Button>}
      <Button variant="outline" disabled={busy} onClick={() => action("deleteAnalysis")}>{tr.analysis.delete}</Button>
    </div>
  </section>;
}
