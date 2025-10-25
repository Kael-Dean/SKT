// components/Sidebar.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate()
  const location = useLocation()

  // 👉 ดึง user ปัจจุบันจาก localStorage
  const user = useMemo(() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])
  const uid = Number(user?.id ?? user?.user_id ?? 0)
  const canSeeBringInMill = uid === 17 || uid === 18

  // เปิด dropdown อัตโนมัติเมื่ออยู่ในเมนูธุรกิจรวบรวมผลผลิต
  const inBusiness = useMemo(
    () =>
      location.pathname.startsWith('/Buy') ||
      location.pathname.startsWith('/sales') ||
      location.pathname.startsWith('/transfer-in') ||
      location.pathname.startsWith('/transfer-out') ||
      location.pathname.startsWith('/bring-in') ||
      location.pathname.startsWith('/bring-in-mill') || // ✅ เส้นทางนี้ยังคงรองรับ
      location.pathname.startsWith('/transfer-mill') ||
      location.pathname.startsWith('/damage-out'),
    [location.pathname]
  )
  const [businessOpen, setBusinessOpen] = useState(inBusiness)
  useEffect(() => setBusinessOpen(inBusiness), [inBusiness])

  // ✅ กลุ่ม: ทะเบียนสมาชิก (auto-open เมื่ออยู่ในเส้นทางที่เกี่ยวข้อง)
  const inMembers = useMemo(
    () =>
      location.pathname.startsWith('/member-signup') ||
      location.pathname.startsWith('/search') ||
      location.pathname.startsWith('/customer-search') || // ✅ เพิ่มเพื่อรองรับเมนูใหม่
      location.pathname.startsWith('/customer-add') ||
      location.pathname.startsWith('/company-add') ||
      location.pathname.startsWith('/member-termination'),
    [location.pathname]
  )
  const [membersOpen, setMembersOpen] = useState(inMembers)
  useEffect(() => setMembersOpen(inMembers), [inMembers])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/')
  }

  /** ---------- CSS ---------- */
  const baseBtn =
    // เพิ่ม hover:cursor-pointer เพื่อให้เมาส์เป็นนิ้วชี้เมื่อชี้ที่ปุ่ม
    'w-full h-12 flex items-center justify-center rounded-xl transition-all duration-200 ease-out font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 px-4 hover:cursor-pointer'
  const idleBtn =
    'text-gray-900 hover:bg-blue-100 hover:text-blue-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-white hover:scale-[1.02] hover:shadow-md'
  const activeBtn =
    'bg-black text-white dark:bg-gray-800 dark:text-white hover:scale-[1.02] hover:shadow-lg hover:opacity-90'
  const subBtnBase =
    // เพิ่ม hover:cursor-pointer ให้กับปุ่มเมนูย่อยทั้งหมด
    'w-full h-11 flex items-center justify-center rounded-lg px-4 transition-all duration-200 ease-out text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:cursor-pointer'
  const subIdle =
    'text-gray-700 hover:bg-blue-100 hover:text-blue-800 dark:text-gray-200 dark:hover:bg-gray-700'
  const subActive =
    'bg-black/90 text-white dark:bg-white/90 dark:text-black font-semibold'

  const cardWrapper = 'px-3 py-1'
  const cardBox =
    'rounded-2xl ring-1 ring-gray-200/90 dark:ring-gray-700/80 bg-white/70 dark:bg-gray-800/60 shadow-sm'

  const firstMenu = { label: 'หน้าหลัก', path: '/home' }

  // ✅ เมนูอื่น ๆ
  const otherMenus = [
    { label: 'คลังเอกสาร', path: '/documents' },
    { label: 'ออเดอร์', path: '/order' },
    { label: 'คลังสินค้า', path: '/stock' },
  ]

  const isActive = (p) => location.pathname === p

  // ✅ เมนูย่อยธุรกิจ (เพิ่ม "ยกเข้าโรงสี" แบบมีเงื่อนไข)
  const businessMenuItems = useMemo(() => {
    return [
      { label: 'ยกมา', path: '/bring-in' },
      ...(canSeeBringInMill ? [{ label: 'ยกเข้าโรงสี', path: '/bring-in-mill' }] : []),
      { label: 'ซื้อข้าว', path: '/Buy' },
      { label: 'ขายข้าว', path: '/sales' },
      { label: 'รับเข้า', path: '/transfer-in' },
      { label: 'โอนออก', path: '/transfer-out' },
      { label: 'ส่งสี', path: '/transfer-mill' },
      { label: 'ตัดเสียหาย', path: '/damage-out' },
    ]
  }, [canSeeBringInMill])

  return (
    <div
      className={`fixed z-40 top-0 left-0 h-full w-72 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-lg`}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="p-4 shrink-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">🏢 องค์กร</h1>
        </div>

        {/* NAV */}
        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
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

              {/* เมนูย่อย */}
              <div
                id="business-submenu"
                className={`transition-[max-height,opacity] duration-300 ease-out ${
                  businessOpen
                    ? 'max-h-[70vh] opacity-100'
                    : 'max-h-0 opacity-0 overflow-hidden'
                }`}
              >
                <div className="px-3 pb-3 pt-2 space-y-2">
                  {businessMenuItems.map((item) => (
                    <div key={item.path}>
                      <button
                        onClick={() => { navigate(item.path); setIsOpen(false) }}
                        aria-current={isActive(item.path) ? 'page' : undefined}
                        className={`${subBtnBase} ${isActive(item.path) ? subActive : subIdle}`}
                      >
                        {item.label}
                      </button>
                      <div className="mx-2 h-px bg-gray-200/80 dark:bg-gray-700/70" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3) กลุ่ม: ทะเบียนสมาชิก */}
          <div className={cardWrapper}>
            <div className={cardBox}>
              <button
                type="button"
                aria-expanded={membersOpen}
                aria-controls="members-submenu"
                onClick={() => setMembersOpen((v) => !v)}
                className={`${baseBtn} ${inMembers ? activeBtn : idleBtn} rounded-2xl`}
              >
                <span className="flex items-center gap-2">
                  ทะเบียนสมาชิก
                  <span className={`transition-transform ${membersOpen ? 'rotate-180' : ''}`}>▾</span>
                </span>
              </button>

              <div className="px-3">
                <div
                  className={`mx-1 h-px transition-all duration-300 ${
                    membersOpen ? 'bg-gray-200/90 dark:bg-gray-700/70' : 'bg-transparent'
                  }`}
                />
              </div>

              {/* เมนูย่อยของทะเบียนสมาชิก (เพิ่มอีโมจิ) */}
              <div
                id="members-submenu"
                className={`transition-[max-height,opacity] duration-300 ease-out ${
                  membersOpen
                    ? 'max-h-[70vh] opacity-100'
                    : 'max-h-0 opacity-0 overflow-hidden'
                }`}
              >
                <div className="px-3 pb-3 pt-2 space-y-2">
                  {[
                    { label: '📝 สมัครสมาชิก', path: '/member-signup' },
                    { label: '🔎 ค้นหาสมาชิก', path: '/search' },
                    { label: '🔎 ค้นหาลูกค้าทั่วไป', path: '/customer-search' }, // ✅ ใหม่: ถัดจาก "ค้นหาสมาชิก"
                    { label: '📝 เพิ่มลูกค้าทั่วไป', path: '/customer-add' },
                    { label: '📝 เพิ่มบริษัท', path: '/company-add' },
                    { label: '🪪 สมาชิกสิ้นสภาพ (ลาออก/เสียชีวิต)', path: '/member-termination' },
                  ].map((item) => (
                    <div key={item.path}>
                      <button
                        onClick={() => { navigate(item.path); setIsOpen(false) }}
                        aria-current={isActive(item.path) ? 'page' : undefined}
                        className={`${subBtnBase} ${isActive(item.path) ? subActive : subIdle}`}
                      >
                        {item.label}
                      </button>
                      <div className="mx-2 h-px bg-gray-200/80 dark:bg-gray-700/70" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4) เมนูที่เหลือ */}
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
  )
}

export default Sidebar
