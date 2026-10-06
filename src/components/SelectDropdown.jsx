// src/components/SelectDropdown.jsx
// Styled custom dropdown (select-only combobox) — used across HR pages (indigo theme)
// onChange(value: string) — called with the selected option's value as string
//
// The open panel renders through a portal to <body> at a very high z-index and
// is positioned with `fixed` coords from the trigger's rect. This guarantees no
// overlay (e.g. the sticky table scrollbar at z-index 10000) can ever cover the
// options while the user is choosing. See CLAUDE.md → "Popup / Modal ต้อง render
// ผ่าน Portal เสมอ".
//
// Backward compatible: options / value / onChange / placeholder / disabled /
// loading / error behave exactly as before. Optional additions:
//   searchable            search box inside the panel (focus on open, resets on close)
//   searchPlaceholder     default "ค้นหา…"
//   filterFn(opt, q)      custom matcher; default = case-insensitive includes on
//                         label + sublabel/subtitle + value + keywords
//   emptyText             shown when the query matches nothing (default "ไม่พบรายการ")
//   showSwatch            colour chip per option (default true); colour is a hash
//                         of `value`, so it never shifts when the list is filtered
//   showSublabelInTrigger second line in the trigger with the selected sublabel
//   id, ariaLabel, ariaLabelledby, ariaDescribedby  → applied to the trigger
// Option shape: { value, label, sublabel?, subtitle? (alias), keywords?: string[] | string }
//
// Keyboard: closed trigger — Enter/Space/↓ open on the selected (or first) option,
// ↑ opens on the last. Open — ↑/↓/Home/End move, Enter selects, Esc closes and
// refocuses the trigger, Tab closes. Without `searchable`, printable keys type-ahead.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Search } from "lucide-react"

// Must sit above StickyTableScrollbar (z-index 10000) and any other overlay.
const PANEL_Z = 10050
const PANEL_MAX_H = 288 // max-h-72
const PANEL_MIN_W = 288 // 18rem
const PANEL_MAX_W = 512 // 32rem
const GAP = 6
const EDGE = 8

// ชุดสีสำหรับช่องสีเล็กด้านซ้ายของแต่ละ option — เลือกด้วย hash ของ value
// (ไม่ใช่ index) เพื่อให้สีคงเดิมแม้รายการถูกกรอง/เรียงใหม่
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

const swatchFor = (value) => {
  const s = String(value ?? "")
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return SWATCH[Math.abs(h) % SWATCH.length]
}

const subOf = (opt) => opt?.sublabel ?? opt?.subtitle ?? ""

const norm = (s) => String(s ?? "").toLowerCase().trim()

const defaultFilter = (opt, q) => {
  const kw = Array.isArray(opt.keywords) ? opt.keywords.join(" ") : opt.keywords ?? ""
  return norm(`${opt.label ?? ""} ${subOf(opt)} ${opt.value ?? ""} ${kw}`).includes(q)
}

function Swatch({ color, strong }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-sm"
      style={{
        width: 10,
        height: 10,
        backgroundColor: strong ? color : color + "99",
        boxShadow: strong ? `0 0 0 2px ${color}40` : "none",
        transition: "background-color 0.15s, box-shadow 0.15s",
      }}
    />
  )
}

export default function SelectDropdown({
  options = [],        // [{ value, label, sublabel?, subtitle?, keywords? }]
  value = "",          // currently selected value (string / number)
  onChange,            // (value: string) => void
  placeholder = "— เลือก —",
  disabled = false,
  loading = false,
  error = false,
  searchable = false,
  searchPlaceholder = "ค้นหา…",
  filterFn,
  emptyText = "ไม่พบรายการ",
  showSwatch = true,
  showSublabelInTrigger = false,
  id,
  ariaLabel,
  ariaLabelledby,
  ariaDescribedby,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(-1)
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const searchRef = useRef(null)
  const typeAhead = useRef({ buf: "", timer: 0 })
  // Fixed-position rect for the portaled panel + whether to flip above the trigger.
  const [rect, setRect] = useState({ left: 0, top: 0, width: 0, openUp: false })

  const uid = useId()
  const listId = `${uid}-listbox`
  const optId = (i) => `${uid}-opt-${i}`

  const selected = options.find((o) => String(o.value) === String(value))

  const filtered = useMemo(() => {
    const q = norm(query)
    if (!searchable || !q) return options
    const match = filterFn ?? defaultFilter
    return options.filter((o) => match(o, q))
  }, [options, query, searchable, filterFn])

  // Position the portaled panel from the trigger's viewport rect.
  const reposition = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const width = Math.min(Math.max(r.width, PANEL_MIN_W), PANEL_MAX_W, vw - EDGE * 2)
    const left = Math.max(EDGE, Math.min(r.left, vw - width - EDGE))
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < PANEL_MAX_H + GAP && r.top > spaceBelow
    setRect({ left, top: openUp ? r.top : r.bottom, width, openUp })
  }

  useLayoutEffect(() => {
    if (!open) return
    reposition()
    if (searchable) searchRef.current?.focus({ preventScroll: true })
  }, [open, searchable])

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

  // Keep the active option visible.
  useEffect(() => {
    if (!open || activeIdx < 0) return
    document.getElementById(optId(activeIdx))?.scrollIntoView({ block: "nearest" })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optId is derived from a stable useId
  }, [open, activeIdx])

  const close = (refocus = false) => {
    setOpen(false)
    setQuery("")
    setActiveIdx(-1)
    if (refocus) triggerRef.current?.focus({ preventScroll: true })
  }

  // close on outside click — panel is portaled, so check both trigger and panel
  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (ref.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
      setQuery("")
      setActiveIdx(-1)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  // Escape from anywhere (e.g. after clicking the panel's scrollbar)
  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      setOpen(false)
      setQuery("")
      setActiveIdx(-1)
      const inside = ref.current?.contains(document.activeElement) || panelRef.current?.contains(document.activeElement)
      if (inside) triggerRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [open])

  const commit = (opt) => {
    onChange?.(String(opt.value))
    close(true)
  }

  const isDisabled = disabled || loading

  const openWith = (where) => {
    if (isDisabled) return
    const selIdx = options.findIndex((o) => String(o.value) === String(value))
    let idx = -1
    if (options.length) {
      if (where === "last") idx = options.length - 1
      else idx = selIdx >= 0 ? selIdx : 0
    }
    setQuery("")
    setActiveIdx(idx)
    setOpen(true)
  }

  const runTypeAhead = (ch) => {
    const ta = typeAhead.current
    clearTimeout(ta.timer)
    ta.buf += ch.toLowerCase()
    ta.timer = setTimeout(() => { ta.buf = "" }, 500)
    const n = filtered.length
    if (!n) return
    const start = ta.buf.length === 1 ? activeIdx + 1 : Math.max(activeIdx, 0)
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n
      if (norm(filtered[i].label).startsWith(ta.buf)) {
        setActiveIdx(i)
        return
      }
    }
  }

  // Shared key handling for the open listbox (trigger or search input has focus).
  const onListKey = (e) => {
    const n = filtered.length
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (n) setActiveIdx((i) => (i < 0 ? 0 : Math.min(i + 1, n - 1)))
        return true
      case "ArrowUp":
        e.preventDefault()
        if (n) setActiveIdx((i) => (i < 0 ? n - 1 : Math.max(i - 1, 0)))
        return true
      case "Home":
        if (!searchable) {
          e.preventDefault()
          if (n) setActiveIdx(0)
          return true
        }
        // In the search box Home/End move the caret unless Ctrl is held.
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          if (n) setActiveIdx(0)
          return true
        }
        return false
      case "End":
        if (!searchable || e.ctrlKey || e.metaKey) {
          e.preventDefault()
          if (n) setActiveIdx(n - 1)
          return true
        }
        return false
      case "Enter":
        e.preventDefault()
        if (activeIdx >= 0 && filtered[activeIdx]) commit(filtered[activeIdx])
        return true
      case "Escape":
        e.preventDefault()
        close(true)
        return true
      case "Tab":
        // Return focus to the trigger first so the browser's Tab continues from there.
        close(true)
        return true
      default:
        return false
    }
  }

  const onTriggerKeyDown = (e) => {
    if (isDisabled) return
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault()
        openWith("selected")
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        openWith("last")
      }
      return
    }
    if (onListKey(e)) return
    if (e.key === " ") {
      e.preventDefault()
      if (activeIdx >= 0 && filtered[activeIdx]) commit(filtered[activeIdx])
      return
    }
    if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      runTypeAhead(e.key)
    }
  }

  const activeDesc = open && activeIdx >= 0 && filtered[activeIdx] ? optId(activeIdx) : undefined
  const triggerSub = showSublabelInTrigger && selected ? subOf(selected) : ""
  const triggerLabel = loading ? "กำลังโหลด..." : (selected?.label ?? placeholder)

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return
          if (open) close()
          else openWith("selected")
        }}
        onKeyDown={onTriggerKeyDown}
        className={[
          "w-full min-w-0 rounded-2xl border py-3 pl-4 pr-9 text-left text-sm outline-none transition-all relative",
          isDisabled
            ? "cursor-not-allowed opacity-60 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
            : "cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600",
          open
            ? "border-indigo-500 ring-2 ring-indigo-500/25 dark:border-indigo-400"
            : error
            ? "border-red-400 ring-2 ring-red-300/50 dark:border-red-500 dark:ring-red-500/30"
            : "focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:focus-visible:border-indigo-400",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={!searchable ? activeDesc : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        aria-invalid={error ? true : undefined}
        title={selected?.label}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {/* ช่องสีของตัวเลือกที่เลือกอยู่ */}
          {showSwatch && selected && !loading && <Swatch color={swatchFor(selected.value)} strong />}
          <span className="min-w-0 flex-1">
            <span
              className={[
                "block truncate",
                selected && !loading
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-400 dark:text-slate-500",
              ].join(" ")}
            >
              {triggerLabel}
            </span>
            {triggerSub && !loading && (
              <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{triggerSub}</span>
            )}
          </span>
        </span>
        {/* Chevron */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </span>
      </button>

      {/* Dropdown panel — portaled to <body> so nothing (e.g. sticky table
          scrollbar at z-10000) can overlap it while choosing. */}
      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left: rect.left,
            width: rect.width,
            zIndex: PANEL_Z,
            ...(rect.openUp
              ? { bottom: window.innerHeight - rect.top + GAP }
              : { top: rect.top + GAP }),
          }}
          className="flex max-h-72 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          {searchable && (
            <div className="relative shrink-0 border-b border-slate-200 dark:border-slate-700">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                strokeWidth={1.75}
              />
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={activeDesc}
                aria-label={searchPlaceholder}
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIdx(0)
                }}
                onKeyDown={onListKey}
                placeholder={searchPlaceholder}
                className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          )}

          <div
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabel ? undefined : ariaLabelledby}
            className="min-h-0 flex-1 overflow-auto overscroll-contain p-1"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {options.length === 0 ? "ไม่มีตัวเลือก" : emptyText}
              </div>
            ) : (
              filtered.map((opt, idx) => {
                const isChosen = String(opt.value) === String(value)
                const isActive = idx === activeIdx
                const sub = subOf(opt)
                return (
                  <div
                    key={opt.value}
                    id={optId(idx)}
                    role="option"
                    aria-selected={isChosen}
                    // keep focus on the trigger / search box while clicking
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => { if (!isActive) setActiveIdx(idx) }}
                    onClick={() => commit(opt)}
                    className={[
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100",
                      isActive ? "bg-indigo-50 dark:bg-indigo-500/15" : "",
                      isChosen
                        ? "font-semibold text-indigo-700 dark:text-indigo-300"
                        : "text-slate-800 dark:text-slate-200",
                    ].join(" ")}
                  >
                    {/* ช่องสีเล็กซ้ายมือ */}
                    {showSwatch && <Swatch color={swatchFor(opt.value)} strong={isChosen} />}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate" title={opt.label}>{opt.label}</span>
                      {sub && (
                        <span className="mt-0.5 block truncate text-xs font-normal text-slate-500 dark:text-slate-400">
                          {sub}
                        </span>
                      )}
                    </span>
                    {isChosen && (
                      <Check aria-hidden="true" className="size-4 shrink-0 text-indigo-600 dark:text-indigo-300" strokeWidth={2} />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
