// src/components/ui/Tabs.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Segmented tabs (WAI-ARIA tabs pattern, automatic activation).
//
//   <Tabs
//     items={[{ value: "step", label: "เลื่อนขั้น" }, { value: "history", label: "ประวัติ", count: 3 }]}
//     value={sub} onChange={setSub} ariaLabel="เงินเดือน" idBase="salary"
//   />
//   <div role="tabpanel" id={panelId("salary", sub)} aria-labelledby={tabId("salary", sub)} tabIndex={0}>…</div>
//
// Keys: ←/→ wrap, Home/End jump, disabled tabs are skipped. Roving tabIndex.
// Track uses gray-900/60 in dark so it stays visible inside a dark:bg-gray-800 card.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from "react"
import { cx } from "../../lib/styles"
import { panelId, tabId } from "./tabIds"

const TRACK =
  "inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 " +
  "ring-1 ring-inset ring-gray-200/60 dark:bg-gray-900/60 dark:ring-gray-700/60 " +
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

const TAB_BASE =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap " +
  "transition-colors duration-150 cursor-pointer " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 " +
  "disabled:cursor-not-allowed disabled:opacity-50"

const TAB_IDLE =
  "text-gray-500 hover:bg-white/60 hover:text-gray-800 " +
  "dark:text-gray-400 dark:hover:bg-gray-700/40 dark:hover:text-gray-100 " +
  "disabled:hover:bg-transparent disabled:hover:text-gray-500 dark:disabled:hover:text-gray-400"

const TAB_ACTIVE =
  "bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300"

const SIZE = { md: "h-9", sm: "h-8" }

export default function Tabs({
  items = [],        // [{ value, label, icon?, count?, disabled? }]
  value,
  onChange,          // (value) => void
  ariaLabel,
  idBase = "tabs",
  size = "md",       // "md" | "sm"
  className = "",
}) {
  const btnRefs = useRef([])

  const enabledIdx = items.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0)
  const activeIdx = items.findIndex((t) => String(t.value) === String(value))
  // If value matches nothing (or a disabled tab), the first enabled tab is the tab stop.
  const tabStop = activeIdx >= 0 && !items[activeIdx]?.disabled ? activeIdx : enabledIdx[0]

  const activate = (i) => {
    const t = items[i]
    if (!t || t.disabled) return
    btnRefs.current[i]?.focus()
    if (String(t.value) !== String(value)) onChange?.(t.value)
  }

  const onKeyDown = (e) => {
    if (enabledIdx.length === 0) return
    // The focused tab is always enabled (disabled buttons can't take focus).
    const pos = Math.max(0, enabledIdx.indexOf(Number(e.currentTarget.dataset.idx)))
    let next = null
    if (e.key === "ArrowRight") next = enabledIdx[(pos + 1) % enabledIdx.length]
    else if (e.key === "ArrowLeft") next = enabledIdx[(pos - 1 + enabledIdx.length) % enabledIdx.length]
    else if (e.key === "Home") next = enabledIdx[0]
    else if (e.key === "End") next = enabledIdx[enabledIdx.length - 1]
    if (next == null) return
    e.preventDefault()
    activate(next)
  }

  return (
    <div role="tablist" aria-label={ariaLabel} aria-orientation="horizontal" className={cx(TRACK, className)}>
      {items.map((t, i) => {
        const selected = i === activeIdx
        const Icon = t.icon
        return (
          <button
            key={t.value}
            ref={(el) => { btnRefs.current[i] = el }}
            type="button"
            role="tab"
            id={tabId(idBase, t.value)}
            aria-selected={selected}
            aria-controls={panelId(idBase, t.value)}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={t.disabled}
            data-idx={i}
            onClick={() => activate(i)}
            onKeyDown={onKeyDown}
            className={cx(TAB_BASE, SIZE[size] ?? SIZE.md, selected ? TAB_ACTIVE : TAB_IDLE)}
          >
            {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />}
            <span>{t.label}</span>
            {t.count != null && t.count !== "" && (
              <span
                className={cx(
                  "rounded-full bg-gray-200 px-1.5 text-xs tabular-nums text-gray-700 dark:text-gray-200",
                  selected ? "dark:bg-gray-600" : "dark:bg-gray-700"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
