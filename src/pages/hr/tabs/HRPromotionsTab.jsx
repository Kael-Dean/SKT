// src/pages/hr/tabs/HRPromotionsTab.jsx
// เลื่อนตำแหน่ง — GET /promotions/eligible, POST /promotions/exams
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import { PageLoader, ErrorState, EmptyState } from "../../../components/ui"

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
      setCreateMsg("⚠️ กรุณากรอกรหัสเจ้าหน้าที่และวันที่สอบ")
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
          {loading ? "กำลังโหลด…" : `เจ้าหน้าที่ที่มีสิทธิ์เลื่อนตำแหน่ง ${eligible.length} คน`}
        </p>
        <button
          onClick={() => { setShowExam(true); setCreateMsg("") }}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          สร้างการสอบ
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={fetchEligible} />}

      {loading ? (
        <PageLoader variant="table" rows={6} message="กำลังโหลดรายชื่อผู้มีสิทธิ์เลื่อนตำแหน่ง…" />
      ) : eligible.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm">
          <EmptyState
            title="ยังไม่มีผู้มีสิทธิ์เลื่อนตำแหน่ง"
            description="ยังไม่มีเจ้าหน้าที่ที่เข้าเกณฑ์การเลื่อนตำแหน่งในขณะนี้"
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">เจ้าหน้าที่</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">ตำแหน่งปัจจุบัน</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">สาขา</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">อายุงาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {eligible.map((emp) => (
                  <tr key={emp.id} className="hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-300">
                          {emp.first_name?.[0] ?? "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{emp.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{emp.position ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{emp.branch_location ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 tabular-nums hidden lg:table-cell">
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
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">สร้างการสอบเลื่อนตำแหน่ง</h3>
              <button onClick={() => setShowExam(false)} aria-label="ปิด" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">รหัสเจ้าหน้าที่ <span className="text-red-500">*</span></label>
              <input type="text" value={examForm.employee_id} onChange={(e) => setExamForm(f => ({ ...f, employee_id: e.target.value }))}
                className={inputCls} placeholder="กรอกรหัสเจ้าหน้าที่" />
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
