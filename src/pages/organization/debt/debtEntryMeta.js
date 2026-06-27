// Shared metadata + validation for the v5 cohort debt-entry model.
// (api-handoff-v5-cohort) — a single entries table with four entry types.
// Kept framework-free so both the DebtTracking tabs and the report tables can
// reuse the exact same labels, rules, and request-body builder.

import {
  findCurrentFiscalYearId,
  selectableAppliedFiscalYears,
  pastFiscalYears,
} from "../../../lib/debtFiscalYear"

// ─── Roles (debt surface) ───────────────────────────────────────────────────
// Write (create/patch/delete entries) → roles 1, 5. Program mutations → 1, 4.
export const DEBT_WRITE_ROLES   = [1, 5]
export const DEBT_PROGRAM_ROLES = [1, 4]
export const ROLE_GENERAL_STAFF = 5 // branch-locked on writes

export const canWriteEntries  = (roleId) => DEBT_WRITE_ROLES.includes(Number(roleId))
export const canManagePrograms = (roleId) => DEBT_PROGRAM_ROLES.includes(Number(roleId))

// ─── Entry types ────────────────────────────────────────────────────────────
export const ENTRY_TYPES = ["seed", "new_debt", "full_payoff", "partial_payment"]

export const ENTRY_META = {
  seed: {
    label: "ยอดยกมา",
    hint: "หนี้ค้างจากปีก่อน (ตั้งต้น) — เลือกปีอดีตที่เป็นต้นกำเนิดหนี้",
    needsCount: true,
    needsPaymentMethod: false,
    fyMode: "past",
    tone: "amber",
  },
  new_debt: {
    label: "เพิ่มในปี",
    hint: "หนี้ใหม่ที่ปล่อยในปีปัจจุบัน",
    needsCount: true,
    needsPaymentMethod: false,
    fyMode: "current",
    tone: "indigo",
  },
  full_payoff: {
    label: "ชำระปิดบัญชี",
    hint: "ผู้ที่ชำระปิดหนี้ทั้งก้อน — นับเป็น ‘ราย’ ที่ปิดบัญชี",
    needsCount: true,
    needsPaymentMethod: true,
    fyMode: "atOrBefore",
    tone: "emerald",
  },
  partial_payment: {
    label: "ชำระบางส่วน",
    hint: "รับชำระบางส่วน — เพิ่มยอด ‘บาท’ แต่ไม่ลด ‘ราย’ (ยังค้างอยู่)",
    needsCount: false,
    needsPaymentMethod: true,
    fyMode: "atOrBefore",
    tone: "sky",
  },
}

export const entryLabel = (t) => ENTRY_META[t]?.label || t

export const PAYMENT_METHODS = [
  { value: "mobile_banking", label: "โอนผ่านมือถือ" },
  { value: "cash",           label: "เงินสด" },
  { value: "produce_trade",  label: "ชำระด้วยผลผลิต" },
]
export const PM_LABEL = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]))

// Tailwind badge tints keyed by entry tone — keep in sync with ENTRY_META.tone.
export const ENTRY_BADGE_CLS = {
  amber:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  indigo:  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  sky:     "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
}

/** Fiscal-year <option> list valid for a given entry type. */
export function fiscalYearOptionsFor(entryType, fiscalYears) {
  const meta = ENTRY_META[entryType]
  if (!meta) return []
  if (meta.fyMode === "past") return pastFiscalYears(fiscalYears)
  if (meta.fyMode === "current") {
    const id = findCurrentFiscalYearId(fiscalYears)
    return (Array.isArray(fiscalYears) ? fiscalYears : []).filter((y) => y.id === id)
  }
  return selectableAppliedFiscalYears(fiscalYears) // atOrBefore
}

const num = (v) => parseFloat(String(v ?? "").trim())

/**
 * Validate a draft entry against the v5 rules (mirrors the backend so the user
 * gets instant feedback). Returns an error string, or "" when valid.
 */
export function validateEntry(form) {
  const meta = ENTRY_META[form.entry_type]
  if (!meta) return "ประเภทรายการไม่ถูกต้อง"
  if (!form.branch_id)       return "กรุณาเลือกสาขา"
  if (!form.program_id)      return "กรุณาเลือกโครงการ"
  if (!form.fiscal_year_id)  return "กรุณาเลือกปีการผลิต (ปีต้นกำเนิดหนี้)"
  if (!form.entry_date)      return "กรุณาระบุวันที่"

  const isProduce = meta.needsPaymentMethod && form.payment_method === "produce_trade"

  if (meta.needsPaymentMethod && !form.payment_method) return "กรุณาเลือกวิธีชำระ"

  if (isProduce) {
    if (!form.produce_id)                       return "กรุณาเลือกประเภทผลผลิต"
    if (!(num(form.produce_weight) > 0))        return "กรุณากรอกน้ำหนักผลผลิต"
    if (!(num(form.produce_value) > 0))         return "กรุณากรอกมูลค่าผลผลิต"
  } else if (!(num(form.amount) > 0)) {
    return "กรุณากรอกจำนวนเงินที่ถูกต้อง (มากกว่า 0)"
  }

  if (meta.needsCount && !(Number(form.count) > 0)) {
    return "กรุณากรอกจำนวนราย (มากกว่า 0)"
  }
  return ""
}

/** Build the POST/PATCH request body from a validated draft. */
export function buildEntryBody(form) {
  const meta = ENTRY_META[form.entry_type] || {}
  const isProduce = meta.needsPaymentMethod && form.payment_method === "produce_trade"
  const body = {
    branch_id: Number(form.branch_id),
    program_id: Number(form.program_id),
    fiscal_year_id: Number(form.fiscal_year_id),
    entry_type: form.entry_type,
    amount: isProduce ? form.produce_value : form.amount,
    count: meta.needsCount ? Number(form.count) : null,
    payment_method: meta.needsPaymentMethod ? form.payment_method : null,
    produce_id: isProduce ? Number(form.produce_id) : null,
    produce_weight: isProduce ? form.produce_weight : null,
    produce_value: isProduce ? form.produce_value : null,
    entry_date: form.entry_date,
    note: (form.note || "").trim() || null,
  }
  return body
}

/** Mutable-only body for PATCH (identity fields are immutable in v5). */
export function buildEntryPatchBody(form) {
  const meta = ENTRY_META[form.entry_type] || {}
  const isProduce = meta.needsPaymentMethod && form.payment_method === "produce_trade"
  return {
    amount: isProduce ? form.produce_value : (form.amount || null),
    count: meta.needsCount ? Number(form.count) : null,
    payment_method: meta.needsPaymentMethod ? (form.payment_method || null) : null,
    produce_id: isProduce ? (Number(form.produce_id) || null) : null,
    produce_weight: isProduce ? (form.produce_weight || null) : null,
    produce_value: isProduce ? (form.produce_value || null) : null,
    entry_date: form.entry_date || null,
    note: (form.note || "").trim() || null,
  }
}
