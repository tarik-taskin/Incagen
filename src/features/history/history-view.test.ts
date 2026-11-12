import { describe, expect, it } from "vitest";
import type { Analysis, AnalysisStatus } from "../../../functions/src/contracts";
import { buildHistoryView, parseHistoryView, serializeHistoryView, summarizeHistory } from "./history-view";

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

  it("analiz hedefini arar; eski hedefsiz kaydı ve onay bekleyenlerin dikkat filtresini korur", () => {
    const rows = [{ ...analysis("review", "review"), objective: "Müşteri deneyimindeki değişimi incele" }, analysis("legacy", "completed")];
    expect(buildHistoryView(rows, { query: "musteri deneyimi", status: "all", period: "all", sort: "newest" }).map(row => row.id)).toEqual(["review"]);
    expect(buildHistoryView(rows, { query: "", status: "failed", period: "all", sort: "newest" }).map(row => row.id)).toEqual(["review"]);
    expect(summarizeHistory(rows)).toEqual({ total: 2, completed: 1, active: 0, failed: 1 });
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

  it("geçerli görünümü kısa URL parametrelerine çevirip geri okur", () => {
    const options = { query: "Eylül özeti", status: "completed" as const, period: "30d" as const, sort: "title" as const };
    const params = serializeHistoryView(options);

    expect(params.toString()).toBe("q=Eyl%C3%BCl+%C3%B6zeti&status=completed&period=30d&sort=title");
    expect(parseHistoryView(params)).toEqual(options);
  });

  it("bilinmeyen URL seçimlerinde güvenli varsayılanları kullanır", () => {
    const params = new URLSearchParams("q=test&status=unknown&period=365d&sort=random");

    expect(parseHistoryView(params)).toEqual({ query: "test", status: "all", period: "all", sort: "newest" });
  });

  it("süresi dolmuş lease, tükenmiş retry ve AI durumlarını sayaç ve filtrelerde doğru sınıflandırır", () => {
    const now = 10_000;
    const expiredAi: Analysis = {
      ...analysis("expired-lease", "completed"),
      ai: { status: "running", leaseUntil: 5_000, attempts: 1, maxAttempts: 3 } as Analysis["ai"],
    };
    const activeAi: Analysis = {
      ...analysis("active-ai", "completed"),
      ai: { status: "running", leaseUntil: 15_000, attempts: 1, maxAttempts: 3 } as Analysis["ai"],
    };
    const completedAi: Analysis = {
      ...analysis("done-ai", "completed"),
      ai: { status: "completed" } as Analysis["ai"],
    };
    const failedAi: Analysis = {
      ...analysis("failed-ai", "completed"),
      ai: { status: "failed", attempts: 1, maxAttempts: 3 } as Analysis["ai"],
    };
    const exhaustedAi: Analysis = {
      ...analysis("exhausted-ai", "completed"),
      ai: { status: "failed", attempts: 3, maxAttempts: 3 } as Analysis["ai"],
    };

    const rows = [expiredAi, activeAi, completedAi, failedAi, exhaustedAi];

    // Sayaç kontrolü:
    // expiredAi -> failed (1)
    // activeAi -> active (1)
    // completedAi -> completed (1)
    // failedAi -> failed (2)
    // exhaustedAi -> failed (3)
    expect(summarizeHistory(rows, now)).toEqual({
      total: 5,
      completed: 1,
      active: 1,
      failed: 3,
    });

    // Filtreleme kontrolü:
    // "completed" filtresinde yalnızca done-ai çıkmalı
    const completedRows = buildHistoryView(rows, { query: "", status: "completed", period: "all", sort: "newest" }, now);
    expect(completedRows.map(r => r.id)).toEqual(["done-ai"]);

    // "failed" (Dikkat istiyor) filtresinde expired-lease, failed-ai ve exhausted-ai çıkmalı
    const failedRows = buildHistoryView(rows, { query: "", status: "failed", period: "all", sort: "newest" }, now);
    expect(failedRows.map(r => r.id).sort()).toEqual(["exhausted-ai", "expired-lease", "failed-ai"].sort());

    // "active" filtresinde active-ai çıkmalı
    const activeRows = buildHistoryView(rows, { query: "", status: "active", period: "all", sort: "newest" }, now);
    expect(activeRows.map(r => r.id)).toEqual(["active-ai"]);
  });
});

it("sorts titles by the selected language and keeps equal-title source order", () => {
  const rows = ["I", "H", "ı", "İ"].map((title, id) => ({ ...analysis(String(id), "completed"), title }));
  const options = { query: "", status: "all" as const, period: "all" as const, sort: "title" as const };
  expect(buildHistoryView(rows, options, 1, "tr-TR").map(row => row.title)).toEqual(["H", "I", "ı", "İ"]);
  expect(buildHistoryView(rows, options, 1, "en-US").map(row => row.title)).toEqual(["H", "I", "İ", "ı"]);
  expect(rows.map(row => row.id)).toEqual(["0", "1", "2", "3"]);
});

it("finds source names from preparation review, failures and excluded sources without changing status filters", () => {
  const rows: Analysis[] = [
    { ...analysis("review", "review"), preparationReview: { token: "synthetic", ready: [{ id: "a", name: "Hazır belge.xlsx" }], rejected: [{ id: "b", name: "Bozuk kaynak.docx", reason: "synthetic" }] } },
    { ...analysis("failed", "failed"), preparationFailures: [{ id: "c", name: "Faaliyet.pdf", reason: "synthetic" }] },
    { ...analysis("completed", "completed"), report: { version: 3, fileCount: 0, totalBytes: 0, totalChunks: 0, totalCharacters: 0, sources: [], excludedSources: [{ id: "d", name: "Kapsam dışı.csv", reason: "synthetic" }] } },
  ];
  const options = { query: "", status: "all" as const, period: "all" as const, sort: "newest" as const };
  for (const [query, id] of [["hazir belge", "review"], ["bozuk kaynak", "review"], ["faaliyet.pdf", "failed"], ["kapsam disi", "completed"]]) {
    expect(buildHistoryView(rows, { ...options, query }).map(row => row.id)).toEqual([id]);
  }
  expect(buildHistoryView(rows, { ...options, query: "bozuk kaynak", status: "completed" })).toEqual([]);
  expect(summarizeHistory(rows)).toEqual({ total: 3, completed: 1, active: 0, failed: 2 });
});
