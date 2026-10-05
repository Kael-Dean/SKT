// src/components/hr/positionUtils.js
// Shared constants + formatters for 3D Positions & Salary Steps
// (handoff/api-handoff-payment-2.md §5). Plain .js so React Fast Refresh
// is not affected by non-component exports.

/** position_tier_id → ชื่อกระบอก (ตาม spec §5 — ห้ามแก้ชื่อเอง) */
export const POSITION_TIERS = [
  { id: 1, name: "ลูกจ้าง ร.1" },
  { id: 2, name: "ลูกจ้าง ร.2" },
  { id: 3, name: "เจ้าหน้าที่ ร.1" },
  { id: 4, name: "เจ้าหน้าที่ ร.2" },
  { id: 5, name: "เจ้าหน้าที่ ร.3" },
  { id: 6, name: "หัวหน้าแผนก / ผู้ช่วยหัวหน้าสาขา" },
  { id: 7, name: "หัวหน้าฝ่าย/สาขา" },
  { id: 8, name: "ผู้ช่วยผู้จัดการ" },
  { id: 9, name: "ผู้จัดการ" },
]

export const TIER_OPTIONS = POSITION_TIERS.map((t) => ({ value: String(t.id), label: t.name }))

export function tierName(id) {
  if (id == null || id === "") return null
  return POSITION_TIERS.find((t) => t.id === Number(id))?.name ?? `ระดับ ${id}`
}

/** เงินบาท (ทศนิยม 2) */
export const thb = (n) =>
  n == null || n === "" || Number.isNaN(Number(n))
    ? "—"
    : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** ตัวเลขธรรมดา */
export const nf = (n) =>
  n == null || n === "" || Number.isNaN(Number(n)) ? "—" : Number(n).toLocaleString("th-TH")

/** ขั้นเงินเดือน — แสดงทศนิยม 1 ตำแหน่งเสมอ (เช่น 4.5, 21.0) */
export const fmtLevel = (n) =>
  n == null || n === "" || Number.isNaN(Number(n)) ? "—" : Number(n).toFixed(1)

export function fmtDate(d) {
  if (!d) return "—"
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
}

/** ชื่อเต็มจาก record ของ /hr/personnel */
export const employeeName = (e) =>
  e ? `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() || `รหัส ${e.id}` : ""

/** ISO YYYY-MM-DD ของวันนี้ (local time) */
export function todayISO() {
  const d = new Date()
  const p = (x) => String(x).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** ข้อความ error จาก backend — แสดง `detail` ตามที่ backend ส่งมา (apiAuth แปลงไว้ใน err.message แล้ว) */
export const errText = (err, fallback = "ดำเนินการไม่สำเร็จ") => err?.message || fallback

/** เหตุผลมาตรฐานจาก backend → ข้อความไทย (อย่างอื่นแสดงตามจริง) */
const REASON_LABEL = {
  promotion_adjustment: "ปรับขั้นตามการเลื่อนตำแหน่ง",
  kpi_award: "เลื่อนขั้นจากผลประเมิน KPI",
  manual: "ปรับโดยฝ่ายบุคคล",
}
export const reasonLabel = (r) => (r ? REASON_LABEL[r] ?? r : "—")

/** ใช้ทั้ง `include_inactive=true` เพื่อให้ได้ตำแหน่งที่ปิดแล้วด้วย (ค่า default ของ BE คือ active เท่านั้น) */
export const POSITIONS_PATH = "/hr/positions?include_inactive=true"

/**
 * Query ของ salary-ladder: spec ใช้ `?tier=` แต่ backend รุ่นก่อนใช้ `tier_id` —
 * ส่งทั้งคู่ (FastAPI ไม่สนพารามิเตอร์ที่ไม่รู้จัก) จะได้ไม่พังไม่ว่าจะ deploy รุ่นไหน
 */
export const tierQuery = (tierId) => `tier=${Number(tierId)}&tier_id=${Number(tierId)}`

// ─── Shared class strings (match existing HR pages) ─────────────────────────
export const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
export const labelCls = "text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1"
export const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 h-10 text-sm font-semibold text-white shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
export const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 h-10 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
export const dangerBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-4 h-10 text-sm font-semibold text-white shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
export const linkBtn =
  "text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
export const cardCls =
  "rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm"
export const thCls = "px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400"
