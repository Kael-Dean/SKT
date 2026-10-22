// src/lib/welfare.js
// ─────────────────────────────────────────────────────────────────────────────
// สวัสดิการ (3P) — ระเบียบ 13 ค่ารักษาพยาบาล (+ ตรวจสุขภาพประจำปี) · ระเบียบ 14 ค่าการศึกษาบุตร
// ป้าย/สถานะ/enum + ตัวช่วยประกอบ body คำขอเบิก ใช้ร่วมกัน:
//   HRWelfareTab · HRWelfareSettingsTab · PersonnelDependantsTab · MyWelfare · components/hr/welfare/*
//
// สิทธิ์ (ใครได้/ไม่ได้ + เหตุผล) backend คำนวณให้ทุกแถว (medical_eligible / medical_reason …)
// — หน้าเว็บแสดงเหตุผลตามที่ส่งมา ห้ามคำนวณกฎ 1–3 คน / อายุ ซ้ำเอง
// ─────────────────────────────────────────────────────────────────────────────
import { getFiscalYearBeStart } from "./debtFiscalYear"
import { fmtPayMonth } from "./payroll"
import { thaiDate } from "./loans"

export { money } from "./payroll"

// ─── ประเภทคำขอ / สถานะ ──────────────────────────────────────────────────────

export const CLAIM_TYPES = [
  { value: "medical", label: "ค่ารักษาพยาบาล" },
  { value: "checkup", label: "ตรวจสุขภาพประจำปี" },
  { value: "education", label: "ค่าการศึกษาบุตร" },
]
export const CLAIM_TYPE_LABEL = Object.fromEntries(CLAIM_TYPES.map((t) => [t.value, t.label]))

export const STATUS_META = {
  submitted:      { label: "รอผู้จัดการอนุมัติ", tone: "pending" },
  approved:       { label: "อนุมัติแล้ว", tone: "info" },
  board_approved: { label: "ผ่านคณะกรรมการแล้ว", tone: "info" },
  paid:           { label: "จ่ายแล้ว", tone: "success" },
  rejected:       { label: "ไม่อนุมัติ", tone: "danger" },
}
export const STATUS_FILTERS = [
  { value: "", label: "ทุกสถานะ" },
  ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label })),
]

/** ป้ายสถานะ — ใช้ status_label ของ backend ก่อน */
export const claimStatusLabel = (c) => c?.status_label || STATUS_META[c?.status]?.label || c?.status || "—"
export const claimStatusTone = (c) => STATUS_META[c?.status]?.tone ?? "neutral"
export const claimTypeLabel = (c) => c?.claim_type_label || CLAIM_TYPE_LABEL[c?.claim_type] || c?.claim_type || "—"

// ─── ฟิลด์ของคำขอ ────────────────────────────────────────────────────────────

export const FACILITY_TYPES = [
  { value: "gov", label: "รัฐ" },
  { value: "private", label: "เอกชน" },
]
export const FACILITY_LABEL = { gov: "สถานพยาบาลรัฐ", private: "สถานพยาบาลเอกชน" }

export const PATIENT_TYPES = [
  { value: "opd", label: "ผู้ป่วยนอก (OPD)" },
  { value: "ipd", label: "ผู้ป่วยใน (IPD)" },
]
export const PATIENT_LABEL = { opd: "ผู้ป่วยนอก", ipd: "ผู้ป่วยใน" }

export const INSTITUTION_TYPES = [
  { value: "gov", label: "รัฐ" },
  { value: "private", label: "เอกชน" },
]
export const INSTITUTION_LABEL = { gov: "สถานศึกษารัฐ", private: "สถานศึกษาเอกชน" }

/** ระดับการศึกษา (ระเบียบ 14) — ใช้เมื่อ GET /hr/welfare/education-rates ยังไม่มา */
export const EDUCATION_LEVELS = [
  { value: 1, label: "อนุบาล" },
  { value: 2, label: "ประถมศึกษา" },
  { value: 3, label: "มัธยมศึกษาตอนต้น" },
  { value: 4, label: "มัธยมศึกษาตอนปลาย / ปวช." },
  { value: 5, label: "อนุปริญญา / ปวส." },
  { value: 6, label: "ปริญญาตรี (ใบแรก)" },
]
export const educationLevelLabel = (lv) =>
  EDUCATION_LEVELS.find((l) => l.value === Number(lv))?.label ?? (lv != null ? `ระดับ ${lv}` : "—")

export const PAYOUT_ROUTES = [
  { value: "separate", label: "จ่ายแยก", hint: "HR บันทึกวันจ่ายเองหลังอนุมัติ" },
  { value: "payroll", label: "จ่ายพร้อมเงินเดือน", hint: "เข้าสลิปเป็น “เงินช่วยเหลือสวัสดิการ” ไม่คิดภาษี ปิดงวดแล้วเป็น “จ่ายแล้ว”" },
]
export const PAYOUT_LABEL = { separate: "จ่ายแยก", payroll: "จ่ายพร้อมเงินเดือน" }

// ─── ผู้มีสิทธิ์ (dependants) ─────────────────────────────────────────────────

export const RELATIONSHIPS = ["บิดา", "มารดา", "คู่สมรส", "บุตร"]
export const RELATIONSHIP_OPTIONS = RELATIONSHIPS.map((r) => ({ value: r, label: r }))

export const dependantName = (d) =>
  d ? [d.first_name, d.last_name].filter(Boolean).join(" ").trim() || `ผู้มีสิทธิ์ #${d.id}` : ""

/** ลำดับแสดง: บิดา มารดา คู่สมรส แล้วบุตรตามลำดับการเกิด */
export function sortDependants(list) {
  const rank = (r) => { const i = RELATIONSHIPS.indexOf(r); return i < 0 ? 9 : i }
  return [...(list || [])].sort((a, b) =>
    rank(a.relationship) - rank(b.relationship) ||
    (a.child_order ?? 99) - (b.child_order ?? 99) ||
    String(a.birthday ?? "").localeCompare(String(b.birthday ?? "")),
  )
}

/** ป้ายย่อยของผู้มีสิทธิ์: "บุตรคนที่ 2 · 8 ปี · แฝด" */
export function dependantMeta(d) {
  if (!d) return ""
  const parts = [d.relationship === "บุตร" && d.child_order ? `บุตรคนที่ ${d.child_order}` : d.relationship]
  if (d.deceased_date) parts.push("เสียชีวิตแล้ว")
  else if (d.age != null) parts.push(`${d.age} ปี`)
  if (d.is_twin) parts.push("แฝด")
  if (d.is_adopted) parts.push("บุตรบุญธรรม")
  if (d.is_incapacitated) parts.push("ทุพพลภาพ/ไร้ความสามารถ")
  if (d.has_own_benefits) parts.push("มีสิทธิ์จากหน่วยงานอื่น")
  return parts.filter(Boolean).join(" · ")
}

// ─── ปี ──────────────────────────────────────────────────────────────────────

/** ปีงบประมาณ (พ.ศ.) เม.ย.–มี.ค. ของวันนี้ */
export const currentFiscalYearBE = (date = new Date()) => getFiscalYearBeStart(date)

/** ปีการศึกษา (พ.ศ.) — เปิดเทอม พ.ค. → ม.ค.–เม.ย. ยังนับเป็นปีการศึกษาก่อน */
export const currentAcademicYearBE = (date = new Date()) =>
  date.getFullYear() + 543 - (date.getMonth() < 4 ? 1 : 0)

export const isBEYear = (v) => /^25\d\d$/.test(String(v ?? ""))

// ─── body ของคำขอเบิก (ใช้ทั้ง /preview และ submit) ──────────────────────────

export const EMPTY_CLAIM = {
  user_id: "",
  claim_type: "medical",
  dependant_id: "",          // "" = ตัวเจ้าหน้าที่เอง (medical)
  facility_type: "",
  patient_type: "",
  service_date: "",
  discharge_date: "",
  treatment_amount: "",
  room_days: "",
  room_amount: "",
  checkup_amount: "",
  academic_year: "",
  institution_type: "",
  institution_name: "",
  education_level: "",
  first_degree: false,
  education_amount: "",
  receipt_no: "",
  receipt_date: "",
  note: "",
}

const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v))
const int = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : parseInt(v, 10))
const txt = (v) => (String(v ?? "").trim() ? String(v).trim() : null)

/** แปลงฟอร์มเป็น body ตามประเภท (ฟิลด์ของประเภทอื่นไม่ส่ง) */
export function buildClaimBody(f) {
  const base = {
    user_id: int(f.user_id),
    claim_type: f.claim_type,
    receipt_no: txt(f.receipt_no),
    receipt_date: f.receipt_date || null,
    note: txt(f.note),
  }
  if (f.claim_type === "medical") {
    const ipd = f.patient_type === "ipd"
    return {
      ...base,
      dependant_id: int(f.dependant_id),
      facility_type: f.facility_type || null,
      patient_type: f.patient_type || null,
      service_date: f.service_date || null,
      discharge_date: ipd ? f.discharge_date || null : null,
      treatment_amount: num(f.treatment_amount) ?? 0,
      room_days: ipd ? int(f.room_days) : null,
      room_amount: ipd ? num(f.room_amount) ?? 0 : null,
    }
  }
  if (f.claim_type === "checkup") {
    return {
      ...base,
      dependant_id: null,
      facility_type: f.facility_type || null,
      service_date: f.service_date || null,
      checkup_amount: num(f.checkup_amount),
    }
  }
  return {
    ...base,
    dependant_id: int(f.dependant_id),
    academic_year: int(f.academic_year),
    institution_type: f.institution_type || null,
    institution_name: txt(f.institution_name),
    education_level: int(f.education_level),
    first_degree: Number(f.education_level) === 6 ? !!f.first_degree : null,
    education_amount: num(f.education_amount),
  }
}

/** ยอดขอเบิก (บาท) ตามที่ backend คำนวณ requested_amount */
export function requestedOf(f) {
  if (f.claim_type === "medical") return (num(f.treatment_amount) ?? 0) + (f.patient_type === "ipd" ? num(f.room_amount) ?? 0 : 0)
  if (f.claim_type === "checkup") return num(f.checkup_amount) ?? 0
  return num(f.education_amount) ?? 0
}

/**
 * ตรวจช่องบังคับฝั่งหน้าเว็บ (ตาม handoff) — คืน { field: ข้อความ }
 * กฎสิทธิ์จริง (ใครเบิกได้/วงเงิน) ให้ backend ตอบ 422 เป็นภาษาไทย
 */
export function validateClaim(f) {
  const e = {}
  const money = (k, label, required = true) => {
    const v = f[k]
    if (v === "" || v == null) { if (required) e[k] = `กรอก${label}`; return }
    if (!Number.isFinite(Number(v)) || Number(v) < 0) e[k] = "กรอกตัวเลขตั้งแต่ 0 ขึ้นไป"
  }
  if (!f.user_id) e.user_id = "เลือกเจ้าหน้าที่"
  if (f.claim_type === "medical") {
    if (!f.facility_type) e.facility_type = "เลือกประเภทสถานพยาบาล"
    if (!f.patient_type) e.patient_type = "เลือกผู้ป่วยนอกหรือผู้ป่วยใน"
    if (!f.service_date && !f.receipt_date) e.service_date = "กรอกวันที่รับบริการ (หรือวันที่ในใบเสร็จ)"
    money("treatment_amount", "ค่ารักษา")
    if (f.patient_type === "ipd") {
      money("room_amount", "ค่าห้องและค่าอาหาร", false)
      if (f.room_days !== "" && (!Number.isInteger(Number(f.room_days)) || Number(f.room_days) < 0)) e.room_days = "กรอกจำนวนวันเป็นจำนวนเต็ม"
      if (f.discharge_date && f.service_date && f.discharge_date < f.service_date) e.discharge_date = "วันออกจากโรงพยาบาลต้องไม่ก่อนวันเข้ารักษา"
    }
  } else if (f.claim_type === "checkup") {
    if (!f.facility_type) e.facility_type = "เลือกประเภทสถานพยาบาล"
    if (!f.service_date) e.service_date = "กรอกวันที่ตรวจ"
    money("checkup_amount", "ค่าตรวจสุขภาพ")
  } else {
    if (!f.dependant_id) e.dependant_id = "เลือกบุตรที่เบิก"
    if (!isBEYear(f.academic_year)) e.academic_year = "กรอกปีการศึกษาเป็น พ.ศ. 4 หลัก"
    if (!f.institution_type) e.institution_type = "เลือกประเภทสถานศึกษา"
    if (!f.education_level) e.education_level = "เลือกระดับการศึกษา"
    money("education_amount", "ค่าการศึกษา")
    if (Number(f.education_level) === 6 && !f.first_degree) e.first_degree = "เบิกได้เฉพาะปริญญาตรีใบแรก"
  }
  return e
}

/** พร้อมยิง preview หรือยัง (ช่องที่ backend บังคับครบ) */
export const claimReadyForPreview = (f) => Object.keys(validateClaim(f)).length === 0

// ─── ขั้นตอนอนุมัติ / จ่าย ───────────────────────────────────────────────────

const toN = (v) => (v == null || v === "" ? null : Number(v))

/** ตามสิทธิ์ต่ำกว่าที่ขอ (วงเงินไม่พอ/เกินเพดานรายการ) */
export function isCapped(c) {
  const req = toN(c?.requested_amount)
  const elig = toN(c?.eligible_amount)
  return req != null && elig != null && elig < req
}

/**
 * ขั้นที่ผู้ใช้คนนี้ทำได้ตอนนี้ ตามสถานะ + สิทธิ์ + การตั้งค่า
 * @param {object} c ClaimOut
 * @param {{ canApprove: boolean, canSubmit: boolean, canBoard: boolean, boardRequired: boolean, meId?: any }} ctx
 * @returns {{ mode: "approve"|"reject"|"board"|"paid", label: string, primary?: boolean }[]}
 */
export function workflowActions(c, { canApprove, canSubmit, canBoard, boardRequired, meId } = {}) {
  if (!c) return []
  const own = meId != null && String(meId) === String(c.user_id) // อนุมัติคำขอของตัวเองไม่ได้ (backend 403)
  const route = c.payout_route || "separate"
  const hasBoard = c.status === "board_approved" || !!c.board_meeting_ref
  const out = []
  if (c.status === "submitted") {
    if (canApprove && !own) out.push({ mode: "approve", label: "อนุมัติ", primary: true })
    if (canApprove && !own) out.push({ mode: "reject", label: "ไม่อนุมัติ" })
  } else if (c.status === "approved" || c.status === "board_approved") {
    const needBoard = boardRequired && !hasBoard
    if (needBoard && canBoard) out.push({ mode: "board", label: "บันทึกมติคณะกรรมการ", primary: true })
    if (!needBoard && route === "separate" && canSubmit) out.push({ mode: "paid", label: "บันทึกจ่ายแล้ว", primary: true })
    if (c.status === "approved" && canApprove && !own) out.push({ mode: "reject", label: "ไม่อนุมัติ" })
  }
  return out
}

/** วันที่อ้างอิงของคำขอ (รักษา/ตรวจ = วันรับบริการ, การศึกษา = ปีการศึกษา) */
export function claimWhen(c) {
  if (c?.claim_type === "education") return c.academic_year ? `ปีการศึกษา ${c.academic_year}` : thaiDate(c.receipt_date)
  return thaiDate(c?.service_date || c?.receipt_date)
}

/** "YYYY-MM-.." → "ตุลาคม 2569" */
export function payMonthLabel(v) {
  const m = /^(\d{4})-(\d{2})/.exec(String(v || ""))
  return m ? fmtPayMonth(m[1], m[2], { long: true }) : null
}

/** ข้อความสถานะการจ่ายที่ไม่ต้องกดอะไร (เช่น รอปิดงวดเงินเดือน) */
export function payoutNote(c, boardRequired) {
  if (!c || !(c.status === "approved" || c.status === "board_approved")) return ""
  const hasBoard = c.status === "board_approved" || !!c.board_meeting_ref
  if (boardRequired && !hasBoard) return "ต้องบันทึกมติคณะกรรมการก่อนจ่าย"
  if (c.payout_route === "payroll") {
    const m = payMonthLabel(c.payroll_month)
    return m ? `จ่ายพร้อมเงินเดือน ${m} — เป็น “จ่ายแล้ว” เมื่อปิดงวด` : "จ่ายพร้อมเงินเดือน — เป็น “จ่ายแล้ว” เมื่อปิดงวด"
  }
  return ""
}

// ─── อัตราค่าการศึกษา — ชื่อ key ใน row ไม่ผูกตายตัว (รองรับหลายแบบ) ──────────

const AMOUNT_KEYS = ["cap", "amount", "rate", "max_amount", "cap_amount"]
const INST_KEYS = ["institution_type", "school_type", "type"]

export const rateAmountKey = (row) => AMOUNT_KEYS.find((k) => row && k in row) ?? "amount"
export const rateInstKey = (row) => INST_KEYS.find((k) => row && k in row) ?? "institution_type"

/** ตัวเลือกเดือนของรอบเงินเดือน (value = ISO "YYYY-MM-01") ตั้งแต่เดือนนี้ไป `count` เดือน */
export function payrollMonthOptions(count = 6, from = new Date()) {
  const out = []
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    out.push({ value: `${y}-${String(m).padStart(2, "0")}-01`, year: y, month: m })
  }
  return out
}
