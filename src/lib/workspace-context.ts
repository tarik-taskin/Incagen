import { createContext, useContext } from "react";
import type { useFileSelectionState } from "../hooks/use-file-selection";
export interface Draft {
  title: string;
  business: string;
  objective: string;
}
export type PreparationPhase = "idle" | "creating" | "uploading" | "preparing";
export interface UploadingFile { name: string; index: number; total: number }
export type PreparationOutcome =
  | { kind: "processing"; id: string }
  | { kind: "ready"; id: string }
  | { kind: "review"; id: string }
  | { kind: "cancelled"; id?: string; message: string }
  | { kind: "failed"; id?: string; message: string };
export interface WorkspaceState {
  selection: ReturnType<typeof useFileSelectionState>;
  draft: Draft;
  setDraft: (update: (draft: Draft) => Draft) => void;
  canUndoObjectiveExample: boolean;
  applyObjectiveExample: (objective: string) => void;
  undoObjectiveExample: () => void;
  busy: boolean; progress: number; error: string; activeId: string;
  draftAnalysisId: string;
  phase: PreparationPhase;
  uploadingFile: UploadingFile | null;
  outcome: PreparationOutcome | null;
  dismissOutcome: () => void;
  start: () => Promise<{ id: string; ready: boolean } | undefined>;
  completeDraft: (analysisId: string) => void;
  cancel: () => void;
}
export const WorkspaceContext = createContext<WorkspaceState | null>(null);
// Dosya ve form durumunu rota yaşam döngüsünden ayırır.
export function useWorkspace() {
  const state = useContext(WorkspaceContext);
  if (!state) throw new Error("WorkspaceProvider gerekli.");
  return state;
}
