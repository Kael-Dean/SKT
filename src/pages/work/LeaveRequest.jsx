// src/pages/LeaveRequest.jsx
// ยื่นใบลา — ดึงประเภทการลาจาก GET /hr/leave-types
import { useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import { getUser } from "../../lib/auth"

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"

const selectCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"

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

export default function LeaveRequest() {
  const user = getUser() || {}

  const [leaveTypes, setLeaveTypes] = useState([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  const [form, setForm] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    apiAuth("/hr/leave-types")
      .then(setLeaveTypes)
      .catch(() => setLeaveTypes([]))
      .finally(() => setLoadingTypes(false))
  }, [])

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const days = diffDays(form.start_date, form.end_date)

  const selectedType = leaveTypes.find((t) => String(t.id) === String(form.leave_type_id))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (days < 1) {
      setError("วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น")
      return
    }
    if (selectedType && days > selectedType.days) {
      setError(`ประเภทการลานี้มีสิทธิ์สูงสุด ${selectedType.days} วันต่อปี แต่คุณเลือก ${days} วัน`)
      return
    }

    setSubmitting(true)
    try {
      // TODO: เชื่อม POST /hr/leave-request เมื่อ backend พร้อม
      await new Promise((res) => setTimeout(res, 800)) // mock
      setSubmitted(true)
    } catch (err) {
      setError(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setSubmitting(false)
    }
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
            <p><span className="font-semibold">วันที่:</span> {form.start_date} – {form.end_date}</p>
            <p><span className="font-semibold">จำนวน:</span> {days} วัน</p>
          </div>
          <button
            onClick={() => {
              setSubmitted(false)
              setForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" })
            }}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition"
          >
            ยื่นใบลาอีกครั้ง
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ยื่นใบลา</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {user.username ? `สวัสดีคุณ ${user.username} — ` : ""}กรุณากรอกข้อมูลการลา
        </p>
      </div>

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
          <select
            className={selectCls}
            value={form.leave_type_id}
            onChange={set("leave_type_id")}
            required
            disabled={loadingTypes}
          >
            <option value="">{loadingTypes ? "กำลังโหลด..." : "-- เลือกประเภทการลา --"}</option>
            {leaveTypes.map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.type} (สูงสุด {lt.days} วัน/ปี)
              </option>
            ))}
          </select>
        </Field>

        <Field label="วันที่เริ่มลา" required>
          <input
            type="date"
            className={inputCls}
            value={form.start_date}
            onChange={set("start_date")}
            required
          />
        </Field>

        <Field label="วันที่สิ้นสุด" required>
          <input
            type="date"
            className={inputCls}
            value={form.end_date}
            min={form.start_date || undefined}
            onChange={set("end_date")}
            required
          />
        </Field>

        {days > 0 && (
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 text-sm text-indigo-700 dark:text-indigo-300">
            รวม <span className="font-bold">{days}</span> วัน
            {selectedType && days > selectedType.days && (
              <span className="ml-2 text-red-600 dark:text-red-400">
                (เกินสิทธิ์ {selectedType.days} วัน)
              </span>
            )}
          </div>
        )}

        <Field label="เหตุผล / รายละเอียด">
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={form.reason}
            onChange={set("reason")}
            placeholder="ระบุเหตุผลการลา (ถ้ามี)"
          />
        </Field>

        <button
          type="submit"
          disabled={submitting || !form.leave_type_id || !form.start_date || !form.end_date}
          className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm"
        >
          {submitting ? "กำลังส่ง..." : "ยื่นใบลา"}
        </button>
      </form>
    </div>
  )
}
