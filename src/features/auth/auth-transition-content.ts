export const AUTH_TRANSITION_DURATION_MS = 3_000;
export const AUTH_TRANSITION_VISIBLE_MESSAGE_COUNT = 5;

const sharedMessages = [
  "Veriler hazırlanıyor…",
  "Çalışma alanı kuruluyor…",
  "Güvenli oturum açılıyor…",
  "Analiz araçları hazırlanıyor…",
  "Rapor alanı düzenleniyor…",
  "Belgeleriniz için alan açılıyor…",
  "Tercihleriniz yükleniyor…",
  "İçgörü merkezi hazırlanıyor…",
  "Son kontroller tamamlanıyor…",
] as const;

// Giriş ve kayıt için on farklı hazırlık mesajı üretir.
export function getAuthTransitionMessages(register: boolean) {
  return [register ? "Hesabınız oluşturuluyor…" : "Giriş yapılıyor…", ...sharedMessages];
}

// On mesajlık havuzdan tekrar etmeyen beş mesajı her geçiş için karışık seçer.
export function selectAuthTransitionMessages(register: boolean) {
  const shuffled = [...getAuthTransitionMessages(register)];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled.slice(0, AUTH_TRANSITION_VISIBLE_MESSAGE_COUNT);
}
