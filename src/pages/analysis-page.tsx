import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { Button } from "../components/ui/button";
import { ReportCharts } from "../components/report-charts";
import { useAnalysis } from "../hooks/use-analyses";
import { getServices } from "../lib/firebase";
import { userError } from "../lib/errors";
import { tr } from "../i18n/tr";

// İş durumunu ve doğrulanmış raporu canlı izler; silme öncesi açık kullanıcı onayı ister.
export function AnalysisPage() {
  const { id = "" } = useParams();
  const { analysis, loading, error } = useAnalysis(id);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function action(name: "runAnalysis" | "deleteAnalysis") {
    if (name === "deleteAnalysis" && !window.confirm(tr.analysis.confirm)) return;
    setBusy(true); setActionError("");
    try {
      await httpsCallable(getServices().functions, name, { timeout: 130_000 })({ id });
      if (name === "deleteAnalysis") navigate("/app/history", { replace: true });
    } catch (e) { setActionError(userError(e)); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Rapor yükleniyor…</p>;
  if (error || !analysis) return <div><p role="alert">{error || "Analiz bulunamadı veya silindi."}</p><Link className="underline" to="/app/history">Geçmişe dön</Link></div>;
  const report = analysis.report;
  const money = (cents: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: analysis.currency }).format(cents / 100);
  return <section aria-labelledby="report-title">
    <Link to="/app/history" className="text-sm text-primary underline dark:text-secondary">← Geçmiş analizler</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">{analysis.business}</p><h1 id="report-title" className="mt-1 break-words text-3xl font-semibold">{analysis.title}</h1></div><span role="status" className="rounded-full border border-border bg-card px-4 py-2 text-sm">{tr.status[analysis.status]}</span></div>
    <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm dark:border-secondary/20">{tr.analysis.disclaimer}</p>
    {(analysis.error || actionError) && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{actionError || analysis.error}</p>}
    {analysis.status === "uploading" && <p className="mt-5 text-sm">Yükleme tamamlanmadıysa Yeni analiz sayfasından aynı dosyalarla devam edin.</p>}
    {analysis.status === "processing" && <p className="mt-5 text-sm">İşlem arka planda sürüyor; sayfadan ayrılabilirsiniz. İki buçuk dakikadan uzun sürerse yeniden denemek güvenlidir.</p>}
    {analysis.status === "completed" && report && <>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">{[[tr.analysis.total, money(report.totalCents)], [tr.analysis.rows, report.rowCount.toLocaleString("tr-TR")], [tr.analysis.average, money(report.averageCents)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 break-words text-2xl font-semibold">{value}</p></div>)}</div>
      <ReportCharts report={report} currency={analysis.currency} />
      <section className="mt-6 rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Kaynaklar ve veri kalitesi</h2><p className="mt-2 text-sm text-muted-foreground">Hatalı dolu satırlar atlanmaz. Ortalama, sipariş/sepet ortalaması değil satır başına tutardır. Kategoriler ilk 20 ve diğerleri olarak gösterilir.</p><ul className="mt-4 space-y-2 text-sm">{report.sources.map((s, i) => <li key={i} className="break-words">{s.name}: {s.rows} veri satırı, {s.blankRows} boş satır atlandı.</li>)}</ul></section>
    </>}
    <div className="mt-6 flex flex-wrap gap-3">
      {["failed", "processing"].includes(analysis.status) && <Button disabled={busy} onClick={() => action("runAnalysis")}>{tr.analysis.retry}</Button>}
      <Button variant="outline" disabled={busy} onClick={() => action("deleteAnalysis")}>{tr.analysis.delete}</Button>
    </div>
  </section>;
}
