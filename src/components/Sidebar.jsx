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
    ]

    // ✅ เพิ่มเมนู admin เท่านั้น
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
        className={`fixed z-40 top-0 left-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 md:static md:block`}
      >
        <div className="p-4">
          <h1 className="text-xl font-bold mb-6 text-black">🏢 องค์กร</h1>
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setIsOpen(false)
                }}
                className={`block w-full text-left px-4 py-2 rounded text-black 
                  hover:bg-gray-300 ${
                    location.pathname.startsWith(item.path)
                      ? 'bg-black text-white font-bold'
                      : ''
                  }`}
              >
                {item.label}
              </button>
            ))}
            <hr className="my-4" />
            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 rounded text-red-600 hover:bg-red-100"
            >
              ออกจากระบบ
            </button>
          </nav>
        </div>
      </div>
    )
  }

  export default Sidebar
