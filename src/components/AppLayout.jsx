import { createContext, useContext, useDeferredValue, useEffect, useState } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import Toaster from "./ui/Toaster"
import { recordVisit } from "../lib/recentRoutes"

export const SidebarContext = createContext(false)
export const useSidebarOpen = () => useContext(SidebarContext)

// หน้าที่ "ซ้อน" อยู่ใต้หน้า hub — ปุ่มย้อนกลับจะพากลับไปหน้า parent
// แทนการเด้งกลับหน้าหลักตรง ๆ. เพิ่ม entry ใหม่ที่นี่เมื่อสร้างฟังก์ชันซ้อน.
const PARENT_ROUTES = {
  "/debt-tracking": { path: "/debt-hub", label: "ติดตามหนี้" },
  "/debt-form": { path: "/debt-hub", label: "ติดตามหนี้" },
  "/out-of-office/approvals": { path: "/out-of-office", label: "ขอออกนอกสถานที่" },
  // หน้า KPI แยกสำหรับ ผจก./ผช.ผจก. (ไม่มีสิทธิ์เข้า /hr/dashboard) — กลับหน้าหลัก
  "/hr/kpi": { path: "/home", label: "หน้าหลัก" },
}

const getInitialDark = () => {
  const stored = localStorage.getItem("darkMode")
  if (stored !== null) return stored === "true"
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false
}

// Layout shell. The <body> is the document scroller (plan §A7) — no h-screen /
// overflow-y-auto on <main> — so 100dvh is honest on iOS, Portal's body lock
// works, and `position: sticky` inside pages sticks below the Topbar via
// `top-(--topbar-h)` (Topbar.jsx measures itself into that variable).
const AppLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(getInitialDark)
  // หน้าตารางหนักอ่าน SidebarContext — defer เพื่อไม่ให้ re-render บล็อกเฟรมแรกของ drawer slide
  const deferredSidebarOpen = useDeferredValue(isSidebarOpen)

  const isHome = location.pathname === "/home"
  const isHrDashboard = location.pathname === "/hr/dashboard"
  const isHrSubPage = location.pathname.startsWith("/hr/") && !isHrDashboard

  // หน้าตารางหนี้ (แยกสาขา / รวมทุกสาขา) กว้างมาก — ปล่อยเต็มความกว้างจอ
  // (ไม่บีบด้วย max-w-7xl) เพื่อให้ดูตารางได้โดยไม่ต้องเลื่อนแนวนอนบ่อย
  const isFullWidth = location.pathname === "/debt-form"
  // HR dashboard มี rail ซ้าย (w-60) + เนื้อหา — ใช้ container กว้างขึ้นเพื่อให้พอดีที่ 1280–1920

  // ปลายทาง + ป้ายของปุ่มย้อนกลับ — ฟังก์ชันซ้อนกลับ parent, HR กลับ dashboard, อื่น ๆ กลับหน้าหลัก
  const parent = PARENT_ROUTES[location.pathname]
  const backTo = parent ? parent.path : isHrSubPage ? "/hr/dashboard" : "/home"
  const backLabel = parent ? parent.label : isHrSubPage ? "งานบุคคล (HR)" : "หน้าหลัก"
  // <md: ปุ่มย้อนกลับย้ายเข้า Topbar (ซ้ายสุด 44px) — ปุ่ม inline ด้านล่างเป็น hidden md:flex
  const back = !isHome ? { to: backTo, label: backLabel } : null

  // ใส่/เอาออก class 'dark' ที่ <html>
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", darkMode)
    localStorage.setItem("darkMode", String(darkMode))
    // Browser chrome (mobile address bar / PWA title bar) follows the in-app
    // theme, not the OS one: canvas #0B0B0F dark, gray-50 light.
    const themeColor = darkMode ? "#0b0b0f" : "#f9fafb"
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", themeColor))
  }, [darkMode])

  // ปิด sidebar อัตโนมัติเมื่อกว้าง >= md (กันค้างสถานะ)
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setIsSidebarOpen(false)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // จำ route ของโมดูลรวบรวมผลผลิตที่เพิ่งเปิด (Home "ทางลัด") + เริ่มทุกหน้าที่ด้านบน
  useEffect(() => {
    recordVisit(location.pathname)
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh bg-gray-50 text-gray-900 transition-colors duration-300 dark:bg-canvas dark:text-gray-100">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} darkMode={darkMode} setDarkMode={setDarkMode} />

      {/* Main */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          isSidebarOpen={isSidebarOpen}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          back={back}
        />

        <main className="min-w-0 flex-1">
          <SidebarContext.Provider value={deferredSidebarOpen}>
          <div
            key={location.pathname}
            className={`animate-fade-up px-4 py-5 md:px-6 md:py-6 ${
              isFullWidth ? "w-full" : isHrDashboard ? "mx-auto max-w-[1600px]" : "mx-auto max-w-7xl"
            }`}
          >
            {back && (
              <div className="mb-6 hidden items-center gap-3 md:flex">
                <button
                  onClick={() => navigate(back.to)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition-all duration-150 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-line-strong dark:bg-white/[.04] dark:text-gray-300 dark:shadow-none dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-200 cursor-pointer"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {back.label}
                </button>
              </div>
            )}
            <Outlet />
          </div>
          </SidebarContext.Provider>
        </main>
      </div>

      {/* Global toast host (toast.success/error/… from components/ui/toast.js) */}
      <Toaster />
    </div>
  )
}

export default AppLayout
