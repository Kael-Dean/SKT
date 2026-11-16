// src/components/ThaiDatePicker.jsx
// Buddhist-calendar date picker. value/onChange are ISO "YYYY-MM-DD" (CE).
//
// Desktop: the calendar is portaled to <body> (position: fixed, z 10050 via
// useAnchoredPanel) so no table scrollbar / overflow wrapper can clip it.
// Phone (<md) and a phone in landscape: opens as a <Sheet size="sm"> with 44px day
// buttons, because a popover next to the field has room for only two rows there.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import useAnchoredPanel from "../lib/useAnchoredPanel"
import { useIsCoarsePointer, useIsPhone, useMediaQuery } from "../hooks/useMediaQuery"
import Sheet from "./ui/Sheet"
import { cx, focusRingCls, fieldErrorCls } from "../lib/styles"

const PANEL_Z = 10050
const PANEL_W = 288
const PANEL_W_TOUCH = 352 // 7 columns × 44px + grid gaps + panel padding/border
const SHORT_TOUCH = "(pointer: coarse) and (max-height: 500px)" // same as the short-touch variant in index.css

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]

const DAY_HEADERS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]

/** วันนี้ตามเวลาเครื่อง (ไม่ผ่าน UTC — กันวันเพี้ยนช่วงเช้ามืดเวลาไทย) */
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function parseCE(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return null
  return { year: y, month: m, day: d }
}

function formatDisplay(iso) {
  const p = parseCE(iso)
  if (!p) return ""
  return `${p.day} ${THAI_MONTHS[p.month - 1]} ${p.year + 543}`
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function firstDayOfMonth(year, month) {
  return new Date(year, month - 1, 1).getDay()
}

const navBtnCls =
  "flex size-11 md:pointer-fine:size-9 cursor-pointer items-center justify-center rounded-xl text-gray-500 transition-colors " +
  "duration-150 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.08] dark:hover:text-gray-100 " +
  focusRingCls

/** Month grid — shared by the desktop popover and the phone sheet. */
const YEARS_PER_PAGE = 20

const cellBtnCls = (selected, current) =>
  cx(
    "h-11 w-full cursor-pointer rounded-xl text-sm font-medium tabular-nums transition-colors duration-150",
    focusRingCls,
    selected
      ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-600"
      : current
        ? "bg-indigo-50 font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-200"
        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[.06]",
  )

const headBtnCls = cx(
  "inline-flex min-h-touch cursor-pointer items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-gray-900 transition-colors duration-150",
  "hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/[.08] md:pointer-fine:min-h-9",
  focusRingCls,
)

/** Year grid (20 per page, Buddhist years) — click the month header to get here. */
function YearGrid({ value, today, viewYear, pageStart, onPage, onPick }) {
  const sel = parseCE(value)?.year
  const cur = parseCE(today)?.year
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i)
  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => onPage(-YEARS_PER_PAGE)} aria-label="ช่วงปีก่อนหน้า" className={navBtnCls}>
          <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2} />
        </button>
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100" aria-live="polite">
          พ.ศ. {pageStart + 543} – {pageStart + YEARS_PER_PAGE - 1 + 543}
        </span>
        <button type="button" onClick={() => onPage(YEARS_PER_PAGE)} aria-label="ช่วงปีถัดไป" className={navBtnCls}>
          <ChevronRight aria-hidden="true" className="size-5" strokeWidth={2} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1" role="listbox" aria-label="เลือกปี">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            role="option"
            aria-selected={y === (sel ?? viewYear)}
            onClick={() => onPick(y)}
            className={cellBtnCls(y === (sel ?? viewYear), y === cur)}
          >
            {y + 543}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Month grid for the chosen year. */
function MonthGrid({ value, today, viewYear, viewMonth, onYear, onPick }) {
  const sel = parseCE(value)
  const cur = parseCE(today)
  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-center">
        <button type="button" onClick={onYear} className={headBtnCls} aria-label={`ปี ${viewYear + 543} เปลี่ยนปี`}>
          พ.ศ. {viewYear + 543}
          <ChevronDown aria-hidden="true" className="size-4 text-gray-400" strokeWidth={2} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1" role="listbox" aria-label="เลือกเดือน">
        {THAI_MONTHS.map((m, i) => {
          const month = i + 1
          const selected = sel ? sel.year === viewYear && sel.month === month : month === viewMonth
          return (
            <button
              key={m}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onPick(month)}
              className={cellBtnCls(selected, cur?.year === viewYear && cur?.month === month)}
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Calendar({ value, today, viewYear, viewMonth, onPrev, onNext, onPick, onToday, onHeader }) {
  const totalDays = daysInMonth(viewYear, viewMonth)
  const firstDay = firstDayOfMonth(viewYear, viewMonth)
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={onPrev} aria-label="เดือนก่อนหน้า" className={navBtnCls}>
          <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2} />
        </button>
        <button type="button" onClick={onHeader} className={headBtnCls} aria-live="polite" aria-label={`${THAI_MONTHS[viewMonth - 1]} ${viewYear + 543} เลือกเดือนและปี`}>
          {THAI_MONTHS[viewMonth - 1]} {viewYear + 543}
          <ChevronDown aria-hidden="true" className="size-4 text-gray-400" strokeWidth={2} />
        </button>
        <button type="button" onClick={onNext} aria-label="เดือนถัดไป" className={navBtnCls}>
          <ChevronRight aria-hidden="true" className="size-5" strokeWidth={2} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7" aria-hidden="true">
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={cx("py-1 text-center text-xs font-medium", i === 0 ? "text-red-400" : "text-gray-400")}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label="ปฏิทิน">
        {cells.map((day, i) => {
          if (!day) return <div key={i} aria-hidden="true" />
          const iso = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const isSelected = iso === value
          const isToday = iso === today
          const isSun = i % 7 === 0
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(day)}
              aria-pressed={isSelected}
              aria-label={`${day} ${THAI_MONTHS[viewMonth - 1]} ${viewYear + 543}`}
              className={cx(
                // min-w-0: at 320px a column is ~41px, and the global 44px floor would overlap the next day
                "h-11 w-full min-w-0 cursor-pointer rounded-xl text-sm font-medium tabular-nums transition-colors duration-150 md:pointer-fine:h-9",
                focusRingCls,
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-600"
                  : isToday
                    ? "bg-indigo-50 font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-200"
                    : isSun
                      ? "text-red-500 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-white/[.06]"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[.06]",
              )}
            >
              {day}
            </button>
          )
        })}
      </div>

      <div className="mt-2 border-t border-gray-100 pt-2 text-center dark:border-line">
        <button
          type="button"
          onClick={onToday}
          className={cx("min-h-touch cursor-pointer rounded-lg px-3 text-sm text-indigo-600 hover:underline dark:text-indigo-400 md:pointer-fine:min-h-8", focusRingCls)}
        >
          วันนี้
        </button>
      </div>
    </div>
  )
}

/**
 * ref → ปุ่มเปิดปฏิทิน (focus() ได้เหมือน input เดิม — ใช้กับ Enter-flow ของฟอร์ม)
 * onKeyDown / error / disabled / ariaDescribedBy ส่งต่อให้ปุ่ม
 */
const ThaiDatePicker = forwardRef(function ThaiDatePicker({
  value = "", onChange, className = "", id, ariaLabel = "เลือกวันที่",
  onKeyDown, onFocus, error = false, disabled = false, ariaDescribedBy, placeholder = "— เลือกวันที่ —",
}, ref) {
  const today = todayISO()
  const parsed = parseCE(value)
  const now = new Date()

  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth() + 1)
  const [open, setOpen] = useState(false)
  // "days" → click header → "years" → pick → "months" → pick → "days"
  const [mode, setMode] = useState("days")
  const [pageStart, setPageStart] = useState(0)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  useImperativeHandle(ref, () => triggerRef.current)
  const isPhone = useIsPhone()
  const isShortTouch = useMediaQuery(SHORT_TOUCH)
  const asSheet = isPhone || isShortTouch
  // จอสัมผัสที่ ≥md (tablet/มือถือแนวนอน) ยังเป็น popover: ขยายให้วันกว้าง ≥44px
  const isCoarse = useIsCoarsePointer()
  const panelW = isCoarse ? PANEL_W_TOUCH : PANEL_W
  const { style } = useAnchoredPanel(triggerRef, { open: open && !asSheet, minW: panelW, maxW: panelW, maxH: isCoarse ? 480 : 400 })

  useEffect(() => {
    if (parsed) { setViewYear(parsed.year); setViewMonth(parsed.month) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync the view only when the ISO value changes
  }, [value])

  // Desktop popover: outside click closes (trigger + portaled panel both count as inside)
  useEffect(() => {
    if (!open || asSheet) return
    function onDown(e) {
      if (wrapRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open, asSheet])

  // Esc closes the popover only (capture + preventDefault so a parent modal
  // using useModalDismiss stays open).
  useEffect(() => {
    if (!open || asSheet) return
    function onKey(e) {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open, asSheet])

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  function close(refocus = true) {
    setOpen(false)
    if (refocus) triggerRef.current?.focus({ preventScroll: true })
  }

  // The popover is portaled to the end of <body> and focus stays on the trigger (so the
  // field keeps its look), which left the days out of the Tab order. Tab walks into the
  // panel from the trigger, and out of it back to the trigger.
  function onTriggerKeyDown(e) {
    if (open && !asSheet && e.key === "Tab" && !e.shiftKey) {
      const first = panelRef.current?.querySelector("button")
      if (first) {
        e.preventDefault()
        first.focus()
        return
      }
    }
    onKeyDown?.(e)
  }

  function onPanelKeyDown(e) {
    if (e.key !== "Tab") return
    const buttons = [...panelRef.current.querySelectorAll("button:not([disabled])")]
    if (e.shiftKey && e.target === buttons[0]) {
      e.preventDefault()
      triggerRef.current?.focus({ preventScroll: true })
    } else if (!e.shiftKey && e.target === buttons[buttons.length - 1]) {
      e.preventDefault()
      close()
    }
  }

  // Switching days/years/months removes the focused button: stay inside the panel.
  useEffect(() => {
    if (open && !asSheet && document.activeElement === document.body) {
      panelRef.current?.querySelector("button")?.focus({ preventScroll: true })
    }
  }, [mode, open, asSheet])

  function selectDay(day) {
    const iso = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    onChange?.(iso)
    close()
  }

  function goToday() {
    onChange?.(today)
    const p = parseCE(today)
    if (p) { setViewYear(p.year); setViewMonth(p.month) }
    close()
  }

  const wrapperCls = className
    .split(" ")
    .filter(c => !c.startsWith("w-") && c !== "block")
    .join(" ")

  // Keep the panel the height of the day grid while drilling into years/months —
  // otherwise a popover placed above the field jumps and the next click misses.
  const calRef = useRef(null)
  const [lockH, setLockH] = useState(0)
  function openYears() {
    if (mode === "days") setLockH(calRef.current?.offsetHeight ?? 0)
    setPageStart(viewYear - (YEARS_PER_PAGE - 5))
    setMode("years")
  }

  const view = mode === "years" ? (
    <YearGrid
      value={value}
      today={today}
      viewYear={viewYear}
      pageStart={pageStart}
      onPage={(d) => setPageStart((p) => p + d)}
      onPick={(y) => { setViewYear(y); setMode("months") }}
    />
  ) : mode === "months" ? (
    <MonthGrid
      value={value}
      today={today}
      viewYear={viewYear}
      viewMonth={viewMonth}
      onYear={openYears}
      onPick={(m) => { setViewMonth(m); setMode("days") }}
    />
  ) : (
    <Calendar
      onHeader={openYears}
      value={value}
      today={today}
      viewYear={viewYear}
      viewMonth={viewMonth}
      onPrev={prevMonth}
      onNext={nextMonth}
      onPick={selectDay}
      onToday={goToday}
    />
  )
  const calendar = (
    <div ref={calRef} style={mode === "days" || !lockH ? undefined : { minHeight: lockH }}>
      {view}
    </div>
  )

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => { setMode("days"); setOpen(o => !o) }}
        onKeyDown={onTriggerKeyDown}
        onFocus={onFocus}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error || undefined}
        aria-describedby={ariaDescribedBy}
        aria-label={`${ariaLabel}${value ? `: ${formatDisplay(value)}` : ""}`}
        className={cx(
          "flex w-full cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-70",
          wrapperCls,
          error && fieldErrorCls,
        )}
      >
        <span className={value ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}>
          {formatDisplay(value) || placeholder}
        </span>
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-gray-400 dark:text-gray-500" strokeWidth={1.75} />
      </button>

      {asSheet ? (
        <Sheet open={open} onClose={() => close()} title={ariaLabel} size="sm" z={PANEL_Z} initialFocus={null}>
          {calendar}
        </Sheet>
      ) : (
        open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={ariaLabel}
            onKeyDown={onPanelKeyDown}
            style={{ ...style, zIndex: PANEL_Z }}
            className="overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-xl dark:border-line-strong dark:bg-raised dark:shadow-2xl dark:shadow-black/60"
          >
            {calendar}
          </div>,
          document.body,
        )
      )}
    </div>
  )
})

export default ThaiDatePicker
