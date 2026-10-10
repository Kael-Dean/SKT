import { lazy, Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import AppLayout from "./components/AppLayout"          // shell หลัก — เก็บ static (อยู่บน critical path)
import Login from "./pages/work/Login"                  // entry route "/" — เก็บ eager
import { PageLoader } from "./components/ui"            // fallback ระหว่างโหลด chunk
import RequirePermission from "./components/RequirePermission"
import { DOCUMENTS_PERMS, canBringInMill } from "./lib/permissions"

/* -------- หน้าทั้งหมด lazy-load: แต่ละ route แตกเป็น chunk แยก โหลดเมื่อเข้าถึง -------- */
const Home = lazy(() => import("./pages/work/Home"))
const Documents = lazy(() => import("./pages/work/Documents"))
const Order = lazy(() => import("./pages/work/Order"))
const Sales = lazy(() => import("./pages/work/Sales"))
const Buy = lazy(() => import("./pages/work/Buy"))
const MemberSignup = lazy(() => import("./pages/work/MemberSignup"))
const MemberSearch = lazy(() => import("./pages/work/MemberSearch"))
const Stock = lazy(() => import("./pages/work/Stock"))

const CustomerAdd = lazy(() => import("./pages/work/CustomerAdd"))
const CompanyAdd = lazy(() => import("./pages/work/CompanyAdd"))
const CustomerSearch = lazy(() => import("./pages/work/CustomerSearch"))

const StockTransferOut = lazy(() => import("./pages/work/StockTransferOut"))
const StockTransferIn = lazy(() => import("./pages/work/StockTransferIn"))
const StockBringIn = lazy(() => import("./pages/work/StockBringIn"))
const StockTransferMill = lazy(() => import("./pages/work/StockTransferMill"))
const StockDamageOut = lazy(() => import("./pages/work/StockDamageOut"))
const StockBringInMill = lazy(() => import("./pages/work/StockBringInMill"))
const MemberTermination = lazy(() => import("./pages/work/MemberTermination"))
const Share = lazy(() => import("./pages/work/Share"))

const OperationPlan = lazy(() => import("./pages/organization/OperationPlan.jsx"))
const BusinessEdit = lazy(() => import("./pages/organization/BusinessEdit.jsx"))
const DebtHub = lazy(() => import("./pages/organization/debt/DebtHub.jsx"))
const DebtTracking = lazy(() => import("./pages/organization/debt/DebtTracking.jsx"))
const DebtReport = lazy(() => import("./pages/organization/debt-report/DebtReport.jsx"))

const OrderCorrection = lazy(() => import("./pages/work/OrderCorrection.jsx"))
const RiceSpecCreate = lazy(() => import("./pages/work/RiceSpecCreate.jsx"))

/** ✅ Phase 3B — HR */
const HRStaffSignup = lazy(() => import("./pages/hr/HRStaffSignup.jsx"))
const HRUserList = lazy(() => import("./pages/hr/HRUserList.jsx"))
const HRLeaveManagement = lazy(() => import("./pages/hr/HRLeaveManagement.jsx"))
const HRFinance = lazy(() => import("./pages/hr/HRFinance.jsx"))
const HRRelocation = lazy(() => import("./pages/hr/HRRelocation.jsx"))
const HRDashboard = lazy(() => import("./pages/hr/HRDashboard.jsx"))
const HRKpiPage = lazy(() => import("./pages/hr/HRKpiPage.jsx"))
const HRIssueReports = lazy(() => import("./pages/hr/HRIssueReports.jsx"))
const HRPersonnelDetail = lazy(() => import("./pages/hr/HRPersonnelDetail.jsx"))
const HRSalaryTier = lazy(() => import("./pages/hr/HRSalaryTier.jsx"))
const MyProfile = lazy(() => import("./pages/work/MyProfile.jsx"))
const LeaveRequest = lazy(() => import("./pages/work/LeaveRequest.jsx"))
/** งวด 2 — 3O ขอออกนอกสถานที่ */
const OutOfOffice = lazy(() => import("./pages/work/OutOfOffice.jsx"))
const OutOfOfficeApprovals = lazy(() => import("./pages/work/OutOfOfficeApprovals.jsx"))
/** Dev-only index of all HR pages (not registered in production builds) */
const DevHrHub = import.meta.env.DEV ? lazy(() => import("./pages/dev/DevHrHub.jsx")) : null
const Inbox = lazy(() => import("./pages/work/Inbox.jsx"))
const FacilityReport = lazy(() => import("./pages/work/FacilityReport.jsx"))
const ChangePassword = lazy(() => import("./pages/work/ChangePassword.jsx"))
const MyRelocation = lazy(() => import("./pages/work/MyRelocation.jsx"))
const LoanRequest = lazy(() => import("./pages/work/LoanRequest.jsx"))
const ForgotPassword = lazy(() => import("./pages/work/ForgotPassword.jsx"))
const ResetPassword = lazy(() => import("./pages/work/ResetPassword.jsx"))
/** Admin — สิทธิ์ตามบทบาท (read-only) */
const RolePermissions = lazy(() => import("./pages/admin/RolePermissions.jsx"))

/* -------- สิทธิ์: ทุก route guard ใช้ permission key จาก src/lib/permissions.js --------
   (role ids อยู่ที่ src/lib/roles.js เท่านั้น — ห้าม hardcode เลข role ในไฟล์นี้) */
const guard = (perm, el) => <RequirePermission perm={perm}>{el}</RequirePermission>

/* ✅ Route guard: บังคับเปลี่ยนรหัสผ่านถ้า account_status === "new"
   ป้องกัน user ที่ยังไม่เปลี่ยนรหัสผ่านเข้าถึง AppLayout โดยตรง */
function RequirePasswordChanged({ children }) {
  const accountStatus = localStorage.getItem("account_status")
  if (accountStatus === "new") return <Navigate to="/change-password" replace />
  return children
}

function App() {
  return (
    <Suspense fallback={<PageLoader variant="spinner" message="กำลังโหลดหน้า…" />}>
    <Routes>
      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="/" element={<Login />} />
      {DevHrHub && <Route path="/dev/hr" element={<DevHrHub />} />}

      <Route element={<RequirePasswordChanged><AppLayout /></RequirePasswordChanged>}>
        <Route path="/home" element={<Home />} />

        {/* แผนปฏิบัติงานรายปี / ข้อมูลหลัก */}
        <Route path="/operation-plan" element={guard("plan.saleGoals.view", <OperationPlan />)} />
        <Route path="/business-edit" element={guard("plan.master.products", <BusinessEdit />)} />

        <Route path="/documents" element={<RequirePermission anyOf={DOCUMENTS_PERMS}><Documents /></RequirePermission>} />

        {/* ซื้อ-ขาย / สมาชิก / หุ้น / คลัง (Phase 1) */}
        <Route path="/order" element={guard("trading.reports.view", <Order />)} />
        <Route path="/sales" element={guard("trading.sell.create", <Sales />)} />
        <Route path="/Buy" element={guard("trading.buy.create", <Buy />)} />
        <Route path="/member-signup" element={guard("members.create", <MemberSignup />)} />
        <Route path="/search" element={guard("members.search", <MemberSearch />)} />
        <Route path="/stock" element={guard("trading.reports.view", <Stock />)} />

        <Route path="/customer-search" element={guard("members.search", <CustomerSearch />)} />
        <Route path="/customer-add" element={guard("customers.create", <CustomerAdd />)} />
        {/* เพิ่มบริษัท: หน้าเองเช็ค canSeeAddCompany() (กฎเฉพาะผู้ใช้) */}
        <Route path="/company-add" element={guard("customers.create", <CompanyAdd />)} />
        <Route path="/member-termination" element={guard("members.status", <MemberTermination />)} />
        <Route path="/share" element={guard("shares.buy", <Share />)} />

        <Route path="/bring-in" element={guard("stock.carryover.record", <StockBringIn />)} />
        <Route path="/transfer-in" element={guard("stock.transfer.confirm", <StockTransferIn />)} />
        <Route path="/transfer-out" element={guard("stock.transfer.request", <StockTransferOut />)} />
        <Route path="/transfer-mill" element={guard("stock.mill.record", <StockTransferMill />)} />
        <Route path="/damage-out" element={guard("stock.cutloss.record", <StockDamageOut />)} />

        {/* ยกเข้าโรงสี — กฎเฉพาะผู้ใช้ (user id 17/18) คงไว้โดยเจตนา */}
        <Route
          path="/bring-in-mill"
          element={<RequirePermission perm="stock.mill.record" allow={canBringInMill}><StockBringInMill /></RequirePermission>}
        />

        <Route path="/order-correction" element={guard("trading.orders.edit", <OrderCorrection />)} />
        <Route path="/spec/create" element={guard("stock.spec.manage", <RiceSpecCreate />)} />

        {/* ✅ Section 14 — ติดตามหนี้ (hub: ติดตามผลหนี้ + ตารางหนี้) */}
        <Route path="/debt-hub" element={guard("debt.view", <DebtHub />)} />
        <Route path="/debt-tracking" element={guard("debt.view", <DebtTracking />)} />
        <Route path="/debt-form" element={guard("debt.view", <DebtReport />)} />

        {/* ✅ Phase 3B — HR */}
        <Route path="/hr/staff-signup" element={guard("hr.employees.create", <HRStaffSignup />)} />
        <Route path="/hr/users" element={guard("hr.employees.list", <HRUserList />)} />
        <Route path="/hr/leaves" element={guard("hr.leave.list", <HRLeaveManagement />)} />
        <Route path="/hr/finance" element={guard("hr.employees.editFinancial", <HRFinance />)} />
        <Route path="/hr/relocation" element={guard("hr.relocation.list", <HRRelocation />)} />
        <Route path="/hr/dashboard" element={guard("hr.dashboard.view", <HRDashboard />)} />
        <Route path="/hr/kpi" element={guard("hr.kpi.evaluations.view", <HRKpiPage />)} />
        <Route path="/hr/issues" element={guard("hr.issues.list", <HRIssueReports />)} />
        <Route path="/hr/personnel/:id" element={guard("hr.employees.view", <HRPersonnelDetail />)} />
        <Route path="/hr/salary-tier" element={guard("hr.salaryLadder.view", <HRSalaryTier />)} />

        {/* ✅ Personal routes (ทุกคนที่ล็อกอิน) */}
        <Route path="/my-profile" element={guard("self.profile.view", <MyProfile />)} />
        <Route path="/leave-request" element={guard("self.leave.request", <LeaveRequest />)} />
        <Route path="/out-of-office" element={guard("self.ooo.request", <OutOfOffice />)} />
        <Route path="/out-of-office/approvals" element={guard("hr.ooo.list", <OutOfOfficeApprovals />)} />
        {/* กล่องงานรออนุมัติ: เปิดให้ทุกคน — เนื้อหาในหน้ากรองตามสิทธิ์อนุมัติเอง */}
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/my-relocation" element={guard("self.relocation.request", <MyRelocation />)} />
        <Route path="/loan-request" element={guard("self.loan.apply", <LoanRequest />)} />

        {/* รายรับ-รายจ่ายศูนย์เรียนรู้ */}
        <Route path="/facility-report" element={guard("facility.view", <FacilityReport />)} />

        {/* Admin — สิทธิ์ตามบทบาท (read-only) */}
        <Route path="/admin/roles" element={guard("admin.roles.view", <RolePermissions />)} />
      </Route>

      {/* ✅ Phase 3B — ChangePassword อยู่นอก AppLayout */}
      <Route path="/change-password" element={<ChangePassword />} />

      {/* ✅ Forgot / Reset password — อยู่นอก AppLayout */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

export default App
