import { describe, expect, it } from "vitest";
import type { Analysis, AnalysisStatus } from "../../../functions/src/contracts";
import { buildHistoryView, summarizeHistory } from "./history-view";

function analysis(id: string, status: AnalysisStatus): Analysis {
  return { id, title: id, business: "Sentetik İşletme", status, createdAt: 1, updatedAt: 1 };
}

describe("history view", () => {
  it("tamamlanan, aktif ve başarısız kayıtları ayrı sayar", () => {
    const rows = [
      analysis("ready", "completed"),
      analysis("draft", "draft"),
      analysis("upload", "uploading"),
      analysis("processing", "processing"),
      analysis("deleting", "deleting"),
      analysis("failed", "failed"),
    ];

    expect(summarizeHistory(rows)).toEqual({ total: 6, completed: 1, active: 4, failed: 1 });
  });

  it("boş arşiv için sıfır değerleri döndürür", () => {
    expect(summarizeHistory([])).toEqual({ total: 0, completed: 0, active: 0, failed: 0 });
  });

  it("başlık, işletme ve kaynak adını Türkçe karakter farklarından bağımsız arar", () => {
    const rows = [
      { ...analysis("one", "completed"), title: "Eylül Özeti", business: "İşletme A" },
      { ...analysis("two", "completed"), title: "Bütçe", business: "Şirket B", report: {
        version: 3 as const, fileCount: 1, totalBytes: 1, totalChunks: 1, totalCharacters: 1,
        sources: [{ id: "source", name: "Faaliyet Raporu.pdf", size: 1, declaredContentType: "application/pdf", detectedMime: "application/pdf", sha256: "hash", category: "Belge" as const, chunkCount: 1, characterCount: 1, warnings: [], metadata: {} }],
      } },
    ];
    const options = { status: "all" as const, period: "all" as const, sort: "newest" as const };

    expect(buildHistoryView(rows, { ...options, query: "eylul" }).map(row => row.id)).toEqual(["one"]);
    expect(buildHistoryView(rows, { ...options, query: "isletme" }).map(row => row.id)).toEqual(["one"]);
    expect(buildHistoryView(rows, { ...options, query: "faaliyet raporu" }).map(row => row.id)).toEqual(["two"]);
  });

  it("durum ve tarih filtresini birlikte uygulayıp istenen sıraya dizer", () => {
    const now = new Date("2026-09-26T12:00:00+03:00").getTime();
    const rows = [
      { ...analysis("new-failed", "failed"), title: "Z Raporu", createdAt: now - 1_000 },
      { ...analysis("old-failed", "failed"), title: "A Raporu", createdAt: now - 40 * 86_400_000 },
      { ...analysis("active", "processing"), title: "B Raporu", createdAt: now - 2_000 },
    ];

    expect(buildHistoryView(rows, { query: "", status: "failed", period: "30d", sort: "title" }, now).map(row => row.id)).toEqual(["new-failed"]);
    expect(buildHistoryView(rows, { query: "", status: "active", period: "all", sort: "oldest" }, now).map(row => row.id)).toEqual(["active"]);
  });
});
