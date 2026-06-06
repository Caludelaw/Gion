import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/admin/',
  server: {
    port: 3121,
    proxy: {
      '/api': 'http://localhost:3120'
    }
  },
  build: {
    outDir: '../server/public/admin',
    emptyOutDir: true
  }
})
