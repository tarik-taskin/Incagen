import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getAuthServices, usesFirebaseEmulator } from "./firebase-auth";

// Çalışma alanı gerektiğinde veri servislerini aynı uygulama/kimlik örneğine bağlar.
function initializeServices() {
  const { app, auth } = getAuthServices();
  const db = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, "europe-west1");
  if (usesFirebaseEmulator) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  return { auth, db, storage, functions };
}
let services: ReturnType<typeof initializeServices> | undefined;
export let configurationError = "";
// Başlatma hatasını kullanıcı arayüzüne taşır; yanlış ortamda ağ isteği başlatmaz.
export function getServices() {
  if (services) return services;
  try { services = initializeServices(); return services; }
  catch (error) { configurationError = error instanceof Error ? error.message : "Yapılandırma eksik."; throw error; }
}
