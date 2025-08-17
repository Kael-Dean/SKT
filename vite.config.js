// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/skt-front/',   // ต้องตรงกับโฟลเดอร์ที่ deploy ขึ้น GCS
  plugins: [
    react(),
    tailwindcss(),       // อย่าลบออก ถ้าโปรเจกต์คุณใช้ Tailwind
  ],
})
