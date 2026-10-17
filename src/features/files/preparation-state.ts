import { localeTag } from "../../i18n/runtime";
import { ANALYSIS_OBJECTIVE_MAX_LENGTH, createSchema, LIMITS } from "../../../functions/src/contracts";
import type { Draft } from "../../lib/workspace-context";
import type { PreparedFile } from "./file-rules";

export type DraftField = keyof Draft;
const fieldDefinitions: Array<{ field: DraftField; label: string; message: string }> = [
  { field: "business", label: "Çalışma alanı", message: "Çalışma alanınız için işletme adını belirtin (en fazla 100 karakter)." },
  { field: "title", label: "Analiz başlığı", message: "Çalışmanızı bulabilmek için bir analiz başlığı yazın (en fazla 100 karakter)." },
  { field: "objective", label: "Analiz hedefi", message: `Analiz hedefini belirtin (en fazla ${ANALYSIS_OBJECTIVE_MAX_LENGTH} karakter).` },
];

// Hazırlık durumunu ortak sunucu alan kuralları ve seçili dosyaların gerçek baytlarından türetir.
export function getPreparationState(files: PreparedFile[], draft: Draft) {
  const fields = fieldDefinitions.map(item => ({ ...item, valid: createSchema.shape[item.field].safeParse(draft[item.field]).success }));
  const totalBytes = files.reduce((total, item) => total + item.file.size, 0);
  const withinCapacity = files.length <= LIMITS.files && totalBytes <= LIMITS.totalBytes;
  return {
    fields, totalBytes, remainingBytes: Math.max(0, LIMITS.totalBytes - totalBytes),
    remainingFiles: Math.max(0, LIMITS.files - files.length), withinCapacity,
    ready: files.length > 0 && withinCapacity && fields.every(item => item.valid),
    firstInvalidField: fields.find(item => !item.valid),
  };
}

// Kapasiteyi Türkçe sayı biçimiyle gösterir; küçük dosyaları sıfır MB gibi sunmaz.
export function formatCapacity(bytes: number) {
  const unit = bytes >= 1024 ** 2 ? "MB" : bytes >= 1024 ? "KB" : "B";
  const divisor = unit === "MB" ? 1024 ** 2 : unit === "KB" ? 1024 : 1;
  return `${new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 1 }).format(bytes / divisor)} ${unit}`;
}
