import { CalendarRange, Check } from "lucide-react"
import { cx, focusRingCls } from "../lib/styles"

/**
 * Toggle button: show records from every date. Range helpers live in lib/allTime.js.
 * size "sm" matches the h-10 inputs of the compact filter bars.
 */
export default function AllTimeToggle({ active, onChange, size = "md", className = "" }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onChange(!active)}
      className={cx(
        "inline-flex min-h-touch items-center justify-center gap-2 px-4 font-semibold transition-colors duration-150 cursor-pointer active:translate-y-px",
        size === "sm"
          ? "rounded-xl py-2 text-sm md:pointer-fine:min-h-10"
          : "rounded-xl py-2 text-sm md:pointer-fine:min-h-10 md:py-2.5 md:text-[15px] md:leading-6",
        active
          ? "bg-emerald-50 text-emerald-800 ring-2 ring-inset ring-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400"
          : "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-100 dark:bg-white/[.04] dark:text-gray-100 dark:ring-line-strong dark:hover:bg-white/[.08]",
        focusRingCls,
        className
      )}
    >
      {active
        ? <Check aria-hidden="true" className="size-4" />
        : <CalendarRange aria-hidden="true" className="size-4" />}
      ดูทั้งหมด (ทุกช่วงเวลา)
    </button>
  )
}
