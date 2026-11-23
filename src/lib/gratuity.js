// src/lib/gratuity.js
// ─────────────────────────────────────────────────────────────────────────────
// บำเหน็จเจ้าหน้าที่ (staff gratuity reserve) — API + ปีบัญชี + ป้ายภาษาไทย
//   backend: um_backend Phase3/savings_router.py (gratuity.view / gratuity.record)
//
//   GET   /hr/gratuity?fiscal_year=2569                       ทะเบียนรายปีบัญชี + ยอดรวมเทียบปีก่อน
//   POST  /hr/gratuity/{fy}/calculate?dry_run=&overwrite=     คำนวณ (dry_run=true = ดูตัวอย่าง ไม่บันทึก)
//   PATCH /hr/gratuity/{id}                                   แก้ด้วยมือ → source "manual" (คำนวณรอบหน้าคงไว้)
//   GET   /hr/employees/{id}/gratuity?exit_date=YYYY-MM-DD    ประวัติ + ประมาณการหากออกวันนั้น
//   GET   /personnel/me/gratuity                              ของฉัน (ประมาณการ ณ วันนี้)
//
// ปีบัญชี = พ.ศ. 1 เม.ย. – 31 มี.ค. (ปีบัญชี 2569 = 1 เม.ย. 2569 – 31 มี.ค. 2570)
// บำเหน็จ = เงินเดือนเดือนสุดท้าย × จำนวนปีที่นับ · ปีที่ทำงานสุทธิ (หักวันลาป่วย/ลากิจ/ลาคลอด) ไม่ถึง 180 วันไม่นับ
// ทำงานไม่ถึง 5 ปี ไม่มีสิทธิ์รับ (exit_eligible false → amount 0)
// เงินมาเป็น Decimal string — แปลงด้วย toNum() ก่อนคำนวณ แสดงผลด้วย money()
// ─────────────────────────────────────────────────────────────────────────────
import { apiAuth } from "./api"

export const GRATUITY_MIN_YEARS = 5
export const GRATUITY_MIN_DAYS = 180
/** ช่วงปีบัญชีที่ backend รับ (POST calculate) */
export const FY_MIN = 2560
export const FY_MAX = 2700

// ─── ปีบัญชี ─────────────────────────────────────────────────────────────────

/** ปีบัญชี (พ.ศ.) ของวันที่ — ขึ้นปีใหม่วันที่ 1 เม.ย. */
export function gratuityFiscalYear(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  return d.getMonth() >= 3 ? y + 543 : y + 542
}

const TH_MONTH_SHORT = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.".split(" ")

/** "1 เม.ย. 2569 – 31 มี.ค. 2570" */
export function fiscalYearRangeText(fy) {
  const n = Number(fy)
  if (!Number.isFinite(n)) return ""
  return `1 ${TH_MONTH_SHORT[3]} ${n} – 31 ${TH_MONTH_SHORT[2]} ${n + 1}`
}

/** ตัวเลือก SelectDropdown — ปีปัจจุบันย้อนหลัง `back` ปี และล่วงหน้า `ahead` ปี (ใหม่ → เก่า) */
export function fiscalYearOptions(current = gratuityFiscalYear(), { back = 5, ahead = 1 } = {}) {
  const out = []
  for (let fy = current + ahead; fy >= current - back; fy -= 1) {
    if (fy < FY_MIN || fy > FY_MAX) continue
    out.push({
      value: String(fy),
      label: `ปีบัญชี ${fy}${fy === current ? " (ปีปัจจุบัน)" : ""}`,
      sublabel: fiscalYearRangeText(fy),
    })
  }
  return out
}

// ─── ตัวเลข ──────────────────────────────────────────────────────────────────

/** Decimal string → number | null (ว่าง/ไม่ใช่ตัวเลข = null) */
export function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** ทิศทางของผลต่าง: "up" | "down" | "flat" | null */
export function diffDirection(v) {
  const n = toNum(v)
  if (n == null) return null
  if (Math.abs(n) < 0.005) return "flat"
  return n > 0 ? "up" : "down"
}

// ─── ป้าย ────────────────────────────────────────────────────────────────────

export const FUNDING_OPTIONS = [
  { value: "ดำเนินงาน", label: "ดำเนินงาน" },
  { value: "ธ.จัดหาฯ", label: "ธ.จัดหาฯ" },
]

export const STATUS_OPTIONS = [
  { value: "active", label: "ยังทำงาน", sublabel: "นับรวมในยอดสำรองของปี" },
  { value: "left", label: "พ้นสภาพ", sublabel: "ไม่นับรวมในยอดสำรองของปี" },
]

const STATUS_LABEL = { active: "ยังทำงาน", left: "พ้นสภาพ" }
const STATUS_TONE = { active: "success", left: "neutral" }
export const statusLabel = (s) => STATUS_LABEL[s] ?? s ?? "—"
export const statusTone = (s) => STATUS_TONE[s] ?? "neutral"

const SOURCE_LABEL = { calc: "คำนวณ", import: "นำเข้า", manual: "แก้ไขเอง" }
const SOURCE_TONE = { calc: "info", import: "neutral", manual: "pending" }
const SOURCE_HINT = {
  calc: "ระบบคำนวณจากวันลาและเงินเดือน",
  import: "นำเข้าจากทะเบียนเดิม — คำนวณรอบหน้าจะคงไว้",
  manual: "ฝ่ายบุคคลแก้ไขด้วยมือ — คำนวณรอบหน้าจะคงไว้",
}
export const sourceLabel = (s) => SOURCE_LABEL[s] ?? s ?? "—"
export const sourceTone = (s) => SOURCE_TONE[s] ?? "neutral"
export const sourceHint = (s) => SOURCE_HINT[s] ?? ""

// ─── API ─────────────────────────────────────────────────────────────────────

/** GratuityList — fiscal_year ว่าง = ปีปัจจุบันตาม backend */
export function fetchGratuityList(fiscalYear) {
  const q = fiscalYear ? `?fiscal_year=${encodeURIComponent(fiscalYear)}` : ""
  return apiAuth(`/hr/gratuity${q}`)
}

/** CalcRun — dryRun true = ดูตัวอย่าง (ไม่บันทึก) */
export function calculateGratuity(fiscalYear, { dryRun = true, overwrite = false } = {}) {
  const q = `dry_run=${dryRun ? "true" : "false"}&overwrite=${overwrite ? "true" : "false"}`
  return apiAuth(`/hr/gratuity/${encodeURIComponent(fiscalYear)}/calculate?${q}`, { method: "POST" })
}

/** PATCH บางช่อง: { last_salary, years_counted, funding, status, note } → GratuityOut */
export function patchGratuity(recordId, body) {
  return apiAuth(`/hr/gratuity/${encodeURIComponent(recordId)}`, { method: "PATCH", body })
}

/** EmployeeGratuity ของเจ้าหน้าที่ (HR) — exitDate ISO "YYYY-MM-DD" (ว่าง = วันนี้) */
export function fetchEmployeeGratuity(employeeId, exitDate) {
  const q = exitDate ? `?exit_date=${encodeURIComponent(exitDate)}` : ""
  return apiAuth(`/hr/employees/${encodeURIComponent(employeeId)}/gratuity${q}`)
}

/** EmployeeGratuity ของผู้ใช้ที่ล็อกอิน (ประมาณการ ณ วันนี้) */
export function fetchMyGratuity() {
  return apiAuth("/personnel/me/gratuity")
}

/** ประวัติเรียงปีใหม่ → เก่า */
export function sortHistoryDesc(history) {
  return (Array.isArray(history) ? [...history] : []).sort((a, b) => (b.fiscal_year ?? 0) - (a.fiscal_year ?? 0))
}
