// Auth önizlemesini yalnız açıkça seçilmiş bulut derlemesinde açar; yerel tam akış korunur.
export const authOnlyPreview = import.meta.env.VITE_FIREBASE_MODE === "cloud"
  && import.meta.env.VITE_AUTH_ONLY_PREVIEW === "true";
