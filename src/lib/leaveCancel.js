// src/lib/leaveCancel.js
// ยกเลิกใบลา (พนักงานยกเลิกของตนเอง / HR-ผู้จัดการยกเลิกให้) — สเปก backend: handoff/api-handoff-leave-cancellation.md
//
// ใบลาที่ยกเลิกไม่ถูกลบ: backend เปลี่ยน status เป็น "cancelled" + เก็บ cancelled_by / cancelled_at / cancel_reason
// และไม่นับเป็นวันลาอีก (โควตาคืนเอง). ปุ่มแสดงตาม `can_cancel` จาก API — ถ้า backend ยังไม่ส่ง field นี้มา
// ใช้กฎสำรองด้านล่าง (ตรงกับสเปก) จนกว่า backend จะขึ้น
import { apiAuth } from "./api"
import { isPendingStatus } from "./approval"

const isPending = (s) => s === "pending" || isPendingStatus(s)

/** วันนี้ (เวลาเครื่อง) เป็น ISO YYYY-MM-DD */
function todayIso() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** ใบลาที่อนุมัติแล้วต้องใส่เหตุผลการยกเลิกเสมอ (ใช้ตรวจสอบย้อนหลัง) */
export const cancelNeedsReason = (r, { byHr = false } = {}) => byHr || r?.status === "approved"

/** พนักงานยกเลิกใบลาของตนเองได้ไหม — รออนุมัติ หรืออนุมัติแล้วแต่ยังไม่ถึงวันลา */
export function canSelfCancel(r) {
  if (!r) return false
  if (typeof r.can_cancel === "boolean") return r.can_cancel
  if (isPending(r.status)) return true
  return r.status === "approved" && !!r.from_date && String(r.from_date).slice(0, 10) > todayIso()
}

/** HR / ผู้จัดการยกเลิกใบลานี้ได้ไหม — `can` = ฟังก์ชันจาก useCan()
 *  PR 110: HR ยกเลิกได้ทั้งรออนุมัติและอนุมัติแล้ว (แม้ลาเริ่มไปแล้ว) แต่ไม่ใช่ใบลาของตัวเอง — ยึด can_cancel ก่อนเสมอ */
export function canHrCancel(r, can) {
  if (!r) return false
  if (typeof r.can_cancel === "boolean") return r.can_cancel
  return can("hr.leave.cancelApproved") && (r.status === "approved" || isPending(r.status))
}

const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? 0 : Number(v))
const daysText = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 1 })

/** "2026-11" → "พ.ย. 2569" */
function periodText(p) {
  const m = /^(\d{4})-(\d{1,2})/.exec(String(p ?? ""))
  if (!m) return String(p ?? "")
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("th-TH", { month: "short", year: "numeric" })
}

/**
 * ผลของ POST …/cancel → ข้อความ toast { title, description, payroll: [{ text }] }
 *   days_returned · relieved_leaves[] · payroll_affected + payroll_periods[{ period, period_status, action }]
 */
export function describeCancelResult(res) {
  const returned = num(res?.days_returned)
  const relieved = Array.isArray(res?.relieved_leaves) ? res.relieved_leaves : []
  const parts = [returned > 0 ? `คืนวันลา ${daysText(returned)} วันเข้าสิทธิ์แล้ว` : "หยุดการพิจารณาแล้ว ใบลายังอยู่ในประวัติ"]
  if (relieved.length) parts.push(`ลดวันลาเกินสิทธิ์ของใบลาถัดไป ${relieved.length} ใบ`)

  let periods = Array.isArray(res?.payroll_periods) ? res.payroll_periods : []
  if (!periods.length && res?.payroll_affected && res?.payroll_period) {
    periods = [{ period: res.payroll_period, period_status: res.payroll_period_status, action: res.payroll_period_status === "draft" ? "regenerate" : "adjust_next_period" }]
  }
  const payroll = res?.payroll_affected
    ? periods.map((p) => ({
        text: p.action === "regenerate"
          ? `ใบลานี้อยู่ในเงินเดือนเดือน ${periodText(p.period)} ที่สร้างแล้ว กรุณาสร้างเงินเดือนใหม่`
          : `ใบลานี้อยู่ในเงินเดือนเดือน ${periodText(p.period)} ที่สร้างแล้ว กรุณาปรับในงวดถัดไป`,
      }))
    : []
  return { title: "ยกเลิกใบลาแล้ว", description: parts.join(" · "), payroll }
}

// backend รุ่นก่อนตอบ 409 เป็นภาษาอังกฤษ — แปลงเป็นข้อความที่ผู้ใช้อ่านเข้าใจ
function friendly(err) {
  const msg = err?.message || ""
  if (/^Only (pending|approved) leave/i.test(msg)) err.message = "ใบลานี้ยกเลิกไม่ได้แล้ว กรุณาติดต่อฝ่ายบุคคล"
  return err
}

const body = (reason) => (reason?.trim() ? { reason: reason.trim() } : {})

/** พนักงานยกเลิกใบลาของตนเอง */
export async function cancelOwnLeave(id, reason) {
  try {
    return await apiAuth(`/personnel/me/leaves/${id}/cancel`, { method: "POST", body: body(reason) })
  } catch (err) {
    throw friendly(err)
  }
}

/** HR / ผู้จัดการยกเลิกใบลา — endpoint ใหม่ `/cancel`; backend ที่ยังไม่มีใช้ `/cancel-approved` แทน */
export async function cancelLeaveAsHr(r, reason) {
  try {
    return await apiAuth(`/hr/leave-requests/${r.id}/cancel`, { method: "POST", body: body(reason) })
  } catch (err) {
    const noRoute = err?.status === 405 || (err?.status === 404 && /^not found$/i.test(err?.message || ""))
    if (!noRoute || r.status !== "approved") throw friendly(err)
    try {
      return await apiAuth(`/hr/leave-requests/${r.id}/cancel-approved`, { method: "POST", body: body(reason) })
    } catch (err2) {
      throw friendly(err2)
    }
  }
}
