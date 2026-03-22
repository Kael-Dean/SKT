// src/components/SelectDropdown.jsx
// Styled custom dropdown — used across HR pages (indigo theme)
// onChange(value: string) — called with the selected option's value as string
import { useEffect, useRef, useState } from "react"

export default function SelectDropdown({
  options = [],        // [{ value, label, sublabel? }]
  value = "",          // currently selected value (string / number)
  onChange,            // (value: string) => void
  placeholder = "— เลือก —",
  disabled = false,
  loading = false,
  error = false,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selected = options.find((o) => String(o.value) === String(value))

  // close on outside click
  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  // close on Escape
  useEffect(() => {
    if (!open) return
    const handle = (e) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [open])

  const commit = (opt) => {
    onChange?.(String(opt.value))
    setOpen(false)
  }

  const isDisabled = disabled || loading

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => !isDisabled && setOpen((o) => !o)}
        className={[
          "w-full rounded-2xl border px-4 py-3 text-left text-sm outline-none transition-all relative",
          isDisabled
            ? "cursor-not-allowed opacity-60 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
            : "cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600",
          open
            ? "border-indigo-500 ring-2 ring-indigo-500/25"
            : error
            ? "border-red-400 ring-2 ring-red-300/50"
            : "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={
            selected
              ? "text-slate-900 dark:text-slate-100"
              : "text-slate-400 dark:text-slate-500"
          }
        >
          {loading ? "กำลังโหลด..." : (selected?.label ?? placeholder)}
        </span>
        {/* Chevron */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">
              ไม่มีตัวเลือก
            </div>
          ) : (
            options.map((opt) => {
              const isChosen = String(opt.value) === String(value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isChosen}
                  onClick={() => commit(opt)}
                  className={[
                    "relative flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm transition-colors rounded-xl",
                    isChosen
                      ? "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20",
                  ].join(" ")}
                >
                  {/* Left accent bar when selected */}
                  {isChosen && (
                    <span className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-indigo-600 dark:bg-indigo-400" />
                  )}
                  <span className="flex-1">
                    <span className="block">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {opt.sublabel}
                      </span>
                    )}
                  </span>
                  {isChosen && (
                    <span className="text-indigo-600 dark:text-indigo-300 text-xs shrink-0 mt-0.5">✓</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
