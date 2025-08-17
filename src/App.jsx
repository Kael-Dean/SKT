import { Outlet, NavLink, useNavigate } from 'react-router-dom'

function AppLayout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      {/* Topbar */}
      <header className="h-16 border-b border-zinc-800 px-4 flex items-center justify-between sticky top-0 bg-zinc-900/90 backdrop-blur">
        <button
          className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700"
          onClick={() => navigate('/home')}
        >
          เมนู
        </button>
        <div className="font-semibold">สหกรณ์การเกษตร</div>
        <div className="px-3 py-2 rounded-lg bg-zinc-800">คุณไช</div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-zinc-800 hidden md:block">
          <nav className="p-3 space-y-2">
            <Item to="/home" label="หน้าหลัก" />
            <Item to="/documents" label="คลังเอกสาร" />
            <Item to="/order" label="ออเดอร์" />
            <Item to="/sales" label="ยอดขาย" />
            <Item to="/member-signup" label="สมัครสมาชิก" />
            <Item to="/search" label="ค้นหาสมาชิก" />
            <Item to="/add-employee" label="เพิ่มพนักงาน" />
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6">
          <Outlet /> {/* เพจลูกจะมาแสดงตรงนี้ */}
        </main>
      </div>
    </div>
  )
}

function Item({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded-lg ${
          isActive ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-800'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default AppLayout
