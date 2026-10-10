// src/lib/approval.js
// Shared approval-chain helpers for 3B (leave) and 3O (out-of-office).
// Source of truth: api-handoff งวด 2, section 1.
//
// สิทธิ์ของแต่ละขั้นมาจาก permission registry (src/lib/permissions.js) — ไม่มีเลข role ในไฟล์นี้
//   leave: hr.leave.approve.branchHead / .asstManager / .manager
//   3O   : hr.ooo.approve.branchHead / .asstManager / .manager
//   "approval.anyStage" = พิจารณาได้ทุกขั้น (ผู้ดูแลระบบ)
import { getRoleId, getUser } from "./auth"
import { ROLE, ROLE_LABEL } from "./roles"
import { can, canAny } from "./permissions"

/** @deprecated ใช้ ROLE จาก src/lib/roles.js — คงไว้ให้โค้ดเดิม */
export const APPROVAL_ROLE = ROLE

export { ROLE_LABEL }

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

// ผู้พิจารณาของแต่ละขั้น (ชื่อ role ใช้ในข้อความ "ขั้นนี้รอ…พิจารณา")
export const STAGE_ROLE = {
  pending_branch_head: ROLE.BRANCH_HEAD,
  pending_assistant_manager: ROLE.ASSISTANT_MANAGER,
  pending_manager: ROLE.MANAGER,
}

// permission key ของการอนุมัติแต่ละขั้น แยกตามชนิดคำขอ
export const STAGE_PERMISSION = {
  leave: {
    pending_branch_head: "hr.leave.approve.branchHead",
    pending_assistant_manager: "hr.leave.approve.asstManager",
    pending_manager: "hr.leave.approve.manager",
  },
  out_of_office: {
    pending_branch_head: "hr.ooo.approve.branchHead",
    pending_assistant_manager: "hr.ooo.approve.asstManager",
    pending_manager: "hr.ooo.approve.manager",
  },
}

const ALL_STAGE_PERMS = Object.values(STAGE_PERMISSION).flatMap((m) => Object.values(m))

const stagePerm = (status, kind = "leave") =>
  (STAGE_PERMISSION[kind] || STAGE_PERMISSION.leave)[status] || null

/** ผู้ใช้อนุมัติขั้นนี้ได้ไหม (ตามสิทธิ์ ไม่รวมเงื่อนไขคำขอของตัวเอง/สาขา) */
export function canApproveStage(status, kind = "leave", roleId = getRoleId()) {
  const key = stagePerm(status, kind)
  return key ? can(key, roleId) : false
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

/**
 * ขั้น (pending status) ที่ผู้ใช้รับผิดชอบ หรือ null
 * ผู้ที่พิจารณาได้ทุกขั้น (approval.anyStage) → null = ไม่ผูกกับขั้นใดขั้นหนึ่ง
 */
export function myStageStatus(roleId = getRoleId()) {
  if (can("approval.anyStage", roleId)) return null
  const stages = [STATUS.PENDING_BRANCH_HEAD, STATUS.PENDING_ASSISTANT_MANAGER, STATUS.PENDING_MANAGER]
  return stages.find((st) => canApproveStage(st, "leave", roleId) || canApproveStage(st, "out_of_office", roleId)) || null
}

/** ผู้ใช้อยู่ในสายอนุมัติ (ใบลา / ออกนอกสถานที่) ขั้นใดขั้นหนึ่งไหม — ใช้แสดง UI อนุมัติ / กล่องงาน */
export function isApproverRole(roleId = getRoleId()) {
  return canAny(ALL_STAGE_PERMS, roleId)
}

/**
 * Client-side hint whether the current user may act on a request.
 * The backend is authoritative (403/409) — this only hides/disables buttons.
 * @param {{status:string, user_id?:number, branch_id?:number|null}} req
 * @param {{coveredBranchIds?: number[], kind?: "leave"|"out_of_office"}} [opts]
 */
export function canActOn(req, { coveredBranchIds, kind = "leave" } = {}) {
  if (!req || !isPendingStatus(req.status)) return false
  const roleId = getRoleId()
  const me = getUser()
  if (can("approval.anyStage", roleId)) return true
  if (me?.id != null && req.user_id != null && Number(req.user_id) === Number(me.id)) return false
  if (!canApproveStage(req.status, kind, roleId)) return false
  // หัวหน้าสาขา/ฝ่าย: backend จำกัดตามสาขาที่ดูแล — ซ่อนปุ่มของคำขอนอกสาขาด้วย
  if (req.status === STATUS.PENDING_BRANCH_HEAD && Array.isArray(coveredBranchIds) && req.branch_id != null) {
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
