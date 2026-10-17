// src/lib/tableSort.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side sort ที่ใช้ร่วมกันระหว่างตาราง (SalaryRosterPanel, EmployeeTable).
//
//   sortRows(rows, { key, dir }, { get, text, tiebreak })
//     get(row)        → ค่าที่ใช้เรียง (null / "" = ไม่มีข้อมูล → อยู่ท้ายเสมอ ไม่ว่าจะเรียงทางไหน)
//     text            → true = เทียบแบบข้อความ (Thai collator, ก→ฮ แล้ว A→Z) · false = ตัวเลข
//     tiebreak(a, b)  → ตัวตัดสินเมื่อค่าเท่ากัน (ไม่กลับทิศตาม dir)
// ─────────────────────────────────────────────────────────────────────────────

export const thaiCollator = new Intl.Collator("th")

const isEmpty = (v) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v))

export function sortRows(rows, { dir }, { get, text = false, tiebreak } = {}) {
  const sign = dir === "desc" ? -1 : 1
  return [...rows].sort((a, b) => {
    const va = get(a)
    const vb = get(b)
    const na = isEmpty(va)
    const nb = isEmpty(vb)
    if (na !== nb) return na ? 1 : -1 // missing / still loading always last
    const primary = na ? 0 : (text ? thaiCollator.compare(String(va), String(vb)) : Number(va) - Number(vb)) * sign
    return primary || (tiebreak ? tiebreak(a, b) : 0)
  })
}
