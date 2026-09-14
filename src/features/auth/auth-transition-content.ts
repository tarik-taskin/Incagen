export const AUTH_TRANSITION_DURATION_MS = 3_000;

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
