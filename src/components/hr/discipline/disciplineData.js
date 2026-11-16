// src/components/hr/discipline/disciplineData.js
// helper ที่ไม่ใช่ component ของ ClausePicker / AckSheet (แยกไฟล์ตามกฎ react-refresh)
import { useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { getUser } from "../../../lib/auth"
import { asArray } from "../../../lib/discipline"

// ─── ข้อระเบียบ: GET /hr/discipline/clauses (แคชระดับ module — หน้าตั้งค่าเรียก invalidateClauses() หลังแก้) ──
let cache = null
let inflight = null
export function invalidateClauses() { cache = null; inflight = null }

export function useClauses() {
  const [state, setState] = useState(() => ({ list: cache ?? [], loading: !cache, error: "" }))
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (cache) { setState({ list: cache, loading: false, error: "" }); return undefined }
    let alive = true
    setState((s) => ({ ...s, loading: true, error: "" }))
    inflight ??= apiAuth("/hr/discipline/clauses").then((d) => { cache = asArray(d); return cache }).finally(() => { inflight = null })
    inflight
      .then((list) => { if (alive) setState({ list, loading: false, error: "" }) })
      .catch((e) => { if (alive) setState({ list: [], loading: false, error: apiDetail(e) || "โหลดข้อระเบียบไม่สำเร็จ" }) })
    return () => { alive = false }
  }, [tick])
  return { ...state, retry: () => { invalidateClauses(); setTick((t) => t + 1) } }
}

// ─── การรับทราบหนังสือ ─────────────────────────────────────────────────────

/** ปุ่มบันทึกการรับทราบ: HR (record_outcome) หรือผู้ออกหนังสือฉบับนั้น — server ตัดสินจริง (403) */
export function canAckAction(a, canRecordOutcome) {
  if (!a || a.id == null) return false
  if (canRecordOutcome) return true
  const me = getUser()
  return me?.id != null && a.issued_by != null && String(me.id) === String(a.issued_by)
}

/** สถานะการรับทราบสั้น ๆ ("" ถ้ายังไม่บันทึก) */
export function ackText(a, fmt) {
  if (a?.refused_to_sign) return "ปฏิเสธการลงนามรับทราบ"
  if (a?.acknowledged_on) return `รับทราบเมื่อ ${fmt(a.acknowledged_on)}`
  return ""
}
