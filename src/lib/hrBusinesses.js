// src/lib/hrBusinesses.js
// ธุรกิจของเจ้าหน้าที่ (hr_business) — handoff PR #117
//   GET /hr/businesses → [{ id, name_th, sort_order, is_active }] (เรียงตามลำดับในรายงาน)
//   ใช้ในฟอร์มเจ้าหน้าที่ (hr_business_id) และตัวกรองรายงาน (business_id / split=business)
//   ห้าม hardcode id — โหลดจาก API เสมอ. ไม่ใช่ business_type_id (ประเภทสินค้า Phase 1)
import { useEffect, useState } from "react"
import { apiAuth } from "./api"

let cache = null // Promise ของรายการที่ใช้งานอยู่ (ไม่รวมที่ปิดใช้งาน)

export function fetchHrBusinesses({ includeInactive = false } = {}) {
  if (includeInactive) return apiAuth("/hr/businesses?include_inactive=true").then(asRows)
  if (!cache) cache = apiAuth("/hr/businesses").then(asRows).catch((e) => { cache = null; throw e })
  return cache
}

const asRows = (d) => (Array.isArray(d) ? d : d?.items || [])

/** ตัวเลือกสำหรับ SelectDropdown / ComboBox: [{ value: "2", label: "จัดหา" }] */
export const businessOptions = (rows) =>
  (rows || []).map((b) => ({ value: String(b.id), label: b.name_th + (b.is_active === false ? " (ปิดใช้งาน)" : "") }))

/**
 * { rows, options, loading, error } — best effort: 403/404 (ยังไม่มีสิทธิ์ / prod ยังไม่มี endpoint)
 * ได้ rows ว่าง + error ให้หน้าเว็บซ่อนตัวควบคุมที่เกี่ยวกับธุรกิจได้
 */
export function useHrBusinesses({ enabled = true } = {}) {
  const [state, setState] = useState({ rows: [], loading: Boolean(enabled), error: null })
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    fetchHrBusinesses()
      .then((rows) => alive && setState({ rows, loading: false, error: null }))
      .catch((e) => alive && setState({ rows: [], loading: false, error: e }))
    return () => { alive = false }
  }, [enabled])
  return { ...state, options: businessOptions(state.rows) }
}
