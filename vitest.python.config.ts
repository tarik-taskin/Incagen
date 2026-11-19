import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Python bağımlılıklarının kurulu olduğu adımda Python'dan rapor biçimleyiciye uçtan uca testi çalıştırır.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["scripts/python-to-report.test.ts"],
    globals: false,
    setupFiles: "./src/test/setup.ts",
    testTimeout: 30_000,
  },
});
