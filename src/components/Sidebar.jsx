// src/components/Sidebar.jsx
// Sidebar แสดงฟังก์ชันส่วนตัว (โปรไฟล์, ยื่นใบลา, ฯลฯ)
import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import { Download, Lock, LogOut, Moon, Sun, X } from "lucide-react"
import { logoutAndReload, getRoleId } from "../lib/auth"
import { useCan } from "../lib/permissions"
import { TRADING_GROUP, canAccessItem, lucideFor } from "../lib/homeFunctions"
import { HR_MENUS, PERSONAL_MENUS, canSeeSidebarItem } from "../lib/sidebarMenus"
import { useOnboarding } from "../lib/onboarding"
import { goToOnboardingFromLocked } from "../lib/onboardingGate"
import { lockBodyScroll, unlockBodyScroll } from "../lib/scrollLock"
import { useInstallOption } from "../lib/pwa"
import InstallGuideLazy from "./InstallGuideLazy"
import { switchTheme } from "../lib/themeTransition"

// สีของ icon chip — ต้องเขียน class เต็ม (Tailwind v4 ตรวจ class ที่ต่อ string ไม่เจอ)
const TONES = {
  indigo:  { chip: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",   solid: "bg-indigo-500 text-white" },
  sky:     { chip: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",               solid: "bg-sky-500 text-white" },
  amber:   { chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",       solid: "bg-amber-500 text-white" },
  emerald: { chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", solid: "bg-emerald-500 text-white" },
  orange:  { chip: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",   solid: "bg-orange-500 text-white" },
  teal:    { chip: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",           solid: "bg-teal-500 text-white" },
  violet:  { chip: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",   solid: "bg-violet-500 text-white" },
  rose:    { chip: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",           solid: "bg-rose-500 text-white" },
  blue:    { chip: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",           solid: "bg-blue-500 text-white" },
}

const Sidebar = ({ isOpen, setIsOpen, darkMode = false, setDarkMode }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const perms = useCan()
  const { can } = perms
  const closeBtnRef = useRef(null)
  const { locked: onboardingLocked } = useOnboarding()
  const installOption = useInstallOption()
  const [installGuideOpen, setInstallGuideOpen] = useState(false)

  const visibleMenus = useMemo(
    () => (can("nav.hrCompactMenu") ? HR_MENUS : PERSONAL_MENUS).filter((item) => canSeeSidebarItem(item, perms)),
    [can, perms]
  )

  // หมวด "ธุรกิจรวบรวมผลผลิต" — เฉพาะอุปกรณ์สัมผัสและจอเล็ก (md:pointer-fine:hidden) ให้ไปหน้าซื้อ/ขาย/คลังได้โดยไม่ต้องกลับ Home
  const tradingMenus = useMemo(() => {
    const roleId = getRoleId()
    return TRADING_GROUP.items.filter((item) => canAccessItem(item, roleId))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- role comes from localStorage; recompute with permissions
  }, [can])

  // ล็อก body scroll ตอนเปิด — body เป็นตัว scroll ของแอป ถ้าไม่ล็อก wheel ที่เลื่อนเมนูจนสุดจะไหลไปเลื่อนหน้าหลักต่อ
  useEffect(() => {
    if (!isOpen) return
    lockBodyScroll()
    return unlockBodyScroll
  }, [isOpen])

  // ปิดด้วย ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    if (isOpen) window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, setIsOpen])

  // โฟกัสปุ่มปิดเมื่อเปิด (หลังเริ่ม transition — ไม่บล็อกเฟรมแรกของ slide)
  useEffect(() => {
    if (!isOpen) return
    const id = requestAnimationFrame(() => closeBtnRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  const handleLogout = () => {
    // full reload — module cache ของผู้ใช้คนนี้ต้องไม่ตกไปถึงคนถัดไปบนเครื่องเดียวกัน
    logoutAndReload("/")
  }

  const handleInstall = () => {
    // เมนูจะกลายเป็น inert: ย้ายโฟกัสออกก่อน ไม่งั้นปิด sheet แล้วโฟกัสหลุดไป body (Sheet คืนโฟกัสให้ปุ่มที่โฟกัสตอนเปิด)
    document.querySelector("[data-sidebar-toggle]")?.focus({ preventScroll: true })
    setIsOpen(false)
    setInstallGuideOpen(true)
  }

  const isActive = (p) => location.pathname === p

  return (
    <>
      {/* Overlay — mount ตลอด, fade ด้วย opacity (ไม่มี backdrop-blur: แพงบนหน้าตารางหนัก) */}
      <button
        type="button"
        aria-label="ปิดเมนู"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 z-[9990] cursor-default bg-gray-950/50 transition-opacity duration-300 motion-reduce:transition-none ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Sidebar panel */}
      <div
        role={isOpen ? "dialog" : undefined}
        aria-modal={isOpen ? "true" : undefined}
        aria-label="เมนูส่วนตัว"
        aria-hidden={isOpen ? undefined : "true"}
        inert={!isOpen}
        className={`fixed top-[max(0.5rem,env(safe-area-inset-top,0px))] bottom-2 left-[max(0.5rem,env(safe-area-inset-left,0px))] z-[9999] w-72 max-w-[calc(100vw-1rem)] overflow-hidden rounded-3xl bg-white will-change-transform transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none dark:bg-surface dark:ring-1 dark:ring-line ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-[calc(100%+0.5rem+max(0.5rem,env(safe-area-inset-left,0px)))] shadow-none"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-gray-200/70 py-3.5 pl-4 pr-3 dark:border-line">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-bold text-white">
              AMC
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight text-gray-900 dark:text-gray-100">เมนูส่วนตัว</p>
              <p className="line-clamp-2 text-xs leading-snug text-gray-500 dark:text-gray-400">สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส.สุรินทร์ จำกัด</p>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              aria-label="ปิดเมนู"
              onClick={() => setIsOpen(false)}
              className="flex size-11 md:pointer-fine:size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-gray-100"
            >
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </button>
          </div>

          {/* Nav items */}
          <nav aria-label="เมนูส่วนตัว" data-tour="self-service-menu" className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            <ul className="space-y-1">
              {visibleMenus.map((item) => {
                const active = isActive(item.path)
                const tone = TONES[item.tone] ?? TONES.indigo
                const Icon = item.icon
                const isLocked = item.gated && onboardingLocked
                return (
                  <li key={item.path}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false)
                        if (isLocked) goToOnboardingFromLocked(navigate, item.label)
                        else navigate(item.path)
                      }}
                      aria-current={active ? "page" : undefined}
                      aria-disabled={isLocked || undefined}
                      aria-describedby={isLocked ? "sidebar-locked-hint" : undefined}
                      className={`relative flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl pl-2 pr-3 text-left text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                        active
                          ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/[.12] dark:text-indigo-200"
                          : "font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/[.06] dark:hover:text-gray-100"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
                          isLocked ? "bg-gray-100 text-gray-400 dark:bg-white/[.05] dark:text-gray-500" : active ? tone.solid : tone.chip
                        }`}
                      >
                        <Icon strokeWidth={1.75} className="size-[18px]" />
                      </span>
                      <span className={`min-w-0 flex-1 truncate ${isLocked ? "text-gray-500 dark:text-gray-400" : ""}`}>{item.label}</span>
                      {isLocked && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-white/[.06] dark:text-gray-300">
                          <Lock aria-hidden="true" className="size-3" strokeWidth={2.25} />
                          ล็อก
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            {onboardingLocked && visibleMenus.some((i) => i.gated) && (
              <p id="sidebar-locked-hint" className="mt-2 px-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                เมนูที่ล็อกจะเปิดเมื่อกรอกข้อมูลเริ่มต้นครบ
              </p>
            )}

            {tradingMenus.length > 0 && (
              <div className="mt-3 border-t border-gray-200/70 pt-3 md:pointer-fine:hidden dark:border-line">
                <p className="px-2 pb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{TRADING_GROUP.group}</p>
                <ul className="space-y-1">
                  {tradingMenus.map((item) => {
                    const active = isActive(item.path)
                    const Icon = lucideFor(item.path)
                    return (
                      <li key={item.path}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false)
                            navigate(item.path)
                          }}
                          aria-current={active ? "page" : undefined}
                          className={`relative flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl pl-2 pr-3 text-left text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                            active
                              ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/[.12] dark:text-indigo-200"
                              : "font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/[.06] dark:hover:text-gray-100"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
                              active ? TONES.emerald.solid : TONES.emerald.chip
                            }`}
                          >
                            <Icon strokeWidth={1.75} className="size-[18px]" />
                          </span>
                          <span className="min-w-0 truncate">{item.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </nav>

          {/* Dark mode (phone — the Topbar toggle is hidden below md) + Logout */}
          <div className="shrink-0 space-y-2 border-t border-gray-200/70 p-3 pb-safe-3 dark:border-line">
            {installOption && (
              <button
                type="button"
                onClick={handleInstall}
                className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl pl-2 pr-3 text-left text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:text-gray-300 dark:hover:bg-white/[.06] dark:hover:text-gray-100"
              >
                <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONES.indigo.chip}`}>
                  <Download strokeWidth={1.75} className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1 truncate">ติดตั้งแอป</span>
              </button>
            )}
            {setDarkMode && (
              <button
                type="button"
                role="switch"
                aria-checked={darkMode}
                onClick={(e) => switchTheme(setDarkMode, e.currentTarget)}
                className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl pl-2 pr-3 text-left text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:text-gray-300 dark:hover:bg-white/[.06] dark:hover:text-gray-100 md:hidden"
              >
                <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONES.indigo.chip}`}>
                  {darkMode ? <Sun strokeWidth={1.75} className="size-[18px]" /> : <Moon strokeWidth={1.75} className="size-[18px]" />}
                </span>
                <span className="min-w-0 flex-1 truncate">โหมดมืด</span>
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
                    darkMode ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-300 dark:bg-gray-500"
                  }`}
                >
                  <span
                    className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      darkMode ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-50 text-sm font-semibold text-red-600 transition-colors duration-150 hover:bg-red-100 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 dark:hover:text-red-300"
            >
              <LogOut aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>

      <InstallGuideLazy open={installGuideOpen} onClose={() => setInstallGuideOpen(false)} />
    </>
  )
}

export default Sidebar
