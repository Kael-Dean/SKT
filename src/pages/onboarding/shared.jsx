// src/pages/onboarding/shared.jsx
// Small building blocks shared by the onboarding steps (components only — logic lives in
// sectionFlow.js).
import { CircleAlert, TriangleAlert } from "lucide-react"
import { missingLabel } from "../../lib/onboarding"
import { cx, labelCls } from "../../lib/styles"
import { PROBLEM_PANEL_ID } from "./sectionFlow"

/** Step heading: title + one-line purpose. */
export function StepHeader({ title, purpose, id }) {
  return (
    <header className="mb-5 md:mb-6">
      <h1 id={id} className="text-2xl font-bold leading-snug text-balance text-gray-900 md:text-[28px] dark:text-gray-100">
        {title}
      </h1>
      {purpose && <p className="mt-1.5 max-w-prose text-base leading-relaxed text-gray-600 dark:text-gray-300">{purpose}</p>}
    </header>
  )
}

/**
 * Wraps a control; when `flagged`, draws a frame that breathes once.
 * tone "warn" (amber) = still empty from an earlier visit · "error" (red) = rejected on save.
 */
export function Frame({ flagged, tone = "warn", children }) {
  const error = tone === "error"
  return (
    <div className="relative">
      {children}
      {flagged && (
        <>
          <span
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute -inset-[3px] rounded-[1.15rem] ring-2",
              error ? "ring-red-500/80 dark:ring-red-400/80" : "ring-amber-500/80 dark:ring-amber-400/80",
            )}
          />
          <span
            aria-hidden="true"
            className={cx(
              "animate-ob-pulse pointer-events-none absolute -inset-[7px] rounded-[1.4rem] ring-2",
              error
                ? "bg-red-400/10 ring-red-400/40 dark:bg-red-400/10"
                : "bg-amber-400/15 ring-amber-400/40 dark:bg-amber-400/10",
            )}
          />
        </>
      )}
    </div>
  )
}

/** "still empty" (amber) or error (red) line under a control. */
export function MissingHint({ id, tone = "warn", children = "ยังไม่ได้กรอก" }) {
  return (
    <p
      id={id}
      className={cx(
        "mt-1.5 flex items-center gap-1.5 text-sm font-medium",
        tone === "error" ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-300",
      )}
    >
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
      {children}
    </p>
  )
}

/**
 * Label + control + hint. `flagged` = required and still empty (or rejected by the server);
 * `tone` "error" once a save rejected it. The hint gets id `${id}-hint` — point the control's
 * aria-describedby at it. `data-field` = scroll target of focusFirstError.
 */
export function Field({ id, label, required, optional, flagged, tone = "warn", hint, help, className = "", children }) {
  return (
    <div data-field className={cx("min-w-0 scroll-mt-24 scroll-mb-28", className)}>
      <label htmlFor={id} className={labelCls}>
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-red-600 dark:text-red-400">*</span>
            <span className="sr-only"> (จำเป็น)</span>
          </>
        )}
        {optional && <span className="ml-1.5 text-sm font-normal text-gray-500 dark:text-gray-400">ไม่บังคับ</span>}
      </label>
      <Frame flagged={flagged} tone={tone}>{children}</Frame>
      {flagged ? <MissingHint id={`${id}-hint`} tone={tone}>{hint}</MissingHint> : help}
    </div>
  )
}

/** Failed confirm / validation summary — announced, lists what is left in plain Thai. */
export function ProblemPanel({ problem, id = PROBLEM_PANEL_ID }) {
  const has = problem && (problem.missing?.length || problem.message)
  return (
    <div aria-live="assertive" aria-atomic="true">
      {has ? (
        <div
          id={id}
          role="alert"
          tabIndex={-1}
          className="mt-5 scroll-mb-28 rounded-2xl outline-none bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-400/25"
        >
          <p className="flex items-center gap-2 text-[15px] font-semibold text-amber-900 dark:text-amber-200">
            <TriangleAlert aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
            {problem.message ? "ข้อมูลไม่ถูกต้อง" : "ยังกรอกไม่ครบ"}
          </p>
          {problem.missing?.length > 0 && !problem.message && (
            <ul className="mt-2 space-y-1 pl-7 text-[15px] leading-relaxed text-amber-900 dark:text-amber-100">
              {problem.missing.map((m) => (
                <li key={m} className="list-disc">{missingLabel(m)}</li>
              ))}
            </ul>
          )}
          {problem.message && (
            <p className="mt-1.5 pl-7 text-[15px] leading-relaxed text-amber-900 dark:text-amber-100">{problem.message}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** The white card holding a section's fields. */
export function SectionCard({ className = "", children }) {
  return (
    <div
      className={cx(
        "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 md:p-6 dark:bg-surface dark:shadow-none dark:ring-line",
        className,
      )}
    >
      {children}
    </div>
  )
}
