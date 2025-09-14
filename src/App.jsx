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

        {/* ✅ Routes กลุ่มธุรกิจรวบรวมผลผลิต */}
        <Route path="/bring-in" element={<StockBringIn />} />         {/* 1) ยกมา */}
        <Route path="/transfer-in" element={<StockTransferIn />} />   {/* 4) รับเข้า */}
        <Route path="/transfer-out" element={<StockTransferOut />} /> {/* 5) โอนออก */}
        <Route path="/transfer-mill" element={<StockTransferMill />} /> {/* 6) ส่งสี */}
        <Route path="/damage-out" element={<StockDamageOut />} />     {/* 7) ตัดเสียหาย */}
      </Route>

      {/* กันพิมพ์พาธมั่ว */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
