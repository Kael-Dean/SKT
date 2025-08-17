import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import Documents from './pages/Documents'
import Order from './pages/Order'
import AddEmployee from './pages/AddEmployee'
import Login from './pages/Login'
import Sales from './pages/Sales'
import MemberSignup from './pages/MemberSignup'
import MemberSearch from './pages/MemberSearch'

function App() {
  return (
    <Routes>
      {/* กรณีมีคนเปิด /index.html โดยตรง ให้เด้งไปหน้าแรก */}
      <Route path="/index.html" element={<Navigate to="/" replace />} />

      {/* หน้าแรก (หน้า Login) */}
      <Route path="/" element={<Login />} />

      {/* กลุ่มหน้าที่อยู่ภายใต้ Layout (ภายใน AppLayout ต้องมี <Outlet />) */}
      <Route element={<AppLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/order" element={<Order />} />
        <Route path="/add-employee" element={<AddEmployee />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/member-signup" element={<MemberSignup />} />
        <Route path="/search" element={<MemberSearch />} />
      </Route>

      {/* กันพิมพ์พาธมั่ว */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
