import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

type FirebaseMode = "emulator" | "cloud";

const mode = (import.meta.env.VITE_FIREBASE_MODE || (import.meta.env.DEV ? "emulator" : "")) as FirebaseMode | "";
export const usesFirebaseEmulator = mode === "emulator";

// İstenen ortamın eksiksiz yapılandırmasını kurar; üretimde emülatöre veya başka projeye sessiz geçiş yapmaz.
function initializeServices() {
  if (mode !== "emulator" && mode !== "cloud") throw new Error("Firebase ortamı yapılandırılmadı.");
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || (usesFirebaseEmulator ? "demo-incagen" : "");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  if (usesFirebaseEmulator && (projectId !== "demo-incagen" || !loopback)) {
    throw new Error("Firebase emülatörü yalnız localhost ve demo-incagen ile kullanılabilir.");
  }
  if (!usesFirebaseEmulator && (!projectId || projectId === "demo-incagen")) {
    throw new Error("Canlı Firebase proje kimliği yapılandırılmadı.");
  }

  const cloudConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  if (!usesFirebaseEmulator && Object.values(cloudConfig).some(value => !value)) {
    throw new Error("Canlı Firebase web yapılandırması eksik.");
  }

  const app = initializeApp(usesFirebaseEmulator ? {
    projectId,
    apiKey: "demo-local-key",
    authDomain: "demo-incagen.firebaseapp.com",
    storageBucket: "demo-incagen.appspot.com",
  } : cloudConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, "europe-west1");
  if (usesFirebaseEmulator) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
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
