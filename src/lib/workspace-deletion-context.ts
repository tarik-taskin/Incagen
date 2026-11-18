import { createContext, useContext } from "react";

export type DeleteItem = { id: string; title: string };
export type DeletionResult = { deleted: number; failed: (DeleteItem & { reason: string })[] };

export const WorkspaceDeletionContext = createContext<{
  pendingIds: ReadonlySet<string>;
  progress: { done: number; total: number } | null;
  result: DeletionResult | null;
  remove: (items: DeleteItem[]) => Promise<DeletionResult | null>;
  accountPending: boolean;
  accountError: string;
  eraseAccount: () => Promise<void>;
  dismiss: () => void;
} | null>(null);

// Silme isteği ve sonucu, oturumdaki bütün çalışma alanı rotaları arasında paylaşılır.
export function useWorkspaceDeletion() {
  const context = useContext(WorkspaceDeletionContext);
  if (!context) throw new Error("WorkspaceDeletionProvider is missing.");
  return context;
}
