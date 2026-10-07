// src/components/hr/kpi/kpiUtils.js
// KPI v1.4.0 (handoff/api-handoff-kpi-v1.4.0.md) — labels, permissions, fiscal-year
// helpers and defensive number parsing. Plain .js (no components) for Fast Refresh.
import { getRoleId } from "../../../lib/auth"

// ─── Numbers (Decimal fields can arrive as strings) ─────────────────────────
/** number | null — "95.00" → 95, "" / null / NaN → null */
export function num(v) {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : Number(String(v).trim())
  return Number.isFinite(n) ? n : null
}

/** score display: 40 → "40", 39.5 → "39.5", null → "—" */
export function fmtScore(v) {
  const n = num(v)
  if (n == null) return "—"
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
}

/** step display: 1 → "1.0", 0.5 → "0.5", null → "—" */
export function fmtStep(v) {
  const n = num(v)
  return n == null ? "—" : n.toFixed(1)
}

// ─── Status / pending labels (spec "Enums & Constants") ─────────────────────
export const STATUS = {
  open: { label: "กำลังประเมิน", tone: "neutral" },
  returned: { label: "ส่งกลับแก้ไข", tone: "pending" },
  finalized: { label: "รอผู้ช่วยผู้จัดการตรวจสอบ", tone: "info" },
  asst_reviewed: { label: "รอผู้จัดการอนุมัติ", tone: "info" },
  approved: { label: "อนุมัติแล้ว", tone: "success" },
}
export const STATUS_ORDER = ["open", "returned", "finalized", "asst_reviewed", "approved"]

export const PENDING = {
  pending: { label: "รอผลประกอบการ (+0.5 ขั้น)", tone: "pending" },
  confirmed: { label: "ได้รับ +0.5 ขั้นแล้ว", tone: "success" },
  cancelled: { label: "ไม่ได้รับ (ขาดทุน)", tone: "neutral" },
}

export const PROFIT_LABEL = { profit: "กำไร", loss: "ขาดทุน" }

/** score components — max points (staff split 42/28/20/10) */
export const COMPONENTS = [
  { key: "branch_head_score", label: "หัวหน้าสาขา", short: "หส.", max: 42 },
  { key: "branch_score_component", label: "ผลงานสาขา", short: "สาขา", max: 28 },
  { key: "asst_manager_score", label: "ผู้ช่วยผู้จัดการ", short: "ผช.", max: 20 },
  { key: "manager_score", label: "ผู้จัดการ", short: "ผจก.", max: 10 },
]

/** sum of entered components (preview before finalize) */
export function partialTotal(ev) {
  let sum = 0
  let any = false
  for (const c of COMPONENTS) {
    const n = num(ev?.[c.key])
    if (n != null) { sum += n; any = true }
  }
  return any ? Math.round(sum * 100) / 100 : null
}

// ─── Permissions (role ids from the JWT — spec "Roles") ─────────────────────
const ROLE_PERMS = {
  scoreBranchHead: [1, 6],
  scoreAsst: [1, 2, 7],
  scoreManager: [1, 2],
  boardScore: [1, 2],
  viewList: [1, 2, 3, 7],
  finalize: [1, 3],
  editWindow: [1, 2, 3],
  asstReview: [1, 7],
  managerApprove: [1, 2],
  reopen: [1, 2, 7],
  eligibility: [1, 2, 7],
  profit: [1, 2],
  monthly: [1, 3],
}

/** { scoreAsst: true, … } for the current user */
export function getKpiPerms(roleId = getRoleId()) {
  return Object.fromEntries(Object.entries(ROLE_PERMS).map(([k, roles]) => [k, roles.includes(roleId)]))
}

// ─── Fiscal year (backend: BE year it STARTS in — 2569 = 1 เม.ย. 2569 – 31 มี.ค. 2570) ──
const pad = (x) => String(x).padStart(2, "0")
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

/** fiscal year (BE) that contains `date` */
export function currentFiscalYear(date = new Date()) {
  const ce = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
  return ce + 543
}

/** "2569 (1 เม.ย. 2569 – 31 มี.ค. 2570)" */
export function fyLabel(fy) {
  const y = Number(fy)
  return `${y} (${fyRange(y)})`
}
export const fyRange = (fy) => `1 เม.ย. ${Number(fy)} – 31 มี.ค. ${Number(fy) + 1}`

export function fyOptions(center = currentFiscalYear()) {
  const out = []
  for (let y = center + 1; y >= center - 3; y--) {
    out.push({ value: String(y), label: String(y), sublabel: fyRange(y) })
  }
  return out
}

/** earliest settlement month "YYYY-MM": April after the fiscal year ends */
export const minSettlementMonth = (fy) => `${Number(fy) - 543 + 1}-04`

/** ISO "YYYY-MM-DD" → "1 มี.ค. 2570" (parsed as a local date, no TZ shift) */
export function fmtDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""))
  if (!m) return iso ? String(iso) : "—"
  return `${Number(m[3])} ${TH_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}`
}

/** ISO "YYYY-MM(-DD)" → "ก.ค. 2570" */
export function fmtMonthTH(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ""))
  if (!m) return iso ? String(iso) : "—"
  return `${TH_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}`
}

export function todayLocalISO() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "open" | "before" | "after" | null relative to today */
export function windowPhase(info, today = todayLocalISO()) {
  const s = info?.window_start?.slice(0, 10)
  const e = info?.window_end?.slice(0, 10)
  if (!s || !e) return null
  if (today < s) return "before"
  if (today > e) return "after"
  return "open"
}

/** scores editable for this row? (window open, or status returned) */
export function canEditScores(ev, phase) {
  if (ev?.status === "returned") return true
  return ev?.status === "open" && phase === "open"
}

/** manager-approve skip reason that asks for board_reference */
export const needsBoardRef = (reason) => /board_reference|มติคณะกรรมการ/.test(String(reason ?? ""))
