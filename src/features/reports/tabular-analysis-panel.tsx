import { lazy, Suspense, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { ArrowRight, Check, Database, Layers, LoaderCircle, PieChart, RotateCcw, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import type { Analysis } from "../../../functions/src/contracts";
import type { AnalysisTable, TableSelection } from "../../../functions/src/analysis/tabular-contract";
import type { AiArtifact } from "../../../functions/src/analysis/tabular-storage";
import { getLocale, t, useLocale } from "../../i18n/runtime";
import { getServices } from "../../lib/firebase";
import { useAuth } from "../../lib/auth-context";
import { userError } from "../../lib/errors";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { PageLoading } from "../../components/page-loading";

const LiveAnalysisReport = lazy(() => import("./live-analysis-report"));
const defaults: TableSelection = { sheet: null, valueColumn: null, groupColumn: null, aggregation: "sum", numberFormat: "plain", unit: "number" };
const panel = "surface rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7";
const errors = {
  "invalid-data": "Seçilen ölçümde boş, geçersiz veya biçimi uyuşmayan hücreler var. Tabloyu ve sayı biçimini kontrol edin.",
  "scope-limit": "Bu tablo ilk analiz kapsamını aşıyor. Daha az kayıt veya grup içeren bir tablo seçin.",
  configuration: "Analiz servisine şu anda ulaşılamıyor. Hazırlanan belgeleriniz korunuyor; daha sonra yeniden deneyin.",
  provider: "Özet bu denemede tamamlanamadı. Aynı kapsamla yeniden deneyebilirsiniz.",
  "provider-busy": "Özet servisi şu anda yoğun. Hazırlanan belgeleriniz korunuyor; biraz sonra yeniden deneyin.",
  validation: "Üretilen sonuç doğrulama kontrolünü geçemedi ve rapor olarak kaydedilmedi. Yeniden deneyebilirsiniz.",
  timeout: "Analiz süresi doldu. Aynı kapsamla yeniden deneyebilirsiniz.",
};

// Gelişmiş ayrıntılar açılabilir kalır; seçili değer görünür, başlık gerçek label ile ilişkilidir.
function Field({ id, label, value, onChange, options, placeholder, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean }) {
  return <div className="min-w-0"><label htmlFor={id} className="mb-2 block text-xs font-medium">{t(label)}</label><Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger id={id} className="h-11"><SelectValue placeholder={placeholder ? t(placeholder) : undefined} /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

// Seçili tablo ve alan ayarlarını tek bakışta anlaşılır kılan özet satırları üretir.
function getScopeSummary(selected: AnalysisTable | undefined, selection: TableSelection) {
  if (!selected) return null;
  const aggLabel = selection.aggregation === "count" ? t("Kayıt sayısı") : selection.aggregation === "mean" ? t("Ortalama") : t("Toplam");
  const measureLabel = selection.aggregation === "count"
    ? t("Dolu satırlar")
    : selection.valueColumn !== null ? (selected.columns[selection.valueColumn] ?? t("Alan seçilmedi")) : t("Alan seçilmedi");
  const groupLabel = selection.groupColumn !== null
    ? (selected.columns[selection.groupColumn] ?? t("Gruplama yok"))
    : t("Gruplama yok");
  const unitLabel = selection.aggregation === "count" ? t("kayıt", 2) : (selection.unit === "number" ? t("Sayı") : selection.unit === "percent" ? "%" : selection.unit);
  const formatLabel = selection.numberFormat === "tr" ? "1.234,56" : selection.numberFormat === "en" ? "1,234.56" : "1234.56";
  return {
    source: `${selected.fileName}${selected.sheet ? ` · ${selected.sheet}` : ""}`,
    operation: `${aggLabel}: ${measureLabel}`,
    group: groupLabel,
    format: selection.aggregation === "count" ? unitLabel : `${formatLabel} (${unitLabel})`,
  };
}

// Seçim eksik veya geçersiz olduğunda kullanıcıya net, yerelleştirilmiş yönlendirme mesajı döndürür.
function getValidationReason(selected: AnalysisTable | undefined, selection: TableSelection, limits: { rows: number }) {
  if (!selected) return t("Devam etmek için bir tablo seçin.");
  if (selected.rows > limits.rows) return t("Bu tablo kayıt sınırını aşıyor ({0}/{1}).", selected.rows, limits.rows);
  if (selection.aggregation !== "count" && selection.valueColumn === null) return t("Hesaplanacak ölçüm alanını seçin.");
  if (selection.valueColumn !== null && selection.valueColumn === selection.groupColumn) return t("Ölçüm ve gruplama için farklı alanlar seçin.");
  return null;
}

// Raporu UID/deneme kimliğine bağlar; geç gelen başka rota/hesap yanıtını göstermez.
export function TabularAnalysisPanel({ analysis }: { analysis: Analysis }) {
  useLocale();
  const { user } = useAuth();
  const job = analysis.ai;
  const [now, setNow] = useState(() => Date.now());
  const [selection, setSelection] = useState<TableSelection>(job?.selection ?? defaults);
  const [tableKey, setTableKey] = useState("");
  const [tables, setTables] = useState<AnalysisTable[] | null>(null);
  const [limits, setLimits] = useState({ rows: 5000, groups: 12, attempts: 3 });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [artifact, setArtifact] = useState<AiArtifact | null>(null);
  const running = job?.status === "running" && now < job.leaseUntil;
  const cooling = job?.status === "failed" && now < (job.retryAfter ?? 0);
  const ready = job?.status === "completed";
  useEffect(() => { if (job?.status !== "running" && !cooling) return; const timer = setInterval(() => setNow(Date.now()), cooling ? 1000 : 5000); return () => clearInterval(timer); }, [job?.status, cooling]);
  useEffect(() => {
    if (!user || ready || running) return;
    let active = true;
    httpsCallable<{ id: string }, { tables: AnalysisTable[]; limits: typeof limits }>(getServices().functions, "getAnalysisTables")({ id: analysis.id })
      .then(response => { if (active) { setTables(response.data.tables); setLimits(response.data.limits); setError(""); } })
      .catch(failure => { if (active) setError(userError(failure)); });
    return () => { active = false; };
  }, [analysis.id, user, ready, running, refresh]);
  useEffect(() => {
    if (!user || !ready) return;
    let active = true;
    httpsCallable<{ id: string }, AiArtifact>(getServices().functions, "getAnalysisResult")({ id: analysis.id })
      .then(response => { if (active) { setArtifact(response.data); setError(""); } })
      .catch(failure => { if (active) setError(userError(failure)); });
    return () => { active = false; };
  }, [analysis.id, user, ready, job?.attemptId, refresh]);
  const savedTable = tables?.find(table => table.sourceId === job?.sourceId && table.sheet === job.selection.sheet);
  const selected = tableKey ? tables?.[Number(tableKey)] : savedTable ?? (tables?.length === 1 ? tables[0] : undefined);
  const index = selected ? tables?.indexOf(selected) : undefined;
  const valid = !!selected && (selection.aggregation === "count" || selection.valueColumn !== null)
    && (selection.valueColumn === null || selection.valueColumn !== selection.groupColumn) && selected.rows <= limits.rows;
  const validationReason = getValidationReason(selected, selection, limits);
  const summary = getScopeSummary(selected, selection);
  const exhausted = (job?.attempts ?? 0) >= (job?.maxAttempts ?? limits.attempts);

  // Kullanıcının açık seçimi gönderilir; başlık, kaynak yolu, metrik veya prompt istemciden üretilmez.
  async function start() {
    if (!selected || !valid || pending || exhausted || cooling) return;
    setPending(true); setError("");
    try { await httpsCallable(getServices().functions, "startAnalysis", { timeout: 190_000 })({ id: analysis.id, sourceId: selected.sourceId, selection: { ...selection, sheet: selected.sheet }, locale: job?.status === "running" ? job.locale : getLocale() }); }
    catch (failure) {
      const details = (failure as { details?: { analysisFailure?: string } })?.details;
      const reason = details?.analysisFailure;
      setError(reason && Object.prototype.hasOwnProperty.call(errors, reason) ? errors[reason as keyof typeof errors] : userError(failure));
    }
    finally { setPending(false); }
  }

  if (ready) return <div className="mt-7">{error ? <section className={panel}><p role="alert" className="text-sm text-destructive">{t(error)}</p><Button className="mt-4" variant="outline" onClick={() => setRefresh(value => value + 1)}>{t("Yeniden yükle")}</Button></section> : artifact ? <Suspense fallback={<PageLoading label="Analiz yükleniyor…" />}><LiveAnalysisReport artifact={artifact} job={job!} analysisId={analysis.id} /></Suspense> : <PageLoading label="Analiz yükleniyor…" />}</div>;
  if (running || pending) {
    const stage = job?.stage ?? "calculating", stages = ["calculating", "interpreting", "saving"];
    const activeIndex = stages.indexOf(stage);
    return <section className={`${panel} mt-7`} aria-labelledby="ai-progress-title" aria-busy="true"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-secondary"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><div><h2 id="ai-progress-title" className="text-lg font-semibold">{t("Analiziniz hazırlanıyor")}</h2><p role="status" className="mt-2 text-sm text-muted-foreground">{t(stage === "calculating" ? "Tablo hesaplanıyor." : stage === "interpreting" ? "Kaynaklı özet hazırlanıyor." : "Rapor kaydediliyor.")}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{t("Bu sayfadan ayrılabilirsiniz. Sonucu geçmişinizden açabilirsiniz; aynı isteği tekrarlamak yeni analiz başlatmaz.")}</p></div></div><ol className="mt-6 grid grid-cols-3 gap-3" aria-label={t("Analiz aşamaları")}>{["Hesaplar", "Özet", "Kayıt"].map((label, position) => <li key={label} className={`border-t-2 pt-3 text-xs ${position <= activeIndex ? "border-primary font-medium text-primary dark:border-secondary dark:text-secondary" : "border-border text-muted-foreground"}`}><span className="inline-flex items-center gap-2">{position < activeIndex ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : position === activeIndex ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{t(label)}</span></li>)}</ol></section>;
  }
  return <section className={`${panel} mt-7`} aria-labelledby="ai-setup-title"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-secondary"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary">{t("Kaynaklı analiz")}</p><h2 id="ai-setup-title" className="mt-1 text-xl font-semibold tracking-tight">{t("Tablodan net bir özet.")}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("Bir tablo ve ölçüm seçin. Hesaplar kaynak satırlarıyla doğrulanır; özet, analiz hedefinize göre hazırlanır.")}</p></div></div>
    {job && <p role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-6"><TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" /><span>{t(exhausted ? "Bu çalışma için deneme sınırına ulaşıldı. Kaynaklarınız ve hazırlık özeti korunuyor." : job.error ? errors[job.error] : "Bu işlemden henüz sonuç alınamadı. Aynı kapsamla yeniden deneyebilirsiniz.")}{cooling && <span className="mt-1 block">{t("Yeniden deneme kısa bir süre sonra açılacak; işlem kendiliğinden başlamaz.")}</span>}</span></p>}
    {error && !(job?.status === "failed" && job.error && error === errors[job.error]) && <p role="alert" className="mt-4 text-sm text-destructive">{t(error)}</p>}
    {tables === null ? <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">{error ? <Button variant="outline" onClick={() => setRefresh(value => value + 1)}>{t("Tabloları yeniden yükle")}</Button> : <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />{t("Tablolar kontrol ediliyor…")}</>}</div> : tables.length === 0 ? <p className="mt-5 text-sm leading-6 text-muted-foreground">{t("Bu ilk analiz sürümü CSV ve XLSX tablolarını kullanır. Diğer belgelerinizin hazırlık özetini aşağıda inceleyebilirsiniz.")}</p> : <>
      <div className="mt-6 space-y-6">
        {/* Bölüm 1: Veri kaynağı */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Database className="h-3.5 w-3.5 text-primary dark:text-secondary" aria-hidden="true" />
            <span>{t("1. İncelenecek veri kaynağı")}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ai-table" label="Analiz tablosu" value={index === undefined ? "" : String(index)} placeholder="Tablo seç" disabled={exhausted} onChange={value => { setTableKey(value); setSelection(defaults); setError(""); }} options={tables.map((table, n) => ({ value: String(n), label: `${table.fileName}${table.sheet ? ` · ${table.sheet}` : ""}` }))} />
            <div className="flex flex-col justify-end text-xs leading-5 text-muted-foreground">
              <p className="font-medium text-foreground">{selected ? t("{0} kayıt · {1} alan", selected.rows, selected.columns.length) : t("İncelemek istediğiniz tabloyu seçin.")}</p>
              <p className="mt-0.5 text-[11px]">{t("En fazla {0} kayıt ve {1} grup.", limits.rows, limits.groups)}</p>
            </div>
          </div>
        </div>

        {/* Bölüm 2: Ne hesaplanacak */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <PieChart className="h-3.5 w-3.5 text-primary dark:text-secondary" aria-hidden="true" />
            <span>{t("2. Hesaplama yöntemi ve ölçüm")}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ai-aggregation" label="Hesaplama" value={selection.aggregation} disabled={!selected || exhausted} onChange={value => setSelection(current => ({ ...current, aggregation: value as TableSelection["aggregation"], valueColumn: value === "count" ? null : current.valueColumn, unit: value === "count" ? "count" : current.unit === "count" ? "number" : current.unit }))} options={[{ value: "sum", label: t("Toplam") }, { value: "mean", label: t("Ortalama") }, { value: "count", label: t("Kayıt sayısı") }]} />
            <Field id="ai-measure" label="Ölçüm alanı" value={selection.valueColumn === null ? "" : String(selection.valueColumn)} placeholder={selection.aggregation === "count" ? "Dolu kayıtlar" : "Alan seç"} disabled={!selected || exhausted || selection.aggregation === "count"} onChange={value => setSelection(current => ({ ...current, valueColumn: Number(value), groupColumn: current.groupColumn === Number(value) ? null : current.groupColumn }))} options={(selected?.columns ?? []).map((column, n) => ({ value: String(n), label: column }))} />
          </div>
          {selection.aggregation === "count" && <p className="mt-2.5 text-xs text-muted-foreground">{t("Kayıt sayısı seçildiğinde boş olmayan tüm satırlar sayılır; ölçüm sütunu seçilmez.")}</p>}
        </div>

        {/* Bölüm 3: Kapsam ve biçim */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary dark:text-secondary" aria-hidden="true" />
            <span>{t("3. Gruplama ve gösterim biçimi")}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ai-group" label="Gruplama" value={selection.groupColumn === null ? "none" : String(selection.groupColumn)} disabled={!selected || exhausted} onChange={value => setSelection(current => ({ ...current, groupColumn: value === "none" ? null : Number(value) }))} options={[{ value: "none", label: t("Gruplama yok") }, ...(selected?.columns ?? []).map((column, n) => ({ value: String(n), label: column })).filter(option => Number(option.value) !== selection.valueColumn)]} />
            <Field id="ai-number-format" label="Sayı biçimi" value={selection.numberFormat} disabled={!selected || exhausted || selection.aggregation === "count"} onChange={value => setSelection(current => ({ ...current, numberFormat: value as TableSelection["numberFormat"] }))} options={[{ value: "plain", label: "1234.56" }, { value: "tr", label: "1.234,56" }, { value: "en", label: "1,234.56" }]} />
            <Field id="ai-unit" label="Birim" value={selection.unit} disabled={!selected || exhausted || selection.aggregation === "count"} onChange={value => setSelection(current => ({ ...current, unit: value as TableSelection["unit"] }))} options={[{ value: "number", label: t("Sayı") }, { value: "count", label: t("kayıt", 2) }, { value: "TRY", label: "TRY · ₺" }, { value: "USD", label: "USD · $" }, { value: "EUR", label: "EUR · €" }, { value: "percent", label: "%" }].filter(option => selection.aggregation === "count" || option.value !== "count")} />
          </div>
        </div>
      </div>

      {/* Seçili Kapsam Özeti */}
      {summary && (
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 text-xs dark:border-secondary/20 dark:bg-secondary/[0.03]" aria-label={t("Kapsam özeti")}>
          <p className="font-semibold text-primary dark:text-secondary">{t("Kapsam özeti")}</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-muted-foreground sm:grid-cols-4">
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground/85">{t("Kaynak:")}</span>
              <strong className="block truncate font-medium text-foreground" title={summary.source}>{summary.source}</strong>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground/85">{t("Hesap:")}</span>
              <strong className="block truncate font-medium text-foreground" title={summary.operation}>{summary.operation}</strong>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground/85">{t("Gruplama:")}</span>
              <strong className="block truncate font-medium text-foreground" title={summary.group}>{summary.group}</strong>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground/85">{t("Gösterim:")}</span>
              <strong className="block truncate font-medium text-foreground" title={summary.format}>{summary.format}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Alt Eylem ve Durum Çubuğu */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div className="text-xs leading-6 text-muted-foreground">
          {validationReason && !exhausted && !cooling ? (
            <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{validationReason}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">{valid ? t("Analiz oluşturulmaya hazır.") : t("Seçimlerinizi tamamlayın.")}</p>
          )}
        </div>
        <Button onClick={start} disabled={!valid || exhausted || cooling} className="min-h-11 gap-2">
          {job ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {cooling ? t("Kısa bir süre bekleyin") : job ? t("Yeniden dene") : t("Analizi oluştur")}
          <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        </Button>
      </div>
      {selected && selected.rows > limits.rows && <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-300">{t("Bu tablo kayıt sınırını aşıyor. Daha küçük bir tabloyla devam edin.")}</p>}
      <details className="mt-4 text-xs text-muted-foreground"><summary className="w-fit cursor-pointer rounded py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("Nasıl hesaplanır?")}</summary><div className="mt-2 max-w-3xl space-y-2 leading-6"><p className="flex items-start gap-2"><ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t("Yalnız seçilen tablo işlenir. Ölçüm, birim ve sayı biçimi tahmin edilmez; eksik veya geçersiz ölçüm hücreleri hesaplamayı durdurur.")}</p><p>{t("Seçilen tablo ve doğrulanmış hesaplar yapay zekâ özetinde kullanılır. Diğer belgeler bu analizin kapsamına eklenmez.")}</p><p>{t("Parasal sonuçlar iki, diğer sonuçlar altı ondalık hanede yuvarlanır. Tamamen boş satırlar kayıt sayısına dahil edilmez.")}</p></div></details>
    </>}
  </section>;
}
