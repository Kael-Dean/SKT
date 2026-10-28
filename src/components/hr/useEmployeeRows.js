// src/components/hr/useEmployeeRows.js
// ─────────────────────────────────────────────────────────────────────────────
// Enrich แถวจาก GET /hr/personnel (8 field: id, first_name, last_name,
// branch_location, position, is_active, role_id, account_status) ให้พร้อมแสดงในตาราง:
//
//   position_title / position_tier_id / tier_name ← usePositions().byId
//   position_label (ตำแหน่งปัจจุบันที่แสดง)          ← position_display (รวมชื่อสาขา, BE v1.6.1) → position_title
//   branch_name                                    ← branch list ที่หน้าโหลดอยู่แล้ว
//   role_label                                     ← roleLabel() (ไม่ hardcode เลข role)
//   account_status_label / active_label            ← ข้อความไทย
//   hire_date / salary_level / tenure_years        ← GET /hr/employees/export (optional)
//
// /hr/employees/export: เรียกครั้งเดียวต่อ session (cache ระดับ module) และเรียกเฉพาะเมื่อ
// can("hr.employees.export") — 403 / error / รูปแบบไม่ตรง → ไม่มีข้อมูล → คอลัมน์ซ่อนเงียบ ๆ.
// ไม่อ่าน salary_amount (ข้อมูลอ่อนไหว) — คัดเฉพาะ field ที่ใช้.
//
// Field ที่ BE ยังไม่ส่ง (handoff/hr-personnel-list-fields.md) อ่านแบบ defensive:
// ถ้า /hr/personnel ส่งมาเมื่อไร (branch_name, position_title, hired, email, p_number …)
// ตารางใช้ค่านั้นก่อนค่าที่ enrich เอง และคอลัมน์ที่เคยว่างจะโผล่เอง.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import { useCan } from "../../lib/permissions"
import { roleLabel } from "../../lib/roles"
import usePositions from "./usePositions"
import { currentPositionLabel, tierName } from "./positionUtils"

// ─── /hr/employees/export — module cache ────────────────────────────────────
const EXPORT_PATH = "/hr/employees/export"
let exportCache = null // Map<id, { hire_date, salary_level }> เมื่อโหลดสำเร็จ
let exportPromise = null
let exportFailed = false // 403 / รูปแบบไม่ตรง → ไม่ลองซ้ำใน session นี้

const pickId = (r) => r?.id ?? r?.user_id ?? r?.personnel_id ?? r?.employee_id

function loadExport() {
  if (exportCache) return Promise.resolve(exportCache)
  if (exportFailed) return Promise.resolve(null)
  if (!exportPromise) {
    exportPromise = apiAuth(EXPORT_PATH)
      .then((d) => {
        const list = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : null
        if (!list) {
          exportFailed = true
          return null
        }
        const map = new Map()
        for (const r of list) {
          const id = pickId(r)
          if (id == null) continue
          // คัดเฉพาะที่ตารางใช้ — ไม่เก็บ salary_amount / ข้อมูลอื่นไว้ในหน่วยความจำ
          map.set(String(id), {
            hire_date: r.hire_date ?? r.hired ?? null,
            salary_level: r.salary_level ?? null,
            // position_display + ตำแหน่ง/สาขาที่ใช้ประกอบ — ใช้เมื่อยังตรงกับแถวสด (cache ทั้ง session อาจเก่า)
            position_display: r.position_display ?? null,
            position_id: r.position_id ?? null,
            branch_id: r.branch_id ?? null,
          })
        }
        exportCache = map
        return map
      })
      .catch((e) => {
        if (e?.status === 401 || e?.status === 403 || e?.status === 404) exportFailed = true
        return null
      })
      .finally(() => {
        exportPromise = null
      })
  }
  return exportPromise
}

function useEmployeeExport() {
  const { can } = useCan()
  const allowed = can("hr.employees.export")
  const [map, setMap] = useState(() => (allowed ? exportCache : null))
  useEffect(() => {
    if (!allowed) return
    let alive = true
    loadExport().then((m) => {
      if (alive) setMap(m)
    })
    return () => {
      alive = false
    }
  }, [allowed])
  return allowed ? map : null
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const has = (v) => v != null && v !== ""

/** ISO date (YYYY-MM-DD…) → ปีงาน (ทศนิยม) นับถึงวันนี้; วันที่อนาคต/ผิดรูป → null */
export function tenureYears(iso) {
  if (!has(iso)) return null
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00")
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  if (now.getDate() < d.getDate()) months -= 1
  if (months < 0) return null
  return months / 12
}

export const ACCOUNT_STATUS_LABEL = {
  new: "ยังไม่ลงทะเบียน",
  registered: "ลงทะเบียนแล้ว",
}

export const EMPLOYMENT_TYPE_LABEL = {
  officer: "เจ้าหน้าที่",
  permanent_employee: "ลูกจ้างประจำ",
  temporary_employee: "ลูกจ้างชั่วคราว",
}

export const GENDER_LABEL = { M: "ชาย", F: "หญิง", male: "ชาย", female: "หญิง", other: "อื่นๆ" }

const isoDate = (v) => (has(v) ? String(v).slice(0, 10) : null)

const sameId = (a, b) => has(a) && has(b) && String(a) === String(b)

/**
 * position_display ของแถว: ถ้า /hr/personnel ส่งมาเองใช้เลย; ไม่งั้นใช้ของ /hr/employees/export
 * เฉพาะเมื่อตำแหน่ง + สาขาใน export ยังตรงกับแถวสด (export cache ไว้ทั้ง session — หลังย้ายสาขา/เปลี่ยนตำแหน่ง
 * ป้ายเก่าจะถูกข้ามแล้วกลับไปใช้ชื่อตำแหน่งตามเดิม แทนที่จะแสดงชื่อสาขาเดิม)
 */
function displaySource(u, exp) {
  if (u.position_display !== undefined) return u
  if (exp && sameId(exp.position_id, u.position) && sameId(exp.branch_id, u.branch_location)) return exp
  return null
}

/**
 * @param {Array} rawRows  แถวจาก /hr/personnel
 * @param {Array} branches [{ value|id, label|branch_name }]
 * @returns {{ rows, positionsLoading, exportAvailable }}
 */
export default function useEmployeeRows(rawRows, branches) {
  const { byId: positionsById, loading: positionsLoading } = usePositions()
  const exportMap = useEmployeeExport()

  const branchNameById = useMemo(() => {
    const m = new Map()
    for (const b of branches || []) {
      const id = b?.value ?? b?.id
      const name = b?.label ?? b?.branch_name
      if (id != null && name) m.set(String(id), name)
    }
    return m
  }, [branches])

  const rows = useMemo(
    () =>
      (rawRows || []).map((u) => {
        const pos = u.position != null ? positionsById[u.position] : null
        const exp = exportMap?.get(String(u.id))
        const tierId = u.position_tier ?? u.position_tier_id ?? pos?.position_tier_id ?? null
        const hire = isoDate(u.hired ?? u.hire_date ?? exp?.hire_date)
        const branchName =
          u.branch_name ?? (u.branch_location != null ? branchNameById.get(String(u.branch_location)) : null)
        const positionTitle = u.position_title ?? pos?.title ?? null
        const status = u.account_status
        const shownTitle =
          positionTitle ?? (u.position != null && !positionsLoading ? `ตำแหน่ง ${u.position}` : null)
        return {
          ...u,
          full_name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
          position_title: shownTitle,
          position_label: u.position != null ? currentPositionLabel(displaySource(u, exp), shownTitle) : shownTitle,
          position_tier_id: tierId,
          tier_name: has(tierId) ? tierName(tierId) : null,
          branch_name: branchName ?? (u.branch_location != null ? `สาขา ${u.branch_location}` : null),
          role_label: has(u.role_id) ? roleLabel(u.role_id) : null,
          account_status_label: has(status) ? ACCOUNT_STATUS_LABEL[status] ?? String(status) : null,
          active_label: u.is_active == null ? null : u.is_active ? "ใช้งาน" : "ไม่ใช้งาน",
          hire_date: hire,
          tenure_years: tenureYears(hire),
          salary_level: u.salary_level ?? exp?.salary_level ?? null,
          employment_type_label: has(u.employment_type)
            ? EMPLOYMENT_TYPE_LABEL[u.employment_type] ?? String(u.employment_type)
            : null,
          gender_label: has(u.gender) ? GENDER_LABEL[u.gender] ?? String(u.gender) : null,
          birthday: isoDate(u.birthday),
          termination_date: isoDate(u.termination_date),
        }
      }),
    [rawRows, positionsById, positionsLoading, branchNameById, exportMap],
  )

  return { rows, positionsLoading, exportAvailable: !!exportMap }
}
