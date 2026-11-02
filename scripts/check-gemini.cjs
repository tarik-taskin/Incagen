const { checkGeminiConnection, createGeminiGenerate, GeminiError } = require("../functions/lib/analysis/gemini");

// Anahtar yalnız yerel backend ortamından gelir; komut argümanı, çıktı veya log içine yazılmaz.
async function main() {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.log(JSON.stringify({ status: "not-configured", liveCallMade: false, next: "Fill GEMINI_API_KEY in the ignored functions/.secret.local file." }));
    process.exitCode = 2;
    return;
  }
  try { console.log(JSON.stringify({ ...await checkGeminiConnection(createGeminiGenerate(process.env.GEMINI_API_KEY)), liveCallMade: true })); }
  catch (error) { console.error(JSON.stringify({ status: "failed", reason: error instanceof GeminiError ? error.code : "internal" })); process.exitCode = 1; }
}
void main();
