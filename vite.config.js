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
})
