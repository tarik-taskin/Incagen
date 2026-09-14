import { useReducer } from "react";
import {
  FREE_PLAN_FILE_LIMIT,
  validateFileSelection,
  type FileRejection,
  type PreparedFile,
} from "../features/files/file-rules";

interface FileSelectionState {
  files: PreparedFile[];
  rejections: FileRejection[];
}

type FileSelectionAction =
  | { type: "add"; files: File[]; limit: number }
  | { type: "remove"; id: string }
  | { type: "clear" }
  | { type: "dismiss-rejections" };

const initialState: FileSelectionState = { files: [], rejections: [] };

// Dosya seçimi durumunu tek noktada ve öngörülebilir eylemlerle günceller.
function fileSelectionReducer(state: FileSelectionState, action: FileSelectionAction): FileSelectionState {
  if (action.type === "add") {
    const { accepted, rejected } = validateFileSelection(state.files, action.files, action.limit);
    return { files: [...state.files, ...accepted], rejections: rejected };
  }

  if (action.type === "remove") {
    return { ...state, files: state.files.filter(({ id }) => id !== action.id) };
  }

  if (action.type === "dismiss-rejections") {
    return { ...state, rejections: [] };
  }

  return initialState;
}

// Dosya ekleme, kaldırma, temizleme ve son doğrulama hatalarını sayfadan bağımsız yönetir.
export function useFileSelectionState(limit = FREE_PLAN_FILE_LIMIT) {
  const [state, dispatch] = useReducer(fileSelectionReducer, initialState);

  return {
    ...state,
    addFiles: (files: File[]) => dispatch({ type: "add", files, limit }),
    removeFile: (id: string) => dispatch({ type: "remove", id }),
    clearFiles: () => dispatch({ type: "clear" }),
    dismissRejections: () => dispatch({ type: "dismiss-rejections" }),
  };
}
