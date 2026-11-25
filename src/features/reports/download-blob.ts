// Dosyayı tarayıcıya iletir ve okuması için kısa süre tanıdıktan sonra nesne adresini temizler.
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
