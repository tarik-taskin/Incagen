import { PLAN_RULES } from "../plans/plan-rules";
import {
  getSupportedExtension,
  LIMITS,
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_FILE_FORMATS,
  type DocumentCategory,
} from "../../../functions/src/contracts";

export const FREE_PLAN_FILE_LIMIT: number = PLAN_RULES.free.filesPerAnalysis;

export const SUPPORTED_FILE_ACCEPT = SUPPORTED_FILE_EXTENSIONS
  .map((extension) => `.${extension}`)
  .join(",");

export type FileCategory = DocumentCategory;

export interface PreparedFile {
  id: string;
  file: File;
  category: FileCategory;
}

export interface FileRejection {
  id: string;
  fileName: string;
  reason: string;
}

// Dosya adındaki son uzantıyı küçük harfli ve karşılaştırılabilir biçimde döndürür.
export function getFileExtension(fileName: string) {
  const finalDot = fileName.lastIndexOf(".");
  return finalDot > -1 ? fileName.slice(finalDot + 1).toLowerCase() : "";
}

// Dosyanın desteklenen ürün formatlarından birine ait olup olmadığını istemci tarafında kontrol eder.
export function isSupportedFile(file: File) {
  return getSupportedExtension(file.name) !== null;
}

// Dosyayı arayüzde gösterilecek iş verisi kategorisine eşler.
export function getFileCategory(file: File): FileCategory {
  const extension = getSupportedExtension(file.name);
  return extension ? SUPPORTED_FILE_FORMATS[extension].category : "Belge";
}

// Aynı dosyanın tek seçimde veya sonraki seçimlerde tekrar eklenmesini belirlemek için kararlı bir kimlik üretir.
export function getFileIdentity(file: File) {
  return `${file.name.toLocaleLowerCase("tr-TR")}::${file.size}::${file.lastModified}`;
}

// Bayt değerini kullanıcıya okunabilir kısa bir dosya boyutuna dönüştürür.
export function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

// Yeni seçimi format, tekrar ve plan sınırı kurallarına göre kabul edilenler ile reddedilenlere ayırır.
export function validateFileSelection(
  existingFiles: PreparedFile[],
  incomingFiles: File[],
  limit = FREE_PLAN_FILE_LIMIT,
) {
  const accepted: PreparedFile[] = [];
  const rejected: FileRejection[] = [];
  const knownIds = new Set(existingFiles.map(({ id }) => id));
  let selectedBytes = existingFiles.reduce((total, { file }) => total + file.size, 0);

  incomingFiles.forEach((file, index) => {
    const id = getFileIdentity(file);
    let reason = "";

    if (!isSupportedFile(file)) {
      reason = "Bu dosya türü şu anda desteklenmiyor.";
    } else if (file.size === 0) {
      reason = "Dosya boş olamaz.";
    } else if (knownIds.has(id)) {
      reason = "Bu dosya zaten seçili.";
    } else if (existingFiles.length + accepted.length >= limit) {
      reason = `Free planda bir analiz için en fazla ${limit} dosya seçebilirsiniz.`;
    } else if (selectedBytes + file.size > LIMITS.totalBytes) {
      reason = `Free planda bir analizdeki belgelerin toplamı ${LIMITS.totalBytes / 1024 ** 2} MB sınırını aşamaz.`;
    }

    if (reason) {
      rejected.push({ id: `${id}::${index}::${reason}`, fileName: file.name, reason });
      return;
    }

    knownIds.add(id);
    selectedBytes += file.size;
    accepted.push({ id, file, category: getFileCategory(file) });
  });

  return { accepted, rejected };
}
