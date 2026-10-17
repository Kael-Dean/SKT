// src/components/hr/columnFilters.js
// ─────────────────────────────────────────────────────────────────────────────
// ตรรกะ filter รายคอลัมน์ (ไม่มี JSX — ใช้ร่วมระหว่าง EmployeeTable / ColumnHeaderMenu)
//
// ค่าของ filter ตาม type ของคอลัมน์
//   text    "คำค้น"                       contains (ไม่สนตัวพิมพ์)
//   enum    ["ค่า", …]                    แสดงเฉพาะแถวที่ค่าอยู่ในรายการ (ว่าง = ไม่กรอง)
//   number  { min: number|null, max: number|null }
//   date    { from: "YYYY-MM-DD"|null, to: "YYYY-MM-DD"|null }
// ─────────────────────────────────────────────────────────────────────────────
import { fmtDate } from "./positionUtils"
import { thaiCollator } from "../../lib/tableSort"

/** ค่า enum ของแถวที่ไม่มีข้อมูล */
export const EMPTY_ENUM = "__empty"
export const EMPTY_ENUM_LABEL = "(ไม่ระบุ)"

const has = (v) => v != null && v !== ""

export const enumKey = (v) => (has(v) ? String(v) : EMPTY_ENUM)

export function isFilterActive(type, value) {
  if (value == null) return false
  switch (type) {
    case "text":
      return String(value).trim() !== ""
    case "enum":
      return Array.isArray(value) && value.length > 0
    case "number":
      return value.min != null || value.max != null
    case "date":
      return !!value.from || !!value.to
    default:
      return false
  }
}

/** true = แถวผ่าน filter ของคอลัมน์นี้ */
export function matchFilter(col, row, value) {
  const v = col.get(row)
  switch (col.type) {
    case "text":
      return String(v ?? "").toLowerCase().includes(String(value).trim().toLowerCase())
    case "enum":
      return value.includes(enumKey(v))
    case "number": {
      if (!has(v) || Number.isNaN(Number(v))) return false
      const n = Number(v)
      if (value.min != null && n < value.min) return false
      if (value.max != null && n > value.max) return false
      return true
    }
    case "date": {
      if (!has(v)) return false
      const d = String(v).slice(0, 10)
      if (value.from && d < value.from) return false
      if (value.to && d > value.to) return false
      return true
    }
    default:
      return true
  }
}

/**
 * ตัวเลือกของ enum จากแถวทั้งหมด → [{ value, label, count }]
 * เรียงตาม col.enumOrder(row) ถ้ามี (เช่นระดับ → เลขระดับ) ไม่งั้นตาม Thai collator; "(ไม่ระบุ)" ท้ายสุด
 */
export function enumOptions(col, rows) {
  const map = new Map()
  for (const r of rows) {
    const v = col.get(r)
    const key = enumKey(v)
    const cur = map.get(key)
    if (cur) cur.count += 1
    else map.set(key, { value: key, label: key === EMPTY_ENUM ? EMPTY_ENUM_LABEL : String(v), count: 1, order: col.enumOrder?.(r) })
  }
  return [...map.values()].sort((a, b) => {
    if (a.value === EMPTY_ENUM) return 1
    if (b.value === EMPTY_ENUM) return -1
    if (a.order != null && b.order != null && a.order !== b.order) return a.order - b.order
    return thaiCollator.compare(a.label, b.label)
  })
}

const numText = (n, fmt) => (fmt ? fmt(n) : Number(n).toLocaleString("th-TH"))

/** ข้อความสั้นใน chip "ตัวกรองที่ใช้" */
export function filterSummary(col, value) {
  switch (col.type) {
    case "text":
      return `มีคำว่า “${String(value).trim()}”`
    case "enum": {
      const labels = value.map((k) => (k === EMPTY_ENUM ? EMPTY_ENUM_LABEL : k))
      return labels.length <= 2 ? labels.join(", ") : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`
    }
    case "number": {
      const { min, max } = value
      const unit = col.unit ? ` ${col.unit}` : ""
      if (min != null && max != null) return `${numText(min, col.fmtNumber)}–${numText(max, col.fmtNumber)}${unit}`
      if (min != null) return `ตั้งแต่ ${numText(min, col.fmtNumber)}${unit}`
      return `ไม่เกิน ${numText(max, col.fmtNumber)}${unit}`
    }
    case "date": {
      const { from, to } = value
      if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`
      if (from) return `ตั้งแต่ ${fmtDate(from)}`
      return `ถึง ${fmtDate(to)}`
    }
    default:
      return ""
  }
}

/** ป้ายทิศการเรียงตาม type */
export function sortLabels(type) {
  if (type === "number") return { asc: "น้อย → มาก", desc: "มาก → น้อย" }
  if (type === "date") return { asc: "เก่า → ใหม่", desc: "ใหม่ → เก่า" }
  return { asc: "ก → ฮ / A → Z", desc: "ฮ → ก / Z → A" }
}
