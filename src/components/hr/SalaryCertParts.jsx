// src/components/hr/SalaryCertParts.jsx
// ชิ้นแสดงผลของคำขอหนังสือรับรองเงินเดือนที่ใช้ร่วมกันระหว่าง HRSalaryCertTab / MySalaryCert /
// SalaryCertSupervisorQueue — ความคืบหน้า 2 ขั้น (ผู้บังคับบัญชา → ผู้จัดการ) + กล่องความเห็นผู้บังคับบัญชา
import { Check, X, Minus } from "lucide-react"
import { cx } from "../../lib/styles"
import { fmtDateTimeTh } from "../../lib/approvalActions"
import { SALARY_CERT_STATUS as S, SUPERVISOR_OPINION_LABEL } from "../../lib/salaryCert"

// state: done | rejected | current | skipped | upcoming
const DOT = {
  done: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-gray-950",
  rejected: "bg-red-600 text-white dark:bg-red-500 dark:text-gray-950",
  current: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-400 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/60",
  skipped: "bg-gray-100 text-gray-500 dark:bg-white/[.06] dark:text-gray-400",
  upcoming: "bg-white text-gray-400 ring-1 ring-inset ring-gray-300 dark:bg-transparent dark:text-gray-500 dark:ring-line-strong",
}
const STATE_TEXT = {
  done: "เสร็จแล้ว",
  rejected: "ไม่อนุมัติ",
  current: "กำลังรอ",
  skipped: "ข้ามขั้นนี้",
  upcoming: "ยังไม่ถึง",
}

function stepStates(r) {
  const st = r?.status
  const decided = st === S.APPROVED || st === S.DENIED
  const hasOpinion = !!r?.supervisor_opinion
  const sup = hasOpinion
    ? (r.supervisor_opinion === "disagree" ? "rejected" : "done")
    : st === S.PENDING_SUPERVISOR ? "current" : "skipped"
  const mgr = st === S.APPROVED ? "done" : st === S.DENIED ? "rejected" : st === S.PENDING_MANAGER || st === "pending" ? "current" : "upcoming"
  return { sup, mgr, decided }
}

function Step({ label, state, detail }) {
  const Icon = state === "done" ? Check : state === "rejected" ? X : state === "skipped" ? Minus : null
  return (
    <li className="flex min-w-0 items-center gap-2">
      <span className={cx("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold", DOT[state])} aria-hidden="true">
        {Icon ? <Icon className="size-3" strokeWidth={3} /> : <span className={cx("size-1.5 rounded-full", state === "current" ? "bg-amber-500 dark:bg-amber-300" : "bg-gray-300 dark:bg-gray-600")} />}
      </span>
      <span className="min-w-0 text-xs leading-tight">
        <span className={cx("block font-medium", state === "upcoming" || state === "skipped" ? "text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-200")}>{label}</span>
        <span className="block text-gray-500 dark:text-gray-400">{detail || STATE_TEXT[state]}</span>
      </span>
    </li>
  )
}

/** ความคืบหน้า 2 ขั้น: ผู้บังคับบัญชา → ผู้จัดการ */
export function SalaryCertProgress({ r, className = "" }) {
  const { sup, mgr } = stepStates(r)
  const supDetail = r?.supervisor_opinion
    ? SUPERVISOR_OPINION_LABEL[r.supervisor_opinion]
    : sup === "skipped" ? "ไม่มีความเห็น" : undefined
  const mgrDetail = mgr === "done" ? "อนุมัติแล้ว" : undefined
  return (
    <ol aria-label="ขั้นตอนการพิจารณา" className={cx("flex flex-wrap items-center gap-x-2 gap-y-2", className)}>
      <Step label="ผู้บังคับบัญชา" state={sup} detail={supDetail} />
      <li aria-hidden="true" className="h-px w-6 shrink-0 bg-gray-300 dark:bg-line-strong" />
      <Step label="ผู้จัดการ" state={mgr} detail={mgrDetail} />
    </ol>
  )
}

/**
 * ความเห็นผู้บังคับบัญชา — ใช้ทั้งฝั่งผู้จัดการ (ก่อนตัดสิน) และฝั่งพนักงาน
 * `emptyText` แสดงเมื่อยังไม่มีความเห็น (ส่ง null เพื่อไม่แสดงอะไร)
 */
export function SupervisorOpinionNote({ r, showName = true, emptyText = "ยังไม่มีความเห็น — ผู้จัดการพิจารณาได้เลย" }) {
  const op = r?.supervisor_opinion
  if (!op) {
    if (!emptyText) return null
    return (
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-white/[.04] dark:text-gray-300">
        <span className="font-medium text-gray-700 dark:text-gray-200">ความเห็นผู้บังคับบัญชา:</span>{" "}
        {r?.supervisor_name && r?.status === S.PENDING_SUPERVISOR ? `รอ ${r.supervisor_name} — ` : ""}{emptyText}
      </p>
    )
  }
  const agree = op === "agree"
  return (
    <div className={cx(
      "space-y-0.5 rounded-lg px-3 py-2 text-sm",
      agree
        ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100"
        : "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100",
    )}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">ความเห็นผู้บังคับบัญชา:</span>
        <span className={cx("font-semibold", agree ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300")}>
          {SUPERVISOR_OPINION_LABEL[op] ?? op}
        </span>
        {(showName && r.supervisor_name) || r.supervisor_at ? (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {showName && r.supervisor_name ? r.supervisor_name : ""}
            {showName && r.supervisor_name && r.supervisor_at ? " · " : ""}
            {r.supervisor_at ? <span className="tabular-nums">{fmtDateTimeTh(r.supervisor_at)}</span> : null}
          </span>
        ) : null}
      </p>
      {r.supervisor_comment && <p className="break-words text-gray-800 dark:text-gray-200">{r.supervisor_comment}</p>}
    </div>
  )
}
