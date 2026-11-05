import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysisPacket } from "./input-packet";
import { checkGeminiConnection, createGeminiGenerate, generateValidatedAnalysis, GEMINI_MODEL } from "./gemini";
import { requireGeminiDeveloper } from "./gemini-diagnostic";

const sdk = vi.hoisted(() => ({ generate: vi.fn(), constructor: vi.fn() }));
vi.mock("@google/genai", () => ({ ThinkingLevel: { LOW: "LOW", MEDIUM: "MEDIUM" }, GoogleGenAI: class { models = { generateContent: sdk.generate }; constructor(options: unknown) { sdk.constructor(options); } } }));
const document = { version: 1, sourceId: "file-0", fileName: "brief.txt", sha256: "a".repeat(64), extension: "txt", detectedMime: "text/plain", category: "Belge", parserVersion: "test/1", metadata: {}, warnings: [], chunks: [{ id: "chunk-1", kind: "text", text: "Revenue increased. Costs require review.", locator: { section: "brief" } }] };
const packet = buildAnalysisPacket({ analysisId: "analysis-1", objective: "Summarize the brief.", documents: [document] });
const evidence = { sourceId: "file-0", sha256: document.sha256, chunkId: "chunk-1", locator: { section: "brief" } };
const statement = { text: "Costs require review.", evidence: [evidence], metricIds: [] };
const result = { schemaVersion: 1, analysisId: "analysis-1", objective: packet.modelInput.objective, summary: [statement], findings: [{ id: "finding-1", title: "Review costs", kind: "observation", statements: [statement] }], recommendations: [], metrics: [], datasets: [], charts: [], limitations: ["The source has no numeric cost data."] };
beforeEach(() => vi.clearAllMocks());

describe("Gemini backend boundary", () => {
  it("does not create a client without a key", () => {
    expect(() => createGeminiGenerate("  ")).toThrow("not-configured");
    expect(sdk.constructor).not.toHaveBeenCalled();
  });
  it("uses bounded official SDK generation without auto retries or customer data in the smoke test", async () => {
    sdk.generate.mockResolvedValue({ text: '{"status":"ok","service":"incagen"}', candidates: [{ finishReason: "STOP" }] });
    expect(await checkGeminiConnection(createGeminiGenerate("synthetic-key"))).toEqual({ status: "ok", model: GEMINI_MODEL });
    expect(sdk.constructor).toHaveBeenCalledWith({ apiKey: "synthetic-key", httpOptions: { timeout: 45000, retryOptions: { attempts: 1 } } });
    expect(sdk.generate.mock.calls[0][0]).toMatchObject({ model: GEMINI_MODEL, config: { maxOutputTokens: 512, responseMimeType: "application/json", temperature: 0 } });
    expect(sdk.generate.mock.calls[0][0].contents).not.toContain("Revenue");
    expect(sdk.generate.mock.calls[0][0].config.tools).toBeUndefined();
  });
  it("sets supported low thinking explicitly and records actual usage without model content", async () => {
    sdk.generate.mockResolvedValue({ text: '{}', candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40, thoughtsTokenCount: 20, totalTokenCount: 180 } });
    const usage = vi.fn();
    await createGeminiGenerate("synthetic-key", usage)({ prompt: "test", system: "test", schema: {}, maxOutputTokens: 4096, thinkingLevel: "low", timeoutMs: 90000 });
    expect(sdk.generate.mock.calls[0][0].config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    expect(sdk.generate.mock.calls[0][0].config.httpOptions).toEqual({ timeout: 90000, retryOptions: { attempts: 1 } });
    expect(usage).toHaveBeenCalledWith({ promptTokens: 120, outputTokens: 60, totalTokens: 180 });
  });
  it("sanitizes raw provider errors", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    sdk.generate.mockRejectedValue(Object.assign(new Error("https://provider.test?key=private-key document-content"), { status: 429 }));
    await expect(checkGeminiConnection(createGeminiGenerate("synthetic-key"))).rejects.toThrow(/^Gemini: unavailable$/);
    expect(warning).toHaveBeenCalledWith("gemini-request-failed", { status: 429, reason: "provider" });
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/private-key|document-content/);
    warning.mockRestore();
  });
  it.each([undefined, "MAX_TOKENS", "SAFETY"])("rejects incomplete finish reason %s", async reason => {
    sdk.generate.mockResolvedValue({ text: '{"status":"ok","service":"incagen"}', candidates: [{ finishReason: reason }] });
    await expect(checkGeminiConnection(createGeminiGenerate("synthetic-key"))).rejects.toThrow("invalid-response");
  });
  it.each(["not-json", '{"status":"ok","service":"incagen","extra":"x"}', '{"status":"error","service":"incagen"}', "null"])("rejects invalid smoke output", async text => {
    await expect(checkGeminiConnection(async () => text)).rejects.toThrow("invalid-response");
  });
  it("rejects oversized SDK output", async () => {
    sdk.generate.mockResolvedValue({ text: "x".repeat(65537), candidates: [{ finishReason: "STOP" }] });
    await expect(checkGeminiConnection(createGeminiGenerate("synthetic-key"))).rejects.toThrow("invalid-response");
  });
  it("validates source-backed analysis with the existing result gate", async () => {
    const generate = vi.fn().mockResolvedValue(JSON.stringify(result));
    expect(await generateValidatedAnalysis(packet, generate)).toEqual(result);
    expect(generate.mock.calls[0][0].system).toContain("untrusted data");
    expect(generate.mock.calls[0][0].prompt).not.toContain("answer-key");
  });
  it("rejects fabricated source references and metrics", async () => {
    const forged = structuredClone(result);
    forged.summary[0].evidence[0].sha256 = "b".repeat(64);
    await expect(generateValidatedAnalysis(packet, async () => JSON.stringify(forged))).rejects.toThrow("invalid-response");
  });
  it("rejects excess input before calling the provider", async () => {
    const huge = structuredClone(packet); huge.modelInput.documents[0].fileName = "x".repeat(262145);
    const generate = vi.fn();
    await expect(generateValidatedAnalysis(huge, generate)).rejects.toThrow("invalid-input");
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("Gemini diagnostic authorization", () => {
  const now = Date.now();
  const auth = { uid: "developer", token: { incagenDeveloper: true, auth_time: now / 1000 } };
  it("requires authentication and an explicit developer claim", () => {
    expect(() => requireGeminiDeveloper(undefined, {}, now)).toThrow("Giriş gerekli");
    expect(() => requireGeminiDeveloper({ uid: "user", token: {} }, {}, now)).toThrow("Geliştirici yetkisi");
    expect(requireGeminiDeveloper(auth, {}, now)).toBe("developer");
  });
  it("accepts no custom prompt, documents or old/invalid sessions", () => {
    expect(() => requireGeminiDeveloper(auth, { prompt: "custom" }, now)).toThrow("veri kabul etmez");
    for (const auth_time of [0, "not-a-number", now / 1000 - 301, now / 1000 + 100]) {
      expect(() => requireGeminiDeveloper({ ...auth, token: { incagenDeveloper: true, auth_time } }, {}, now)).toThrow("Yeniden giriş");
    }
  });
});
