import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { useOutsideDismiss } from "../hooks/use-outside-dismiss";
import { t, useLocale } from "../i18n/runtime";
import { useWorkspaceDeletion, type DeleteItem, type DeletionResult } from "../lib/workspace-deletion-context";
import { Button } from "./ui/button";

type AnalysisDeleteDialogProps = {
  idPrefix: string;
  items: DeleteItem[] | null;
  description: string;
  disabled?: boolean;
  openerElement?: HTMLElement | null;
  fallbackFocus?: () => HTMLElement | null;
  onClose: () => void;
  onSuccess: (result: DeletionResult) => void;
  onFailure?: (result: DeletionResult) => void;
};

type OpenDialogProps = Omit<AnalysisDeleteDialogProps, "items"> & {
  items: DeleteItem[];
};

// Odak dönüşünde yalnızca görünür, bağlı ve etkinleştirilebilir hedefleri seçer.
function isFocusableElement(element: HTMLElement | null | undefined): element is HTMLElement {
  if (!element || !element.isConnected) return false;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return false;
  if (element.closest("[hidden], [inert]")) return false;
  return true;
}

// Onay penceresini yalnız açıldığında bağlar; kapatmada modal katmanı ve durumu sıfırlanır.
export function AnalysisDeleteDialog(props: AnalysisDeleteDialogProps) {
  if (!props.items) return null;
  return <OpenAnalysisDeleteDialog {...props} items={props.items} />;
}

// Tekli ve toplu analiz silme onayını, düğme içi gerçek ilerlemeyi, odak dönüşünü ve kısmi hata tekrarını yönetir.
function OpenAnalysisDeleteDialog({
  idPrefix,
  items,
  description,
  disabled = false,
  openerElement = null,
  fallbackFocus,
  onClose,
  onSuccess,
  onFailure,
}: OpenDialogProps) {
  useLocale();
  const { progress, accountPending, remove } = useWorkspaceDeletion();
  const [activeItems, setActiveItems] = useState<DeleteItem[]>(items);
  const [failure, setFailure] = useState<DeletionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const capturedOpenerRef = useRef<HTMLElement | null>(null);
  const dismissReasonRef = useRef<"dismissed" | "succeeded" | null>(null);
  const focusTargetsRef = useRef<{ opener: HTMLElement | null; fallback?: () => HTMLElement | null }>({
    opener: openerElement,
    fallback: fallbackFocus,
  });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    focusTargetsRef.current = { opener: openerElement, fallback: fallbackFocus };
  }, [openerElement, fallbackFocus]);

  useEffect(() => {
    mountedRef.current = true;
    if (!capturedOpenerRef.current && document.activeElement instanceof HTMLElement) {
      capturedOpenerRef.current = document.activeElement;
    }
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    }
    return () => {
      mountedRef.current = false;
      if (dialog?.open) dialog.close();
      if (dismissReasonRef.current === "dismissed") {
        const { opener, fallback } = focusTargetsRef.current;
        const candidate = opener ?? capturedOpenerRef.current;
        const target = isFocusableElement(candidate) ? candidate : fallback?.() ?? null;
        if (isFocusableElement(target)) target.focus();
      }
    };
  }, []);

  // İşlem sürerken veya hata görünümüne geçerken klavye odağını modal içinde tutar.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (submitting) {
      if (document.activeElement && dialog.contains(document.activeElement)) dialog.focus();
      return;
    }
    if (failure) retryRef.current?.focus();
  }, [submitting, failure]);

  function dismissDialog() {
    if (submittingRef.current) return;
    dismissReasonRef.current = "dismissed";
    onClose();
  }

  useOutsideDismiss(dialogRef, dismissDialog, !submitting);

  // Yalnız onay veya yeniden deneme isteği tamamlanınca diyaloğu kapatır; kısmi hatada başarısızları korur.
  async function confirmDeletion() {
    if (submittingRef.current || disabled || accountPending || progress !== null || activeItems.length === 0) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFailure(null);
    const batch = activeItems;
    try {
      const result = await remove(batch);
      if (!mountedRef.current || !result) return;
      if (result.failed.length === 0) {
        dismissReasonRef.current = "succeeded";
        onSuccess(result);
        return;
      }
      setActiveItems(result.failed.map(({ id, title }) => ({ id, title })));
      setFailure(result);
      onFailure?.(result);
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }

  const total = activeItems.length;
  const step = Math.min((progress?.done ?? 0) + 1, Math.max(total, 1));
  const titleId = `${idPrefix}-title`;
  const descriptionId = `${idPrefix}-description`;

  const heading = failure
    ? (failure.failed.length === 1 && failure.deleted === 0
      ? t("Analiz silinemedi.")
      : t("{0} analiz silinemedi.", failure.failed.length))
    : (total === 1
      ? t("Bu analizi silmek istiyor musunuz?")
      : t("{0} analizi silmek istiyor musunuz?", total));

  const bodyText = failure
    ? (failure.deleted > 0
      ? `${t("{0} analiz ve kaynak belgeleri silindi.", failure.deleted)} ${t("Yalnız başarısız kayıtları yeniden deneyebilir veya pencereyi kapatabilirsiniz.")}`
      : t("Yalnız başarısız kayıtları yeniden deneyebilir veya pencereyi kapatabilirsiniz."))
    : t(description);

  const actionLabel = submitting
    ? (total === 1 ? t("Siliniyor…") : t("Siliniyor… {0}/{1}", step, total))
    : failure
      ? (failure.failed.length > 1 ? t("Başarısızları yeniden dene") : t("Yeniden dene"))
      : (total === 1 ? t("Analizi sil") : t("{0} analizi sil", total));

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={event => {
        event.preventDefault();
        dismissDialog();
      }}
      onClose={event => {
        if (!mountedRef.current) return;
        if (submittingRef.current) {
          if (!event.currentTarget.open) event.currentTarget.showModal();
          return;
        }
        // React StrictMode temizliğindeki gecikmeli native close olayı yeniden açılan diyaloğu kapatmasın.
        if (event.currentTarget.open) return;
        dismissDialog();
      }}
      className="surface w-[min(92vw,30rem)] max-w-none overscroll-contain rounded-3xl border border-border bg-card p-0 text-foreground shadow-2xl focus:outline-none backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 sm:p-7">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-700 dark:text-red-300">
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 id={titleId} className="mt-5 text-start text-xl font-semibold">{heading}</h2>
        <p id={descriptionId} className="mt-2 text-start text-sm leading-6 text-muted-foreground">{bodyText}</p>

        {submitting && (
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {total === 1 ? t("Analiz siliniyor…") : t("Siliniyor: {0}/{1}", step, total)}
          </p>
        )}

        {failure ? (
          <div
            role="alert"
            className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3.5 text-sm leading-6 text-red-700 dark:text-red-300"
          >
            <ul className="space-y-1.5 text-start">
              {failure.failed.map(item => (
                <li key={item.id} className="break-words">
                  <span className="font-medium"><bdi>{item.title}</bdi></span> · {t(item.reason)}
                </li>
              ))}
            </ul>
          </div>
        ) : total === 1 && activeItems[0] ? (
          <p className="mt-4 break-words rounded-xl bg-muted px-4 py-3 text-start text-sm font-medium">
            <bdi>{activeItems[0].title}</bdi>
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={submitting}
            onClick={dismissDialog}
          >
            {failure ? t("Kapat") : t("Vazgeç")}
          </Button>
          <Button
            ref={retryRef}
            type="button"
            className="gap-2 rounded-xl bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
            disabled={submitting || disabled || accountPending || (progress !== null && !submitting)}
            onClick={confirmDeletion}
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : failure ? (
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{actionLabel}</span>
          </Button>
        </div>
      </div>
    </dialog>
  );
}
