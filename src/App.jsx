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

// ✅ นำเข้าหน้า Stock ที่เพิ่มใหม่
import StockTransferOut from './pages/StockTransferOut'
import StockTransferIn from './pages/StockTransferIn'
import StockBringIn from './pages/StockBringIn'
import StockTransferMill from './pages/StockTransferMill'
import StockDamageOut from './pages/StockDamageOut'

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

        {/* ✅ Route ใหม่: เพิ่มลูกค้า / เพิ่มบริษัท */}
        <Route path="/customer-add" element={<CustomerAdd />} />
        <Route path="/company-add" element={<CompanyAdd />} />

        {/* ✅ Routes กลุ่มธุรกิจรวบรวมผลผลิต */}
        <Route path="/bring-in" element={<StockBringIn />} />
        <Route path="/transfer-in" element={<StockTransferIn />} />
        <Route path="/transfer-out" element={<StockTransferOut />} />
        <Route path="/transfer-mill" element={<StockTransferMill />} />
        <Route path="/damage-out" element={<StockDamageOut />} />
      </Route>

      {/* กันพิมพ์พาธมั่ว */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
