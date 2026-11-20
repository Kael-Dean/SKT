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

/**
 * ขั้นโทษ (AMC 2026-11-16 · ระเบียบฯ 2561 ข้อ 54)
 * 1–4 = ระบบ "ออก" หนังสือ (POST …/punish) · 5–8 = ระบบ "บันทึก" ผลที่ตัดสินนอกระบบ (POST …/record ที่ขั้นผู้จัดการ)
 */
export const LADDER = Object.freeze([
  { step: 1, label: "ตักเตือนด้วยวาจา (ครั้งที่ 1)", short: "เตือนวาจา 1", by: "หัวหน้า · ผช.ผจก. · ผจก." },
  { step: 2, label: "ตักเตือนด้วยวาจา (ครั้งที่ 2)", short: "เตือนวาจา 2", by: "หัวหน้า · ผช.ผจก. · ผจก." },
  { step: 3, label: "ตักเตือนด้วยวาจา (ครั้งที่ 3)", short: "เตือนวาจา 3", by: "หัวหน้า · ผช.ผจก. · ผจก." },
  { step: 4, label: "ตักเตือนเป็นหนังสือ", short: "หนังสือตักเตือน", by: "หัวหน้า · ผช.ผจก. · ผจก." },
  { step: 5, label: "ภาคทัณฑ์", short: "ภาคทัณฑ์", by: "บันทึกผลการสอบสวน", record: true },
  { step: 6, label: "พักงานโดยไม่จ่ายค่าจ้าง", short: "พักงาน", by: "บันทึกผลการสอบสวน", record: true },
  { step: 7, label: "ให้ออก", short: "ให้ออก", by: "บันทึกผลการสอบสวน", record: true },
  { step: 8, label: "ไล่ออก", short: "ไล่ออก", by: "บันทึกผลการสอบสวน", record: true },
])

/** ขั้นสูงสุดที่ออกผ่าน /punish ได้ (5–8 → 409) */
export const MAX_WARNING_STEP = 4

const LADDER_BY_STEP = Object.fromEntries(LADDER.map((s) => [s.step, s]))

export const SUSPENSION_STEP = 6
export const TERMINATION_STEPS = Object.freeze([7, 8])

/** ป้ายขั้นโทษ — ใช้ label จาก server ก่อน */
export const stepLabel = (step, serverLabel) => serverLabel || LADDER_BY_STEP[Number(step)]?.label || (step != null ? `ขั้นที่ ${step}` : "—")

/** โทนของ badge ตามความหนักของโทษ */
export function stepTone(step) {
  const n = Number(step)
  if (n >= 6) return "danger"
  if (n === 4 || n === 5) return "pending"
  return "neutral"
}

export const STAGES = Object.freeze([
  { value: "head", label: "หัวหน้าสาขา/แผนก" },
  { value: "hr", label: "ฝ่ายบุคคล (จัดทำหนังสือรายงาน)" },
  { value: "asst", label: "ผู้ช่วยผู้จัดการ" },
  { value: "manager", label: "ผู้จัดการ" },
])
const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label]))
export const stageLabel = (stage, serverLabel) => serverLabel || STAGE_LABEL[stage] || stage || "—"

/** ขั้นถัดไปเมื่อส่งต่อด้วย /escalate (null = ส่งต่อไม่ได้ · ขั้น hr ไปต่อด้วย /hr-report เท่านั้น) */
export const NEXT_STAGE = Object.freeze({ head: "hr", hr: null, asst: "manager", manager: null })

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
  hr_report: "ฝ่ายบุคคลจัดทำหนังสือรายงาน",
  recorded: "บันทึกวินัยและโทษทางวินัย",
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

// ─── มติ / คำสั่ง (action ที่สร้างจาก "บันทึกวินัยและโทษทางวินัย") ─────────────

/** "ตามมติ/คำสั่ง คำสั่งที่ 15/2569 · ลงวันที่ 14 พฤศจิกายน 2569" ("" ถ้าไม่มี) */
export function resolutionText(a) {
  if (!a?.committee_resolution_no) return ""
  const date = a.committee_resolution_date ? ` · ลงวันที่ ${fmtDate(a.committee_resolution_date, { long: true })}` : ""
  return `ตามมติ/คำสั่ง ${a.committee_resolution_no}${date}`
}

// ─── บันทึกวินัยและโทษทางวินัย (POST …/record) — คีย์ + ป้ายตาม handoff 2026-11-16 ──

const opts = (pairs) => Object.freeze(pairs.map(([value, label]) => ({ value, label })))
const labelOf = (list) => {
  const m = Object.fromEntries(list.map((o) => [o.value, o.label]))
  return (v, server) => server || m[v] || v || "—"
}

export const PENALTIES = opts([
  ["warning", "ตักเตือนเป็นหนังสือ"], ["probation", "ภาคทัณฑ์"], ["suspension", "พักงานโดยไม่จ่ายค่าจ้าง"],
  ["discharge", "ให้ออก"], ["dismissal", "ไล่ออก"],
])
export const PENALTY_STEP = Object.freeze({ warning: 4, probation: 5, suspension: 6, discharge: 7, dismissal: 8 })
export const penaltyLabel = labelOf(PENALTIES)
export const isTerminationPenalty = (p) => p === "discharge" || p === "dismissal"

export const FINDINGS = opts([["guilty", "มีความผิด"], ["not_guilty", "ไม่มีความผิด (ยุติเรื่อง)"]])
export const findingLabel = labelOf(FINDINGS)

export const APPOINTED_BY = opts([["board", "คณะกรรมการดำเนินการ"], ["manager", "ผู้จัดการ"]])
export const appointedByLabel = labelOf(APPOINTED_BY)

export const ORDERED_BY = opts([["board", "คณะกรรมการดำเนินการ"], ["chairman", "ประธานกรรมการ"], ["manager", "ผู้จัดการ"]])
export const orderedByLabel = labelOf(ORDERED_BY)

export const NO_COMMITTEE_REASONS = opts([
  ["imprisonment", "ต้องคำพิพากษาถึงที่สุดให้จำคุก (ข้อ 58(1))"],
  ["bankruptcy", "ถูกพิพากษาให้เป็นบุคคลล้มละลาย (ข้อ 58(2))"],
  ["confession", "รับสารภาพเป็นหนังสือว่ากระทำการทุจริต (ข้อ 58(3))"],
  ["absence_15_days", "ขาดงานติดต่อกันเกิน 15 วันโดยไม่มีเหตุอันสมควร (ข้อ 58(4))"],
  ["below_discharge", "โทษต่ำกว่าให้ออก ไม่ต้องตั้งคณะกรรมการ"],
])
export const noCommitteeReasonLabel = labelOf(NO_COMMITTEE_REASONS)

export const MEMBER_ROLES = opts([["chair", "ประธานกรรมการสอบสวน"], ["member", "กรรมการ"], ["secretary", "กรรมการและเลขานุการ"]])
export const memberRoleLabel = labelOf(MEMBER_ROLES)

export const APPEAL_RESULTS = opts([["cancelled", "ยกเลิกโทษ"], ["reduced", "ลดโทษ"], ["increased", "เพิ่มโทษ"], ["upheld", "ยืนตามคำสั่งเดิม"]])
export const appealResultLabel = labelOf(APPEAL_RESULTS)

/** ค่าคงที่ตาม handoff (ข้อ 57 / ข้อ 64) */
export const COMMITTEE_MIN_MEMBERS = 3
export const APPEAL_WINDOW_DAYS = 15

/** จำนวนวันจากวันนี้ (ไทย) ถึง YYYY-MM-DD — ติดลบ = ผ่านมาแล้ว */
export function daysUntil(isoDate) {
  if (!isoDate) return null
  const toUtc = (d) => Date.UTC(...String(d).slice(0, 10).split("-").map((v, i) => Number(v) - (i === 1 ? 1 : 0)))
  const diff = Math.round((toUtc(isoDate) - toUtc(nowBangkok().date)) / 86400000)
  return Number.isFinite(diff) ? diff : null
}

/** ข้อระเบียบ → "ข้อ 53(16)" (ต่อท้ายปีเมื่อไม่ใช่ 2561) */
export const clauseCode = (c) => (c ? `${c.code}${c.regulation_year && Number(c.regulation_year) !== 2561 ? ` (${c.regulation_year})` : ""}` : "")

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
    reference: [a.doc_no, a.committee_resolution_no && `มติคณะกรรมการ ${a.committee_resolution_no}`].filter(Boolean).join(" / ") || null,
    severance_pay: caseDetail.record?.severance_paid === true ? null
      : caseDetail.record?.severance_paid === false || step === 8 ? 0 : null,
    exit_date: caseDetail.record?.effective_date || null,
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

/** GET /hr/discipline/cases/{id}/record/pdf — บันทึกวินัยและโทษทางวินัย (bearer → blob) */
export async function downloadRecordPdf(caseId) {
  const { blob, filename } = await apiDownload(`/hr/discipline/cases/${encodeURIComponent(caseId)}/record/pdf`)
  saveBlob(blob, filename || `discipline_record_${caseId}.pdf`)
}

/** list response → array (รองรับ { items }) */
export const asArray = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])
