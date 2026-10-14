// src/components/LeaveStageActions.jsx
// ปุ่มดำเนินการของคำขอหนึ่งรายการ (ใบลา / ออกนอกสถานที่) ตาม `stage` + `can_act` จาก backend
//   pending_*       → ไม่อนุมัติ / อนุมัติ
//   awaiting_check  → ไม่สมเหตุสมผล / สมเหตุสมผล (ตรวจสอบหลังอนุมัติ — ไม่มี "ไม่อนุมัติ")
// ไม่มีสิทธิ์ (รวม HR ที่ can_act = false เสมอ) → ข้อความสั้นบอกเหตุผล ไม่มีปุ่ม
import { STAGE_APPROVE_LABEL, stageOf } from "../lib/approval"
import { blockedReason, canCheck, canDecide, KIND } from "../lib/approvalActions"

const btnBase =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
const negCls = `${btnBase} border border-red-300 text-red-700 hover:bg-red-50 focus-visible:ring-red-500 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20`
const posCls = `${btnBase} bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 focus-visible:ring-emerald-500`

const XIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export default function LeaveStageActions({ req, kind = KIND.LEAVE, onDecide, hideReason = false }) {
  if (!req || !stageOf(req)) return null
  if (canCheck(req)) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => onDecide(req, "unjust")} className={negCls}>
          <XIcon />
          ไม่สมเหตุสมผล
        </button>
        <button type="button" onClick={() => onDecide(req, "justified")} className={posCls}>
          <CheckIcon />
          สมเหตุสมผล
        </button>
      </div>
    )
  }
  if (!canDecide(req, kind)) {
    const why = hideReason ? null : blockedReason(req, kind)
    return why ? <p className="max-w-[16rem] text-right text-xs text-gray-500 dark:text-gray-400">{why}</p> : null
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={() => onDecide(req, "reject")} className={negCls}>
        <XIcon />
        ไม่อนุมัติ
      </button>
      <button type="button" onClick={() => onDecide(req, "approve")} className={posCls}>
        <CheckIcon />
        {STAGE_APPROVE_LABEL[stageOf(req)] || "อนุมัติ"}
      </button>
    </div>
  )
}
