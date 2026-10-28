// src/components/onboarding/ProgressRing.jsx
// n / total ring for onboarding (Welcome step, Home resume banner). The arc draws from 0
// to its value once on mount (ob-draw); later value changes glide via stroke-dashoffset.
import { cx } from "../../lib/styles"

export default function ProgressRing({ value = 0, total = 7, size = 96, stroke = 8, label, className = "", children }) {
  const r = (size - stroke) / 2
  const frac = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0
  const done = frac >= 1
  return (
    <div
      role="img"
      aria-label={label ?? `กรอกแล้ว ${value} จาก ${total} หัวข้อ`}
      className={cx("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-gray-200 dark:stroke-white/10"
        />
        {frac > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1 1"
            style={{ "--ob-from": 1, "--ob-to": 1 - frac, strokeDashoffset: 1 - frac, transition: "stroke-dashoffset 600ms var(--ease-out-expo)" }}
            className={cx(
              "animate-ob-draw",
              done ? "stroke-emerald-600 dark:stroke-emerald-400" : "stroke-indigo-600 dark:stroke-indigo-400",
            )}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        {children ?? (
          <span className="text-center leading-none tabular-nums">
            <span className={cx("font-bold text-gray-900 dark:text-gray-100", size >= 80 ? "text-2xl" : "text-sm")}>{value}</span>
            <span className={cx("text-gray-500 dark:text-gray-400", size >= 80 ? "text-sm" : "text-[11px]")}>/{total}</span>
          </span>
        )}
      </span>
    </div>
  )
}
