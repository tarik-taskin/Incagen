import { tr } from "../i18n/tr";
// SDK hata kodlarını kullanıcı mesajına çevirir; sır veya teknik stack göstermez.
export function userError(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(code)) return tr.auth.invalid;
  if (code === "auth/email-already-in-use") return tr.auth.exists;
  if (code === "auth/weak-password") return tr.auth.weak;
  if (code === "auth/popup-blocked") return tr.auth.popupBlocked;
  if (code === "auth/account-exists-with-different-credential") return tr.auth.otherMethod;
  if (code === "auth/operation-not-allowed") return tr.auth.providerDisabled;
  if (code === "auth/unauthorized-domain") return tr.auth.unauthorizedDomain;
  if (code === "auth/user-mismatch") return tr.auth.userMismatch;
  if (code.includes("network") || code.includes("unavailable") || code === "functions/internal") return tr.auth.offline;
  if (code.startsWith("functions/") && error instanceof Error) return error.message;
  if (code === "storage/canceled") return "Yükleme iptal edildi. Seçilen dosyalarınız korundu.";
  return error instanceof Error && !code ? error.message : tr.auth.generic;
}
