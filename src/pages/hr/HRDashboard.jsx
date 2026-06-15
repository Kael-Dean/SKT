// src/pages/hr/HRDashboard.jsx
// HR Dashboard แบบ All-in-One — stat cards + 17 tabs (Section 13 added)
import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { apiAuth } from "../../lib/api"
import { PageLoader, Badge } from "../../components/ui"

import HREmployeesTab from "./tabs/HREmployeesTab"
import HRLeaveTab from "./tabs/HRLeaveTab"
import HRRelocationTab from "./tabs/HRRelocationTab"
import HRIssueTab from "./tabs/HRIssueTab"
import HRSalaryTab from "./tabs/HRSalaryTab"
import HRPayrollTab from "./tabs/HRPayrollTab"
import HRLoansTab from "./tabs/HRLoansTab"
import HRKpiTab from "./tabs/HRKpiTab"
import HRPositionsTab from "./tabs/HRPositionsTab"
import HRLeaveTypesTab from "./tabs/HRLeaveTypesTab"
import HRPromotionsTab from "./tabs/HRPromotionsTab"
import HRAuditTab from "./tabs/HRAuditTab"
// Section 13
import HRTerminationTab from "./tabs/HRTerminationTab"
import HRSalaryCertTab from "./tabs/HRSalaryCertTab"
import HRRelocationHistoryTab from "./tabs/HRRelocationHistoryTab"
import HRLeaveRegisterTab from "./tabs/HRLeaveRegisterTab"
import HRResignedRetiredTab from "./tabs/HRResignedRetiredTab"

const fmt = (n) =>
  n == null ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })

// Line-art stat icons (currentColor) — replaces decorative emoji on KPI tiles.
const statIconPaths = {
  employees:   "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  leave:       "M8 2v3M16 2v3M3.5 9h17M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM9 14l2 2 4-4",
  relocation:  "M3 17h13V6H3v11ZM16 9h3l3 3v5h-6M5.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  issues:      "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.9 6.9a2.12 2.12 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.94-7.94l-3.76 3.76Z",
  salary:      "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
}

function StatIcon({ name, className }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={statIconPaths[name]} />
    </svg>
  )
}

const TABS = [
  { key: "employees",          label: "👥 เจ้าหน้าที่" },
  { key: "leave",              label: "📋 ใบลา" },
  { key: "relocation",         label: "🚌 ย้ายสาขา" },
  { key: "issues",             label: "🔧 รายงานปัญหา" },
  { key: "salary",             label: "💹 เงินเดือน" },
  { key: "payroll",            label: "💰 จ่ายเงินเดือน" },
  { key: "loans",              label: "💳 สินเชื่อ" },
  { key: "kpi",                label: "📊 KPI" },
  { key: "positions",          label: "🏷️ ตำแหน่งงาน" },
  { key: "leave-types",        label: "📅 ประเภทการลา" },
  { key: "promotions",         label: "🏆 เลื่อนตำแหน่ง" },
  { key: "audit",              label: "🔍 ประวัติระบบ" },
  // Section 13
  { key: "termination",        label: "🚪 ออกจากงาน" },
  { key: "salary-cert",        label: "📜 หนังสือรับรอง" },
  { key: "relocation-history", label: "📋 ประวัติย้ายสาขา" },
  { key: "leave-register",     label: "📅 ทะเบียนการลา" },
  { key: "resigned-retired",   label: "👋 ลาออก/เกษียณ" },
]

export default function HRDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "employees"

  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  const setTab = useCallback((key) => {
    setSearchParams({ tab: key })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [setSearchParams])

  useEffect(() => {
    setLoadingStats(true)
    apiAuth("/hr/dashboard")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false))
  }, [])

  const statCards = [
    {
      label: "เจ้าหน้าที่ที่ใช้งาน",
      value: stats?.total_active_employees != null ? `${stats.total_active_employees} คน` : "—",
      icon: "employees",
      color: "text-indigo-700 dark:text-indigo-300",
      iconColor: "text-indigo-600 dark:text-indigo-300",
      bg: "bg-indigo-50 dark:bg-indigo-900/25",
      tab: "employees",
    },
    {
      label: "คำขอลารออนุมัติ",
      value: stats?.pending_leave_requests != null ? `${stats.pending_leave_requests} รายการ` : "—",
      icon: "leave",
      color: "text-amber-700 dark:text-amber-300",
      iconColor: "text-amber-600 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-900/25",
      tab: "leave",
      alert: stats?.pending_leave_requests > 0,
    },
    {
      label: "คำขอย้ายสาขารออนุมัติ",
      value: stats?.pending_relocation_requests != null ? `${stats.pending_relocation_requests} รายการ` : "—",
      icon: "relocation",
      color: "text-blue-700 dark:text-blue-300",
      iconColor: "text-blue-600 dark:text-blue-300",
      bg: "bg-blue-50 dark:bg-blue-900/25",
      tab: "relocation",
      alert: stats?.pending_relocation_requests > 0,
    },
    {
      label: "รายงานปัญหารอดำเนินการ",
      value: stats?.pending_issue_reports != null ? `${stats.pending_issue_reports} รายการ` : "—",
      icon: "issues",
      color: "text-red-700 dark:text-red-300",
      iconColor: "text-red-600 dark:text-red-300",
      bg: "bg-red-50 dark:bg-red-900/25",
      tab: "issues",
      alert: stats?.pending_issue_reports > 0,
    },
    {
      label: "เงินเดือนรวม/เดือน",
      value: stats?.total_salary_this_month != null ? `${fmt(stats.total_salary_this_month)} ฿` : "—",
      icon: "salary",
      color: "text-emerald-700 dark:text-emerald-300",
      iconColor: "text-emerald-600 dark:text-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-900/25",
    },
  ]

  const renderTab = () => {
    switch (activeTab) {
      case "employees":   return <HREmployeesTab />
      case "leave":       return <HRLeaveTab />
      case "relocation":  return <HRRelocationTab />
      case "issues":      return <HRIssueTab />
      case "salary":      return <HRSalaryTab />
      case "payroll":     return <HRPayrollTab />
      case "loans":       return <HRLoansTab />
      case "kpi":         return <HRKpiTab />
      case "positions":   return <HRPositionsTab />
      case "leave-types": return <HRLeaveTypesTab />
      case "promotions":          return <HRPromotionsTab />
      case "audit":               return <HRAuditTab />
      case "termination":         return <HRTerminationTab />
      case "salary-cert":         return <HRSalaryCertTab />
      case "relocation-history":  return <HRRelocationHistoryTab />
      case "leave-register":      return <HRLeaveRegisterTab />
      case "resigned-retired":    return <HRResignedRetiredTab />
      default:                    return <HREmployeesTab />
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">HR Dashboard</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">จัดการข้อมูลบุคคลและระบบ HR</p>
      </div>

      {/* Stat Cards */}
      {loadingStats ? (
        <PageLoader variant="dashboard" rows={5} message="กำลังโหลดสรุปข้อมูล…" />
      ) : (
        <div className="animate-fade-up stagger-1 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statCards.map((s) => {
            const clickable = Boolean(s.tab)
            const Tag = clickable ? "button" : "div"
            return (
              <Tag
                key={s.label}
                type={clickable ? "button" : undefined}
                onClick={clickable ? () => setTab(s.tab) : undefined}
                className={`group w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-gray-200/70 transition-all duration-150 dark:bg-gray-800 dark:ring-gray-700/70 ${
                  clickable
                    ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:ring-indigo-300 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:ring-indigo-600"
                    : ""
                } ${s.alert ? "ring-amber-300 dark:ring-amber-600/70" : ""}`}
              >
                <div className="flex items-start gap-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.bg} ${s.iconColor}`}>
                    <StatIcon name={s.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs leading-tight text-gray-500 dark:text-gray-400">{s.label}</p>
                    <p className={`mt-0.5 text-lg font-bold leading-tight ${s.color}`}>{s.value}</p>
                  </div>
                </div>
                {s.alert ? (
                  <div className="mt-2.5">
                    <Badge tone="pending">ต้องดำเนินการ</Badge>
                  </div>
                ) : null}
              </Tag>
            )
          })}
        </div>
      )}

      {/* Tab Bar */}
      <div className="animate-fade-up stagger-2 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70">
        {/* Tab Header - scrollable */}
        <div className="overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          <div className="flex min-w-max" role="tablist">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setTab(tab.key)}
                  className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                    isActive
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/25 dark:text-indigo-300"
                      : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {renderTab()}
        </div>
      </div>
    </div>
  )
}
