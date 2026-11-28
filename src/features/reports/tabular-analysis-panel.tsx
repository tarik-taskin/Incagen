import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { ArrowRight, Check, Database, Eye, Layers, LoaderCircle, PieChart, RotateCcw, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import type { Analysis } from "../../../functions/src/contracts";
import type { AnalysisAccess, AnalysisFailure, AnalysisLimit, AnalysisTable, TableSelection } from "../../../functions/src/analysis/tabular-contract";
import type { AiArtifact } from "../../../functions/src/analysis/tabular-storage";
import { getLocale, localeTag, t, useLocale } from "../../i18n/runtime";
import { getServices } from "../../lib/firebase";
import { useAuth } from "../../lib/auth-context";
import { userError } from "../../lib/errors";
import { Button } from "../../components/ui/button";
import { Table } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { PageLoading } from "../../components/page-loading";
import { useDeadlineReached } from "../../hooks/use-deadline-reached";

const LiveAnalysisReport = lazy(() => import("./live-analysis-report"));
const defaults: TableSelection = { sheet: null, valueColumn: null, groupColumn: null, aggregation: "sum", numberFormat: "plain", unit: "number" };
const panel = "surface rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7";
const fallbackFailureMessage = "Bu işlemden henüz sonuç alınamadı. Seçiminizi kontrol edip yeniden deneyebilirsiniz.";
const limitMessages: Record<AnalysisLimit, string> = {
  attempts: "Bu çalışma için deneme sınırına ulaşıldı. Kaynaklarınız ve hazırlık özeti korunuyor.",
  "user-day": "Bugünkü analiz haklarınız doldu. Hazırlanan belgeleriniz korunuyor. Kota yenilendiğinde yeniden deneyebilirsiniz.",
  "provider-day": "Analiz servisinin günlük kapasitesi doldu. Hazırlanan belgeleriniz korunuyor. Kapasite yenilendiğinde yeniden deneyebilirsiniz.",
};
const errors: Record<AnalysisFailure, string> = {
  "invalid-data": "Seçilen ölçümde boş, geçersiz veya biçimi uyuşmayan hücreler var. Tabloyu ve sayı biçimini kontrol edin.",
  "invalid-number-format": "Seçilen sayı biçimi bu sütundaki değerlerle uyuşmuyor. Sayı biçimini (1234.56 / 1.234,56 / 1,234.56) değiştirip yeniden deneyin.",
  "currency-precision": "Para birimi seçiminde ikiden fazla ondalık basamaklı hücreler bulundu. Birimi «Sayı» yapın veya belgeyi iki ondalıkla düzenleyin.",
  "invalid-measure": "Seçilen ölçüm sütununda boş, metin veya geçersiz sayısal değerler var. Farklı bir ölçüm alanı seçin ya da «Kayıt sayısı» ile devam edin.",
  "invalid-group": "Seçilen gruplama sütununda boş veya geçersiz değerler var. Başka bir gruplama alanı seçin ya da «Gruplama yok» ile devam edin.",
  "empty-table": "Seçilen tabloda hesaplanabilecek dolu satır bulunamadı. Başka bir tablo veya sayfa seçin.",
  "group-limit": "Seçilen gruplama sütunu en fazla 12 benzersiz grup sınırını aşıyor. Daha az kategori içeren bir alan seçin veya «Gruplama yok» ile devam edin.",
  "row-limit": "Seçilen tablo 5.000 kayıt sınırını aşıyor. Daha küçük bir tablo veya sayfa seçin.",
  "scope-limit": "Bu tablo ilk analiz kapsamını aşıyor. Daha az kayıt veya grup içeren bir tablo seçin.",
  configuration: "Analiz servisine şu anda ulaşılamıyor. Hazırlanan belgeleriniz korunuyor; daha sonra yeniden deneyin.",
  provider: "Özet bu denemede tamamlanamadı. Aynı kapsamla yeniden deneyebilirsiniz.",
  "provider-busy": "Özet servisi şu anda yoğun. Hazırlanan belgeleriniz korunuyor; biraz sonra yeniden deneyin.",
  "provider-rate-limit": "Özet servisi istek sınırına ulaştı. Hazırlanan belgeleriniz korunuyor. Daha sonra yeniden deneyin.",
  validation: "Üretilen sonuç doğrulama kontrolünü geçemedi ve rapor olarak kaydedilmedi. Yeniden deneyebilirsiniz.",
  timeout: "Analiz süresi doldu. Aynı kapsamla yeniden deneyebilirsiniz.",
};

// Sabit hata kodunu kullanıcı dostu yönlendirme metnine çevirir; eski veya bilinmeyen kodlarda genel açıklamayı korur.
function getFailureMessage(code?: string) {
  if (code && Object.prototype.hasOwnProperty.call(errors, code)) return errors[code as AnalysisFailure];
  return fallbackFailureMessage;
}

// Gelişmiş ayrıntılar açılabilir kalır; seçili değer görünür, başlık gerçek label ve hata açıklamasıyla ilişkilidir.
function Field({ id, label, value, onChange, options, placeholder, disabled, invalid, describedBy }: { id: string; label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean; invalid?: boolean; describedBy?: string }) {
  return <div className="min-w-0"><label htmlFor={id} className="mb-2 block text-xs font-medium">{t(label)}</label><Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy} className="h-11"><SelectValue placeholder={placeholder ? t(placeholder) : undefined} /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

// Sunucu yenilenme zamanını kullanıcının yerel saat diliminde kısa ve okunur biçimde gösterir.
function formatRetryTime(timestamp: number, tag: string) {
  const target = new Date(timestamp);
  const now = new Date();
  const sameDay = target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth() && target.getDate() === now.getDate();
  return new Intl.DateTimeFormat(tag, sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(target);
}

// Eski kayıt ve callable yanıtındaki süreyi, tarayıcıda temsil edilebilen bir tarihse kullanır.
function retryDeadline(timestamp?: number) {
  return typeof timestamp === "number" && Number.isFinite(new Date(timestamp).getTime()) && timestamp > 0 ? timestamp : 0;
}

// Aynı adlı farklı belgeleri kaynak sırasıyla ayırt eder; tekil adlarda ve çok sayfalı XLSX'te kısa biçimi korur.
function formatTableLabel(table: AnalysisTable, tables: readonly AnalysisTable[]) {
  const sourceIdsForName: string[] = [];
  for (const item of tables) {
    if (item.fileName === table.fileName && !sourceIdsForName.includes(item.sourceId)) sourceIdsForName.push(item.sourceId);
  }
  const suffix = sourceIdsForName.length > 1 ? ` (${t("Belge {0}", sourceIdsForName.indexOf(table.sourceId) + 1)})` : "";
  return `${table.fileName}${suffix}${table.sheet ? ` · ${table.sheet}` : ""}`;
}

// Tablo değiştiğinde yeni tabloda geçersiz kalan ölçüm veya gruplama sütununu temizler; geçerli ayarları korur.
function reconcileSelectionForTable(current: TableSelection, prevTable: AnalysisTable | undefined, nextTable: AnalysisTable | undefined): TableSelection {
  if (!nextTable) return { ...current, sheet: null, valueColumn: null, groupColumn: null };
  const keepColumn = (index: number | null) => {
    if (index === null || !Number.isInteger(index) || index < 0 || index >= nextTable.columns.length) return null;
    if (prevTable && prevTable.columns[index] !== nextTable.columns[index]) return null;
    return index;
  };
  const nextValue = current.aggregation === "count" ? null : keepColumn(current.valueColumn);
  const rawGroup = keepColumn(current.groupColumn);
  const nextGroup = rawGroup !== null && rawGroup === nextValue ? null : rawGroup;
  return {
    ...current,
    sheet: nextTable.sheet,
    valueColumn: nextValue,
    groupColumn: nextGroup,
    unit: current.aggregation === "count" ? "count" : current.unit === "count" ? "number" : current.unit,
    numberFormat: current.aggregation === "count" ? "plain" : current.numberFormat,
  };
}

// Gönderilen analiz ayarlarının özellikle kayıt sayımında devre dışı kontrollerle birebir tutarlı olmasını sağlar.
function normalizeSelectionForSubmit(selection: TableSelection, sheet: string | null): TableSelection {
  if (selection.aggregation === "count") {
    return { ...selection, sheet, valueColumn: null, unit: "count", numberFormat: "plain" };
  }
  return { ...selection, sheet, unit: selection.unit === "count" ? "number" : selection.unit };
}

// Seçili tablonun hesaplamaya uygun olmama nedenini döndürür; uygunsa null verir.
function getTableUnavailabilityReason(selected: AnalysisTable | undefined, limits: { rows: number }) {
  if (!selected) return null;
  if (selected.unavailableReason === "empty-table") {
    return t("Bu tabloda hesaplanabilecek veri satırı yok. Boş olmayan bir tablo seçin.");
  }
  if (selected.unavailableReason === "unreadable-table" || selected.unavailableReason === "inconsistent-columns" || selected.columns.length === 0) {
    return t("Bu tablonun sütun yapısı tutarsız veya okunamadı. Başka bir tablo seçin veya belgeyi düzenleyip yeniden yükleyin.");
  }
  if (selected.rows === 0 || selected.nonEmptyRows === 0) {
    return t("Bu tabloda hesaplanabilecek veri satırı yok. Boş olmayan bir tablo seçin.");
  }
  if (selected.unavailableReason === "row-limit" || selected.rows > limits.rows) {
    return t("Bu tablo kayıt sınırını aşıyor ({0}/{1}).", selected.rows, limits.rows);
  }
  return null;
}

// Seçili tablo ve alan ayarlarını tek bakışta anlaşılır kılan özet satırları üretir.
function getScopeSummary(selected: AnalysisTable | undefined, tables: readonly AnalysisTable[], selection: TableSelection) {
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
    source: formatTableLabel(selected, tables),
    operation: `${aggLabel}: ${measureLabel}`,
    group: groupLabel,
    format: selection.aggregation === "count" ? unitLabel : `${formatLabel} (${unitLabel})`,
  };
}

// Sunucudan dönen tablo/biçim/alan hata kodunu ilgili form alanıyla eşleştirir.
function getServerErrorField(code?: string): "table" | "measure" | "group" | "numberFormat" | "unit" | null {
  if (code === "invalid-number-format") return "numberFormat";
  if (code === "currency-precision") return "unit";
  if (code === "invalid-measure" || code === "invalid-data") return "measure";
  if (code === "invalid-group" || code === "group-limit") return "group";
  if (code === "empty-table" || code === "row-limit" || code === "scope-limit") return "table";
  return null;
}

// Seçim eksik veya geçersiz olduğunda ilgili alanla eşleştirilmiş yerelleştirilmiş yönlendirme döndürür.
function getValidationIssue(selected: AnalysisTable | undefined, selection: TableSelection, limits: { rows: number }): { field: "table" | "measure" | "group"; message: string } | null {
  if (!selected) return { field: "table", message: t("Devam etmek için bir tablo seçin.") };
  const tableIssue = getTableUnavailabilityReason(selected, limits);
  if (tableIssue) return { field: "table", message: tableIssue };
  if (selection.aggregation !== "count" && (selection.valueColumn === null || !Number.isInteger(selection.valueColumn) || selection.valueColumn < 0 || selection.valueColumn >= selected.columns.length)) {
    return { field: "measure", message: t("Hesaplanacak ölçüm alanını seçin.") };
  }
  if (selection.groupColumn !== null && (!Number.isInteger(selection.groupColumn) || selection.groupColumn < 0 || selection.groupColumn >= selected.columns.length)) {
    return { field: "group", message: t("Gruplama alanını yeniden seçin.") };
  }
  if (selection.valueColumn !== null && selection.valueColumn === selection.groupColumn) {
    return { field: "group", message: t("Ölçüm ve gruplama için farklı alanlar seçin.") };
  }
  return null;
}

// Hesaplamadan önce seçili tablonun sütunlarını ve küçük satır örneğini gösterir; Python veya model çağrısı başlatmaz.
function TablePreview({ table, label }: { table: AnalysisTable; label: string }) {
  const sampleRows = table.sampleRows ?? [];
  const isFileLine = table.sampleRowNumbering === "file-line";
  return <details className="mt-4 min-w-0 rounded-xl border border-border/70 bg-background/60 text-xs">
    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3.5 py-2 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
      <span className="inline-flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-primary dark:text-secondary" aria-hidden="true" />{t("Tablo önizlemesi")}</span>
      <span className="text-[11px] font-normal text-muted-foreground">{sampleRows.length > 0 ? t("İlk {0} satır · {1} sütun", sampleRows.length, table.columns.length) : t("{0} sütun", table.columns.length)}</span>
    </summary>
    <div className="border-t border-border/60 px-3.5 py-3">
      <p dir="auto" className="font-medium text-foreground [overflow-wrap:anywhere]">{label}</p>
      {table.columns.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t("Tablo sütunları")}>{table.columns.map((col, idx) => <span key={`${idx}-${col}`} dir="auto" className="min-w-0 max-w-full rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] text-foreground [overflow-wrap:anywhere]">{col}</span>)}</div>}
      {sampleRows.length > 0 ? <>
          <Table scrollLabel={t("Seçili tablodan örnek satırlar")} containerClassName="mt-3 rounded-lg border border-border/70" className="border-collapse text-start text-[11px]">
            <caption className="sr-only">{t("Seçili tablodan örnek satırlar")}</caption>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="whitespace-nowrap border-b border-border/70 px-2.5 py-1.5 font-medium">{isFileLine ? t("Dosya satırı") : t("Kayıt sırası")}</th>
                {table.columns.map((col, idx) => <th key={`${idx}-${col}`} scope="col" dir="auto" className="whitespace-nowrap border-b border-border/70 px-2.5 py-1.5 font-medium">{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {sampleRows.map(sample => <tr key={sample.row} className="border-t border-border/50">
                <th scope="row" className="whitespace-nowrap px-2.5 py-1.5 font-normal tabular-nums text-muted-foreground">{sample.row}</th>
                {table.columns.map((_col, idx) => {
                  const raw = sample.values[idx];
                  const display = raw === null || raw === undefined || String(raw).trim() === "" ? "—" : String(raw);
                  return <td key={idx} dir="auto" className="max-w-[14rem] truncate whitespace-nowrap px-2.5 py-1.5 text-foreground" title={display}>{display}</td>;
                })}
              </tr>)}
            </tbody>
          </Table>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{t("Yalnızca ilk {0} satır örnek olarak gösterilir; tüm veri satırlarının tam doğrulaması yerine geçmez. Hesaplama başlatıldığında seçilen tablonun tamamı doğrulanır.", sampleRows.length)}</p>
        {!isFileLine && <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{t("Bu kayıtta özgün dosya satır numarası belirlenemediği için veri kaydı sırası gösterilir.")}</p>}
      </> : <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{t("Örnek satır önizlemesi bu kayıt için mevcut değil; sütun başlıklarını yukarıda inceleyebilirsiniz.")}</p>}
    </div>
  </details>;
}

// Dosya/sayfa ikilisinin kimliği liste sırası değişse de sabittir; ayırıcı çakışması oluşturmaz.
function tableIdentity(table: AnalysisTable) { return JSON.stringify([table.sourceId, table.sheet]); }

// Form, bekleyen istek ve sonuç yalnız aynı kullanıcı/kayıt/denemede paylaşılır.
export function TabularAnalysisPanel({ analysis }: { analysis: Analysis }) {
  const { user } = useAuth();
  return <AnalysisSession key={JSON.stringify([user?.uid, analysis.id, analysis.ai?.attemptId])} analysis={analysis} />;
}

// Geç gelen kaynak/sonuç ve manuel başlatma yanıtları kapanan oturuma state yazamaz.
function AnalysisSession({ analysis }: { analysis: Analysis }) {
  useLocale();
  const { user } = useAuth();
  const job = analysis.ai;
  const [selection, setSelection] = useState<TableSelection>(job?.selection ?? defaults);
  const [tableKey, setTableKey] = useState("");
  const [access, setAccess] = useState<AnalysisAccess | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [tables, setTables] = useState<AnalysisTable[] | null>(null);
  const [limits, setLimits] = useState({ rows: 5000, groups: 12, attempts: 3 });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [attemptLimitReached, setAttemptLimitReached] = useState(false);
  const [callableRetryAfter, setCallableRetryAfter] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [artifact, setArtifact] = useState<AiArtifact | null>(null);
  const lifetime = useRef({ active: true, starting: false, reloading: false });
  const catalogRequestId = useRef(0);
  const previousTablesRef = useRef<AnalysisTable[] | null>(null);
  const tableKeyRef = useRef(tableKey);
  const jobRef = useRef(job);
  useEffect(() => {
    tableKeyRef.current = tableKey;
    jobRef.current = job;
  }, [tableKey, job]);
  useEffect(() => {
    const current = lifetime.current;
    current.active = true;
    return () => { current.active = false; };
  }, []);
  const leaseUntil = job?.status === "running" ? job.leaseUntil : undefined;
  const running = !useDeadlineReached(leaseUntil);
  const retryAfter = Math.max(job?.status === "failed" ? retryDeadline(job.retryAfter) : 0, callableRetryAfter);
  const cooling = !useDeadlineReached(running ? undefined : retryAfter);
  const ready = job?.status === "completed";
  useEffect(() => {
    if (!user || ready || running) return;
    let active = true;
    const reqId = ++catalogRequestId.current;
    httpsCallable<{ id: string }, { tables: AnalysisTable[]; limits: typeof limits; access?: AnalysisAccess }>(getServices().functions, "getAnalysisTables")({ id: analysis.id })
      .then(({ data }) => {
        if (!active || reqId !== catalogRequestId.current) return;
        const prevTables = previousTablesRef.current;
        previousTablesRef.current = data.tables;
        if (prevTables) {
          const currentKey = tableKeyRef.current;
          const currentJob = jobRef.current;
          const prevSelected = currentKey
            ? prevTables.find(table => tableIdentity(table) === currentKey)
            : currentJob ? prevTables.find(table => table.sourceId === currentJob.sourceId && table.sheet === currentJob.selection.sheet)
              : prevTables.length === 1 ? prevTables[0] : undefined;
          const nextSelected = currentKey
            ? data.tables.find(table => tableIdentity(table) === currentKey)
            : currentJob ? data.tables.find(table => table.sourceId === currentJob.sourceId && table.sheet === currentJob.selection.sheet)
              : data.tables.length === 1 ? data.tables[0] : undefined;
          // Katalog yenilendiğinde kaybolan tablo veya değişen şema nedeniyle geçersiz kalan sütunları temizle.
          if (prevSelected && (!nextSelected || prevSelected.columns.length !== nextSelected.columns.length || prevSelected.columns.some((col, idx) => nextSelected.columns[idx] !== col))) {
            setSelection(current => reconcileSelectionForTable(current, prevSelected, nextSelected));
          }
        }
        setTables(data.tables);
        setLimits(data.limits);
        setAccess(data.access === "available" || data.access === "invite-required" ? data.access : "closed");
        setError("");
      })
      .catch(failure => {
        if (!active || reqId !== catalogRequestId.current) return;
        setAccess(null);
        setError(userError(failure));
      })
      .finally(() => {
        if (!active || reqId !== catalogRequestId.current) return;
        lifetime.current.reloading = false;
        setCheckingAccess(false);
      });
    return () => { active = false; };
  }, [analysis.id, user, ready, running, refresh]);
  useEffect(() => {
    if (!user || !ready) return;
    let active = true;
    httpsCallable<{ id: string }, AiArtifact>(getServices().functions, "getAnalysisResult")({ id: analysis.id })
      .then(response => { if (active) { setArtifact(response.data); setError(""); } })
      .catch(failure => { if (active) setError(userError(failure)); })
      .finally(() => { if (active) lifetime.current.reloading = false; });
    return () => { active = false; };
  }, [analysis.id, user, ready, job?.attemptId, refresh]);
  const savedTable = tables?.find(table => table.sourceId === job?.sourceId && table.sheet === job?.selection?.sheet);
  const selected = tableKey ? tables?.find(table => tableIdentity(table) === tableKey) : job ? savedTable : tables?.length === 1 ? tables[0] : undefined;
  const tableUnavailable = Boolean(getTableUnavailabilityReason(selected, limits));
  const normalizedSelection = normalizeSelectionForSubmit(selection, selected?.sheet ?? selection.sheet);
  const validationIssue = getValidationIssue(selected, normalizedSelection, limits);
  const validationReason = validationIssue?.message ?? null;
  const valid = validationIssue === null;
  const canStart = access === "available" && !checkingAccess;
  const summary = tables ? getScopeSummary(selected, tables, normalizedSelection) : null;
  const exhausted = attemptLimitReached || (job?.attempts ?? 0) >= (job?.maxAttempts ?? limits.attempts);
  const jobFailureMessage = job?.error ? getFailureMessage(job.error) : "";
  const dailyLimitMessage = error === limitMessages["user-day"] || error === limitMessages["provider-day"];
  const quotaMessageExpired = retryAfter > 0 && !cooling && dailyLimitMessage;
  const retryTimeText = cooling && retryAfter > 0 ? formatRetryTime(retryAfter, localeTag()) : "";
  const showValidationHint = canStart && !exhausted && !cooling && Boolean(validationReason);
  const serverField = job?.selection && !exhausted && selected?.sourceId === job.sourceId && normalizedSelection.sheet === job.selection.sheet
    ? getServerErrorField(job.error) : null;
  const activeServerField = serverField === "numberFormat" && normalizedSelection.numberFormat === job?.selection?.numberFormat ? "numberFormat"
    : serverField === "unit" && normalizedSelection.unit === job?.selection?.unit ? "unit"
    : serverField === "measure" && normalizedSelection.valueColumn === job?.selection?.valueColumn && normalizedSelection.aggregation === job?.selection?.aggregation ? "measure"
    : serverField === "group" && normalizedSelection.groupColumn === job?.selection?.groupColumn ? "group"
    : serverField === "table" ? "table" : null;
  const fieldFeedback = (field: "table" | "measure" | "group" | "numberFormat" | "unit") => {
    if (showValidationHint && validationIssue?.field === field) return { invalid: true, describedBy: "ai-validation-status" };
    if (activeServerField === field) return { invalid: true, describedBy: "ai-job-status" };
    return { invalid: false, describedBy: undefined };
  };

  // Kullanıcının açık seçimi gönderilir; başlık, kaynak yolu, metrik veya prompt istemciden üretilmez.
  async function start() {
    if (!canStart || !selected || !valid || lifetime.current.starting || exhausted || cooling) return;
    lifetime.current.starting = true;
    setPending(true); setError(""); setCallableRetryAfter(0);
    try { await httpsCallable(getServices().functions, "startAnalysis", { timeout: 190_000 })({ id: analysis.id, sourceId: selected.sourceId, selection: normalizedSelection, locale: job?.status === "running" ? job.locale : getLocale() }); }
    catch (failure) {
      if (!lifetime.current.active) return;
      const details = (failure as { details?: { analysisFailure?: string; analysisAccess?: string; analysisLimit?: AnalysisLimit; retryAfter?: number } })?.details;
      const reason = details?.analysisFailure;
      const deadline = retryDeadline(details?.retryAfter);
      if (deadline > Date.now()) setCallableRetryAfter(deadline);
      if (details?.analysisAccess === "invite-required") {
        setAccess("invite-required");
        return;
      }
      if (reason === "configuration") setAccess("closed");
      const limit = details?.analysisLimit;
      if (limit === "attempts") setAttemptLimitReached(true);
      const limitMessage = limit && Object.prototype.hasOwnProperty.call(limitMessages, limit) ? limitMessages[limit] : "";
      setError(limitMessage || (reason ? getFailureMessage(reason) : userError(failure)));
    }
    finally { lifetime.current.starting = false; if (lifetime.current.active) setPending(false); }
  }

  // Tek yeniden yükleme isteği açar ve eski hatayı bekleme durumuyla değiştirir.
  function reload() {
    if (lifetime.current.reloading) return;
    lifetime.current.reloading = true;
    setError("");
    setRefresh(value => value + 1);
  }

  // Yeni davet varsa Firebase oturum bilgisini tazeler ve ücretli iş oluşturmadan tekrar tablo erişimini okur.
  async function recheckAccess() {
    if (!user || lifetime.current.reloading) return;
    lifetime.current.reloading = true;
    // Geciken önceki katalog yanıtı yeni erişim yenilemesinin durumunu ezemez.
    const reqId = ++catalogRequestId.current;
    setCheckingAccess(true);
    setError("");
    try {
      await user.getIdToken(true);
      if (lifetime.current.active && reqId === catalogRequestId.current) setRefresh(value => value + 1);
    } catch (failure) {
      if (!lifetime.current.active || reqId !== catalogRequestId.current) return;
      lifetime.current.reloading = false;
      setCheckingAccess(false);
      setAccess(null);
      setError(userError(failure));
    }
  }

  if (ready) return <div className="mt-7">{error ? <section className={panel}><p role="alert" className="text-sm text-destructive">{t(error)}</p><Button className="mt-4" variant="outline" onClick={reload}>{t("Yeniden yükle")}</Button></section> : artifact ? <Suspense fallback={<PageLoading label="Analiz yükleniyor…" />}><LiveAnalysisReport artifact={artifact} job={job!} analysisId={analysis.id} /></Suspense> : <PageLoading label="Analiz yükleniyor…" />}</div>;
  if (running || pending) {
    // Yeni deneme sunucu tarafından doğrulanana kadar önceki başarısız işin aşaması gösterilmez.
    const stages = ["calculating", "interpreting", "saving"] as const;
    const stage = running ? (job?.stage ?? "calculating") : null;
    const activeIndex = stage ? stages.indexOf(stage) : -1;
    const stageMessage = stage === null ? "Analiz isteği gönderiliyor…"
      : stage === "calculating" ? "Tablo hesaplanıyor."
      : stage === "interpreting" ? "Kaynaklı özet hazırlanıyor."
      : "Rapor kaydediliyor.";
    return <section className={`${panel} mt-7`} aria-labelledby="ai-progress-title" aria-busy="true"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-secondary"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><div><h2 id="ai-progress-title" className="text-lg font-semibold">{t("Analiziniz hazırlanıyor")}</h2><p role="status" className="mt-2 text-sm text-muted-foreground">{t(stageMessage)}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{t("Bu sayfadan ayrılabilirsiniz. Sonucu geçmişinizden açabilirsiniz; aynı isteği tekrarlamak yeni analiz başlatmaz.")}</p></div></div><ol className="mt-6 grid grid-cols-3 gap-3" aria-label={t("Analiz aşamaları")}>{["Hesaplar", "Özet", "Kayıt"].map((label, position) => <li key={label} aria-current={position === activeIndex ? "step" : undefined} className={`border-t-2 pt-3 text-xs ${activeIndex >= 0 && position <= activeIndex ? "border-primary font-medium text-primary dark:border-secondary dark:text-secondary" : "border-border text-muted-foreground"}`}><span className="inline-flex items-center gap-2">{activeIndex >= 0 && position < activeIndex ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : position === activeIndex ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{t(label)}</span></li>)}</ol></section>;
  }
  return <section className={`${panel} mt-7`} aria-labelledby="ai-setup-title"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-secondary"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary">{t("Kaynaklı analiz")}</p><h2 id="ai-setup-title" className="mt-1 text-xl font-semibold tracking-tight">{t("Tablodan net bir özet.")}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("Bir tablo ve ölçüm seçin. Hesaplar kaynak satırlarıyla doğrulanır; özet, analiz hedefinize göre hazırlanır.")}</p></div></div>
    {job && <p id="ai-job-status" role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-6"><TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" /><span>{t(exhausted ? "Bu çalışma için deneme sınırına ulaşıldı. Kaynaklarınız ve hazırlık özeti korunuyor." : jobFailureMessage || "Bu işlemden henüz sonuç alınamadı. Aynı kapsamla yeniden deneyebilirsiniz.")}{cooling && !dailyLimitMessage && <span className="mt-1 block">{retryTimeText ? t("Yeniden deneme {0} itibarıyla açılacak; işlem kendiliğinden başlamaz.", retryTimeText) : t("Yeniden deneme kısa bir süre sonra açılacak; işlem kendiliğinden başlamaz.")}</span>}</span></p>}
    {error && !quotaMessageExpired && !(job && (exhausted ? limitMessages.attempts === error : jobFailureMessage === error)) && <p role="alert" className="mt-4 text-sm text-destructive">{t(error)}{dailyLimitMessage && retryTimeText && <span className="mt-1 block text-xs text-muted-foreground">{t("Kota {0} itibarıyla yenilenir; işlem kendiliğinden başlamaz.", retryTimeText)}</span>}{!job && cooling && !dailyLimitMessage && retryTimeText && <span className="mt-1 block text-xs text-muted-foreground">{t("Yeniden deneme {0} itibarıyla açılacak; işlem kendiliğinden başlamaz.", retryTimeText)}</span>}</p>}
    {tables !== null && tables.length > 0 && !canStart && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
      <p id="table-access-status" role="status" className="text-sm leading-6 text-muted-foreground">
        {checkingAccess ? t("Tablo analizi erişimi kontrol ediliyor…") : access === "invite-required"
          ? t("Bu hesap tablo analizi betasına dahil değil. Hazırlanan belgeleri inceleyebilirsiniz.")
          : access === "closed" ? t("Tablo analizi şu anda kapalı. Hazırlanan belgeleri inceleyebilirsiniz.")
            : t("Tablo analizi erişimi doğrulanamadı. Yeniden kontrol edin.")}
      </p>
      <Button variant="outline" onClick={recheckAccess} disabled={checkingAccess}>{t("Erişimi kontrol et")}</Button>
    </div>}
    {tables === null ? <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">{error ? <Button variant="outline" onClick={reload}>{t("Tabloları yeniden yükle")}</Button> : <span role="status" className="inline-flex items-center gap-3"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />{t("Tablolar kontrol ediliyor…")}</span>}</div> : tables.length === 0 ? <p className="mt-5 text-sm leading-6 text-muted-foreground">{t("Bu ilk analiz sürümü CSV ve XLSX tablolarını kullanır. Diğer belgelerinizin hazırlık özetini aşağıda inceleyebilirsiniz.")}</p> : <>
      <div className="mt-6 space-y-6">
        {/* Bölüm 1: Veri kaynağı */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Database className="h-3.5 w-3.5 text-primary dark:text-secondary" aria-hidden="true" />
            <span>{t("1. İncelenecek veri kaynağı")}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ai-table" label="Analiz tablosu" value={selected ? tableIdentity(selected) : ""} placeholder="Tablo seç" disabled={exhausted} {...fieldFeedback("table")} onChange={value => { const nextTable = tables.find(table => tableIdentity(table) === value); setTableKey(value); setSelection(current => reconcileSelectionForTable(current, selected, nextTable)); setError(""); }} options={tables.map(table => ({ value: tableIdentity(table), label: formatTableLabel(table, tables) }))} />
            <div className="flex flex-col justify-end text-xs leading-5 text-muted-foreground">
              <p className="font-medium text-foreground">{selected ? t("{0} kayıt · {1} alan", selected.rows, selected.columns.length) : t("İncelemek istediğiniz tabloyu seçin.")}</p>
              <p className="mt-0.5 text-[11px]">{t("En fazla {0} kayıt ve {1} grup.", limits.rows, limits.groups)}</p>
            </div>
          </div>
          {selected && selected.columns.length > 0 && <TablePreview table={selected} label={formatTableLabel(selected, tables)} />}
        </div>

        {/* Bölüm 2: Ne hesaplanacak */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <PieChart className="h-3.5 w-3.5 text-primary dark:text-secondary" aria-hidden="true" />
            <span>{t("2. Hesaplama yöntemi ve ölçüm")}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ai-aggregation" label="Hesaplama" value={normalizedSelection.aggregation} disabled={!selected || tableUnavailable || exhausted} onChange={value => setSelection(current => ({ ...current, aggregation: value as TableSelection["aggregation"], valueColumn: value === "count" ? null : current.valueColumn, numberFormat: value === "count" ? "plain" : current.numberFormat, unit: value === "count" ? "count" : current.unit === "count" ? "number" : current.unit }))} options={[{ value: "sum", label: t("Toplam") }, { value: "mean", label: t("Ortalama") }, { value: "count", label: t("Kayıt sayısı") }]} />
            <Field id="ai-measure" label="Ölçüm alanı" value={normalizedSelection.valueColumn === null ? "" : String(normalizedSelection.valueColumn)} placeholder={normalizedSelection.aggregation === "count" ? "Dolu kayıtlar" : "Alan seç"} disabled={!selected || tableUnavailable || exhausted || normalizedSelection.aggregation === "count"} {...fieldFeedback("measure")} onChange={value => setSelection(current => ({ ...current, valueColumn: Number(value), groupColumn: current.groupColumn === Number(value) ? null : current.groupColumn }))} options={(selected?.columns ?? []).map((column, n) => ({ value: String(n), label: column }))} />
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">{normalizedSelection.aggregation === "count"
            ? t("Kayıt sayısı seçildiğinde boş olmayan tüm satırlar sayılır; ölçüm sütunu seçilmez.")
            : t("Her dolu satırda geçerli bir ölçüm değeri gerekir. Sayı biçimi ondalık ve binlik ayracını belirler.")}</p>
        </div>

        {/* Bölüm 3: Kapsam ve biçim */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary dark:text-secondary" aria-hidden="true" />
            <span>{t("3. Gruplama ve gösterim biçimi")}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ai-group" label="Gruplama" value={normalizedSelection.groupColumn === null ? "none" : String(normalizedSelection.groupColumn)} disabled={!selected || tableUnavailable || exhausted} {...fieldFeedback("group")} onChange={value => setSelection(current => ({ ...current, groupColumn: value === "none" ? null : Number(value) }))} options={[{ value: "none", label: t("Gruplama yok") }, ...(selected?.columns ?? []).map((column, n) => ({ value: String(n), label: column })).filter(option => Number(option.value) !== normalizedSelection.valueColumn)]} />
            <Field id="ai-number-format" label="Sayı biçimi" value={normalizedSelection.numberFormat} disabled={!selected || tableUnavailable || exhausted || normalizedSelection.aggregation === "count"} {...fieldFeedback("numberFormat")} onChange={value => setSelection(current => ({ ...current, numberFormat: value as TableSelection["numberFormat"] }))} options={[{ value: "plain", label: "1234.56" }, { value: "tr", label: "1.234,56" }, { value: "en", label: "1,234.56" }]} />
            <Field id="ai-unit" label="Birim" value={normalizedSelection.unit} disabled={!selected || tableUnavailable || exhausted || normalizedSelection.aggregation === "count"} {...fieldFeedback("unit")} onChange={value => setSelection(current => ({ ...current, unit: value as TableSelection["unit"] }))} options={[{ value: "number", label: t("Sayı") }, { value: "count", label: t("kayıt", 2) }, { value: "TRY", label: "TRY · ₺" }, { value: "USD", label: "USD · $" }, { value: "EUR", label: "EUR · €" }, { value: "percent", label: "%" }].filter(option => normalizedSelection.aggregation === "count" || option.value !== "count")} />
          </div>
        </div>
      </div>

      {/* Seçili Kapsam Özeti */}
      {summary && (
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 text-xs dark:border-secondary/20 dark:bg-secondary/[0.03]" aria-label={t("Kapsam özeti")}>
          <p className="font-semibold text-primary dark:text-secondary">{t("Kapsam özeti")}</p>
          <div className="mt-2 grid grid-cols-1 gap-3 text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground/85">{t("Kaynak:")}</span>
              <strong className="block font-medium text-foreground [overflow-wrap:anywhere]"><bdi dir="auto">{summary.source}</bdi></strong>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground/85">{t("Hesap:")}</span>
              <strong className="block font-medium text-foreground [overflow-wrap:anywhere]"><bdi dir="auto">{summary.operation}</bdi></strong>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground/85">{t("Gruplama:")}</span>
              <strong className="block font-medium text-foreground [overflow-wrap:anywhere]"><bdi dir="auto">{summary.group}</bdi></strong>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground/85">{t("Gösterim:")}</span>
              <strong className="block font-medium text-foreground [overflow-wrap:anywhere]"><bdi dir="auto">{summary.format}</bdi></strong>
            </div>
          </div>
        </div>
      )}

      {/* Alt Eylem ve Durum Çubuğu */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div className="text-xs leading-6 text-muted-foreground">
          {canStart && !exhausted && !cooling && (validationReason ? (
            <p id="ai-validation-status" className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{validationReason}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">{valid ? t("Analiz oluşturulmaya hazır.") : t("Seçimlerinizi tamamlayın.")}</p>
          ))}
        </div>
        <Button onClick={start} disabled={!canStart || !valid || exhausted || cooling} aria-describedby={!canStart ? "table-access-status" : showValidationHint ? "ai-validation-status" : job && (exhausted || cooling) ? "ai-job-status" : undefined} className="min-h-11 gap-2">
          {job ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {cooling && !dailyLimitMessage ? t("Kısa bir süre bekleyin") : job ? t("Yeniden dene") : t("Analizi oluştur")}
          <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        </Button>
      </div>
      <details className="mt-4 text-xs text-muted-foreground"><summary className="w-fit cursor-pointer rounded py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("Nasıl hesaplanır?")}</summary><div className="mt-2 max-w-3xl space-y-2 leading-6"><p className="flex items-start gap-2"><ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t("Yalnız seçilen tablo işlenir. Ölçüm, birim ve sayı biçimi tahmin edilmez; eksik veya geçersiz ölçüm hücreleri hesaplamayı durdurur.")}</p><p>{t("Seçilen tablo ve doğrulanmış hesaplar yapay zekâ özetinde kullanılır. Diğer belgeler bu analizin kapsamına eklenmez.")}</p><p>{t("Parasal sonuçlar iki, diğer sonuçlar altı ondalık hanede yuvarlanır. Tamamen boş satırlar kayıt sayısına dahil edilmez.")}</p></div></details>
    </>}
  </section>;
}
