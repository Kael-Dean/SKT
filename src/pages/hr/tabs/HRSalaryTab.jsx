// src/pages/hr/tabs/HRSalaryTab.jsx
// บันไดเงินเดือน + เลื่อนขั้นเงินเดือน
import { useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"

const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })
const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function HRSalaryTab() {
  const [subTab, setSubTab] = useState("ladder")

  // บันไดเงินเดือน
  const [ladder, setLadder] = useState([])
  const [loadingLadder, setLoadingLadder] = useState(false)
  const [filterTier, setFilterTier] = useState("")
  const [editEntry, setEditEntry] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  // เลื่อนขั้น
  const [empId, setEmpId] = useState("")
  const [stepAward, setStepAward] = useState("1.0")
  const [stepMsg, setStepMsg] = useState("")
  const [awardingStep, setAwardingStep] = useState(false)

  // ประวัติเงินเดือน
  const [histEmpId, setHistEmpId] = useState("")
  const [history, setHistory] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)
  const [histError, setHistError] = useState("")

  const fetchLadder = (tier) => {
    if (!tier) return
    setLoadingLadder(true)
    apiAuth(`/hr/salary-ladder?tier=${encodeURIComponent(tier)}`)
      .then(setLadder)
      .catch(() => setLadder([]))
      .finally(() => setLoadingLadder(false))
  }

  useEffect(() => {
    if (subTab !== "ladder") return
    if (filterTier) fetchLadder(filterTier)
    else setLadder([])
  }, [subTab, filterTier])

  const openEdit = (entry) => {
    setEditEntry(entry)
    setEditVal(String(entry.salary_amount ?? ""))
    setSaveMsg("")
  }

  const saveLadder = async () => {
    if (!editEntry) return
    setSaving(true)
    setSaveMsg("")
    try {
      await apiAuth(`/hr/salary-ladder/${editEntry.id}`, {
        method: "PATCH",
        body: { salary_amount: parseFloat(editVal) },
      })
      setSaveMsg("✅ บันทึกสำเร็จ")
      setTimeout(() => {
        setEditEntry(null)
        fetchLadder(filterTier)
      }, 600)
    } catch (err) {
      setSaveMsg(`❌ ${err.message || "บันทึกไม่สำเร็จ"}`)
    } finally {
      setSaving(false)
    }
  }

  const awardStep = async () => {
    if (!empId) return setStepMsg("⚠️ กรุณากรอกรหัสพนักงาน")
    setAwardingStep(true)
    setStepMsg("")
    try {
      await apiAuth(`/hr/employees/${empId}/salary-step-award`, {
        method: "POST",
        body: { step: parseFloat(stepAward) },
      })
      setStepMsg("✅ เลื่อนขั้นสำเร็จ")
      setEmpId("")
    } catch (err) {
      setStepMsg(`❌ ${err.message || "ไม่สำเร็จ"}`)
    } finally {
      setAwardingStep(false)
    }
  }

  const loadHistory = async () => {
    if (!histEmpId) return setHistError("⚠️ กรุณากรอกรหัสพนักงาน")
    setLoadingHist(true)
    setHistError("")
    try {
      const data = await apiAuth(`/hr/employees/${histEmpId}/salary-history`)
      setHistory(data || [])
    } catch (err) {
      setHistError(err.message || "โหลดไม่สำเร็จ")
      setHistory([])
    } finally {
      setLoadingHist(false)
    }
  }

  // Group ladder by tier for display
  const tiers = [...new Set(ladder.map((e) => e.position_tier))].sort()

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit flex-wrap">
        {[["ladder", "บันไดเงินเดือน"], ["step", "เลื่อนขั้น"], ["history", "ประวัติ"]].map(([v, label]) => (
          <button key={v} onClick={() => setSubTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${subTab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* บันไดเงินเดือน */}
      {subTab === "ladder" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">ระดับตำแหน่ง (tier)</label>
            <input
              type="text"
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              placeholder="เช่น A, B, ก, ข ..."
              className={inputCls + " max-w-48"}
            />
          </div>
        {loadingLadder ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
          </div>
        ) : !filterTier ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">กรุณาระบุ tier เพื่อดูบันไดเงินเดือน</p>
        ) : (
          <div className="space-y-4">
            {tiers.map((tier) => {
              const rows = ladder.filter((e) => e.position_tier === tier).sort((a, b) => a.level - b.level)
              return (
                <div key={tier} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">ระดับตำแหน่ง: {tier}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">ขั้น</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">เงินเดือน (บาท)</th>
                          <th className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 w-20"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {rows.map((e) => (
                          <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">ขั้นที่ {e.level}</td>
                            <td className="px-4 py-2 text-right font-bold text-emerald-700 dark:text-emerald-300">{fmt(e.salary_amount)}</td>
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => openEdit(e)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">แก้ไข</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </div>
      )}

      {/* เลื่อนขั้นเงินเดือน */}
      {subTab === "step" && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-6 space-y-4 max-w-sm">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">เลื่อนขั้นเงินเดือน</h3>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">รหัสพนักงาน</label>
            <input type="text" value={empId} onChange={(e) => setEmpId(e.target.value)} className={inputCls} placeholder="กรอกรหัสพนักงาน" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">จำนวนขั้นที่เลื่อน</label>
            <select value={stepAward} onChange={(e) => setStepAward(e.target.value)} className={inputCls}>
              <option value="0">0 (ไม่เลื่อน)</option>
              <option value="0.5">0.5 ขั้น</option>
              <option value="1.0">1.0 ขั้น</option>
            </select>
          </div>
          {stepMsg && (
            <p className={`text-sm font-medium ${stepMsg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{stepMsg}</p>
          )}
          <button onClick={awardStep} disabled={awardingStep}
            className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
            {awardingStep ? "กำลังดำเนินการ..." : "เลื่อนขั้น"}
          </button>
        </div>
      )}

      {/* ประวัติเงินเดือน */}
      {subTab === "history" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input type="text" value={histEmpId} onChange={(e) => setHistEmpId(e.target.value)} className={inputCls + " max-w-xs"} placeholder="กรอกรหัสพนักงาน" />
            <button onClick={loadHistory} disabled={loadingHist}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer disabled:opacity-60">
              ค้นหา
            </button>
          </div>
          {histError && <p className="text-sm text-red-600 dark:text-red-400">{histError}</p>}
          {loadingHist ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
            </div>
          ) : history.length > 0 ? (
            <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">วันที่</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">เงินเดือนเดิม</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">เงินเดือนใหม่</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">เหตุผล</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {history.map((h, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {h.effective_date ? new Date(h.effective_date).toLocaleDateString("th-TH") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{fmt(h.old_salary)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-300">{fmt(h.new_salary)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{h.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : histEmpId && !loadingHist ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">ไม่พบข้อมูลประวัติเงินเดือน</p>
          ) : null}
        </div>
      )}

      {/* Edit Modal */}
      {editEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">แก้ไขเงินเดือน</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ระดับตำแหน่ง <span className="font-semibold text-gray-900 dark:text-gray-100">{editEntry.position_tier}</span>{" "}
              ขั้นที่ <span className="font-semibold text-gray-900 dark:text-gray-100">{editEntry.level}</span>
            </p>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">จำนวนเงิน (บาท)</label>
              <input type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)} className={inputCls} />
            </div>
            {saveMsg && <p className={`text-sm text-center ${saveMsg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{saveMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setEditEntry(null)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
              <button onClick={saveLadder} disabled={saving} className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
