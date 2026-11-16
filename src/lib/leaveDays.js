// Decimal-safe helpers for leave days (api-handoff payment-1, backend v1.1.0/v1.2.0).
//
// The cooperative records half-days, so every leave/quota number is a decimal
// serialised as a string ("30.0", "6.5"). Never parseInt these values — always
// go through parseDays()/fmtDays() so ".5" survives and ".0" stays tidy.
//
// The fiscal year runs 1 April – 31 March, labelled by the BE year it starts in.
// Weekends and declared holidays are excluded from every leave day count —
// except ลาคลอด, which counts calendar days (ระเบียบ 10 ข้อ 51 ค, backend PR #39):
// to − from + 1, weekends and holidays included.

import { getFiscalYearBeStart } from "./debtFiscalYear"

/** BE fiscal year (Apr–Mar) for a date. FY2569 = 1 Apr 2026 – 31 Mar 2027. */
export function currentFiscalYearBE(date = new Date()) {
  return getFiscalYearBeStart(date)
}

/** Decimal-safe parse. Accepts "6.5" | 6.5 | null → number | null. */
export function parseDays(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Display a day count: null → "—", 6.0 → "6", 6.5 → "6.5". */
export function fmtDays(v) {
  const n = parseDays(v)
  if (n == null) return "—"
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Same as fmtDays but with the unit appended. */
export function fmtDaysUnit(v) {
  const s = fmtDays(v)
  return s === "—" ? s : `${s} วัน`
}

/** "HH:MM[:SS]" → minutes since midnight | null */
function timeToMin(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? ""))
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/**
 * ระยะเวลาลาแบบภาษาคน: 0.5 → "ครึ่งวันเช้า" / "ครึ่งวันบ่าย" (ดูจาก from_time; ไม่รู้เวลา → "ครึ่งวัน"),
 * 1 → "1 วัน", 1.5 → "วันครึ่ง", 2.5 → "2 วันครึ่ง". null → "—"
 * ค่าที่ไม่ใช่ทีละครึ่งวัน (ไม่ควรเกิด) แสดงเป็นตัวเลขตามเดิม
 */
export function fmtLeaveDuration(v, { fromTime, toTime } = {}) {
  const n = parseDays(v)
  if (n == null) return "—"
  if (!isHalfStep(n) || n <= 0) return `${fmtDays(n)} วัน`
  const whole = Math.floor(n)
  if (whole === n) return `${whole} วัน`
  if (whole === 0) {
    const from = timeToMin(fromTime)
    const to = timeToMin(toTime)
    if (from != null) return from < 12 * 60 ? "ครึ่งวันเช้า" : "ครึ่งวันบ่าย"
    if (to != null) return to <= 12 * 60 ? "ครึ่งวันเช้า" : "ครึ่งวันบ่าย"
    return "ครึ่งวัน"
  }
  return whole === 1 ? "วันครึ่ง" : `${whole} วันครึ่ง`
}

/** shortcut สำหรับแถวใบลาจาก backend ({ total_days, from_time, to_time }) */
export function fmtLeaveRowDuration(r) {
  return fmtLeaveDuration(r?.total_days, { fromTime: r?.from_time, toTime: r?.to_time })
}

/** Leave days must be multiples of 0.5 — anything else 422s at the backend. */
export function isHalfStep(v) {
  const n = parseDays(v)
  return n != null && Math.abs(n * 2 - Math.round(n * 2)) < 1e-9
}

function parseISO(iso) {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** ชื่อ "key" ของประเภทการลา (`Leaves.type`) — ใช้กับ logic/การจับคู่ ห้ามเอาชื่อที่ HR ตั้งใหม่มาใช้แทน */
export const leaveTypeName = (lt) =>
  typeof lt === "string" ? lt : lt?.leave_name ?? lt?.type ?? lt?.name ?? lt?.title ?? lt?.label ?? ""

/**
 * ชื่อที่แสดงบนหน้าจอ — `display_name` ที่ HR ตั้ง (um_backend PR 93, `PATCH /hr/leave-types/{id}`)
 * ถ้าไม่มีใช้ชื่อ key. แสดงผลอย่างเดียว ห้ามใช้จับคู่ logic
 */
export const leaveTypeLabel = (lt) =>
  (typeof lt === "object" && String(lt?.display_name ?? "").trim()) || leaveTypeName(lt)

/**
 * True when a leave type is counted in calendar days rather than working days.
 * Only ลาคลอด (ระเบียบ 10 ข้อ 51 ค). Matched on the type's name or code — never on
 * a hard-coded id, which differs between environments.
 *
 * @param {object|string} leaveType  row from GET /hr/leave-types, or its name
 */
export function countsCalendarDays(leaveType) {
  const name = leaveTypeName(leaveType)
  const code = typeof leaveType === "object" ? String(leaveType?.code ?? leaveType?.key ?? "") : ""
  return /ลาคลอด/.test(name) || /^(maternity|maturity)/i.test(code)
}

/**
 * Client-side preview of the day count the backend will compute.
 * Excludes Saturdays, Sundays and declared holidays; a half day counts as 0.5.
 * With `calendarDays` (ลาคลอด) every day in the range counts.
 *
 * @param {object}   o
 * @param {string}   o.from          ISO date "YYYY-MM-DD"
 * @param {string}   o.to            ISO date "YYYY-MM-DD"
 * @param {boolean}  o.isHalfDay     same-day request counted as 0.5
 * @param {Array}    o.holidays      HolidayOut[] — only `holiday_date` is read
 * @param {boolean}  o.calendarDays  count weekends and holidays too (see countsCalendarDays)
 * @returns {number} days in the range
 */
export function countLeaveDays({ from, to, isHalfDay = false, holidays = [], calendarDays = false }) {
  const start = parseISO(from)
  const end = parseISO(to || from)
  if (!start || !end || end < start) return 0

  const closed = new Set((holidays || []).filter((h) => h?.is_active !== false).map((h) => h.holiday_date))

  let days = 0
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!calendarDays) {
      const dow = d.getDay() // 0 = Sun, 6 = Sat
      if (dow === 0 || dow === 6) continue
      if (closed.has(toISO(d))) continue
    }
    days += 1
  }

  // A same-day request marked as half counts as 0.5 — but only if that day
  // was a working day to begin with.
  if (isHalfDay && days > 0 && from === (to || from)) return 0.5
  return days
}

/** True when the date falls on a weekend or a declared holiday. */
export function isNonWorkingDay(iso, holidays = []) {
  const d = parseISO(iso)
  if (!d) return false
  if (d.getDay() === 0 || d.getDay() === 6) return true
  return (holidays || []).some((h) => h?.is_active !== false && h.holiday_date === iso)
}
