// App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import Documents from './pages/Documents'
import Order from './pages/Order'
import Sales from './pages/Sales'
import Login from './pages/Login'
import Buy from './pages/Buy'
import MemberSignup from './pages/MemberSignup'
import MemberSearch from './pages/MemberSearch'
import Stock from './pages/Stock'

// ✅ เพิ่ม import หน้า CustomerAdd / CompanyAdd
import CustomerAdd from './pages/CustomerAdd'
import CompanyAdd from './pages/CompanyAdd'

// ✅ นำเข้าหน้า CustomerSearch (ค้นหาลูกค้าทั่วไป)
import CustomerSearch from './pages/CustomerSearch'

// ✅ กลุ่มธุรกิจรวบรวมผลผลิต
import StockTransferOut from './pages/StockTransferOut'
import StockTransferIn from './pages/StockTransferIn'
import StockBringIn from './pages/StockBringIn'
import StockTransferMill from './pages/StockTransferMill'
import StockDamageOut from './pages/StockDamageOut'

// ✅ นำเข้าเพจใหม่: ยกเข้าโรงสี
import StockBringInMill from './pages/StockBringInMill'

// ✅ นำเข้าหน้า: สมาชิกสิ้นสภาพ
import MemberTermination from './pages/MemberTermination'

// ✅ นำเข้าหน้าใหม่: ซื้อหุ้น
import Share from './pages/Share'

// ✅ นำเข้า “หน้าแก้ไขออเดอร์” ใหม่
import OrderCorrection from './pages/OrderCorrection'  // <<--- หน้าใหม่

/** ---------- Route Guard เฉพาะ user id 17/18 ---------- */
const ALLOWED_USER_IDS = new Set([17, 18])
const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function RequireUserId17or18({ children }) {
  const u = getCurrentUser()
  const uid = Number(u?.id ?? u?.user_id ?? 0)
  if (!ALLOWED_USER_IDS.has(uid)) {
    return <Navigate to="/home" replace />
  }
  return children
}

/** ---------- Route Guard ตามบทบาท: mng / admin / HA เท่านั้น ---------- */
const ROLE = { ADMIN: 1, MNG: 2, HR: 3, HA: 4, MKT: 5 }

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

function getRoleId() {
  const u = getCurrentUser()
  const fromUser = Number(u?.role_id ?? u?.role ?? NaN)
  if (Number.isFinite(fromUser)) return fromUser
  const token = localStorage.getItem('token')
  if (!token) return 0
  const payload = decodeJwtPayload(token) || {}
  const claim = Number(payload.role ?? payload.role_id ?? 0)
  return Number.isFinite(claim) ? claim : 0
}

function RequireMngAdminHA({ children }) {
  const roleId = getRoleId()
  const ok = roleId === ROLE.ADMIN || roleId === ROLE.MNG || roleId === ROLE.HA
  if (!ok) return <Navigate to="/home" replace />
  return children
}

function App() {
  return (
    <Routes>
      {/* ถ้ามีคนเปิด /index.html ตรง ๆ ให้เด้งกลับหน้าแรก */}
      <Route path="/index.html" element={<Navigate to="/" replace />} />

      {/* หน้าแรก (Login) */}
      <Route path="/" element={<Login />} />

      {/* กลุ่มหน้าภายใต้ Layout */}
      <Route element={<AppLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/order" element={<Order />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/Buy" element={<Buy />} />
        <Route path="/member-signup" element={<MemberSignup />} />
        <Route path="/search" element={<MemberSearch />} />
        <Route path="/stock" element={<Stock />} />

        {/* ✅ Route ใหม่: ค้นหาลูกค้าทั่วไป */}
        <Route path="/customer-search" element={<CustomerSearch />} />

        {/* ✅ Route ใหม่: เพิ่มลูกค้า / เพิ่มบริษัท */}
        <Route path="/customer-add" element={<CustomerAdd />} />
        <Route path="/company-add" element={<CompanyAdd />} />

        {/* ✅ Route ใหม่: สมาชิกสิ้นสภาพ (ลาออก/เสียชีวิต) */}
        <Route path="/member-termination" element={<MemberTermination />} />

        {/* ✅ Route ใหม่: ซื้อหุ้น */}
        <Route path="/share" element={<Share />} />

        {/* ✅ Routes กลุ่มธุรกิจรวบรวมผลผลิต */}
        <Route path="/bring-in" element={<StockBringIn />} />
        <Route path="/transfer-in" element={<StockTransferIn />} />
        <Route path="/transfer-out" element={<StockTransferOut />} />
        <Route path="/transfer-mill" element={<StockTransferMill />} />
        <Route path="/damage-out" element={<StockDamageOut />} />

        {/* ✅ ใหม่: ยกเข้าโรงสี — จำกัดเฉพาะ user id 17/18 */}
        <Route
          path="/bring-in-mill"
          element={
            <RequireUserId17or18>
              <StockBringInMill />
            </RequireUserId17or18>
          }
        />

        {/* ✅ ใหม่: แก้ไขออเดอร์ — ให้เห็นเฉพาะ mng / admin / HA */}
        <Route
          path="/order-correction"
          element={
            <RequireMngAdminHA>
              <OrderCorrection />
            </RequireMngAdminHA>
          }
        />
      </Route>

      {/* กันพิมพ์พาธมั่ว */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
