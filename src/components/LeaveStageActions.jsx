// src/components/LeaveStageActions.jsx
// ปุ่มดำเนินการของคำขอหนึ่งรายการ (ใบลา / ออกนอกสถานที่) ตาม `stage` + `can_act` จาก backend
//   pending_*       → ไม่อนุมัติ / อนุมัติ
//   awaiting_check  → ไม่อนุมัติ / อนุมัติ (ผลตรวจสอบหลังอนุมัติ — mode "unjust" / "justified")
// ไม่มีสิทธิ์ (รวม HR ที่ can_act = false เสมอ) → ข้อความสั้นบอกเหตุผล ไม่มีปุ่ม
//
// หน้าตาปุ่ม: เรียบ ขนาด/ทรงเดียวกับปุ่ม PDF / ประวัติการอนุมัติข้าง ๆ — ไม่มีไอคอน ✓/✕, ไม่มี glow
//   อนุมัติ    = พื้นทึบ emerald-700 (ตัวขาว 5.4:1)
//   ไม่อนุมัติ = ปุ่มเส้นกลาง ๆ ตัวอักษรแดงหม่น (ไม่ใช่กรอบแดงทั้งปุ่ม)
import { STAGE_APPROVE_LABEL, stageOf } from "../lib/approval"
import { blockedReason, canCheck, canDecide, KIND } from "../lib/approvalActions"

const btnBase =
  "inline-flex min-h-11 md:pointer-fine:min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold " +
  "cursor-pointer select-none transition-colors duration-150 active:translate-y-px " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface"
const negCls =
  `${btnBase} bg-white text-red-700 ring-1 ring-inset ring-gray-300 hover:bg-red-50 hover:ring-red-200 active:bg-red-100 ` +
  "focus-visible:ring-red-500 dark:bg-white/[.04] dark:text-red-300 dark:ring-line-strong dark:hover:bg-red-500/10 dark:hover:ring-red-400/30"
const posCls =
  `${btnBase} bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900 ` +
  "focus-visible:ring-emerald-500 dark:focus-visible:ring-emerald-400"

function ActionPair({ onNeg, onPos, posLabel }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={onNeg} className={negCls}>
        ไม่อนุมัติ
      </button>
      <button type="button" onClick={onPos} className={posCls}>
        {posLabel}
      </button>
    </div>
  )
}

export default function LeaveStageActions({ req, kind = KIND.LEAVE, onDecide, hideReason = false }) {
  if (!req || !stageOf(req)) return null
  if (canCheck(req)) {
    return <ActionPair onNeg={() => onDecide(req, "unjust")} onPos={() => onDecide(req, "justified")} posLabel="อนุมัติ" />
  }
  if (!canDecide(req, kind)) {
    const why = hideReason ? null : blockedReason(req, kind)
    return why ? <p className="max-w-[16rem] text-right text-xs text-gray-500 dark:text-gray-400">{why}</p> : null
  }
  return (
    <ActionPair
      onNeg={() => onDecide(req, "reject")}
      onPos={() => onDecide(req, "approve")}
      posLabel={STAGE_APPROVE_LABEL[stageOf(req)] || "อนุมัติ"}
    />
  )
}
