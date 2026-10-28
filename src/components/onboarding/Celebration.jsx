// src/components/onboarding/Celebration.jsx
// The one authored moment of onboarding: a check mark that draws itself inside a soft disc,
// with short rays bursting out once (emerald + indigo only). Pure SVG + CSS keyframes
// (ob-draw, ob-burst in index.css); reduced motion shows the finished mark.
import { cx } from "../../lib/styles"

const RAYS = Array.from({ length: 12 }, (_, i) => i)

export default function Celebration({ size = 128, className = "" }) {
  const c = 64
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      aria-hidden="true"
      className={cx("overflow-visible", className)}
    >
      {/* rays */}
      <g className="animate-ob-burst">
        {RAYS.map((i) => {
          const a = (i / RAYS.length) * Math.PI * 2
          const r1 = 50
          const r2 = i % 2 ? 58 : 62
          return (
            <line
              key={i}
              x1={c + Math.cos(a) * r1}
              y1={c + Math.sin(a) * r1}
              x2={c + Math.cos(a) * r2}
              y2={c + Math.sin(a) * r2}
              strokeWidth="3"
              strokeLinecap="round"
              className={i % 2 ? "stroke-indigo-400 dark:stroke-indigo-300" : "stroke-emerald-500 dark:stroke-emerald-400"}
            />
          )
        })}
      </g>
      {/* disc + ring */}
      <circle cx={c} cy={c} r="40" className="fill-emerald-50 dark:fill-emerald-500/15" />
      <circle
        cx={c}
        cy={c}
        r="40"
        fill="none"
        strokeWidth="3"
        pathLength="1"
        strokeDasharray="1 1"
        style={{ "--ob-from": 1, "--ob-to": 0 }}
        className="animate-ob-draw origin-center -rotate-90 stroke-emerald-600 [transform-box:fill-box] dark:stroke-emerald-400"
      />
      {/* check */}
      <path
        d="M47 65 L59 77 L82 52"
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        strokeDasharray="1 1"
        style={{ "--ob-from": 1, "--ob-to": 0 }}
        className="animate-ob-draw-late stroke-emerald-600 dark:stroke-emerald-300"
      />
    </svg>
  )
}
