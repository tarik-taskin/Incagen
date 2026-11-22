import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { parsedDocumentSchema } from "./input-packet";
import { aiResultSchema, validateAiResult, type AiResult } from "./result-contract";
import { PARSING_LIMITS, type ParsedDocument, type Report } from "../contracts";
import { AI_JOB_LIMITS, resultLocaleSchema, workerResultSchema, type AiJob, type AnalysisTable, type ResultLocale, type TableSelection, type WorkerResult } from "./tabular-contract";

// Tekilleştirme anahtarı kaynak/ayar/dile bağlıdır; aynı istek yeni ücretli çağrı başlatmaz.
export function analysisFingerprint(sourceHash: string, sourceId: string, selection: TableSelection, locale: ResultLocale) {
  return createHash("sha256").update(JSON.stringify([sourceHash, sourceId, selection.sheet, selection.valueColumn, selection.groupColumn, selection.aggregation, selection.numberFormat, selection.unit, locale])).digest("hex");
}

const idRequest = z.object({ id: z.string().uuid() }).strict();
const SAMPLE_ROW_LIMIT = 5;
const SAMPLE_CELL_MAX_LENGTH = 120;
const SAMPLE_CELL_MAX_BYTES = 180;
const ANALYSIS_ROW_LIMIT = 5000;
const RAW_SOURCE_MAX_BYTES = 25 * 1024 * 1024;
export const ANALYSIS_TABLES_MAX_BYTES = 512 * 1024;
export interface AiArtifact { version: 1; result: AiResult; sources: ParsedDocument[]; scope: WorkerResult["scope"]; locale: ResultLocale }

// Metni UTF-8 bayt sınırına ve karakter sayısına göre Unicode çiftlerini bölmeden kısaltır.
function truncateUtf8(text: string, maxChars: number, maxBytes: number): string {
  if (text.length <= maxChars && Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  const ellipsis = "…";
  const ellipsisBytes = Buffer.byteLength(ellipsis, "utf8");
  if (maxChars <= 1 || maxBytes <= ellipsisBytes) return "";
  let out = "";
  let chars = 0;
  let bytes = 0;
  for (const ch of text) {
    const chBytes = Buffer.byteLength(ch, "utf8");
    if (chars + 1 >= maxChars || bytes + chBytes + ellipsisBytes > maxBytes) break;
    out += ch;
    chars += 1;
    bytes += chBytes;
  }
  return `${out}${ellipsis}`;
}

// Örnek satır hücresini tablo katalog boyutunu aşmayacak biçimde güvenli metin/sayı değerine indirger.
function previewCell(cell: string | number | boolean | null | undefined, maxChars = SAMPLE_CELL_MAX_LENGTH, maxBytes = SAMPLE_CELL_MAX_BYTES): string | number | boolean | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === "string") return truncateUtf8(cell, maxChars, maxBytes);
  return cell;
}

// JSON çıktısının gerçek UTF-8 bayt boyutunu hesaplar (çok baytlı karakterler dahil).
function jsonUtf8Bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

// CSV ilk mantıksal satırında tırnak dışındaki ayraçları sayarak Python ve TS ile tutarlı ayraç seçer.
function detectCsvDelimiter(text: string): string {
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && ch === "\n") {
      if ([...counts.values()].some(count => count > 0) || text.slice(0, index).trim().length > 0) break;
    } else if (!quoted && counts.has(ch)) {
      counts.set(ch, counts.get(ch)! + 1);
    }
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ",";
}

// Boş veya yinelenen başlıkları kararlı ve benzersiz sütun adlarına dönüştürür.
function normalizePreviewColumns(header: string[]): string[] {
  const seen = new Map<string, number>();
  return header.map((raw, index) => {
    const base = raw.trim() || `Sütun ${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

// Ham CSV baytlarından gerçek 1-tabanlı fiziksel dosya satırı numaralarıyla önizleme kataloğu çıkarır.
export function parseCsvTablePreview(data: Buffer, source: Pick<Report["sources"][number], "id" | "name">): AnalysisTable {
  const unreadable = (reason: AnalysisTable["unavailableReason"] = "unreadable-table"): AnalysisTable => ({
    sourceId: source.id,
    fileName: source.name,
    sheet: null,
    columns: [],
    rows: 0,
    nonEmptyRows: 0,
    sampleRows: [],
    sampleRowNumbering: "file-line",
    unavailableReason: reason,
  });
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    if (text.includes("\0")) return unreadable();
    text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  } catch {
    return unreadable();
  }
  const delimiter = detectCsvDelimiter(text);
  let index = 0;
  let line = 1;
  let header: string[] | null = null;
  let width = 0;
  let rows = 0;
  let nonEmptyRows = 0;
  const sampleRows: NonNullable<AnalysisTable["sampleRows"]> = [];

  while (index < text.length) {
    const startLine = line;
    if (text[index] === "\n") {
      index += 1;
      line += 1;
      if (header !== null) {
        rows += 1;
        if (sampleRows.length < SAMPLE_ROW_LIMIT) {
          sampleRows.push({ row: startLine, values: Array.from({ length: width }, () => null) });
        }
      }
      continue;
    }

    const fields: string[] = [];
    while (true) {
      if (text[index] === '"') {
        index += 1;
        let value = "";
        let closed = false;
        while (index < text.length) {
          const ch = text[index];
          if (ch === '"') {
            if (text[index + 1] === '"') {
              value += '"';
              index += 2;
            } else {
              index += 1;
              closed = true;
              break;
            }
          } else {
            if (ch === "\n") line += 1;
            value += ch;
            index += 1;
          }
        }
        if (!closed) return unreadable();
        fields.push(value);
        if (index >= text.length) break;
        if (text[index] === delimiter) {
          index += 1;
          continue;
        }
        if (text[index] === "\n") {
          index += 1;
          line += 1;
          break;
        }
        return unreadable();
      }

      let value = "";
      while (index < text.length && text[index] !== delimiter && text[index] !== "\n") {
        if (text[index] === '"') return unreadable();
        value += text[index];
        index += 1;
      }
      fields.push(value);
      if (index >= text.length) break;
      if (text[index] === delimiter) {
        index += 1;
        continue;
      }
      if (text[index] === "\n") {
        index += 1;
        line += 1;
        break;
      }
    }

    if (header === null) {
      if (fields.length === 0 || fields.length > PARSING_LIMITS.tableColumns) return unreadable();
      header = fields;
      width = header.length;
      continue;
    }
    if (fields.length !== width) return unreadable("inconsistent-columns");
    rows += 1;
    if (fields.some(cell => cell.trim() !== "")) nonEmptyRows += 1;
    if (sampleRows.length < SAMPLE_ROW_LIMIT) {
      sampleRows.push({ row: startLine, values: fields.map(cell => previewCell(cell)) });
    }
  }

  if (header === null) return unreadable("empty-table");
  const columns = normalizePreviewColumns(header);
  let unavailableReason: AnalysisTable["unavailableReason"];
  if (columns.length === 0) unavailableReason = "unreadable-table";
  else if (rows === 0 || nonEmptyRows === 0) unavailableReason = "empty-table";
  else if (rows > ANALYSIS_ROW_LIMIT) unavailableReason = "row-limit";

  return {
    sourceId: source.id,
    fileName: source.name,
    sheet: null,
    columns,
    rows,
    nonEmptyRows,
    sampleRows,
    sampleRowNumbering: "file-line",
    ...(unavailableReason ? { unavailableReason } : {}),
  };
}

// Katalog JSON bayt boyutu 512 KiB bütçesini aşarsa tablo ve sütun bilgisini koruyarak örnekleri kademeli daraltır.
export function fitAnalysisTablesBudget(tables: AnalysisTable[], maxBytes = ANALYSIS_TABLES_MAX_BYTES): AnalysisTable[] {
  if (jsonUtf8Bytes(tables) <= maxBytes) return tables;

  let current = tables.map(table => ({ ...table, sampleRows: table.sampleRows ? [...table.sampleRows] : undefined }));

  // 1. Aşama: Örnek satır sayısını tüm tablolarda eşit biçimde azalt (4 → 3 → 2 → 1).
  for (let rowLimit = SAMPLE_ROW_LIMIT - 1; rowLimit >= 1; rowLimit -= 1) {
    current = current.map(table => (
      table.sampleRows && table.sampleRows.length > rowLimit
        ? { ...table, sampleRows: table.sampleRows.slice(0, rowLimit) }
        : table
    ));
    if (jsonUtf8Bytes(current) <= maxBytes) return current;
  }

  // 2. Aşama: Tek örnek satır hâlâ bütçeyi aşıyorsa hücre metin uzunluğunu ve UTF-8 baytını daralt.
  for (const [maxChars, maxCellBytes] of [[60, 80], [32, 48], [16, 24], [8, 12]] as const) {
    current = current.map(table => (
      table.sampleRows && table.sampleRows.length > 0
        ? {
          ...table,
          sampleRows: table.sampleRows.map(sample => ({
            row: sample.row,
            values: sample.values.map(cell => previewCell(cell, maxChars, maxCellBytes)),
          })),
        }
        : table
    ));
    if (jsonUtf8Bytes(current) <= maxBytes) return current;
  }

  // 3. Aşama: Örnekler bütçeye sığmıyorsa örnekleri kaldırıp tablo ve sütun katalog bilgisini koru.
  return current.map(table => ({ ...table, sampleRows: [] }));
}

// Hazırlanan CSV/XLSX belgelerinden küçük satır örnekli, bütçe uyumlu ve durum açıklamalı tablo kataloğu oluşturur; tam kopya üretmez.
export async function buildAnalysisTables(
  sources: Report["sources"],
  loadDocument: (source: Report["sources"][number]) => Promise<ParsedDocument>,
  loadRawSource?: (source: Report["sources"][number]) => Promise<Buffer | null>,
): Promise<AnalysisTable[]> {
  const tables: AnalysisTable[] = [];
  for (const source of sources.filter(item => /\.(csv|xlsx)$/i.test(item.name))) {
    if (/\.csv$/i.test(source.name) && loadRawSource) {
      let raw: Buffer | null = null;
      try {
        raw = await loadRawSource(source);
      } catch {
        // Ham CSV okunamazsa türetilmiş belge yoluna (kayıt sırası) düş.
      }
      if (raw) {
        tables.push(parseCsvTablePreview(raw, source));
        continue;
      }
    }
    let document: ParsedDocument;
    try {
      document = await loadDocument(source);
    } catch {
      tables.push({ sourceId: source.id, fileName: source.name, sheet: null, columns: [], rows: 0, nonEmptyRows: 0, sampleRows: [], unavailableReason: "unreadable-table" });
      continue;
    }
    const isPhysicalLine = document.extension === "xlsx" || document.parserVersion.startsWith("incagen-python/");
    const sampleRowNumbering = isPhysicalLine ? "file-line" : "record";
    const tableChunks = document.chunks.filter(chunk => chunk.kind === "table" && chunk.table);
    if (tableChunks.length === 0) {
      tables.push({ sourceId: source.id, fileName: source.name, sheet: null, columns: [], rows: 0, nonEmptyRows: 0, sampleRows: [], sampleRowNumbering, unavailableReason: "empty-table" });
      continue;
    }
    for (const chunk of tableChunks) {
      const sheet = chunk.locator.sheet ?? null;
      const chunkRows = chunk.table!.rows;
      const rowStart = chunk.locator.rowStart ?? 1;
      let table = tables.find(item => item.sourceId === source.id && item.sheet === sheet);
      if (!table) {
        table = { sourceId: source.id, fileName: source.name, sheet, columns: chunk.table!.columns, rows: 0, nonEmptyRows: 0, sampleRows: [], sampleRowNumbering };
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
          table.sampleRows!.push({ row: rowStart + offset, values: row.map(cell => previewCell(cell)) });
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
  return fitAnalysisTablesBudget(tables, ANALYSIS_TABLES_MAX_BYTES);
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

// CSV önizlemesi için özgün yüklenen dosyayı boyut ve SHA-256 kontrolüyle okur; erişilemezse eski kayıt yoluna düşer.
async function verifiedRawCsv(uid: string, id: string, source: Report["sources"][number]): Promise<Buffer | null> {
  if (!/\.csv$/i.test(source.name) || source.size <= 0 || source.size > RAW_SOURCE_MAX_BYTES) return null;
  try {
    const file = getStorage().bucket().file(`users/${uid}/analyses/${id}/${source.id}`);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) !== source.size || Number(metadata.size) > RAW_SOURCE_MAX_BYTES) return null;
    const [raw] = await file.download();
    if (createHash("sha256").update(raw).digest("hex") !== source.sha256) return null;
    return raw;
  } catch {
    return null;
  }
}

// Katalog yalnız başlık/konum/adet ve bütçeye sığan en fazla 5 örnek satır döndürür; model veya Python çağrısı başlatmaz.
export const getAnalysisTables = onCall({ region: "europe-west1", timeoutSeconds: 60, memory: "512MiB", maxInstances: 2, concurrency: 4 }, async request => {
  const parsed = idRequest.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Geçersiz analiz kimliği.");
  const { data } = await preparedAnalysis(request.auth?.uid, parsed.data.id);
  try {
    const tables = await buildAnalysisTables(
      data.report.sources,
      source => preparedDocument(request.auth!.uid, parsed.data.id, data.artifactAttempt, source),
      source => verifiedRawCsv(request.auth!.uid, parsed.data.id, source),
    );
    if (tables.length > 20 || jsonUtf8Bytes(tables) > ANALYSIS_TABLES_MAX_BYTES) throw new HttpsError("resource-exhausted", "Daha az tablo içeren bir çalışma seçin.");
    return { tables, limits: { rows: ANALYSIS_ROW_LIMIT, groups: 12, attempts: AI_JOB_LIMITS.attempts } };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("failed-precondition", "Tablo bilgileri okunamadı. Yeniden deneyin.");
  }
});

// Kayıtlı iş seçimi ile artefakt kapsamındaki seçim alanlarının birebir eşleştiğini doğrular.
function selectionsMatch(a: TableSelection, b: TableSelection) {
  return a.sheet === b.sheet
    && a.valueColumn === b.valueColumn
    && a.groupColumn === b.groupColumn
    && a.aggregation === b.aggregation
    && a.numberFormat === b.numberFormat
    && a.unit === b.unit;
}

// Saklanan v1 artefaktının kapsam, dil, kaynak kimliği/hash'i, parça satır/sayfa bağları ile grafik/veri kümesi referanslarını doğrular (yapısal bütünlük kontrolüdür; model kalite kabulü değildir).
export function validateStoredArtifact(
  rawArtifact: unknown,
  expected: {
    analysisId: string;
    objective: string;
    job: AiJob & { fingerprint?: string };
    reportSource?: Report["sources"][number];
  },
): AiArtifact {
  if (!rawArtifact || typeof rawArtifact !== "object") throw new Error("invalid-artifact");
  const candidate = rawArtifact as Partial<AiArtifact>;
  if (candidate.version !== 1) throw new Error("invalid-version");
  const locale = resultLocaleSchema.parse(candidate.locale);
  if (locale !== expected.job.locale) throw new Error("locale-mismatch");
  const scope = workerResultSchema.shape.scope.parse(candidate.scope);
  if (scope.sheet !== expected.job.selection.sheet || !selectionsMatch(scope.selection, expected.job.selection)) {
    throw new Error("scope-mismatch");
  }
  const result = aiResultSchema.parse(candidate.result);
  if (result.analysisId !== expected.analysisId || result.objective !== expected.objective) {
    throw new Error("result-context-mismatch");
  }
  if (!Array.isArray(candidate.sources) || candidate.sources.length !== 1) {
    throw new Error("sources-mismatch");
  }
  const source = parsedDocumentSchema.parse(candidate.sources[0]);
  const reportSource = expected.reportSource;
  if (!reportSource || source.sourceId !== expected.job.sourceId || source.sourceId !== reportSource.id
    || source.sha256 !== reportSource.sha256 || source.fileName !== reportSource.name) {
    throw new Error("source-integrity-mismatch");
  }
  if (source.chunks.length === 0 || source.chunks.some(chunk => chunk.kind !== "table" || !chunk.table || (chunk.locator.sheet ?? null) !== expected.job.selection.sheet)) {
    throw new Error("sheet-integrity-mismatch");
  }
  if (typeof expected.job.fingerprint === "string" && expected.job.fingerprint.length > 0) {
    const computedFingerprint = analysisFingerprint(source.sha256, source.sourceId, scope.selection, locale);
    if (computedFingerprint !== expected.job.fingerprint) throw new Error("fingerprint-mismatch");
  }
  // Mevcut kaynak, satır aralığı, metrik, veri kümesi ve grafik referans sözleşmesini arayüze dönmeden uygular.
  const validatedResult = validateAiResult(result, {
    analysisId: expected.analysisId,
    objective: expected.objective,
    sources: [{
      id: source.sourceId,
      sha256: source.sha256,
      chunks: source.chunks.map(chunk => ({ id: chunk.id, locator: chunk.locator })),
    }],
    metrics: result.metrics,
    datasets: result.datasets,
  });
  return { version: 1, result: validatedResult, sources: [source], scope, locale };
}

// Yalnız sahibi tamamlanan, hash'i ve kapsam/kaynak bağı eşleşen sonuç artefaktını okuyabilir; ham Storage yolu istemciden alınmaz.
export const getAnalysisResult = onCall({ region: "europe-west1", timeoutSeconds: 60, memory: "512MiB", maxInstances: 2, concurrency: 4 }, async request => {
  const parsed = idRequest.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Geçersiz analiz kimliği.");
  const { data } = await preparedAnalysis(request.auth?.uid, parsed.data.id);
  const ai = data.ai as (AiJob & { fingerprint?: string }) | undefined;
  if (ai?.status !== "completed" || !ai.artifactPath || !ai.artifactSha256 || ai.artifactPath !== `derived/${request.auth!.uid}/analyses/${parsed.data.id}/ai/${ai.attemptId}.json.gz`) throw new HttpsError("failed-precondition", "Analiz sonucu henüz hazır değil.");
  const reportSource = data.report.sources.find(source => source.id === ai.sourceId);
  try {
    const file = getStorage().bucket().file(ai.artifactPath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) > 2 * 1024 * 1024) throw new Error();
    const [encoded] = await file.download();
    const json = gunzipSync(encoded, { maxOutputLength: 4 * 1024 * 1024 });
    if (createHash("sha256").update(json).digest("hex") !== ai.artifactSha256) throw new Error();
    return validateStoredArtifact(JSON.parse(json.toString("utf8")), {
      analysisId: parsed.data.id,
      objective: data.objective,
      job: ai,
      reportSource,
    });
  } catch { throw new HttpsError("failed-precondition", "Analiz sonucu doğrulanamadı. Yeniden yükleyin."); }
});
