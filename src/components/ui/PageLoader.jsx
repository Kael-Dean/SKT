// src/components/ui/PageLoader.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full-area loading state — replaces ad-hoc inline pageSpinnerCls spinners.
// variant: "spinner" | "table" | "cards" | "dashboard". Carries the
// role="status" + aria-busy so the structural skeletons inside stay decorative.
// ─────────────────────────────────────────────────────────────────────────────
import { cx, pageSpinnerCls } from "../../lib/styles"
import Card from "./Card"
import { SkeletonTableRows, SkeletonCard, SkeletonStat } from "./Skeleton"

const DEFAULT_MESSAGE = "กำลังโหลด…"

/** Centered spinner with an optional Thai caption. */
function SpinnerView({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <span className={pageSpinnerCls} aria-hidden="true" />
      {message ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      ) : null}
    </div>
  )
}

/** Card-wrapped skeleton data table (header row + body rows). */
function TableView({ rows = 8 }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="px-3 py-3 text-left">
                  <span
                    aria-hidden="true"
                    className="block h-3 w-2/3 rounded bg-slate-300/70 dark:bg-slate-600/70"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SkeletonTableRows rows={rows} cols={5} />
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** Responsive grid of card skeletons. */
function CardsView({ rows = 6 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

/** Dashboard skeleton: a row of stat tiles + a content card block. */
function DashboardView({ rows = 4 }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>
      <SkeletonCard />
    </div>
  )
}

/** Full-area loading placeholder. Defaults to a centered spinner. */
export default function PageLoader({ variant = "spinner", rows, message = DEFAULT_MESSAGE, className = "" }) {
  let view
  if (variant === "table") view = <TableView rows={rows} />
  else if (variant === "cards") view = <CardsView rows={rows} />
  else if (variant === "dashboard") view = <DashboardView rows={rows} />
  else view = <SpinnerView message={message} />

  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cx("w-full", className)}>
      {/* Screen-reader announcement; skeletons themselves are aria-hidden. */}
      <span className="sr-only">{message}</span>
      {view}
    </div>
  )
}
