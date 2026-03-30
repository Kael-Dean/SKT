// src/pages/hr/tabs/HRKpiTab.jsx
// KPI — บันทึกรายเดือน + การประเมิน
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
const now = new Date()

export default function HRKpiTab() {
  const [subTab, setSubTab] = useState("eval")

  // ประเมิน KPI
  const [evaluations, setEvaluations] = useState([])
  const [loadingEval, setLoadingEval] = useState(true)
  const [evalError, setEvalError] = useState("")

  const [scoreModal, setScoreModal] = useState(null)
  const [scoreForm, setScoreForm] = useState({ branch_head_score: "", asst_manager_score: "", manager_score: "" })
  const [scoring, setScoring] = useState(false)
  const [scoreMsg, setScoreMsg] = useState("")

  // บันทึก KPI รายเดือน
  const [kpiForm, setKpiForm] = useState({
    employee_id: "",
    fiscal_year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    section: "1",
    metric: "",
    value: "",
  })
  const [submittingKpi, setSubmittingKpi] = useState(false)
  const [kpiMsg, setKpiMsg] = useState("")

  const fetchEvals = useCallback(() => {
    setLoadingEval(true)
    setEvalError("")
    apiAuth("/hr/kpi/evaluations")
      .then(setEvaluations)
      .catch((e) => setEvalError(e.message || "โหลดไม่สำเร็จ"))
      .finally(() => setLoadingEval(false))
  }, [])

  useEffect(() => {
    if (subTab === "eval") fetchEvals()
  }, [subTab, fetchEvals])

  const openScore = (ev) => {
    setScoreModal(ev)
    setScoreForm({
      branch_head_score: ev.branch_head_score ?? "",
      asst_manager_score: ev.asst_manager_score ?? "",
      manager_score: ev.manager_score ?? "",
    })
    setScoreMsg("")
  }

  const saveScore = async () => {
    if (!scoreModal) return
    setScoring(true)
    setScoreMsg("")
    try {
      if (scoreForm.branch_head_score !== "") {
        await apiAuth(`/hr/kpi/evaluations/${scoreModal.employee_id}/branch-head-score`, {
          method: "PUT",
          body: { score: Number(scoreForm.branch_head_score) },
        })
      }
      if (scoreForm.asst_manager_score !== "") {
        await apiAuth(`/hr/kpi/evaluations/${scoreModal.employee_id}/asst-manager-score`, {
          method: "PUT",
          body: { score: Number(scoreForm.asst_manager_score) },
        })
      }
      if (scoreForm.manager_score !== "") {
        await apiAuth(`/hr/kpi/evaluations/${scoreModal.employee_id}/manager-score`, {
          method: "PUT",
          body: { score: Number(scoreForm.manager_score) },
        })
      }
      setScoreMsg("✅ บันทึกคะแนนสำเร็จ")
      setTimeout(() => { setScoreModal(null); fetchEvals() }, 700)
    } catch (err) {
      setScoreMsg(`❌ ${err.message || "ไม่สำเร็จ"}`)
    } finally {
      setScoring(false)
    }
  }

  const submitKpi = async () => {
    if (!kpiForm.employee_id || !kpiForm.metric || !kpiForm.value) {
      setKpiMsg("⚠️ กรุณากรอกรหัสพนักงาน, ตัวชี้วัด และค่า")
      return
    }
    setSubmittingKpi(true)
    setKpiMsg("")
    try {
      await apiAuth("/hr/kpi/monthly", {
        method: "POST",
        body: {
          employee_id: kpiForm.employee_id,
          fiscal_year: Number(kpiForm.fiscal_year),
          month: Number(kpiForm.month),
          section: Number(kpiForm.section),
          metric: kpiForm.metric,
          value: parseFloat(kpiForm.value),
        },
      })
      setKpiMsg("✅ บันทึก KPI สำเร็จ")
      setKpiForm((f) => ({ ...f, metric: "", value: "" }))
    } catch (err) {
      setKpiMsg(`❌ ${err.message || "ไม่สำเร็จ"}`)
    } finally {
      setSubmittingKpi(false)
    }
  }

  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["eval", "การประเมิน KPI"], ["monthly", "บันทึก KPI รายเดือน"]].map(([v, label]) => (
          <button key={v} onClick={() => setSubTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${subTab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* การประเมิน */}
      {subTab === "eval" && (
        <div className="space-y-3">
          {evalError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{evalError}</div>
          )}
          {loadingEval ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
            </div>
          ) : evaluations.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-12 text-center">
              <p className="text-3xl mb-3">📊</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีข้อมูลการประเมิน KPI</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">พนักงาน</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">หัวหน้าสาขา<br/><span className="text-gray-400">≤42</span></th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">ผู้ช่วยผจก.<br/><span className="text-gray-400">≤20</span></th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">ผู้จัดการ<br/><span className="text-gray-400">≤10</span></th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">รวม</th>
                      <th className="px-4 py-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {evaluations.map((ev) => {
                      const total = (Number(ev.branch_head_score) || 0) + (Number(ev.branch_performance_score) || 0) + (Number(ev.asst_manager_score) || 0) + (Number(ev.manager_score) || 0)
                      return (
                        <tr key={ev.employee_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{ev.first_name} {ev.last_name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{ev.employee_id}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">{ev.branch_head_score ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">{ev.asst_manager_score ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">{ev.manager_score ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-bold text-indigo-700 dark:text-indigo-300">{total > 0 ? total : "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => openScore(ev)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">บันทึกคะแนน</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* บันทึก KPI รายเดือน */}
      {subTab === "monthly" && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-6 space-y-4 max-w-lg">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">บันทึก KPI รายเดือน</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">รหัสพนักงาน</label>
              <input type="text" value={kpiForm.employee_id}
                onChange={(e) => setKpiForm(f => ({ ...f, employee_id: e.target.value }))}
                className={inputCls} placeholder="รหัสพนักงาน" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ปีงบประมาณ</label>
              <input type="number" value={kpiForm.fiscal_year}
                onChange={(e) => setKpiForm(f => ({ ...f, fiscal_year: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เดือน</label>
              <select value={kpiForm.month} onChange={(e) => setKpiForm(f => ({ ...f, month: e.target.value }))} className={inputCls}>
                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">หมวด</label>
              <select value={kpiForm.section} onChange={(e) => setKpiForm(f => ({ ...f, section: e.target.value }))} className={inputCls}>
                <option value="1">หมวด 1</option>
                <option value="2">หมวด 2</option>
                <option value="3">หมวด 3</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ตัวชี้วัด</label>
              <input type="text" value={kpiForm.metric}
                onChange={(e) => setKpiForm(f => ({ ...f, metric: e.target.value }))}
                className={inputCls} placeholder="ชื่อตัวชี้วัด" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ค่า</label>
              <input type="number" step="0.01" value={kpiForm.value}
                onChange={(e) => setKpiForm(f => ({ ...f, value: e.target.value }))}
                className={inputCls} placeholder="0.00" />
            </div>
          </div>
          {kpiMsg && (
            <p className={`text-sm font-medium ${kpiMsg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{kpiMsg}</p>
          )}
          <button onClick={submitKpi} disabled={submittingKpi}
            className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
            {submittingKpi ? "กำลังบันทึก..." : "บันทึก KPI"}
          </button>
        </div>
      )}

      {/* Score Modal */}
      {scoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">บันทึกคะแนน KPI</h3>
              <button onClick={() => setScoreModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">✕</button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{scoreModal.first_name} {scoreModal.last_name}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">คะแนนหัวหน้าสาขา (สูงสุด 42)</label>
                <input type="number" min="0" max="42" value={scoreForm.branch_head_score}
                  onChange={(e) => setScoreForm(f => ({ ...f, branch_head_score: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">คะแนนผู้ช่วยผู้จัดการ (สูงสุด 20)</label>
                <input type="number" min="0" max="20" value={scoreForm.asst_manager_score}
                  onChange={(e) => setScoreForm(f => ({ ...f, asst_manager_score: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">คะแนนผู้จัดการ (สูงสุด 10)</label>
                <input type="number" min="0" max="10" value={scoreForm.manager_score}
                  onChange={(e) => setScoreForm(f => ({ ...f, manager_score: e.target.value }))} className={inputCls} />
              </div>
            </div>
            {scoreMsg && <p className={`text-sm text-center ${scoreMsg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{scoreMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setScoreModal(null)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
              <button onClick={saveScore} disabled={scoring}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                {scoring ? "กำลังบันทึก..." : "บันทึกคะแนน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
