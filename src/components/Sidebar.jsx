// src/components/Sidebar.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate()
  const location = useLocation()

  // เปิด dropdown อัตโนมัติเมื่ออยู่ในเมนูธุรกิจรวบรวมผลผลิต
  const inBusiness = useMemo(
    () =>
      location.pathname.startsWith('/Buy') ||
      location.pathname.startsWith('/sales') ||
      location.pathname.startsWith('/transfer-in') ||
      location.pathname.startsWith('/transfer-out') ||
      location.pathname.startsWith('/bring-in') ||
      location.pathname.startsWith('/transfer-mill') ||
      location.pathname.startsWith('/damage-out'),
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
    'bg-black text-white dark:bg-gray-800 dark:text-white hover:scale-[1.02] hover:shadow-lg hover:opacity-90'
  const subBtnBase =
    'w-full h-11 flex items-center justify-center rounded-lg px-4 transition-all duration-200 ease-out text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
  const subIdle =
    'text-gray-700 hover:bg-blue-100 hover:text-blue-800 dark:text-gray-200 dark:hover:bg-gray-700'
  const subActive =
    'bg-black/90 text-white dark:bg-white/90 dark:text-black font-semibold'

  const cardWrapper = 'px-3 py-1'
  const cardBox =
    'rounded-2xl ring-1 ring-gray-200/90 dark:ring-gray-700/80 bg-white/70 dark:bg-gray-800/60 shadow-sm'

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
      className={`fixed z-40 top-0 left-0 h-full w-72 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-lg`}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">🏢 องค์กร</h1>
        </div>

        {/* NAV */}
        <nav className="flex-1 space-y-1">
          {/* 1) เมนู: หน้าหลัก */}
          <div className={cardWrapper}>
            <div className={cardBox}>
              <button
                onClick={() => { navigate(firstMenu.path); setIsOpen(false) }}
                aria-current={isActive(firstMenu.path) ? 'page' : undefined}
                className={`${baseBtn} ${isActive(firstMenu.path) ? activeBtn : idleBtn} rounded-2xl`}
              >
                {firstMenu.label}
              </button>
            </div>
          </div>

          {/* 2) กลุ่ม: ธุรกิจรวบรวมผลผลิต */}
          <div className={cardWrapper}>
            <div className={cardBox}>
              <button
                type="button"
                aria-expanded={businessOpen}
                aria-controls="business-submenu"
                onClick={() => setBusinessOpen((v) => !v)}
                className={`${baseBtn} ${inBusiness ? activeBtn : idleBtn} rounded-2xl`}
              >
                <span className="flex items-center gap-2">
                  ธุรกิจรวบรวมผลผลิต
                  <span className={`transition-transform ${businessOpen ? 'rotate-180' : ''}`}>▾</span>
                </span>
              </button>

              <div className="px-3">
                <div
                  className={`mx-1 h-px transition-all duration-300 ${
                    businessOpen ? 'bg-gray-200/90 dark:bg-gray-700/70' : 'bg-transparent'
                  }`}
                />
              </div>

              {/* เมนูย่อย (เพิ่มความสูงและเลื่อนภายในได้) */}
              <div
                id="business-submenu"
                className={`transition-[max-height,opacity] duration-300 ease-out ${
                  businessOpen
                    ? 'max-h-[70vh] opacity-100 overflow-y-auto pr-1'
                    : 'max-h-0 opacity-0 overflow-hidden'
                }`}
              >
                <div className="px-3 pb-3 pt-2 space-y-2">
                  {/* 1) ยกมา */}
                  <button
                    onClick={() => { navigate('/bring-in'); setIsOpen(false) }}
                    aria-current={isActive('/bring-in') ? 'page' : undefined}
                    className={`${subBtnBase} ${isActive('/bring-in') ? subActive : subIdle}`}
                  >
                    ยกมา
                  </button>

                  <div className="mx-2 h-px bg-gray-200/80 dark:bg-gray-700/70" />

                  {/* 2) ซื้อข้าว */}
                  <button
                    onClick={() => { navigate('/Buy'); setIsOpen(false) }}
                    aria-current={isActive('/Buy') ? 'page' : undefined}
                    className={`${subBtnBase} ${isActive('/Buy') ? subActive : subIdle}`}
                  >
                    ซื้อข้าว
                  </button>

                  <div className="mx-2 h-px bg-gray-200/80 dark:bg-gray-700/70" />

                  {/* 3) ขายข้าว */}
                  <button
                    onClick={() => { navigate('/sales'); setIsOpen(false) }}
                    aria-current={isActive('/sales') ? 'page' : undefined}
                    className={`${subBtnBase} ${isActive('/sales') ? subActive : subIdle}`}
                  >
                    ขายข้าว
                  </button>

                  <div className="mx-2 h-px bg-gray-200/80 dark:bg-gray-700/70" />

                  {/* 4) รับเข้า */}
                  <button
                    onClick={() => { navigate('/transfer-in'); setIsOpen(false) }}
                    aria-current={isActive('/transfer-in') ? 'page' : undefined}
                    className={`${subBtnBase} ${isActive('/transfer-in') ? subActive : subIdle}`}
                  >
                    รับเข้า
                  </button>

                  <div className="mx-2 h-px bg-gray-200/80 dark:bg-gray-700/70" />

                  {/* 5) โอนออก */}
                  <button
                    onClick={() => { navigate('/transfer-out'); setIsOpen(false) }}
                    aria-current={isActive('/transfer-out') ? 'page' : undefined}
                    className={`${subBtnBase} ${isActive('/transfer-out') ? subActive : subIdle}`}
                  >
                    โอนออก
                  </button>

                  <div className="mx-2 h-px bg-gray-200/80 dark:bg-gray-700/70" />

                  {/* 6) ส่งสี */}
                  <button
                    onClick={() => { navigate('/transfer-mill'); setIsOpen(false) }}
                    aria-current={isActive('/transfer-mill') ? 'page' : undefined}
                    className={`${subBtnBase} ${isActive('/transfer-mill') ? subActive : subIdle}`}
                  >
                    ส่งสี
                  </button>

                  <div className="mx-2 h-px bg-gray-200/80 dark:bg-gray-700/70" />

                  {/* 7) ตัดเสียหาย (ล่างสุด) */}
                  <button
                    onClick={() => { navigate('/damage-out'); setIsOpen(false) }}
                    aria-current={isActive('/damage-out') ? 'page' : undefined}
                    className={`${subBtnBase} ${isActive('/damage-out') ? subActive : subIdle}`}
                  >
                    ตัดเสียหาย
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3) เมนูที่เหลือ */}
          {otherMenus.map((item) => {
            const active = isActive(item.path)
            return (
              <div className={cardWrapper} key={item.path}>
                <div className={cardBox}>
                  <button
                    onClick={() => { navigate(item.path); setIsOpen(false) }}
                    aria-current={active ? 'page' : undefined}
                    className={`${baseBtn} ${active ? activeBtn : idleBtn} rounded-2xl`}
                  >
                    {item.label}
                  </button>
                </div>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto p-4">
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
