import { createContext, useContext } from "react";
import type { ColumnMapping, CreateAnalysis } from "../../functions/src/contracts";
import type { useFileSelectionState } from "../hooks/use-file-selection";
export interface Draft {
  title: string; business: string; currency: CreateAnalysis["currency"];
  mappings: Record<string, ColumnMapping>;
}
export interface WorkspaceState {
  selection: ReturnType<typeof useFileSelectionState>;
  draft: Draft;
  setDraft: (update: (draft: Draft) => Draft) => void;
  busy: boolean; progress: number; error: string; activeId: string;
  start: () => Promise<string | undefined>;
  cancel: () => void;
}
export const WorkspaceContext = createContext<WorkspaceState | null>(null);
// Dosya ve form durumunu rota yaşam döngüsünden ayırır.
export function useWorkspace() {
  const state = useContext(WorkspaceContext);
  if (!state) throw new Error("WorkspaceProvider gerekli.");
  return state;
}
