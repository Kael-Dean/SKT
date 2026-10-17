// src/components/ui/SearchField.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Type-ahead search (member / customer lookup). Two layers so Buy/Sales can
// keep their own keyboard handlers and only swap the list markup:
//
//   <SearchField
//     value={q} onChange={setQ} placeholder="เลขบัตร / รหัสสมาชิก / ชื่อ"
//     inputMode="numeric" loading={searching}
//     results={hits} renderResult={(m) => <>{m.name}<small>{m.id}</small></>}
//     onPick={pickMember} highlightedIndex={hi} onHighlight={setHi}
//     listId="member-results" inputRef={refs.citizenId}
//     onKeyDown={myHandler}  /* optional: call e.preventDefault() to override */
//     emptyText="ไม่พบสมาชิก" minChars={2} />
//
//   <SearchField.SearchResults … anchorRef={wrapRef} open={show} />  // list only
//
// Desktop: the list is portaled (position: fixed, z 10050, flips above when
// out of room). Phone: the list renders inline under the field so the
// keyboard stays open and the page scrolls naturally.
// a11y: input role=combobox + aria-activedescendant, ul role=listbox,
// li role=option; rows are 44px tap targets. aria-controls only while the
// list is rendered.
//
// Plain search box: pass `open={false}` without `onPick` (results render in
// the page — DataList/table, e.g. MemberSearch). The input is then a normal
// type=search box: no combobox role, no aria-expanded, no list.
// Clear (×) button = 44px on phones, 36px from md.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { LoaderCircle, Search, X } from "lucide-react"
import useAnchoredPanel from "../../lib/useAnchoredPanel"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { cx, baseField } from "../../lib/styles"

const PANEL_Z = 10050
// aria-activedescendant target ids: `${listId}-opt-${index}`
const optionId = (listId, i) => `${listId}-opt-${i}`

export function SearchResults({
  open = true,
  anchorRef,
  results = [],
  renderResult,
  onPick,
  highlightedIndex = -1,
  onHighlight,
  listId,
  emptyText = "ไม่พบรายการ",
  loading = false,
  inline = false,
  ariaLabel = "ผลการค้นหา",
}) {
  const isPhone = useIsPhone()
  const asInline = inline || isPhone
  const { style } = useAnchoredPanel(anchorRef, { open: open && !asInline, minW: 0, maxH: 320 })

  useEffect(() => {
    if (!open || highlightedIndex < 0 || !listId) return
    document.getElementById(optionId(listId, highlightedIndex))?.scrollIntoView({ block: "nearest" })
  }, [open, highlightedIndex, listId])

  if (!open) return null

  const list = (
    <ul
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className={cx(
        "overflow-y-auto overscroll-contain rounded-2xl bg-white p-1 shadow-xl ring-1 ring-gray-200 dark:bg-raised dark:ring-line-strong dark:shadow-2xl dark:shadow-black/60",
        asInline ? "mt-2 max-h-80" : "",
      )}
      style={asInline ? undefined : { ...style, zIndex: PANEL_Z }}
    >
      {results.length === 0 ? (
        <li className="px-3 py-5 text-center text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังค้นหา…" : emptyText}
        </li>
      ) : (
        results.map((item, i) => {
          const active = i === highlightedIndex
          return (
            <li
              key={item?.id ?? item?.key ?? i}
              id={listId ? optionId(listId, i) : undefined}
              role="option"
              aria-selected={active}
              onMouseDown={(e) => e.preventDefault()} // keep focus in the input
              onMouseMove={() => { if (!active) onHighlight?.(i) }}
              onClick={() => onPick?.(item, i)}
              className={cx(
                "flex min-h-touch cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-gray-800 transition-colors duration-100 dark:text-gray-200",
                active && "bg-indigo-50 text-indigo-800 dark:bg-white/[.06] dark:text-gray-100",
              )}
            >
              <div className="min-w-0 flex-1">{renderResult ? renderResult(item, { active }) : String(item?.label ?? item)}</div>
            </li>
          )
        })
      )}
    </ul>
  )

  return asInline ? list : createPortal(list, document.body)
}

export default function SearchField({
  value = "",
  onChange,
  placeholder = "ค้นหา…",
  inputMode,
  loading = false,
  results = [],
  renderResult,
  onPick,
  highlightedIndex = -1,
  onHighlight,
  listId,
  inputRef,
  onKeyDown,
  onFocus,
  onBlur,
  emptyText,
  minChars = 2,
  open: openProp,
  disabled = false,
  id,
  ariaLabel,
  autoComplete = "off",
  className = "",
}) {
  const uid = useId()
  const lid = listId ?? `${uid}-results`
  const wrapRef = useRef(null)
  const innerRef = useRef(null)
  const ref = inputRef ?? innerRef
  const [focused, setFocused] = useState(false)
  const blurTimer = useRef(0)

  const ready = String(value ?? "").trim().length >= minChars
  // A field that can never show a list is a plain search box, not a combobox.
  const isCombobox = openProp !== false || typeof onPick === "function"
  const open = isCombobox && (openProp ?? (focused && ready))
  const activeDesc = open && highlightedIndex >= 0 ? optionId(lid, highlightedIndex) : undefined

  const handleKeyDown = (e) => {
    onKeyDown?.(e)
    if (e.defaultPrevented) return
    if (!open) return
    const n = results.length
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (n) onHighlight?.(highlightedIndex < 0 ? 0 : Math.min(highlightedIndex + 1, n - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        if (n) onHighlight?.(highlightedIndex <= 0 ? 0 : highlightedIndex - 1)
        break
      case "Enter":
        if (highlightedIndex >= 0 && results[highlightedIndex] !== undefined) {
          e.preventDefault()
          onPick?.(results[highlightedIndex], highlightedIndex)
        }
        break
      case "Escape":
        e.preventDefault()
        setFocused(false)
        break
      default:
    }
  }

  return (
    <div ref={wrapRef} className={cx("relative", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        strokeWidth={1.75}
      />
      <input
        ref={ref}
        id={id}
        type="search"
        role={isCombobox ? "combobox" : undefined}
        aria-autocomplete={isCombobox ? "list" : undefined}
        aria-expanded={isCombobox ? open : undefined}
        aria-controls={open ? lid : undefined}
        aria-activedescendant={activeDesc}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        inputMode={inputMode}
        autoComplete={autoComplete}
        spellCheck={false}
        enterKeyHint="search"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          clearTimeout(blurTimer.current)
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          // let a click on a result land before the list disappears
          blurTimer.current = setTimeout(() => setFocused(false), 150)
          onBlur?.(e)
        }}
        className={cx(baseField, "pl-10 pr-12 md:pr-10 [&::-webkit-search-cancel-button]:hidden")}
      />
      <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center md:right-2">
        {loading ? (
          <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin text-slate-400" strokeWidth={2} />
        ) : value ? (
          <button
            type="button"
            aria-label="ล้างคำค้นหา"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange?.(""); ref.current?.focus() }}
            className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors duration-150 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:size-9 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X aria-hidden="true" className="size-4" strokeWidth={2} />
          </button>
        ) : null}
      </span>

      {isCombobox && <SearchResults
        open={open}
        anchorRef={wrapRef}
        results={results}
        renderResult={renderResult}
        onPick={(item, i) => { setFocused(false); onPick?.(item, i) }}
        highlightedIndex={highlightedIndex}
        onHighlight={onHighlight}
        listId={lid}
        emptyText={emptyText}
        loading={loading}
      />}
    </div>
  )
}

SearchField.SearchResults = SearchResults
