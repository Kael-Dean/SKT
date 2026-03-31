// src/pages/hr/HRFinance.jsx
// จัดการข้อมูลการเงินเจ้าหน้าที่ — GET /hr/personnel + POST /hr/financial/{user_id}
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiAuth } from "../../lib/api"

const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })
const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function HRFinance() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [editModal, setEditModal] = useState(null) // employee object
  const [editForm, setEditForm] = useState({ current_salary: "", current_loan: "", job_age: "" })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  const fetchEmployees = () => {
    setLoading(true)
    setError("")
    apiAuth("/hr/personnel?is_active=true")
      .then(setEmployees)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchEmployees() }, [])

  const openEdit = (emp) => {
    setEditModal(emp)
    setEditForm({
      current_salary: emp.financial?.current_salary ?? "",
      current_loan: emp.financial?.current_loan ?? "",
      job_age: emp.financial?.job_age ?? "",
    })
    setSaveMsg("")
  }

  const saveEdit = async () => {
    if (!editModal) return
    setSaving(true)
    setSaveMsg("")
    try {
      const body = {}
      if (editForm.current_salary !== "") body.current_salary = parseFloat(editForm.current_salary)
      if (editForm.current_loan !== "") body.current_loan = parseFloat(editForm.current_loan)
      if (editForm.job_age !== "") body.job_age = parseInt(editForm.job_age)
      await apiAuth(`/hr/financial/${editModal.id}`, { method: "POST", body })
      setSaveMsg("✅ บันทึกสำเร็จ")
      setTimeout(() => { setEditModal(null); fetchEmployees() }, 800)
    } catch (err) {
      setSaveMsg(`❌ ${err.message || "บันทึกไม่สำเร็จ"}`)
    } finally {
      setSaving(false)
    }
  }

  // คำนวณยอดรวมจาก financial data ที่มี
  const totalPayroll = employees.reduce((s, e) => s + (Number(e.financial?.current_salary) || 0), 0)

  return (
    <div className="space-y-5 pb-10">
      <button onClick={() => navigate("/hr/dashboard")} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer">
        ← กลับ HR Dashboard
      </button>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ข้อมูลการเงินเจ้าหน้าที่</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? "กำลังโหลด..." : `ยอดเงินเดือนรวม: `}
            {!loading && <span className="font-semibold text-indigo-700 dark:text-indigo-300">{fmt(totalPayroll)} บาท/เดือน</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          ✅ เชื่อมต่อ API แล้ว
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "เจ้าหน้าที่ทั้งหมด", value: `${employees.length} คน`, color: "text-indigo-700 dark:text-indigo-300" },
            { label: "เงินเดือนรวม", value: `${fmt(totalPayroll)} ฿`, color: "text-emerald-700 dark:text-emerald-300" },
            { label: "มีข้อมูลการเงิน", value: `${employees.filter((e) => e.financial).length} คน`, color: "text-blue-700 dark:text-blue-300" },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
              <p className={`text-lg font-bold mt-1 ${c.color}`}>{c.value}</p>
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
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">ไม่พบข้อมูลเจ้าหน้าที่</td>
                </tr>
              ) : employees.map((e) => {
                const fin = e.financial ?? {}
                return (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{e.first_name} {e.last_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{e.position ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                      {fin.current_salary != null ? fmt(fin.current_salary) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {fin.current_loan != null ? fmt(fin.current_loan) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">
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

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">แก้ไขข้อมูลการเงิน</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{editModal.first_name} {editModal.last_name}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เงินเดือน (บาท)</label>
                <input type="number" value={editForm.current_salary} onChange={(e) => setEditForm((p) => ({ ...p, current_salary: e.target.value }))} className={inputCls} placeholder="25000" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เงินกู้คงเหลือ (บาท)</label>
                <input type="number" value={editForm.current_loan} onChange={(e) => setEditForm((p) => ({ ...p, current_loan: e.target.value }))} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">อายุงาน (ปี)</label>
                <input type="number" min="0" value={editForm.job_age} onChange={(e) => setEditForm((p) => ({ ...p, job_age: e.target.value }))} className={inputCls} placeholder="0" />
              </div>
            </div>
            {saveMsg && (
              <p className={`text-sm text-center ${saveMsg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{saveMsg}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setEditModal(null)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition shadow-sm cursor-pointer">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
