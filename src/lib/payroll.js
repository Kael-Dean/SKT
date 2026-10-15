// src/lib/payroll.js
// ─────────────────────────────────────────────────────────────────────────────
// ข้อมูลกลางของงานเงินเดือน (งวด 3 · 3C) — ใช้ร่วมกันระหว่างหน้า HR, ผู้จัดการ และสลิปของพนักงาน
//
//   ปีใน /hr/payroll* เป็น ค.ศ. เสมอ (ส่ง พ.ศ. → 422) — แปลงเป็น พ.ศ. เฉพาะตอนแสดงผล
//   งวด: draft (ร่าง) → review (ตรวจสอบ) → approved (อนุมัติ) → closed (ปิดงวด)
//   gross_income = เงินเดือน + ค่าตำแหน่ง + add_pending + add_holiday_pay + add_back_pay
//   สุทธิ = gross − (ภาษี + ประกันสังคม + เงินสะสม + กองทุนสำรองฯ + เงินกู้ + กยศ. + งดจ่าย)
// ─────────────────────────────────────────────────────────────────────────────

export const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
export const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

/** ปี ค.ศ. + เดือน (1–12) → "ต.ค. 2569" / "ตุลาคม 2569" */
export function fmtPayMonth(year, month, { long = false } = {}) {
  const y = Number(year)
  const m = Number(month)
  if (!y || !m) return "—"
  return `${(long ? TH_MONTHS : TH_MONTHS_SHORT)[m - 1]} ${y + 543}`
}

/** ค่า month จาก backend ("2026-10-01" / ISO) → { year, month } (ค.ศ.) */
export function parsePayMonth(value) {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})/.exec(String(value))
  if (m) return { year: Number(m[1]), month: Number(m[2]) }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : { year: d.getFullYear(), month: d.getMonth() + 1 }
}

/** จำนวนเงิน 2 ตำแหน่ง — null/"" → "—" */
export const money = (n) =>
  n == null || n === "" || Number.isNaN(Number(n))
    ? "—"
    : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const toNum = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? 0 : Number(v))

/** วันเวลาไทยสั้น ๆ สำหรับ "แก้ไขล่าสุด" / "ส่งเมื่อ" */
export function fmtDateTime(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

// ─── งวดเงินเดือน ─────────────────────────────────────────────────────────────

export const PERIOD_STEPS = [
  { key: "draft", label: "ร่าง" },
  { key: "review", label: "ตรวจสอบ" },
  { key: "approved", label: "อนุมัติ" },
  { key: "closed", label: "ปิดงวด" },
]

export const PERIOD_TONE = { draft: "neutral", review: "pending", approved: "info", closed: "success" }

export const periodStepIndex = (status) => Math.max(0, PERIOD_STEPS.findIndex((s) => s.key === status))

export const periodLabel = (p) => p?.status_label || PERIOD_STEPS.find((s) => s.key === p?.status)?.label || "—"

/** GET /hr/payroll/periods อาจตอบเป็น array หรือ { items } */
export const periodList = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : Array.isArray(d?.periods) ? d.periods : [])

// ─── บรรทัดในสลิป ────────────────────────────────────────────────────────────

/** รายได้ — ลำดับเดียวกับสลิป PDF */
export const INCOME_LINES = [
  { key: "base_salary", label: "เงินเดือน" },
  { key: "position_allowance", label: "ค่าตำแหน่ง" },
  { key: "add_pending", label: "เงินเพิ่มอื่น ๆ" },
  { key: "add_holiday_pay", label: "ค่าทำงานวันหยุด" },
  { key: "add_back_pay", label: "เงินเลื่อนขั้นพิเศษตกเบิก" },
]

/** รายการหัก — deduct_extra_leave ใช้คำว่า "งดจ่าย" เสมอ (ไม่ใช่ "หัก") */
export const DEDUCTION_LINES = [
  { key: "income_tax", label: "ภาษีหัก ณ ที่จ่าย" },
  { key: "deduct_ss", label: "ประกันสังคม" },
  { key: "deduct_reserve", label: "เงินสะสม" },
  { key: "deduct_prov", label: "กองทุนสำรองเลี้ยงชีพ" },
  { key: "deduct_loan", label: "เงินกู้" },
  { key: "deduct_slf", label: "กยศ." },
  { key: "deduct_extra_leave", label: "งดจ่าย (ลาเกินสิทธิ์)" },
]

export const EXTRA_LEAVE_LABEL = "งดจ่าย (ลาเกินสิทธิ์)"

/** ยอดหักรวม — ใช้ค่าจาก backend ถ้ามี, ไม่งั้นรวมจากบรรทัด, ไม่มีบรรทัดเลย → gross − net */
export function totalDeductions(p) {
  if (!p) return null
  if (p.total_deductions != null) return Number(p.total_deductions)
  if (DEDUCTION_LINES.some((l) => p[l.key] != null)) return DEDUCTION_LINES.reduce((s, l) => s + toNum(p[l.key]), 0)
  const net = p.final_payout ?? p.net_payout
  if (p.gross_income != null && net != null) return Number(p.gross_income) - Number(net)
  return null
}

export const netOf = (p) => p?.final_payout ?? p?.net_payout ?? null
