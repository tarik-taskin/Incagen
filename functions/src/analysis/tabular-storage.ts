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
const SAMPLE_ROW_LIMIT = 5;
const SAMPLE_CELL_MAX_LENGTH = 120;
const ANALYSIS_ROW_LIMIT = 5000;
export interface AiArtifact { version: 1; result: AiResult; sources: ParsedDocument[]; scope: WorkerResult["scope"]; locale: ResultLocale }

// Örnek satır hücresini tablo katalog boyutunu aşmayacak biçimde güvenli metin/sayı değerine indirger.
function previewCell(cell: string | number | boolean | null | undefined): string | number | boolean | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === "string" && cell.length > SAMPLE_CELL_MAX_LENGTH) return `${cell.slice(0, SAMPLE_CELL_MAX_LENGTH - 1)}…`;
  return cell;
}

// Hazırlanan CSV/XLSX belgelerinden küçük satır örnekli, durum açıklamalı tablo kataloğu oluşturur; tam kopya üretmez.
export async function buildAnalysisTables(
  sources: Report["sources"],
  loadDocument: (source: Report["sources"][number]) => Promise<ParsedDocument>,
): Promise<AnalysisTable[]> {
  const tables: AnalysisTable[] = [];
  for (const source of sources.filter(item => /\.(csv|xlsx)$/i.test(item.name))) {
    let document: ParsedDocument;
    try {
      document = await loadDocument(source);
    } catch {
      tables.push({ sourceId: source.id, fileName: source.name, sheet: null, columns: [], rows: 0, nonEmptyRows: 0, sampleRows: [], unavailableReason: "unreadable-table" });
      continue;
    }
    const tableChunks = document.chunks.filter(chunk => chunk.kind === "table" && chunk.table);
    if (tableChunks.length === 0) {
      tables.push({ sourceId: source.id, fileName: source.name, sheet: null, columns: [], rows: 0, nonEmptyRows: 0, sampleRows: [], unavailableReason: "empty-table" });
      continue;
    }
    for (const chunk of tableChunks) {
      const sheet = chunk.locator.sheet ?? null;
      const chunkRows = chunk.table!.rows;
      const rowStart = chunk.locator.rowStart ?? 1;
      let table = tables.find(item => item.sourceId === source.id && item.sheet === sheet);
      if (!table) {
        table = { sourceId: source.id, fileName: source.name, sheet, columns: chunk.table!.columns, rows: 0, nonEmptyRows: 0, sampleRows: [] };
        tables.push(table);
      } else if (JSON.stringify(table.columns) !== JSON.stringify(chunk.table!.columns)) {
        table.unavailableReason = "inconsistent-columns";
        continue;
      }
      table.rows += chunkRows.length;
      for (let offset = 0; offset < chunkRows.length; offset++) {
        const row = chunkRows[offset];
        const hasContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== "");
        if (hasContent) table.nonEmptyRows = (table.nonEmptyRows ?? 0) + 1;
        if ((table.sampleRows?.length ?? 0) < SAMPLE_ROW_LIMIT) {
          table.sampleRows!.push({ row: rowStart + offset, values: row.map(previewCell) });
        }
      }
    }
  }
  for (const table of tables) {
    if (table.unavailableReason) continue;
    if (table.columns.length === 0) table.unavailableReason = "unreadable-table";
    else if (table.rows === 0 || (table.nonEmptyRows ?? 0) === 0) table.unavailableReason = "empty-table";
    else if (table.rows > ANALYSIS_ROW_LIMIT) table.unavailableReason = "row-limit";
  }
  return tables;
}

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

// Katalog yalnız başlık/konum/adet ve en fazla 5 örnek satır döndürür; model veya Python çağrısı başlatmaz.
export const getAnalysisTables = onCall({ region: "europe-west1", timeoutSeconds: 60, memory: "512MiB", maxInstances: 2, concurrency: 4 }, async request => {
  const parsed = idRequest.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Geçersiz analiz kimliği.");
  const { data } = await preparedAnalysis(request.auth?.uid, parsed.data.id);
  try {
    const tables = await buildAnalysisTables(
      data.report.sources,
      source => preparedDocument(request.auth!.uid, parsed.data.id, data.artifactAttempt, source),
    );
    if (tables.length > 20 || Buffer.byteLength(JSON.stringify(tables)) > 512 * 1024) throw new HttpsError("resource-exhausted", "Daha az tablo içeren bir çalışma seçin.");
    return { tables, limits: { rows: ANALYSIS_ROW_LIMIT, groups: 12, attempts: AI_JOB_LIMITS.attempts } };
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
