/**
 * İndirilen dosya baytlarının SHA-256 hash'ini Web Crypto API ile hesaplar
 * ve rapordaki beklenen hash değeriyle karşılaştırarak içerik bütünlüğünü doğrular.
 */
export async function verifySourceIntegrity(
  data: ArrayBuffer | Uint8Array,
  expectedSha256: string
): Promise<boolean> {
  if (!expectedSha256 || typeof expectedSha256 !== "string") {
    return false;
  }
  const buffer =
    data instanceof Uint8Array
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex.toLowerCase() === expectedSha256.trim().toLowerCase();
}
