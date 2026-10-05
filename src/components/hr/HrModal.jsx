// src/components/hr/HrModal.jsx
// Dialog shell for HR position/salary flows — always rendered through <Portal>
// (CLAUDE.md rule). Esc closes (unless busy), focus moves into the dialog on open
// and returns to the trigger on close.
import { useEffect, useId, useRef } from "react"
import Portal from "../Portal"

export default function HrModal({ title, subtitle, onClose, busy = false, size = "sm", children, footer }) {
  const titleId = useId()
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)

  useEffect(() => {
    closeRef.current = onClose
    busyRef.current = busy
  })

  useEffect(() => {
    const prevFocus = document.activeElement
    const first = panelRef.current?.querySelector(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-autofocus]"
    )
    ;(first || panelRef.current)?.focus()
    const onKey = (e) => {
      if (e.key === "Escape" && !busyRef.current) closeRef.current?.()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus()
    }
  }, [])

  const width = size === "md" ? "max-w-lg" : "max-w-md"

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.() }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`w-full ${width} max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4 focus:outline-none`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100 text-balance">{title}</h3>
              {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="ปิด"
              className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors duration-200 cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
          {footer && <div className="flex gap-3 pt-1">{footer}</div>}
        </div>
      </div>
    </Portal>
  )
}

const NOTICE_TONES = {
  error: "border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200",
  info: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800/60 dark:bg-indigo-900/20 dark:text-indigo-200",
}

/** Inline message box. Errors use role="alert", others role="status". */
export function Notice({ tone = "info", title, children, className = "" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-3.5 py-3 text-sm text-pretty ${NOTICE_TONES[tone] ?? NOTICE_TONES.info} ${className}`}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
    </div>
  )
}
