// src/lib/activities.js
// ─────────────────────────────────────────────────────────────────────────────
// ประวัติกิจกรรม (3G · PR 45, TOR §3.1 / §3.7) — ประชุม / สัมมนา / ฝึกอบรม / สอบ
//
//   พนักงาน   GET    /personnel/me/activities                    (self.history)
//   HR        GET    /hr/employees/{id}/activities               (hr.employee.view)
//             POST   /hr/employees/{id}/activities               (hr.employee.edit_personal)
//             PATCH  /hr/employees/{id}/activities/{aid}         ↑ (รับบาง field — attachment_ids = "เพิ่ม" ไฟล์)
//             DELETE /hr/employees/{id}/activities/{aid}         ↑ (ลบไฟล์แนบด้วย)
//   ใบประกาศ: POST /files ก่อน (lib/files.js) → ส่ง id ใน attachment_ids · ถอดไฟล์ = DELETE /files/{id}
//
// Activity: { id, user_id, activity_type, activity_type_label, title, start_date, end_date|null,
//             organizer, location, hours|null, detail, result, attachments: [{id, filename, content_type, size_bytes}],
//             created_at, updated_at }
// ─────────────────────────────────────────────────────────────────────────────
import { apiAuth } from "./api"
import { thaiDate } from "./loans"

export const ACTIVITY_TYPES = Object.freeze([
  { value: "meeting", label: "ประชุม" },
  { value: "seminar", label: "สัมมนา" },
  { value: "training", label: "ฝึกอบรม" },
  { value: "exam", label: "สอบ" },
  { value: "other", label: "อื่น ๆ" },
])

const TYPE_LABEL = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.value, t.label]))

/** tone ของ Badge ต่อประเภท — แยกด้วยสีให้สแกนรายการยาวได้ (ข้อความยังบอกประเภทเสมอ) */
const TYPE_TONE = { meeting: "neutral", seminar: "info", training: "success", exam: "pending", other: "neutral" }

export const activityTypeLabel = (a) => a?.activity_type_label || TYPE_LABEL[a?.activity_type] || "กิจกรรม"
export const activityTypeTone = (a) => TYPE_TONE[a?.activity_type] || "neutral"

/** รายการจาก API → array เรียงใหม่สุดก่อน (backend เรียงให้แล้ว — เรียงซ้ำกันกรณี optimistic merge) */
export function asActivities(d) {
  const list = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []
  return [...list].sort((a, b) =>
    String(b.start_date || "").localeCompare(String(a.start_date || "")) || Number(b.id || 0) - Number(a.id || 0))
}

/** ช่วงวันที่แบบไทย (พ.ศ.): "1 ส.ค. 69" · "10 ก.ย. 69 – 12 ก.ย. 69" */
export function activityDateRange(a) {
  if (!a?.start_date) return "—"
  const start = thaiDate(a.start_date)
  if (!a.end_date || a.end_date === a.start_date) return start
  return `${start} – ${thaiDate(a.end_date)}`
}

/** "18 ชม." / "1.5 ชม." — ว่าง → "" */
export function hoursText(h) {
  if (h == null || h === "") return ""
  const n = Number(h)
  if (!Number.isFinite(n)) return ""
  return `${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })} ชม.`
}

const base = (employeeId) => `/hr/employees/${encodeURIComponent(employeeId)}/activities`

export const fetchMyActivities = () => apiAuth("/personnel/me/activities").then(asActivities)
export const fetchEmployeeActivities = (employeeId) => apiAuth(base(employeeId)).then(asActivities)
export const createActivity = (employeeId, body) => apiAuth(base(employeeId), { method: "POST", body })
export const updateActivity = (employeeId, aid, body) =>
  apiAuth(`${base(employeeId)}/${encodeURIComponent(aid)}`, { method: "PATCH", body })
export const deleteActivity = (employeeId, aid) =>
  apiAuth(`${base(employeeId)}/${encodeURIComponent(aid)}`, { method: "DELETE" })
