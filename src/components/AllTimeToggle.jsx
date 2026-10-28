import { CalendarRange, Check } from "lucide-react"
import { cx, focusRingCls } from "../lib/styles"

// Backend report endpoints require start_date/end_date, so "all time" sends a
// range wide enough to cover every order instead of dropping the params.
export const ALL_TIME_START = "2000-01-01"
export const ALL_TIME_END = "2099-12-31"

/** Toggle button: show orders from every date (disables the date range). */
export default function AllTimeToggle({ active, onChange, className = "" }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onChange(!active)}
      className={cx(
        "inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer md:min-h-0 md:py-3 md:text-base",
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
