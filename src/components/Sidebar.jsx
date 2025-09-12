// src/components/Sidebar.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate()
  const location = useLocation()

  // เปิด dropdown อัตโนมัติเมื่ออยู่ใน /Buy หรือ /sales
  const inBusiness = useMemo(
    () => location.pathname.startsWith('/Buy') || location.pathname.startsWith('/sales'),
    [location.pathname]
  )
  const [businessOpen, setBusinessOpen] = useState(inBusiness)
  useEffect(() => setBusinessOpen(inBusiness), [inBusiness])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/')
  }

  /** ---------- CSS ---------- */
  const baseBtn =
    'w-full h-12 flex items-center justify-center rounded-xl transition-all duration-200 ease-out font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 px-4'
  const idleBtn =
    'text-gray-900 hover:bg-blue-100 hover:text-blue-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-white hover:scale-[1.02] hover:shadow-md'
  const activeBtn =
    'bg-black text-white font-semibold dark:bg-white dark:text-black hover:scale-[1.02] hover:shadow-lg hover:opacity-90'
  const subBtnBase =
    'w-full h-11 flex items-center justify-center rounded-lg px-4 transition-all duration-200 ease-out text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
  const subIdle =
    'text-gray-700 hover:bg-blue-100 hover:text-blue-800 dark:text-gray-200 dark:hover:bg-gray-700'
  const subActive =
    'bg-black/90 text-white dark:bg-white/90 dark:text-black font-semibold'

  // แยกเมนู: ตัวแรก (หน้าหลัก) + เมนูที่เหลือ
  const firstMenu = { label: 'หน้าหลัก', path: '/home' }
  const otherMenus = [
    { label: 'คลังเอกสาร', path: '/documents' },
    { label: 'ออเดอร์', path: '/order' },
    { label: 'สมัครสมาชิก', path: '/member-signup' },
    { label: 'ค้นหาสมาชิก', path: '/search' },
    { label: 'คลังสินค้า', path: '/stock' },
  ]

  const isActive = (p) => location.pathname === p

  return (
    <div
      className={`fixed z-40 top-0 left-0 h-full w-64 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-lg`}
    >
      <div className="flex h-full flex-col">
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">🏢 องค์กร</h1>
        </div>

        <nav className="space-y-2 px-3">
          {/* 1) เมนู: หน้าหลัก */}
          <button
            onClick={() => { navigate(firstMenu.path); setIsOpen(false) }}
            aria-current={isActive(firstMenu.path) ? 'page' : undefined}
            className={`${baseBtn} ${isActive(firstMenu.path) ? activeBtn : idleBtn} border-b border-gray-300/40 dark:border-gray-600/30 text-center`}
          >
            {firstMenu.label}
          </button>

          {/* 2) กลุ่ม: ธุรกิจรวบรวมผลผลิต (อยู่ถัดจากหน้าหลัก) */}
          <div className="pt-1">
            <button
              type="button"
              aria-expanded={businessOpen}
              aria-controls="business-submenu"
              onClick={() => setBusinessOpen((v) => !v)}
              className={`${baseBtn} ${inBusiness ? activeBtn : idleBtn} border-b border-gray-300/40 dark:border-gray-600/30`}
            >
              <span className="flex items-center gap-2">
                ธุรกิจรวบรวมผลผลิต
                <span className={`transition-transform ${businessOpen ? 'rotate-180' : ''}`}>▾</span>
              </span>
            </button>

            {/* เมนูย่อย */}
            <div
              id="business-submenu"
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                businessOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="mt-2 space-y-2">
                <button
                  onClick={() => { navigate('/Buy'); setIsOpen(false) }}
                  aria-current={isActive('/Buy') ? 'page' : undefined}
                  className={`${subBtnBase} ${isActive('/Buy') ? subActive : subIdle}`}
                >
                  ซื้อข้าว
                </button>
                <button
                  onClick={() => { navigate('/sales'); setIsOpen(false) }}
                  aria-current={isActive('/sales') ? 'page' : undefined}
                  className={`${subBtnBase} ${isActive('/sales') ? subActive : subIdle}`}
                >
                  ขายข้าว
                </button>
              </div>
            </div>
          </div>

          {/* 3) เมนูที่เหลือ */}
          {otherMenus.map((item) => {
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsOpen(false) }}
                aria-current={active ? 'page' : undefined}
                className={`${baseBtn} ${active ? activeBtn : idleBtn} border-b border-gray-300/40 dark:border-gray-600/30 text-center`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-gray-300/40 dark:border-gray-600/30">
          <button
            onClick={handleLogout}
            className="w-full h-12 flex items-center justify-center rounded-xl font-semibold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 hover:scale-[1.02] hover:shadow-lg shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-all duration-200 ease-out"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
