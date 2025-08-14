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

  return (
    <div
      className={`fixed z-40 top-0 left-0 h-full w-64 transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      bg-white dark:bg-gray-900 shadow-lg`}
    >
      <div className="p-4">
        <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">🏢 องค์กร</h1>
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const active = location.pathname.startsWith(item.path)
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setIsOpen(false)
                }}
                className={`block w-full rounded px-4 py-2 text-left transition
                  text-gray-900 hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-gray-800
                  ${active ? 'bg-black text-white font-bold dark:bg-white dark:text-black' : ''}`}
              >
                {item.label}
              </button>
            )
          })}
          <hr className="my-4 border-gray-200 dark:border-gray-800" />
          <button
            onClick={handleLogout}
            className="block w-full rounded px-4 py-2 text-left text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            ออกจากระบบ
          </button>
        </nav>
      </div>
    </div>
  )
}

export default Sidebar
