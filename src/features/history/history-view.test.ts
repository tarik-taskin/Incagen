import { describe, expect, it } from "vitest";
import type { Analysis, AnalysisStatus } from "../../../functions/src/contracts";
import { summarizeHistory } from "./history-view";

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
});
