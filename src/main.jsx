// src/index.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { installChunkReloadHandler } from './lib/chunkReload'

// deploy ใหม่แล้วแท็บเก่าโหลด chunk ไม่ได้ (vite:preloadError) → reload 1 ครั้ง (กันวนด้วย sessionStorage)
installChunkReloadHandler()

// ลิงก์แบบ HashRouter เดิม (/#/home, bookmark, ลิงก์ในแชท/อีเมล) → แปลงเป็น path ปกติก่อน router อ่าน URL
// ถ้า query อยู่หน้า # (เช่น /?token=x#/reset-password) ให้ติดไปด้วย
function migrateHashUrl() {
  const { hash, search, origin } = window.location
  if (!hash.startsWith('#/')) return false
  const url = new URL(hash.slice(1), origin)
  if (!url.search && search) url.search = search
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  return true
}
migrateHashUrl()
// วางลิงก์ /#/... ในแท็บที่อยู่หน้าเดียวกันอยู่แล้ว = เปลี่ยนแค่ hash ไม่ reload → แปลงแล้วแจ้ง router (ฟัง popstate)
window.addEventListener('hashchange', () => {
  if (migrateHashUrl()) window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
})

// token reset password ที่มาใน query string แต่ไม่ได้อยู่ที่ /reset-password (เช่น /?token=x) → พาไปหน้านั้น
;(function redirectTokenIfNeeded() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (token && window.location.pathname !== '/reset-password') {
    window.history.replaceState(null, '', '/reset-password?token=' + encodeURIComponent(token))
  }
})()

// DEV ONLY: fake onboarding backend (?mockOnboarding=1) — tree-shaken out of production builds
if (import.meta.env.DEV) {
  const { installOnboardingMock } = await import('./dev/onboardingMock.js')
  installOnboardingMock()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
