import { Link } from "react-router-dom";
import { useAnalyses } from "../hooks/use-analyses";
import { tr } from "../i18n/tr";

// Yalnız oturum sahibinin gerçek analiz geçmişini tarih sırasıyla listeler.
export function HistoryPage() {
  const { rows, loading, error } = useAnalyses();
  return <section aria-labelledby="history-title">
    <h1 id="history-title" className="text-3xl font-semibold">{tr.analysis.history}</h1>
    <p className="mt-3 text-sm text-muted-foreground">Kaydedilmiş raporlarınızı açın, devam eden işlemleri izleyin veya kaynaklarıyla birlikte silin.</p>
    {loading ? <p role="status" className="mt-8">Geçmiş yükleniyor…</p> : error ? <p role="alert" className="mt-8">{error}</p> : rows.length ? <ul className="mt-8 space-y-3">{rows.map(a => <li key={a.id}><Link className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" to={"/app/analyses/" + a.id}><div className="min-w-0"><h2 className="break-words font-semibold">{a.title}</h2><p className="mt-1 text-xs text-muted-foreground">{a.business} · {new Date(a.createdAt).toLocaleString("tr-TR")}</p></div><span className="text-sm">{tr.status[a.status]}</span></Link></li>)}</ul> : <div className="mt-8 rounded-3xl border border-border bg-card p-8"><p>{tr.analysis.noHistory}</p><Link className="mt-4 inline-block text-primary underline dark:text-secondary" to="/app/new-analysis">İlk raporunu oluştur</Link></div>}
  </section>;
}
