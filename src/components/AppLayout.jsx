import { useEffect, useState } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"

const getInitialDark = () => {
  const stored = localStorage.getItem("darkMode")
  if (stored !== null) return stored === "true"
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false
}

const AppLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(getInitialDark)

  const isHome = location.pathname === "/home"

  // ใส่/เอาออก class 'dark' ที่ <html>
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", darkMode)
    localStorage.setItem("darkMode", String(darkMode))
  }, [darkMode])

  // ปิด sidebar อัตโนมัติเมื่อกว้าง >= md (กันค้างสถานะ)
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setIsSidebarOpen(false)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 transition-colors duration-300 dark:bg-gray-950 dark:text-gray-100">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Overlay: ใช้ทั้งมือถือและเดสก์ท็อป */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      {/* Main */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          isSidebarOpen={isSidebarOpen}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="mx-auto max-w-7xl">
            {/* ปุ่มกลับหน้าหลัก — แสดงทุกหน้ายกเว้น /home */}
            {!isHome && (
              <div className="mb-4">
                <button
                  onClick={() => navigate("/home")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-300 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-150"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  หน้าหลัก
                </button>
              </div>
            )}
            {/* สำคัญ: เนื้อหาหน้าย่อยจะแสดงที่นี่ */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
