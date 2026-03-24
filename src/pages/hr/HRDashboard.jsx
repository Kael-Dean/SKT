// src/pages/hr/HRDashboard.jsx
// HR Overview — GET /hr/dashboard
import { useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import { useNavigate } from "react-router-dom"

const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })

export default function HRDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    setLoading(true)
    apiAuth("/hr/dashboard")
      .then(setData)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
    )
  }

  const stats = [
    {
      label: "พนักงานที่ใช้งาน",
      value: data?.total_active_employees != null ? `${data.total_active_employees} คน` : "—",
      color: "text-indigo-700 dark:text-indigo-300",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
      icon: "👥",
    },
    {
      label: "เงินเดือนรวม/เดือน",
      value: data?.total_salary_this_month != null ? `${fmt(data.total_salary_this_month)} ฿` : "—",
      color: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      icon: "💰",
      sub: data?.salary_source ? `จาก: ${data.salary_source}` : null,
    },
    {
      label: "คำขอลารออนุมัติ",
      value: data?.pending_leave_requests != null ? `${data.pending_leave_requests} รายการ` : "—",
      color: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      icon: "📋",
      link: "/hr/leaves",
    },
    {
      label: "คำขอย้ายสาขารออนุมัติ",
      value: data?.pending_relocation_requests != null ? `${data.pending_relocation_requests} รายการ` : "—",
      color: "text-blue-700 dark:text-blue-300",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      icon: "🚌",
      link: "/hr/relocation",
    },
  ]

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">HR Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ภาพรวมงาน HR</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data?.pending_issue_reports > 0 && (
            <button
              onClick={() => navigate("/hr/issues")}
              className="flex items-center gap-2 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition cursor-pointer"
            >
              🔧 รายงานปัญหารอดำเนินการ {data.pending_issue_reports} รายการ
            </button>
          )}
          <div className="flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            ✅ เชื่อมต่อ API แล้ว
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            onClick={s.link ? () => navigate(s.link) : undefined}
            className={`rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5 ${s.link ? "cursor-pointer hover:ring-indigo-300 dark:hover:ring-indigo-600 transition" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center text-xl shrink-0`}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                {s.sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Branch Distribution */}
      {data?.employees_per_branch?.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">พนักงานแยกตามสาขา</h3>
          <div className="space-y-2">
            {data.employees_per_branch.map((b) => {
              const total = data.total_active_employees || 1
              const pct = Math.round((b.count / total) * 100)
              return (
                <div key={b.branch_name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{b.branch_name}</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 ml-2 shrink-0">{b.count} คน</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">เมนูลัด</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: "รายชื่อพนักงาน", path: "/hr/users", icon: "👤" },
            { label: "จัดการใบลา", path: "/hr/leaves", icon: "📋" },
            { label: "ข้อมูลการเงิน", path: "/hr/finance", icon: "💳" },
            { label: "คำขอย้ายสาขา", path: "/hr/relocation", icon: "🚌" },
            { label: "รายงานปัญหา", path: "/hr/issues", icon: "🔧" },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-700 dark:hover:text-indigo-300 transition cursor-pointer"
            >
              <span>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
