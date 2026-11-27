// src/components/LeaveCancel.jsx
// ยกเลิกใบลา — ปุ่ม + กล่องยืนยัน (กรอกเหตุผล) + บันทึก "ยกเลิกโดย…" บนการ์ดใบลาที่ยกเลิกแล้ว
//
//   <CancelLeaveButton onClick={() => setCancelTarget(r)} />
//   <CancelLeaveDialog leave={cancelTarget} byHr onSubmit={(reason) => cancelLeaveAsHr(r, reason)}
//     onClose={() => setCancelTarget(null)} onDone={reload} />
//   <CancelledNote leave={r} />
import { useEffect, useId, useState } from "react"
import { Ban } from "lucide-react"
import { ConfirmDialog, toast } from "./ui"
import { baseField, cx } from "../lib/styles"
import { cancelNeedsReason, describeCancelResult } from "../lib/leaveCancel"
import { fmtLeaveRowDuration } from "../lib/leaveDays"

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) } catch { return d }
}

function fmtDateTime(d) {
  if (!d) return null
  // cancelled_at เป็น UTC — ค่าที่ไม่มี timezone ต่อ Z ให้ (กันแสดงช้าไป 7 ชม.)
  const s = typeof d === "string" && /T\d{2}:\d{2}/.test(d) && !/(Z|[+-]\d{2}:?\d{2})$/.test(d) ? `${d}Z` : d
  try {
    return new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " น."
  } catch { return d }
}

export function CancelLeaveButton({ onClick, disabled, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex min-h-touch md:min-h-0 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition-colors duration-200 hover:bg-red-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10",
        className,
      )}
    >
      <Ban aria-hidden="true" className="size-3.5" strokeWidth={2} />
      ยกเลิกใบลา
    </button>
  )
}

/**
 * @param {object|null} leave     ใบลาที่จะยกเลิก (null = ปิด)
 * @param {boolean}     byHr      HR/ผู้จัดการยกเลิกให้ → บังคับเหตุผลเสมอ
 * @param {string}      [who]     ชื่อเจ้าของใบลา (แสดงในสรุป ฝั่ง HR)
 * @param {(reason: string) => Promise} onSubmit
 */
export function CancelLeaveDialog({ leave, byHr = false, who, onSubmit, onClose, onDone }) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const fieldId = useId()
  const hintId = useId()

  useEffect(() => {
    setReason("")
    setError("")
    setSaving(false)
  }, [leave?.id])

  if (!leave) return null
  const required = cancelNeedsReason(leave, { byHr })
  const approved = leave.status === "approved"

  const confirm = async () => {
    if (required && !reason.trim()) {
      setError("กรุณาระบุเหตุผลการยกเลิก")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await onSubmit(reason)
      // PR 110: เตือนเงินเดือนที่สร้างไปแล้ว (ค้างจอจนกว่าจะปิด เพราะ HR ต้องไปทำต่อ)
      // ข้อความสำเร็จ (วันลาที่คืน) ให้หน้าที่เรียกแสดงเอง: onDone(leave, describeCancelResult(res))
      const out = describeCancelResult(res)
      for (const p of out.payroll) toast.warning("ต้องแก้เงินเดือน", { description: p.text, duration: Infinity })
      onDone?.(leave, out)
    } catch (err) {
      if (err?.onboardingRequired) return
      setError(err?.message || "ยกเลิกไม่สำเร็จ กรุณาลองใหม่")
      setSaving(false)
    }
  }

  return (
    <ConfirmDialog
      open
      tone="danger"
      title="ยกเลิกใบลานี้?"
      description={
        approved
          ? "วันลาจะถูกคืนเข้าสิทธิ์ ใบลายังเก็บไว้ในประวัติพร้อมสถานะ “ยกเลิก” และเหตุผลที่ระบุ"
          : "ใบลาจะหยุดการพิจารณา และเก็บไว้ในประวัติพร้อมสถานะ “ยกเลิก”"
      }
      confirmLabel="ยืนยันยกเลิกใบลา"
      cancelLabel="ไม่ยกเลิก"
      loading={saving}
      loadingLabel="กำลังยกเลิก…"
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <div className="space-y-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-gray-50 px-3 py-2.5 text-sm dark:bg-gray-700/40">
          {who && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">ผู้ขอลา</dt>
              <dd className="min-w-0 break-words font-medium text-gray-900 dark:text-gray-100">{who}</dd>
            </>
          )}
          <dt className="text-gray-500 dark:text-gray-400">ประเภท</dt>
          <dd className="min-w-0 break-words font-medium text-gray-900 dark:text-gray-100">{leave.leave_type_name ?? "—"}</dd>
          <dt className="text-gray-500 dark:text-gray-400">วันที่</dt>
          <dd className="min-w-0 font-medium text-gray-900 dark:text-gray-100">
            {fmtDate(leave.from_date)} – {fmtDate(leave.to_date)} · <span className="tabular-nums">{fmtLeaveRowDuration(leave)}</span>
          </dd>
        </dl>
        <div className="min-w-0 space-y-1.5">
          <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            เหตุผลการยกเลิก{required ? <span className="text-red-600 dark:text-red-400"> *</span> : <span className="font-normal text-gray-400 dark:text-gray-500"> (ไม่บังคับ)</span>}
          </label>
          <textarea
            id={fieldId}
            rows={3}
            value={reason}
            onChange={(e) => { setReason(e.target.value); if (error) setError("") }}
            disabled={saving}
            maxLength={500}
            aria-required={required || undefined}
            aria-invalid={!!error && required && !reason.trim()}
            aria-describedby={hintId}
            placeholder={byHr ? "เช่น พนักงานแจ้งยกเลิก / ยื่นผิดวัน" : "เช่น เปลี่ยนแผน ไม่ได้ลาแล้ว"}
            className={cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm resize-y", error && required && !reason.trim() && "!border-red-500")}
          />
          <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400">เหตุผลจะแสดงในประวัติใบลาเพื่อใช้ตรวจสอบย้อนหลัง</p>
        </div>
      </div>
    </ConfirmDialog>
  )
}

/** บันทึกบนการ์ดใบลาที่ยกเลิกแล้ว — ใคร/เมื่อไร/เพราะอะไร + บอกว่าไม่นับเป็นวันลา */
export function CancelledNote({ leave, className = "" }) {
  if (leave?.status !== "cancelled") return null
  const by = leave.cancelled_by_name
  const at = fmtDateTime(leave.cancelled_at)
  return (
    <div className={cx("rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-700 ring-1 ring-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:ring-gray-600/60", className)}>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <Ban aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
        <span className="font-semibold">ยกเลิกแล้ว · ไม่นับเป็นวันลา</span>
        {(by || at) && (
          <span className="text-gray-500 dark:text-gray-400">
            {by ? `โดย ${by}` : ""}{by && at ? " · " : ""}{at ?? ""}
          </span>
        )}
      </p>
      {leave.cancel_reason && <p className="mt-1 break-words">เหตุผล: {leave.cancel_reason}</p>}
    </div>
  )
}
