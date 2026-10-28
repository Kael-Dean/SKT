// src/components/ComboBox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE shared ComboBox (plan §A6) — replaces the 16 inline `function ComboBox`
// copies (Buy, Sales, Order, Stock*, …). Drop-in for both prop dialects:
//
//   <ComboBox options={opts} value={v} onChange={(valueStr, opt) => …}
//             getLabel={(o) => o.label} getSubLabel={(o) => o.subLabel}
//             buttonRef={refs.product} onEnterNext={() => focusNext("product")}
//             error={!!errors.product} hintRed={hints.product} clearHint={…}
//             title="ชนิดข้าว" ariaLabel="ชนิดข้าว" id="product" />
//
//   const ref = useRef(); ref.current.focus() / .open()            (StockTransferOut)
//   <ComboBox ref={ref} onMoveNext={…} getValue={(o) => o.id ?? o.value} />
//
// Props
//   options, value, onChange(valueStr, opt), placeholder
//   getLabel(o), getValue(o) = o.value ?? o.id   ← files whose copy defaulted
//     to `id ?? value` (StockTransferOut) must pass getValue explicitly
//   getSubLabel(o) = o.subLabel ?? o.sublabel      second line under the label
//   disabled, loading, error (red border + aria-invalid), hintRed (pulse), clearHint()
//   buttonRef      object ref that receives the trigger <button> (Enter chains)
//   onEnterNext / onMoveNext (alias)  called after a pick — DESKTOP ONLY; on
//     phones the user taps the next field themselves (UI-SPEC §8 / P2)
//   enterMovesWhenFilled  Enter on the closed trigger with a value already set
//     calls onEnterNext instead of opening (StockTransferOut dialect; default
//     false = Buy dialect, keeps the recorded desktop Enter-flow)
//   searchable     true | false | 'auto' (default: search when > 8 options)
//   emptyText, searchPlaceholder, id, ariaLabel, className
//   title          heading of the phone picker sheet (falls back to ariaLabel,
//                  then placeholder)
//   ref            imperative { focus(), open(), close() }
//
// Desktop (≥md): portaled listbox, position: fixed at z 10050 (above the
// Sheet 10040 and StickyTableScrollbar 10000), flips above when out of room.
// Keyboard = Buy.jsx:224-257 (+Home/End, type-ahead when not searchable):
//   closed: Enter/Space/↓ open on the selected option, ↑ opens on the last
//   open:   ↑/↓ wrap, Home/End, Enter picks, Esc closes (preventDefault so a
//           parent useModalDismiss stays open), Tab closes and moves on
// After a pick the trigger regains focus, then onEnterNext() (desktop).
// Phone (<md): full-height picker <Sheet z=10050> with a sticky search box
// (never autofocused), 44px rows, check mark on the selected row.
// Focus ring = indigo (design authority) — the inline copies used emerald.
// ─────────────────────────────────────────────────────────────────────────────
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Search, X } from "lucide-react"
import useAnchoredPanel from "../lib/useAnchoredPanel"
import { useIsCoarsePointer, useIsPhone } from "../hooks/useMediaQuery"
import Sheet from "./ui/Sheet"
import EmptyState from "./ui/EmptyState"
import { cx, fieldDisabled } from "../lib/styles"

const PANEL_Z = 10050
const AUTO_SEARCH_MIN = 9 // 'auto' → search box when options.length > 8

const norm = (s) => String(s ?? "").toLowerCase().trim()

const defaultGetLabel = (o) => o?.label ?? ""
const defaultGetValue = (o) => o?.value ?? o?.id ?? ""
const defaultGetSubLabel = (o) => o?.subLabel ?? o?.sublabel ?? o?.subtitle ?? ""

const ComboBox = forwardRef(function ComboBox(
  {
    options = [],
    value,
    onChange,
    placeholder = "— เลือก —",
    getLabel = defaultGetLabel,
    getValue = defaultGetValue,
    getSubLabel = defaultGetSubLabel,
    disabled = false,
    loading = false,
    error = false,
    buttonRef = null,
    hintRed = false,
    clearHint,
    onEnterNext,
    onMoveNext,
    enterMovesWhenFilled = false,
    searchable = "auto",
    emptyText = "ไม่พบรายการ",
    searchPlaceholder = "ค้นหา…",
    id,
    ariaLabel,
    ariaDescribedBy, // id(s) of the field's error/help text → aria-describedby on the trigger
    title,
    className = "",
    panelMinW = 0,      // desktop panel may grow wider than the trigger (long labels)
    panelMaxW = 512,
    wrapLabels = false, // wrap option labels (and the selected trigger text) instead of truncating them
  },
  ref,
) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(-1)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const searchRef = useRef(null)
  const typeAhead = useRef({ buf: "", timer: 0 })

  const isPhone = useIsPhone()
  const isCoarse = useIsCoarsePointer()
  const uid = useId()
  const listId = `${uid}-listbox`
  const optId = (i) => `${uid}-opt-${i}`

  const isDisabled = disabled || loading
  const next = onEnterNext ?? onMoveNext
  const hasSearch = searchable === true || (searchable === "auto" && options.length >= AUTO_SEARCH_MIN)

  const { style: panelStyle } = useAnchoredPanel(triggerRef, { open: open && !isPhone, minW: panelMinW, maxW: panelMaxW, maxH: 288 })

  // Merge the internal trigger ref with the caller's `buttonRef` (Enter chains).
  const setTrigger = useCallback(
    (el) => {
      triggerRef.current = el
      if (buttonRef) buttonRef.current = el
    },
    [buttonRef],
  )

  const selectedObj = useMemo(
    () => options.find((o) => String(getValue(o)) === String(value)),
    [options, value, getValue],
  )
  const selectedLabel = selectedObj ? getLabel(selectedObj) : ""
  const selectedSub = selectedObj ? getSubLabel(selectedObj) || "" : ""
  const hasValue = !(value === null || value === undefined || String(value) === "")

  const filtered = useMemo(() => {
    const q = norm(query)
    if (!hasSearch || !q) return options
    return options.filter((o) => norm(`${getLabel(o)} ${getSubLabel(o)} ${getValue(o)}`).includes(q))
  }, [options, query, hasSearch, getLabel, getSubLabel, getValue])

  const close = useCallback((refocus = false) => {
    setOpen(false)
    setQuery("")
    setHighlight(-1)
    if (refocus) triggerRef.current?.focus({ preventScroll: true })
  }, [])

  const openWith = useCallback(
    (where = "selected") => {
      if (isDisabled) return
      const selIdx = options.findIndex((o) => String(getValue(o)) === String(value))
      let idx = -1
      if (options.length) idx = where === "last" ? options.length - 1 : selIdx >= 0 ? selIdx : 0
      setQuery("")
      setHighlight(idx)
      setOpen(true)
      clearHint?.()
    },
    [isDisabled, options, getValue, value, clearHint],
  )

  useImperativeHandle(
    ref,
    () => ({
      focus: () => triggerRef.current?.focus(),
      open: () => openWith("selected"),
      close: () => close(false),
    }),
    [openWith, close],
  )

  const commit = (opt) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    close(false)
    clearHint?.()
    requestAnimationFrame(() => {
      triggerRef.current?.focus({ preventScroll: true })
      // P2: never auto-advance on phones — the keyboard would pop on the next field.
      if (!isPhone) next?.()
    })
  }

  // Desktop: focus the search box on open (not on touch — keyboard would cover the list).
  useLayoutEffect(() => {
    if (!open || isPhone) return
    if (hasSearch && !isCoarse) searchRef.current?.focus({ preventScroll: true })
  }, [open, isPhone, hasSearch, isCoarse])

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open || highlight < 0) return
    document.getElementById(optId(highlight))?.scrollIntoView({ block: "nearest" })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optId derives from a stable useId
  }, [open, highlight])

  // Desktop: outside click closes (trigger + portaled panel both count as inside).
  useEffect(() => {
    if (!open || isPhone) return
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      close(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open, isPhone, close])

  // Desktop: Esc from anywhere closes only this popover (capture + preventDefault
  // → an enclosing Sheet/modal using useModalDismiss stays open).
  useEffect(() => {
    if (!open || isPhone) return
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return
      e.preventDefault()
      const inside = wrapRef.current?.contains(document.activeElement) || panelRef.current?.contains(document.activeElement)
      close(inside)
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open, isPhone, close])

  const runTypeAhead = (ch) => {
    const ta = typeAhead.current
    clearTimeout(ta.timer)
    ta.buf += ch.toLowerCase()
    ta.timer = setTimeout(() => { ta.buf = "" }, 500)
    const n = filtered.length
    if (!n) return
    const start = ta.buf.length === 1 ? highlight + 1 : Math.max(highlight, 0)
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n
      if (norm(getLabel(filtered[i])).startsWith(ta.buf)) { setHighlight(i); return }
    }
  }

  // Keys while the list is open (trigger or search box has focus). Returns true when handled.
  const onListKey = (e) => {
    const n = filtered.length
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (n) setHighlight((h) => (h < n - 1 ? h + 1 : 0))
        return true
      case "ArrowUp":
        e.preventDefault()
        if (n) setHighlight((h) => (h > 0 ? h - 1 : n - 1))
        return true
      case "Home":
        if (!hasSearch || e.ctrlKey || e.metaKey) { e.preventDefault(); if (n) setHighlight(0); return true }
        return false
      case "End":
        if (!hasSearch || e.ctrlKey || e.metaKey) { e.preventDefault(); if (n) setHighlight(n - 1); return true }
        return false
      case "Enter":
        e.preventDefault()
        if (highlight >= 0 && highlight < n) commit(filtered[highlight])
        return true
      case "Escape":
        e.preventDefault()
        close(true)
        return true
      case "Tab":
        close(true)
        return true
      default:
        return false
    }
  }

  const onTriggerKeyDown = (e) => {
    if (isDisabled) return
    if (isPhone) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); openWith("selected") }
      return
    }
    if (!open) {
      if (e.key === "Enter") {
        e.preventDefault()
        if (enterMovesWhenFilled && hasValue) next?.()
        else openWith("selected")
      } else if (e.key === " " || e.key === "ArrowDown") {
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
      if (highlight >= 0 && filtered[highlight]) commit(filtered[highlight])
      return
    }
    if (!hasSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      runTypeAhead(e.key)
    }
  }

  const activeDesc = open && !isPhone && highlight >= 0 && filtered[highlight] ? optId(highlight) : undefined
  const triggerText = loading ? "กำลังโหลด…" : selectedLabel

  // Phone picker: options are real focus stops (roving tabindex) so a keyboard /
  // switch user — or a desktop browser zoomed below md — can reach and pick them.
  const rovingIdx = highlight >= 0 && highlight < filtered.length ? highlight : 0
  const focusOption = (i) => {
    setHighlight(i)
    document.getElementById(optId(i))?.focus({ preventScroll: false })
  }
  const onPhoneOptionKey = (e, opt, idx) => {
    const n = filtered.length
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault()
        commit(opt)
        break
      case "ArrowDown":
        e.preventDefault()
        focusOption(idx < n - 1 ? idx + 1 : 0)
        break
      case "ArrowUp":
        e.preventDefault()
        if (idx === 0 && hasSearch) searchRef.current?.focus()
        else focusOption(idx > 0 ? idx - 1 : n - 1)
        break
      case "Home":
        e.preventDefault()
        focusOption(0)
        break
      case "End":
        e.preventDefault()
        focusOption(n - 1)
        break
      default:
    }
  }
  const onPhoneSearchKey = (e) => {
    if (e.key === "ArrowDown" && filtered.length) {
      e.preventDefault()
      focusOption(0)
    }
  }

  const renderOption = (opt, idx, phone) => {
    const label = getLabel(opt)
    const sub = getSubLabel(opt) || ""
    const isChosen = String(getValue(opt)) === String(value)
    const isActive = idx === highlight
    return (
      <li
        key={String(getValue(opt)) || label || idx}
        id={optId(idx)}
        role="option"
        aria-selected={isChosen}
        tabIndex={phone ? (idx === rovingIdx ? 0 : -1) : undefined}
        onKeyDown={phone ? (e) => onPhoneOptionKey(e, opt, idx) : undefined}
        onMouseDown={(e) => e.preventDefault()}
        onMouseMove={() => { if (!phone && !isActive) setHighlight(idx) }}
        onClick={() => commit(opt)}
        className={cx(
          "flex w-full cursor-pointer items-center gap-3 text-left transition-colors duration-100",
          phone
            ? "min-h-touch px-4 py-2.5 text-base outline-none focus-visible:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:focus-visible:bg-indigo-500/15 dark:focus-visible:ring-indigo-400"
            : "min-h-10 rounded-xl px-3 py-2 text-[15px]",
          isActive && !phone && cx("bg-indigo-50", isChosen ? "dark:bg-indigo-500/20" : "dark:bg-white/[.06]"),
          isChosen
            ? cx(
                "font-semibold text-indigo-700 dark:text-indigo-200",
                phone ? "bg-indigo-50/60 dark:bg-indigo-500/15" : !isActive && "dark:bg-indigo-500/15",
              )
            : "text-slate-800 dark:text-gray-200",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className={cx("block", wrapLabels ? "break-words" : "truncate")}>{label}</span>
          {sub && <span className="mt-0.5 block truncate text-sm font-normal text-slate-500 dark:text-slate-400">{sub}</span>}
        </span>
        {isChosen && <Check aria-hidden="true" className="size-5 shrink-0 text-indigo-600 dark:text-indigo-400" strokeWidth={2} />}
      </li>
    )
  }

  const emptyNode = (phone) =>
    phone ? (
      <EmptyState title={options.length === 0 ? "ไม่มีตัวเลือก" : emptyText} icon={<span />} className="py-10" />
    ) : (
      <li className="px-3 py-5 text-center text-sm text-slate-500 dark:text-slate-400">
        {options.length === 0 ? "ไม่มีตัวเลือก" : emptyText}
      </li>
    )

  const searchBox = (phone) => (
    <div className={cx("relative", phone ? "sticky top-0 z-10 -mx-4 -mt-4 bg-white px-4 py-3 dark:bg-surface" : "shrink-0 border-b border-slate-200 dark:border-line")}>
      <Search
        aria-hidden="true"
        className={cx("pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500", phone ? "left-7" : "left-3")}
        strokeWidth={1.75}
      />
      <input
        ref={searchRef}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={phone ? undefined : activeDesc}
        aria-label={searchPlaceholder}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setHighlight(0) }}
        onKeyDown={phone ? onPhoneSearchKey : onListKey}
        placeholder={searchPlaceholder}
        className={cx(
          "w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400",
          phone
            ? "h-12 rounded-2xl border border-slate-300 bg-slate-100 pl-10 pr-11 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:border-line-field dark:bg-field dark:hover:border-line-field-hover dark:focus:border-indigo-400 dark:focus:ring-1 dark:focus:ring-indigo-400"
            : "h-10 pl-9 pr-9 md:text-sm",
        )}
      />
      {query && (
        <button
          type="button"
          aria-label="ล้างคำค้นหา"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setQuery(""); setHighlight(0); searchRef.current?.focus() }}
          className={cx("absolute top-1/2 flex -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200", phone ? "right-5 size-11" : "right-1 size-8")}
        >
          <X aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  )

  return (
    <div ref={wrapRef} className={cx("relative", className)}>
      <button
        ref={setTrigger}
        id={id}
        type="button"
        role="combobox"
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return
          if (open) close(false)
          else openWith("selected")
        }}
        onKeyDown={onTriggerKeyDown}
        onFocus={() => clearHint?.()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open && !isPhone ? listId : undefined}
        aria-activedescendant={!hasSearch ? activeDesc : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy || undefined}
        aria-invalid={error || hintRed ? true : undefined}
        title={selectedLabel || undefined}
        className={cx(
          "flex w-full min-h-12 items-center gap-2 rounded-2xl border p-3 text-left text-base outline-none transition-colors duration-150 md:min-h-0 md:text-[15px]",
          isDisabled
            ? cx("border-slate-300 dark:border-line-strong", fieldDisabled)
            : "cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-field dark:hover:bg-field",
          error
            ? "border-red-400 ring-2 ring-red-300/70 dark:border-red-500 dark:ring-red-500/30"
            : open
              ? "border-indigo-500 ring-2 ring-indigo-500/25 dark:border-indigo-400 dark:ring-1 dark:ring-indigo-400"
              : cx(
                  "border-slate-300 focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/25",
                  "dark:border-line-field dark:focus-visible:border-indigo-400 dark:focus-visible:ring-1 dark:focus-visible:ring-indigo-400",
                  !isDisabled && "dark:hover:border-line-field-hover",
                ),
          "text-slate-900 dark:text-gray-100",
          hintRed && "ring-2 ring-red-300 animate-pulse",
        )}
      >
        <span className="min-w-0 flex-1">
          {triggerText ? (
            <>
              <span className={cx("block", wrapLabels ? "break-words" : "truncate")}>{triggerText}</span>
              {selectedSub && !loading && (
                <span className="mt-0.5 block truncate text-sm text-slate-500 dark:text-slate-400">{selectedSub}</span>
              )}
            </>
          ) : (
            <span className="block truncate text-slate-500 dark:text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cx("size-5 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500", open && "rotate-180")}
          strokeWidth={2}
        />
      </button>

      {/* Phone: full picker sheet (z 10050 → above a parent Sheet at 10040) */}
      {isPhone ? (
        <Sheet
          open={open}
          onClose={() => close(true)}
          title={title ?? ariaLabel ?? placeholder}
          size="full"
          z={PANEL_Z}
          hideHandle
        >
          {hasSearch && searchBox(true)}
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className={cx("-mx-4 divide-y divide-gray-100 dark:divide-line", hasSearch ? "mt-1" : "-mt-2")}
          >
            {filtered.length === 0 ? emptyNode(true) : filtered.map((opt, idx) => renderOption(opt, idx, true))}
          </ul>
        </Sheet>
      ) : (
        open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ ...panelStyle, zIndex: PANEL_Z }}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-line-strong dark:bg-raised dark:shadow-2xl dark:shadow-black/60"
          >
            {hasSearch && searchBox(false)}
            <ul
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              className="min-h-0 flex-1 overflow-auto overscroll-contain p-1"
            >
              {filtered.length === 0 ? emptyNode(false) : filtered.map((opt, idx) => renderOption(opt, idx, false))}
            </ul>
          </div>,
          document.body,
        )
      )}
    </div>
  )
})

export default ComboBox
