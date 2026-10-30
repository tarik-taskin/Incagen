import { t, useLocale } from "../i18n/runtime";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Check, Pencil, Sparkles, Target } from "lucide-react";
import { ANALYSIS_OBJECTIVE_MAX_LENGTH } from "../../functions/src/contracts";
import { FileDropzone } from "../components/upload/file-dropzone";
import { SelectedFileList } from "../components/upload/selected-file-list";
import { PreparationProgress } from "../components/upload/preparation-progress";
import { DraftReadiness, SelectionSummary } from "../components/upload/preparation-summary";
import { getPreparationState, type DraftField } from "../features/files/preparation-state";
import { Button } from "../components/ui/button";
import { FREE_PLAN_FILE_LIMIT } from "../features/files/file-rules";
import { suggestAnalysisTitle } from "../features/files/title-suggestion";
import { useWorkspace } from "../lib/workspace-context";
import { tr } from "../i18n/tr";

// Farklı iş belgesi türlerini analiz hazırlığı ve güvenli yerel yükleme akışında birleştirir.
export function NewAnalysisPage() {
  useLocale();
  const { selection, draft, setDraft, canUndoObjectiveExample, applyObjectiveExample, undoObjectiveExample, busy, phase, error, activeId, start, completeDraft, cancel } = useWorkspace();
  const { files, rejections, addFiles, removeFile, clearFiles, dismissRejections } = selection;
  const navigate = useNavigate();
  const [editingBusiness, setEditingBusiness] = useState(() => !draft.business);
  const [attempted, setAttempted] = useState(false);
  const preparation = getPreparationState(files, draft);
  const localError = attempted ? preparation.firstInvalidField?.message : undefined;
  const suggestedTitle = files.length > 0 ? suggestAnalysisTitle(files[0].file.name) : "";
  const showSuggestion = Boolean(suggestedTitle && draft.title.trim() !== suggestedTitle && !busy);
  // Kapalı çalışma alanı özetini gerektiğinde açar ve ilk eksik alana odağı taşır.
  function focusField(field: DraftField) {
    if (field === "business") setEditingBusiness(true);
    requestAnimationFrame(() => document.getElementById({ business: "business-name", title: "analysis-title", objective: "analysis-objective" }[field])?.focus());
  }
  // Başarılı hazırlığın kaydını açar; hata durumunda kullanıcının taslağını korur.
  async function submit() {
    setAttempted(true);
    if (preparation.firstInvalidField) { focusField(preparation.firstInvalidField.field); return; }
    const result = await start();
    if (result) {
      if (result.ready) completeDraft();
      setAttempted(false);
      navigate("/app/analyses/" + result.id);
    }
  }
  return <section aria-labelledby="new-analysis-title">
    <p className="text-sm font-semibold text-primary dark:text-secondary">{t("Yeni analiz · Free")}</p>
    <h1 id="new-analysis-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{t(tr.analysis.title)}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{t("Belgelerinizi, tablolarınızı, sunumlarınızı, veri dosyalarınızı ve görsellerinizi tek analiz alanında bir araya getirin.")}</p>
    <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-6">
        <SelectionSummary count={files.length} state={preparation} />
        <FileDropzone disabled={busy || files.length >= FREE_PLAN_FILE_LIMIT} onFilesSelected={addFiles} />
        {rejections.length > 0 && <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
          <h2 className="font-semibold">{t("Bazı dosyalar eklenemedi")}</h2>
          <ul className="mt-2 space-y-1">{rejections.map(r => <li key={r.id} className="break-words">{r.fileName}: {t(r.reason)}</li>)}</ul>
          <Button variant="ghost" onClick={dismissRejections}>{t("Bildirimi kapat")}</Button>
        </div>}
        <fieldset disabled={busy} className="min-w-0">
          <SelectedFileList files={files} limit={FREE_PLAN_FILE_LIMIT} onClear={() => { if (!busy) clearFiles(); }} onRemove={id => { if (!busy) removeFile(id); }} />
        </fieldset>
      </div>
      <aside className="surface rounded-3xl border border-border bg-card p-5 shadow-sm xl:sticky xl:top-24" aria-label={t("Analiz ayarları")}>
        <h2 className="text-lg font-semibold">{t("Çalışma ayrıntıları")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Kaynaklarınızı doğru çalışma alanında, konuya özel bir başlıkla düzenleyin.")}</p>
        <div className="mt-5 rounded-2xl border border-border bg-muted/35 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Building2 className="h-4 w-4" aria-hidden="true" />  {t("Çalışma alanı")}</div>
          {editingBusiness ? (
            <div className="mt-3">
              <label htmlFor="business-name" className="block text-sm font-medium">{t(tr.analysis.business)}</label>
              <input id="business-name" className="form-control mt-1.5" maxLength={100} value={draft.business} disabled={busy} aria-invalid={attempted && !preparation.fields[0].valid} aria-describedby={attempted && preparation.firstInvalidField?.field === "business" ? "preparation-error" : undefined} placeholder={t("Örn. İşletmenizin adı")} onChange={e => setDraft(d => ({ ...d, business: e.target.value }))} />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("Bir kez belirtin; sonraki çalışmalarınızda burada hazır kalsın.")}</p>
              {draft.business.trim() && <button type="button" disabled={busy} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary" onClick={() => setEditingBusiness(false)}><Check className="h-3.5 w-3.5" aria-hidden="true" />  {t("Bu adı kullan")}</button>}
            </div>
          ) : (
            <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold" title={draft.business}>{draft.business}</p>
              <button type="button" disabled={busy} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary" onClick={() => setEditingBusiness(true)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />  {t("Değiştir")}</button>
            </div>
          )}
        </div>
        <fieldset disabled={busy} className="mt-5">
          <label className="block text-sm font-medium">{t(tr.analysis.titleLabel)}<input id="analysis-title" className="form-control mt-1.5" maxLength={100} value={draft.title} aria-invalid={attempted && !preparation.fields[1].valid} aria-describedby={attempted && preparation.firstInvalidField?.field === "title" ? "preparation-error" : showSuggestion ? "title-suggestion-hint" : undefined} placeholder={t("Örn. Müşteri geri bildirimleri")} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} /></label>
          {showSuggestion && (
            <div id="title-suggestion-hint" className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0">{t("Öneri:")}</span>
              <button
                type="button"
                className="inline-flex min-h-7 items-center rounded-md border border-primary/20 bg-primary/[0.04] px-2 py-0.5 font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-secondary/25 dark:bg-secondary/[0.06] dark:text-secondary dark:hover:bg-secondary/15"
                onClick={() => setDraft(d => ({ ...d, title: suggestedTitle }))}
                title={t("Önerilen başlığı kullan")}
              >
                <Sparkles className="me-1 h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="max-w-[200px] truncate sm:max-w-[240px]">{suggestedTitle}</span>
              </button>
            </div>
          )}
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("Konuyu anlatan kısa bir başlık seçin; çalışmanızı geçmişte bu adla bulacaksınız.")}</p>
          <div className="mt-5 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="analysis-objective" className="flex items-center gap-2 text-sm font-medium"><Target className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" />  {t("Analiz hedefi")}</label>
            </div>
            <textarea id="analysis-objective" className="form-control mt-2 min-h-28 resize-y text-sm leading-6" rows={3} required maxLength={ANALYSIS_OBJECTIVE_MAX_LENGTH} value={draft.objective} aria-invalid={attempted && !preparation.fields[2].valid} placeholder={t("Bu belgelerden ne öğrenmek istiyorsunuz?")} aria-describedby={`objective-help objective-count${attempted && preparation.firstInvalidField?.field === "objective" ? " preparation-error" : ""}`} onChange={e => setDraft(d => ({ ...d, objective: e.target.value }))} />
            <div className="mt-2 flex items-start justify-between gap-3 text-xs text-muted-foreground">
              <p id="objective-help" className="leading-5">{t("Yanıt aradığınız soruyu yazın. Hedefiniz bu çalışmayla birlikte saklanır.")}</p>
              <span id="objective-count" className="shrink-0 tabular-nums">{draft.objective.length}/{ANALYSIS_OBJECTIVE_MAX_LENGTH}</span>
            </div>
            <p className="mt-3 text-xs font-medium text-muted-foreground">{t("Başlangıç için bir örnek")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { label: "Satış değişimi", value: "Satışların dönemler arasında nasıl değiştiğini ve hangi kategorilerin öne çıktığını görmek istiyorum." },
                { label: "Müşteri geri bildirimleri", value: "Müşteri yorumlarındaki tekrar eden sorunları ve iyileştirme önceliklerini anlamak istiyorum." },
              ].map(example => <button key={example.label} type="button" className="min-h-9 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 dark:focus-visible:ring-secondary" onClick={() => applyObjectiveExample(t(example.value))}>{t(example.label)}</button>)}
            </div>
            {canUndoObjectiveExample && <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-x-3 rounded-xl bg-primary/[0.04] ps-3 pe-1 text-xs dark:bg-secondary/[0.05]"><span className="py-2 leading-5 text-muted-foreground">{t("Örnek hedef eklendi.")}</span><button type="button" onClick={() => { undoObjectiveExample(); focusField("objective"); }} className="min-h-10 rounded-lg px-2 font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary">{t("Geri al")}</button></div>}
          </div>
        </fieldset>
        <p className="mt-5 rounded-xl border border-primary/10 bg-primary/[0.04] px-3.5 py-3 text-xs leading-5 text-muted-foreground dark:border-secondary/15 dark:bg-secondary/[0.05]"><span className="font-semibold text-foreground">{t("Bir konuya odaklanın.")}</span>  {t("Müşteri geri bildirimleri ya da finans verileri gibi birbiriyle ilişkili belgeleri aynı analizde toplayın.")}</p>
        <DraftReadiness state={preparation} busy={busy} onFocusField={focusField} />
        <PreparationProgress />
        {(localError || error) && <p id="preparation-error" role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{localError || error}</p>}
        <Button className="mt-5 w-full" aria-describedby="preparation-help" disabled={busy || files.length === 0} onClick={submit}>{t(tr.analysis.start)}</Button>
        {busy && phase !== "preparing" && <Button variant="ghost" className="mt-2 w-full" onClick={cancel}>{t(tr.analysis.cancel)}</Button>}
        {activeId && <Link className="mt-4 block text-sm underline" to={"/app/analyses/" + activeId}>{t("Son işlemi aç")}</Link>}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("Hazırlama başladığında dosyaların gerçek içerik türü doğrulanır; okunabilir bölümler kaynakları korunarak düzenlenir. Yorum ve öneriler bu aşamada üretilmez.")}</p>
      </aside>
    </div>
  </section>;
}
