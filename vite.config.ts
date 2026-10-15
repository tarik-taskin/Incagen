import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Ağır servis ve grafik bağımlılıklarını önbelleklenebilir ayrı parçalarda tutar.
        manualChunks(id) {
          if (id.includes('/echarts/') || id.includes('/zrender/')) return 'charts';
          if (id.includes('/@firebase/firestore/')) return 'firestore';
          if (id.includes('/@firebase/auth/')) return 'auth';
          if (id.includes('/zod/')) return 'validation';
        },
      },
    },
  },
})
