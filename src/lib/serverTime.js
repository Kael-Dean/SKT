// src/lib/serverTime.js
// เวลาจาก backend — ตัวช่วยกลาง (handoff SS-04 / PR #115)
//
// backend ส่ง date_time / created_at / *_at เป็น UTC แบบไม่มี offset ("2026-11-27T08:44:59.171864")
// `new Date()` ตรง ๆ จะอ่านเป็นเวลาท้องถิ่นของเบราว์เซอร์ → แสดงช้าไป 7 ชม.
// กติกา: ISO ที่มีเวลาแต่ไม่มี Z / ±hh:mm = UTC · แสดงผลใน Asia/Bangkok เสมอ
// ค่าวันที่ล้วน "YYYY-MM-DD" = วันในปฏิทิน (ไม่เลื่อนตาม timezone)

export const TZ = "Asia/Bangkok"

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const HAS_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/
const HAS_OFFSET = /(Z|[+-]\d{2}(:?\d{2})?)$/i

/** ค่าจาก backend → Date (null ถ้าอ่านไม่ได้) */
export function parseServerTime(v) {
  if (v == null || v === "") return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === "number") return new Date(v)
  const s = String(v).trim()
  const m = s.match(DATE_ONLY)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const iso = HAS_TIME.test(s) && !HAS_OFFSET.test(s) ? `${s.replace(" ", "T")}Z` : s
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** epoch ms (NaN ถ้าอ่านไม่ได้) — ใช้คำนวณ "x นาทีที่แล้ว" / เรียงลำดับ */
export const serverTimeMs = (v) => parseServerTime(v)?.getTime() ?? NaN

const DEFAULT_DT = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }

/** วันเวลาไทย เช่น "27 พ.ย. 2569 16:00" — fallback = ค่าเดิม (หรือ "—" เมื่อว่าง) */
export function fmtServerDateTime(v, opts = DEFAULT_DT, fallback) {
  if (v == null || v === "") return fallback ?? "—"
  const d = parseServerTime(v)
  if (!d) return fallback ?? String(v)
  const s = String(v)
  // วันที่ล้วนไม่มีเวลาให้แสดง → แสดงเฉพาะวัน
  if (DATE_ONLY.test(s)) {
    const { hour: _h, minute: _m, timeStyle: _t, ...dateOpts } = opts
    return d.toLocaleDateString("th-TH", dateOpts)
  }
  return d.toLocaleString("th-TH", { ...opts, timeZone: TZ })
}

/** วันที่ไทยของค่าจาก backend (ตัดเวลา แต่ตัดตามวันในไทย) */
export function fmtServerDate(v, opts = { day: "numeric", month: "short", year: "numeric" }, fallback) {
  if (v == null || v === "") return fallback ?? "—"
  const d = parseServerTime(v)
  if (!d) return fallback ?? String(v)
  return DATE_ONLY.test(String(v)) ? d.toLocaleDateString("th-TH", opts) : d.toLocaleDateString("th-TH", { ...opts, timeZone: TZ })
}

/** "YYYY-MM-DD" ของวันในไทย จากค่าเวลา backend */
export function bangkokDay(v) {
  if (typeof v === "string" && DATE_ONLY.test(v.trim())) return v.trim()
  const d = parseServerTime(v)
  return d ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d) : ""
}
