import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/nas-vite/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    watch: {
      usePolling: true
    },
    port: 5173
  },
  optimizeDependencies: true,
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@game': resolve(__dirname, './src/game'),
      '@core': resolve(__dirname, './src/game/core'),
      '@ui': resolve(__dirname, './src/game/ui'),
      '@config': resolve(__dirname, './src/config')
    }
  }
})