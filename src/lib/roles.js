// src/lib/roles.js
// ─────────────────────────────────────────────────────────────────────────────
// Role ids ที่ backend ใส่ใน JWT claim `role` (int) — แหล่งความจริงเดียวของเลข role
// ฝั่ง frontend. Component ห้าม hardcode เลข role เอง: ใช้ permission key จาก
// src/lib/permissions.js (can / <Can> / <RequirePermission>) แทน
//
// Backend reference: auth.py → require_role(...)
//   1 Admin · 2 ผู้จัดการ · 3 HR · 4 หัวหน้าฝ่ายบัญชี/การเงิน · 5 พนักงาน
//   6 หัวหน้าสาขา/ฝ่าย (ฝั่ง server จำกัดให้เห็นเฉพาะสาขาบ้าน + สาขาที่ได้รับมอบหมาย)
//   7 ผู้ช่วยผู้จัดการ
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE = Object.freeze({
  ADMIN: 1,
  MANAGER: 2,
  HR: 3,
  HEAD_ACCOUNTANT: 4,
  STAFF: 5,
  BRANCH_HEAD: 6,
  ASSISTANT_MANAGER: 7,
})

/** ทุก role id เรียงตามเลข — ใช้วนสร้างคอลัมน์/ตัวเลือก */
export const ROLE_IDS = Object.freeze(Object.values(ROLE).sort((a, b) => a - b))

/** ชื่อเต็มภาษาไทย (ใช้ในข้อความ เช่น "ขั้นนี้รอหัวหน้าสาขา/ฝ่ายพิจารณา") */
export const ROLE_LABEL = Object.freeze({
  [ROLE.ADMIN]: "ผู้ดูแลระบบ",
  [ROLE.MANAGER]: "ผู้จัดการ",
  [ROLE.HR]: "ฝ่ายบุคคล",
  [ROLE.HEAD_ACCOUNTANT]: "หัวหน้าฝ่ายบัญชี/การเงิน",
  [ROLE.STAFF]: "พนักงาน",
  [ROLE.BRANCH_HEAD]: "หัวหน้าสาขา/ฝ่าย",
  [ROLE.ASSISTANT_MANAGER]: "ผู้ช่วยผู้จัดการ",
})

/** ชื่อย่อ — หัวคอลัมน์ตาราง / ที่แคบ */
export const ROLE_SHORT_LABEL = Object.freeze({
  [ROLE.ADMIN]: "Admin",
  [ROLE.MANAGER]: "ผจก.",
  [ROLE.HR]: "HR",
  [ROLE.HEAD_ACCOUNTANT]: "หน.บัญชี",
  [ROLE.STAFF]: "พนักงาน",
  [ROLE.BRANCH_HEAD]: "หน.สาขา",
  [ROLE.ASSISTANT_MANAGER]: "ผช.ผจก.",
})

/** สี badge ต่อ role (light + dark) — class เต็มเพื่อให้ Tailwind v4 สแกนเจอ */
export const ROLE_BADGE_TONE = Object.freeze({
  [ROLE.ADMIN]: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  [ROLE.MANAGER]: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  [ROLE.HR]: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  [ROLE.HEAD_ACCOUNTANT]: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  [ROLE.STAFF]: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  [ROLE.BRANCH_HEAD]: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  [ROLE.ASSISTANT_MANAGER]: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
})

export const DEFAULT_ROLE_BADGE_TONE = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"

/** ชื่อ role ภาษาไทย; ไม่รู้จัก → "Role N" (หรือ "—" ถ้าไม่มีค่า) */
export function roleLabel(id) {
  const n = Number(id)
  if (!Number.isFinite(n) || n <= 0) return "—"
  return ROLE_LABEL[n] ?? `Role ${n}`
}

export function roleShortLabel(id) {
  const n = Number(id)
  return ROLE_SHORT_LABEL[n] ?? roleLabel(n)
}

export function roleBadgeTone(id) {
  return ROLE_BADGE_TONE[Number(id)] ?? DEFAULT_ROLE_BADGE_TONE
}

/** ตัวเลือก role ตอนสร้าง/แก้ผู้ใช้ (ไม่รวม Admin — สร้างผ่านช่องทางผู้ดูแลระบบเท่านั้น) */
export const ASSIGNABLE_ROLE_OPTIONS = Object.freeze(
  ROLE_IDS.filter((id) => id !== ROLE.ADMIN).map((id) => ({ value: id, label: ROLE_LABEL[id] })),
)

/** ตัวเลือก role ทั้งหมด (ใช้กับตัวกรอง) */
export const ROLE_OPTIONS = Object.freeze(ROLE_IDS.map((id) => ({ value: id, label: ROLE_LABEL[id] })))
