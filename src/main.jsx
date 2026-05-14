// src/index.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// HashRouter fix: fallback สำหรับ token ที่มาใน query string โดยไม่มี hash
// (กรณีที่ไฟล์ public/reset-password/index.html ไม่ทำงาน)
;(function redirectTokenIfNeeded() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (token && !window.location.hash.includes('reset-password')) {
    window.location.replace(window.location.origin + '/#/reset-password?token=' + encodeURIComponent(token))
  }
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
