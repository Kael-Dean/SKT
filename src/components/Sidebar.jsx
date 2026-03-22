// src/components/Sidebar.jsx
// Sidebar แสดงฟังก์ชันส่วนตัว (โปรไฟล์, ยื่นใบลา, ฯลฯ)
import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useMemo } from "react"
import { getRoleId, logout as authLogout } from "../lib/auth"

const ROLE = { ADMIN: 1, MNG: 2, HR: 3, HA: 4, MKT: 5 }

// เมนูส่วนตัว — แสดงให้ผู้ใช้ทุกคน (ยกเว้นรายการที่ระบุ role)
const PERSONAL_MENUS = [
  { label: "🏠 หน้าหลัก", path: "/home", roles: "all" },
  { label: "👤 ข้อมูลส่วนตัว", path: "/my-profile", roles: "all" },
  { label: "📋 ยื่นใบลา", path: "/leave-request", roles: "all" },
  // Phase 3B — HR admin only
  { label: "➕ ลงทะเบียนพนักงาน", path: "/hr/staff-signup", roles: [ROLE.ADMIN, ROLE.HR] },
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
    () => PERSONAL_MENUS.filter((item) => canSeeSidebarItem(item, roleId)),
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
          <div className="p-4 pb-3 shrink-0 border-b border-gray-200/70 dark:border-gray-700/70">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm">
                AMC
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">เมนูส่วนตัว</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">สหกรณ์ ธ.ก.ส. สุรินทร์</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 p-3 space-y-1.5">
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

            {/* Divider */}
            <div className="my-2 mx-1 h-px bg-gray-200 dark:bg-gray-700" />

            {/* หน้าหลัก shortcut */}
            <p className="px-4 py-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              การทำงาน
            </p>
            <button
              onClick={() => {
                navigate("/home")
                setIsOpen(false)
              }}
              className={`${baseBtn} ${isActive("/home") ? activeBtn : idleBtn}`}
            >
              🏠 กลับหน้าหลัก
            </button>
          </nav>

          {/* Logout */}
          <div className="mt-auto p-4 shrink-0">
            <button
              onClick={handleLogout}
              className="w-full h-12 flex items-center justify-center rounded-xl font-semibold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 hover:scale-[1.02] hover:shadow-lg hover:cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-all duration-200 ease-out"
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
