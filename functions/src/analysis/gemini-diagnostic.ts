import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { checkGeminiConnection, checkGeminiInteractions, createGeminiGenerate, GeminiError, GEMINI_INTERACTION_TRANSPORTS, GEMINI_LIMITS } from "./gemini";
import { readGeminiKey } from "./gemini-secret";
import { geminiQuotaDay } from "./provider-calendar";
import { probeSyntheticTable, syntheticTableFormats } from "./tabular-probe";
import { WorkerError } from "./python-worker";
import { requireSyntheticGrant, trialFixtures } from "./tabular-acceptance";
import { executeStartAnalysis } from "./tabular-jobs";

const diagnosticInput = z.object({ transport: z.enum(GEMINI_INTERACTION_TRANSPORTS).optional(), tableFormat: z.enum(syntheticTableFormats).optional(),
  syntheticReportId: z.string().uuid().optional() }).strict().refine(value =>
  [value.transport, value.tableFormat, value.syntheticReportId].filter(Boolean).length <= 1);
const diagnosticLimits = { projectPerDay: 4, intervalMs: 60_000 } as const;

// Maliyetli kontrol normal kullanıcılara kapalıdır; son giriş, UID ve geliştirici claim'i zorunludur.
export function requireGeminiDeveloper(auth: { uid: string; token: Record<string, unknown> } | undefined, data: unknown, now = Date.now()) {
  if (!auth) throw new HttpsError("unauthenticated", "Giriş gerekli.");
  const parsed = diagnosticInput.safeParse(data);
  const synthetic = parsed.success && parsed.data.syntheticReportId !== undefined && auth.token.incagenSyntheticReport !== undefined;
  if (auth.token.incagenDeveloper !== true && !synthetic) throw new HttpsError("permission-denied", "Geliştirici yetkisi gerekli.");
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bu kontrol belge veya serbest istem kabul etmez.");
  }
  const age = now / 1000 - Number(auth.token.auth_time ?? 0);
  if (!Number.isFinite(age) || age < -30 || age > 300) throw new HttpsError("failed-precondition", "Yeniden giriş gerekli.");
  return auth.uid;
}

// Proje ve UID aralığı, günlük bütçe ve tek Priority çağrısı aynı transaction içinde korunur.
export async function reserveGeminiDiagnostic(uid: string, now = Date.now(), priority = false) {
  const db = getFirestore();
  await db.runTransaction(async tx => {
    const account = db.doc(`users/${uid}`);
    const own = db.doc(`users/${uid}/diagnostics/gemini`);
    const global = db.doc("internalDiagnostics/gemini");
    const [user, last, total] = await Promise.all([tx.get(account), tx.get(own), tx.get(global)]);
    const day = geminiQuotaDay(now);
    const current = total.data();
    // Eski UTC kaydı bu günün herhangi bir bölümünü kapsıyorsa ilk geçişte sayacı koru.
    const carriesUsage = current?.day === day || (current?.calendar === undefined && current?.day === new Date(now).toISOString().slice(0, 10));
    const count = carriesUsage ? Number(current?.count ?? 0) : 0;
    const priorityUsed = carriesUsage && current?.priorityUsed === true;
    if (user.data()?.deletingAccount) throw new HttpsError("failed-precondition", "Hesap siliniyor.");
    if (now - Number(last.data()?.at ?? 0) < diagnosticLimits.intervalMs
      || now - Number(current?.lastAt ?? 0) < diagnosticLimits.intervalMs
      || count >= diagnosticLimits.projectPerDay || (priority && priorityUsed)) {
      throw new HttpsError("resource-exhausted", "Bağlantı kontrolü sınırına ulaşıldı.");
    }
    tx.set(own, { at: now });
    tx.set(global, { calendar: "pacific", day, lastAt: now, count: count + 1, ...(priority || priorityUsed ? { priorityUsed: true } : {}) });
  });
}

// Üretimde kapalı bir geliştirici smoke testi sunar; hazırlama kotasını ve kullanıcı raporlarını değiştirmez.
export const checkGemini = onCall<z.infer<typeof diagnosticInput>>({ region: "europe-west1", timeoutSeconds: GEMINI_LIMITS.diagnosticTimeoutMs / 1000 + 30,
  memory: "256MiB", maxInstances: 1, concurrency: 1 }, async request => {
  const uid = requireGeminiDeveloper(request.auth, request.data);
  const { transport, tableFormat, syntheticReportId } = request.data;
  if (syntheticReportId) {
    const grant = requireSyntheticGrant(request.auth!.token, syntheticReportId);
    return executeStartAnalysis(uid, { id: grant.id, sourceId: "file-0", selection: trialFixtures[grant.format].selection, locale: grant.locale },
      { access: "available", syntheticGrant: grant });
  }
  const priority = transport === "interactions-priority";
  try {
    const key = await readGeminiKey();
    await reserveGeminiDiagnostic(uid, Date.now(), priority);
    if (tableFormat) return await probeSyntheticTable(tableFormat, onUsage => createGeminiGenerate(key, onUsage));
    if (transport) {
      return { ...await checkGeminiInteractions(key, transport), transport };
    }
    return await checkGeminiConnection(createGeminiGenerate(key));
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof WorkerError) throw new HttpsError("unavailable", "Sentetik tablo hesabı doğrulanamadı.", { geminiFailure: "synthetic-calculation" });
    const missing = error instanceof GeminiError && error.code === "not-configured";
    throw new HttpsError(missing ? "failed-precondition" : "unavailable", missing ? "Gemini anahtarı henüz yapılandırılmadı." : "Gemini bağlantısı doğrulanamadı.",
      { geminiFailure: error instanceof GeminiError ? error.code : "unavailable" });
  }
});
