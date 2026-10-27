// src/hooks/useFormDefaults.js
// ─────────────────────────────────────────────────────────────────────────────
// ค่าเริ่มต้นของหัวฟอร์ม "วันที่ / ข้าพเจ้า / ตำแหน่ง / สังกัด / แผนก" (api-handoff 2026-10-17 §3)
//
//   ทางหลัก (backend กำลังทำ):  GET /personnel/me/form-defaults
//       → ชื่อไทยพร้อมคำนำหน้า (ไม่มีไทยใช้อังกฤษ), ตำแหน่ง, สาขา, แผนก/ฝ่าย
//   ทางสำรอง (ใช้ได้วันนี้) — เมื่อทางหลังตอบ 404/405:
//       GET /personnel/me           → first_name last_name (อังกฤษไปก่อน)
//       GET /personnel/me/position  → position_display (รวมชื่อสาขา เช่น "หัวหน้าสาขาท่าตูม", BE v1.6.1)
//                                      → position_title (backend รุ่นก่อน / ไม่มีตำแหน่ง)
//       GET /personnel/me/branches  → home_branch.branch_name
//       แผนก: ยังไม่มีที่มา → ""
//
// เมื่อ form-defaults ขึ้นจริงแล้ว ลบ fallback ได้ — ตัวที่ฟอร์มใช้คือ { name, position, branch, department }
// ทุกค่าเป็นแค่ค่าเริ่มต้น ฟอร์มต้องให้ผู้ใช้แก้ได้เสมอ
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"
import { apiAuth } from "../lib/api"
import { currentPositionLabel } from "../components/hr/positionUtils"

export const FORM_DEFAULTS_PATH = "/personnel/me/form-defaults"

const EMPTY = Object.freeze({ name: "", position: "", branch: "", department: "" })
const s = (v) => (v == null ? "" : String(v).trim())

/** รูปแบบคำตอบของ form-defaults (ยังไม่ล็อก — รองรับชื่อ key ที่น่าจะเป็นไว้หลายแบบ) */
function fromFormDefaults(d = {}) {
  return {
    name: s(d.display_name ?? d.full_name_th ?? d.full_name ?? d.name),
    position: s(d.position_title ?? d.position),
    branch: s(d.branch_name ?? d.branch),
    department: s(d.department_name ?? d.department ?? d.division),
  }
}

async function fromLegacyCalls() {
  const [me, pos, br] = await Promise.all([
    apiAuth("/personnel/me").catch(() => null),
    apiAuth("/personnel/me/position").catch(() => null),
    apiAuth("/personnel/me/branches").catch(() => null),
  ])
  const p = Array.isArray(pos) ? pos[0] : pos
  const home = br?.home_branch ?? (Array.isArray(br) ? br[0] : null)
  return {
    name: [s(me?.first_name), s(me?.last_name)].filter(Boolean).join(" "),
    position: s(currentPositionLabel(p, p?.position_title ?? p?.title ?? p?.name)),
    branch: s(home?.branch_name ?? home?.name),
    department: "",
  }
}

async function fetchFormDefaults() {
  try {
    return fromFormDefaults(await apiAuth(FORM_DEFAULTS_PATH))
  } catch (err) {
    // endpoint ยังไม่ deploy → ใช้ 3 call เดิม; error อื่น (เน็ตหลุด/500) ก็ลองทางสำรองเหมือนกัน
    if (err?.status === 401) throw err
    return fromLegacyCalls()
  }
}

// โหลดครั้งเดียวต่อ session (ข้อมูลไม่เปลี่ยนระหว่างใช้งาน) — reset เมื่อ error เพื่อให้ลองใหม่รอบหน้า
let cache = null
function loadOnce() {
  if (!cache) cache = fetchFormDefaults().catch((e) => { cache = null; throw e })
  return cache
}

/**
 * @returns {{ defaults: {name:string, position:string, branch:string, department:string}, loading: boolean }}
 * ใช้: `const { defaults } = useFormDefaults()` แล้ว prefill ช่องที่ยังว่างใน useEffect
 */
export default function useFormDefaults() {
  const [state, setState] = useState({ defaults: EMPTY, loading: true })
  useEffect(() => {
    let alive = true
    loadOnce()
      .then((d) => alive && setState({ defaults: d, loading: false }))
      .catch(() => alive && setState({ defaults: EMPTY, loading: false }))
    return () => { alive = false }
  }, [])
  return state
}
