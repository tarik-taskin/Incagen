import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// React bileşen testlerini tarayıcı benzeri jsdom ortamında çalıştırır.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
