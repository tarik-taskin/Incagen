import { expect, it } from "vitest";
import type { Analysis } from "../../../functions/src/contracts";
import { analysisDisplayStatus } from "./analysis-status";

// Eski kayıt, süresi dolan iş ve silme yarışında kullanıcıya yanıltıcı hazır/çalışıyor etiketi gösterilmez.
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
