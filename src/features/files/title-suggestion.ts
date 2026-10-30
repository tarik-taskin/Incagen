/**
 * İlk seçilen dosyanın adından sade ve okunabilir bir analiz başlığı önerir.
 * Dosya uzantısını kaldırır; alt çizgi, tire, nokta ve fazla boşlukları düzenler.
 * Kullanıcı metnini çevirmez veya harici servis çağırmaz.
 */
export function suggestAnalysisTitle(fileName: string | undefined | null): string {
  if (!fileName || typeof fileName !== "string") return "";

  // 1. Dosya uzantısını kaldır (.xlsx, .pdf, .docx, .tar.gz vb.)
  const withoutExt = fileName.replace(/\.[a-zA-Z0-9]+$/, "");

  // 2. Alt çizgi, tire ve noktaları boşluğa dönüştür
  const withSpaces = withoutExt.replace(/[_\-.]+/g, " ");

  // 3. Fazla boşlukları temizle ve kırp
  const clean = withSpaces.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  // 4. Kelimelerin ilk harfini büyük yaparak okunabilir hale getir (Title Case)
  const words = clean.split(" ");
  const capitalized = words.map(word => {
    if (!word) return "";
    // Dönem ve sürüm kısaltmalarını büyük harfle koru (örn. Q1-Q4, H1-H2, V1-V9)
    if (/^(q[1-4]|h[1-2]|v[0-9]+)$/i.test(word)) {
      return word.toUpperCase();
    }
    // İlk harfi büyük, geri kalanı koru
    return word.charAt(0).toLocaleUpperCase() + word.slice(1);
  }).join(" ");

  // Başlık sözleşmesindeki 100 karakter sınırına uy
  return capitalized.slice(0, 100);
}
