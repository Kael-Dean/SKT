import { useState, useRef, useEffect } from "react"

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]

const DAY_HEADERS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]

function todayISO() {
  return new Date().toISOString().split("T")[0]
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

export default function ThaiDatePicker({ value = "", onChange, className = "" }) {
  const today = todayISO()
  const parsed = parseCE(value)
  const now = new Date()

  const [viewYear, setViewYear]   = useState(parsed?.year  ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth() + 1)
  const [open, setOpen]           = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (parsed) { setViewYear(parsed.year); setViewMonth(parsed.month) }
  }, [value])

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day) {
    const iso = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    onChange?.(iso)
    setOpen(false)
  }

  function goToday() {
    onChange?.(today)
    const p = parseCE(today)
    if (p) { setViewYear(p.year); setViewMonth(p.month) }
    setOpen(false)
  }

  const totalDays = daysInMonth(viewYear, viewMonth)
  const firstDay  = firstDayOfMonth(viewYear, viewMonth)
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const wrapperCls = className
    .split(" ")
    .filter(c => !c.startsWith("w-") && c !== "block")
    .join(" ")

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-2 w-full text-left cursor-pointer ${wrapperCls}`}
      >
        <span className={value ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}>
          {formatDisplay(value) || "— เลือกวันที่ —"}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Calendar panel */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-[60] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 w-72 select-none">
          {/* Header: prev / month+year / next */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer transition-colors text-lg leading-none"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {THAI_MONTHS[viewMonth - 1]} {viewYear + 543}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer transition-colors text-lg leading-none"
            >
              ›
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map((d, i) => (
              <div
                key={d}
                className={`text-center text-xs font-medium py-1 ${i === 0 ? "text-red-400" : "text-gray-400 dark:text-gray-500"}`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const iso = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              const isSelected = iso === value
              const isToday    = iso === today
              const isSun      = i % 7 === 0
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={[
                    "h-9 w-full rounded-xl text-sm font-medium transition-colors cursor-pointer",
                    isSelected
                      ? "bg-indigo-600 text-white shadow-sm"
                      : isToday
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold"
                        : isSun
                          ? "text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
                  ].join(" ")}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Today button */}
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-center">
            <button
              type="button"
              onClick={goToday}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              วันนี้
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
