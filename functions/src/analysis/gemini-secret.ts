import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { GeminiError } from "./gemini";

// Anahtar eklenmeden de backend dağıtılabilir; bulutta değer yalnız Secret Manager'dan okunur.
export async function readGeminiKey(): Promise<string> {
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    if (!process.env.GEMINI_API_KEY?.trim()) throw new GeminiError("not-configured");
    return process.env.GEMINI_API_KEY.trim();
  }
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!project || project.startsWith("demo-")) throw new GeminiError("not-configured");
  const client = new SecretManagerServiceClient();
  try {
    const [version] = await client.accessSecretVersion({ name: `projects/${project}/secrets/GEMINI_API_KEY/versions/latest` }, { timeout: 5000, retry: null });
    const key = version.payload?.data?.toString().trim();
    if (!key) throw new GeminiError("not-configured");
    return key;
  } catch { throw new GeminiError("not-configured"); }
  finally { await client.close(); }
}
