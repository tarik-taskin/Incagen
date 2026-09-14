export const AUTH_TRANSITION_DURATION_MS = 3_000;
export const AUTH_TRANSITION_VISIBLE_MESSAGE_COUNT = 5;

const transitionMessages = [
  "Verileriniz hazırlanıyor…",
  "Çalışma alanınız düzenleniyor…",
  "Analiz araçları yükleniyor…",
  "Rapor merkezi hazırlanıyor…",
  "Belgeleriniz için alan açılıyor…",
  "Tercihleriniz eşitleniyor…",
  "İçgörü merkezi hazırlanıyor…",
  "Güvenlik ayarları uygulanıyor…",
  "Veri bağlantıları kuruluyor…",
  "Kontrol paneli hazırlanıyor…",
  "Çalışma oturumu ayarlanıyor…",
  "Analiz geçmişi yükleniyor…",
  "Akıllı araçlar hazırlanıyor…",
  "Görünüm tercihleriniz uygulanıyor…",
  "Kaynak alanı düzenleniyor…",
  "Rapor araçları yükleniyor…",
  "İşletme alanı hazırlanıyor…",
  "Dosya çalışma alanı hazırlanıyor…",
  "Incagen deneyimi hazırlanıyor…",
  "Kişisel alanınız düzenleniyor…",
] as const;

// Rastgele sıranın her konumunda doğal okunabilen yirmi hazırlık mesajını döndürür.
export function getAuthTransitionMessages() {
  return transitionMessages;
}

// Yirmi mesajlık havuzdan tekrar etmeyen beş mesajı her geçiş için karışık seçer.
export function selectAuthTransitionMessages() {
  const shuffled = [...getAuthTransitionMessages()];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled.slice(0, AUTH_TRANSITION_VISIBLE_MESSAGE_COUNT);
}
