// src/index.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// HashRouter fix: ถ้า backend ส่งลิงก์แบบ /reset-password?token=xxx (ไม่มี #)
// LINE จะเปิด URL ตรงๆ และ HashRouter จะไม่รู้จัก path นั้น
// → ตรวจ token ใน query string จริงแล้ว redirect ไป /#/reset-password?token=xxx ก่อน React render
;(function redirectTokenIfNeeded() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (token && !window.location.hash.includes('reset-password')) {
    const base = window.location.origin + window.location.pathname.replace(/\/+$/, '')
    window.location.replace(`${base}/#/reset-password?token=${encodeURIComponent(token)}`)
  }
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
