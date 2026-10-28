import { defineConfig, devices } from "@playwright/test";

// README ve landing tanıtım görsellerini emülatör ve sentetik veriyle tekrar üretilebilir biçimde yakalar.
// `.shot.ts` dosyaları normal test takımının dışında kalır; `npm run screenshots` ile çalışır.
export default defineConfig({
  testDir: "./e2e/screenshots",
  testMatch: "**/*.shot.ts",
  workers: 1,
  timeout: 180000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4175",
    reducedMotion: "reduce",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: "npm run dev:web -- --host 127.0.0.1 --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
  },
});
