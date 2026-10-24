// src/lib/tenure.js
// ─────────────────────────────────────────────────────────────────────────────
// อายุงานระดับวัน (3G · PR 45, TOR §3.1) — backend คำนวณให้แล้วใน `tenure` ของ
//   GET /personnel/me · GET /hr/employees/{id} · GET /hr/personnel/{id}
//
//   tenure: { hired, until, ended, years, months, days, total_days, text } | null
//     null      = ยังไม่มีวันที่เริ่มงาน (personnel_info.hired ว่าง)
//     until     = วันนี้ หรือวันพ้นสภาพ (ended: true)
//     text      = "7 ปี 4 เดือน 19 วัน" (ปฏิทิน ไม่ใช่วันทำงาน)
//
// ห้ามใช้ financial.job_age (เลขปีเต็มที่ HR พิมพ์เอง) แสดงเป็นอายุงานอีก
// ─────────────────────────────────────────────────────────────────────────────

/** สร้างข้อความจากตัวเลข เมื่อ backend ไม่ส่ง text มา — "" ถ้าไม่มีตัวเลขเลย */
function textFromParts(t) {
  const parts = []
  if (Number(t.years) > 0) parts.push(`${t.years} ปี`)
  if (Number(t.months) > 0) parts.push(`${t.months} เดือน`)
  if (Number(t.days) > 0 || (parts.length === 0 && t.days != null)) parts.push(`${t.days ?? 0} วัน`)
  return parts.join(" ")
}

/**
 * อายุงานสำหรับแสดงผล — รับ profile (มี .tenure) หรือ tenure object ตรง ๆ
 * @param {object|null|undefined} source  profile ที่มี `tenure` หรือ tenure object
 * @param {{ fallback?: string, markEnded?: boolean }} [opts]
 * @returns {string} เช่น "7 ปี 4 เดือน 19 วัน" · "3 ปี 2 วัน (พ้นสภาพแล้ว)" · "—"
 */
export function tenureText(source, { fallback = "—", markEnded = true } = {}) {
  const t = getTenure(source)
  if (!t) return fallback
  const text = (typeof t.text === "string" && t.text.trim()) || textFromParts(t)
  if (!text) return fallback
  return markEnded && t.ended ? `${text} (พ้นสภาพแล้ว)` : text
}

/** tenure object จาก profile (หรือตัวมันเอง) — null ถ้าไม่มี */
export function getTenure(source) {
  if (!source || typeof source !== "object") return null
  const t = "tenure" in source ? source.tenure : source
  if (!t || typeof t !== "object") return null
  if (!("text" in t) && !("years" in t) && !("total_days" in t)) return null
  return t
}
