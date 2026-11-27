import { createHash, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { warn } from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getQuotaDay } from "../contracts";
import { createGeminiGenerate, GEMINI_MODEL, GeminiError, type GeminiGenerate } from "./gemini";
import { readGeminiKey } from "./gemini-secret";
import { AnalysisPacketBudgetError } from "./input-packet";
import { preparedAnalysis, verifyPreparedSelection, type AiArtifact } from "./tabular-storage";
import { computeTable, WorkerError } from "./python-worker";
import { analysisFingerprint, createTabularPacket, interpretTable } from "./tabular-result";
import { AI_JOB_LIMITS, hasActiveAnalysisLease, startAnalysisSchema, type AiJob, type AnalysisAccess, type AnalysisFailure } from "./tabular-contract";
import { isAnalysisEmulator, tabularAnalysisAccess } from "./tabular-rollout";

// Atomik kabul hem tekrar çağrıyı tekilleştirir hem kullanıcı/proje maliyet sınırını sunucuda uygular.
export async function reserveAnalysis(uid: string, input: ReturnType<typeof startAnalysisSchema.parse>, fingerprint: string, now = Date.now()) {
  const db = getFirestore(), ref = db.doc(`users/${uid}/analyses/${input.id}`), day = getQuotaDay(new Date(now));
  return db.runTransaction(async tx => {
    const ownerRef = db.doc(`users/${uid}`), ownQuota = db.doc(`users/${uid}/aiQuotas/${day}`), globalQuota = db.doc(`internalAnalysisQuotas/${day}`);
    const [owner, current, own, global] = await Promise.all([tx.get(ownerRef), tx.get(ref), tx.get(ownQuota), tx.get(globalQuota)]);
    if (!current.exists) throw new HttpsError("not-found", "Analiz bulunamadı.");
    if (owner.data()?.deletingAccount || current.data()?.status !== "completed") throw new HttpsError("failed-precondition", "Önce belge hazırlığını tamamlayın.");
    const previous = current.data()?.ai as (AiJob & { fingerprint?: string; quotaDay?: string }) | undefined;
    if (previous?.status === "completed") {
      if (previous.fingerprint !== fingerprint) throw new HttpsError("failed-precondition", "Tamamlanan analiz korunur. Farklı bir kapsam için yeni çalışma oluşturun.");
      return { state: "completed" as const, job: previous };
    }
    if (previous && hasActiveAnalysisLease(previous, now)) {
      if (previous.fingerprint !== fingerprint) throw new HttpsError("failed-precondition", "Devam eden analizin kapsamı değiştirilemez.");
      return { state: "running" as const, job: previous };
    }
    if ((previous?.attempts ?? 0) >= AI_JOB_LIMITS.attempts) throw new HttpsError("resource-exhausted", "Bu çalışma için analiz deneme sınırına ulaşıldı.");
    if (previous?.status === "failed" && Number.isFinite(previous.retryAfter) && now < previous.retryAfter!) {
      throw new HttpsError("resource-exhausted", "Yeniden denemeden önce kısa bir süre bekleyin.", { analysisFailure: previous.error, retryAfter: previous.retryAfter });
    }
    const newDayAdmission = previous?.quotaDay !== day;
    if ((newDayAdmission && Number(own.data()?.count ?? 0) >= AI_JOB_LIMITS.dailyPerUser) || Number(global.data()?.count ?? 0) >= AI_JOB_LIMITS.dailyGlobal) throw new HttpsError("resource-exhausted", "Günlük analiz kapasitesine ulaşıldı. Daha sonra yeniden deneyin.");
    const job = { status: "running" as const, attemptId: randomUUID(), attempts: (previous?.attempts ?? 0) + 1, startedAt: now,
      leaseUntil: now + AI_JOB_LIMITS.leaseMs, maxAttempts: AI_JOB_LIMITS.attempts, stage: "calculating" as const,
      locale: input.locale, sourceId: input.sourceId, selection: input.selection, fingerprint, quotaDay: day };
    tx.update(ref, { ai: job, updatedAt: now });
    if (newDayAdmission) tx.set(ownQuota, { count: Number(own.data()?.count ?? 0) + 1 });
    tx.set(globalQuota, { count: Number(global.data()?.count ?? 0) + 1 });
    return { state: "started" as const, job };
  });
}

// Teknik istisnaları sınırlı kullanıcı durumlarına çevirir; ham model/parser/anahtar hatası kaydedilmez.
export function failureCode(error: unknown): AnalysisFailure {
  if (error instanceof WorkerError) return error.code;
  if (error instanceof AnalysisPacketBudgetError) return "scope-limit";
  if (error instanceof GeminiError) {
    if (error.code === "not-configured") return "configuration";
    if (error.code === "busy") return "provider-busy";
    if (error.code === "rate-limited") return "provider-rate-limit";
    if (error.code === "timeout") return "timeout";
    if (error.code === "invalid-response" || error.code === "invalid-input") return "validation";
    return "provider";
  }
  return "validation";
}

// Silinen/kapanan veya yeni denemeye geçmiş kayda geç gelen bir sonuç yazılamaz.
export async function completeAnalysis(uid: string, id: string, attemptId: string, completed: AiJob) {
  const db = getFirestore(), ref = db.doc(`users/${uid}/analyses/${id}`);
  return db.runTransaction(async tx => {
    const [owner, current] = await Promise.all([tx.get(db.doc(`users/${uid}`)), tx.get(ref)]);
    const data = current.data(), now = Date.now();
    if (owner.data()?.deletingAccount || data?.status !== "completed" || data.ai?.attemptId !== attemptId || !hasActiveAnalysisLease(data.ai, now)) return false;
    tx.update(ref, { ai: completed, updatedAt: now });
    return true;
  });
}

// Bir sonraki dış işlemden önce sahiplik ve deneme hâlâ geçerliyse gerçek aşamayı günceller.
async function advanceAnalysis(uid: string, id: string, attemptId: string, stage: AiJob["stage"]) {
  const db = getFirestore(), ref = db.doc(`users/${uid}/analyses/${id}`);
  const valid = await db.runTransaction(async tx => {
    const [owner, current] = await Promise.all([tx.get(db.doc(`users/${uid}`)), tx.get(ref)]);
    const data = current.data();
    if (owner.data()?.deletingAccount || data?.status !== "completed" || data.ai?.attemptId !== attemptId || data.ai.status !== "running") return false;
    if (!hasActiveAnalysisLease(data.ai, Date.now())) throw new WorkerError("timeout");
    tx.update(ref, { "ai.stage": stage }); return true;
  });
  if (!valid) throw new HttpsError("aborted", "Çalışma değişti veya silindi; işlem durduruldu.");
}

// Kararsız commit yanıtında yayındaki nesneyi silmeden önce kayıt bağlantısını tekrar denetler.
export function failureDisposition(record: { status?: string; ai?: Partial<AiJob> } | undefined, attemptId: string, path: string, savedHash?: string) {
  const job = record?.ai;
  if (job?.artifactPath === path) {
    if (record?.status === "completed" && job.attemptId === attemptId && job.status === "completed"
      && savedHash !== undefined && job.artifactSha256 === savedHash) return "published";
    return "preserve";
  }
  if (record?.status === "completed" && job?.attemptId === attemptId && job.status === "running") return "fail";
  return "unreferenced";
}

export interface StartAnalysisOptions {
  access?: AnalysisAccess;
  generate?: GeminiGenerate;
  readKey?: () => Promise<string>;
}

// İstek doğrulama, rollout kapısı, Python hesabı, model çağrısı ve sonucu Atomik hata kaydıyla yürütür.
export async function executeStartAnalysis(uid: string | undefined, rawData: unknown, options: StartAnalysisOptions = {}) {
  const parsed = startAnalysisSchema.safeParse(rawData);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Analiz kapsamını kontrol edin.");
  const input = parsed.data;
  const { data, ref } = await preparedAnalysis(uid, input.id);
  const access = options.access ?? tabularAnalysisAccess();
  if (access === "closed") throw new HttpsError("failed-precondition", "Analiz servisi şu anda kullanılamıyor.", { analysisFailure: "configuration" });
  if (access === "invite-required") throw new HttpsError("permission-denied", "Bu hesap tablo analizi betasına dahil değil.", { analysisAccess: access });
  const source = data.report.sources.find(source => source.id === input.sourceId && /\.(csv|xlsx)$/i.test(source.name));
  if (!source || !data.objective?.trim()) throw new HttpsError("failed-precondition", "Analiz için CSV veya XLSX tablosu ve bir hedef seçin.");
  if (input.checkOnly) {
    await verifyPreparedSelection(uid!, input.id, data.artifactAttempt, source, input.selection);
    return { id: input.id, status: "available" as const, checkOnly: true };
  }
  const fingerprint = analysisFingerprint(source.sha256, source.id, input.selection, input.locale);
  const reservation = await reserveAnalysis(uid!, input, fingerprint);
  if (reservation.state !== "started") return { id: input.id, status: reservation.state, reused: true };
  const job = reservation.job, bucket = getStorage().bucket(), startedAt = Date.now();
  const artifactPath = `derived/${uid}/analyses/${input.id}/ai/${job.attemptId}.json.gz`;
  let savedHash: string | undefined;
  try {
    const [metadata] = await bucket.file(`users/${uid}/analyses/${input.id}/${source.id}`).getMetadata();
    if (Number(metadata.size) !== source.size || source.size > 25 * 1024 * 1024) throw new WorkerError("invalid-data");
    const [raw] = await bucket.file(`users/${uid}/analyses/${input.id}/${source.id}`).download();
    if (createHash("sha256").update(raw).digest("hex") !== source.sha256) throw new WorkerError("invalid-data");
    const pythonStarted = Date.now(), worker = await computeTable(raw, source.id, source.name, input.selection), pythonMs = Date.now() - pythonStarted;
    if (worker.document.sourceId !== source.id || worker.document.sha256 !== source.sha256 || worker.document.fileName !== source.name
      || worker.scope.sheet !== input.selection.sheet || worker.document.chunks.some(chunk => (chunk.locator.sheet ?? null) !== input.selection.sheet)
      || analysisFingerprint(source.sha256, source.id, worker.scope.selection, input.locale) !== fingerprint) throw new WorkerError("invalid-data");
    const packet = createTabularPacket(input.id, data.objective, worker, input.locale);
    await advanceAnalysis(uid!, input.id, job.attemptId, "interpreting");
    const emulator = isAnalysisEmulator();
    let usage: AiJob["usage"];
    let generateFn: GeminiGenerate;
    let useFixedEmulatorText = false;
    if (options.generate) {
      generateFn = options.generate;
    } else if (emulator) {
      useFixedEmulatorText = true;
      generateFn = async () => "";
    } else {
      const key = await (options.readKey ?? readGeminiKey)();
      generateFn = createGeminiGenerate(key, value => { usage = value; });
    }
    const modelStarted = Date.now();
    const result = await interpretTable(packet, input.locale, generateFn, useFixedEmulatorText);
    const modelMs = Date.now() - modelStarted;
    await advanceAnalysis(uid!, input.id, job.attemptId, "saving");
    if (Buffer.byteLength(JSON.stringify(result)) > AI_JOB_LIMITS.outputBytes) throw new WorkerError("scope-limit");
    const artifact: AiArtifact = { version: 1, result, sources: [worker.document], scope: worker.scope, locale: input.locale };
    const encoded = Buffer.from(JSON.stringify(artifact));
    await bucket.file(artifactPath).save(gzipSync(encoded), { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: "application/gzip", cacheControl: "private, no-store" } });
    savedHash = createHash("sha256").update(encoded).digest("hex");
    const completed: AiJob = { ...job, stage: "saving", status: "completed", finishedAt: Date.now(), artifactPath, artifactSha256: savedHash,
        model: emulator ? "emulator" : GEMINI_MODEL, durationMs: Date.now() - startedAt, pythonMs, modelMs,
        ...(!useFixedEmulatorText ? { inputBytes: packet.inputBytes } : {}), ...(usage ? { usage } : {}) };
    const committed = await completeAnalysis(uid!, input.id, job.attemptId, completed);
    if (!committed) {
      if (!hasActiveAnalysisLease(job, Date.now())) throw new WorkerError("timeout");
      throw new HttpsError("aborted", "Çalışma değişti veya silindi; sonuç kaydedilmedi.");
    }
    return { id: input.id, status: "completed", reused: false };
  } catch (error) {
    const failure = failureCode(error), finishedAt = Date.now();
    const retryDelay = failure === "provider-rate-limit" ? AI_JOB_LIMITS.rateLimitDelayMs
      : failure === "provider-busy" || failure === "timeout" ? AI_JOB_LIMITS.retryDelayMs : 0;
    const failureDetails = { analysisFailure: failure, ...(retryDelay ? { retryAfter: finishedAt + retryDelay } : {}) };
    const disposition = await getFirestore().runTransaction(async tx => {
      const current = await tx.get(ref);
      const next = failureDisposition(current.data(), job.attemptId, artifactPath, savedHash);
      if (next === "fail") tx.update(ref, { ai: { ...job, status: "failed", finishedAt, error: failure, durationMs: finishedAt - startedAt,
        ...(failureDetails.retryAfter !== undefined ? { retryAfter: failureDetails.retryAfter } : {}) }, updatedAt: finishedAt });
      return next;
    }).catch(() => {
      warn("analysis-finalization-unconfirmed", { failure });
      return "preserve" as const;
    });
    if (disposition === "published") return { id: input.id, status: "completed", reused: false };
    if (savedHash && (disposition === "fail" || disposition === "unreferenced")) {
      await bucket.file(artifactPath).delete({ ignoreNotFound: true }).catch(() => {
        warn("analysis-artifact-cleanup-failed", { failure });
      });
    }
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("failed-precondition", "Analiz tamamlanamadı. Kaynakları ve analiz kapsamını kontrol edip yeniden deneyin.", failureDetails);
  }
}

// Kullanıcı onayıyla tek tabloyu hesaplar ve yorumlar; otomatik ücretli retry veya metrik tahmini yapmaz.
export const startAnalysis = onCall({ region: "europe-west1", timeoutSeconds: 180, memory: "1GiB", maxInstances: 2, concurrency: 1 }, async request => {
  return executeStartAnalysis(request.auth?.uid, request.data, { access: tabularAnalysisAccess(request.auth?.token.incagenTabularBeta) });
});
