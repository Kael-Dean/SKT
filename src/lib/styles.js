// src/lib/styles.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralized Tailwind class constants — import these in every page/component
// instead of defining locally. All constants include proper dark mode support.
// Design system: Apple-inspired — เรียบง่าย ทันสมัย มีประสิทธิภาพ
// Accent: indigo | Semantic: emerald (save/success) | red (danger)
// ─────────────────────────────────────────────────────────────────────────────

/** Join class names, filtering out falsy values */
export const cx = (...a) => a.filter(Boolean).join(" ")

// ─── Dark mode: "Graphite" ────────────────────────────────────────────────────
// Dark surfaces come from tokens in index.css (@theme): canvas < field < surface
// < raised, hairlines line / line-strong (white-alpha). gray-* and slate-* are
// remapped to one neutral graphite ramp under .dark, so gray-100 = text,
// gray-400 = muted, gray-500 = subtle. Fields are *recessed* (darker than the
// card) with a hairline border; focus = indigo-400 border + soft halo.

// ─── Form Fields ──────────────────────────────────────────────────────────────

/** Standard full-width input / select / textarea */
export const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-base md:text-[15px] " +
  "text-slate-900 outline-none placeholder:text-slate-400 " +
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 shadow-none " +
  "dark:border-line-field dark:bg-field dark:text-gray-100 dark:placeholder:text-gray-400 " +
  "dark:hover:border-line-field-hover " +
  "dark:focus:border-indigo-400 dark:focus:ring-[3px] dark:focus:ring-indigo-400/30 " +
  "transition-colors duration-150"

/** Append to baseField when the field is disabled/read-only.
 *  `!` so it wins over baseField's dark:bg-field regardless of CSS order. */
export const fieldDisabled =
  "bg-slate-100 text-slate-500 cursor-not-allowed opacity-80 " +
  "dark:!bg-white/[.03] dark:text-gray-500 dark:!border-line-strong"

/** Read-only display field (not editable, but not greyed out) */
export const readonlyFieldCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-base md:text-[15px] " +
  "text-slate-700 select-text " +
  "dark:border-line dark:bg-white/[.03] dark:text-gray-300"

/** Compact variant — override padding/font for tight layouts */
export const compactInput = "!py-2 !px-4 !text-[16px] !leading-normal"

// ─── Labels & Helper Text ─────────────────────────────────────────────────────

/** Form field label */
export const labelCls =
  "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"

/** Hint / helper text below a field */
export const helpTextCls =
  "mt-1 text-sm text-slate-500 dark:text-slate-400"

/** Validation error message below a field (red-600: 4.8:1 on white — red-500 was 3.8:1) */
export const errorTextCls =
  "mt-1 text-sm text-red-600 dark:text-red-400"

// ─── Table Cell Input ─────────────────────────────────────────────────────────

/** Compact numeric input for data-entry tables.
 *  `cell-input` opts out of the global 16px-on-phone rule (index.css) — plan
 *  grids are dense by design and are pinch-zoomed, not tapped field by field. */
export const cellInput =
  "cell-input w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] md:text-[13px] text-slate-900 outline-none tabular-nums " +
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 " +
  "dark:border-line-field dark:bg-field dark:text-gray-100 dark:placeholder:text-gray-400 " +
  "dark:hover:border-line-field-hover " +
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/30 transition-colors duration-150"

// ─── Buttons ─────────────────────────────────────────────────────────────────

/** Primary save / submit button (emerald — semantic: success/positive action).
 *  emerald-700 keeps white text at 5.4:1 (emerald-600 was 3.65:1 — fails AA). */
export const submitBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 py-3 " +
  "text-base font-semibold text-white shadow-sm cursor-pointer " +
  "hover:bg-emerald-800 hover:shadow-[0_8px_20px_rgba(16,185,129,0.35)] hover:scale-[1.02] " +
  "active:scale-[.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 " +
  "dark:focus-visible:ring-offset-surface " +
  "transition-all duration-200"

/** Reset / clear form button */
export const resetBtnCls =
  "inline-flex items-center justify-center rounded-2xl " +
  "border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 " +
  "shadow-sm transition-all duration-200 " +
  "hover:bg-slate-100 hover:shadow-md hover:scale-[1.03] " +
  "active:scale-[.97] cursor-pointer " +
  "dark:border-line-strong dark:bg-white/[.04] dark:text-gray-100 dark:shadow-none " +
  "dark:hover:bg-white/[.08] dark:hover:border-white/20 dark:hover:shadow-none " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 " +
  "dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-surface"

/** Secondary / outline button (indigo) */
export const secondaryBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-2xl " +
  "border border-indigo-300 bg-white px-6 py-3 text-base font-medium text-indigo-700 " +
  "shadow-sm transition-all duration-200 " +
  "hover:bg-indigo-50 hover:border-indigo-400 hover:scale-[1.02] " +
  "active:scale-[.97] cursor-pointer " +
  "dark:border-indigo-400/30 dark:bg-white/[.04] dark:text-indigo-300 dark:shadow-none " +
  "dark:hover:bg-indigo-500/10 dark:hover:border-indigo-400/50 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 " +
  "dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-surface"

// ─── Compact app buttons (h-10, rounded-xl) — dialogs, toolbars, HR ──────────

/** Shared focus ring for interactive controls (offset follows the card surface) */
export const focusRingCls =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
  "dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-surface"

/** Tab panel paired with <Tabs> (focusable per WAI-ARIA; ring only for keyboard focus) */
export const tabPanelCls =
  "rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
  "focus-visible:ring-offset-4 focus-visible:ring-offset-white " +
  "dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-surface"

/** Primary action (indigo — the one accent).
 *  Dark: stays on indigo-600 (white text 6.5:1; indigo-500 was 4.6:1) with a
 *  hairline indigo edge + soft downward glow instead of a lighter fill. */
export const primaryBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 h-11 md:h-10 text-sm font-semibold " +
  "text-white shadow-sm transition-colors duration-200 cursor-pointer hover:bg-indigo-500 " +
  "dark:bg-indigo-600 dark:hover:bg-indigo-500 " +
  "dark:shadow-[0_0_0_1px_rgb(129_140_248/.35),0_8px_24px_-8px_rgb(99_102_241/.6)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 dark:disabled:hover:bg-indigo-600 " +
  focusRingCls

/** Destructive action (red) */
export const dangerBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 h-11 md:h-10 text-sm font-semibold " +
  "text-white shadow-sm transition-colors duration-200 cursor-pointer hover:bg-red-500 " +
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-red-600 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface"

/** Neutral / cancel action */
export const neutralBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 h-11 md:h-10 text-sm font-semibold " +
  "text-gray-700 ring-1 ring-inset ring-gray-300 bg-white hover:bg-gray-50 " +
  "dark:bg-white/[.04] dark:text-gray-100 dark:ring-line-strong dark:hover:bg-white/[.08] " +
  "transition-colors duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed " +
  focusRingCls

/** Icon-only button (needs aria-label) — 44px tap target on phones, 36px on desktop */
export const iconBtnCls =
  "inline-flex size-11 md:size-9 shrink-0 items-center justify-center rounded-xl " +
  "text-gray-600 hover:bg-gray-100 hover:text-gray-900 " +
  "dark:text-gray-300 dark:hover:bg-white/[.08] dark:hover:text-gray-100 " +
  "transition-colors duration-150 cursor-pointer active:scale-95 " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  focusRingCls

/** Segmented control (buyer type, buy/sell, …) — wrap with `segmentedCls`, each
 *  option is a button with `segmentedItemCls` + `segmentedItemActiveCls` when
 *  selected. Use role="radiogroup" + aria-checked on the items. */
export const segmentedCls =
  "inline-flex w-full items-stretch gap-1 rounded-2xl bg-gray-100 p-1 " +
  "dark:bg-field ring-1 ring-inset ring-gray-200/70 dark:ring-line"
export const segmentedItemCls =
  "flex-1 min-h-touch md:min-h-9 rounded-xl px-3 text-sm font-medium cursor-pointer " +
  "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 " +
  "transition-colors duration-150 " +
  focusRingCls
export const segmentedItemActiveCls =
  "bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200/70 " +
  "dark:bg-raised dark:text-indigo-200 dark:ring-line-strong dark:shadow-black/40"

// ─── Cards & Containers ───────────────────────────────────────────────────────

/** Standard content card */
export const cardCls =
  "rounded-2xl bg-white dark:bg-surface " +
  "ring-1 ring-gray-200/70 dark:ring-line shadow-sm dark:shadow-none"

/** Card with padding (most common usage) */
export const cardPaddedCls = cardCls + " p-5"

/** Modal dialog card */
export const modalCardCls =
  "w-full rounded-2xl bg-white dark:bg-surface shadow-2xl p-6 " +
  "dark:ring-1 dark:ring-line-strong dark:shadow-black/60"

// ─── Typography ───────────────────────────────────────────────────────────────

/** Page-level heading (h1) */
export const pageTitleCls =
  "text-xl font-bold text-gray-900 dark:text-gray-100"

/** Modal / dialog heading (h2/h3) */
export const modalTitleCls =
  "text-lg font-bold text-gray-900 dark:text-gray-100"

/** Section title within a form or card */
export const sectionTitleCls =
  "text-xs font-semibold text-indigo-700 dark:text-indigo-300 " +
  "uppercase tracking-wide mb-3 pb-1 " +
  "border-b border-indigo-100 dark:border-indigo-900/40"

// ─── Badges ───────────────────────────────────────────────────────────────────

/** Base badge — combine with a color variant below */
export const badgeCls =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"

/** Badge variants */
/** Badge variants — dark: tinted fill + inset hairline of the same hue */
const badgeDarkRing = " dark:ring-1 dark:ring-inset"
export const badgePending  = badgeCls + " bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" + badgeDarkRing + " dark:ring-amber-400/20"
export const badgeSuccess  = badgeCls + " bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" + badgeDarkRing + " dark:ring-emerald-400/20"
export const badgeDanger   = badgeCls + " bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" + badgeDarkRing + " dark:ring-red-400/20"
export const badgeNeutral  = badgeCls + " bg-gray-100 text-gray-700 dark:bg-white/[.06] dark:text-gray-300" + badgeDarkRing + " dark:ring-white/10"
export const badgeInfo     = badgeCls + " bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" + badgeDarkRing + " dark:ring-indigo-400/20"

// ─── Spinner ─────────────────────────────────────────────────────────────────

/** Spinning indicator to place inside a loading button */
export const spinnerCls =
  "h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"

/** Page-level loading spinner */
export const pageSpinnerCls =
  "h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 " +
  "dark:border-gray-700 dark:border-t-indigo-400"
