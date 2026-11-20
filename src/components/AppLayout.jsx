import { Suspense, createContext, lazy, useContext, useDeferredValue, useEffect, useLayoutEffect, useState } from "react"
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import Toaster from "./ui/Toaster"
import PullToRefresh from "./PullToRefresh"
import PageLoader from "./ui/PageLoader"
import { recordVisit } from "../lib/recentRoutes"
import { loadMyPermissions, useMyPermissionsVersion } from "../lib/myPermissions"
import { HR_HUB_PERMS, can, canAny } from "../lib/permissions"
import { useCurrentPageTitle } from "../lib/pageTitle"
import { ALL_ITEMS } from "../lib/homeFunctions"
import { ONBOARDING_REQUIRED_EVENT } from "../lib/api"
import { getToken } from "../lib/auth"
import { loadOnboarding, useOnboarding } from "../lib/onboarding"
import TourOverlay from "./onboarding/TourOverlay"
import SearchIntroGate from "./onboarding/SearchIntroGate"
import InstallIntroGate from "./onboarding/InstallIntroGate"
import { toast } from "./ui/toast"
import { TOUR_SIDEBAR_EVENT, useTourState } from "../lib/tourState"
import { usePreview } from "../lib/previewMode"

// Super Admin's onboarding previews. The gallery loads this chunk before it starts one.
const OnboardingPreviewHost = lazy(() => import("../pages/admin/OnboardingPreviewHost"))

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
  "/company-add/new": { path: "/company-add", label: "แก้ไขคู่ค้า/บริษัท" },
}

const getInitialDark = () => {
  const stored = localStorage.getItem("darkMode")
  if (stored !== null) return stored === "true"
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false
}

const OFFLINE_TOAST = "app-offline"
const ONLINE_TOAST = "app-online"

// แจ้งเมื่อเน็ตหลุด/กลับมา — คนละ id เพราะการ์ดเดิมจำ duration แรก (ค้างตลอดของ offline จะติดไปกับ toast กลับมาออนไลน์)
function useOnlineToast() {
  useEffect(() => {
    const onOffline = () => {
      toast.dismiss(ONLINE_TOAST)
      toast.warning("ไม่มีอินเทอร์เน็ต", {
        id: OFFLINE_TOAST,
        description: "ข้อมูลที่กรอกยังอยู่ แต่บันทึกไม่ได้จนกว่าเน็ตจะกลับมา ตรวจสอบ Wi-Fi หรือเน็ตมือถือ",
        duration: Infinity,
      })
    }
    const onOnline = () => {
      toast.dismiss(OFFLINE_TOAST)
      toast.success("อินเทอร์เน็ตกลับมาแล้ว", { id: ONLINE_TOAST, description: "ใช้งานต่อได้เลย" })
    }
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    if (navigator.onLine === false) onOffline()
    return () => {
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }, [])
}

// Layout shell. The <body> is the document scroller (plan §A7) — no h-screen /
// overflow-y-auto on <main> — so 100dvh is honest on iOS, Portal's body lock
// works, and `position: sticky` inside pages sticks below the Topbar via
// `top-(--topbar-h)` (Topbar.jsx measures itself into that variable).
const AppLayout = () => {
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(getInitialDark)
  useOnlineToast()
  // หน้าตารางหนักอ่าน SidebarContext — defer เพื่อไม่ให้ re-render บล็อกเฟรมแรกของ drawer slide
  const deferredSidebarOpen = useDeferredValue(isSidebarOpen)
  // สิทธิ์จาก GET /auth/me/permissions — โหลดตอนเปิดแอป/reload; เปลี่ยนเมื่อไหร่ทั้ง layout re-render (เมนู/ปุ่ม)
  useMyPermissionsVersion()
  useEffect(() => {
    loadMyPermissions()
  }, [])

  // First-login onboarding (PR 59) hard lock: nothing under this layout renders for someone who
  // has not finished. The only part of the app they reach is the tour, which sits on the real
  // pages behind its click shield.
  //   wait     = a tour is resuming, or nothing is known about this user yet → loader
  //   redirect = pending and not in a running tour → /onboarding (outside this layout, so no loop)
  // Unknown + server trouble fails open: the store keeps retrying and gates them once it knows,
  // and the backend's own 403 gate stays as the backstop.
  const navigate = useNavigate()
  const onboarding = useOnboarding()
  const tour = useTourState()
  const preview = usePreview()
  const onboardingLoading = onboarding.status === "idle" || onboarding.status === "loading"
  let gateMode = "open"
  if (onboarding.gate === "pending") {
    if (tour.active && onboardingLoading) gateMode = "wait"
    else if (!(tour.active && onboarding.unlocked)) gateMode = "redirect"
  } else if (onboarding.gate === "unknown" && onboardingLoading) {
    gateMode = "wait"
  }
  useEffect(() => {
    loadOnboarding()
  }, [])
  useEffect(() => {
    if (gateMode !== "redirect") return
    // a caller may have just pushed /onboarding?step=… — replacing it would lose the step
    if (window.location.pathname === "/onboarding") return
    navigate("/onboarding", { replace: true })
  }, [gateMode, navigate])
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
  // เช็คเฉพาะตอนความกว้างเปลี่ยน: บน tablet/มือถือแนวนอน แถบ address bar กับคีย์บอร์ดทำให้เกิด resize แค่ความสูง
  useEffect(() => {
    let lastWidth = window.innerWidth
    const onResize = () => {
      const width = window.innerWidth
      if (width === lastWidth) return
      lastWidth = width
      if (width >= 768) setIsSidebarOpen(false)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // จำ route ของโมดูลรวบรวมผลผลิตที่เพิ่งเปิด (Home "ทางลัด") + เริ่มทุกหน้าที่ด้านบน
  useEffect(() => {
    recordVisit(location.pathname)
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Signed out: loadOnboarding() has nothing to fetch, so the gate below would wait forever,
  // and with no API call there is no 401 to send them to login.
  if (!getToken()) return <Navigate to="/" replace />

  if (gateMode !== "open") {
    return (
      <div className="min-h-dvh bg-gray-50 text-gray-900 dark:bg-canvas dark:text-gray-100">
        <PageLoader variant="spinner" fullscreen message="กำลังโหลดข้อมูลของคุณ…" />
      </div>
    )
  }

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

        <main className="min-w-0 flex-1 pl-safe pr-safe pb-safe">
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
      {/* ดึงหน้าจอลงเพื่อรีเฟรช — เฉพาะแอปที่ติดตั้งบนมือถือ */}
      <PullToRefresh />
      {/* Self-service tour (onboarding) — overlays the real pages, mounts only while a tour runs */}
      <TourOverlay />
      {/* One-time intro of the header search — its overlay is a lazy chunk */}
      <SearchIntroGate />
      {/* One-time "the app can now be installed" intro, also a lazy chunk */}
      <InstallIntroGate />
      {preview && (
        <Suspense fallback={null}>
          <OnboardingPreviewHost />
        </Suspense>
      )}
    </div>
  )
}

export default AppLayout
