// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',   // ✅ use relative URLs (works from any path)
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // route chunks ตั้งใจให้แตกหลายไฟล์แล้ว — ยก warning limit กัน noise
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // แยก react/router เป็น vendor chunk เสถียร → แก้โค้ดแอปไม่ทำลาย immutable cache
        // ใช้ function form กัน init-order pitfall + guard เฉพาะ node_modules
        manualChunks(id) {
          if (
            id.includes('node_modules') &&
            /[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)
          ) {
            return 'vendor-react'
          }
        },
      },
    },
  },
})
