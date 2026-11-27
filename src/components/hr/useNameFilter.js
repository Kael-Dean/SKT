// src/components/hr/useNameFilter.js — hook ของตัวกรองชื่อ (ดูวิธีใช้ใน nameFilter.jsx)
import { useCallback, useMemo, useState } from "react"
import { isFilterActive, matchFilter } from "./columnFilters"
import { sortRows, thaiCollator } from "../../lib/tableSort"

const EMPTY = []
const defaultGet =(r) => r?.name ?? r?.full_name ?? r?.employee_name ?? ""

/**
 * @param {Array} rows แถวทั้งหมด (ก่อนกรอง)
 * @param {{ get?: (row) => string, label?: string, key?: string }} opts
 *   get = ดึงข้อความชื่อของแถว (ค้น "มีคำว่า" ไม่สนตัวพิมพ์ — ใส่ชื่อ+รหัสพนักงานรวมกันได้)
 */
export function useNameFilter(rows, { get = defaultGet, label = "ชื่อ", key = "name" } = {}) {
  const [filter, setFilter] = useState(null)
  const [sort, setSort] = useState(null) // { key, dir } | null = ลำดับเดิมของตาราง
  // get มักเป็น arrow function ใหม่ทุก render → ไม่ใส่ใน deps (คำนวณใหม่เมื่อ rows/ตัวกรอง/การเรียงเปลี่ยน)
  const col = { key, label, type: "text", get: (r) => String(get(r) ?? "") }

  const list = Array.isArray(rows) ? rows : EMPTY
  const filterOn = isFilterActive("text", filter)
  const out = useMemo(() => {
    let l = filterOn ? list.filter((r) => matchFilter(col, r, filter)) : list
    if (sort) l = sortRows(l, sort, { get: col.get, text: true, tiebreak: (a, b) => thaiCollator.compare(col.get(a), col.get(b)) })
    return l
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, filter, filterOn, sort])

  const onFilter = useCallback((_k, v) => setFilter(v == null || String(v).trim() === "" ? null : v), [])
  const onSort = useCallback((_k, dir) => setSort(dir ? { key, dir } : null), [key])
  const clear = useCallback(() => { setFilter(null); setSort(null) }, [])

  return {
    col,
    rows: out,
    total: list.length,
    filter,
    setFilter: (v) => onFilter(key, v),
    sort,
    onFilter,
    onSort,
    filtering: filterOn,
    active: filterOn || !!sort,
    clear,
  }
}

