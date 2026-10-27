import { GoogleAuthProvider, type User } from "firebase/auth";

// Google hesap seçicisini her girişte gösterir; tarayıcıda açık başka Google oturumu sessizce seçilmez.
export function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

// Kullanıcının bağlı giriş yöntemlerini okur; sağlayıcı bilgisi olmayan eski oturumu e-posta/parola sayar.
export function signInMethods(user: Pick<User, "providerData"> | null | undefined) {
  const providers = new Set((user?.providerData ?? []).map(({ providerId }) => providerId));
  return { google: providers.has("google.com"), password: providers.has("password") || providers.size === 0 };
}

// Kullanıcının kapattığı veya yenisiyle değiştirilen Google penceresini hata olarak göstermemek için ayırır.
export function isDismissedPopup(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled";
}
