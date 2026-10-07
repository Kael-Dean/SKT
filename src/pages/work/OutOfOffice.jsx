// src/pages/work/OutOfOffice.jsx
// 3O ขอออกนอกสถานที่ — ฝั่งพนักงาน: ยื่นคำขอ + ดูรายการของฉัน + ยกเลิก
// Spec: handoff/api-handoff-payment-2.md §1 (approval chain) + §2 (3O)
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import {
  OOO_TYPE_LABEL,
  STATUS_LABEL,
  statusTone,
  isPendingStatus,
  hhmm,
} from "../../lib/approval"
import Portal from "../../components/Portal"
import SelectDropdown from "../../components/SelectDropdown"
import { Skeleton, ErrorState, EmptyState } from "../../components/ui"
import useModalDismiss from "../../lib/useModalDismiss"

// ─── helpers ────────────────────────────────────────────────────────────────
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
]
const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"]

/** "YYYY-MM-DD" → parts (no timezone shift) */
function parseISODate(iso) {
  if (typeof iso !== "string") return null
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

/** "2026-11-02" → "2 พ.ย. 2569" */
function fmtThaiShort(iso) {
  const p = parseISODate(iso)
  if (!p) return "—"
  return `${p.d} ${THAI_MONTHS_SHORT[p.m - 1]} ${p.y + 543}`
}

/** "2026-11-02" → "วันจันทร์ที่ 2 พฤศจิกายน 2569" */
function fmtThaiLong(iso) {
  const p = parseISODate(iso)
  if (!p) return ""
  const wd = new Date(p.y, p.m - 1, p.d).getDay()
  return `วัน${THAI_WEEKDAYS[wd]}ที่ ${p.d} ${THAI_MONTHS[p.m - 1]} ${p.y + 543}`
}

/** "HH:MM[:SS]" → minutes since midnight, or null */
function toMin(t) {
  if (typeof t !== "string" || t.length < 4) return null
  const [h, m] = t.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function fmtDuration(min) {
  if (min == null || min <= 0) return ""
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h} ชม. ${m} นาที`
  if (h) return `${h} ชม.`
  return `${m} นาที`
}

/** Request can still be cancelled: pending/approved and request_date+time_out in the future. */
function isCancellable(r) {
  if (!r) return false
  if (!(isPendingStatus(r.status) || r.status === "approved")) return false
  const p = parseISODate(r.request_date)
  const mins = toMin(r.time_out)
  if (!p || mins == null) return false
  const start = new Date(p.y, p.m - 1, p.d, Math.floor(mins / 60), mins % 60)
  return start.getTime() > Date.now()
}

const NEXT_STEP = {
  pending_branch_head: "คำขอถูกส่งให้หัวหน้าสาขาพิจารณาแล้ว",
  pending_assistant_manager: "คำขอถูกส่งให้ผู้ช่วยผู้จัดการพิจารณา แล้วผู้จัดการจะยืนยันอีกขั้น",
  pending_manager: "คำขอรอผู้จัดการยืนยัน",
  approved: "คำขอได้รับอนุมัติแล้ว",
}

// ─── styles (match LeaveRequest.jsx) ────────────────────────────────────────
const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
const inputErrCls = "border-red-400 dark:border-red-500 focus:ring-red-400"
const cardCls =
  "rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5"
const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"

const EMPTY_FORM = {
  request_type: "work",
  request_date: "",
  time_out: "",
  time_back: "",
  place: "",
  reason: "",
}

function Field({ id, label, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      ) : null}
    </div>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${statusTone(status)}`}>
      {STATUS_LABEL[status] || status || "—"}
    </span>
  )
}

/**
 * Workday strip: shows work hours, the chosen out→back span and where the
 * half-day ceiling falls. Purely informative — backend enforces the rules.
 */
function WorkdayStrip({ settings, timeOut, timeBack }) {
  const ws = toMin(settings?.work_start)
  const we = toMin(settings?.work_end)
  if (ws == null || we == null || we <= ws) return null
  const span = we - ws
  const o = toMin(timeOut)
  const b = toMin(timeBack)
  const hasSpan = o != null && b != null && b > o
  const pct = (m) => `${Math.min(100, Math.max(0, ((m - ws) / span) * 100))}%`
  const halfMin = Number(settings?.half_day_hours) > 0 ? Number(settings.half_day_hours) * 60 : null
  const outside = hasSpan && (o < ws || b > we)
  const tooLong = hasSpan && halfMin != null && b - o > halfMin

  return (
    <div className="mt-1">
      <div
        className="relative h-2.5 rounded-full bg-gray-100 dark:bg-gray-700/70 overflow-hidden"
        aria-hidden="true"
      >
        {hasSpan && (
          <div
            className={`absolute inset-y-0 rounded-full transition-all duration-200 ${outside || tooLong ? "bg-amber-500" : "bg-indigo-500"}`}
            style={{ left: pct(o), width: `calc(${pct(b)} - ${pct(o)})` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
        <span>{hhmm(settings.work_start)}</span>
        <span>{hhmm(settings.work_end)}</span>
      </div>
      {(outside || tooLong) && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          {outside
            ? "ช่วงเวลานี้อยู่นอกเวลาทำงาน ระบบอาจไม่รับคำขอ"
            : `เกินครึ่งวันทำงาน (${settings.half_day_hours} ชม.) — หากต้องออกนานกว่านี้ ให้ยื่นใบลาแทน`}
        </p>
      )}
    </div>
  )
}

// ─── page ───────────────────────────────────────────────────────────────────
export default function OutOfOffice() {
  const [now] = useState(() => new Date())
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [submitted, setSubmitted] = useState(null) // last created request

  const [settings, setSettings] = useState(null)

  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState("")

  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const { backdropProps: cancelBackdrop } = useModalDismiss(() => setCancelTarget(null), { open: !!cancelTarget, disabled: cancelling })
  const [cancelError, setCancelError] = useState("")
  const [notice, setNotice] = useState("")

  // Work-hour hint — optional, ignore failure (e.g. role 5 has no access)
  useEffect(() => {
    apiAuth("/hr/out-of-office/settings", { redirectOn401: false })
      .then((s) => setSettings(s || null))
      .catch(() => setSettings(null))
  }, [])

  const fetchList = useCallback(() => {
    setLoading(true)
    setListError("")
    const qs = new URLSearchParams()
    if (year) qs.set("year", year)
    if (year && month) qs.set("month", month)
    const q = qs.toString()
    apiAuth(`/personnel/me/out-of-office${q ? `?${q}` : ""}`)
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((e) => setListError(e.message || "โหลดรายการไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => { fetchList() }, [fetchList])

  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }))
    setSubmitError("")
  }

  const durationMin = useMemo(() => {
    const o = toMin(form.time_out)
    const b = toMin(form.time_back)
    return o != null && b != null && b > o ? b - o : null
  }, [form.time_out, form.time_back])

  const dateIsWeekend = useMemo(() => {
    const p = parseISODate(form.request_date)
    if (!p) return false
    const wd = new Date(p.y, p.m - 1, p.d).getDay()
    return wd === 0 || wd === 6
  }, [form.request_date])

  // Mirrors backend 422 rules (+ required fields)
  const validate = () => {
    const er = {}
    if (!["work", "personal"].includes(form.request_type)) er.request_type = "กรุณาเลือกประเภท"
    if (!form.request_date) er.request_date = "กรุณาเลือกวันที่"
    if (!form.time_out) er.time_out = "กรุณาระบุเวลาออก"
    if (!form.time_back) er.time_back = "กรุณาระบุเวลากลับ"
    if (form.time_out && form.time_back && toMin(form.time_back) <= toMin(form.time_out)) {
      er.time_back = "เวลากลับต้องหลังเวลาออก"
    }
    if (!form.place.trim()) er.place = "กรุณาระบุสถานที่"
    if (!form.reason.trim()) er.reason = "กรุณาระบุเหตุผล"
    return er
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const er = validate()
    setErrors(er)
    if (Object.keys(er).length) {
      const first = ["request_type", "request_date", "time_out", "time_back", "place", "reason"].find((k) => er[k])
      document.getElementById(`ooo-${first}`)?.focus()
      return
    }
    setSubmitting(true)
    setSubmitError("")
    setSubmitted(null)
    try {
      const res = await apiAuth("/personnel/me/out-of-office", {
        method: "POST",
        body: {
          request_type: form.request_type,
          request_date: form.request_date,
          time_out: form.time_out,
          time_back: form.time_back,
          place: form.place.trim(),
          reason: form.reason.trim(),
        },
      })
      setSubmitted(res || null)
      setForm(EMPTY_FORM)
      // jump the list to the request's month so the new row is visible
      const p = parseISODate(res?.request_date)
      if (p && (String(p.y) !== year || (month && String(p.m) !== month))) {
        setYear(String(p.y))
        setMonth(String(p.m))
      } else {
        fetchList()
      }
    } catch (err) {
      setSubmitError(err.message || "ส่งคำขอไม่สำเร็จ")
    } finally {
      setSubmitting(false)
    }
  }

  const openCancel = (r) => {
    setCancelTarget(r)
    setCancelError("")
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    setCancelError("")
    try {
      await apiAuth(`/personnel/me/out-of-office/${cancelTarget.id}/cancel`, { method: "POST" })
      setCancelTarget(null)
      setNotice("ยกเลิกคำขอแล้ว")
      fetchList()
    } catch (err) {
      if (err.status === 403 || err.status === 409) {
        setCancelTarget(null)
        setNotice("")
        setListError(err.message || "ยกเลิกไม่ได้")
        fetchList()
      } else {
        setCancelError(err.message || "ยกเลิกไม่สำเร็จ")
      }
    } finally {
      setCancelling(false)
    }
  }

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(""), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return [y + 1, y, y - 1, y - 2].map((v) => ({ value: String(v), label: `พ.ศ. ${v + 543}` }))
  }, [])
  const monthOptions = useMemo(
    () => [{ value: "", label: "ทั้งปี" }, ...THAI_MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))],
    [],
  )

  const errProps = (k) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `ooo-${k}-err` : undefined,
  })

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-5 pb-12">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ขอออกนอกสถานที่</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            ออกนอกสถานที่ระหว่างวันทำงานได้ไม่เกินครึ่งวัน ถ้านานกว่านั้นให้ยื่นใบลา
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] items-start">
          {/* ══════════ FORM ══════════ */}
          <form onSubmit={handleSubmit} noValidate className={`${cardCls} space-y-4`} aria-labelledby="ooo-form-title">
            <h2 id="ooo-form-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              ยื่นคำขอใหม่
            </h2>

            <fieldset>
              <legend className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                ประเภท<span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {["work", "personal"].map((t) => {
                  const active = form.request_type === t
                  return (
                    <label
                      key={t}
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                        active
                          ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-200"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <input
                        id={t === "work" ? "ooo-request_type" : undefined}
                        type="radio"
                        name="request_type"
                        value={t}
                        checked={active}
                        onChange={set("request_type")}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <span className="leading-snug">{t === "work" ? "ไปปฏิบัติงาน" : "ธุระส่วนตัว"}</span>
                    </label>
                  )
                })}
              </div>
              {errors.request_type && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.request_type}</p>
              )}
            </fieldset>

            <Field
              id="ooo-request_date"
              label="วันที่ออก"
              required
              error={errors.request_date}
              hint={form.request_date ? fmtThaiLong(form.request_date) + (dateIsWeekend ? " — วันหยุดสุดสัปดาห์" : "") : undefined}
            >
              <input
                id="ooo-request_date"
                type="date"
                className={`${inputCls} ${errors.request_date ? inputErrCls : ""}`}
                value={form.request_date}
                onChange={set("request_date")}
                {...errProps("request_date")}
                aria-describedby={errors.request_date ? "ooo-request_date-err" : form.request_date ? "ooo-request_date-hint" : undefined}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="ooo-time_out" label="เวลาออก (น.)" required error={errors.time_out}>
                <input
                  id="ooo-time_out"
                  type="time"
                  className={`${inputCls} tabular-nums ${errors.time_out ? inputErrCls : ""}`}
                  value={form.time_out}
                  onChange={set("time_out")}
                  {...errProps("time_out")}
                />
              </Field>
              <Field id="ooo-time_back" label="เวลากลับ (น.)" required error={errors.time_back}>
                <input
                  id="ooo-time_back"
                  type="time"
                  className={`${inputCls} tabular-nums ${errors.time_back ? inputErrCls : ""}`}
                  value={form.time_back}
                  min={form.time_out || undefined}
                  onChange={set("time_back")}
                  {...errProps("time_back")}
                />
              </Field>
            </div>

            <div className="-mt-1 space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
                {durationMin
                  ? <>รวม <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{fmtDuration(durationMin)}</span></>
                  : settings
                    ? <>เวลาทำงาน <span className="tabular-nums">{hhmm(settings.work_start)}–{hhmm(settings.work_end)} น.</span> · ไม่เกิน <span className="tabular-nums">{settings.half_day_hours}</span> ชม.</>
                    : "ระบุเวลาออกและเวลากลับ"}
              </p>
              {settings && <WorkdayStrip settings={settings} timeOut={form.time_out} timeBack={form.time_back} />}
            </div>

            <Field id="ooo-place" label="สถานที่" required error={errors.place}>
              <input
                id="ooo-place"
                type="text"
                maxLength={255}
                className={`${inputCls} ${errors.place ? inputErrCls : ""}`}
                value={form.place}
                onChange={set("place")}
                placeholder="เช่น สำนักงาน ธ.ก.ส. สาขาสุรินทร์"
                {...errProps("place")}
              />
            </Field>

            <Field id="ooo-reason" label="เหตุผล" required error={errors.reason}>
              <textarea
                id="ooo-reason"
                rows={3}
                className={`${inputCls} resize-y ${errors.reason ? inputErrCls : ""}`}
                value={form.reason}
                onChange={set("reason")}
                placeholder="ไปทำอะไร"
                {...errProps("reason")}
              />
            </Field>

            {submitError && (
              <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {submitError}
              </p>
            )}

            {submitted && (
              <div role="status" className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800/50 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-200">ส่งคำขอแล้ว</span>
                  <StatusBadge status={submitted.status} />
                </div>
                <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                  {NEXT_STEP[submitted.status] || "ติดตามสถานะได้ในรายการคำขอ"}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${focusRing} focus-visible:ring-indigo-500`}
            >
              {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
              {submitting ? "กำลังส่ง..." : "ส่งคำขอ"}
            </button>
          </form>

          {/* ══════════ MY REQUESTS ══════════ */}
          <section className={`${cardCls} space-y-4`} aria-labelledby="ooo-list-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="ooo-list-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                คำขอของฉัน
                {!loading && !listError && (
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400 tabular-nums">{items.length} รายการ</span>
                )}
              </h2>
              <div className="flex gap-2">
                <div className="w-36">
                  <SelectDropdown options={monthOptions} value={month} onChange={setMonth} placeholder="เดือน" />
                </div>
                <div className="w-32">
                  <SelectDropdown options={yearOptions} value={year} onChange={setYear} placeholder="ปี" />
                </div>
              </div>
            </div>

            {notice && (
              <p role="status" className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {notice}
              </p>
            )}
            {listError && <ErrorState message={listError} onRetry={fetchList} />}

            {loading ? (
              <div className="space-y-3" aria-busy="true" aria-label="กำลังโหลดรายการ">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : !listError && items.length === 0 ? (
              <EmptyState
                title="ไม่มีคำขอในช่วงนี้"
                description={`ยังไม่มีคำขอออกนอกสถานที่ใน${month ? `เดือน${THAI_MONTHS[Number(month) - 1]} ` : "ปี "}พ.ศ. ${Number(year) + 543} ยื่นคำขอได้จากฟอร์มด้านซ้าย`}
              />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700/70">
                {items.map((r) => (
                  <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                            {fmtThaiShort(r.request_date)}
                            <span className="ml-2 font-normal text-gray-600 dark:text-gray-300">
                              {hhmm(r.time_out)}–{hhmm(r.time_back)} น.
                            </span>
                          </p>
                          <StatusBadge status={r.status} />
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                          <span className="text-gray-500 dark:text-gray-400">{OOO_TYPE_LABEL[r.request_type] || r.request_type}</span>
                          {" · "}
                          {r.place}
                        </p>
                        {r.reason && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 break-words line-clamp-2" title={r.reason}>
                            {r.reason}
                          </p>
                        )}
                        {r.reject_reason && (
                          <p className="rounded-lg bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 text-sm text-rose-700 dark:text-rose-300 break-words">
                            เหตุผลที่ไม่อนุมัติ: {r.reject_reason}
                          </p>
                        )}
                      </div>
                      {isCancellable(r) && (
                        <button
                          type="button"
                          onClick={() => openCancel(r)}
                          className={`shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-300 transition-colors duration-200 cursor-pointer ${focusRing} focus-visible:ring-red-500`}
                          aria-label={`ยกเลิกคำขอวันที่ ${fmtThaiShort(r.request_date)} เวลา ${hhmm(r.time_out)}`}
                        >
                          ยกเลิก
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Cancel confirm */}
      {cancelTarget && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            {...cancelBackdrop}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ooo-cancel-title"
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4"
            >
              <h3 id="ooo-cancel-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                ยกเลิกคำขอนี้?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                คำขอออกนอกสถานที่วันที่{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  {fmtThaiShort(cancelTarget.request_date)} {hhmm(cancelTarget.time_out)}–{hhmm(cancelTarget.time_back)} น.
                </span>{" "}
                ({cancelTarget.place}) จะถูกยกเลิก และเปิดใหม่ไม่ได้
              </p>
              {cancelError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">{cancelError}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setCancelTarget(null)}
                  disabled={cancelling}
                  className={`flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer disabled:opacity-60 ${focusRing} focus-visible:ring-indigo-500`}
                >
                  เก็บไว้
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className={`flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-60 ${focusRing} focus-visible:ring-red-500`}
                >
                  {cancelling && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                  {cancelling ? "กำลังยกเลิก..." : "ยกเลิกคำขอ"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
