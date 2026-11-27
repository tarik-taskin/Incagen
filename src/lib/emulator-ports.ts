const defaults = { auth: 9099, firestore: 8080, storage: 9199, functions: 5001, hub: 4400, logging: 4500, web: 4173,
  eventarc: 9299, tasks: 9499, firestoreWebsocket: 9150 };

// Tek doğrulanmış port bloğunu demo istemcisi ve test çalıştırıcısı birlikte kullanır.
export function emulatorPorts(base: string | undefined = undefined) {
  if (base === undefined || base === "") return defaults;
  const start = Number(base);
  if (!/^\d{4,5}$/.test(base) || start < 1024 || start > 65526) throw new Error("Geçersiz Incagen test port bloğu.");
  return { auth: start, firestore: start + 1, storage: start + 2, functions: start + 3, hub: start + 4, logging: start + 5,
    web: start + 6, eventarc: start + 7, tasks: start + 8, firestoreWebsocket: start + 9 };
}
