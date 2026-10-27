import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { startupBudget } from './scripts/startup-budget'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), startupBudget()],
  // shadcn bileşenleri `@/` ile src köküne bağlanır; göreli importlar da geçerli kalır.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        // Ağır servis ve grafik bağımlılıklarını önbelleklenebilir ayrı parçalarda tutar.
        manualChunks(id) {
          if (/\/node_modules\/(recharts|victory-vendor|d3-[a-z-]+|@reduxjs|react-redux|immer|reselect|es-toolkit|decimal\.js-light|eventemitter3)\//.test(id)) return 'charts';
          if (id.includes('/@firebase/firestore/')) return 'firestore';
          if (id.includes('/@firebase/auth/')) return 'auth';
          if (/\/@firebase\/(app|component|logger|util)\//.test(id)) return 'firebase-core';
          if (id.includes('/zod/')) return 'validation';
        },
      },
    },
  },
})
