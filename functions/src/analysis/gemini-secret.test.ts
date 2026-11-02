import { afterEach, expect, it, vi } from "vitest";
import { readGeminiKey } from "./gemini-secret";
const secret = vi.hoisted(() => ({ access: vi.fn(), close: vi.fn() }));
vi.mock("@google-cloud/secret-manager", () => ({ SecretManagerServiceClient: class { accessSecretVersion = secret.access; close = secret.close; } }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("never falls through to cloud secrets in the emulator", async () => {
  vi.stubEnv("FUNCTIONS_EMULATOR", "true"); vi.stubEnv("GEMINI_API_KEY", "");
  await expect(readGeminiKey()).rejects.toThrow("not-configured");
  vi.stubEnv("GEMINI_API_KEY", " synthetic-only ");
  expect(await readGeminiKey()).toBe("synthetic-only");
  expect(secret.access).not.toHaveBeenCalled();
});
it("uses fixed project secret via runtime credentials and ignores cloud plain-text env keys", async () => {
  vi.stubEnv("FUNCTIONS_EMULATOR", "false"); vi.stubEnv("GCLOUD_PROJECT", "incagen-test"); vi.stubEnv("GEMINI_API_KEY", "ignored");
  secret.access.mockResolvedValue([{ payload: { data: Buffer.from("synthetic-secret") } }]);
  expect(await readGeminiKey()).toBe("synthetic-secret");
  expect(secret.access).toHaveBeenCalledWith({ name: "projects/incagen-test/secrets/GEMINI_API_KEY/versions/latest" }, { timeout: 5000, retry: null });
  expect(secret.close).toHaveBeenCalledOnce();
});
it("does not reveal secret access or IAM errors", async () => {
  vi.stubEnv("FUNCTIONS_EMULATOR", "false"); vi.stubEnv("GCLOUD_PROJECT", "incagen-test");
  secret.access.mockRejectedValue(new Error("sensitive provider response"));
  await expect(readGeminiKey()).rejects.toThrow(/^Gemini: not-configured$/);
  expect(secret.close).toHaveBeenCalledOnce();
});
