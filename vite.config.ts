import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { startupBudget } from './scripts/startup-budget'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), startupBudget()],
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        // Ağır servis ve grafik bağımlılıklarını önbelleklenebilir ayrı parçalarda tutar.
        manualChunks(id) {
          if (id.includes('/echarts/') || id.includes('/zrender/')) return 'charts';
          if (id.includes('/@firebase/firestore/')) return 'firestore';
          if (id.includes('/@firebase/auth/')) return 'auth';
          if (/\/@firebase\/(app|component|logger|util)\//.test(id)) return 'firebase-core';
          if (id.includes('/zod/')) return 'validation';
        },
      },
    },
  },
})
