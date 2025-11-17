import React, { Component } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

/** ErrorBoundary ป้องกันหน้าเป็นสีขาวเมื่อมี runtime error หลัง React mount */
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ' }
  }
  componentDidCatch(err, info) {
    console.error('[AppErrorBoundary]', err, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white p-6">
          <div className="mx-auto max-w-3xl rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-200">
            <div className="text-xl font-semibold mb-2">เกิดข้อผิดพลาด</div>
            <p className="mb-4">{this.state.message}</p>
            <div className="flex gap-2">
              <button
                className="rounded-xl bg-emerald-600 px-4 py-2 text-white font-semibold hover:bg-emerald-700"
                onClick={() => location.reload()}
              >
                รีโหลดหน้า
              </button>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                onClick={() => (location.hash = '#/home')}
              >
                กลับหน้าหลัก
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/** ใช้ HashRouter เพื่อกัน 404 เวลารีเฟรช/เข้า URL ตรง ๆ */
function Root() {
  return (
    <HashRouter>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </HashRouter>
  )
}

export default Root

const el = document.getElementById('root')
createRoot(el).render(<Root />)

// แจ้ง boot guard ว่า mount สำเร็จแล้ว (ถ้าล้มก่อนหน้านี้ guard จะแสดง fallback ให้แทน)
try { window.__appBoot && window.__appBoot.mounted() } catch {}
