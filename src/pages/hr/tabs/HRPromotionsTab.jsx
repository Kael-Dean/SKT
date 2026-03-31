// src/pages/hr/tabs/HRPromotionsTab.jsx
// เลื่อนตำแหน่ง — GET /promotions/eligible, POST /promotions/exams
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function HRPromotionsTab() {
  const [eligible, setEligible] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showExam, setShowExam] = useState(false)
  const [examForm, setExamForm] = useState({ employee_id: "", exam_date: "", notes: "" })
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState("")

  const fetchEligible = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/hr/promotions/eligible")
      .then(setEligible)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchEligible() }, [fetchEligible])

  const handleCreateExam = async () => {
    if (!examForm.employee_id || !examForm.exam_date) {
      setCreateMsg("⚠️ กรุณากรอกรหัสพนักงานและวันที่สอบ")
      return
    }
    setCreating(true)
    setCreateMsg("")
    try {
      await apiAuth("/hr/promotions/exams", {
        method: "POST",
        body: {
          employee_id: examForm.employee_id,
          exam_date: examForm.exam_date,
          notes: examForm.notes || undefined,
        },
      })
      setCreateMsg("✅ สร้างการสอบสำเร็จ")
      setTimeout(() => {
        setShowExam(false)
        setExamForm({ employee_id: "", exam_date: "", notes: "" })
        setCreateMsg("")
      }, 800)
    } catch (err) {
      setCreateMsg(`❌ ${err.message || "ไม่สำเร็จ"}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด..." : `พนักงานที่มีสิทธิ์เลื่อนตำแหน่ง ${eligible.length} คน`}
        </p>
        <button
          onClick={() => { setShowExam(true); setCreateMsg("") }}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition cursor-pointer"
        >
          📝 สร้างการสอบ
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
        </div>
      ) : eligible.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-12 text-center">
          <p className="text-3xl mb-3">🏆</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีพนักงานที่มีสิทธิ์เลื่อนตำแหน่ง</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">พนักงาน</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">ตำแหน่งปัจจุบัน</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">สาขา</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">อายุงาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {eligible.map((emp) => (
                  <tr key={emp.id} className="hover:bg-indigo-50 dark:hover:bg-indigo-900/10">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-300">
                          {emp.first_name?.[0] ?? "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{emp.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{emp.position ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{emp.branch_location ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                      {emp.job_age != null ? `${emp.job_age} ปี` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Exam Modal */}
      {showExam && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">📝 สร้างการสอบเลื่อนตำแหน่ง</h3>
              <button onClick={() => setShowExam(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">✕</button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">รหัสพนักงาน <span className="text-red-500">*</span></label>
              <input type="text" value={examForm.employee_id} onChange={(e) => setExamForm(f => ({ ...f, employee_id: e.target.value }))}
                className={inputCls} placeholder="กรอกรหัสพนักงาน" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">วันที่สอบ <span className="text-red-500">*</span></label>
              <input type="date" value={examForm.exam_date} onChange={(e) => setExamForm(f => ({ ...f, exam_date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">หมายเหตุ</label>
              <input type="text" value={examForm.notes} onChange={(e) => setExamForm(f => ({ ...f, notes: e.target.value }))}
                className={inputCls} placeholder="หมายเหตุ (ถ้ามี)" />
            </div>
            {createMsg && <p className={`text-sm text-center ${createMsg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{createMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowExam(false)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
              <button onClick={handleCreateExam} disabled={creating}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                {creating ? "กำลังสร้าง..." : "สร้างการสอบ"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
