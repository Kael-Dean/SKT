import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// ใช้ HashRouter เพื่อให้ทุกเส้นทางทำงานบน GCS/S3 ได้โดยไม่ต้องตั้งค่า redirect
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
