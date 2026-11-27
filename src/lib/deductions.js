// src/lib/deductions.js
// ภาษี / เงินสะสม ต่อเดือน + คำขอเปลี่ยนยอด (backend PR 116 — Vivid 2026-11-27)
//   ยอดตั้งไว้ครั้งเดียว หักเท่ากันทุกเดือน จนกว่าพนักงานยื่นขอเปลี่ยน แล้ว HR / หัวหน้าฝ่ายบัญชีอนุมัติ
//
//   self-service (ทุกคนที่ล็อกอิน — permission "self.deductions.request")
//     GET  /personnel/me/deductions                         ยอดปัจจุบัน + reserve_minimum + pending_request_id
//     POST /personnel/me/deduction-requests                 { new_tax, new_reserve, note } — ช่องว่าง = null (ไม่เปลี่ยน), 0 = ยอดจริง
//     GET  /personnel/me/deduction-requests                 ประวัติคำขอของฉัน (ใหม่สุดก่อน)
//     POST /personnel/me/deduction-requests/{id}/cancel     ยกเลิกได้เฉพาะ pending (อื่น ๆ = 409)
//   ผู้พิจารณา (permission "hr.deductionRequests.decide" = deduction_request.decide)
//     GET  /hr/deduction-requests?status=pending|approved|rejected|cancelled   (ไม่ส่ง = ทั้งหมด)
//     POST /hr/deduction-requests/{id}/approve              { note? }
//     POST /hr/deduction-requests/{id}/reject               { note } — บังคับเหตุผล (422)
//   403 "พิจารณาคำขอของตนเองไม่ได้" · 409 = คำขอถูกพิจารณา/ยกเลิกไปแล้ว → โหลดใหม่
//   ยอดเงินมาเป็น string ทศนิยม ("500.00") · created_at / decided_at = UTC → ใช้ lib/serverTime
import { apiAuth } from "./api"
import { money } from "./payroll"

/** ?section= ของ /my-financial ที่เลื่อนไปการ์ดภาษี / เงินสะสม (ลิงก์จากการแจ้งเตือน) */
export const DEDUCTIONS_SECTION = "deductions"
export const MY_DEDUCTIONS_PATH = `/my-financial?section=${DEDUCTIONS_SECTION}`

export const DEDUCTION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
}

/** ป้ายสำรองเมื่อ backend ไม่ส่ง status_label */
const STATUS_FALLBACK = {
  pending: "รอพิจารณา",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
}

/** tone ของ <Badge> ตามสถานะ */
const STATUS_TONE = {
  pending: "pending",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
}

export const deductionStatusLabel = (r) => r?.status_label || STATUS_FALLBACK[r?.status] || r?.status || "—"
export const deductionStatusTone = (status) => STATUS_TONE[status] || "neutral"

/** ตัวเลือกตัวกรองของคิว HR (value "all" = ไม่ส่ง status) */
export const DEDUCTION_FILTER_OPTIONS = [
  { value: "pending", label: "รอพิจารณา" },
  { value: "approved", label: "อนุมัติแล้ว" },
  { value: "rejected", label: "ไม่อนุมัติ" },
  { value: "cancelled", label: "ยกเลิก" },
  { value: "all", label: "ทั้งหมด" },
]

const asList = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])

// ─── self-service ────────────────────────────────────────────────────────────

export const getMyDeductions = () => apiAuth("/personnel/me/deductions")

export const listMyDeductionRequests = () => apiAuth("/personnel/me/deduction-requests").then(asList)

/**
 * @param {{ newTax: string|null, newReserve: string|null, note?: string }} p
 *   ช่องที่เว้นว่างต้องส่ง null (= ไม่เปลี่ยน) — ไม่ใช่ 0
 */
export const createDeductionRequest = ({ newTax, newReserve, note }) =>
  apiAuth("/personnel/me/deduction-requests", {
    method: "POST",
    body: {
      new_tax: newTax ?? null,
      new_reserve: newReserve ?? null,
      note: note?.trim() ? note.trim() : null,
    },
  })

export const cancelDeductionRequest = (id) =>
  apiAuth(`/personnel/me/deduction-requests/${encodeURIComponent(id)}/cancel`, { method: "POST" })

// ─── ผู้พิจารณา ──────────────────────────────────────────────────────────────

export const listDeductionRequests = (status) => {
  const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : ""
  return apiAuth(`/hr/deduction-requests${qs}`).then(asList)
}

export const approveDeductionRequest = (id, note) =>
  apiAuth(`/hr/deduction-requests/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: { note: note?.trim() ? note.trim() : null },
  })

export const rejectDeductionRequest = (id, note) =>
  apiAuth(`/hr/deduction-requests/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: { note: note.trim() },
  })

// ─── แสดงผล / ตรวจค่า ──────────────────────────────────────────────────────────

/** ค่าในช่องกรอก → string ที่ส่ง backend ได้ | null (ว่าง) | undefined (รูปแบบผิด) */
export function parseAmountInput(raw) {
  const s = String(raw ?? "").replace(/,/g, "").trim()
  if (s === "") return null
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return undefined
  return s.endsWith(".") ? s.slice(0, -1) : s
}

/** "500.00 → 600.00" / null new → null (ผู้เรียกแสดง "ไม่เปลี่ยน") */
export function changeParts(current, next) {
  if (next == null) return null
  return { from: current == null ? "—" : money(current), to: money(next) }
}
