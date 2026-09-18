import yauzl from "yauzl";
import { PARSING_LIMITS } from "../contracts";
import { DocumentParseError } from "./common";

export interface ArchiveInspection {
  entries: Set<string>;
  uncompressedBytes: number;
}

// ZIP tabanlı Office dosyalarını açmadan önce yol, şifreleme ve genişleme sınırlarını doğrular.
export function inspectArchive(data: Buffer): Promise<ArchiveInspection> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(data, { lazyEntries: true, validateEntrySizes: true }, (openError, zip) => {
      if (openError || !zip) return reject(new DocumentParseError("Office belgesi geçerli bir ZIP paketi değil."));
      const entries = new Set<string>();
      let uncompressedBytes = 0;
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        zip.close();
        reject(new DocumentParseError(message));
      };
      zip.on("error", () => fail("Office arşivi okunamadı."));
      zip.on("entry", entry => {
        if (settled) return;
        const parts = entry.fileName.split("/");
        if (entry.fileName.includes("\\") || entry.fileName.startsWith("/") || /^[A-Za-z]:/.test(entry.fileName) || parts.includes("..")) return fail("Office arşivinde güvenli olmayan bir dosya yolu bulundu.");
        if ((entry.generalPurposeBitFlag & 0x1) !== 0) return fail("Parolalı Office belgeleri desteklenmiyor.");
        if (/vbaProject\.bin$/i.test(entry.fileName) || /^(word|xl|ppt)\/embeddings\//i.test(entry.fileName)) return fail("Makro veya gömülü çalıştırılabilir nesne içeren Office belgeleri desteklenmiyor.");
        entries.add(entry.fileName);
        uncompressedBytes += entry.uncompressedSize;
        if (entries.size > PARSING_LIMITS.archiveEntries || uncompressedBytes > PARSING_LIMITS.archiveUncompressedBytes) return fail("Office belgesi güvenli açılmış boyut sınırını aşıyor.");
        if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > 200) return fail("Office belgesinin sıkıştırma oranı güvenli sınırı aşıyor.");
        zip.readEntry();
      });
      zip.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({ entries, uncompressedBytes });
      });
      zip.readEntry();
    });
  });
}

// Arşivin beklenen modern Office ailesine ait temel kayıtları taşıdığını doğrular.
export function requireArchiveEntries(inspection: ArchiveInspection, required: string[], label: string) {
  if (!required.every(entry => inspection.entries.has(entry))) throw new DocumentParseError(`${label} dosyasının paket yapısı geçersiz.`);
}
