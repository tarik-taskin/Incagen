import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// Demo sürümünü yalnız loopback ve demo proje kimliğinde başlatır; gerçek buluta fallback yoktur.
function initializeLocalServices() {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-incagen";
  const mode = import.meta.env.VITE_FIREBASE_MODE || (import.meta.env.DEV ? "emulator" : "disabled");
  if (mode !== "emulator" || projectId !== "demo-incagen" || !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
    throw new Error("Bu sürüm yalnız yerelde çalışır. VITE_FIREBASE_MODE=emulator ve demo-incagen kullanın.");
  }
  const app = initializeApp({ projectId, apiKey: "demo-local-key", authDomain: "demo-incagen.firebaseapp.com", storageBucket: "demo-incagen.appspot.com" });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, "europe-west1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  return { auth, db, storage, functions };
}
let services: ReturnType<typeof initializeLocalServices> | undefined;
export let configurationError = "";
// Başlatma hatasını kullanıcı arayüzüne taşır; yanlış ortamda ağ isteği başlatmaz.
export function getServices() {
  if (services) return services;
  try { services = initializeLocalServices(); return services; }
  catch (error) { configurationError = error instanceof Error ? error.message : "Yapılandırma eksik."; throw error; }
}
