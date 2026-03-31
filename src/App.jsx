import { Routes, Route, Navigate } from "react-router-dom"
import AppLayout from "./components/AppLayout"
import Home from "./pages/work/Home"
import Documents from "./pages/work/Documents"
import Order from "./pages/work/Order"
import Sales from "./pages/work/Sales"
import Login from "./pages/work/Login"
import Buy from "./pages/work/Buy"
import MemberSignup from "./pages/work/MemberSignup"
import MemberSearch from "./pages/work/MemberSearch"
import Stock from "./pages/work/Stock"

import CustomerAdd from "./pages/work/CustomerAdd"
import CompanyAdd from "./pages/work/CompanyAdd"
import CustomerSearch from "./pages/work/CustomerSearch"

import StockTransferOut from "./pages/work/StockTransferOut"
import StockTransferIn from "./pages/work/StockTransferIn"
import StockBringIn from "./pages/work/StockBringIn"
import StockTransferMill from "./pages/work/StockTransferMill"
import StockDamageOut from "./pages/work/StockDamageOut"
import StockBringInMill from "./pages/work/StockBringInMill"
import MemberTermination from "./pages/work/MemberTermination"
import Share from "./pages/work/Share"

/** ✅ หน้าใหม่: Operation Plan (Mock) */
// ✅ ไฟล์ OperationPlan.jsx ตอนนี้อยู่ที่ /pages/organization/OperationPlan.jsx
import OperationPlan from "./pages/organization/OperationPlan.jsx"
import BusinessEdit from "./pages/organization/BusinessEdit.jsx"

/** ✅ หน้าใหม่: แก้ไขออเดอร์ */
import OrderCorrection from "./pages/work/OrderCorrection.jsx"

/** ✅ หน้าใหม่: เพิ่มรหัสข้าว (ProductSpec) */
import RiceSpecCreate from "./pages/work/RiceSpecCreate.jsx"

/** ✅ Phase 3B — HR */
import HRStaffSignup from "./pages/hr/HRStaffSignup.jsx"
import HRUserList from "./pages/hr/HRUserList.jsx"
import HRLeaveManagement from "./pages/hr/HRLeaveManagement.jsx"
import HRFinance from "./pages/hr/HRFinance.jsx"
import HRRelocation from "./pages/hr/HRRelocation.jsx"
import HRDashboard from "./pages/hr/HRDashboard.jsx"
import HRIssueReports from "./pages/hr/HRIssueReports.jsx"
import HRPersonnelDetail from "./pages/hr/HRPersonnelDetail.jsx"
import MyProfile from "./pages/work/MyProfile.jsx"
import LeaveRequest from "./pages/work/LeaveRequest.jsx"
import ChangePassword from "./pages/work/ChangePassword.jsx"
import MyRelocation from "./pages/work/MyRelocation.jsx"
import ForgotPassword from "./pages/work/ForgotPassword.jsx"
import ResetPassword from "./pages/work/ResetPassword.jsx"

/* ---------------- role helpers (robust) ---------------- */
const ROLE = { ADMIN: 1, MNG: 2, HR: 3, HA: 4, MKT: 5 }
const ROLE_ALIASES = {
  ADMIN: ROLE.ADMIN,
  AD: ROLE.ADMIN,

  MNG: ROLE.MNG,
  MANAGER: ROLE.MNG,

  HR: ROLE.HR,
  HUMANRESOURCES: ROLE.HR,
  HUMAN_RESOURCES: ROLE.HR,

  HA: ROLE.HA,
  ACCOUNT: ROLE.HA,
  ACCOUNTING: ROLE.HA,
  "HEAD ACCOUNTING": ROLE.HA,
  "HEAD-ACCOUNTING": ROLE.HA,
  HEADACCOUNTING: ROLE.HA,

  MKT: ROLE.MKT,
  MARKETING: ROLE.MKT,
}

const getCurrentUser = () => {
  try {
    const keys = ["user", "userdata", "profile", "account", "current_user"]
    for (const k of keys) {
      const raw = localStorage.getItem(k)
      if (raw) return JSON.parse(raw)
    }
  } catch {}
  return null
}

function normalizeRoleId(raw) {
  if (raw == null) return 0
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const s = String(raw).trim()
  if (!s) return 0
  if (/^\d+$/.test(s)) return Number(s)
  const up = s.toUpperCase()
  if (ROLE_ALIASES[up]) return ROLE_ALIASES[up]
  if (up.includes("ACCOUNT")) return ROLE.HA
  if (up.includes("MARKET")) return ROLE.MKT
  if (up.includes("MANAG")) return ROLE.MNG
  if (up.includes("ADMIN")) return ROLE.ADMIN
  if (up === "HR" || up.includes("HUMAN")) return ROLE.HR
  return 0
}

function decodeJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1] || ""
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

function pickRoleFromUser(u) {
  if (!u || typeof u !== "object") return 0
  const candidates = [
    u.role_id,
    u.roleId,
    u.role,
    u.role_code,
    u.roleCode,
    u.role_name,
    u.roleName,
    u.position,
    u.position_code,
    u.positionCode,
  ]
  for (const c of candidates) {
    const id = normalizeRoleId(c)
    if (id) return id
  }
  return 0
}

function getRoleId() {
  // 1) จาก user object ต่าง ๆ
  const u = getCurrentUser()
  const fromUser = pickRoleFromUser(u)
  if (fromUser) return fromUser

  // 2) จาก JWT
  const token = localStorage.getItem("token") || localStorage.getItem("access_token") || localStorage.getItem("jwt")
  if (token) {
    const p = decodeJwtPayload(token) || {}
    const claims = [p.role_id, p.roleId, p.role, p.roles, p.authorities, p.scope]
    for (const c of claims) {
      const v = Array.isArray(c) ? c[0] : c
      const id = normalizeRoleId(v)
      if (id) return id
    }
  }

  // 3) จาก key ลอย ๆ ใน localStorage
  const loose = normalizeRoleId(localStorage.getItem("role"))
  return loose || 0
}

/* ---------- Route guard: เฉพาะ user id 17/18 (ของเดิม) ---------- */
const ALLOWED_USER_IDS = new Set([17, 18])
function RequireUserId17or18({ children }) {
  const u = getCurrentUser()
  const uid = Number(u?.id ?? u?.user_id ?? 0)
  if (!ALLOWED_USER_IDS.has(uid)) return <Navigate to="/home" replace />
  return children
}

/* ---------- Route guard: เฉพาะ mng / admin / HA / MKT ---------- */
function RequireMngAdminHA({ children }) {
  const r = getRoleId()
  const ok = r === ROLE.ADMIN || r === ROLE.MNG || r === ROLE.HA || r === ROLE.MKT
  if (!ok) return <Navigate to="/home" replace />
  return children
}

/* ✅ Route guard: ห้าม Marketing (MKT) — ใช้กับหน้า "สร้างออเดอร์" */
function RequireNotMarketing({ children }) {
  const r = getRoleId()
  if (r === ROLE.MKT) return <Navigate to="/home" replace />
  return children
}

/* ✅ Route guard: เฉพาะ ADMIN + HA + MKT — ใช้กับหน้า "สร้างรหัสข้าว" */
function RequireAdminHA({ children }) {
  const r = getRoleId()
  const ok = r === ROLE.ADMIN || r === ROLE.HA || r === ROLE.MKT
  if (!ok) return <Navigate to="/home" replace />
  return children
}

/* ✅ Route guard: เฉพาะ ADMIN + HR — ใช้กับหน้า "ลงทะเบียนเจ้าหน้าที่" */
function RequireAdminOrHR({ children }) {
  const r = getRoleId()
  const ok = r === ROLE.ADMIN || r === ROLE.HR
  if (!ok) return <Navigate to="/home" replace />
  return children
}

/* ✅ Route guard: เฉพาะ ADMIN — ใช้กับหน้าจัดการการเงิน / ย้ายสาขา */
function RequireAdmin({ children }) {
  const r = getRoleId()
  if (r !== ROLE.ADMIN) return <Navigate to="/home" replace />
  return children
}

/* ✅ Route guard: บังคับเปลี่ยนรหัสผ่านถ้า account_status === "new"
   ป้องกัน user ที่ยังไม่เปลี่ยนรหัสผ่านเข้าถึง AppLayout โดยตรง */
function RequirePasswordChanged({ children }) {
  const accountStatus = localStorage.getItem("account_status")
  if (accountStatus === "new") return <Navigate to="/change-password" replace />
  return children
}

function App() {
  return (
    <Routes>
      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="/" element={<Login />} />

      <Route element={<RequirePasswordChanged><AppLayout /></RequirePasswordChanged>}>
        <Route path="/home" element={<Home />} />

        {/* ✅ Operation Plan (Mock) */}
        <Route path="/operation-plan" element={<OperationPlan />} />
        <Route path="/business-edit" element={<BusinessEdit />} />

        <Route path="/documents" element={<Documents />} />

        <Route path="/order" element={<Order />} />

        <Route path="/sales" element={<Sales />} />
        <Route path="/Buy" element={<Buy />} />
        <Route path="/member-signup" element={<MemberSignup />} />
        <Route path="/search" element={<MemberSearch />} />
        <Route path="/stock" element={<Stock />} />

        <Route path="/customer-search" element={<CustomerSearch />} />
        <Route path="/customer-add" element={<CustomerAdd />} />
        <Route path="/company-add" element={<CompanyAdd />} />
        <Route path="/member-termination" element={<MemberTermination />} />
        <Route path="/share" element={<Share />} />

        <Route path="/bring-in" element={<StockBringIn />} />
        <Route path="/transfer-in" element={<StockTransferIn />} />
        <Route path="/transfer-out" element={<StockTransferOut />} />
        <Route path="/transfer-mill" element={<StockTransferMill />} />
        <Route path="/damage-out" element={<StockDamageOut />} />

        <Route
          path="/bring-in-mill"
          element={
            <RequireUserId17or18>
              <StockBringInMill />
            </RequireUserId17or18>
          }
        />

        {/* ✅ หน้าแก้ไขออเดอร์ — mng/admin/HA เท่านั้น */}
        <Route
          path="/order-correction"
          element={
            <RequireMngAdminHA>
              <OrderCorrection />
            </RequireMngAdminHA>
          }
        />

        {/* ✅ หน้าเพิ่มรหัสข้าว — admin/HA เท่านั้น */}
        <Route
          path="/spec/create"
          element={
            <RequireAdminHA>
              <RiceSpecCreate />
            </RequireAdminHA>
          }
        />

        {/* ✅ Phase 3B — HR routes */}
        <Route
          path="/hr/staff-signup"
          element={
            <RequireAdminOrHR>
              <HRStaffSignup />
            </RequireAdminOrHR>
          }
        />

        {/* ✅ Phase 3B — HR management routes */}
        <Route
          path="/hr/users"
          element={<RequireAdminOrHR><HRUserList /></RequireAdminOrHR>}
        />
        <Route
          path="/hr/leaves"
          element={<RequireAdminOrHR><HRLeaveManagement /></RequireAdminOrHR>}
        />
        <Route
          path="/hr/finance"
          element={<RequireAdmin><HRFinance /></RequireAdmin>}
        />
        <Route
          path="/hr/relocation"
          element={<RequireAdmin><HRRelocation /></RequireAdmin>}
        />

        {/* ✅ Phase 3B — HR new pages */}
        <Route path="/hr/dashboard" element={<RequireAdminOrHR><HRDashboard /></RequireAdminOrHR>} />
        <Route path="/hr/issues" element={<RequireAdminOrHR><HRIssueReports /></RequireAdminOrHR>} />
        <Route path="/hr/personnel/:id" element={<RequireAdminOrHR><HRPersonnelDetail /></RequireAdminOrHR>} />

        {/* ✅ Phase 3B — Personal routes (ทุก role เข้าถึงได้) */}
        <Route path="/my-profile" element={<MyProfile />} />
        <Route path="/leave-request" element={<LeaveRequest />} />
        <Route path="/my-relocation" element={<MyRelocation />} />
      </Route>

      {/* ✅ Phase 3B — ChangePassword อยู่นอก AppLayout */}
      <Route path="/change-password" element={<ChangePassword />} />

      {/* ✅ Forgot / Reset password — อยู่นอก AppLayout */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
