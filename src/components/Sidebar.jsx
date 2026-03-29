// src/components/Sidebar.jsx
// Sidebar แสดงฟังก์ชันส่วนตัว (โปรไฟล์, ยื่นใบลา, ฯลฯ)
import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useMemo } from "react"
import { getRoleId, logout as authLogout } from "../lib/auth"

const ROLE = { ADMIN: 1, MNG: 2, HR: 3, HA: 4, MKT: 5 }

// เมนูสำหรับ HR role เท่านั้น — 3 รายการ + ออกจากระบบ
const HR_MENUS = [
  { label: "🏠 หน้าหลัก",      path: "/hr/dashboard" },
  { label: "👤 ข้อมูลส่วนตัว", path: "/my-profile" },
]

// เมนูส่วนตัว — แสดงให้ผู้ใช้ทุกคน (ยกเว้น HR ที่ใช้ HR_MENUS แทน)
const PERSONAL_MENUS = [
  { label: "🏠 หน้าหลัก",          path: "/home",            roles: "all" },
  { label: "👤 ข้อมูลส่วนตัว",     path: "/my-profile",      roles: "all" },
  { label: "📋 ยื่นใบลา",          path: "/leave-request",   roles: "all" },
  { label: "🚌 คำขอย้ายสาขา",     path: "/my-relocation",   roles: "all" },
  // Phase 3B — HR admin (ADMIN only เพราะ HR ใช้ HR_MENUS แทน)
  { label: "📊 Dashboard HR",       path: "/hr/dashboard",    roles: [ROLE.ADMIN] },
  { label: "➕ ลงทะเบียนพนักงาน", path: "/hr/staff-signup",  roles: [ROLE.ADMIN] },
  { label: "📋 รายชื่อพนักงาน",    path: "/hr/users",         roles: [ROLE.ADMIN] },
  { label: "📅 อนุมัติใบลา",       path: "/hr/leaves",        roles: [ROLE.ADMIN] },
  { label: "🔧 รายงานปัญหา",       path: "/hr/issues",        roles: [ROLE.ADMIN] },
  { label: "💰 ข้อมูลการเงิน",     path: "/hr/finance",       roles: [ROLE.ADMIN] },
  { label: "🏢 อนุมัติย้ายสาขา",  path: "/hr/relocation",    roles: [ROLE.ADMIN] },
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

  const visibleMenus = useMemo(
    () => roleId === ROLE.HR
      ? HR_MENUS
      : PERSONAL_MENUS.filter((item) => canSeeSidebarItem(item, roleId)),
    [roleId]
  )

  // ล็อก scroll เมื่อ sidebar เปิด
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  // ปิดด้วย ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    if (isOpen) window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, setIsOpen])

  const handleLogout = () => {
    authLogout()
    ;["userdata", "profile", "account"].forEach((k) => localStorage.removeItem(k))
    navigate("/")
  }

  const baseBtn =
    "w-full h-12 flex items-center gap-3 rounded-xl transition-all duration-200 ease-out font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 px-4 hover:cursor-pointer text-left"
  const idleBtn =
    "text-gray-900 hover:bg-indigo-50 hover:text-indigo-700 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-white hover:scale-[1.02] hover:shadow-md"
  const activeBtn =
    "bg-indigo-600 text-white dark:bg-indigo-700 dark:text-white hover:scale-[1.02] hover:shadow-lg hover:opacity-90"

  const isActive = (p) => location.pathname === p

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-sm"
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed z-[9999] top-0 left-0 h-full w-72 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } bg-white dark:bg-gray-900 shadow-lg`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="shrink-0 border-b border-gray-200/70 px-4 py-4 dark:border-gray-700/70">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm">
                AMC
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight text-gray-900 dark:text-gray-100">เมนูส่วนตัว</p>
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">สหกรณ์ ธ.ก.ส. สุรินทร์</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto p-3">
            <div className="space-y-0.5">
              {visibleMenus.map((item) => {
                const active = isActive(item.path)
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path)
                      setIsOpen(false)
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`${baseBtn} ${active ? activeBtn : idleBtn}`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

          </nav>

          {/* Logout */}
          <div className="shrink-0 border-t border-gray-200/70 p-4 dark:border-gray-700/70">
            <button
              onClick={handleLogout}
              className="flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-red-500 font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-600 hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar
