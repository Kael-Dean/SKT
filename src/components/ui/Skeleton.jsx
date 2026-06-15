// src/components/ui/Skeleton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Structural loading skeletons. Calm slate base (animate-pulse) + a layered
// moving highlight (.skeleton-shimmer + .animate-shimmer from index.css).
// Under prefers-reduced-motion both animations stop → a static slate block.
// All skeletons are decorative; mark wrappers aria-hidden where they stand in
// for real content (the surrounding PageLoader carries the role="status").
// ─────────────────────────────────────────────────────────────────────────────
import { cx } from "../../lib/styles"

/** Single shimmering placeholder block. `rounded` overrides the default radius. */
export default function Skeleton({ className = "", rounded = "rounded-xl" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative block overflow-hidden bg-slate-200 dark:bg-slate-700 animate-pulse",
        rounded,
        className,
      )}
    >
      {/* Moving highlight sweep, layered on top of the calm pulse base. */}
      <span className="skeleton-shimmer animate-shimmer absolute inset-0" />
    </span>
  )
}

/** Stacked text lines with a shorter last line for realism. */
export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={cx("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          rounded="rounded-md"
          className={cx(
            "h-3.5",
            i === lines - 1 ? "w-3/5" : i % 2 === 0 ? "w-full" : "w-11/12",
          )}
        />
      ))}
    </div>
  )
}

/** Drop-in skeleton <tr> rows for an existing <tbody> in a data table. */
export function SkeletonTableRows({ rows = 8, cols = 5, className = "" }) {
  // Deterministic per-column width variation so cells don't look like a grid.
  const widths = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-11/12", "w-1/3"]
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className={cx("border-b border-slate-100 dark:border-slate-700/60", className)}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-3 py-3">
              <Skeleton rounded="rounded-md" className={cx("h-3.5", widths[c % widths.length])} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** Card-shaped skeleton matching the cardPaddedCls footprint (title + body). */
export function SkeletonCard({ className = "" }) {
  return (
    <div
      className={cx(
        "rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton rounded="rounded-lg" className="h-5 w-2/5 mb-4" />
      <SkeletonText lines={3} />
    </div>
  )
}

/** KPI / stat tile skeleton — small label line over a large number block. */
export function SkeletonStat({ className = "" }) {
  return (
    <div
      className={cx(
        "rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton rounded="rounded-md" className="h-3 w-1/3 mb-3" />
      <Skeleton rounded="rounded-lg" className="h-8 w-3/5" />
    </div>
  )
}
