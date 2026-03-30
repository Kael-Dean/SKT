// src/pages/hr/tabs/HRPayrollTab.jsx
// จ่ายเงินเดือน — GET /payroll, POST /payroll/generate
import { useEffect, useState, useCallback } from "react"
import { apiAuth, apiDownload } from "../../../lib/api"
import SelectDropdown from "../../../components/SelectDropdown"

const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })

function fmtMonth(y, m) {
  if (!y || !m) return "—"
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
  return `${months[m - 1]} ${Number(y) + 543}`
}

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

const now = new Date()
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
  return {
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    label: fmtMonth(d.getFullYear(), d.getMonth() + 1),
  }
})

export default function HRPayrollTab() {
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showGenerate, setShowGenerate] = useState(false)
  const [genForm, setGenForm] = useState({ employee_id: "", month: "", year: "" })
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState("")

  const [downloading, setDownloading] = useState(null)

  const fetchPayrolls = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/hr/payroll")
      .then(setPayrolls)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPayrolls() }, [fetchPayrolls])

  const handleMonthSelect = (v) => {
    const [y, m] = v.split("-")
    setGenForm((f) => ({ ...f, month: m, year: y }))
  }

  const handleGenerate = async () => {
    if (!genForm.employee_id || !genForm.month || !genForm.year) {
      setGenMsg("⚠️ กรุณากรอกรหัสพนักงานและเลือกเดือน")
      return
    }
    setGenerating(true)
    setGenMsg("")
    try {
      await apiAuth("/hr/payroll/generate", {
        method: "POST",
        body: {
          employee_id: Number(genForm.employee_id),
          month: Number(genForm.month),
          year: Number(genForm.year),
        },
      })
      setGenMsg("✅ สร้างเงินเดือนสำเร็จ!")
      setTimeout(() => {
        setShowGenerate(false)
        setGenForm({ employee_id: "", month: "", year: "" })
        setGenMsg("")
        fetchPayrolls()
      }, 1000)
    } catch (err) {
      setGenMsg(`❌ ${err.message || "ไม่สำเร็จ"}`)
    } finally {
      setGenerating(false)
    }
  }

  const downloadPayslip = async (id) => {
    setDownloading(id)
    try {
      const { blob, filename } = await apiDownload(`/hr/payroll/${id}/payslip`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || `payslip_${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`ดาวน์โหลดไม่สำเร็จ: ${err.message || ""}`)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด..." : `รายการเงินเดือน ${payrolls.length} รายการ`}
        </p>
        <button
          onClick={() => { setShowGenerate(true); setGenMsg("") }}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition cursor-pointer"
        >
          ➕ สร้างเงินเดือน
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">พนักงาน</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">เดือน/ปี</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">เงินเดือน</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">หักรวม</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">สุทธิ</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10">
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
                  </div>
                </td></tr>
              ) : payrolls.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">ยังไม่มีข้อมูลเงินเดือน</td></tr>
              ) : payrolls.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{p.employee_id}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmtMonth(p.year, p.month)}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden sm:table-cell">{fmt(p.base_salary)}</td>
                  <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 hidden md:table-cell">{fmt(p.total_deductions)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-300">{fmt(p.net_pay)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => downloadPayslip(p.id)}
                      disabled={downloading === p.id}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      {downloading === p.id ? "..." : "สลิปเงินเดือน"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">สร้างเงินเดือน</h3>
              <button onClick={() => setShowGenerate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">✕</button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">รหัสพนักงาน</label>
              <input type="text" value={genForm.employee_id} onChange={(e) => setGenForm(f => ({ ...f, employee_id: e.target.value }))}
                className={inputCls} placeholder="กรอกรหัสพนักงาน" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เดือน/ปี</label>
              <SelectDropdown
                value={genForm.month && genForm.year ? `${genForm.year}-${genForm.month}` : ""}
                onChange={handleMonthSelect}
                placeholder="เลือกเดือน"
                options={MONTH_OPTIONS}
              />
            </div>
            {genMsg && (
              <p className={`text-sm text-center font-medium ${genMsg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{genMsg}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowGenerate(false)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
              <button onClick={handleGenerate} disabled={generating}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                {generating ? "กำลังสร้าง..." : "สร้างเงินเดือน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
