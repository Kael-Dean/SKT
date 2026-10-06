// src/components/hr/personnelCache.js
// แคชรายชื่อเจ้าหน้าที่ (active) ระดับ module — GET /hr/personnel?is_active=true
// ใช้ร่วมกันโดย EmployeePicker ทุกตัวในหน้า (ไม่ยิงซ้ำ). Plain .js เพื่อไม่กระทบ React Fast Refresh.
import { apiAuth } from "../../lib/api"

let cache = null
let inflight = null
const listeners = new Set()

export const getCachedPersonnel = () => cache

export function loadPersonnel() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = apiAuth("/hr/personnel?is_active=true")
      .then((d) => {
        cache = Array.isArray(d) ? d : []
        return cache
      })
      .finally(() => { inflight = null })
  }
  return inflight
}

/** subscribe(fn) → unsubscribe. fn ถูกเรียกหลัง refreshPersonnel() โหลดเสร็จ (สำเร็จหรือไม่ก็ตาม) */
export function subscribePersonnel(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** ล้างแคชแล้วโหลดใหม่ — picker ทุกตัวที่เปิดอยู่จะได้รายชื่อล่าสุด */
export function refreshPersonnel() {
  cache = null
  const p = loadPersonnel()
  const done = () => listeners.forEach((fn) => fn(cache))
  p.then(done, done)
  return p
}
