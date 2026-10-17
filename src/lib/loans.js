// src/lib/loans.js
// ─────────────────────────────────────────────────────────────────────────────
// 3K เงินกองทุนสงเคราะห์เจ้าหน้าที่ (backend PR #30 — ระเบียบ 15) — ค่าร่วมของหน้าพนักงาน
// (pages/work/LoanRequest.jsx) และหน้าผู้อนุมัติ (pages/hr/tabs/HRLoansTab.jsx)
//
// สถานะ: pending → supervisor_endorsed → manager_forwarded → active → closed  (หรือ rejected)
// ข้อความสถานะใช้ `status_label` จาก backend เสมอ — ตารางนี้มีไว้แค่เลือกสีของ badge
// และเป็นข้อความสำรองเมื่อ backend รุ่นเก่ายังไม่ส่ง status_label
// ─────────────────────────────────────────────────────────────────────────────
import { can } from "./permissions"

/** status → tone ของ <Badge> (neutral | pending | success | danger | info) */
export const LOAN_STATUS_TONE = Object.freeze({
  pending: "pending",
  supervisor_endorsed: "pending",
  manager_forwarded: "info",
  active: "success",
  closed: "neutral",
  rejected: "danger",
})

const FALLBACK_STATUS_LABEL = Object.freeze({
  pending: "รอผู้บังคับบัญชา",
  supervisor_endorsed: "รอผู้จัดการ",
  manager_forwarded: "รอคณะทำงานกองทุนฯ",
  active: "กำลังผ่อนชำระ",
  closed: "ปิดบัญชี",
  rejected: "ไม่อนุมัติ",
})

export const loanStatusLabel = (loan) =>
  loan?.status_label || FALLBACK_STATUS_LABEL[loan?.status] || loan?.status || "—"

export const loanStatusTone = (loan) => LOAN_STATUS_TONE[loan?.status] || "neutral"

/** สัญญาที่พิมพ์หนังสือกู้/ค้ำประกันได้ (อื่น ๆ backend ตอบ 409) */
export const hasContract = (loan) => loan?.status === "active" || loan?.status === "closed"

export const LOAN_PURPOSE_OPTIONS = Object.freeze([
  { value: "education", label: "เพื่อการศึกษา" },
  { value: "medical", label: "เพื่อการรักษาพยาบาล" },
  { value: "housing", label: "เพื่อที่อยู่อาศัย" },
  { value: "occupation", label: "เพื่อการประกอบอาชีพ" },
  { value: "family_necessity", label: "เพื่อความจำเป็นของครอบครัว" },
  { value: "debt_consolidation", label: "เพื่อรวมหนี้" },
  { value: "ceremony", label: "เพื่อการฌาปนกิจ/พิธีการ" },
  { value: "disaster", label: "เพื่อบรรเทาสาธารณภัย" },
  { value: "other", label: "อื่น ๆ" },
])
export const LOAN_PURPOSE_LABEL = Object.freeze(Object.fromEntries(LOAN_PURPOSE_OPTIONS.map((o) => [o.value, o.label])))

/** POST /hr/loans/{id}/payoff — reason */
export const PAYOFF_REASONS = Object.freeze([
  { value: "payoff", label: "ชำระปิดบัญชีก่อนกำหนด" },
  { value: "separation", label: "พ้นสภาพเจ้าหน้าที่" },
  { value: "consolidated", label: "รวมหนี้เข้าสัญญาใหม่" },
])

// ─── ปุ่มตามขั้นของสถานะ ────────────────────────────────────────────────────

/**
 * การกระทำที่ API รองรับสำหรับสถานะปัจจุบันของสัญญา และผู้ใช้มีสิทธิ์
 * pending: แสดงเฉพาะรายการที่มาจากคิวของผู้ใช้ (backend ตรวจว่าเป็นผู้บังคับบัญชาของผู้กู้)
 */
export function stageActions(loan, { fromQueue = false } = {}) {
  switch (loan?.status) {
    case "pending":
      return fromQueue && can("hr.loans.queue")
        ? [{ mode: "endorse", label: "เห็นชอบ" }, { mode: "supervisor-reject", label: "ไม่เห็นชอบ", danger: true }]
        : []
    case "supervisor_endorsed":
      return can("hr.loans.approve.hr")
        ? [{ mode: "forward", label: "ส่งคณะทำงานฯ" }, { mode: "hr-reject", label: "ไม่อนุมัติ", danger: true }]
        : []
    case "manager_forwarded":
      return can("hr.loans.approve.finance")
        ? [{ mode: "finance-confirm", label: "บันทึกมติอนุมัติ" }, { mode: "finance-reject", label: "บันทึกมติไม่อนุมัติ", danger: true }]
        : []
    default:
      return []
  }
}

// ─── format ──────────────────────────────────────────────────────────────────

/** เงินบาท 2 ตำแหน่ง (backend ส่งเป็น decimal string) — ว่าง/ไม่ใช่ตัวเลข → "—" */
export function money(n) {
  if (n == null || n === "") return "—"
  const v = Number(n)
  if (!Number.isFinite(v)) return "—"
  return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** "YYYY-MM-DD" / ISO → วันที่ไทยแบบย่อ (ไม่เลื่อนวันจาก timezone) */
export function thaiDate(d, { long = false } = {}) {
  if (!d) return "—"
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d)
  if (Number.isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString("th-TH", long ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short", year: "2-digit" })
}

/** วันนี้ (เวลาเครื่อง) เป็น "YYYY-MM-DD" */
export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** ชื่อผู้กู้จาก loan object (รองรับหลายรูปแบบที่ backend เคยส่ง) */
export function borrowerName(loan) {
  if (!loan) return "—"
  const full = loan.user_display_name || loan.borrower_name || [loan.user_first_name, loan.user_last_name].filter(Boolean).join(" ")
  return full || (loan.user_id != null ? `รหัส ${loan.user_id}` : "—")
}

/** รายชื่อผู้ค้ำ ("ชื่อ · ชื่อ") */
export function guarantorText(loan) {
  const one = (i) => loan?.[`guarantor_${i}_name`] || (loan?.[`guarantor_${i}_id`] != null ? `รหัส ${loan[`guarantor_${i}_id`]}` : "")
  return [one(1), one(2)].filter(Boolean).join(" · ") || "—"
}

/** ตอบเป็น array ตรง ๆ หรือห่อใน { items | rows | schedule | loans } */
export function asList(d, ...keys) {
  if (Array.isArray(d)) return d
  for (const k of [...keys, "items", "rows", "schedule", "loans", "results"]) {
    if (Array.isArray(d?.[k])) return d[k]
  }
  return []
}

/** warnings[] จาก backend — รับทั้ง string และ { message } */
export function warningList(d) {
  const w = d?.warnings
  if (!Array.isArray(w)) return []
  return w.map((x) => (typeof x === "string" ? x : x?.message || x?.detail || "")).filter(Boolean)
}
