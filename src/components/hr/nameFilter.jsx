// src/components/hr/nameFilter.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ตัวกรอง/เรียง "ชื่อคน" สำหรับตาราง HR ทุกตาราง — ใช้ HeaderCell → ColumnHeaderMenu ชุดเดียวกับ
// ตารางรายชื่อเจ้าหน้าที่ / เงินเดือน / บำเหน็จ (กดหัวคอลัมน์ชื่อ → เรียง ก→ฮ + ค้นหาชื่อ)
//
//   import { useNameFilter } from "./useNameFilter"  (hook แยกไฟล์ — fast refresh)
//   const nf = useNameFilter(rows, { get: (r) => r.employee_name })
//   <thead><tr><NameHeaderCell nf={nf} label="ผู้กู้" /> … </tr></thead>
//   <tbody>{nf.rows.map(…)}</tbody>
//   <NameFilterChips nf={nf} />                 // ป้าย "ตัวกรองที่ใช้" (desktop)
//   {isPhone && <NameSearchField nf={nf} />}     // มือถือ: ช่องค้นหาชื่อ (state เดียวกัน)
//   nf.active → มีตัวกรอง/เรียงชื่ออยู่ · nf.clear() ล้าง · nf.total / nf.rows.length ไว้แสดง "พบ x จาก y"
// ─────────────────────────────────────────────────────────────────────────────
import { ActiveFilterChips, HeaderCell } from "./EmployeeTable"
import SearchField from "../ui/SearchField"
import { EmptyState } from "../ui"
import { neutralBtnCls } from "../../lib/styles"


/** หัวคอลัมน์ชื่อ (<th>) — กดเปิดเมนูเรียง/ค้นหาชื่อ */
export function NameHeaderCell({ nf, label, className }) {
  const col = label && label !== nf.col.label ? { ...nf.col, label } : nf.col
  return (
    <HeaderCell
      col={col}
      className={className}
      sort={nf.sort}
      onSort={nf.onSort}
      filter={nf.filter}
      onFilter={nf.onFilter}
    />
  )
}

/** ป้ายตัวกรองชื่อที่ใช้อยู่ (ไม่แสดงอะไรถ้าไม่มี) */
export function NameFilterChips({ nf, className }) {
  if (!nf.filtering) return null
  return (
    <ActiveFilterChips
      className={className}
      active={[{ col: nf.col, value: nf.filter }]}
      onClear={() => nf.setFilter(null)}
      onClearAll={() => nf.setFilter(null)}
    />
  )
}

/** แสดงแทนรายการเมื่อกรองชื่อแล้วไม่เจอ — ใช้: nf.rows.length === 0 && nf.total > 0 */
export function NameNoMatch({ nf }) {
  return (
    <EmptyState
      title="ไม่พบชื่อที่ค้นหา"
      description={`ไม่มี${nf.col.label}ที่มีคำว่า “${String(nf.filter ?? "").trim()}”`}
      action={<button type="button" onClick={() => nf.setFilter(null)} className={neutralBtnCls}>ล้างตัวกรองชื่อ</button>}
    />
  )
}

/** มือถือ: ช่องค้นหาชื่อ ผูกกับตัวกรองเดียวกับหัวคอลัมน์ */
export function NameSearchField({ nf, placeholder, className }) {
  return (
    <SearchField
      value={nf.filter ?? ""}
      onChange={(v) => nf.setFilter(v)}
      placeholder={placeholder ?? `ค้นหา${nf.col.label}`}
      ariaLabel={`ค้นหา${nf.col.label}`}
      className={className}
    />
  )
}
