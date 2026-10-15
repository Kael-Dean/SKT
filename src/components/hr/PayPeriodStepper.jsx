// src/components/hr/PayPeriodStepper.jsx
// สถานะงวดเงินเดือน ร่าง → ตรวจสอบ → อนุมัติ → ปิดงวด (แสดงผลอย่างเดียว ไม่ใช่ปุ่ม)
// ขั้นที่ผ่านแล้ว = เครื่องหมายถูก, ขั้นปัจจุบัน = วงแหวน indigo + aria-current="step"
import { Check } from "lucide-react"
import { PERIOD_STEPS, periodStepIndex } from "../../lib/payroll"
import { cx } from "../../lib/styles"

export default function PayPeriodStepper({ status, className = "" }) {
  const current = periodStepIndex(status)
  const closed = status === "closed"
  return (
    <ol aria-label="ขั้นตอนของงวดเงินเดือน" className={cx("flex items-center", className)}>
      {PERIOD_STEPS.map((s, i) => {
        const done = i < current || (closed && i === current)
        const active = i === current && !closed
        return (
          <li key={s.key} aria-current={i === current ? "step" : undefined} className={cx("flex items-center", i < PERIOD_STEPS.length - 1 && "flex-1")}>
            <span className="flex items-center gap-2">
              <span
                className={cx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  done && "bg-indigo-600 text-white dark:bg-indigo-500",
                  active && "bg-white text-indigo-700 ring-2 ring-indigo-600 dark:bg-surface dark:text-indigo-200 dark:ring-indigo-400",
                  !done && !active && "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-300 dark:bg-white/[.04] dark:text-gray-400 dark:ring-line-strong",
                )}
              >
                {done ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cx(
                  "whitespace-nowrap text-sm",
                  // จอแคบ: แสดงชื่อเฉพาะขั้นปัจจุบัน (ขั้นอื่นยังอ่านได้ด้วย screen reader)
                  i !== current && "max-sm:sr-only",
                  active ? "font-semibold text-gray-900 dark:text-gray-100" : done ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400",
                )}
              >
                {s.label}
                <span className="sr-only">{done ? " (ผ่านแล้ว)" : active ? " (ขั้นปัจจุบัน)" : ""}</span>
              </span>
            </span>
            {i < PERIOD_STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cx("mx-2 h-px min-w-3 flex-1 md:mx-3", i < current ? "bg-indigo-500 dark:bg-indigo-400" : "bg-gray-200 dark:bg-line-strong")}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
