// src/components/ui/ConfirmDialog.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Confirm step before a permanent / destructive action (alertdialog).
//
//   <ConfirmDialog
//     open={open} title="ยืนยันการเลื่อนขั้นเงินเดือน" description="…"
//     confirmLabel="ยืนยันเลื่อนขั้น" tone="primary" initialFocus="cancel"
//     loading={saving} error={err}
//     onConfirm={save} onCancel={() => setOpen(false)}
//   >{summary}</ConfirmDialog>
//
// Rendered through <Portal> (body scroll lock). Follows HrModal's focus pattern:
// focus moves in on open, Tab is trapped inside, focus returns to the opener on
// close. Esc / backdrop / cancel are ignored while `loading`.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef } from "react"
import { LoaderCircle } from "lucide-react"
import Portal from "../Portal"
import useModalDismiss from "../../lib/useModalDismiss"
import { cx, dangerBtnCls, neutralBtnCls, primaryBtnCls } from "../../lib/styles"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function DialogBody({
  title,
  description,
  children,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "primary",
  loading = false,
  loadingLabel = "กำลังบันทึก…",
  error,
  onConfirm,
  onCancel,
  initialFocus = "cancel",
}) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef(null)
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)
  const { backdropProps } = useModalDismiss(onCancel, { disabled: loading })

  // Focus in on open, trap Tab (Esc via useModalDismiss), focus back to opener on close.
  useEffect(() => {
    const opener = document.activeElement
    const target = initialFocus === "confirm" ? confirmRef.current : cancelRef.current
    ;(target || panelRef.current)?.focus()

    const onKey = (e) => {
      if (e.key !== "Tab" || !panelRef.current) return
      const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)]
      if (nodes.length === 0) {
        e.preventDefault()
        panelRef.current.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per open
  }, [])

  // Keep focus inside while loading disables the buttons (disabled = blurred).
  useEffect(() => {
    if (loading && panelRef.current && !panelRef.current.contains(document.activeElement)) {
      panelRef.current.focus()
    }
  }, [loading])

  const confirmCls = tone === "danger" ? dangerBtnCls : primaryBtnCls

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[10070] flex items-center justify-center bg-gray-950/50 p-4 animate-fade-in"
        {...backdropProps}
      >
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          aria-busy={loading || undefined}
          tabIndex={-1}
          className={cx(
            "w-[min(28rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-lg",
            "ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700 focus:outline-none animate-dialog-in"
          )}
        >
          <h2 id={titleId} className="text-lg font-bold text-balance text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          {description && (
            <p id={descId} className="mt-1 text-sm leading-relaxed text-pretty text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}

          {children && <div className="mt-4 text-sm text-gray-700 dark:text-gray-200">{children}</div>}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-pretty text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              ref={cancelRef}
              type="button"
              onClick={() => !loading && onCancel?.()}
              disabled={loading}
              className={cx(neutralBtnCls, "w-full sm:w-auto")}
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={() => !loading && onConfirm?.()}
              disabled={loading}
              className={cx(confirmCls, "w-full sm:w-auto")}
            >
              {loading && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />}
              {loading ? loadingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

/** Confirm dialog — renders nothing while `open` is false. */
export default function ConfirmDialog({ open, ...props }) {
  if (!open) return null
  return <DialogBody {...props} />
}
