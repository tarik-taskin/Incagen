import { createHash, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { createSchema, getQuotaDay, LIMITS, type CreateAnalysis, type ReportSource } from "./contracts";
import { countDocumentCharacters, DocumentParseError, parseDocument } from "./parsing";

initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();
const options = { region: "europe-west1", timeoutSeconds: 300, memory: "1GiB" as const };
const processingLeaseMs = 330_000;
const idSchema = z.object({ id: z.string().uuid() }).strict();
const deleteAccountSchema = z.object({ confirmation: z.literal("HESABIMI SİL") }).strict();

class FileValidationError extends Error {}

// Callable isteğin Firebase Auth tarafından doğrulanmış bir kullanıcıya ait olmasını zorunlu kılar.
function requireUser(uid: string | undefined) {
  if (!uid) throw new HttpsError("unauthenticated", "Lütfen giriş yapın.");
  return uid;
}

// İstek kimliğiyle tekrar oluşturmayı tekilleştirir ve değişmez dosya manifestini kaydeder.
export const createAnalysis = onCall(options, async request => {
  const uid = requireUser(request.auth?.uid);
  const parsed = createSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues[0].message);
  const input = parsed.data;
  const ref = db.doc(`users/${uid}/analyses/${input.requestId}`);
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const manifest = Object.fromEntries(input.files.map((file, i) => [`file-${i}`, file]));
  await db.runTransaction(async tx => {
    const account = await tx.get(db.doc(`users/${uid}`));
    if (account.data()?.deletingAccount) throw new HttpsError("failed-precondition", "Hesap siliniyor.");
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.data()?.fingerprint !== fingerprint) throw new HttpsError("already-exists", "Bu istek kimliği farklı bir analiz için kullanıldı.");
      if (existing.data()?.status === "deleting") throw new HttpsError("failed-precondition", "Analiz siliniyor.");
      return;
    }
    tx.create(ref, { title: input.title, business: input.business, objective: input.objective, manifest, fingerprint, status: "uploading", attempts: 0, createdAt: Date.now(), updatedAt: Date.now() });
  });
  return { id: input.requestId, paths: Object.keys(manifest).map(key => `users/${uid}/analyses/${input.requestId}/${key}`) };
});

// Yüklenmiş belgeleri kilitleyip doğrular; aynı hazırlığın eşzamanlı çağrıları tek kota ve tek sonuç kullanır.
export const prepareAnalysis = onCall(options, async request => {
  const uid = requireUser(request.auth?.uid);
  const parsed = idSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Geçersiz analiz kimliği.");
  const ref = db.doc(`users/${uid}/analyses/${parsed.data.id}`);
  const day = getQuotaDay();
  const quotaRef = db.doc(`users/${uid}/quotas/${day}`);
  const attempt = randomUUID();
  const work = await db.runTransaction(async tx => {
    const account = await tx.get(db.doc(`users/${uid}`));
    if (account.data()?.deletingAccount) throw new HttpsError("failed-precondition", "Hesap siliniyor.");
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Analiz bulunamadı.");
    const data = snap.data()!;
    if (data.status === "completed" || (data.status === "processing" && Date.now() - data.updatedAt < processingLeaseMs)) return null;
    if (data.status === "deleting") throw new HttpsError("failed-precondition", "Analiz siliniyor.");
    const quota = await tx.get(quotaRef);
    // Yarım kalmış çalışmanın rezervasyonunu geri al; yeniden denemede yeni günün kotasını kullan.
    const oldRef = data.status === "processing" && data.quotaDay ? db.doc(`users/${uid}/quotas/${data.quotaDay}`) : null;
    const oldQuota = oldRef && oldRef.path !== quotaRef.path ? await tx.get(oldRef) : null;
    const used = Math.max(0, (quota.data()?.used ?? 0) - (oldRef?.path === quotaRef.path ? 1 : 0));
    if (used >= LIMITS.daily) throw new HttpsError("resource-exhausted", `Günlük ${LIMITS.daily} analiz hakkınız doldu.`);
    if (oldRef && oldQuota) tx.set(oldRef, { used: Math.max(0, (oldQuota.data()?.used ?? 0) - 1) });
    tx.set(quotaRef, { used: used + 1 });
    tx.update(ref, { status: "processing", attempt, quotaDay: day, error: null, updatedAt: Date.now(), attempts: (data.attempts ?? 0) + 1 });
    return data;
  });
  if (!work) return { id: ref.id };
  try {
    const sources: ReportSource[] = [];
    let totalBytes = 0;
    let totalChunks = 0;
    let totalCharacters = 0;
    for (const [key, entry] of Object.entries(work.manifest as Record<string, CreateAnalysis["files"][number]>)) {
      const file = bucket.file(`users/${uid}/analyses/${ref.id}/${key}`);
      const [metadata] = await file.getMetadata();
      const size = Number(metadata.size);
      totalBytes += size;
      if (size !== entry.size || totalBytes > LIMITS.totalBytes || metadata.contentType !== entry.contentType) {
        throw new FileValidationError(`${entry.name}: Dosya boyutu veya içerik türü manifest ile eşleşmiyor.`);
      }
      const [data] = await file.download();
      let parsed;
      try {
        parsed = await parseDocument({ sourceId: key, fileName: entry.name, contentType: entry.contentType, data });
      } catch (error) {
        if (error instanceof DocumentParseError) throw new FileValidationError(`${entry.name}: ${error.message}`);
        throw error;
      }
      const characterCount = countDocumentCharacters(parsed);
      totalChunks += parsed.chunks.length;
      totalCharacters += characterCount;
      const artifactPath = `derived/${uid}/analyses/${ref.id}/${key}.json.gz`;
      await bucket.file(artifactPath).save(gzipSync(Buffer.from(JSON.stringify(parsed))), {
        resumable: false,
        metadata: { contentType: "application/gzip", cacheControl: "private, no-store", metadata: { sha256: parsed.sha256, parserVersion: parsed.parserVersion } },
      });
      sources.push({
        id: key,
        name: entry.name,
        size,
        declaredContentType: entry.contentType,
        detectedMime: parsed.detectedMime,
        sha256: parsed.sha256,
        category: parsed.category,
        chunkCount: parsed.chunks.length,
        characterCount,
        warnings: parsed.warnings,
        metadata: parsed.metadata,
      });
    }
    const report = { version: 3 as const, fileCount: sources.length, totalBytes, totalChunks, totalCharacters, sources };
    await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      if (current.data()?.attempt === attempt && current.data()?.status === "processing") tx.update(ref, { status: "completed", report, updatedAt: Date.now() });
    });
    return { id: ref.id };
  } catch (error) {
    const message = error instanceof FileValidationError ? error.message : "Belgeler hazırlanamadı. Dosyaları kontrol edip yeniden deneyin.";
    await bucket.deleteFiles({ prefix: `derived/${uid}/analyses/${ref.id}/` }).catch(() => undefined);
    await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      const quota = await tx.get(quotaRef);
      if (current.data()?.attempt !== attempt || current.data()?.status !== "processing") return;
      tx.update(ref, { status: "failed", error: message, updatedAt: Date.now() });
      tx.set(quotaRef, { used: Math.max(0, (quota.data()?.used ?? 0) - 1) });
    });
    throw new HttpsError(error instanceof FileValidationError ? "invalid-argument" : "internal", message);
  }
});

// Önce yazmayı kilitler, sonra kaynakları ve sonucu siler; yarım kalan silme tekrar denenebilir.
export const deleteAnalysis = onCall(options, async request => {
  const uid = requireUser(request.auth?.uid);
  const parsed = idSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Geçersiz analiz kimliği.");
  const ref = db.doc(`users/${uid}/analyses/${parsed.data.id}`);
  const exists = await db.runTransaction(async tx => {
    const account = await tx.get(db.doc(`users/${uid}`));
    if (account.data()?.deletingAccount) throw new HttpsError("failed-precondition", "Hesap siliniyor.");
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const data = snap.data()!;
    if (data.status === "processing" && Date.now() - data.updatedAt < processingLeaseMs) throw new HttpsError("failed-precondition", "İşlem sürerken silinemez.");
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
    await bucket.deleteFiles({ prefix: `derived/${uid}/analyses/${ref.id}/` });
    await ref.delete();
  }
  return { deleted: true };
});

// Yakın zamanda doğrulanmış hesap isteğinde yazmayı kilitler; verileri ve dosyaları temizleyip Auth hesabını en son siler.
export const deleteAccount = onCall(options, async request => {
  const uid = requireUser(request.auth?.uid);
  if (!deleteAccountSchema.safeParse(request.data).success) throw new HttpsError("invalid-argument", "Hesap silme onayı geçersiz.");
  const authTime = Number(request.auth?.token.auth_time ?? 0);
  if (!authTime || Date.now() / 1000 - authTime > 300) throw new HttpsError("failed-precondition", "Devam etmek için parolanızı yeniden doğrulayın.");

  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async tx => {
    const analyses = await tx.get(userRef.collection("analyses").where("status", "==", "processing"));
    if (analyses.docs.some(doc => Date.now() - doc.data().updatedAt < processingLeaseMs)) {
      throw new HttpsError("failed-precondition", "Devam eden analiz bitince hesabınızı silin.");
    }
    tx.set(userRef, { deletingAccount: true, updatedAt: Date.now() }, { merge: true });
  });

  // Hata halinde Auth hesabı kalır; kullanıcı aynı onayla silmeyi yeniden deneyebilir.
  await bucket.deleteFiles({ prefix: `users/${uid}/analyses/` });
  await bucket.deleteFiles({ prefix: `derived/${uid}/analyses/` });
  for (const collection of await userRef.listCollections()) await db.recursiveDelete(collection);
  await getAuth().deleteUser(uid);
  await userRef.delete();
  return { deleted: true };
});
