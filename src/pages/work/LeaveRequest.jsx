// src/pages/work/LeaveRequest.jsx
// ยื่นใบลา + ประวัติใบลา — PUT /personnel/me/leaves + GET /personnel/me/leaves
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../lib/api"
import { getUser } from "../../lib/auth"
import SelectDropdown from "../../components/SelectDropdown"

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"

const selectCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"

const STATUS_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", denied: "ปฏิเสธ", cancelled: "ยกเลิกแล้ว" }
const STATUS_COLOR = {
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  denied:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
}

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function diffDays(start, end) {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  if (e < s) return 0
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1
}

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH") } catch { return d }
}

export default function LeaveRequest() {
  const user = getUser() || {}

  const [tab, setTab] = useState("form")
  const [leaveTypes, setLeaveTypes] = useState([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  const [form, setForm] = useState({
    leave_type_id: "",
    from_date: "",
    to_date: "",
    comment: "",
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedData, setSubmittedData] = useState(null)
  const [error, setError] = useState("")

  // History tab state
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [cancellingId, setCancellingId] = useState(null)

  useEffect(() => {
    apiAuth("/hr/leave-types")
      .then(setLeaveTypes)
      .catch(() => setLeaveTypes([]))
      .finally(() => setLoadingTypes(false))
  }, [])

  const fetchHistory = useCallback(() => {
    setLoadingHistory(true)
    setHistoryError("")
    apiAuth("/personnel/me/leaves")
      .then(setHistory)
      .catch((e) => setHistoryError(e.message || "โหลดประวัติไม่สำเร็จ"))
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => {
    if (tab === "history") fetchHistory()
  }, [tab, fetchHistory])

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const days = diffDays(form.from_date, form.to_date)
  const selectedType = leaveTypes.find((t) => String(t.id) === String(form.leave_type_id))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (days < 1) {
      setError("วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น")
      return
    }

    setSubmitting(true)
    try {
      const body = {
        leave_type_id: parseInt(form.leave_type_id),
        from_date: form.from_date,
        to_date: form.to_date,
      }
      if (form.comment.trim()) body.comment = form.comment.trim()
      const result = await apiAuth("/personnel/me/leaves", { method: "PUT", body })
      setSubmittedData(result)
      setSubmitted(true)
    } catch (err) {
      const msg = err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่"
      if (err.status === 409) {
        setError("มีคำขอลาที่ทับซ้อนกับวันที่ที่เลือกอยู่แล้ว")
      } else if (err.status === 422) {
        setError(`ข้อมูลไม่ถูกต้อง: ${msg}`)
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (id) => {
    setCancellingId(id)
    try {
      await apiAuth(`/personnel/me/leaves/${id}/cancel`, { method: "POST", body: {} })
      fetchHistory()
    } catch (err) {
      alert(`ยกเลิกไม่สำเร็จ: ${err.message || "เกิดข้อผิดพลาด"}`)
    } finally {
      setCancellingId(null)
    }
  }

  const resetForm = () => {
    setSubmitted(false)
    setSubmittedData(null)
    setForm({ leave_type_id: "", from_date: "", to_date: "", comment: "" })
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-md ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-8 text-center space-y-4">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-3xl">
            ✅
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ยื่นใบลาสำเร็จ!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            คำขอลาของคุณถูกส่งแล้ว รอผู้บังคับบัญชาอนุมัติ
          </p>
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-4 text-left space-y-1.5 text-sm">
            <p><span className="font-semibold">ประเภทการลา:</span> {selectedType?.type}</p>
            <p><span className="font-semibold">วันที่:</span> {form.from_date} – {form.to_date}</p>
            <p><span className="font-semibold">จำนวน:</span> {days} วัน</p>
            {submittedData?.id && <p><span className="font-semibold">รหัสคำขอ:</span> #{submittedData.id}</p>}
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetForm}
              className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition cursor-pointer"
            >
              ยื่นใบลาอีกครั้ง
            </button>
            <button
              onClick={() => { resetForm(); setTab("history") }}
              className="flex-1 h-11 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
            >
              ดูประวัติใบลา
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ใบลา</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {user.username ? `สวัสดีคุณ ${user.username}` : ""}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["form", "ยื่นใบลา"], ["history", "ประวัติใบลา"]].map(([v, label]) => (
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
          {/* Leave type info cards */}
          {leaveTypes.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                สิทธิ์การลาประจำปี
              </p>
              <div className="grid grid-cols-1 gap-2">
                {leaveTypes.map((lt) => (
                  <div
                    key={lt.id}
                    className="flex items-center justify-between rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2"
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-200">{lt.type}</span>
                    <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      {lt.days} วัน/ปี
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-4">
            <Field label="ประเภทการลา" required>
              <SelectDropdown
                value={form.leave_type_id}
                onChange={(val) => setForm((prev) => ({ ...prev, leave_type_id: val }))}
                placeholder={loadingTypes ? "กำลังโหลด..." : "-- เลือกประเภทการลา --"}
                loading={loadingTypes}
                options={leaveTypes.map((lt) => ({ value: lt.id, label: `${lt.type} (สูงสุด ${lt.days} วัน/ปี)` }))}
              />
            </Field>

            <Field label="วันที่เริ่มลา" required>
              <input
                type="date"
                className={inputCls}
                value={form.from_date}
                onChange={set("from_date")}
                required
              />
            </Field>

            <Field label="วันที่สิ้นสุด" required>
              <input
                type="date"
                className={inputCls}
                value={form.to_date}
                min={form.from_date || undefined}
                onChange={set("to_date")}
                required
              />
            </Field>

            {days > 0 && (
              <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 text-sm text-indigo-700 dark:text-indigo-300">
                รวม <span className="font-bold">{days}</span> วัน
                {selectedType && days > selectedType.days && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    (เกินสิทธิ์ {selectedType.days} วัน — จะหักจากเงินเดือน)
                  </span>
                )}
              </div>
            )}

            <Field label="เหตุผล / รายละเอียด">
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={form.comment}
                onChange={set("comment")}
                placeholder="ระบุเหตุผลการลา (ถ้ามี)"
              />
            </Field>

            <button
              type="submit"
              disabled={submitting || !form.leave_type_id || !form.from_date || !form.to_date}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
            >
              {submitting ? "กำลังส่ง..." : "ยื่นใบลา"}
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
              <p className="text-3xl mb-3">📋</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีประวัติใบลา</p>
            </div>
          ) : (
            history.map((r) => (
              <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{r.leave_type_name}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </div>
                  {r.status === "pending" && (
                    <button
                      onClick={() => handleCancel(r.id)}
                      disabled={cancellingId === r.id}
                      className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      {cancellingId === r.id ? "กำลังยกเลิก..." : "ยกเลิก"}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">ช่วงวันลา</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(r.from_date)} – {fmtDate(r.to_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">จำนวนวัน</p>
                    <p className="font-bold text-indigo-700 dark:text-indigo-300">{r.total_days} วัน</p>
                  </div>
                </div>
                {r.comment && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                    เหตุผล: {r.comment}
                  </p>
                )}
                {r.hr_comment && (
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-1.5">
                    ความเห็น HR: {r.hr_comment}
                  </p>
                )}
                {r.extra_leave_days > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-1.5">
                    ⚠️ ลาเกินสิทธิ์ {r.extra_leave_days} วัน — หักจากเงินเดือน
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
