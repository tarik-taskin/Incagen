import { defineConfig, devices } from "@playwright/test";

// Canlı test yalnız açık opt-in ile, ayrı ve sonradan temizlenen sentetik hesaplarla çalışır.
export default defineConfig({
  testDir: "./acceptance", outputDir: "test-results/cloud-acceptance", testMatch: "cloud.spec.ts", workers: 1, retries: 0, timeout: 180_000,
  reporter: [["list"]], expect: { timeout: 30_000 },
  use: { ...devices["Desktop Chrome"], baseURL: process.env.INCAGEN_ACCEPTANCE_URL, actionTimeout: 30_000, reducedMotion: "reduce", trace: "off", screenshot: "off" },
});
