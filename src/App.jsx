import { Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import AppLayout from "./components/AppLayout"          // shell หลัก — เก็บ static (อยู่บน critical path)
import Login from "./pages/work/Login"                  // entry route "/" — เก็บ eager
import { PageLoader } from "./components/ui"            // fallback ระหว่างโหลด chunk
import RequirePermission from "./components/RequirePermission"
import { DOCUMENTS_PERMS, HR_HUB_PERMS, canBringInMill } from "./lib/permissions"
import { lazyWithReload } from "./lib/chunkReload"      // chunk หายหลัง deploy → reload 1 ครั้ง แทนหน้าขาว

/* -------- หน้าทั้งหมด lazy-load: แต่ละ route แตกเป็น chunk แยก โหลดเมื่อเข้าถึง -------- */
const Home = lazyWithReload(() => import("./pages/work/Home"))
const Documents = lazyWithReload(() => import("./pages/work/Documents"))
const Order = lazyWithReload(() => import("./pages/work/Order"))
const Sales = lazyWithReload(() => import("./pages/work/Sales"))
const Buy = lazyWithReload(() => import("./pages/work/Buy"))
const MemberSignup = lazyWithReload(() => import("./pages/work/MemberSignup"))
const MemberSearch = lazyWithReload(() => import("./pages/work/MemberSearch"))
const Stock = lazyWithReload(() => import("./pages/work/Stock"))

const CustomerAdd = lazyWithReload(() => import("./pages/work/CustomerAdd"))
const CompanyAdd = lazyWithReload(() => import("./pages/work/CompanyAdd"))
const CustomerSearch = lazyWithReload(() => import("./pages/work/CustomerSearch"))

const StockTransferOut = lazyWithReload(() => import("./pages/work/StockTransferOut"))
const StockTransferIn = lazyWithReload(() => import("./pages/work/StockTransferIn"))
const StockBringIn = lazyWithReload(() => import("./pages/work/StockBringIn"))
const StockTransferMill = lazyWithReload(() => import("./pages/work/StockTransferMill"))
const StockDamageOut = lazyWithReload(() => import("./pages/work/StockDamageOut"))
const StockBringInMill = lazyWithReload(() => import("./pages/work/StockBringInMill"))
const MemberTermination = lazyWithReload(() => import("./pages/work/MemberTermination"))
const Share = lazyWithReload(() => import("./pages/work/Share"))

const OperationPlan = lazyWithReload(() => import("./pages/organization/OperationPlan.jsx"))
const BusinessEdit = lazyWithReload(() => import("./pages/organization/BusinessEdit.jsx"))
const DebtHub = lazyWithReload(() => import("./pages/organization/debt/DebtHub.jsx"))
const DebtTracking = lazyWithReload(() => import("./pages/organization/debt/DebtTracking.jsx"))
const DebtReport = lazyWithReload(() => import("./pages/organization/debt-report/DebtReport.jsx"))

const OrderCorrection = lazyWithReload(() => import("./pages/work/OrderCorrection.jsx"))
const RiceSpecCreate = lazyWithReload(() => import("./pages/work/RiceSpecCreate.jsx"))

/** ✅ Phase 3B — HR */
const HRStaffSignup = lazyWithReload(() => import("./pages/hr/HRStaffSignup.jsx"))
const HRUserList = lazyWithReload(() => import("./pages/hr/HRUserList.jsx"))
const HRLeaveManagement = lazyWithReload(() => import("./pages/hr/HRLeaveManagement.jsx"))
const HRFinance = lazyWithReload(() => import("./pages/hr/HRFinance.jsx"))
const HRRelocation = lazyWithReload(() => import("./pages/hr/HRRelocation.jsx"))
const HRDashboard = lazyWithReload(() => import("./pages/hr/HRDashboard.jsx"))
const HRKpiPage = lazyWithReload(() => import("./pages/hr/HRKpiPage.jsx"))
const HRIssueReports = lazyWithReload(() => import("./pages/hr/HRIssueReports.jsx"))
const HRPersonnelDetail = lazyWithReload(() => import("./pages/hr/HRPersonnelDetail.jsx"))
const HRSalaryTier = lazyWithReload(() => import("./pages/hr/HRSalaryTier.jsx"))
/** WP0 scaffold — 3P สวัสดิการ · 3Q วินัย · 3H ปฏิทินการลา (หน้าแยก = แท็บเดียวกับใน /hr/dashboard) */
const HRWelfare = lazyWithReload(() => import("./pages/hr/HRWelfare.jsx"))
const HRDiscipline = lazyWithReload(() => import("./pages/hr/HRDiscipline.jsx"))
const HRLeaveCalendar = lazyWithReload(() => import("./pages/hr/HRLeaveCalendar.jsx"))
/** WP0 scaffold — self-service: 3P · 3Q · 3L · 3M (13G) */
const MyWelfare = lazyWithReload(() => import("./pages/work/MyWelfare.jsx"))
const MyDiscipline = lazyWithReload(() => import("./pages/work/MyDiscipline.jsx"))
const MyKpi = lazyWithReload(() => import("./pages/work/MyKpi.jsx"))
const MySalaryCert = lazyWithReload(() => import("./pages/work/MySalaryCert.jsx"))
const MyProfile = lazyWithReload(() => import("./pages/work/MyProfile.jsx"))
const MyPayslips = lazyWithReload(() => import("./pages/work/MyPayslips.jsx"))
const MyFinancial = lazyWithReload(() => import("./pages/work/MyFinancial.jsx"))
const LeaveRequest = lazyWithReload(() => import("./pages/work/LeaveRequest.jsx"))
/** งวด 2 — 3O ขอออกนอกสถานที่ */
const OutOfOffice = lazyWithReload(() => import("./pages/work/OutOfOffice.jsx"))
const OutOfOfficeApprovals = lazyWithReload(() => import("./pages/work/OutOfOfficeApprovals.jsx"))
/** Dev-only index of all HR pages (not registered in production builds) */
const DevHrHub = import.meta.env.DEV ? lazyWithReload(() => import("./pages/dev/DevHrHub.jsx")) : null
const DevMobileKit = import.meta.env.DEV ? lazyWithReload(() => import("./pages/dev/DevMobileKit.jsx")) : null
const Inbox = lazyWithReload(() => import("./pages/work/Inbox.jsx"))
const FacilityReport = lazyWithReload(() => import("./pages/work/FacilityReport.jsx"))
const ChangePassword = lazyWithReload(() => import("./pages/work/ChangePassword.jsx"))
const MyRelocation = lazyWithReload(() => import("./pages/work/MyRelocation.jsx"))
const HolidayCalendar = lazyWithReload(() => import("./pages/work/HolidayCalendar.jsx"))
const LoanRequest = lazyWithReload(() => import("./pages/work/LoanRequest.jsx"))
const ForgotPassword = lazyWithReload(() => import("./pages/work/ForgotPassword.jsx"))
const ResetPassword = lazyWithReload(() => import("./pages/work/ResetPassword.jsx"))
/** Admin — สิทธิ์ตามบทบาท (read-only) */
const RolePermissions = lazyWithReload(() => import("./pages/admin/RolePermissions.jsx"))

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
      {DevMobileKit && <Route path="/dev/mobile-kit" element={<DevMobileKit />} />}

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
        {/* เพิ่มบริษัท: customer.register เหมือน backend (canSeeAddCompany) */}
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
        {/* หน้า HR รวมแท็บ — เข้าได้ถ้ามีอย่างน้อยหนึ่งแท็บ (แต่ละแท็บเช็คสิทธิ์ของตัวเอง) */}
        <Route path="/hr/dashboard" element={<RequirePermission anyOf={HR_HUB_PERMS}><HRDashboard /></RequirePermission>} />
        <Route path="/hr/kpi" element={<RequirePermission anyOf={["hr.kpi.evaluations.view", "hr.kpi.monthlyForm", "hr.kpi.score.branchHead", "hr.kpi.branch"]}><HRKpiPage /></RequirePermission>} />
        <Route path="/hr/issues" element={guard("hr.issues.list", <HRIssueReports />)} />
        <Route path="/hr/personnel/:id" element={guard("hr.employees.view", <HRPersonnelDetail />)} />
        <Route path="/hr/salary-tier" element={guard("hr.salaryLadder.view", <HRSalaryTier />)} />
        <Route path="/hr/welfare" element={guard("hr.welfare.view", <HRWelfare />)} />
        <Route path="/hr/discipline" element={guard("hr.discipline.cases", <HRDiscipline />)} />
        <Route path="/hr/leave-calendar" element={guard("hr.leave.calendar", <HRLeaveCalendar />)} />

        {/* ✅ Personal routes (ทุกคนที่ล็อกอิน) */}
        <Route path="/my-profile" element={guard("self.profile.view", <MyProfile />)} />
        <Route path="/my-payslips" element={guard("self.payroll.view", <MyPayslips />)} />
        <Route path="/my-financial" element={guard("self.payroll.view", <MyFinancial />)} />
        <Route path="/leave-request" element={guard("self.leave.request", <LeaveRequest />)} />
        <Route path="/out-of-office" element={guard("self.ooo.request", <OutOfOffice />)} />
        <Route path="/out-of-office/approvals" element={guard("hr.ooo.list", <OutOfOfficeApprovals />)} />
        {/* กล่องงานรออนุมัติ: เปิดให้ทุกคน — เนื้อหาในหน้ากรองตามสิทธิ์อนุมัติเอง */}
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/my-relocation" element={guard("self.relocation.request", <MyRelocation />)} />
        {/* ปฏิทินวันหยุด (3N) — อ่านอย่างเดียว ทุกคนที่ล็อกอิน; HR จัดการที่ /hr/dashboard → ปฏิทินวันหยุด */}
        <Route path="/holidays" element={guard("hr.holidays.view", <HolidayCalendar />)} />
        <Route path="/loan-request" element={guard("self.loan.apply", <LoanRequest />)} />
        <Route path="/my-welfare" element={guard("self.welfare.view", <MyWelfare />)} />
        <Route path="/my-discipline" element={<RequirePermission anyOf={["self.discipline.report", "self.discipline.history"]}><MyDiscipline /></RequirePermission>} />
        <Route path="/my-kpi" element={guard("self.kpi.result", <MyKpi />)} />
        <Route path="/my-salary-cert" element={guard("self.salaryCert.request", <MySalaryCert />)} />

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
