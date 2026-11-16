// src/lib/age.js
// ─────────────────────────────────────────────────────────────────────────────
// อายุ (ปีเต็ม) — หน้าเว็บคำนวณจากวันเกิด ณ วันที่เปิดดูเสมอ อายุจึงเพิ่มเองทุกปี
//
// ห้ามแสดงค่า `age` / `spouse_age` ที่ backend ส่งมา — เป็นเลขที่ HR พิมพ์เองตอนบันทึก
// แล้วค้างอยู่อย่างนั้น (เคยมีเคสเกิด 21 เม.ย. 2521 แต่ขึ้น 41 ปี) ไม่มีวันเกิด = ไม่แสดงอายุ
// (แนวเดียวกับ tenure.js ที่เลิกใช้ job_age)
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

/** ข้อความอายุสำหรับแสดงผล เช่น "48 ปี" — null ถ้าไม่มีวันเกิด */
export function ageText(birthday) {
  const age = ageFromBirthday(birthday)
  return age != null ? `${age} ปี` : null
}
