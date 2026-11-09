import { describe, expect, it } from "vitest";
import type { Analysis } from "../../../functions/src/contracts";
import { analysisDisplayStatus, resolveAnalysisState } from "./analysis-status";

describe("analysis-status - Görev 4 etiket ve durum çözümleme", () => {
  it("hazırlığı, gerçek sonucu ve iş kilidini ayrı gösterir", () => {
    const analysis = { status: "completed" } as Analysis;
    expect(analysisDisplayStatus(analysis, 100).label).toBe("Analize hazır");
    analysis.ai = { status: "running", leaseUntil: 200 } as Analysis["ai"];
    expect(analysisDisplayStatus(analysis, 100).state).toBe("processing");
    expect(analysisDisplayStatus(analysis, 200).label).toBe("Analiz yeniden denenebilir");
    analysis.ai!.status = "completed";
    expect(analysisDisplayStatus(analysis, 300).label).toBe("Analiz hazır");
    analysis.status = "deleting";
    expect(analysisDisplayStatus(analysis, 300)).toEqual({ state: "deleting", label: "Siliniyor" });
  });

  it("resolveAnalysisState ile etiket ve arşiv kategorisi tekil mantıkla eşleşir", () => {
    // 1. Henüz AI olmayan tamamlanmış belge -> completed kategorisi
    const legacy = { status: "completed" } as Analysis;
    expect(resolveAnalysisState(legacy, 100)).toEqual({
      state: "completed",
      category: "completed",
      label: "Analize hazır",
    });

    // 2. Devam eden AI işi (lease geçerli) -> active kategorisi
    const running = {
      status: "completed",
      ai: { status: "running", leaseUntil: 500 },
    } as Analysis;
    expect(resolveAnalysisState(running, 100)).toEqual({
      state: "processing",
      category: "active",
      label: "Analiz hazırlanıyor",
    });

    // 3. Süresi dolmuş AI lease -> failed kategorisi
    expect(resolveAnalysisState(running, 600)).toEqual({
      state: "failed",
      category: "failed",
      label: "Analiz yeniden denenebilir",
    });

    // 4. Doğrudan failed AI -> failed kategorisi
    const failedAi = {
      status: "completed",
      ai: { status: "failed" },
    } as Analysis;
    expect(resolveAnalysisState(failedAi, 100)).toEqual({
      state: "failed",
      category: "failed",
      label: "Analiz yeniden denenebilir",
    });

    // 5. Tamamlanmış AI -> completed kategorisi
    const completedAi = {
      status: "completed",
      ai: { status: "completed" },
    } as Analysis;
    expect(resolveAnalysisState(completedAi, 100)).toEqual({
      state: "completed",
      category: "completed",
      label: "Analiz hazır",
    });

    // 6. Review bekleyen belge -> failed kategorisi (dikkat istiyor)
    const review = { status: "review" } as Analysis;
    expect(resolveAnalysisState(review, 100)).toEqual({
      state: "review",
      category: "failed",
      label: "Onay bekliyor",
    });
  });
});
