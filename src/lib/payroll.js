// src/lib/payroll.js
// ─────────────────────────────────────────────────────────────────────────────
// ข้อมูลกลางของงานเงินเดือน (งวด 3 · 3C) — ใช้ร่วมกันระหว่างหน้า HR, ผู้จัดการ และสลิปของพนักงาน
//
//   ปีใน /hr/payroll* เป็น ค.ศ. เสมอ (ส่ง พ.ศ. → 422) — แปลงเป็น พ.ศ. เฉพาะตอนแสดงผล
//   งวด: draft (ร่าง: HR สร้าง + บันทึกหักภายนอก) → review (หัวหน้าฝ่ายอำนวยการตรวจ) → admin_checked (ผช.ผจก. ตรวจ)
//        → asst_checked (ผจก. อนุมัติ) → approved (HR ปิดงวด) → closed — ส่งกลับได้เฉพาะคนที่ถึงขั้นของตน (periodActionFor)
//   gross_income = เงินเดือน + ค่าตำแหน่ง + add_pending + add_holiday_pay + add_back_pay + add_welfare (3P)
//   สุทธิ = gross − (หักภายใน: ภาษีเงินได้ + เงินสะสม + ประกันสังคม + กองทุนสงเคราะห์เจ้าหน้าที่ + หนี้เงินกู้กองทุนฯ
//                  + หักภายนอก: กยศ. + สหกรณ์ออมทรัพย์ + เงินกู้ชมรม + อื่นๆ
//                  + งดจ่ายเงิน (ลาเกินสิทธิ์) + งดจ่าย (พักงาน) 3Q)
// ─────────────────────────────────────────────────────────────────────────────
import { fmtServerDateTime } from "./serverTime"

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
export const fmtDateTime = (iso) => fmtServerDateTime(iso, undefined, "—")

// ─── งวดเงินเดือน ─────────────────────────────────────────────────────────────

/** ป้ายสั้นบน stepper — ป้ายสถานะจริงบน badge ใช้ status_label ของ backend เสมอ (periodLabel) */
export const PERIOD_STEPS = [
  { key: "draft", label: "ร่าง" },
  { key: "review", label: "ฝ่ายอำนวยการตรวจ" },
  { key: "admin_checked", label: "ผช.ผจก.ตรวจ" },
  { key: "asst_checked", label: "ผจก.อนุมัติ" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "closed", label: "ปิดงวด" },
]

export const PERIOD_TONE = {
  draft: "neutral", review: "pending", admin_checked: "pending", asst_checked: "pending", approved: "info", closed: "success",
}

export const periodStepIndex = (status) => Math.max(0, PERIOD_STEPS.findIndex((s) => s.key === status))

export const periodLabel = (p) => p?.status_label || PERIOD_STEPS.find((s) => s.key === p?.status)?.label || "—"

/** GET /hr/payroll/periods อาจตอบเป็น array หรือ { items } */
export const periodList = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : Array.isArray(d?.periods) ? d.periods : [])

/** สิทธิ์ที่ตัดสินว่าใครลงมือในขั้นไหน — ส่ง can จาก useCan() เข้ามา */
export const periodPerms = (can) => ({
  checkAdmin: can("hr.payroll.check.admin"),
  checkAsst: can("hr.payroll.check.asst"),
  approve: can("hr.payroll.period.approve"),
})

/**
 * งวดจาก backend รุ่นก่อน PR 74 (ไม่มี external_missing): ยังเป็น review → approve ขั้นเดียว
 * หน้าเว็บอาจ deploy ก่อน backend — ถ้าไม่แยก ผู้จัดการจะกดอนุมัติงวดไม่ได้เลย
 */
export const isLegacyPeriod = (p) => p != null && p.external_missing === undefined

/**
 * จุดเดียวที่ตัดสินว่าผู้ใช้คนนี้ทำอะไรกับงวดได้ — ไม่มีคีย์นี้ = ไม่มีปุ่ม (หัวหน้าฝ่ายบัญชีจึงไม่มีปุ่มเสมอ)
 * ตรงกับ _RETURN_FROM ของ backend: แต่ละคนส่งกลับได้เฉพาะขั้นของตน + ผู้จัดการที่ approved
 * @returns {{ action: "adminCheck"|"asstCheck"|"approve"|null, canReturn: boolean }}
 */
export function periodActionFor(status, perms, { legacy = false } = {}) {
  const act = (allowed, action) => (allowed ? { action, canReturn: true } : { action: null, canReturn: false })
  switch (status) {
    case "review": return legacy ? act(perms.approve, "approve") : act(perms.checkAdmin, "adminCheck")
    case "admin_checked": return act(perms.checkAsst, "asstCheck")
    case "asst_checked": return act(perms.approve, "approve")
    case "approved": return act(perms.approve, null)
    default: return { action: null, canReturn: false }
  }
}

export const periodActionOf = (period, perms) => periodActionFor(period?.status, perms, { legacy: isLegacyPeriod(period) })

/** ข้อความสำหรับคนที่ไม่ได้อยู่ในขั้นนี้ — บอกว่ากำลังรอใคร */
export function periodWaitingOn(period) {
  switch (period?.status) {
    case "review": return isLegacyPeriod(period) ? "รอผู้จัดการตรวจสอบ" : "รอหัวหน้าฝ่ายอำนวยการตรวจสอบ"
    case "admin_checked": return "รอผู้ช่วยผู้จัดการตรวจสอบ"
    case "asst_checked": return "รอผู้จัดการอนุมัติ"
    default: return null
  }
}

/** ปุ่มขั้นตรวจสอบ/อนุมัติ — ใช้ร่วมกันระหว่างการ์ดงวดและแผงรอตรวจสอบ/อนุมัติ */
export const PERIOD_STEP_ACTIONS = {
  adminCheck: {
    path: ({ year, month }) => `/hr/payroll/periods/${year}/${month}/admin-check`,
    title: (l) => `ยืนยันการตรวจสอบงวด ${l}`,
    description: "งวดจะส่งต่อให้ผู้ช่วยผู้จัดการตรวจสอบ และหัวหน้าฝ่ายบัญชีจะเริ่มดูและดาวน์โหลดรายงานของเดือนนี้ได้",
    confirmLabel: "ตรวจสอบผ่าน", loadingLabel: "กำลังบันทึก…", success: "ตรวจสอบงวดแล้ว", next: "ส่งต่อให้ผู้ช่วยผู้จัดการแล้ว",
  },
  asstCheck: {
    path: ({ year, month }) => `/hr/payroll/periods/${year}/${month}/asst-check`,
    title: (l) => `ยืนยันการตรวจสอบงวด ${l}`,
    description: "งวดจะส่งต่อให้ผู้จัดการอนุมัติ",
    confirmLabel: "ตรวจสอบผ่าน", loadingLabel: "กำลังบันทึก…", success: "ตรวจสอบงวดแล้ว", next: "ส่งต่อให้ผู้จัดการแล้ว",
  },
  approve: {
    path: ({ year, month }) => `/hr/payroll/periods/${year}/${month}/approve`,
    title: (l) => `อนุมัติงวด ${l}`,
    description: "เมื่ออนุมัติ เจ้าหน้าที่จะเห็นสลิปของเดือนนี้ทันที และฝ่ายบุคคลจะแก้ไขเงินเดือนไม่ได้จนกว่าจะส่งกลับ",
    confirmLabel: "อนุมัติ", loadingLabel: "กำลังอนุมัติ…", success: "อนุมัติงวดแล้ว", next: "เจ้าหน้าที่เห็นสลิปของเดือนนี้แล้ว",
  },
}

/** เงินสะสมของคนนี้ (reserve_rate_pct) — null = อัตราขั้นต่ำ */
export const reserveRateText = (v) => (v == null || v === "" ? "5% (ขั้นต่ำ)" : `${Number(v)}%`)

// ─── บรรทัดในสลิป ────────────────────────────────────────────────────────────

/** รายได้ — ลำดับเดียวกับสลิป PDF */
export const INCOME_LINES = [
  { key: "base_salary", label: "เงินเดือน" },
  { key: "position_allowance", label: "ค่าตำแหน่ง" },
  { key: "add_pending", label: "เงินเพิ่มอื่น ๆ" },
  { key: "add_holiday_pay", label: "ค่าทำงานวันหยุด" },
  { key: "add_back_pay", label: "เงินเลื่อนขั้นพิเศษตกเบิก" },
  // 3P — สวัสดิการที่อนุมัติแบบจ่ายผ่านเงินเดือน (payout_route = payroll); ไม่คิดภาษี
  { key: "add_welfare", label: "เงินช่วยเหลือสวัสดิการ" },
]

/** deduct_extra_leave — ต้องใช้คำว่า "งดจ่ายเงิน" เสมอ ห้ามใช้ "หักเงิน" (AMC: หักเงินกรณีนี้ทำไม่ได้ตามกฎหมาย) */
export const EXTRA_LEAVE_LABEL = "งดจ่ายเงิน (ลาเกินสิทธิ์)"

/** deduct_suspension (3Q) — ใช้คำว่า "งดจ่าย" เช่นเดียวกัน */
export const SUSPENSION_LABEL = "งดจ่าย (พักงาน)"

/** รายการหักภายใน — ระบบรู้ยอดเอง · ลำดับและป้ายเดียวกับสลิป PDF */
export const INTERNAL_DEDUCTION_LINES = [
  { key: "income_tax", label: "ภาษีเงินได้" },
  { key: "deduct_reserve", label: "เงินสะสม" },
  { key: "deduct_ss", label: "ประกันสังคม" },
  // ชื่อ field เดิม deduct_prov (เคยเป็นกองทุนสำรองเลี้ยงชีพ) — backend คงไว้
  { key: "deduct_prov", label: "กองทุนสงเคราะห์เจ้าหน้าที่" },
  { key: "deduct_loan", label: "หนี้เงินกู้กองทุนสงเคราะห์เจ้าหน้าที่" },
]

/** รายการหักภายนอก — ฝ่ายบุคคลบันทึกรายเดือนจากเอกสาร (HRPayrollExternalPanel) */
export const EXTERNAL_DEDUCTION_LINES = [
  { key: "deduct_slf", label: "กยศ." },
  { key: "deduct_coop", label: "เงินนำส่งสหกรณ์ออมทรัพย์" },
  { key: "deduct_club_loan", label: "เงินกู้ชมรมเจ้าหน้าที่" },
  { key: "deduct_other", label: "อื่นๆ", noteKey: "deduct_other_note" },
]

/** งดจ่าย — ไม่ใช่ "หักเงิน" (ดู EXTRA_LEAVE_LABEL) */
export const UNPAID_DEDUCTION_LINES = [
  { key: "deduct_extra_leave", label: EXTRA_LEAVE_LABEL },
  // 3Q — คำสั่งพักงาน (ขั้น 6): อัตรารายวัน × วันทำงานที่ถูกพักในเดือนนั้น
  { key: "deduct_suspension", label: SUSPENSION_LABEL },
]

/** ทุกบรรทัดที่หักจากรายได้รวม */
export const DEDUCTION_LINES = [...INTERNAL_DEDUCTION_LINES, ...EXTERNAL_DEDUCTION_LINES, ...UNPAID_DEDUCTION_LINES]

/** ยอดหักรวม — ใช้ค่าจาก backend ถ้ามี, ไม่งั้นรวมจากบรรทัด, ไม่มีบรรทัดเลย → gross − net */
export function totalDeductions(p) {
  if (!p) return null
  if (p.total_deductions != null) return Number(p.total_deductions)
  if (DEDUCTION_LINES.some((l) => p[l.key] != null)) return DEDUCTION_LINES.reduce((s, l) => s + toNum(p[l.key]), 0)
  const net = p.final_payout ?? p.net_payout
  // net = gross − หัก + ชำระส่วนขาด (PR 107) → บวกกลับเพื่อให้ได้ยอดหักจริง
  if (p.gross_income != null && net != null) return Number(p.gross_income) - Number(net) + toNum(p.shortfall_paid)
  return null
}

export const netOf = (p) => p?.final_payout ?? p?.net_payout ?? null

// ─── บันทึกรายการหักภายนอก (GET/PUT /hr/payroll/external/{y}/{m}) ───────────────
//   คิดเป็นสตางค์ (จำนวนเต็ม) ทั้งหมด เพื่อไม่ให้ทศนิยมลอยตัวทำยอดเพี้ยน
//   ฟอร์มหนึ่งคน = { slf, coop, club_loan, other, other_note } เป็น string ตามที่พิมพ์

export const EXTERNAL_AMOUNT_COLUMNS = [
  { key: "slf", label: "กยศ.", short: "กยศ." },
  { key: "coop", label: "เงินนำส่งสหกรณ์ออมทรัพย์", short: "สหกรณ์ออมทรัพย์" },
  { key: "club_loan", label: "เงินกู้ชมรมเจ้าหน้าที่", short: "ชมรมเจ้าหน้าที่" },
  { key: "other", label: "อื่นๆ", short: "อื่นๆ" },
]

const AMOUNT_KEYS = EXTERNAL_AMOUNT_COLUMNS.map((c) => c.key)
const AMOUNT_PATTERN = /^(\d+(\.\d{0,2})?|\.\d{1,2})$/
const MAX_AMOUNT_CENTS = 999999999999 // Numeric(12, 2)
const cleanAmount = (v) => String(v ?? "").replace(/,/g, "").trim()
const savedCents = (v) => Math.round(toNum(v) * 100)

/** ที่พิมพ์ → สตางค์ · ว่าง = 0 · รูปแบบผิด = NaN ("1,500" และ "700.5" ใช้ได้) */
export function amountCents(v) {
  const s = cleanAmount(v)
  if (s === "") return 0
  if (!AMOUNT_PATTERN.test(s)) return NaN
  const [whole, frac = ""] = s.split(".")
  return Number(whole || 0) * 100 + Number(frac.padEnd(2, "0"))
}

const amountInputText = (v) => {
  const n = toNum(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** แถวจาก backend → ค่าในฟอร์ม — ยังไม่ keyed แสดงช่องว่าง (backend ส่ง 0 มา แต่ยังไม่ได้แปลว่ากรอก 0) */
export const externalFormFrom = (row) => ({
  ...Object.fromEntries(AMOUNT_KEYS.map((k) => [k, row.keyed ? amountInputText(row[k]) : ""])),
  other_note: row.other_note ?? "",
})

export const externalIsBlank = (f) => AMOUNT_KEYS.every((k) => cleanAmount(f?.[k]) === "")

/** ใช้รายละเอียดเฉพาะเมื่อ "อื่นๆ" > 0 (ช่องปิดเมื่อเป็น 0) */
const effectiveNote = (f) => (amountCents(f?.other) > 0 ? String(f?.other_note ?? "").trim() : "")

/**
 * ต้องบันทึกแถวนี้ไหม — ยังไม่ keyed: พิมพ์อะไรก็นับ รวมถึง 0 (ว่างทุกช่อง = ไม่ส่ง)
 * keyed แล้ว: เทียบตัวเลข ("700.50" == "700.5"), ช่องว่าง = 0
 */
export function externalIsDirty(row, f) {
  if (!f) return false
  if (!row.keyed) return !externalIsBlank(f)
  if (AMOUNT_KEYS.some((k) => amountCents(f[k]) !== savedCents(row[k]))) return true
  const savedNote = savedCents(row.other) > 0 ? String(row.other_note ?? "").trim() : ""
  return effectiveNote(f) !== savedNote
}

/** ข้อผิดพลาดของแถว { slf?, coop?, club_loan?, other?, other_note? } — ไม่มี = {} */
export function externalErrors(f) {
  const errs = {}
  for (const k of AMOUNT_KEYS) {
    const c = amountCents(f[k])
    if (Number.isNaN(c)) errs[k] = "ตัวเลข ≥ 0 ทศนิยมไม่เกิน 2 ตำแหน่ง"
    else if (c > MAX_AMOUNT_CENTS) errs[k] = "ยอดสูงเกินไป"
  }
  if (!errs.other && amountCents(f.other) > 0 && !effectiveNote(f)) errs.other_note = "ระบุรายละเอียด"
  return errs
}

/** แถวที่ผ่าน externalErrors → entry ของ PUT — ส่งครบทุกช่องเสมอ เพราะ entry แทนที่ยอดทั้งสี่ของคนนั้น */
export const externalEntry = (row, f) => ({
  employee_id: row.employee_id,
  ...Object.fromEntries(AMOUNT_KEYS.map((k) => [k, (amountCents(f[k]) / 100).toFixed(2)])),
  other_note: effectiveNote(f) || null,
})

/** รวมสตางค์รายช่อง + total — ช่องที่พิมพ์ผิดนับเป็น 0 (จะถูก externalErrors กันก่อนบันทึก) */
export function externalTotals(forms) {
  const totals = { total: 0, ...Object.fromEntries(AMOUNT_KEYS.map((k) => [k, 0])) }
  for (const f of forms) {
    for (const k of AMOUNT_KEYS) {
      const c = amountCents(f?.[k])
      if (!Number.isNaN(c)) { totals[k] += c; totals.total += c }
    }
  }
  return totals
}

export const moneyFromCents = (c) => money(c / 100)

// ─── ลูกจ้างรายวัน (3C daily-paid, migration section21C2_payroll_daily) ─────────
//   financial.pay_basis "monthly" | "daily" — รายวันได้ ค่าจ้างรายวัน (settings.daily_wage, ค่าเริ่มต้น 351) × วันที่ HR บันทึก
//   payout.days_worked — null สำหรับพนักงานรายเดือน
//   backend ที่ยังไม่ migrate จะไม่มี field เหล่านี้ → หน้าเว็บซ่อนส่วนที่เกี่ยวข้อง

export const PAY_BASIS_OPTIONS = [
  { value: "monthly", label: "รายเดือน" },
  { value: "daily", label: "รายวัน" },
]

export const payBasisLabel = (v) => PAY_BASIS_OPTIONS.find((o) => o.value === v)?.label ?? null

/** จำนวนวัน: 22 → "22", 20.5 → "20.5" */
export const fmtWorkDays = (v) => {
  const n = Number(v)
  if (v == null || v === "" || !Number.isFinite(n)) return "—"
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
}

/** ค่าจ้างต่อวันของ payout รายวัน = base_salary ÷ days_worked (backend คิด daily_wage × days) */
export function dailyRateOf(p) {
  const days = Number(p?.days_worked)
  const base = Number(p?.base_salary)
  if (!p || p.days_worked == null || !Number.isFinite(days) || days <= 0 || !Number.isFinite(base)) return null
  return base / days
}

/** "22 วัน × 351" — null เมื่อเป็นพนักงานรายเดือน */
export function daysWorkedText(p) {
  if (p?.days_worked == null) return null
  const rate = dailyRateOf(p)
  const days = `${fmtWorkDays(p.days_worked)} วัน`
  if (rate == null) return days
  const r = Number.isInteger(Math.round(rate * 100) / 100) ? Math.round(rate).toLocaleString("th-TH") : money(rate)
  return `${days} × ${r}`
}

/** จำนวนวันที่บันทึกได้: 0–31 ทีละครึ่งวัน */
export function validWorkDays(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 31 && Math.abs(n * 2 - Math.round(n * 2)) < 1e-9
}

/**
 * รายการที่ถูกข้ามจาก generate-bulk / recalculate (`errors`) → [{ key, name, text }]
 * รูปแบบที่รองรับ: string · { employee_id, employee_name, detail|error|message|reason }
 */
export function skippedFrom(res) {
  const list = Array.isArray(res?.errors) ? res.errors : []
  return list.map((e, i) => {
    if (typeof e === "string") return { key: `e${i}`, name: null, text: e }
    const id = e?.employee_id ?? e?.user_id ?? null
    const name = e?.employee_name ?? e?.name ?? (id != null ? `รหัส ${id}` : null)
    const text = e?.detail ?? e?.error ?? e?.message ?? e?.reason ?? "คำนวณไม่สำเร็จ"
    return { key: id != null ? `id${id}` : `e${i}`, name, text: typeof text === "string" ? text : JSON.stringify(text) }
  })
}
