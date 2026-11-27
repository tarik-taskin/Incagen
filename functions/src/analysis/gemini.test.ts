import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysisPacket } from "./input-packet";
import { checkGeminiConnection, checkGeminiInteractions, createGeminiGenerate, generateValidatedAnalysis, GEMINI_MODEL } from "./gemini";
import { requireGeminiDeveloper } from "./gemini-diagnostic";

const sdk = vi.hoisted(() => ({ generate: vi.fn(), interact: vi.fn(), constructor: vi.fn() }));
vi.mock("@google/genai", () => ({ ThinkingLevel: { LOW: "LOW", MEDIUM: "MEDIUM" }, GoogleGenAI: class {
  models = { generateContent: sdk.generate };
  interactions = { create: sdk.interact };
  constructor(options: unknown) { sdk.constructor(options); }
} }));
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
    expect(sdk.generate.mock.calls[0][0]).toMatchObject({ model: GEMINI_MODEL, config: { maxOutputTokens: 2048, responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "LOW" }, httpOptions: { timeout: 300000, retryOptions: { attempts: 1 } } } });
    expect(sdk.generate.mock.calls[0][0].config).not.toHaveProperty("temperature");
    expect(sdk.generate.mock.calls[0][0].contents).not.toContain("Revenue");
    expect(sdk.generate.mock.calls[0][0].config.tools).toBeUndefined();
  });
  it("sets supported low thinking explicitly and records actual usage without model content", async () => {
    sdk.generate.mockResolvedValue({ text: '{}', candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40, thoughtsTokenCount: 20, totalTokenCount: 180 } });
    const usage = vi.fn();
    await createGeminiGenerate("synthetic-key", usage)({ prompt: "test", system: "test", schema: {}, maxOutputTokens: 4096, thinkingLevel: "low", timeoutMs: 90000 });
    expect(sdk.generate.mock.calls[0][0].config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    expect(sdk.generate.mock.calls[0][0].config.temperature).toBe(0);
    expect(sdk.generate.mock.calls[0][0].config.httpOptions).toEqual({ timeout: 90000, retryOptions: { attempts: 1 } });
    expect(usage).toHaveBeenCalledWith({ promptTokens: 120, outputTokens: 60, totalTokens: 180 });
  });
  it("probes Interactions v1 once using fixed structured output and no stored conversation", async () => {
    sdk.interact.mockResolvedValue({ status: "completed", model: GEMINI_MODEL, output_text: '{"status":"ok","service":"incagen"}' });
    await expect(checkGeminiInteractions("synthetic-key")).resolves.toEqual({ status: "ok", model: GEMINI_MODEL });
    expect(sdk.interact).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ api_version: "v1", model: GEMINI_MODEL,
      input: 'Return exactly {"status":"ok","service":"incagen"}.', store: false, automatic_continuation: false,
      response_format: expect.objectContaining({ mime_type: "application/json" }),
    }), { timeout_ms: 300000, retries: { strategy: "none" } });
    expect(sdk.generate).not.toHaveBeenCalled();
  });
  it("requests Priority explicitly and reports the service tier actually used", async () => {
    sdk.interact.mockResolvedValue({ status: "completed", model: GEMINI_MODEL, output_text: '{"status":"ok","service":"incagen"}',
      sdkHttpResponse: { headers: { "x-gemini-service-tier": "standard" } } });
    await expect(checkGeminiInteractions("synthetic-key", "interactions-priority")).resolves.toEqual({ status: "ok", model: GEMINI_MODEL, serviceTier: "standard" });
    expect(sdk.interact).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ service_tier: "priority", store: false }),
      expect.objectContaining({ retries: { strategy: "none" } }));
  });
  it("uses the separate model only for the explicit comparison diagnostic", async () => {
    sdk.interact.mockResolvedValue({ status: "completed", model: "gemini-3.6-flash", output_text: '{"status":"ok","service":"incagen"}' });
    await expect(checkGeminiInteractions("synthetic-key", "interactions-comparison")).resolves.toEqual({ status: "ok", model: "gemini-3.6-flash" });
    const [request] = sdk.interact.mock.calls[0];
    expect(request.model).toBe("gemini-3.6-flash");
    expect(request).not.toHaveProperty("service_tier");
    expect(GEMINI_MODEL).toBe("gemini-3.8-flash");
  });
  it.each([
    { status: "incomplete", output_text: '{"status":"ok","service":"incagen"}' },
    { status: "completed", model: "other", output_text: '{"status":"ok","service":"incagen"}' },
    { status: "completed", output_text: '{"status":"ok","service":"unrelated"}' },
  ])("rejects invalid Interaction responses", async response => {
    sdk.interact.mockResolvedValue(response);
    await expect(checkGeminiInteractions("synthetic-key")).rejects.toThrow("invalid-response");
  });
  it("sanitizes raw provider errors", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    sdk.generate.mockRejectedValue(Object.assign(new Error("https://provider.test?key=private-key document-content"), { status: 429 }));
    await expect(checkGeminiConnection(createGeminiGenerate("synthetic-key"))).rejects.toThrow(/^Gemini: rate-limited$/);
    expect(warning).toHaveBeenCalledWith("gemini-request-failed", { status: 429, reason: "rate-limit" });
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/private-key|document-content/);
    warning.mockRestore();
  });
  it("reports the provider's invalid key reason without exposing its body", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      sdk.generate.mockRejectedValue(Object.assign(new Error('API_KEY_INVALID: private body'), { status: 400 }));
      await expect(checkGeminiConnection(createGeminiGenerate("synthetic-key"))).rejects.toThrow(/^Gemini: credential-rejected$/);
      expect(warning).toHaveBeenCalledExactlyOnceWith("gemini-request-failed", { status: 400, reason: "credential-rejected" });
    } finally { warning.mockRestore(); }
  });
  it("records measured tokens before rejecting incomplete output, ignoring inconsistent measurements", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const usage = vi.fn();
    const generate = createGeminiGenerate("synthetic-key", usage);
    const usageMetadata = { promptTokenCount: 18, candidatesTokenCount: 3, thoughtsTokenCount: 4, totalTokenCount: 25 };
    const response = { text: "{", candidates: [{ finishReason: "MAX_TOKENS" }], usageMetadata };
    try {
      sdk.generate.mockResolvedValueOnce(response).mockResolvedValueOnce({ ...response, usageMetadata: { ...usageMetadata, totalTokenCount: 27 } });
      await expect(checkGeminiConnection(generate)).rejects.toThrow("invalid-response");
      expect(usage).toHaveBeenCalledExactlyOnceWith({ promptTokens: 18, outputTokens: 7, totalTokens: 25 });
      await expect(checkGeminiConnection(generate)).rejects.toThrow("invalid-response");
      expect(usage).toHaveBeenCalledTimes(1);
    } finally { warning.mockRestore(); }
  });
  it.each([[429, "rate-limited"], [503, "busy"], [408, "timeout"], [504, "timeout"], [400, "unavailable"], [401, "credential-rejected"], [403, "credential-rejected"]])("classifies HTTP %s without retrying or exposing provider bodies", async (status, code) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    sdk.generate.mockRejectedValue(Object.assign(new Error("private provider body"), { status }));
    try {
      await expect(checkGeminiConnection(createGeminiGenerate("synthetic-key"))).rejects.toThrow(`Gemini: ${code}`);
      expect(sdk.generate).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warning.mock.calls)).not.toContain("private provider body");
    } finally { warning.mockRestore(); }
  });
  it("recognizes the local deadline without treating arbitrary error messages as provider capacity", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      sdk.generate.mockRejectedValue(new DOMException("deadline", "TimeoutError"));
      await expect(checkGeminiConnection(createGeminiGenerate("synthetic-key"))).rejects.toThrow("Gemini: timeout");
      sdk.generate.mockRejectedValue(new Error("capacity mentioned in untrusted provider text"));
      await expect(checkGeminiConnection(createGeminiGenerate("synthetic-key"))).rejects.toThrow("Gemini: unavailable");
    } finally { warning.mockRestore(); }
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
    expect(() => requireGeminiDeveloper(auth, { prompt: "custom" }, now)).toThrow("serbest istem kabul etmez");
    expect(() => requireGeminiDeveloper(auth, { transport: "other" }, now)).toThrow("serbest istem kabul etmez");
    expect(requireGeminiDeveloper(auth, { transport: "interactions" }, now)).toBe("developer");
    expect(requireGeminiDeveloper(auth, { tableFormat: "csv" }, now)).toBe("developer");
    expect(requireGeminiDeveloper(auth, { tableFormat: "xlsx" }, now)).toBe("developer");
    expect(() => requireGeminiDeveloper(auth, { tableFormat: "pdf" }, now)).toThrow("serbest istem kabul etmez");
    expect(() => requireGeminiDeveloper(auth, { tableFormat: "csv", transport: "interactions" }, now)).toThrow("serbest istem kabul etmez");
    expect(() => requireGeminiDeveloper(auth, { tableFormat: "csv", sourceId: "private" }, now)).toThrow("serbest istem kabul etmez");
    for (const auth_time of [0, "not-a-number", now / 1000 - 301, now / 1000 + 100]) {
      expect(() => requireGeminiDeveloper({ ...auth, token: { incagenDeveloper: true, auth_time } }, {}, now)).toThrow("Yeniden giriş");
    }
  });
});
