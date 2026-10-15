// src/pages/hr/HRFinance.jsx
// จัดการข้อมูลการเงินเจ้าหน้าที่ — GET /hr/personnel + POST /hr/financial/{user_id} (ผ่าน FinancialEditSheet)
import { useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import { ErrorState, EmptyState, SkeletonTableRows, SkeletonStat } from "../../components/ui"
import FinancialEditSheet from "../../components/hr/FinancialEditSheet"

const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })

export default function HRFinance() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [editModal, setEditModal] = useState(null) // employee object

  const fetchEmployees = () => {
    setLoading(true)
    setError("")
    apiAuth("/hr/personnel?is_active=true")
      .then(setEmployees)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchEmployees() }, [])

  const openEdit = (emp) => setEditModal(emp)

  // คำนวณยอดรวมจาก financial data ที่มี
  const totalPayroll = employees.reduce((s, e) => s + (Number(e.financial?.current_salary) || 0), 0)

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ข้อมูลการเงินเจ้าหน้าที่</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? "กำลังโหลด..." : `ยอดเงินเดือนรวม: `}
            {!loading && <span className="font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">{fmt(totalPayroll)} บาท/เดือน</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          เชื่อมต่อ API แล้ว
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchEmployees} />}

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonStat key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "เจ้าหน้าที่ทั้งหมด", value: `${employees.length} คน`, color: "text-indigo-700 dark:text-indigo-300" },
            { label: "เงินเดือนรวม", value: `${fmt(totalPayroll)} ฿`, color: "text-emerald-700 dark:text-emerald-300" },
            { label: "มีข้อมูลการเงิน", value: `${employees.filter((e) => e.financial).length} คน`, color: "text-blue-700 dark:text-blue-300" },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
              <p className={`text-lg font-bold mt-1 tabular-nums ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">เจ้าหน้าที่</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">เงินเดือน</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">เงินกู้</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">อายุงาน</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <SkeletonTableRows rows={8} cols={5} />
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="ไม่พบข้อมูลเจ้าหน้าที่"
                      description="ยังไม่มีเจ้าหน้าที่ที่ยังปฏิบัติงานในระบบ"
                    />
                  </td>
                </tr>
              ) : employees.map((e) => {
                const fin = e.financial ?? {}
                return (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{e.first_name} {e.last_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{e.position ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {fin.current_salary != null ? fmt(fin.current_salary) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 tabular-nums hidden sm:table-cell">
                      {fin.current_loan != null ? fmt(fin.current_loan) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 tabular-nums hidden md:table-cell">
                      {fin.job_age != null ? `${fin.job_age} ปี` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEdit(e)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition cursor-pointer"
                      >
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <FinancialEditSheet
        open={!!editModal}
        employeeId={editModal?.id}
        employeeName={editModal ? `${editModal.first_name ?? ""} ${editModal.last_name ?? ""}`.trim() : ""}
        financial={editModal?.financial ?? {}}
        onClose={() => setEditModal(null)}
        onSaved={fetchEmployees}
      />
    </div>
  )
}
