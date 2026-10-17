// src/components/ThaiDatePicker.jsx
// Buddhist-calendar date picker. value/onChange are ISO "YYYY-MM-DD" (CE).
//
// Desktop: the calendar is portaled to <body> (position: fixed, z 10050 via
// useAnchoredPanel) so no table scrollbar / overflow wrapper can clip it.
// Phone (<md): opens as a bottom <Sheet size="sm"> with 44px day buttons.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import useAnchoredPanel from "../lib/useAnchoredPanel"
import { useIsPhone } from "../hooks/useMediaQuery"
import Sheet from "./ui/Sheet"
import { cx, focusRingCls } from "../lib/styles"

const PANEL_Z = 10050
const PANEL_W = 288

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
  "flex size-11 md:size-9 cursor-pointer items-center justify-center rounded-xl text-gray-500 transition-colors " +
  "duration-150 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.08] dark:hover:text-gray-100 " +
  focusRingCls

/** Month grid — shared by the desktop popover and the phone sheet. */
function Calendar({ value, today, viewYear, viewMonth, onPrev, onNext, onPick, onToday }) {
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
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100" aria-live="polite">
          {THAI_MONTHS[viewMonth - 1]} {viewYear + 543}
        </span>
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
                "h-11 w-full cursor-pointer rounded-xl text-sm font-medium tabular-nums transition-colors duration-150 md:h-9",
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
          className={cx("min-h-touch cursor-pointer rounded-lg px-3 text-sm text-indigo-600 hover:underline dark:text-indigo-400 md:min-h-8", focusRingCls)}
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
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  useImperativeHandle(ref, () => triggerRef.current)
  const isPhone = useIsPhone()
  const { style } = useAnchoredPanel(triggerRef, { open: open && !isPhone, minW: PANEL_W, maxW: PANEL_W, maxH: 400 })

  useEffect(() => {
    if (parsed) { setViewYear(parsed.year); setViewMonth(parsed.month) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync the view only when the ISO value changes
  }, [value])

  // Desktop popover: outside click closes (trigger + portaled panel both count as inside)
  useEffect(() => {
    if (!open || isPhone) return
    function onDown(e) {
      if (wrapRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open, isPhone])

  // Esc closes the popover only (capture + preventDefault so a parent modal
  // using useModalDismiss stays open).
  useEffect(() => {
    if (!open || isPhone) return
    function onKey(e) {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open, isPhone])

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

  const calendar = (
    <Calendar
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

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error || undefined}
        aria-describedby={ariaDescribedBy}
        aria-label={`${ariaLabel}${value ? `: ${formatDisplay(value)}` : ""}`}
        className={cx(
          "flex w-full cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-70",
          wrapperCls,
          error && "!border-red-500 ring-2 ring-red-300 dark:ring-red-500/40",
        )}
      >
        <span className={value ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}>
          {formatDisplay(value) || placeholder}
        </span>
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-gray-400 dark:text-gray-500" strokeWidth={1.75} />
      </button>

      {isPhone ? (
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
