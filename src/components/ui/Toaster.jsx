// src/components/ui/Toaster.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders toasts emitted by `toast.*` (./toast.js). Mount ONCE in AppLayout.
//
// Portaled straight to <body> with createPortal — NOT <Portal>, because Portal
// locks body scroll for as long as it is mounted, and the toaster is always
// mounted. z-[10080] sits above dropdowns (10050) and dialogs (10070).
//
// Max 3 visible, newest at the bottom. Auto-dismiss pauses on hover / focus.
// success/info/warning → announced by the persistent aria-live="polite" region; error → role="alert".
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react"
import { subscribe } from "./toast"
import { cx } from "../../lib/styles"

const MAX_VISIBLE = 3

const ICON = {
  success: { Icon: CircleCheck, cls: "text-emerald-600 dark:text-emerald-400" },
  warning: { Icon: TriangleAlert, cls: "text-amber-500 dark:text-amber-400" },
  error: { Icon: CircleX, cls: "text-red-600 dark:text-red-400" },
  info: { Icon: Info, cls: "text-gray-500 dark:text-gray-400" },
}

function ToastCard({ t, onDismiss }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(t.duration)
  const startedAt = useRef(0)

  // Countdown that survives pause/resume (hover or focus inside the card).
  useEffect(() => {
    if (paused || !Number.isFinite(remaining.current)) return
    startedAt.current = Date.now()
    const timer = setTimeout(() => onDismiss(t.id), Math.max(0, remaining.current))
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [paused, t.id, onDismiss])

  const { Icon, cls } = ICON[t.type] ?? ICON.info
  const isError = t.type === "error"

  return (
    <div
      // The polite live region is the persistent container (a role="status"
      // node mounted together with its text is often not announced). Errors
      // use role="alert", which is announced on insertion.
      role={isError ? "alert" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false) }}
      className={cx(
        "pointer-events-auto flex w-full items-start gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-gray-200",
        "dark:bg-gray-800 dark:ring-gray-700 sm:w-[22rem]",
        "animate-fade-up" // global prefers-reduced-motion rule in index.css neutralises it
      )}
    >
      <Icon aria-hidden="true" className={cx("mt-0.5 size-5 shrink-0", cls)} strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{t.title}</p>
        {t.description && (
          <p className="mt-0.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400 break-words">
            {t.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(t.id)}
        aria-label="ปิดการแจ้งเตือน"
        className={cx(
          "-m-1 shrink-0 rounded-lg p-1 text-gray-500 transition-colors duration-150 cursor-pointer",
          "hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        )}
      >
        <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}

export default function Toaster() {
  const [toasts, setToasts] = useState([])
  const dismiss = useCallback((id) => setToasts((list) => list.filter((x) => x.id !== id)), [])

  useEffect(
    () =>
      subscribe((ev) => {
        if (ev.kind === "show") {
          setToasts((list) => {
            // Same id → replace in place (lets callers update a toast).
            const rest = list.filter((x) => x.id !== ev.toast.id)
            return [...rest, ev.toast].slice(-MAX_VISIBLE)
          })
        } else if (ev.kind === "dismiss") {
          setToasts((list) => (ev.id == null ? [] : list.filter((x) => x.id !== ev.id)))
        }
      }),
    []
  )

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      role="region"
      aria-label="การแจ้งเตือน"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[10080] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} onDismiss={dismiss} />
      ))}
    </div>,
    document.body
  )
}
