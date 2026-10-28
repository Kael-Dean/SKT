// src/pages/onboarding/shared.jsx
// Small building blocks shared by the onboarding steps (components only — logic lives in
// sectionFlow.js).
import { CircleAlert, TriangleAlert } from "lucide-react"
import { missingLabel } from "../../lib/onboarding"
import { cx, labelCls } from "../../lib/styles"

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

/** Wraps a control; when `flagged`, draws a calm amber frame that breathes once. */
export function Frame({ flagged, children }) {
  return (
    <div className="relative">
      {children}
      {flagged && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[3px] rounded-[1.15rem] ring-2 ring-amber-500/80 dark:ring-amber-400/80"
          />
          <span
            aria-hidden="true"
            className="animate-ob-pulse pointer-events-none absolute -inset-[7px] rounded-[1.4rem] bg-amber-400/15 ring-2 ring-amber-400/40 dark:bg-amber-400/10"
          />
        </>
      )}
    </div>
  )
}

/** Amber "still empty" line under a control. */
export function MissingHint({ id, children = "ยังไม่ได้กรอก" }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
      {children}
    </p>
  )
}

/** Label + control + hint. `flagged` = required and still empty (or rejected by the server). */
export function Field({ id, label, required, optional, flagged, hint, help, className = "", children }) {
  return (
    <div className={cx("min-w-0", className)}>
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
      <Frame flagged={flagged}>{children}</Frame>
      {flagged ? <MissingHint id={`${id}-hint`}>{hint}</MissingHint> : help}
    </div>
  )
}

/** Failed confirm / validation summary — announced, lists what is left in plain Thai. */
export function ProblemPanel({ problem }) {
  const has = problem && (problem.missing?.length || problem.message)
  return (
    <div aria-live="assertive" aria-atomic="true">
      {has ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-400/25"
        >
          <p className="flex items-center gap-2 text-[15px] font-semibold text-amber-900 dark:text-amber-200">
            <TriangleAlert aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
            {problem.missing?.length ? "ยังกรอกไม่ครบ" : "บันทึกไม่สำเร็จ"}
          </p>
          {problem.missing?.length > 0 && (
            <ul className="mt-2 space-y-1 pl-7 text-[15px] leading-relaxed text-amber-900 dark:text-amber-100">
              {problem.missing.map((m) => (
                <li key={m} className="list-disc">{missingLabel(m)}</li>
              ))}
            </ul>
          )}
          {problem.message && !problem.missing?.length && (
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
