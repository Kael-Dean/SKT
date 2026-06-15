// src/pages/work/Inbox.jsx
// กล่องงานรออนุมัติ — Inbox / Approval Queue
// ยังไม่เชื่อม backend — ใช้ mock data และ UI state ล้วน
// TODO (when BE ready): filter items by role from API
//   - ADMIN / MNG: เห็นทุก pending items
//   - HR: เห็น items ที่ผ่าน branch head มาแล้ว (approvalStep = "pending_manager" หรือสูงกว่า)
//   - อื่นๆ: เห็นเฉพาะ items ที่ assigned_to ตรงกับ userId ของตัวเอง

import { useState, useMemo } from "react"
import SelectDropdown from "../../components/SelectDropdown"
import { EmptyState } from "../../components/ui"

// ─── shared style tokens (project-wide) ────────────────────────────────────
const cardCls =
  "rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5"

// ─── inline icons (currentColor, no emoji) ──────────────────────────────────
const iconBase = {
  "aria-hidden": "true",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
}
function IconLeave({ className = "size-5" }) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}
function IconReport({ className = "size-5" }) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01" />
    </svg>
  )
}
function IconDoc({ className = "size-5" }) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h8" />
    </svg>
  )
}
function IconPending({ className = "size-5" }) {
  return (
    <svg {...iconBase} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
function IconCheck({ className = "size-5" }) {
  return (
    <svg {...iconBase} className={className}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}
function IconInbox({ className = "size-5" }) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}
function IconClose({ className = "size-4" }) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

const TYPE_ICON_CMP = {
  leave: IconLeave,
  facility: IconReport,
  other: IconDoc,
}
function TypeIcon({ type, className }) {
  const Cmp = TYPE_ICON_CMP[type] ?? IconDoc
  return <Cmp className={className} />
}

const STATUS_LABEL = {
  pending_branch_head:       "รอหัวหน้าสาขาอนุมัติ",
  pending_assistant_manager: "รอผู้ช่วยผู้จัดการอนุมัติ",
  pending_manager:           "รอผู้จัดการอนุมัติ",
  approved:                  "อนุมัติแล้ว",
  rejected:                  "ไม่อนุมัติ",
}

const STATUS_COLOR = {
  pending_branch_head:       "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  pending_assistant_manager: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  pending_manager:           "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  approved:                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected:                  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

const TYPE_LABEL = {
  leave:    "ใบลา",
  facility: "รายงาน",
  other:    "อื่นๆ",
}

// ─── mock data ──────────────────────────────────────────────────────────────
const INITIAL_ITEMS = [
  {
    id: 1,
    type: "leave",
    docRef: "LV-2568-001",
    fromName: "นายสมชาย ดีใจ",
    fromPosition: "เจ้าหน้าที่สินเชื่อ",
    subject: "ขออนุมัติลาพักผ่อน 2 วัน (12-13 พ.ค. 2568)",
    submittedAt: "2568-05-10T09:30:00",
    urgency: "normal",
    status: "pending",
    approvalStep: "pending_branch_head",
  },
  {
    id: 2,
    type: "leave",
    docRef: "LV-2568-002",
    fromName: "นางสาวมาลี รักงาน",
    fromPosition: "นักวิชาการเงินและบัญชี",
    subject: "ขออนุมัติลาป่วย 1 วัน (11 พ.ค. 2568)",
    submittedAt: "2568-05-10T13:15:00",
    urgency: "urgent",
    status: "pending",
    approvalStep: "pending_branch_head",
  },
  {
    id: 3,
    type: "facility",
    docRef: "FC-2568-008",
    fromName: "นายประสิทธิ์ เก่งมาก",
    fromPosition: "เจ้าหน้าที่การตลาด",
    subject: "รายงานค่าใช้จ่ายสถานที่ประจำเดือนเมษายน 2568",
    submittedAt: "2568-05-09T08:00:00",
    urgency: "normal",
    status: "pending",
    approvalStep: "pending_manager",
  },
  {
    id: 4,
    type: "leave",
    docRef: "LV-2568-003",
    fromName: "นายวิชัย ตั้งใจ",
    fromPosition: "เจ้าหน้าที่บัญชี",
    subject: "ขออนุมัติลากิจส่วนตัว 3 วัน (5-7 พ.ค. 2568)",
    submittedAt: "2568-05-04T10:00:00",
    urgency: "urgent",
    status: "approved",
    approvalStep: "approved",
  },
  {
    id: 5,
    type: "leave",
    docRef: "LV-2568-004",
    fromName: "นางสาวจิราพร สดใส",
    fromPosition: "เจ้าหน้าที่ทั่วไป",
    subject: "ขออนุมัติลาพักผ่อน 5 วัน (14-18 พ.ค. 2568)",
    submittedAt: "2568-05-10T14:45:00",
    urgency: "normal",
    status: "pending",
    approvalStep: "pending_assistant_manager",
  },
  {
    id: 6,
    type: "other",
    docRef: "OT-2568-011",
    fromName: "นายสุรศักดิ์ มุ่งมั่น",
    fromPosition: "ผู้ช่วยผู้จัดการ",
    subject: "ขออนุมัติเดินทางไปราชการ จ.อุบลราชธานี (20-22 พ.ค. 2568)",
    submittedAt: "2568-05-09T15:00:00",
    urgency: "normal",
    status: "rejected",
    approvalStep: "rejected",
  },
  {
    id: 7,
    type: "leave",
    docRef: "LV-2568-005",
    fromName: "นางวิไลวรรณ ใสซื่อ",
    fromPosition: "เจ้าหน้าที่ธุรการ",
    subject: "ขออนุมัติลาคลอดบุตร 90 วัน (1 มิ.ย. – 28 ส.ค. 2568)",
    submittedAt: "2568-05-08T09:00:00",
    urgency: "normal",
    status: "pending",
    approvalStep: "pending_branch_head",
  },
]

// ─── utils ──────────────────────────────────────────────────────────────────
function fmtDateTimeTh(isoStr) {
  if (!isoStr) return "—"
  try {
    const d = new Date(isoStr)
    return d.toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return isoStr
  }
}

function relativeTime(isoStr) {
  if (!isoStr) return ""
  try {
    const d = new Date(isoStr)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "เมื่อกี้"
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay} วันที่แล้ว`
    return fmtDateTimeTh(isoStr)
  } catch {
    return isoStr
  }
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, colorCls, icon }) {
  return (
    <div className={`${cardCls} flex items-center gap-4`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${colorCls}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const label = STATUS_LABEL[status] ?? status
  const color = STATUS_COLOR[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {label}
    </span>
  )
}

function UrgencyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none" />
      ด่วน
    </span>
  )
}

// ─── Approve/Reject Modal ────────────────────────────────────────────────────
function ActionModal({ isOpen, action, item, onClose, onConfirm }) {
  const [note, setNote] = useState("")
  const [confirming, setConfirming] = useState(false)

  if (!isOpen || !item) return null

  const isApprove = action === "approve"
  const title = isApprove ? "ยืนยันอนุมัติ" : "ยืนยันไม่อนุมัติ"
  const btnCls = isApprove
    ? "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 focus:ring-emerald-500"
    : "bg-red-600 hover:bg-red-500 active:bg-red-700 focus:ring-red-500"
  const btnLabel = isApprove ? "อนุมัติ" : "ไม่อนุมัติ"

  const handleConfirm = async () => {
    setConfirming(true)
    await onConfirm(item.id, action, note)
    setConfirming(false)
    setNote("")
    onClose()
  }

  const handleClose = () => {
    if (confirming) return
    setNote("")
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="ปิด"
        onClick={handleClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              เอกสาร: <span className="font-semibold text-gray-700 dark:text-gray-300">{item.docRef}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={confirming}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer disabled:cursor-not-allowed"
            aria-label="ปิด"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Subject summary */}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 px-4 py-3 text-sm">
          <p className="font-semibold text-gray-800 dark:text-gray-200">{item.fromName}</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{item.subject}</p>
        </div>

        {/* Note textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            หมายเหตุ {isApprove ? "(ไม่บังคับ)" : "(แนะนำให้ระบุเหตุผล)"}
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
            rows={3}
            placeholder={isApprove ? "ระบุหมายเหตุ (ถ้ามี)" : "ระบุเหตุผลที่ไม่อนุมัติ"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={confirming}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={confirming}
            className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className={`flex-1 h-10 rounded-xl text-white text-sm font-semibold transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2 ${btnCls}`}
          >
            {confirming ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              btnLabel
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Item Row ────────────────────────────────────────────────────────────────
function InboxItem({ item, onApprove, onReject, onView }) {
  const isPending = item.status === "pending"

  return (
    <div className={`${cardCls} space-y-3`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-500 dark:text-gray-400">
            <TypeIcon type={item.type} className="size-4" />
          </span>
          <span className="rounded-lg bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
            {TYPE_LABEL[item.type] ?? item.type}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{item.docRef}</span>
          {item.urgency === "urgent" && <UrgencyBadge />}
        </div>
        <StatusBadge status={item.approvalStep} />
      </div>

      {/* Subject */}
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
        {item.subject}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
            {(item.fromName[0] || "?").toUpperCase()}
          </div>
          <span className="font-medium text-gray-700 dark:text-gray-300">{item.fromName}</span>
          <span className="text-gray-400 dark:text-gray-500">·</span>
          <span>{item.fromPosition}</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span title={fmtDateTimeTh(item.submittedAt)}>{relativeTime(item.submittedAt)}</span>
        </div>
      </div>

      {/* Approval step indicator */}
      {isPending && (
        <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5">
          <svg className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
            ขั้นตอน: {STATUS_LABEL[item.approvalStep] ?? item.approvalStep}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100 dark:border-gray-700/50">
        <button
          type="button"
          onClick={() => onView(item)}
          className="flex items-center gap-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-transparent px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          ดูรายละเอียด
        </button>

        {isPending && (
          <>
            <button
              type="button"
              onClick={() => onApprove(item)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition shadow-sm cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              อนุมัติ
            </button>
            <button
              type="button"
              onClick={() => onReject(item)}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 active:bg-red-700 transition shadow-sm cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              ไม่อนุมัติ
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ item, onClose }) {
  if (!item) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-500 dark:text-gray-400">
                <TypeIcon type={item.type} className="size-4" />
              </span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-mono">{item.docRef}</span>
              {item.urgency === "urgent" && <UrgencyBadge />}
            </div>
            <h2 id="detail-modal-title" className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">
              {item.subject}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
            aria-label="ปิด"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 divide-y divide-gray-100 dark:divide-gray-700/50">
          {[
            ["ประเภท", TYPE_LABEL[item.type] ?? item.type],
            ["ผู้ยื่น", item.fromName],
            ["ตำแหน่ง", item.fromPosition],
            ["วันที่ยื่น", fmtDateTimeTh(item.submittedAt)],
            ["ขั้นตอน", STATUS_LABEL[item.approvalStep] ?? item.approvalStep],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
              <span className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400">{k}</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{v}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400">สถานะ</span>
            <StatusBadge status={item.approvalStep} />
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          * ข้อมูล mock — จะแสดงรายละเอียดเต็มเมื่อเชื่อม backend
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
        >
          ปิด
        </button>
      </div>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────
export default function Inbox() {
  // Local state for mock data (simulate BE mutation)
  const [items, setItems] = useState(INITIAL_ITEMS)

  // Filters
  const [filterType, setFilterType] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  // Modal state
  const [modal, setModal] = useState({ open: false, action: null, item: null })
  const [detailItem, setDetailItem] = useState(null)

  // ─── summary counts ────────────────────────────────────────────────────────
  const pendingCount = useMemo(
    () => items.filter((i) => i.status === "pending").length,
    [items]
  )
  // วันนี้ = อนุมัติ/ไม่อนุมัติแล้ว (ในชีวิตจริงจะดูจาก updatedAt วันนี้)
  const resolvedTodayCount = useMemo(
    () => items.filter((i) => i.status === "approved" || i.status === "rejected").length,
    [items]
  )
  const totalCount = items.length

  // ─── filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filterType && item.type !== filterType) return false
      if (filterStatus && item.status !== filterStatus) return false
      return true
    })
  }, [items, filterType, filterStatus])

  // ─── handlers ──────────────────────────────────────────────────────────────
  const handleApprove = (item) => {
    setModal({ open: true, action: "approve", item })
  }

  const handleReject = (item) => {
    setModal({ open: true, action: "reject", item })
  }

  const handleView = (item) => {
    setDetailItem(item)
  }

  const handleModalClose = () => {
    setModal({ open: false, action: null, item: null })
  }

  const handleModalConfirm = async (itemId, action, _note) => {
    // TODO: call BE API here, e.g.:
    // await apiAuth(`/approvals/${itemId}/${action}`, { method: "POST", body: { note } })
    const newStatus = action === "approve" ? "approved" : "rejected"
    const newStep = action === "approve" ? "approved" : "rejected"
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, status: newStatus, approvalStep: newStep }
          : i
      )
    )
  }

  // ─── dropdown options ──────────────────────────────────────────────────────
  const typeOptions = [
    { value: "", label: "ทุกประเภท" },
    { value: "leave", label: "ใบลา" },
    { value: "facility", label: "รายงาน" },
    { value: "other", label: "อื่นๆ" },
  ]

  const statusOptions = [
    { value: "", label: "ทุกสถานะ" },
    { value: "pending", label: "รออนุมัติ" },
    { value: "approved", label: "อนุมัติแล้ว" },
    { value: "rejected", label: "ไม่อนุมัติ" },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">กล่องงานรออนุมัติ</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          เอกสารที่รอการพิจารณาอนุมัติของคุณ
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          label="รออนุมัติ"
          value={pendingCount}
          icon={<IconPending className="size-6" />}
          colorCls="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
        />
        <SummaryCard
          label="ดำเนินการแล้ว"
          value={resolvedTodayCount}
          icon={<IconCheck className="size-6" />}
          colorCls="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          label="เอกสารทั้งหมด"
          value={totalCount}
          icon={<IconInbox className="size-6" />}
          colorCls="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
        />
      </div>

      {/* Filter bar */}
      <div className={`${cardCls} !p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">กรองตาม:</span>
          <div className="w-44">
            <SelectDropdown
              options={typeOptions}
              value={filterType}
              onChange={setFilterType}
              placeholder="ประเภทเอกสาร"
            />
          </div>
          <div className="w-44">
            <SelectDropdown
              options={statusOptions}
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="สถานะ"
            />
          </div>
          {(filterType || filterStatus) && (
            <button
              type="button"
              onClick={() => { setFilterType(""); setFilterStatus("") }}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium cursor-pointer transition"
            >
              ล้างตัวกรอง
              <IconClose className="size-3" />
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">
            แสดง {filtered.length} จาก {totalCount} รายการ
          </span>
        </div>
      </div>

      {/* Item list */}
      {filtered.length === 0 ? (
        <div className={cardCls}>
          <EmptyState
            icon={<IconInbox className="size-12" />}
            title={filterType || filterStatus ? "ไม่มีรายการตรงกับตัวกรอง" : "ไม่มีข้อความ"}
            description={
              filterType || filterStatus
                ? "ลองเปลี่ยนตัวกรอง หรือล้างตัวกรองเพื่อดูทั้งหมด"
                : "ยังไม่มีเอกสารในกล่องรออนุมัติของคุณ"
            }
            action={
              filterType || filterStatus ? (
                <button
                  type="button"
                  onClick={() => { setFilterType(""); setFilterStatus("") }}
                  className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200 dark:hover:bg-gray-700/50"
                >
                  ล้างตัวกรอง
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <InboxItem
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              onView={handleView}
            />
          ))}
        </div>
      )}

      {/* Approve/Reject modal */}
      <ActionModal
        isOpen={modal.open}
        action={modal.action}
        item={modal.item}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
      />

      {/* Detail modal */}
      <DetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
    </div>
  )
}
