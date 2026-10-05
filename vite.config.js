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
  // dev only: backend CORS ไม่อนุญาต origin localhost → ยิงผ่าน proxy นี้แทน
  // ใช้คู่กับ .env.development.local (VITE_API_BASE_CUSTOM=/api-proxy)
  server: {
    proxy: {
      '/api-proxy': {
        target: 'https://api.amcsurin.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api-proxy/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (req) => req.removeHeader('origin'))
        },
      },
    },
  },
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
