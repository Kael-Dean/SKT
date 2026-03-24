// src/pages/work/MyRelocation.jsx
// คำขอย้ายสาขา — GET/PUT /personnel/me/relocation + GET /personnel/me/relocations
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../lib/api"
import SelectDropdown from "../../components/SelectDropdown"

const STATUS_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", denied: "ปฏิเสธ", cancelled: "ยกเลิกแล้ว" }
const STATUS_COLOR = {
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  denied:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
}

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH") } catch { return d }
}

export default function MyRelocation() {
  const [tab, setTab] = useState("form")

  // Branches for dropdown
  const [branches, setBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(true)

  // Form state
  const [form, setForm] = useState({ requested_branch_id: "", reason: "" })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState("")

  // History state
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState("")

  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => setBranches(Array.isArray(data) ? data : (data?.branches ?? [])))
      .catch(() => setBranches([]))
      .finally(() => setLoadingBranches(false))
  }, [])

  const fetchHistory = useCallback(() => {
    setLoadingHistory(true)
    setHistoryError("")
    apiAuth("/personnel/me/relocations")
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch((e) => setHistoryError(e.message || "โหลดประวัติไม่สำเร็จ"))
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => {
    if (tab === "history") fetchHistory()
  }, [tab, fetchHistory])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError("")
    setSubmitting(true)
    try {
      const body = { requested_branch_id: parseInt(form.requested_branch_id) }
      if (form.reason.trim()) body.reason = form.reason.trim()
      await apiAuth("/personnel/me/relocation", { method: "PUT", body })
      setSubmitted(true)
    } catch (err) {
      if (err.status === 409) {
        setFormError("มีคำขอย้ายสาขาที่รออนุมัติอยู่แล้ว กรุณารอผลก่อน")
      } else if (err.status === 400) {
        setFormError("ไม่สามารถยื่นคำขอย้ายไปสาขาปัจจุบันได้")
      } else {
        setFormError(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const selectedBranch = branches.find((b) => String(b.id) === String(form.requested_branch_id))

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-md ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-8 text-center space-y-4">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-3xl">
            ✅
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ยื่นคำขอย้ายสาขาสำเร็จ!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">คำขอของคุณถูกส่งแล้ว รอ HR อนุมัติ</p>
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-4 text-left space-y-1.5 text-sm">
            <p><span className="font-semibold">สาขาที่ขอ:</span> {selectedBranch?.name ?? selectedBranch?.branch_name ?? "—"}</p>
            {form.reason && <p><span className="font-semibold">เหตุผล:</span> {form.reason}</p>}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setSubmitted(false); setForm({ requested_branch_id: "", reason: "" }) }}
              className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition cursor-pointer"
            >
              ยื่นคำขอใหม่
            </button>
            <button
              onClick={() => { setSubmitted(false); setTab("history") }}
              className="flex-1 h-11 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
            >
              ดูประวัติ
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">คำขอย้ายสาขา</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ยื่นคำขอย้ายสาขาและติดตามสถานะ</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["form", "ยื่นคำขอ"], ["history", "ประวัติ"]].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${tab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "form" && (
        <>
          {formError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              ❌ {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                สาขาที่ต้องการย้าย <span className="text-red-500">*</span>
              </label>
              <SelectDropdown
                value={form.requested_branch_id}
                onChange={(val) => setForm((p) => ({ ...p, requested_branch_id: val }))}
                placeholder={loadingBranches ? "กำลังโหลด..." : "-- เลือกสาขา --"}
                loading={loadingBranches}
                options={branches.map((b) => ({ value: b.id, label: b.name ?? b.branch_name ?? `สาขา ${b.id}` }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                เหตุผลการย้ายสาขา
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="ระบุเหตุผลการขอย้ายสาขา (ถ้ามี)"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !form.requested_branch_id}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
            >
              {submitting ? "กำลังส่ง..." : "ยื่นคำขอย้ายสาขา"}
            </button>
          </form>
        </>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {loadingHistory ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
            </div>
          ) : historyError ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              ❌ {historyError}
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-12 text-center">
              <p className="text-3xl mb-3">🚌</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีประวัติคำขอย้ายสาขา</p>
            </div>
          ) : (
            history.map((r) => (
              <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-indigo-700 dark:text-indigo-300">
                    {r.requested_branch_name ?? r.branch_name ?? `สาขา ${r.requested_branch_id}`}
                  </p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {r.created_at && (
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">วันที่ยื่น</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(r.created_at)}</p>
                    </div>
                  )}
                  {r.effective_date && (
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">วันที่มีผล</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(r.effective_date)}</p>
                    </div>
                  )}
                </div>
                {r.reason && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                    เหตุผล: {r.reason}
                  </p>
                )}
                {r.hr_comment && (
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-1.5">
                    ความเห็น HR: {r.hr_comment}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
