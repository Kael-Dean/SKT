// src/pages/dev/DevHrHub.jsx
// Dev-only index of every HR-related page (registered in App.jsx only when
// import.meta.env.DEV). Lets developers jump straight to any HR screen.
import { Link } from "react-router-dom"
import { getUser, getRoleId } from "../../lib/auth"

const ROLE_NAME = { 1: "ADMIN", 2: "MNG", 3: "HR", 4: "HA", 5: "MKT", 6: "BRANCH", 7: "STAFF" }

const EMPLOYEE_PAGES = [
  { to: "/leave-request", label: "ยื่นใบลา", file: "pages/work/LeaveRequest.jsx" },
  { to: "/inbox", label: "กล่องงานรออนุมัติ", file: "pages/work/Inbox.jsx" },
  { to: "/my-profile", label: "โปรไฟล์ของฉัน", file: "pages/work/MyProfile.jsx" },
  { to: "/my-relocation", label: "ขอย้ายสาขา", file: "pages/work/MyRelocation.jsx" },
  { to: "/loan-request", label: "ขอสินเชื่อ", file: "pages/work/LoanRequest.jsx" },
  { to: "/facility-report", label: "รายงานรายรับ-รายจ่ายสถานที่ (role 1/5/6)", file: "pages/work/FacilityReport.jsx" },
  { to: "/change-password", label: "เปลี่ยนรหัสผ่าน", file: "pages/work/ChangePassword.jsx" },
]

const HR_PAGES = [
  { to: "/hr/dashboard", label: "HR Dashboard", file: "pages/hr/HRDashboard.jsx" },
  { to: "/hr/users", label: "รายชื่อเจ้าหน้าที่", file: "pages/hr/HRUserList.jsx" },
  { to: "/hr/leaves", label: "จัดการใบลา", file: "pages/hr/HRLeaveManagement.jsx" },
  { to: "/hr/staff-signup", label: "ลงทะเบียนเจ้าหน้าที่", file: "pages/hr/HRStaffSignup.jsx" },
  { to: "/hr/issues", label: "รายงานปัญหา", file: "pages/hr/HRIssueReports.jsx" },
  { to: "/hr/salary-tier", label: "ขั้นเงินเดือน", file: "pages/hr/HRSalaryTier.jsx" },
  { to: "/hr/finance", label: "การเงิน HR (ADMIN)", file: "pages/hr/HRFinance.jsx" },
  { to: "/hr/relocation", label: "ย้ายสาขา (ADMIN)", file: "pages/hr/HRRelocation.jsx" },
  { to: "/hr/personnel/1", label: "รายละเอียดบุคลากร (ตัวอย่าง id=1)", file: "pages/hr/HRPersonnelDetail.jsx" },
]

// keep in sync with TABS in HRDashboard.jsx
const DASHBOARD_TABS = [
  ["employees", "เจ้าหน้าที่", "HREmployeesTab"],
  ["leave", "ใบลา", "HRLeaveTab"],
  ["relocation", "ย้ายสาขา", "HRRelocationTab"],
  ["issues", "รายงานปัญหา", "HRIssueTab"],
  ["salary", "เงินเดือน", "HRSalaryTab"],
  ["payroll", "จ่ายเงินเดือน", "HRPayrollTab"],
  ["loans", "สินเชื่อ", "HRLoansTab"],
  ["kpi", "KPI", "HRKpiTab"],
  ["positions", "ตำแหน่งงาน", "HRPositionsTab"],
  ["leave-types", "ประเภทการลา", "HRLeaveTypesTab"],
  ["promotions", "เลื่อนตำแหน่ง", "HRPromotionsTab"],
  ["audit", "ประวัติระบบ", "HRAuditTab"],
  ["termination", "ออกจากงาน", "HRTerminationTab"],
  ["salary-cert", "หนังสือรับรอง", "HRSalaryCertTab"],
  ["relocation-history", "ประวัติย้ายสาขา", "HRRelocationHistoryTab"],
  ["leave-register", "ทะเบียนการลา", "HRLeaveRegisterTab"],
  ["resigned-retired", "ลาออก/เกษียณ", "HRResignedRetiredTab"],
  ["holiday-calendar", "ปฏิทินวันหยุด", "HRHolidayCalendarTab"],
  ["holiday-work", "ทำงานวันหยุด", "HRHolidayWorkTab"],
].map(([key, label, comp]) => ({
  to: `/hr/dashboard?tab=${key}`,
  label,
  file: `pages/hr/tabs/${comp}.jsx`,
}))

function Section({ title, hint, items }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {hint && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
      <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
        {items.map((it) => (
          <li key={it.to}>
            <Link
              to={it.to}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl px-2 py-2 transition-all duration-200 hover:bg-indigo-50 dark:hover:bg-gray-700"
            >
              <span className="font-medium text-indigo-600 dark:text-indigo-300">{it.label}</span>
              <code className="text-xs text-gray-500 dark:text-gray-400">
                #{it.to} · src/{it.file}
              </code>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function DevHrHub() {
  const user = getUser()
  const roleId = getRoleId()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">dev only</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">หน้า HR ทั้งหมด</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {user
              ? `ล็อกอินเป็น ${user.username || "-"} · role ${roleId} (${ROLE_NAME[roleId] || "?"})`
              : "ยังไม่ล็อกอิน — "}
            {!user && (
              <Link to="/" className="text-indigo-600 underline dark:text-indigo-300">ไปหน้า Login</Link>
            )}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            หน้า HR ต้องใช้ role 1 (ADMIN) หรือ 3 (HR) · /hr/finance และ /hr/relocation ต้อง ADMIN เท่านั้น
          </p>
        </header>

        <Section title="ฝั่งพนักงาน" hint="ทุก role เข้าได้" items={EMPLOYEE_PAGES} />
        <Section title="ฝั่ง HR" items={HR_PAGES} />
        <Section title="HR Dashboard — แท็บ" items={DASHBOARD_TABS} />
      </div>
    </div>
  )
}
