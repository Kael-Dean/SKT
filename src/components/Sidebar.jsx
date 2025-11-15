// components/Sidebar.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState, useCallback } from 'react'

/**
 * RBAC_SAVE: กำหนดว่าสิทธิ์ "กดบันทึก" ในแต่ละหน้าอนุญาตให้โรลใดบ้าง
 * - hasSave: true  => เพจมีปุ่มบันทึก (ถ้า role ไม่มีสิทธิ์บันทึก ให้ซ่อนจากเมนู)
 * - hasSave: false => เพจไม่มีปุ่มบันทึก (แสดงให้ทุก role ดูได้ตามปกติ)
 * - allowedRoles: ใส่เป็นหมายเลข role_id ที่อนุญาตให้ "กดบันทึก" ในหน้านั้น
 *
 * !! ปรับค่าด้านล่างนี้ให้ตรงกับของจริงในระบบ !!
 *   ตัวอย่างนิยาม role_id:
 *     1=Admin, 2=Manager, 3=Staff, 4=Viewer (แล้วแต่ระบบจริง)
 */
const RBAC_SAVE = {
  // กลุ่ม ธุรกิจรวบรวมผลผลิต
  '/bring-in':       { hasSave: true,  allowedRoles: [1, 2, 3] },
  '/bring-in-mill':  { hasSave: true,  allowedRoles: [1, 2] },   // เดิมเคยล็อกตาม uid -> เปลี่ยนเป็น role
  '/Buy':            { hasSave: true,  allowedRoles: [1, 2, 3] },
  '/sales':          { hasSave: true,  allowedRoles: [1, 2, 3] },
  '/transfer-in':    { hasSave: true,  allowedRoles: [1, 2, 3] },
  '/transfer-out':   { hasSave: true,  allowedRoles: [1, 2] },
  '/transfer-mill':  { hasSave: true,  allowedRoles: [1, 2] },
  '/damage-out':     { hasSave: true,  allowedRoles: [1, 2] },

  // กลุ่ม ทะเบียนสมาชิก
  '/member-signup':        { hasSave: true,  allowedRoles: [1, 2] },
  '/customer-add':         { hasSave: true,  allowedRoles: [1, 2, 3] },
  '/company-add':          { hasSave: true,  allowedRoles: [1, 2] },
  '/search':               { hasSave: false },  // หน้าค้นหา (ไม่มี Save) -> แสดงได้ทุก role
  '/customer-search':      { hasSave: false },  // หน้าค้นหา (ไม่มี Save)
  '/member-termination':   { hasSave: true,  allowedRoles: [1, 2] },
  '/share':                { hasSave: true,  allowedRoles: [1, 2] },

  // เมนูอื่น ๆ (ใส่ตามจริงของระบบคุณ)
  '/documents': { hasSave: false },
  '/order':     { hasSave: true, allowedRoles: [1, 2, 3] },
  '/stock':     { hasSave: false },
}

/** helper: decode JWT payload แบบ safe (Base64URL) เพื่ออ่าน role จาก token ของแบ็กเอนด์ */
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1] || ''
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
    const json = decodeURIComponent(
      atob(padded).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate()
  const location = useLocation()

  // 👉 ดึง user ปัจจุบันจาก localStorage (ยังคงรองรับโครงสร้างเดิม)
  const user = useMemo(() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  // 👉 หา roleId ปัจจุบัน: จาก user.role_id ก่อน ถ้าไม่เจอ ค่อย decode จาก JWT "token" (payload.role)
  const roleId = useMemo(() => {
    const fromUser = Number(user?.role_id ?? user?.role ?? NaN)
    if (!Number.isNaN(fromUser)) return fromUser

    const token = localStorage.getItem('token')
    if (!token) return 0
    const payload = decodeJwtPayload(token) || {}
    const roleClaim = Number(payload.role ?? payload.role_id ?? 0) // แบ็กเอนด์ใส่ role ลง payload แล้ว :contentReference[oaicite:2]{index=2}
    return Number.isFinite(roleClaim) ? roleClaim : 0
  }, [user])

  // เปิด dropdown อัตโนมัติเมื่ออยู่ในเมนูธุรกิจรวบรวมผลผลิต
  const inBusiness = useMemo(
    () =>
      location.pathname.startsWith('/Buy') ||
      location.pathname.startsWith('/sales') ||
      location.pathname.startsWith('/transfer-in') ||
      location.pathname.startsWith('/transfer-out') ||
      location.pathname.startsWith('/bring-in') ||
      location.pathname.startsWith('/bring-in-mill') ||
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
      location.pathname.startsWith('/customer-search') ||
      location.pathname.startsWith('/customer-add') ||
      location.pathname.startsWith('/company-add') ||
      location.pathname.startsWith('/member-termination') ||
      location.pathname.startsWith('/share'),
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
    'w-full h-12 flex items-center justify-center rounded-xl transition-all duration-200 ease-out font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 px-4 hover:cursor-pointer'
  const idleBtn =
    'text-gray-900 hover:bg-blue-100 hover:text-blue-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-white hover:scale-[1.02] hover:shadow-md'
  const activeBtn =
    'bg-black text-white dark:bg-gray-800 dark:text-white hover:scale-[1.02] hover:shadow-lg hover:opacity-90'
  const subBtnBase =
    'w-full h-11 flex items-center justify-center rounded-lg px-4 transition-all duration-200 ease-out text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:cursor-pointer'
  const subIdle =
    'text-gray-700 hover:bg-blue-100 hover:text-blue-800 dark:text-gray-200 dark:hover:bg-gray-700'
  const subActive =
    'bg-black/90 text-white dark:bg-white/90 dark:text-black font-semibold'

  const cardWrapper = 'px-3 py-1'
  const cardBox =
    'rounded-2xl ring-1 ring-gray-200/90 dark:ring-gray-700/80 bg-white/70 dark:bg-gray-800/60 shadow-sm'

  // เมนูหลักหน้าแรก (ไม่บังคับสิทธิ์)
  const firstMenu = { label: 'หน้าหลัก', path: '/home' }

  // เมนูอื่น ๆ (กำหนด hasSave/allowedRoles ที่ RBAC_SAVE ด้านบน)
  const otherMenusBase = [
    { label: '📝 รายงาน', path: '/documents' },
    { label: '📦 ออเดอร์', path: '/order' },
    { label: '🏭 คลังสินค้า', path: '/stock' },
  ]

  const isActive = (p) => location.pathname === p

  /** ฟังก์ชันตัดสินว่า "ควรแสดง" เมนูหรือไม่ ตามกติกา: ไม่มีสิทธิ์บันทึกก็ไม่แสดง */
  const canSeePath = useCallback((path) => {
    const rule = RBAC_SAVE[path]
    // ไม่กำหนด rule ไว้ -> แสดงได้ (safe default)
    if (!rule) return true
    // หน้าที่ไม่มีปุ่มบันทึก -> แสดงได้ทุก role
    if (rule.hasSave === false) return true
    // หน้าที่มีปุ่มบันทึก -> ต้องมี role ใน allowedRoles
    if (!Array.isArray(rule.allowedRoles)) return true
    return rule.allowedRoles.includes(roleId)
  }, [roleId])

  // ✅ เมนูย่อยธุรกิจ
  const businessBase = useMemo(() => ([
    { label: 'ยกมา', path: '/bring-in' },
    { label: 'ยกเข้าโรงสี', path: '/bring-in-mill' },
    { label: 'ซื้อข้าว', path: '/Buy' },
    { label: 'ขายข้าว', path: '/sales' },
    { label: 'รับเข้า', path: '/transfer-in' },
    { label: 'โอนออก', path: '/transfer-out' },
    { label: 'ส่งสี', path: '/transfer-mill' },
    { label: 'ตัดเสียหาย', path: '/damage-out' },
  ]), [])
  const businessMenuItems = useMemo(
    () => businessBase.filter(item => canSeePath(item.path)),
    [businessBase, canSeePath]
  )

  // ✅ เมนูย่อยทะเบียนสมาชิก
  const membersBase = useMemo(() => ([
    { label: '📝 สมัครสมาชิก', path: '/member-signup' },
    { label: '📝 เพิ่มลูกค้าทั่วไป', path: '/customer-add' },
    { label: '📝 เพิ่มบริษัท', path: '/company-add' },
    { label: '🔎 ค้นหาสมาชิก', path: '/search' },
    { label: '🔎 ค้นหาลูกค้าทั่วไป', path: '/customer-search' },
    { label: '🪪 สมาชิกสิ้นสภาพ (ลาออก/เสียชีวิต)', path: '/member-termination' },
    { label: '📈 ซื้อหุ้น', path: '/share' },
  ]), [])
  const memberMenuItems = useMemo(
    () => membersBase.filter(item => canSeePath(item.path)),
    [membersBase, canSeePath]
  )

  const otherMenus = useMemo(
    () => otherMenusBase.filter(item => canSeePath(item.path)),
    [otherMenusBase, canSeePath]
  )

  const showBusinessGroup = businessMenuItems.length > 0
  const showMemberGroup = memberMenuItems.length > 0

  return (
    <div
      className={`fixed z-40 top-0 left-0 h-full w-72 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-lg`}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="p-4 shrink-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">🏢 เมนู</h1>
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
          {showBusinessGroup && (
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
                    🌾 ธุรกิจรวบรวมผลผลิต
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
          )}

          {/* 3) กลุ่ม: ทะเบียนสมาชิก */}
          {showMemberGroup && (
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
                    🪪 ทะเบียนสมาชิก
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

                {/* เมนูย่อยของทะเบียนสมาชิก */}
                <div
                  id="members-submenu"
                  className={`transition-[max-height,opacity] duration-300 ease-out ${
                    membersOpen
                      ? 'max-h-[70vh] opacity-100'
                      : 'max-h-0 opacity-0 overflow-hidden'
                  }`}
                >
                  <div className="px-3 pb-3 pt-2 space-y-2">
                    {memberMenuItems.map((item) => (
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
          )}

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
