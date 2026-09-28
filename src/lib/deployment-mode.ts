// Aynı arayüzü korurken hazır olmayan bulut veri işlemlerini yalnız Netlify önizlemesinde durdurur.
export const authOnlyPreview = import.meta.env.VITE_FIREBASE_MODE === "cloud"
  && import.meta.env.VITE_AUTH_ONLY_PREVIEW === "true";
