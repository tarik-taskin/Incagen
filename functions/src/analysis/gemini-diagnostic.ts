import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { checkGeminiConnection, createGeminiGenerate, GeminiError } from "./gemini";
import { readGeminiKey } from "./gemini-secret";

// Maliyetli kontrol normal kullanıcılara kapalıdır; son giriş, UID ve geliştirici claim'i zorunludur.
export function requireGeminiDeveloper(auth: { uid: string; token: Record<string, unknown> } | undefined, data: unknown, now = Date.now()) {
  if (!auth) throw new HttpsError("unauthenticated", "Giriş gerekli.");
  if (auth.token.incagenDeveloper !== true) throw new HttpsError("permission-denied", "Geliştirici yetkisi gerekli.");
  if (!z.object({}).strict().safeParse(data).success) throw new HttpsError("invalid-argument", "Bu kontrol veri kabul etmez.");
  const age = now / 1000 - Number(auth.token.auth_time ?? 0);
  if (!Number.isFinite(age) || age < -30 || age > 300) throw new HttpsError("failed-precondition", "Yeniden giriş gerekli.");
  return auth.uid;
}

// UID başına dakikada bir, proje genelinde günde 20 çağrı; eşzamanlı istekler transaction ile sınırlanır.
export async function reserveGeminiDiagnostic(uid: string, now = Date.now()) {
  const db = getFirestore();
  await db.runTransaction(async tx => {
    const account = db.doc(`users/${uid}`);
    const own = db.doc(`users/${uid}/diagnostics/gemini`);
    const global = db.doc("internalDiagnostics/gemini");
    const [user, last, total] = await Promise.all([tx.get(account), tx.get(own), tx.get(global)]);
    const day = new Date(now).toISOString().slice(0, 10);
    const count = total.data()?.day === day ? Number(total.data()?.count ?? 0) : 0;
    if (user.data()?.deletingAccount) throw new HttpsError("failed-precondition", "Hesap siliniyor.");
    if (now - Number(last.data()?.at ?? 0) < 60_000 || count >= 20) throw new HttpsError("resource-exhausted", "Bağlantı kontrolü sınırına ulaşıldı.");
    tx.set(own, { at: now }); tx.set(global, { day, count: count + 1 });
  });
}

// Üretimde kapalı bir geliştirici smoke testi sunar; hazırlama kotasını ve kullanıcı raporlarını değiştirmez.
export const checkGemini = onCall({ region: "europe-west1", timeoutSeconds: 120, memory: "256MiB", maxInstances: 1, concurrency: 1 }, async request => {
  const uid = requireGeminiDeveloper(request.auth, request.data);
  try {
    const key = await readGeminiKey();
    await reserveGeminiDiagnostic(uid);
    return await checkGeminiConnection(createGeminiGenerate(key));
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const missing = error instanceof GeminiError && error.code === "not-configured";
    throw new HttpsError(missing ? "failed-precondition" : "unavailable", missing ? "Gemini anahtarı henüz yapılandırılmadı." : "Gemini bağlantısı doğrulanamadı.",
      { geminiFailure: error instanceof GeminiError ? error.code : "unavailable" });
  }
});
