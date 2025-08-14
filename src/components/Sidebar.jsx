import { useNavigate, useLocation } from 'react-router-dom'

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const user = JSON.parse(localStorage.getItem('user'))
  const isAdmin = user?.role === 'admin'

  const menuItems = [
    { label: 'หน้าหลัก', path: '/home' },
    { label: 'คลังเอกสาร', path: '/documents' },
    { label: 'โปรไฟล์ฉัน', path: '/profile' },
    { label: 'ยอดขาย', path: '/sales' },
    { label: 'สมัครสมาชิก', path: '/member-signup' },
    { label: 'ค้นหาสมาชิก', path: '/search' },
  ]

  if (isAdmin) {
    menuItems.push({ label: 'เพิ่มพนักงานใหม่', path: '/add-employee' })
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/')
  }

  // ปุ่มพื้นฐาน
  const baseBtn =
    'w-full px-4 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'

  // ปุ่มปกติ + โฮเวอร์
  const idleBtn =
    'text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800/70'

  // ปุ่ม ACTIVE เน้นคอนทราสต์ + แถบซ้ายเล็ก ๆ ให้รู้ว่าเลือกอยู่
  const activeBtn =
    'relative bg-black text-white font-semibold dark:bg-white dark:text-black ' +
    "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-black dark:before:bg-white"

  return (
    <div
      className={`fixed z-40 top-0 left-0 h-full w-64 transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      bg-white dark:bg-gray-900 shadow-lg`}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">🏢 องค์กร</h1>
        </div>

        {/* เมนู + เส้นคั่นแบบมินิมอล */}
        <nav className="px-3">
          <ul className="rounded-lg overflow-hidden border border-gray-200/70 dark:border-gray-800/70 divide-y divide-gray-200 dark:divide-gray-800">
            {menuItems.map((item) => {
              const active = location.pathname === item.path
              return (
                <li key={item.path} className="bg-white dark:bg-gray-900">
                  <button
                    onClick={() => {
                      navigate(item.path)
                      setIsOpen(false)
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`${baseBtn} ${active ? activeBtn : idleBtn}`}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* เส้นคั่นโซนล่าง */}
        <div className="mt-4 px-4">
          <hr className="border-gray-200 dark:border-gray-800" />
        </div>

        {/* ปุ่มออกจากระบบให้ชัดขึ้น + ตรึงไว้ล่าง */}
        <div className="mt-auto p-4">
          <button
            onClick={handleLogout}
            className="w-full rounded-lg px-4 py-2.5 text-left font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            ออกจากระบบ
          </button>
          {/* ลิงก์รอง: ออกจากระบบแบบตัวหนังสือ */}
          {/* <button className="mt-2 w-full text-sm text-red-600 hover:underline text-left" onClick={handleLogout}>ออกจากระบบ</button> */}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
