// src/pages/hr/HRDashboard.jsx
// HR Dashboard แบบ All-in-One — stat cards + 12 tabs
import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { apiAuth } from "../../lib/api"

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

const fmt = (n) =>
  n == null ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })

const TABS = [
  { key: "employees",   label: "👥 พนักงาน" },
  { key: "leave",       label: "📋 ใบลา" },
  { key: "relocation",  label: "🚌 ย้ายสาขา" },
  { key: "issues",      label: "🔧 รายงานปัญหา" },
  { key: "salary",      label: "💹 เงินเดือน" },
  { key: "payroll",     label: "💰 จ่ายเงินเดือน" },
  { key: "loans",       label: "💳 สินเชื่อ" },
  { key: "kpi",         label: "📊 KPI" },
  { key: "positions",   label: "🏷️ ตำแหน่งงาน" },
  { key: "leave-types", label: "📅 ประเภทการลา" },
  { key: "promotions",  label: "🏆 เลื่อนตำแหน่ง" },
  { key: "audit",       label: "🔍 ประวัติระบบ" },
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
      label: "พนักงานที่ใช้งาน",
      value: stats?.total_active_employees != null ? `${stats.total_active_employees} คน` : "—",
      icon: "👥",
      color: "text-indigo-700 dark:text-indigo-300",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
      tab: "employees",
    },
    {
      label: "คำขอลารออนุมัติ",
      value: stats?.pending_leave_requests != null ? `${stats.pending_leave_requests} รายการ` : "—",
      icon: "📋",
      color: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      tab: "leave",
      alert: stats?.pending_leave_requests > 0,
    },
    {
      label: "คำขอย้ายสาขารออนุมัติ",
      value: stats?.pending_relocation_requests != null ? `${stats.pending_relocation_requests} รายการ` : "—",
      icon: "🚌",
      color: "text-blue-700 dark:text-blue-300",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      tab: "relocation",
      alert: stats?.pending_relocation_requests > 0,
    },
    {
      label: "รายงานปัญหารอดำเนินการ",
      value: stats?.pending_issue_reports != null ? `${stats.pending_issue_reports} รายการ` : "—",
      icon: "🔧",
      color: "text-red-700 dark:text-red-300",
      bg: "bg-red-50 dark:bg-red-900/20",
      tab: "issues",
      alert: stats?.pending_issue_reports > 0,
    },
    {
      label: "เงินเดือนรวม/เดือน",
      value: stats?.total_salary_this_month != null ? `${fmt(stats.total_salary_this_month)} ฿` : "—",
      icon: "💰",
      color: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
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
      case "promotions":  return <HRPromotionsTab />
      case "audit":       return <HRAuditTab />
      default:            return <HREmployeesTab />
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">HR Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">จัดการข้อมูลบุคคลและระบบ HR</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            onClick={s.tab ? () => setTab(s.tab) : undefined}
            className={`rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 transition ${s.tab ? "cursor-pointer hover:ring-indigo-300 dark:hover:ring-indigo-600 hover:shadow-md" : ""} ${s.alert ? "ring-amber-300 dark:ring-amber-600" : ""}`}
          >
            {loadingStats ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 w-8 rounded-xl bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-6 w-12 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ) : (
              <div className="flex items-start gap-2.5">
                <div className={`h-9 w-9 rounded-xl ${s.bg} flex items-center justify-center text-lg shrink-0`}>
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{s.label}</p>
                  <p className={`text-lg font-bold mt-0.5 leading-tight ${s.color}`}>{s.value}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        {/* Tab Header - scrollable */}
        <div className="overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          <div className="flex min-w-max">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setTab(tab.key)}
                  className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all cursor-pointer border-b-2 ${
                    isActive
                      ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
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
