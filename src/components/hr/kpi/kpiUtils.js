// src/components/hr/kpi/kpiUtils.js
// KPI v1.4.0 (handoff/api-handoff-kpi-v1.4.0.md) — labels, permissions, fiscal-year
// helpers and defensive number parsing. Plain .js (no components) for Fast Refresh.
import { can } from "../../../lib/permissions"

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

// ─── Score components (3L rework: the evaluatee's position decides the scheme) ─
// Maximums are NEVER hard-coded: they come from `ev.component_max` (every evaluation
// response) or, for a row without it, from the catalogue's `schemes[ev.scheme].components`.
/** component id (as in component_max) → evaluation field / endpoint / permission */
export const COMPONENT_META = {
  branch_head: { id: "branch_head", key: "branch_head_score", label: "หัวหน้าสาขา", short: "หส.", path: "branch-head-score", perm: "scoreBranchHead" },
  branch: { id: "branch", key: "branch_score_component", label: "ผลงานสาขา", short: "สาขา", auto: true },
  asst_manager: { id: "asst_manager", key: "asst_manager_score", label: "ผู้ช่วยผู้จัดการ", short: "ผช.", path: "asst-manager-score", perm: "scoreAsst" },
  manager: { id: "manager", key: "manager_score", label: "ผู้จัดการ", short: "ผจก.", path: "manager-score", perm: "scoreManager" },
  board: { id: "board", key: "board_score", label: "คณะกรรมการ", short: "กก.", path: "board-score", perm: "boardScore" },
}
const COMPONENT_ORDER = ["branch_head", "branch", "asst_manager", "manager", "board"]

/** which component the 12-item monthly form feeds, per scheme (catalogue wins when loaded) */
const INDIVIDUAL_FALLBACK = { staff: "branch_head", head: "manager", asst_manager: "manager", manager: "board" }

/** { branch: 30, … } for this evaluation, or null when neither source knows the scheme */
export function componentMaxOf(ev, catalogue) {
  const own = ev?.component_max
  if (own && typeof own === "object" && Object.keys(own).length) return own
  const s = ev?.scheme && catalogue?.schemes?.[ev.scheme]
  return s?.components && Object.keys(s.components).length ? s.components : null
}

/** [{ ...COMPONENT_META[id], max }] in display order — only the scheme's components */
export function componentsOf(ev, catalogue) {
  const max = componentMaxOf(ev, catalogue)
  if (!max) return []
  const ids = [...COMPONENT_ORDER.filter((id) => id in max), ...Object.keys(max).filter((id) => !COMPONENT_ORDER.includes(id))]
  return ids.map((id) => ({
    ...(COMPONENT_META[id] ?? { id, key: `${id}_score`, label: id, short: id }),
    max: num(max[id]),
  }))
}

/** component id fed by the monthly form for this evaluation's scheme */
export function individualComponentOf(ev, catalogue) {
  const fromCat = ev?.scheme && catalogue?.schemes?.[ev.scheme]?.individual_component
  return fromCat || INDIVIDUAL_FALLBACK[ev?.scheme] || null
}

/** sum of entered components (preview before finalize) */
export function partialTotal(ev, catalogue) {
  let sum = 0
  let any = false
  for (const c of componentsOf(ev, catalogue)) {
    const n = num(ev?.[c.key])
    if (n != null) { sum += n; any = true }
  }
  return any ? Math.round(sum * 100) / 100 : null
}

/** components of the scheme that have no score yet (auto `branch` included — finalize needs it) */
export function missingComponents(ev, catalogue) {
  return componentsOf(ev, catalogue).filter((c) => num(ev?.[c.key]) == null)
}

// ─── Grades (catalogue `grades`; tone is presentation only) ──────────────────
export const GRADE_TONE = { excellent: "success", good: "info", fair: "pending", improve: "danger" }

/** grade for a score from the catalogue bands (self-assessment preview only) */
export function gradeFor(score, catalogue) {
  const n = num(score)
  const bands = Array.isArray(catalogue?.grades) ? [...catalogue.grades].sort((a, b) => num(b.min) - num(a.min)) : []
  if (n == null || !bands.length) return null
  return bands.find((g) => n >= num(g.min)) ?? null
}

// ─── Monthly form helpers ────────────────────────────────────────────────────
const MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
export const DEFAULT_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]

/** calendar month 1–12 → "เม.ย." */
export const monthAbbr = (m) => MONTH_ABBR[Number(m) - 1] ?? String(m)

/** "เม.ย. 69" — BE year of that calendar month inside fiscal year `fy` (fy starts in April) */
export function fyMonthLabel(fy, m) {
  const y = Number(m) >= 4 ? Number(fy) : Number(fy) + 1
  return `${monthAbbr(m)} ${String(y).slice(-2)}`
}

/** fiscal year whose evaluation window started most recently (window = 1 มี.ค. of the CE year after FY start) */
export function latestWindowFiscalYear(date = new Date()) {
  const ce = date.getFullYear()
  return (date.getMonth() >= 2 ? ce - 1 : ce - 2) + 543
}

/** form item value clamp/validate: "" ok · NaN / out of range → message */
export function itemError(value, max) {
  if (value === "" || value == null) return ""
  const n = Number(value)
  if (!Number.isFinite(n)) return "กรอกเป็นตัวเลข"
  if (n < 0 || (max != null && n > max)) return `0–${fmtScore(max)}`
  return ""
}

// ─── Branch KPI (POST/GET /hr/kpi/branch — handoff G1) ──────────────────────
// The backend does NOT validate these: the frontend enforces 0 ≤ v ≤ max, ≤ 2 decimals, all six required.
export const BRANCH_KPI_FIELDS = [
  { key: "member_participation", label: "การมีส่วนร่วมของสมาชิก", max: 10 },
  { key: "online_market", label: "ตลาดออนไลน์", max: 10 },
  { key: "business_target", label: "ผลการดำเนินงานตามเป้าหมายธุรกิจ", max: 40 },
  { key: "debt_management", label: "การบริหารหนี้", max: 10 },
  { key: "internal_control", label: "การควบคุมภายใน", max: 20 },
  { key: "corporate_image", label: "ภาพลักษณ์องค์กร", max: 10 },
]
export const BRANCH_KPI_TOTAL = 100

/** "" when valid · "required" when empty · otherwise a Thai message */
export function branchKpiError(raw, max) {
  const s = String(raw ?? "").trim()
  if (s === "") return "required"
  if (!/^-?\d*\.?\d*$/.test(s) || !Number.isFinite(Number(s)) || s === "." || s === "-") return "กรอกเป็นตัวเลข"
  const n = Number(s)
  if (n < 0 || n > max) return `0–${fmtScore(max)}`
  if (/\.\d{3,}$/.test(s)) return "ทศนิยมไม่เกิน 2 ตำแหน่ง"
  return ""
}

// ─── Permissions → permission keys (src/lib/permissions.js) ─────────────────
const KPI_PERMISSION_KEYS = {
  scoreBranchHead: "hr.kpi.score.branchHead",
  scoreAsst: "hr.kpi.score.asstManager",
  scoreManager: "hr.kpi.score.manager",
  boardScore: "hr.kpi.score.board",
  viewList: "hr.kpi.evaluations.view",
  finalize: "hr.kpi.finalize",
  editWindow: "hr.kpi.window.set",
  asstReview: "hr.kpi.review.asstManager",
  managerApprove: "hr.kpi.approve.manager",
  reopen: "hr.kpi.reopen",
  eligibility: "hr.kpi.reopen", // PATCH .../eligibility อยู่ฟังก์ชันเดียวกับ reopen (matrix #88)
  profit: "hr.kpi.profit.record",
  monthly: "hr.kpi.monthly",
  branch: "hr.kpi.branch", // no 82 → backend kpi.branch (positions 101·102·103)
  // 3L rework
  monthlyForm: "hr.kpi.monthlyForm",
  notify: "hr.kpi.notify",
  selfView: "hr.kpi.selfAssessment.view",
  override: "hr.kpi.override",
}

/** { scoreAsst: true, … } for the current user (or the given role id) */
export function getKpiPerms(roleId) {
  return Object.fromEntries(
    Object.entries(KPI_PERMISSION_KEYS).map(([k, key]) => [k, roleId === undefined ? can(key) : can(key, roleId)]),
  )
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
