// src/components/Sidebar.jsx
// Sidebar แสดงฟังก์ชันส่วนตัว (โปรไฟล์, ยื่นใบลา, ฯลฯ)
import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useMemo, useRef } from "react"
import {
  ArrowRightLeft,
  ClipboardCheck,
  CreditCard,
  FileBadge,
  FileText,
  HeartHandshake,
  House,
  Inbox,
  Lock,
  LogOut,
  MapPin,
  MapPinCheck,
  PiggyBank,
  ReceiptText,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Target,
  UserRound,
  X,
} from "lucide-react"
import { logout as authLogout, getRoleId } from "../lib/auth"
import { HR_HUB_PERMS, useCan } from "../lib/permissions"
import { TRADING_GROUP, canAccessItem, lucideFor } from "../lib/homeFunctions"
import { useOnboarding } from "../lib/onboarding"
import { goToOnboardingFromLocked } from "../lib/onboardingGate"

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

// บริการตนเอง — รายการชุดเดียวที่ทั้งสองเมนูใช้ร่วมกัน (api-handoff 2026-10-17 §4–5)
// เพิ่ม/ลบที่นี่ที่เดียว เมนูตามตำแหน่งจะได้ไม่ตกหล่นรายการใดรายการหนึ่ง
//   perm      = ต้องมีสิทธิ์นี้
//   unlessAny = ซ่อนถ้ามีสิทธิ์ใดสิทธิ์หนึ่งในนี้ (เช่น KPI: คนที่เข้า Dashboard HR ได้ใช้แท็บ KPI ในนั้นแทน)
//   gated     = ล็อกไว้จนกว่าจะกรอกข้อมูลเริ่มต้นครบ (onboarding PR 59 — backend ตอบ 403 ONBOARDING_REQUIRED)
const SELF_SERVICE_MENUS = [
  { label: "ข้อมูลส่วนตัว",       icon: UserRound,      tone: "sky",     path: "/my-profile",    perm: "self.profile.view" },
  { label: "ข้อมูลการเงินของฉัน",  icon: PiggyBank,      tone: "teal",    path: "/my-financial",  perm: "self.payroll.view", gated: true },
  { label: "สลิปเงินเดือนของฉัน",  icon: ReceiptText,    tone: "emerald", path: "/my-payslips",   perm: "self.payroll.view", gated: true },
  { label: "กล่องงานรออนุมัติ",   icon: Inbox,          tone: "amber",   path: "/inbox" },
  { label: "ยื่นใบลา",            icon: FileText,       tone: "emerald", path: "/leave-request", perm: "self.leave.request", gated: true },
  { label: "ขอออกนอกสถานที่",     icon: MapPin,         tone: "orange",  path: "/out-of-office", perm: "self.ooo.request", gated: true },
  { label: "คำขอย้ายสาขา",        icon: ArrowRightLeft, tone: "violet",  path: "/my-relocation", perm: "self.relocation.request", gated: true },
  { label: "ขอสินเชื่อ",           icon: CreditCard,     tone: "rose",    path: "/loan-request",  perm: "self.loan.apply", gated: true },
  { label: "ขอหนังสือรับรองเงินเดือน", icon: FileBadge,  tone: "teal",    path: "/my-salary-cert", perm: "self.salaryCert.request", gated: true },
  { label: "สวัสดิการของฉัน",      icon: HeartHandshake, tone: "rose",    path: "/my-welfare",    perm: "self.welfare.view", gated: true },
  { label: "ผลการประเมินของฉัน",   icon: ClipboardCheck, tone: "indigo",  path: "/my-kpi",        perm: "self.kpi.result", gated: true },
  { label: "แจ้งเรื่อง / ประวัติการตักเตือน", icon: ShieldAlert, tone: "amber", path: "/my-discipline", anyOf: ["self.discipline.report", "self.discipline.history"], gated: true },
  // KPI v1.4.0 — ผจก. อนุมัติ / ผช.ผจก. ตรวจสอบ (ผู้ที่เข้า Dashboard HR ได้ใช้แท็บ KPI ในนั้น)
  { label: "ประเมิน KPI / เลื่อนขั้น", icon: Target,     tone: "indigo",  path: "/hr/kpi",       perm: "hr.kpi.evaluations.view", unlessAny: HR_HUB_PERMS },
]

// เมนูแบบย่อสำหรับผู้ใช้ที่มีสิทธิ์ nav.hrCompactMenu (ฝ่ายบุคคล) — หน้าหลักของกลุ่มนี้คือ /hr/dashboard
const HR_MENUS = [
  { label: "หน้าหลัก",            icon: House,          tone: "indigo",  path: "/hr/dashboard",  anyOf: HR_HUB_PERMS },
  ...SELF_SERVICE_MENUS,
]

// เมนูปกติ — งานที่มีการ์ดในหน้าหลัก (/home) อยู่แล้วไม่ต้องซ้ำในนี้ (§6): เอา "Dashboard HR" ออก
// เพราะการ์ด "ภาพรวมงานบุคคล" ใน Home ใช้สิทธิ์ชุดเดียวกัน (HR_HUB_PERMS)
const PERSONAL_MENUS = [
  { label: "หน้าหลัก",            icon: House,      tone: "indigo",  path: "/home" },
  ...SELF_SERVICE_MENUS,
  { label: "อนุมัติออกนอกสถานที่", icon: MapPinCheck, tone: "teal",  path: "/out-of-office/approvals", perm: "hr.ooo.list" },
  { label: "สิทธิ์ตามบทบาท",      icon: ShieldCheck, tone: "violet", path: "/admin/roles", perm: "admin.roles.view" },
  // "รายรับ-รายจ่ายสถานที่" ย้ายไปกลุ่ม "รายงาน & แผน" ในหน้า Home แล้ว
]

function canSeeSidebarItem(item, { can, canAny }) {
  if (item.perm && !can(item.perm)) return false
  if (item.anyOf && !canAny(item.anyOf)) return false
  if (item.unless && can(item.unless)) return false
  if (item.unlessAny && canAny(item.unlessAny)) return false
  return true
}

const Sidebar = ({ isOpen, setIsOpen, darkMode = false, setDarkMode }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const perms = useCan()
  const { can } = perms
  const closeBtnRef = useRef(null)
  const { locked: onboardingLocked } = useOnboarding()

  const visibleMenus = useMemo(
    () => (can("nav.hrCompactMenu") ? HR_MENUS : PERSONAL_MENUS).filter((item) => canSeeSidebarItem(item, perms)),
    [can, perms]
  )

  // หมวด "ธุรกิจรวบรวมผลผลิต" — เฉพาะมือถือ (md:hidden) ให้ไปหน้าซื้อ/ขาย/คลังได้โดยไม่ต้องกลับ Home
  const tradingMenus = useMemo(() => {
    const roleId = getRoleId()
    return TRADING_GROUP.items.filter((item) => canAccessItem(item, roleId))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- role comes from localStorage; recompute with permissions
  }, [can])

  // ไม่ล็อก body scroll — scroller จริงคือ <main> ใน AppLayout; lock body ทำให้ layout shift เปล่า ๆ

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
    authLogout()
    ;["userdata", "profile", "account"].forEach((k) => localStorage.removeItem(k))
    navigate("/")
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
        className={`fixed inset-y-2 left-2 z-[9999] w-72 max-w-[calc(100vw-1rem)] overflow-hidden rounded-3xl bg-white will-change-transform transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none dark:bg-surface dark:ring-1 dark:ring-line ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-[calc(100%+1rem)] shadow-none"
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
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">สหกรณ์ ธ.ก.ส. สุรินทร์</p>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              aria-label="ปิดเมนู"
              onClick={() => setIsOpen(false)}
              className="flex size-11 md:size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-gray-100"
            >
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </button>
          </div>

          {/* Nav items */}
          <nav aria-label="เมนูส่วนตัว" data-tour="self-service-menu" className="flex-1 overflow-y-auto px-3 py-3">
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
              <div className="mt-3 border-t border-gray-200/70 pt-3 md:hidden dark:border-line">
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
            {setDarkMode && (
              <button
                type="button"
                role="switch"
                aria-checked={darkMode}
                onClick={() => setDarkMode((v) => !v)}
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
    </>
  )
}

export default Sidebar
