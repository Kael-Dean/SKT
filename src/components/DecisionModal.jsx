// src/components/DecisionModal.jsx
// Approve / reject confirmation for 3B leave and 3O requests.
// Rendered through <Portal> (CLAUDE.md rule). The approve button label comes
// from STAGE_APPROVE_LABEL; reject requires a non-blank reason.
// 403 / 404 / 409 are handed to onConflict (caller shows backend detail as is
// and refetches); any other error stays inline so the user can retry.
import { useEffect, useId, useRef, useState } from "react"
import Portal from "./Portal"
import { STAGE_APPROVE_LABEL, statusLabel } from "../lib/approval"
import { approveRequest, rejectRequest, KIND } from "../lib/approvalActions"

const CONFLICT = new Set([403, 404, 409])

export default function DecisionModal({ mode, kind, req, title, summary, onClose, onDone, onConflict }) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const fieldRef = useRef(null)
  const uid = useId()

  const isApprove = mode === "approve"
  const needsReason = !isApprove
  const showNote = isApprove ? kind === KIND.LEAVE : true

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape" && !busy) onClose()
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [busy, onClose])

  if (!req) return null

  const confirmLabel = isApprove ? STAGE_APPROVE_LABEL[req.status] || "อนุมัติ" : "ไม่อนุมัติ"

  const submit = async (e) => {
    e?.preventDefault()
    if (busy) return
    if (needsReason && !text.trim()) {
      setError("กรุณาระบุเหตุผลที่ไม่อนุมัติ")
      fieldRef.current?.focus()
      return
    }
    setBusy(true)
    setError("")
    try {
      if (isApprove) await approveRequest(kind, req, text)
      else await rejectRequest(kind, req, text)
      onDone?.(mode)
    } catch (err) {
      if (CONFLICT.has(err?.status) && onConflict) {
        onConflict(err)
      } else {
        setError(err?.message || "ดำเนินการไม่สำเร็จ กรุณาลองใหม่")
        setBusy(false)
      }
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="ปิด"
          tabIndex={-1}
          onClick={() => !busy && onClose()}
          className="absolute inset-0 cursor-pointer bg-black/50 backdrop-blur-sm"
        />
        <form
          onSubmit={submit}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${uid}-title`}
          className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70"
        >
          <div>
            <h2 id={`${uid}-title`} className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {isApprove ? "ยืนยันการอนุมัติ" : "ไม่อนุมัติคำขอ"}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">ขั้นปัจจุบัน: {statusLabel(req.status)}</p>
          </div>

          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm dark:bg-gray-700/40">
            <p className="font-semibold text-gray-800 dark:text-gray-200">{title}</p>
            {summary && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{summary}</p>}
          </div>

          {showNote && (
            <div className="space-y-1.5">
              <label htmlFor={`${uid}-text`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                {needsReason ? (
                  <>
                    เหตุผลที่ไม่อนุมัติ <span className="text-red-500">*</span>
                  </>
                ) : (
                  "หมายเหตุ (ไม่บังคับ)"
                )}
              </label>
              <textarea
                id={`${uid}-text`}
                ref={fieldRef}
                rows={3}
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  if (error) setError("")
                }}
                disabled={busy}
                aria-required={needsReason}
                aria-invalid={needsReason && !!error}
                aria-describedby={error ? `${uid}-err` : undefined}
                placeholder={needsReason ? "ผู้ยื่นจะเห็นเหตุผลนี้ในการแจ้งเตือน" : "ระบุหมายเหตุถึงผู้ยื่น (ถ้ามี)"}
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          )}

          {error && (
            <p id={`${uid}-err`} role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              ref={showNote ? undefined : fieldRef}
              className="h-10 flex-1 cursor-pointer rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 transition duration-200 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={busy}
              className={[
                "inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-gray-800",
                isApprove
                  ? "bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-500"
                  : "bg-red-600 hover:bg-red-500 focus-visible:ring-red-500",
              ].join(" ")}
            >
              {busy && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {busy ? "กำลังบันทึก..." : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  )
}
