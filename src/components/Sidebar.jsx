import { useNavigate, useLocation } from 'react-router-dom'

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate()
  const location = useLocation()

  // ❌ ไม่ต้องอ่าน user / ไม่ต้องเช็ค isAdmin แล้ว
  // const user = JSON.parse(localStorage.getItem('user'))
  // const isAdmin = user?.role === 'admin'

  const menuItems = [
    { label: 'หน้าหลัก', path: '/home' },
    { label: 'คลังเอกสาร', path: '/documents' },
    { label: 'ออเดอร์', path: '/order' },
    { label: 'ซื้อข้าว', path: '/Buy' },     // (แนะนำ: ใช้ '/buy' ให้ตรง route ถ้าตั้งเป็นตัวเล็ก)
    { label: 'สมัครสมาชิก', path: '/member-signup' },
    { label: 'ค้นหาสมาชิก', path: '/search' },
    { label: 'ขายข้าว', path: '/sales' },         // ✅ ใส่ตรงนี้ให้ทุกคนเห็น
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/')
  }

  const baseBtn =
    'w-full h-12 flex items-center justify-center rounded-xl transition-all duration-200 ease-out font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
  const idleBtn =
    'text-gray-900 hover:bg-blue-100 hover:text-blue-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-white hover:scale-[1.02] hover:shadow-md'
  const activeBtn =
    'bg-black text-white font-semibold dark:bg-white dark:text-black hover:scale-[1.02] hover:shadow-lg hover:opacity-90'

  return (
    <div className={`fixed z-40 top-0 left-0 h-full w-64 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-lg`}>
      <div className="flex h-full flex-col">
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">🏢 องค์กร</h1>
        </div>

        <nav className="space-y-2 px-3">
          {menuItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsOpen(false) }}
                aria-current={active ? 'page' : undefined}
                className={`${baseBtn} ${active ? activeBtn : idleBtn} border-b border-gray-300/40 dark:border-gray-600/30`}
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
