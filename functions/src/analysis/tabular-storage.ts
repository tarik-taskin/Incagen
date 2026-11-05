import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { parsedDocumentSchema } from "./input-packet";
import { aiResultSchema, type AiResult } from "./result-contract";
import type { ParsedDocument, Report } from "../contracts";
import { AI_JOB_LIMITS, type AiJob, type AnalysisTable, type WorkerResult, type ResultLocale } from "./tabular-contract";

const idRequest = z.object({ id: z.string().uuid() }).strict();
export interface AiArtifact { version: 1; result: AiResult; sources: ParsedDocument[]; scope: WorkerResult["scope"]; locale: ResultLocale }

// İstemciden dosya yolu alınmaz; yalnız oturum UID'sine ait tamamlanmış hazırlık kullanılabilir.
export async function preparedAnalysis(uid: string | undefined, id: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Giriş gerekli.");
  const db = getFirestore();
  const [owner, snap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`users/${uid}/analyses/${id}`).get()]);
  if (!snap.exists) throw new HttpsError("not-found", "Analiz bulunamadı.");
  if (owner.data()?.deletingAccount || snap.data()?.status !== "completed") throw new HttpsError("failed-precondition", "Önce belge hazırlığını tamamlayın.");
  const data = snap.data()!;
  if (!data.report || !z.string().uuid().safeParse(data.artifactAttempt).success) throw new HttpsError("failed-precondition", "Kaynak hazırlığı bulunamadı.");
  return { ref: snap.ref, data: data as typeof data & { report: Report; artifactAttempt: string; objective: string; ai?: AiJob } };
}

// Sıkıştırılmış içerik de açılım sınırına tabidir; SHA ve kaynak kimliği hazırlık raporuyla eşleşir.
async function preparedDocument(uid: string, id: string, attempt: string, source: Report["sources"][number]) {
  const file = getStorage().bucket().file(`derived/${uid}/analyses/${id}/${attempt}/${source.id}.json.gz`);
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size) > 8 * 1024 * 1024) throw new HttpsError("resource-exhausted", "Kaynak kapsamı çok büyük.");
  const [data] = await file.download();
  const document = parsedDocumentSchema.parse(JSON.parse(gunzipSync(data, { maxOutputLength: 16 * 1024 * 1024 }).toString("utf8")));
  if (document.sourceId !== source.id || document.sha256 !== source.sha256 || document.fileName !== source.name) throw new HttpsError("failed-precondition", "Kaynak doğrulanamadı.");
  return document;
}

// Katalog yalnız başlık/konum/adet döndürür; model veya Python çağrısı başlatmaz.
export const getAnalysisTables = onCall({ region: "europe-west1", timeoutSeconds: 60, memory: "512MiB", maxInstances: 2, concurrency: 4 }, async request => {
  const parsed = idRequest.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Geçersiz analiz kimliği.");
  const { data } = await preparedAnalysis(request.auth?.uid, parsed.data.id);
  const tables: AnalysisTable[] = [];
  try {
    for (const source of data.report.sources.filter(source => /\.(csv|xlsx)$/i.test(source.name))) {
      const document = await preparedDocument(request.auth!.uid, parsed.data.id, data.artifactAttempt, source);
      for (const chunk of document.chunks.filter(chunk => chunk.kind === "table" && chunk.table)) {
        const sheet = chunk.locator.sheet ?? null;
        const table = tables.find(item => item.sourceId === source.id && item.sheet === sheet);
        if (table) {
          if (JSON.stringify(table.columns) !== JSON.stringify(chunk.table!.columns)) throw new Error();
          table.rows += chunk.table!.rows.length;
        } else tables.push({ sourceId: source.id, fileName: source.name, sheet, columns: chunk.table!.columns, rows: chunk.table!.rows.length });
      }
    }
    if (tables.length > 20 || Buffer.byteLength(JSON.stringify(tables)) > 512 * 1024) throw new HttpsError("resource-exhausted", "Daha az tablo içeren bir çalışma seçin.");
    return { tables, limits: { rows: 5000, groups: 12, attempts: AI_JOB_LIMITS.attempts } };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("failed-precondition", "Tablo bilgileri okunamadı. Yeniden deneyin.");
  }
});

// Yalnız sahibi tamamlanan, hash'i eşleşen sonuç artefaktını okuyabilir; ham Storage yolu istemciden alınmaz.
export const getAnalysisResult = onCall({ region: "europe-west1", timeoutSeconds: 60, memory: "512MiB", maxInstances: 2, concurrency: 4 }, async request => {
  const parsed = idRequest.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Geçersiz analiz kimliği.");
  const { data } = await preparedAnalysis(request.auth?.uid, parsed.data.id);
  const ai = data.ai;
  if (ai?.status !== "completed" || !ai.artifactPath || !ai.artifactSha256 || ai.artifactPath !== `derived/${request.auth!.uid}/analyses/${parsed.data.id}/ai/${ai.attemptId}.json.gz`) throw new HttpsError("failed-precondition", "Analiz sonucu henüz hazır değil.");
  try {
    const file = getStorage().bucket().file(ai.artifactPath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) > 2 * 1024 * 1024) throw new Error();
    const [encoded] = await file.download();
    const json = gunzipSync(encoded, { maxOutputLength: 4 * 1024 * 1024 });
    if (createHash("sha256").update(json).digest("hex") !== ai.artifactSha256) throw new Error();
    const artifact = JSON.parse(json.toString("utf8")) as AiArtifact;
    if (artifact.version !== 1 || artifact.result.analysisId !== parsed.data.id || artifact.result.objective !== data.objective) throw new Error();
    aiResultSchema.parse(artifact.result);
    artifact.sources.forEach(source => parsedDocumentSchema.parse(source));
    return artifact;
  } catch { throw new HttpsError("failed-precondition", "Analiz sonucu doğrulanamadı. Yeniden yükleyin."); }
});
