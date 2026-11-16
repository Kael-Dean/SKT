// src/lib/age.js
// ─────────────────────────────────────────────────────────────────────────────
// อายุ (ปีเต็ม) คำนวณจากวันเกิด ณ วันนี้
//
// ค่า `age` / `spouse_age` ที่ backend ส่งมาเป็นเลขที่ HR พิมพ์เองตอนบันทึก
// แล้วไม่ถูกอัปเดตตามเวลา → ปีถัดไปอายุจะค้าง/ไม่ตรงกับวันเกิด
// หน้าเว็บจึงคำนวณจากวันเกิดก่อนเสมอ และใช้เลขที่เก็บไว้เป็น fallback
// เฉพาะเมื่อไม่มีวันเกิด (เหมือน tenure.js ที่เลิกใช้ job_age)
// ─────────────────────────────────────────────────────────────────────────────

/** แยก y/m/d จากวันเกิด ("YYYY-MM-DD", ISO datetime หรือ Date) — null ถ้าอ่านไม่ได้ */
function parseBirthday(birthday) {
  if (!birthday) return null
  if (birthday instanceof Date) {
    if (Number.isNaN(birthday.getTime())) return null
    return { y: birthday.getFullYear(), m: birthday.getMonth() + 1, d: birthday.getDate() }
  }
  const match = String(birthday).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!match) return null
  let y = Number(match[1])
  // กันกรณีบันทึกเป็นปี พ.ศ. มา (เช่น 2521-04-21)
  if (y > 2400) y -= 543
  return { y, m: Number(match[2]), d: Number(match[3]) }
}

/**
 * อายุเต็มปีจากวันเกิด
 * @param {string|Date|null|undefined} birthday
 * @param {Date} [asOf] วันที่อ้างอิง (default วันนี้)
 * @returns {number|null} null ถ้าไม่มี/อ่านวันเกิดไม่ได้ หรือวันเกิดอยู่ในอนาคต
 */
export function ageFromBirthday(birthday, asOf = new Date()) {
  const b = parseBirthday(birthday)
  if (!b) return null
  let age = asOf.getFullYear() - b.y
  const beforeBirthday =
    asOf.getMonth() + 1 < b.m || (asOf.getMonth() + 1 === b.m && asOf.getDate() < b.d)
  if (beforeBirthday) age -= 1
  return age >= 0 && age < 150 ? age : null
}

/** ข้อความอายุสำหรับแสดงผล — คำนวณจากวันเกิดก่อน ไม่มีวันเกิดจึงใช้เลขที่เก็บไว้ */
export function ageText(birthday, storedAge) {
  const age = ageFromBirthday(birthday)
  if (age != null) return `${age} ปี`
  if (storedAge != null && storedAge !== "") return `${storedAge} ปี`
  return null
}
