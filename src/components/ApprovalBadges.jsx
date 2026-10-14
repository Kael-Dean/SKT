// src/components/ApprovalBadges.jsx
// ป้าย "สถานะ/ขั้นตอน" (จาก stage) และ "ผลตรวจสอบ" (จาก justification) — api-handoff-4 §1
//   <StageBadge req={r} />          รอหัวหน้าอนุมัติ / อนุมัติแล้ว · รอตรวจสอบ / อนุมัติ …
//   <JustificationBadge req={r} />  สมเหตุสมผล / ไม่สมเหตุสมผล (hover = เหตุผล) / ยังไม่ตรวจ
import { displayStatusOf, displayToneOf, JUSTIFICATION_LABEL, JUSTIFICATION_TONE, checkRoleLabel } from "../lib/approval"

const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"

export function StageBadge({ req, className = "" }) {
  if (!req) return null
  return <span className={`${pill} ${displayToneOf(req)} ${className}`}>{displayStatusOf(req)}</span>
}

/** แสดงเมื่อมีผลตรวจแล้ว หรือมีผู้ตรวจที่ต้องตรวจ (check_role) — คำขอที่ไม่มีการตรวจจะไม่แสดง */
export function JustificationBadge({ req, showPending = true, className = "" }) {
  if (!req) return null
  const j = req.justification
  if (!j) {
    if (!showPending || !req.check_role || req.status !== "approved") return null
    return (
      <span className={`${pill} ${JUSTIFICATION_TONE.none} ${className}`} title={checkRoleLabel(req.check_role)}>
        ยังไม่ตรวจ
      </span>
    )
  }
  const note = req.justification_note ? `เหตุผล: ${req.justification_note}` : undefined
  return (
    <span className={`${pill} ${JUSTIFICATION_TONE[j] || JUSTIFICATION_TONE.none} ${className}`} title={note}>
      ผลตรวจ: {JUSTIFICATION_LABEL[j] || j}
    </span>
  )
}
