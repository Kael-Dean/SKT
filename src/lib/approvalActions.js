// src/lib/approvalActions.js
// Stage-aware approve / reject calls for 3B (leave) and 3O (out-of-office),
// plus small helpers shared by the Inbox, HR leave screens and NotificationBell.
// Endpoint mapping follows api-handoff งวด 2 §1, §2, §4. Backend stays
// authoritative (403/409) — callers show err.message (= backend `detail`) as is.
import { apiAuth } from "./api"
import { getUser } from "./auth"
import { can } from "./permissions"
import {
  STAGE_APPROVE_ACTION,
  STAGE_ROLE,
  ROLE_LABEL,
  canActOn,
  canApproveStage,
  isPendingStatus,
  myBranchIds,
  statusLabel,
} from "./approval"

export const KIND = {
  LEAVE: "leave",
  OOO: "out_of_office",
}

export const KIND_LABEL = {
  leave: "ใบลา",
  out_of_office: "ขอออกนอกสถานที่",
}

/** Deep link used by notifications → Inbox detail. */
export function inboxLink(refType, refId) {
  if (refType !== KIND.LEAVE && refType !== KIND.OOO) return "/inbox"
  return `/inbox?type=${refType}&id=${encodeURIComponent(refId)}`
}

/**
 * Requester branch id. 3O has `branch_id`; the leave list schema does not
 * document one, so try the likely names (see report: spec ambiguity).
 */
export function requestBranchId(req) {
  const v =
    req?.branch_id ??
    req?.user_branch_id ??
    req?.branch_location ??
    req?.user_branch_location ??
    null
  return v == null ? null : Number(v)
}

/** Display name of the requester, tolerant of missing name fields (3O). */
export function requesterName(req) {
  if (!req) return "-"
  const full =
    req.user_full_name ||
    req.full_name ||
    req.requester_name ||
    [req.user_first_name ?? req.first_name, req.user_last_name ?? req.last_name]
      .filter(Boolean)
      .join(" ")
  if (full) return full
  return req.user_id != null ? `พนักงานรหัส ${req.user_id}` : "-"
}

const isOwn = (req) => {
  const me = getUser()
  return me?.id != null && req?.user_id != null && Number(me.id) === Number(req.user_id)
}

/** canActOn with branch normalisation + the user's covered branches. */
export function canDecide(req, kind = KIND.LEAVE) {
  if (!req) return false
  return canActOn(
    { status: req.status, user_id: req.user_id, branch_id: requestBranchId(req) },
    { coveredBranchIds: myBranchIds(), kind },
  )
}

/**
 * Why the current user cannot act on a request (null when they can).
 * Used for the small hint shown instead of the buttons.
 */
export function blockedReason(req, kind = KIND.LEAVE) {
  if (!req) return null
  if (!isPendingStatus(req.status)) return `คำขอนี้ดำเนินการไปแล้ว (${statusLabel(req.status)})`
  if (canDecide(req, kind)) return null
  if (!can("approval.anyStage") && isOwn(req)) return "เป็นคำขอของคุณเอง พิจารณาเองไม่ได้"
  if (!canApproveStage(req.status, kind)) {
    const stageRole = STAGE_ROLE[req.status]
    return stageRole ? `ขั้นนี้รอ${ROLE_LABEL[stageRole]}พิจารณา` : "ไม่ใช่ขั้นที่คุณพิจารณา"
  }
  if (req.status === "pending_branch_head") return "อยู่นอกสาขาที่คุณดูแล"
  return "ไม่มีสิทธิ์พิจารณาคำขอนี้"
}

/**
 * Approve at the request's current stage.
 * leave → POST /hr/leave-requests/{id}/{action}  body {hr_comment}
 * 3O    → POST /hr/out-of-office/{id}/{action}   no body
 */
export function approveRequest(kind, req, note) {
  const action = STAGE_APPROVE_ACTION[req?.status]
  if (!action) return Promise.reject(Object.assign(new Error("คำขอนี้ไม่ได้อยู่ในขั้นรออนุมัติ"), { status: 409 }))
  if (kind === KIND.OOO) {
    return apiAuth(`/hr/out-of-office/${req.id}/${action}`, { method: "POST" })
  }
  const comment = typeof note === "string" && note.trim() ? note.trim() : null
  return apiAuth(`/hr/leave-requests/${req.id}/${action}`, {
    method: "POST",
    body: { hr_comment: comment },
  })
}

/**
 * Reject with a required reason.
 * leave @ pending_branch_head → /branch-head-deny {hr_comment}
 * leave @ other stages        → /deny             {hr_comment}
 * 3O                          → /reject           {reason}
 */
export function rejectRequest(kind, req, reason) {
  const text = typeof reason === "string" ? reason.trim() : ""
  if (!text) return Promise.reject(Object.assign(new Error("กรุณาระบุเหตุผลที่ไม่อนุมัติ"), { status: 0 }))
  if (kind === KIND.OOO) {
    return apiAuth(`/hr/out-of-office/${req.id}/reject`, { method: "POST", body: { reason: text } })
  }
  const ep = req.status === "pending_branch_head" ? "branch-head-deny" : "deny"
  return apiAuth(`/hr/leave-requests/${req.id}/${ep}`, { method: "POST", body: { hr_comment: text } })
}

/** Rejection reason regardless of source (3O `reject_reason`, leave `hr_comment`). */
export function rejectionReason(req) {
  if (!req) return null
  if (req.status !== "rejected" && req.status !== "denied") return null
  return req.reject_reason || req.hr_comment || null
}

/** Ask the notification bell to refetch now (after a decision). */
export const NOTIFICATIONS_REFRESH_EVENT = "skt:notifications-refresh"
export function requestNotificationsRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT))
}

/** Thai relative time: "เมื่อสักครู่", "5 นาทีที่แล้ว", … falls back to a date. */
export function relativeTimeTh(iso, now = Date.now()) {
  if (!iso) return ""
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const min = Math.floor((now - t) / 60000)
  if (min < 1) return "เมื่อสักครู่"
  if (min < 60) return `${min} นาทีที่แล้ว`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`
  const day = Math.floor(hr / 24)
  if (day === 1) return "เมื่อวาน"
  if (day < 7) return `${day} วันที่แล้ว`
  return new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
}

export function fmtDateTimeTh(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function fmtDateTh(d) {
  if (!d) return "—"
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return String(d)
  return x.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}
