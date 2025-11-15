import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState, useCallback } from 'react'

const ROLE = { ADMIN: 1, MNG: 2, HR: 3, HA: 4, MKT: 5 }
const ROLE_ALIASES = {
  ADMIN: ROLE.ADMIN, AD: ROLE.ADMIN,
  MNG: ROLE.MNG, MANAGER: ROLE.MNG,
  HR: ROLE.HR, HUMANRESOURCES: ROLE.HR, HUMAN_RESOURCES: ROLE.HR,
  HA: ROLE.HA, ACCOUNT: ROLE.HA, ACCOUNTING: ROLE.HA, 'HEAD ACCOUNTING': ROLE.HA, 'HEAD-ACCOUNTING': ROLE.HA,
  MKT: ROLE.MKT, MARKETING: ROLE.MKT,
}

function normalizeRoleId(raw) {
  if (raw == null) return 0
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const s = String(raw).trim()
  if (!s) return 0
  if (/^\d+$/.test(s)) return Number(s)
  const up = s.toUpperCase()
  if (ROLE_ALIASES[up]) return ROLE_ALIASES[up]
  if (up.includes('ACCOUNT')) return ROLE.HA
  if (up.includes('MARKET')) return ROLE.MKT
  if (up.includes('MANAG')) return ROLE.MNG
  if (up.includes('ADMIN')) return ROLE.ADMIN
  if (up === 'HR' || up.includes('HUMAN')) return ROLE.HR
  return 0
}

function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1] || ''
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
    const json = decodeURIComponent(
      atob(padded).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    )
    return JSON.parse(json)
  } catch { return null }
}

function readRoleId() {
  // 1) from user-like objects
  try {
    const keys = ['user', 'userdata', 'profile', 'account', 'current_user']
    for (const k of keys) {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const u = JSON.parse(raw)
      const cands = [
        u.role_id, u.roleId, u.role, u.role_code, u.roleCode,
        u.role_name, u.roleName, u.position, u.position_code, u.positionCode,
      ]
      for (const c of cands) {
        const id = normalizeRoleId(c)
        if (id) return id
      }
    }
  } catch {}

  // 2) from JWTs
  const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('jwt')
  if (token) {
    const p = decodeJwtPayload(token) || {}
    const claims = [p.role_id, p.roleId, p.role, p.roles, p.authorities, p.scope]
    for (const c of claims) {
      const id = normalizeRoleId(Array.isArray(c) ? c[0] : c)
      if (id) return id
    }
  }

  // 3) loose key
  const loose = normalizeRoleId(localStorage.getItem('role'))
  return loose || 0
}

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const roleId = useMemo(() => readRoleId(), [])

  const firstMenu = { label: 'หน้าหลัก', path: '/home' }

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

  const membersBase = useMemo(() => ([
    { label: '📝 สมัครสมาชิก', path: '/member-signup' },
    { label: '📝 เพิ่มลูกค้าทั่วไป', path: '/customer-add' },
    { label: '📝 เพิ่มบริษัท', path: '/company-add' },
    { label: '🔎 ค้นหาสมาชิก', path: '/search' },
    { label: '🔎 ค้นหาลูกค้าทั่วไป', path: '/customer-search' },
    { label: '🪪 สมาชิกสิ้นสภาพ (ลาออก/เสียชีวิต)', path: '/member-termination' },
    { label: '📈 ซื้อหุ้น', path: '/share' },
  ]), [])

  // ✅ เพิ่ม “แก้ไขออเดอร์” (ให้เฉพาะ mng/admin/HA)
  const otherMenusBase = useMemo(() => ([
    { label: '📝 รายงาน', path: '/documents' },
    { label: '📦 ออเดอร์', path: '/order' },
    { label: '🛠️ แก้ไขออเดอร์', path: '/order-correction' },
    { label: '🏭 คลังสินค้า', path: '/stock' },
  ]), [])

  const ALL_PATHS = useMemo(() => {
    const list = [
      firstMenu.path,
      ...businessBase.map(i => i.path),
      ...membersBase.map(i => i.path),
      ...otherMenusBase.map(i => i.path),
    ]
    return Array.from(new Set(list))
  }, [businessBase, membersBase, otherMenusBase])

  // กำหนดสิทธิ์แสดงเมนู
  const allowedSet = useMemo(() => {
    const allow = new Set(['/home'])

    if (roleId === ROLE.ADMIN || roleId === ROLE.MNG) {
      ALL_PATHS.forEach((p) => allow.add(p))
      return allow
    }

    if (roleId === ROLE.HR) {
      return allow
    }

    if (roleId === ROLE.HA) {
      ['/documents', '/share', '/search', '/customer-search', '/order', '/order-correction']
        .forEach((p) => allow.add(p))
      return allow
    }

    if (roleId === ROLE.MKT) {
      ALL_PATHS.forEach((p) => allow.add(p))
      allow.delete('/documents')
      allow.delete('/order-correction') // ซ่อนจาก MKT
      return allow
    }

    return allow
  }, [roleId, ALL_PATHS])

  const canSee = useCallback((path) => allowedSet.has(path), [allowedSet])

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
    localStorage.removeItem('userdata')
    localStorage.removeItem('profile')
    localStorage.removeItem('account')
    navigate('/')
  }

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

  const isActive = (p) => location.pathname === p

  const businessMenuItems = useMemo(
    () => businessBase.filter((item) => canSee(item.path)),
    [businessBase, canSee]
  )
  const memberMenuItems = useMemo(
    () => membersBase.filter((item) => canSee(item.path)),
    [membersBase, canSee]
  )
  const otherMenus = useMemo(
    () => otherMenusBase.filter((item) => canSee(item.path)),
    [otherMenusBase, canSee]
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
        <div className="p-4 shrink-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">🏢 เมนู</h1>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
          {canSee(firstMenu.path) && (
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
          )}

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
                  <div className={`mx-1 h-px transition-all duration-300 ${businessOpen ? 'bg-gray-200/90 dark:bg-gray-700/70' : 'bg-transparent'}`} />
                </div>

                <div
                  id="business-submenu"
                  className={`transition-[max-height,opacity] duration-300 ease-out ${
                    businessOpen ? 'max-h-[70vh] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
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
                  <div className={`mx-1 h-px transition-all duration-300 ${membersOpen ? 'bg-gray-200/90 dark:bg-gray-700/70' : 'bg-transparent'}`} />
                </div>

                <div
                  id="members-submenu"
                  className={`transition-[max-height,opacity] duration-300 ease-out ${
                    membersOpen ? 'max-h-[70vh] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
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
