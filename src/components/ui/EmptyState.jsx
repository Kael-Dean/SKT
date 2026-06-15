// src/components/ui/EmptyState.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Empty state that teaches the next step (baseline-ui: one clear next action).
// Muted slate, centered, line-art SVG (currentColor, no emoji). Pass `action`
// (a node, e.g. a button) and an optional custom `icon`.
// ─────────────────────────────────────────────────────────────────────────────
import { cx } from "../../lib/styles"

/** Default line-art "empty box" illustration. */
function DefaultIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-12"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.27 6.96 8.73 5.05 8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  )
}

/** Centered empty state with title, guidance, optional icon + action. */
export default function EmptyState({
  title = "ยังไม่มีข้อมูล",
  description,
  action,
  icon,
  className = "",
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 text-slate-300 dark:text-slate-600">
        {icon || <DefaultIcon />}
      </div>
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 text-balance">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400 text-pretty">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
