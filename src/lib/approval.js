// src/lib/approval.js
// Shared approval-chain helpers for 3B (leave) and 3O (out-of-office).
// Source of truth: api-handoff งวด 2, section 1.
//
// NOTE: role numbers here follow the backend JWT `role` as documented in the
// handoff (5 = Staff, 6 = หัวหน้าสาขา, 7 = ผู้ช่วยผู้จัดการ). This differs from
// the older ROLE map in App.jsx (MKT 5 / STAFF 7) — always use APPROVAL_ROLE
// for anything approval-related.
import { getRoleId, getUser } from "./auth"

export const APPROVAL_ROLE = {
  ADMIN: 1,
  MANAGER: 2,
  HR: 3,
  HEAD_ACCOUNTANT: 4,
  STAFF: 5,
  BRANCH_HEAD: 6,
  ASSISTANT_MANAGER: 7,
}

export const ROLE_LABEL = {
  1: "ผู้ดูแลระบบ",
  2: "ผู้จัดการ",
  3: "ฝ่ายบุคคล",
  4: "หัวหน้าฝ่ายบัญชี",
  5: "เจ้าหน้าที่",
  6: "หัวหน้าสาขา",
  7: "ผู้ช่วยผู้จัดการ",
}

export const STATUS = {
  PENDING_BRANCH_HEAD: "pending_branch_head",
  PENDING_ASSISTANT_MANAGER: "pending_assistant_manager",
  PENDING_MANAGER: "pending_manager",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
}

export const STATUS_LABEL = {
  pending_branch_head: "รอหัวหน้าสาขาอนุมัติ",
  pending_assistant_manager: "รอผู้ช่วยผู้จัดการอนุมัติ",
  pending_manager: "รอผู้จัดการยืนยัน",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  // leave uses "denied" for rejected
  denied: "ไม่อนุมัติ",
  cancelled: "ยกเลิกแล้ว",
}

// Tailwind classes per status (light + dark)
export const STATUS_TONE = {
  pending_branch_head: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  pending_assistant_manager: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  pending_manager: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  denied: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
}

export const statusLabel = (s) => STATUS_LABEL[s] || s || "-"
export const statusTone = (s) => STATUS_TONE[s] || STATUS_TONE.cancelled
export const isPendingStatus = (s) => typeof s === "string" && s.startsWith("pending")

// Which role decides at each stage (admin may act at any stage).
export const STAGE_ROLE = {
  pending_branch_head: APPROVAL_ROLE.BRANCH_HEAD,
  pending_assistant_manager: APPROVAL_ROLE.ASSISTANT_MANAGER,
  pending_manager: APPROVAL_ROLE.MANAGER,
}

// Approve endpoint suffix per stage (same names for leave and 3O).
export const STAGE_APPROVE_ACTION = {
  pending_branch_head: "branch-head-approve",
  pending_assistant_manager: "approve",
  pending_manager: "manager-confirm",
}

export const STAGE_APPROVE_LABEL = {
  pending_branch_head: "อนุมัติ (หัวหน้าสาขา)",
  pending_assistant_manager: "อนุมัติ (ผู้ช่วยผู้จัดการ)",
  pending_manager: "ยืนยัน (ผู้จัดการ)",
}

/** The pending status the current user is responsible for, or null. */
export function myStageStatus(roleId = getRoleId()) {
  if (roleId === APPROVAL_ROLE.BRANCH_HEAD) return STATUS.PENDING_BRANCH_HEAD
  if (roleId === APPROVAL_ROLE.ASSISTANT_MANAGER) return STATUS.PENDING_ASSISTANT_MANAGER
  if (roleId === APPROVAL_ROLE.MANAGER) return STATUS.PENDING_MANAGER
  return null
}

/** Roles that ever approve something (used to show approval UI / inbox). */
export function isApproverRole(roleId = getRoleId()) {
  return [
    APPROVAL_ROLE.ADMIN,
    APPROVAL_ROLE.MANAGER,
    APPROVAL_ROLE.BRANCH_HEAD,
    APPROVAL_ROLE.ASSISTANT_MANAGER,
  ].includes(roleId)
}

/**
 * Client-side hint whether the current user may act on a request.
 * The backend is authoritative (403/409) — this only hides/disables buttons.
 * @param {{status:string, user_id?:number, branch_id?:number|null}} req
 * @param {{coveredBranchIds?: number[]}} [opts] branch ids a branch head covers
 */
export function canActOn(req, { coveredBranchIds } = {}) {
  if (!req || !isPendingStatus(req.status)) return false
  const roleId = getRoleId()
  const me = getUser()
  if (roleId === APPROVAL_ROLE.ADMIN) return true
  if (me?.id != null && req.user_id != null && Number(req.user_id) === Number(me.id)) return false
  if (STAGE_ROLE[req.status] !== roleId) return false
  if (roleId === APPROVAL_ROLE.BRANCH_HEAD && Array.isArray(coveredBranchIds) && req.branch_id != null) {
    return coveredBranchIds.map(Number).includes(Number(req.branch_id))
  }
  return true
}

/** Branch ids the logged-in user covers (home + active branch from JWT). */
export function myBranchIds() {
  const u = getUser()
  return [u?.home_branch, u?.branch].filter((v) => v != null).map(Number)
}

// 3O request types
export const OOO_TYPE_LABEL = {
  work: "ออกนอกสถานที่เพื่อปฏิบัติงาน",
  personal: "ออกนอกสถานที่เพื่อธุระส่วนตัว",
}

/** "HH:MM:SS" | "HH:MM" → "HH:MM" */
export const hhmm = (t) => (typeof t === "string" ? t.slice(0, 5) : "-")
