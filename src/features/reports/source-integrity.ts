/**
 * Dosya indirme sürecinde oluşabilecek kontrollü hata nedenleri.
 */
export type DownloadFailureReason =
  | "integrity_failed"
  | "cancelled"
  | "invalid_session"
  | "invalid_source"
  | "network_error";

/**
 * İndirme sürecindeki hataları tipli ve kullanıcıya sızmayacak şekilde sarmalayan hata sınıfı.
 */
export class DownloadError extends Error {
  readonly reason: DownloadFailureReason;

  constructor(reason: DownloadFailureReason, message?: string) {
    super(message ?? reason);
    this.name = "DownloadError";
    this.reason = reason;
  }
}

/**
 * İndirilen dosya baytlarının SHA-256 hash'ini Web Crypto API ile hesaplar
 * ve rapordaki beklenen hash değeriyle karşılaştırarak içerik bütünlüğünü doğrular.
 * ArrayBufferView dilimlerini (byteOffset ve byteLength) doğru yalıtır ve Web Crypto hatalarını yakalar.
 */
export async function verifySourceIntegrity(
  data: ArrayBuffer | Uint8Array,
  expectedSha256: string
): Promise<boolean> {
  if (!expectedSha256 || typeof expectedSha256 !== "string" || !data) {
    return false;
  }
  try {
    let sourceBuffer: BufferSource;
    if (ArrayBuffer.isView(data)) {
      // Dilimlenmiş TypedArray durumunda yalnız ilgili aralığı içeren kopya üret
      sourceBuffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
    } else {
      sourceBuffer = data;
    }

    const hashBuffer = await crypto.subtle.digest("SHA-256", sourceBuffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex.toLowerCase() === expectedSha256.trim().toLowerCase();
  } catch {
    // Web Crypto API veya bellek hatalarında güvenle false dön
    return false;
  }
}
