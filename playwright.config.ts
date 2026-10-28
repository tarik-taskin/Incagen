import { defineConfig, devices } from "@playwright/test";

// Uçtan uca kontrolleri gerçek Chromium üzerinde masaüstü ve mobil görünümde çalıştırır.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // CI'da ortak Firebase emülatörlerine aynı anda yük bindirmemek için senaryoları sırayla çalıştırır.
  workers: process.env.CI ? 1 : 2,
  timeout: 60000,
  // Kayıt sonrası 3 sn'lik tasarım gereği geçiş ve dev sunucusunun lazy rotaları ilk kez derlemesi yük altında 5 sn'yi aşabilir.
  expect: { timeout: 10000 },
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Yalnız test sunucusunda kullanılır; Web3Forms istekleri testte yakalanır, gerçek alıcıya gönderilmez.
    env: { VITE_SUPPORT_EMAIL: "support@example.test", VITE_WEB3FORMS_ACCESS_KEY: "00000000-0000-4000-8000-000000000001" },
    command: "npm run dev:web -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
