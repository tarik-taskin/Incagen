import { defineConfig } from "vitest/config";

// Backend ayrıştırıcılarını tarayıcı taklitleri olmadan gerçek Node ortamında doğrular.
export default defineConfig({
  test: {
    environment: "node",
    include: ["functions/src/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
