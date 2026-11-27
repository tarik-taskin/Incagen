import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getAuthServices, usesFirebaseEmulator } from "./firebase-auth";
import { emulatorPorts } from "./emulator-ports";

// Çalışma alanı gerektiğinde veri servislerini aynı uygulama/kimlik örneğine bağlar.
function initializeServices() {
  const { app, auth } = getAuthServices();
  const db = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, "europe-west1");
  if (usesFirebaseEmulator) {
    const ports = emulatorPorts(import.meta.env.VITE_INCAGEN_TEST_PORT_BASE);
    connectFirestoreEmulator(db, "127.0.0.1", ports.firestore);
    connectStorageEmulator(storage, "127.0.0.1", ports.storage);
    connectFunctionsEmulator(functions, "127.0.0.1", ports.functions);
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
