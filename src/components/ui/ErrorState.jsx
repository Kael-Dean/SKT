// src/components/ui/ErrorState.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Centralized red error box (replaces the repeated inline alert across pages).
// role="alert" announces the message; the icon is decorative. Pass onRetry to
// surface a "ลองใหม่" button right where the failure happened.
// ─────────────────────────────────────────────────────────────────────────────
import { cx, secondaryBtnCls } from "../../lib/styles"

const DEFAULT_MESSAGE = "เกิดข้อผิดพลาด ไม่สามารถโหลดข้อมูลได้"

/** Refined red alert with message + optional retry. */
export default function ErrorState({ message, onRetry, className = "" }) {
  return (
    <div
      role="alert"
      className={cx(
        "flex items-start gap-3 rounded-2xl border p-4 text-pretty",
        "border-red-200 bg-red-50 text-red-700",
        "dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 size-5 shrink-0"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{message || DEFAULT_MESSAGE}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={cx(secondaryBtnCls, "mt-3 !px-4 !py-2 !text-sm")}
          >
            ลองใหม่
          </button>
        ) : null}
      </div>
    </div>
  )
}
