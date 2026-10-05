// src/components/LeaveStageActions.jsx
// Stage-aware approve / reject buttons for one leave request (HR screens).
// Buttons only render when canDecide() says the current user may act; otherwise
// a short hint explains why (own request, other branch, other stage). The
// backend remains authoritative — 403/409 are surfaced by DecisionModal.
import { STAGE_APPROVE_LABEL, isPendingStatus } from "../lib/approval"
import { blockedReason, canDecide } from "../lib/approvalActions"

export default function LeaveStageActions({ req, onDecide }) {
  if (!isPendingStatus(req?.status)) return null
  if (!canDecide(req)) {
    const why = blockedReason(req)
    return why ? (
      <p className="max-w-[16rem] text-right text-xs text-gray-500 dark:text-gray-400">{why}</p>
    ) : null
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => onDecide(req, "reject")}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition-all duration-200 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20 dark:focus-visible:ring-offset-gray-800"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
        ไม่อนุมัติ
      </button>
      <button
        type="button"
        onClick={() => onDecide(req, "approve")}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {STAGE_APPROVE_LABEL[req.status] || "อนุมัติ"}
      </button>
    </div>
  )
}
