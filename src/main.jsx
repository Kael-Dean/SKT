// src/index.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { installChunkReloadHandler } from './lib/chunkReload'

// deploy ใหม่แล้วแท็บเก่าโหลด chunk ไม่ได้ (vite:preloadError) → reload 1 ครั้ง (กันวนด้วย sessionStorage)
installChunkReloadHandler()

// HashRouter fix: fallback สำหรับ token ที่มาใน query string โดยไม่มี hash
// (กรณีที่ไฟล์ public/reset-password/index.html ไม่ทำงาน)
;(function redirectTokenIfNeeded() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (token && !window.location.hash.includes('reset-password')) {
    window.location.replace(window.location.origin + '/#/reset-password?token=' + encodeURIComponent(token))
  }
})()

// DEV ONLY: fake onboarding backend (?mockOnboarding=1) — tree-shaken out of production builds
if (import.meta.env.DEV) {
  const { installOnboardingMock } = await import('./dev/onboardingMock.js')
  installOnboardingMock()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
