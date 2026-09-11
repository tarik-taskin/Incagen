import { createHash, randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { createSchema, getQuotaDay, LIMITS, type CreateAnalysis } from "./contracts";
import { calculateReport, CsvError } from "./csv";

initializeApp({ projectId: "demo-incagen", storageBucket: "demo-incagen.appspot.com" });
const db = getFirestore();
const bucket = getStorage().bucket();
const options = { region: "europe-west1", timeoutSeconds: 120, memory: "512MiB" as const };
const idSchema = z.object({ id: z.string().uuid() }).strict();

// Yerel prototipte eksik emülatör ayarının gerçek Firebase servislerine erişmesini engeller.
function requireLocal(uid: string | undefined) {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new HttpsError("failed-precondition", "Bu sürüm yalnız tam yerel emülatör ortamında çalışır.");
  }
  if (!uid) throw new HttpsError("unauthenticated", "Lütfen giriş yapın.");
  return uid;
}

// İstek kimliğiyle tekrar oluşturmayı tekilleştirir ve değişmez dosya manifestini kaydeder.
export const createAnalysis = onCall(options, async request => {
  const uid = requireLocal(request.auth?.uid);
  const parsed = createSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues[0].message);
  const input = parsed.data;
  const ref = db.doc(`users/${uid}/analyses/${input.requestId}`);
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const manifest = Object.fromEntries(input.files.map((file, i) => [`file-${i}.csv`, file]));
  await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.data()?.fingerprint !== fingerprint) throw new HttpsError("already-exists", "Bu istek kimliği farklı bir analiz için kullanıldı.");
      if (existing.data()?.status === "deleting") throw new HttpsError("failed-precondition", "Analiz siliniyor.");
      return;
    }
    tx.create(ref, { title: input.title, business: input.business, currency: input.currency, manifest, fingerprint, status: "uploading", attempts: 0, createdAt: Date.now(), updatedAt: Date.now() });
  });
  return { id: input.requestId, paths: Object.keys(manifest).map(key => `users/${uid}/analyses/${input.requestId}/${key}`) };
});

// Yüklenmiş kaynakları kilitleyip doğrular; aynı işin eşzamanlı çağrıları tek kota ve tek sonuç kullanır.
export const runAnalysis = onCall(options, async request => {
  const uid = requireLocal(request.auth?.uid);
  const parsed = idSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Geçersiz analiz kimliği.");
  const ref = db.doc(`users/${uid}/analyses/${parsed.data.id}`);
  const day = getQuotaDay();
  const quotaRef = db.doc(`users/${uid}/quotas/${day}`);
  const attempt = randomUUID();
  const work = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Analiz bulunamadı.");
    const data = snap.data()!;
    if (data.status === "completed" || (data.status === "processing" && Date.now() - data.updatedAt < 150_000)) return null;
    if (data.status === "deleting") throw new HttpsError("failed-precondition", "Analiz siliniyor.");
    const quota = await tx.get(quotaRef);
    // Yarım kalmış çalışmanın rezervasyonunu geri al; yeniden denemede yeni günün kotasını kullan.
    const oldRef = data.status === "processing" && data.quotaDay ? db.doc(`users/${uid}/quotas/${data.quotaDay}`) : null;
    const oldQuota = oldRef && oldRef.path !== quotaRef.path ? await tx.get(oldRef) : null;
    const used = Math.max(0, (quota.data()?.used ?? 0) - (oldRef?.path === quotaRef.path ? 1 : 0));
    if (used >= LIMITS.daily) throw new HttpsError("resource-exhausted", "Günlük 10 analiz hakkınız doldu.");
    if (oldRef && oldQuota) tx.set(oldRef, { used: Math.max(0, (oldQuota.data()?.used ?? 0) - 1) });
    tx.set(quotaRef, { used: used + 1 });
    tx.update(ref, { status: "processing", attempt, quotaDay: day, error: null, updatedAt: Date.now(), attempts: (data.attempts ?? 0) + 1 });
    return data;
  });
  if (!work) return { id: ref.id };
  try {
    const sources = [];
    let totalBytes = 0;
    for (const [key, entry] of Object.entries(work.manifest as Record<string, CreateAnalysis["files"][number]>)) {
      const file = bucket.file(`users/${uid}/analyses/${ref.id}/${key}`);
      const [metadata] = await file.getMetadata();
      const size = Number(metadata.size);
      totalBytes += size;
      if (size !== entry.size || size > LIMITS.fileBytes || totalBytes > LIMITS.totalBytes || metadata.contentType !== "text/csv") throw new CsvError(`${entry.name}: Dosya boyutu veya türü geçersiz.`);
      const [buffer] = await file.download({ validation: false });
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
      catch { throw new CsvError(`${entry.name}: UTF-8 kodlaması gerekli.`); }
      if (text.includes("\u0000")) throw new CsvError(`${entry.name}: İkili içerik CSV olarak işlenemez.`);
      sources.push({ name: entry.name, mapping: entry.mapping, text });
    }
    const report = calculateReport(sources);
    await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      if (current.data()?.attempt === attempt && current.data()?.status === "processing") tx.update(ref, { status: "completed", report, updatedAt: Date.now() });
    });
    return { id: ref.id };
  } catch (error) {
    const message = error instanceof CsvError ? error.message : "İşlem tamamlanamadı. Dosyaları kontrol edip yeniden deneyin.";
    await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      const quota = await tx.get(quotaRef);
      if (current.data()?.attempt !== attempt || current.data()?.status !== "processing") return;
      tx.update(ref, { status: "failed", error: message, updatedAt: Date.now() });
      tx.set(quotaRef, { used: Math.max(0, (quota.data()?.used ?? 0) - 1) });
    });
    throw new HttpsError(error instanceof CsvError ? "invalid-argument" : "internal", message);
  }
});

// Önce yazmayı kilitler, sonra kaynakları ve sonucu siler; yarım kalan silme tekrar denenebilir.
export const deleteAnalysis = onCall(options, async request => {
  const uid = requireLocal(request.auth?.uid);
  const parsed = idSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Geçersiz analiz kimliği.");
  const ref = db.doc(`users/${uid}/analyses/${parsed.data.id}`);
  const exists = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const data = snap.data()!;
    if (data.status === "processing" && Date.now() - data.updatedAt < 150_000) throw new HttpsError("failed-precondition", "İşlem sürerken silinemez.");
    if (data.status === "processing" && data.quotaDay) {
      const quotaRef = db.doc(`users/${uid}/quotas/${data.quotaDay}`);
      const quota = await tx.get(quotaRef);
      tx.set(quotaRef, { used: Math.max(0, (quota.data()?.used ?? 0) - 1) });
    }
    tx.update(ref, { status: "deleting", updatedAt: Date.now() });
    return true;
  });
  if (exists) {
    await bucket.deleteFiles({ prefix: `users/${uid}/analyses/${ref.id}/` });
    await ref.delete();
  }
  return { deleted: true };
});
