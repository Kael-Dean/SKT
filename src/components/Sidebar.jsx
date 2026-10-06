// src/components/Sidebar.jsx
// Sidebar แสดงฟังก์ชันส่วนตัว (โปรไฟล์, ยื่นใบลา, ฯลฯ)
import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useMemo, useRef } from "react"
import {
  ArrowRightLeft,
  CreditCard,
  FileText,
  House,
  Inbox,
  LayoutDashboard,
  LogOut,
  MapPin,
  MapPinCheck,
  UserRound,
  X,
} from "lucide-react"
import { getRoleId, logout as authLogout } from "../lib/auth"

const ROLE = { ADMIN: 1, MNG: 2, HR: 3, HA: 4, MKT: 5, BRANCH: 6 }

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

// เมนูสำหรับ HR role เท่านั้น — 3 รายการ + ออกจากระบบ
const HR_MENUS = [
  { label: "หน้าหลัก",         icon: House,     tone: "indigo", path: "/hr/dashboard" },
  { label: "ข้อมูลส่วนตัว",    icon: UserRound, tone: "sky",    path: "/my-profile" },
  { label: "ขอออกนอกสถานที่", icon: MapPin,    tone: "orange", path: "/out-of-office" },
]

// เมนูส่วนตัว — แสดงให้ผู้ใช้ทุกคน (ยกเว้น HR ที่ใช้ HR_MENUS แทน)
const PERSONAL_MENUS = [
  { label: "หน้าหลัก",            icon: House,      tone: "indigo",  path: "/home",          roles: "all" },
  { label: "ข้อมูลส่วนตัว",       icon: UserRound,  tone: "sky",     path: "/my-profile",    roles: "all" },
  { label: "กล่องงานรออนุมัติ",   icon: Inbox,      tone: "amber",   path: "/inbox",         roles: "all" },
  { label: "ยื่นใบลา",            icon: FileText,   tone: "emerald", path: "/leave-request", roles: "all" },
  { label: "ขอออกนอกสถานที่",     icon: MapPin,     tone: "orange",  path: "/out-of-office", roles: "all" },
  // 3O approvers: 2 ผู้จัดการ, 6 หัวหน้าสาขา, 7 ผู้ช่วยผู้จัดการ (backend role ids)
  { label: "อนุมัติออกนอกสถานที่", icon: MapPinCheck, tone: "teal", path: "/out-of-office/approvals", roles: [ROLE.ADMIN, ROLE.MNG, 6, 7] },
  { label: "คำขอย้ายสาขา",        icon: ArrowRightLeft, tone: "violet", path: "/my-relocation", roles: "all" },
  { label: "ขอสินเชื่อ",           icon: CreditCard, tone: "rose",    path: "/loan-request",  roles: "all" },
  // Phase 3B — HR admin ทุกฟังก์ชันรวมอยู่ใน Dashboard HR แล้ว
  { label: "Dashboard HR",        icon: LayoutDashboard, tone: "blue", path: "/hr/dashboard", roles: [ROLE.ADMIN] },
  // "รายรับ-รายจ่ายสถานที่" ย้ายไปกลุ่ม "รายงาน & แผน" ในหน้า Home แล้ว
]

function canSeeSidebarItem(item, roleId) {
  if (item.roles === "all") return true
  if (Array.isArray(item.roles)) return item.roles.includes(roleId)
  return false
}

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const roleId = useMemo(() => getRoleId(), [])
  const closeBtnRef = useRef(null)

  const visibleMenus = useMemo(
    () => roleId === ROLE.HR
      ? HR_MENUS
      : PERSONAL_MENUS.filter((item) => canSeeSidebarItem(item, roleId)),
    [roleId]
  )

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
        className={`fixed left-0 top-0 z-[9999] h-full w-72 bg-white will-change-transform transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none dark:bg-gray-900 ${
          isOpen ? "translate-x-0 shadow-xl" : "-translate-x-full shadow-none"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-gray-200/70 py-3.5 pl-4 pr-3 dark:border-gray-800">
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
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </button>
          </div>

          {/* Nav items */}
          <nav aria-label="เมนูส่วนตัว" className="flex-1 overflow-y-auto px-3 py-3">
            <ul className="space-y-1">
              {visibleMenus.map((item) => {
                const active = isActive(item.path)
                const tone = TONES[item.tone] ?? TONES.indigo
                const Icon = item.icon
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
                          ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
                          : "font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute -left-3 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-indigo-500 dark:bg-indigo-400"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
                          active ? tone.solid : tone.chip
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
          </nav>

          {/* Logout */}
          <div className="shrink-0 border-t border-gray-200/70 p-3 dark:border-gray-800">
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
