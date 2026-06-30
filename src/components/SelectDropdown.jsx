// src/components/SelectDropdown.jsx
// Styled custom dropdown — used across HR pages (indigo theme)
// onChange(value: string) — called with the selected option's value as string
//
// The open panel renders through a portal to <body> at a very high z-index and
// is positioned with `fixed` coords from the trigger's rect. This guarantees no
// overlay (e.g. the sticky table scrollbar at z-index 10000) can ever cover the
// options while the user is choosing. See CLAUDE.md → "Popup / Modal ต้อง render
// ผ่าน Portal เสมอ".
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

// Must sit above StickyTableScrollbar (z-index 10000) and any other overlay.
const PANEL_Z = 10050

// ชุดสีสำหรับช่องสีเล็กด้านซ้ายของแต่ละ option (วนซ้ำถ้ามีมากกว่า 8 รายการ)
const SWATCH = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
]

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
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  // Fixed-position rect for the portaled panel + whether to flip above the trigger.
  const [rect, setRect] = useState({ left: 0, top: 0, width: 0, openUp: false })

  const selected = options.find((o) => String(o.value) === String(value))

  // Position the portaled panel from the trigger's viewport rect.
  const reposition = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const PANEL_MAX = 256 // max-h-64
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < PANEL_MAX && r.top > spaceBelow
    setRect({ left: r.left, top: openUp ? r.top : r.bottom, width: r.width, openUp })
  }

  useLayoutEffect(() => {
    if (open) reposition()
  }, [open])

  // Keep the panel glued to the trigger while scrolling/resizing.
  useEffect(() => {
    if (!open) return
    const handle = () => reposition()
    window.addEventListener("scroll", handle, true) // capture: catch inner scroll containers
    window.addEventListener("resize", handle)
    return () => {
      window.removeEventListener("scroll", handle, true)
      window.removeEventListener("resize", handle)
    }
  }, [open])

  // close on outside click — panel is portaled, so check both trigger and panel
  useEffect(() => {
    const handle = (e) => {
      if (ref.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
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
        ref={triggerRef}
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
        <span className="flex items-center gap-2.5">
          {/* ช่องสีของตัวเลือกที่เลือกอยู่ */}
          {selected && (() => {
            const idx = options.indexOf(selected)
            const color = SWATCH[idx % SWATCH.length]
            return (
              <span
                className="shrink-0 rounded-sm"
                style={{ width: 10, height: 10, backgroundColor: color }}
              />
            )
          })()}
          <span
            className={
              selected
                ? "text-slate-900 dark:text-slate-100"
                : "text-slate-400 dark:text-slate-500"
            }
          >
            {loading ? "กำลังโหลด..." : (selected?.label ?? placeholder)}
          </span>
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

      {/* Dropdown panel — portaled to <body> so nothing (e.g. sticky table
          scrollbar at z-10000) can overlap it while choosing. */}
      {open && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          style={{
            position: "fixed",
            left: rect.left,
            width: rect.width,
            zIndex: PANEL_Z,
            ...(rect.openUp
              ? { bottom: window.innerHeight - rect.top + 6 }
              : { top: rect.top + 6 }),
          }}
          className="max-h-64 overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">
              ไม่มีตัวเลือก
            </div>
          ) : (
            options.map((opt, idx) => {
              const isChosen = String(opt.value) === String(value)
              const swatchColor = SWATCH[idx % SWATCH.length]
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isChosen}
                  onClick={() => commit(opt)}
                  className={[
                    "relative flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors rounded-xl",
                    isChosen
                      ? "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20",
                  ].join(" ")}
                >
                  {/* Left accent bar when selected */}
                  {isChosen && (
                    <span className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-indigo-600 dark:bg-indigo-400" />
                  )}

                  {/* ช่องสีเล็กซ้ายมือ */}
                  <span
                    className="shrink-0 rounded-sm"
                    style={{
                      width: 10,
                      height: 10,
                      backgroundColor: isChosen ? swatchColor : swatchColor + "99",
                      boxShadow: isChosen ? `0 0 0 2px ${swatchColor}40` : "none",
                      transition: "background-color 0.15s, box-shadow 0.15s",
                    }}
                  />

                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {opt.sublabel}
                      </span>
                    )}
                  </span>
                  {isChosen && (
                    <span className="text-indigo-600 dark:text-indigo-300 text-xs shrink-0">✓</span>
                  )}
                </button>
              )
            })
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
