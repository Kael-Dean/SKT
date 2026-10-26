// src/lib/discipline.js
// ─────────────────────────────────────────────────────────────────────────────
// ระบบตักเตือน (งวด 4 · 3Q) — ป้ายภาษาไทย, ลำดับขั้นโทษ, รูปแบบวันที่ และ helper ที่ใช้ร่วมกัน
// ระหว่าง MyDiscipline (พนักงาน), HRDisciplineTab (ผู้พิจารณา/HR), HRDisciplineSettingsTab
// และ DisciplineHistory (โปรไฟล์พนักงาน)
//
// backend คำนวณขั้นถัดไปเอง (ladder.next_step / allowed_steps) — ป้ายในไฟล์นี้ใช้แสดงผลเท่านั้น
// และจะใช้ step_label / next_step_label จาก server ก่อนเสมอเมื่อมี
// ─────────────────────────────────────────────────────────────────────────────
import { apiDownload } from "./api"
import { saveBlob } from "./files"

/** ขั้นโทษตาม handoff (ขั้น 5 ไม่ใช่โทษ: เรื่องถัดไปส่งตรงถึง ผช.ผจก.) */
export const LADDER = Object.freeze([
  { step: 1, label: "หนังสือเตือนด้วยวาจา (ครั้งที่ 1)", short: "เตือนวาจา 1", by: "หัวหน้า · ผช.ผจก. · ผจก." },
  { step: 2, label: "หนังสือเตือนด้วยวาจา (ครั้งที่ 2)", short: "เตือนวาจา 2", by: "หัวหน้า · ผช.ผจก. · ผจก." },
  { step: 3, label: "หนังสือเตือนด้วยวาจา (ครั้งที่ 3)", short: "เตือนวาจา 3", by: "หัวหน้า · ผช.ผจก. · ผจก." },
  { step: 4, label: "หนังสือเตือนอย่างเป็นทางการ", short: "เตือนทางการ", by: "หัวหน้า · ผช.ผจก. · ผจก." },
  { step: 5, label: "เรื่องถัดไปส่งตรงถึง ผช.ผจก.", short: "ส่ง ผช.ผจก.", by: "ไม่ใช่โทษ", marker: true },
  { step: 6, label: "คำสั่งพักงาน (งดจ่ายค่าจ้างระหว่างพัก)", short: "พักงาน", by: "ผช.ผจก. · ผจก." },
  { step: 7, label: "หนังสือเชิญออก", short: "เชิญออก", by: "ผจก." },
  { step: 8, label: "หนังสือไล่ออก", short: "ไล่ออก", by: "ผจก." },
])

const LADDER_BY_STEP = Object.fromEntries(LADDER.map((s) => [s.step, s]))

export const SUSPENSION_STEP = 6
export const TERMINATION_STEPS = Object.freeze([7, 8])

/** ป้ายขั้นโทษ — ใช้ label จาก server ก่อน */
export const stepLabel = (step, serverLabel) => serverLabel || LADDER_BY_STEP[Number(step)]?.label || (step != null ? `ขั้นที่ ${step}` : "—")

/** โทนของ badge ตามความหนักของโทษ */
export function stepTone(step) {
  const n = Number(step)
  if (n >= 6) return "danger"
  if (n === 4) return "pending"
  return "neutral"
}

export const STAGES = Object.freeze([
  { value: "head", label: "หัวหน้าสาขา/แผนก" },
  { value: "asst", label: "ผู้ช่วยผู้จัดการ" },
  { value: "manager", label: "ผู้จัดการ" },
])
const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label]))
export const stageLabel = (stage, serverLabel) => serverLabel || STAGE_LABEL[stage] || stage || "—"

/** ขั้นถัดไปเมื่อส่งต่อ (null = ส่งต่อไม่ได้แล้ว) */
export const NEXT_STAGE = Object.freeze({ head: "asst", asst: "manager", manager: null })

/** สถานะเรื่อง (ฝั่งผู้พิจารณา) */
export function caseStatus(c) {
  if (c?.status === "open") return { label: "รอพิจารณา", tone: "pending" }
  if (c?.outcome === "dismissed") return { label: c?.false_report ? "ยุติ · แจ้งเท็จ" : "ยุติเรื่อง", tone: "neutral" }
  if (c?.outcome === "punished") return { label: "ลงโทษแล้ว", tone: "danger" }
  if (c?.status === "closed") return { label: "ปิดเรื่องแล้ว", tone: "neutral" }
  return { label: c?.status || "—", tone: "neutral" }
}

/** สถานะเรื่องที่ฉันแจ้ง — ผู้แจ้งเห็นสถานะเท่านั้น ไม่เห็นผลการพิจารณา */
export function reportStatus(status) {
  if (status === "open") return { label: "อยู่ระหว่างพิจารณา", tone: "pending" }
  if (status === "closed") return { label: "พิจารณาแล้ว", tone: "success" }
  return { label: status || "—", tone: "neutral" }
}

export const EVENT_LABEL = Object.freeze({
  submitted: "แจ้งเรื่อง",
  escalated: "ส่งต่อ",
  punished: "ลงโทษ",
  dismissed: "ยุติเรื่อง",
})

// ─── วันที่ / เวลา (เขตเวลาไทยเสมอ — ข้อมูลเป็นเหตุการณ์ในสหกรณ์) ──────────────

const TZ = "Asia/Bangkok"

/** "1 ต.ค. 69 · 08:45" */
export function fmtDateTime(d) {
  if (!d) return "—"
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  const date = dt.toLocaleDateString("th-TH", { timeZone: TZ, day: "numeric", month: "short", year: "2-digit" })
  const time = dt.toLocaleTimeString("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
  return `${date} · ${time} น.`
}

/** "YYYY-MM-DD" หรือ ISO → "1 ต.ค. 69" (date-only ไม่เลื่อนวันจาก timezone) */
export function fmtDate(d, { long = false } = {}) {
  if (!d) return "—"
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  const opts = long ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short", year: "2-digit" }
  return dt.toLocaleDateString("th-TH", m ? opts : { ...opts, timeZone: TZ })
}

/** วันนี้ / เวลาตอนนี้ในเขตเวลาไทย → { date: "YYYY-MM-DD", time: "HH:mm" } */
export function nowBangkok() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/** วันที่ + เวลา (ไทย) → ISO พร้อม offset "+07:00" ตามตัวอย่างใน handoff */
export const toIncidentIso = (date, time) => `${date}T${time || "00:00"}:00+07:00`

/** จำนวนวันแบบนับรวมวันแรกและวันสุดท้าย (null ถ้าข้อมูลไม่ครบหรือย้อนกลับ) */
export function inclusiveDays(start, end) {
  if (!start || !end) return null
  const a = Date.UTC(...start.split("-").map((v, i) => Number(v) - (i === 1 ? 1 : 0)))
  const b = Date.UTC(...end.split("-").map((v, i) => Number(v) - (i === 1 ? 1 : 0)))
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return Math.round((b - a) / 86400000) + 1
}

/** ช่วงพักงาน "3 – 5 พ.ย. 69 (3 วัน)" */
export function suspensionText(a) {
  if (!a?.suspension_start) return ""
  const days = inclusiveDays(a.suspension_start, a.suspension_end)
  const range = a.suspension_end && a.suspension_end !== a.suspension_start
    ? `${fmtDate(a.suspension_start)} – ${fmtDate(a.suspension_end)}`
    : fmtDate(a.suspension_start)
  return days ? `${range} (${days} วัน)` : range
}

// ─── ผู้แจ้ง (ความลับ) ──────────────────────────────────────────────────────

/** backend ตัด key reporter_* ออก (ไม่ใช่ null) เมื่อผู้เรียกไม่มีสิทธิ์เห็น — ห้ามแสดงถ้าไม่มี key */
export const canSeeReporter = (c) => c != null && (Object.hasOwn(c, "reporter_name") || Object.hasOwn(c, "reporter_id"))

// ─── บันทึกการพ้นสภาพ (ขั้น 7/8) ─────────────────────────────────────────────

/**
 * termination_prefill จาก server (ตอบกลับของ /punish) หรือสร้างจากรายละเอียดเรื่องที่ปิดด้วยขั้น 7/8
 * (กรณีเปิดเรื่องภายหลังจากการแจ้งเตือน — server ไม่ส่ง prefill ซ้ำ)
 */
export function terminationPrefillFor(caseDetail, serverPrefill) {
  if (serverPrefill) return serverPrefill
  const a = caseDetail?.action
  const step = Number(a?.step)
  if (!TERMINATION_STEPS.includes(step)) return null
  return {
    employee_id: caseDetail.accused_id,
    exit_type: "dismiss",
    reason: step === 8 ? "ไล่ออก" : "ให้ออก",
    reference: a.doc_no || null,
    severance_pay: step === 8 ? 0 : null,
    note: a.note || caseDetail.decision_note || "",
  }
}

// ─── หนังสือ (PDF) ─────────────────────────────────────────────────────────

/** GET /hr/discipline/actions/{id}/pdf ต้องใช้ bearer token → โหลดเป็น blob แล้วบันทึก */
export async function downloadActionPdf(action) {
  const { blob, filename } = await apiDownload(`/hr/discipline/actions/${encodeURIComponent(action.id)}/pdf`)
  const doc = String(action.doc_no || action.id).replace(/[\\/:*?"<>|\s]+/g, "_")
  saveBlob(blob, filename || `discipline_${doc}.pdf`)
}

/** list response → array (รองรับ { items }) */
export const asArray = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])
