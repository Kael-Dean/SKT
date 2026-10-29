import { createContext, useContext, useDeferredValue, useEffect, useLayoutEffect, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import Toaster from "./ui/Toaster"
import { recordVisit } from "../lib/recentRoutes"
import { loadMyPermissions, useMyPermissionsVersion } from "../lib/myPermissions"
import { HR_HUB_PERMS, can, canAny } from "../lib/permissions"
import { useCurrentPageTitle } from "../lib/pageTitle"
import { ALL_ITEMS } from "../lib/homeFunctions"
import { ONBOARDING_REQUIRED_EVENT } from "../lib/api"
import { ONBOARDING_PROMPTED_KEY, loadOnboarding, useOnboarding } from "../lib/onboarding"
import TourOverlay from "./onboarding/TourOverlay"
import { useAppUpdateCheck } from "../lib/appUpdate"
import { TOUR_SIDEBAR_EVENT } from "../lib/tourState"

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
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(getInitialDark)
  useAppUpdateCheck()
  // หน้าตารางหนักอ่าน SidebarContext — defer เพื่อไม่ให้ re-render บล็อกเฟรมแรกของ drawer slide
  const deferredSidebarOpen = useDeferredValue(isSidebarOpen)
  // สิทธิ์จาก GET /auth/me/permissions — โหลดตอนเปิดแอป/reload; เปลี่ยนเมื่อไหร่ทั้ง layout re-render (เมนู/ปุ่ม)
  useMyPermissionsVersion()
  useEffect(() => {
    loadMyPermissions()
  }, [])

  // First-login onboarding (PR 59): load status; send the user to /onboarding once per session
  // while it isn't done (job menus stay reachable — "ทำทีหลัง" brings them back here).
  const navigate = useNavigate()
  const onboarding = useOnboarding()
  useEffect(() => {
    loadOnboarding()
  }, [])
  useEffect(() => {
    if (!onboarding.needsOnboarding) return
    let prompted = false
    try {
      prompted = sessionStorage.getItem(ONBOARDING_PROMPTED_KEY) === "1"
      sessionStorage.setItem(ONBOARDING_PROMPTED_KEY, "1")
    } catch {
      // storage disabled — redirect once per mount instead
    }
    if (!prompted) navigate("/onboarding", { replace: true })
  }, [onboarding.needsOnboarding, navigate])
  // Gate 403 from any self-service call → refresh status and go fill the data
  useEffect(() => {
    let last = 0
    const onGate = () => {
      if (Date.now() - last < 3_000) return
      last = Date.now()
      loadOnboarding({ force: true })
      navigate("/onboarding")
    }
    window.addEventListener(ONBOARDING_REQUIRED_EVENT, onGate)
    return () => window.removeEventListener(ONBOARDING_REQUIRED_EVENT, onGate)
  }, [navigate])

  const isHome = location.pathname === "/home"
  const isHrDashboard = location.pathname === "/hr/dashboard"
  const isHrSubPage = location.pathname.startsWith("/hr/") && !isHrDashboard

  // ปลายทาง + ป้ายของปุ่มย้อนกลับ — ฟังก์ชันซ้อนกลับ parent, HR กลับ dashboard, อื่น ๆ กลับหน้าหลัก
  const parent = PARENT_ROUTES[location.pathname]
  // หน้า HR รวมแท็บ — ไม่มีสิทธิ์แท็บไหนเลยกลับหน้าหลักแทน (ไม่ให้ชน "ไม่มีสิทธิ์")
  const hrBack = isHrSubPage && canAny(HR_HUB_PERMS)
  const backTo = parent ? parent.path : hrBack ? "/hr/dashboard" : "/home"
  const backLabel = parent ? parent.label : hrBack ? "งานบุคคล (HR)" : "หน้าหลัก"
  // <md: ปุ่มย้อนกลับย้ายเข้า Topbar (ซ้ายสุด 44px) — ปุ่ม inline ด้านล่างเป็น hidden md:flex
  // HR: /hr/dashboard คือหน้าหลัก — ไม่มีปุ่มย้อนกลับ (กลับ /home ก็เด้งมาที่เดิม)
  const isEffectiveHome = isHome || (isHrDashboard && can("home.hrDashboardOnly") && canAny(HR_HUB_PERMS))
  // มาจาก drill-down (lib/drill.js) → ปุ่มย้อนกลับพากลับไปมุมมองเดิม (history -1) แม้อยู่บนหน้าหลักของ role
  const drillLabel = location.state?.backLabel
  const back = drillLabel
    ? { to: backTo, label: drillLabel, history: true }
    : !isEffectiveHome ? { to: backTo, label: backLabel } : null

  // ชื่อหน้าใน Topbar — หน้าที่ตั้งเอง (<PageTitle> / usePageTitle) ก่อน, ไม่งั้นใช้ชื่อเมนู
  const registeredTitle = useCurrentPageTitle()
  const menuTitle = ALL_ITEMS.find((i) => i.path.toLowerCase() === location.pathname.toLowerCase())?.label
  const pageTitle = isEffectiveHome && !isHrDashboard ? null : registeredTitle ?? menuTitle ?? null

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

  // ทัวร์ onboarding เปิด/ปิด drawer เมนูเองในจุดที่แนะนำเมนูบริการตนเอง
  // useLayoutEffect: ต้องฟังก่อน effect ของ TourOverlay (ลูก) ที่ยิง event ตอน mount
  useLayoutEffect(() => {
    const on = (e) => setIsSidebarOpen(Boolean(e.detail))
    window.addEventListener(TOUR_SIDEBAR_EVENT, on)
    return () => window.removeEventListener(TOUR_SIDEBAR_EVENT, on)
  }, [])

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
          title={pageTitle}
        />

        <main className="min-w-0 flex-1">
          <SidebarContext.Provider value={deferredSidebarOpen}>
          {/* ทุกหน้าใช้ความกว้างเต็มจอ (ไม่บีบด้วย max-w-*) — ตาราง/ฟอร์มหนาแน่นได้พื้นที่เต็มบน PC */}
          <div
            key={location.pathname}
            className="animate-fade-up w-full px-4 py-5 md:px-6 md:py-6"
          >
            <Outlet />
          </div>
          </SidebarContext.Provider>
        </main>
      </div>

      {/* Global toast host (toast.success/error/… from components/ui/toast.js) */}
      <Toaster />
      {/* Self-service tour (onboarding) — overlays the real pages, mounts only while a tour runs */}
      <TourOverlay />
    </div>
  )
}

export default AppLayout
