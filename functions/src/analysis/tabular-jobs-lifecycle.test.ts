import { describe, expect, it } from "vitest";
import { GeminiError } from "./gemini";
import { AnalysisPacketBudgetError } from "./input-packet";
import { WorkerError } from "./python-worker";
import { failureCode } from "./tabular-jobs";

describe("AI iş yaşam döngüsü hata sınıflandırması", () => {
  it("sağlayıcı busy/timeout, geçersiz yanıt, kapsam aşımı ve eksik anahtar hatalarını ayırır", () => {
    expect(failureCode(new GeminiError("busy"))).toBe("provider-busy");
    expect(failureCode(new GeminiError("timeout"))).toBe("timeout");
    expect(failureCode(new GeminiError("invalid-response"))).toBe("validation");
    expect(failureCode(new GeminiError("invalid-input"))).toBe("validation");
    expect(failureCode(new GeminiError("not-configured"))).toBe("configuration");
    expect(failureCode(new GeminiError("unavailable"))).toBe("provider");
    expect(failureCode(new WorkerError("invalid-data"))).toBe("invalid-data");
    expect(failureCode(new AnalysisPacketBudgetError(300_000, 256_000))).toBe("scope-limit");
    expect(failureCode(new Error("beklenmeyen hata"))).toBe("validation");
  });
});
