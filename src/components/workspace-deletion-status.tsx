import { useWorkspaceDeletion } from "../lib/workspace-deletion-context";
import { t, useLocale } from "../i18n/runtime";
import { OperationStatus } from "./operation-status";
import { Button } from "./ui/button";

// Onay penceresi kapandıktan sonra çalışma alanında silme durumunu ve sonucu gösterir.
export function WorkspaceDeletionStatus() {
  useLocale();
  const { result, accountPending, accountError, dismiss } = useWorkspaceDeletion();
  if (accountPending) return <div className="mb-5"><OperationStatus>{t("Hesap siliniyor…")} {t("Bu sırada çalışma alanında gezinebilirsiniz.")}</OperationStatus></div>;
  if (!result && !accountError) return null;
  const failed = result?.failed[0];
  return <div className="mb-5 flex items-start justify-between gap-2 rounded-xl border border-border bg-card p-3">
    <p className="min-w-0 break-words px-1 py-1 text-sm leading-6" role={failed || accountError ? "alert" : "status"}>
      {accountError && <span>{t(accountError)} </span>}
      {result && result.deleted > 0 && t("{0} analiz ve kaynak belgeleri silindi.", result.deleted)}{" "}
      {result && failed && <>{t("{0} analiz silinemedi.", result.failed.length)} <bdi>{failed.title}</bdi> · {t(failed.reason)}</>}
    </p>
    <Button variant="ghost" size="sm" onClick={dismiss}>{t("Kapat")}</Button>
  </div>;
}
