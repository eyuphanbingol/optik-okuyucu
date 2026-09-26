import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: { format: 'iife' },   // klasik iş parçacığı: tüm tarayıcılarda çalışır
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 20000,
  },
})
