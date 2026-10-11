// src/components/ui/Stepper.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Step header for phone flows (Buy/Sales stepper). Controls visibility only —
// the page owns state, validation and which step is reachable.
//
//   <Stepper
//     steps={[{ key: "customer", label: "ลูกค้า", shortLabel: "ลูกค้า" }, …]}
//     current={step} maxReached={maxStep} errorSteps={[2]}
//     onSelect={setStep} />
//
//   steps        [{ key, label, shortLabel? }]   shortLabel shows on phones
//   current      index of the active step (aria-current="step")
//   maxReached   highest index the user may jump back/forward to (default = current)
//   errorSteps   indexes or keys whose dot turns red
//   onSelect(i)  only fired for i <= maxReached
//
// Sticky under the Topbar (`top-(--topbar-h)`), 44px hit area around each
// 28px dot, connector fills between dots, "ขั้น 2/4 · ชื่อขั้น" line beneath.
// ─────────────────────────────────────────────────────────────────────────────
import { Check } from "lucide-react"
import { cx, focusRingCls } from "../../lib/styles"

export default function Stepper({
  steps = [],
  current = 0,
  maxReached = current,
  errorSteps = [],
  onSelect,
  className = "",
}) {
  const n = steps.length
  const cur = steps[current]

  return (
    <nav
      aria-label="ขั้นตอน"
      className={cx(
        "sticky top-(--topbar-h) z-20 bg-gray-50/95 py-2 backdrop-blur-sm dark:bg-gray-950/95",
        className,
      )}
    >
      <ol className="flex items-center">
        {steps.map((s, i) => {
          const done = i < current
          const active = i === current
          const hasError = errorSteps.includes(i) || errorSteps.includes(s.key)
          const reachable = i <= maxReached
          return (
            <li key={s.key ?? i} className={cx("flex items-center", i < n - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                aria-label={`ขั้น ${i + 1}: ${s.label}${hasError ? " (มีข้อผิดพลาด)" : ""}`}
                onClick={() => reachable && onSelect?.(i)}
                className={cx(
                  "flex min-h-touch min-w-touch items-center justify-center rounded-xl",
                  reachable ? "cursor-pointer" : "cursor-default",
                  focusRingCls,
                )}
              >
                <span
                  className={cx(
                    "flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-150",
                    hasError
                      ? "bg-red-600 text-white"
                      : active
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-500/20 dark:bg-indigo-500"
                        : done
                          ? "bg-indigo-600 text-white dark:bg-indigo-500"
                          : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
                  )}
                >
                  {done && !hasError ? <Check aria-hidden="true" className="size-4" strokeWidth={2.5} /> : i + 1}
                </span>
              </button>
              {i < n - 1 && (
                <span
                  aria-hidden="true"
                  className={cx(
                    "mx-1 h-0.5 flex-1 rounded-full transition-colors duration-200",
                    i < current ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-200 dark:bg-gray-700",
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-1 text-sm leading-relaxed" aria-live="polite">
        <span className="tabular-nums text-gray-500 dark:text-gray-400">ขั้น {current + 1}/{n}</span>
        {cur && (
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {" · "}
            <span className="md:hidden">{cur.shortLabel ?? cur.label}</span>
            <span className="hidden md:inline">{cur.label}</span>
          </span>
        )}
      </p>
    </nav>
  )
}
