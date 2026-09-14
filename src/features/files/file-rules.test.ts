import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  getFileCategory,
  getFileExtension,
  getFileIdentity,
  isSupportedFile,
  validateFileSelection,
} from "./file-rules";

// Testlerde kararlı ad, boyut ve tarih taşıyan tarayıcı dosyaları üretir.
function createFile(name: string, size = 4, lastModified = 1) {
  return new File(["x".repeat(size)], name, { lastModified });
}

describe("file rules", () => {
  it("prototip anahtarlarını dosya uzantısı olarak kabul etmez", () => {
    for (const extension of ["constructor", "__proto__", "prototype"]) {
      expect(isSupportedFile(createFile(`veri.${extension}`))).toBe(false);
    }
  });
  it("desteklenen uzantıları büyük-küçük harften bağımsız sınıflandırır", () => {
    const spreadsheet = createFile("Aylık Rapor.XLSX");
    const image = createFile("grafik.PNG");

    expect(getFileExtension(spreadsheet.name)).toBe("xlsx");
    expect(isSupportedFile(spreadsheet)).toBe(true);
    expect(getFileCategory(spreadsheet)).toBe("Tablo");
    expect(getFileCategory(image)).toBe("Görsel");
    expect(isSupportedFile(createFile("calistir.exe"))).toBe(false);
  });

  it("yinelenen ve desteklenmeyen dosyaları reddederken geçerli dosyaları korur", () => {
    const existingFile = createFile("mevcut.pdf", 10, 10);
    const existing = [{ id: getFileIdentity(existingFile), file: existingFile, category: "Tablo" as const }];
    const duplicate = createFile("mevcut.pdf", 10, 10);
    const unsupported = createFile("program.exe");
    const valid = createFile("sunum.pptx");

    const result = validateFileSelection(existing, [duplicate, unsupported, valid]);

    expect(result.accepted.map(({ file }) => file.name)).toEqual(["sunum.pptx"]);
    expect(result.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ fileName: "mevcut.pdf", reason: "Bu dosya zaten seçili." }),
      expect.objectContaining({ fileName: "program.exe", reason: "Bu dosya türü şu anda desteklenmiyor." }),
    ]));
  });

  it("plan sınırını aynı seçim grubunda da uygular", () => {
    const files = Array.from({ length: 11 }, (_, index) => createFile(`belge-${index}.pdf`, index + 1, index));
    const result = validateFileSelection([], files, 10);

    expect(result.accepted).toHaveLength(10);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toContain("en fazla 10 dosya");
  });

  it("dosya boyutlarını okunabilir biçimde gösterir", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
