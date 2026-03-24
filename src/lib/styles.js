// src/lib/styles.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralized Tailwind class constants — import these in every page/component
// instead of defining locally. All constants include proper dark mode support.
// Design system: Apple-inspired — เรียบง่าย ทันสมัย มีประสิทธิภาพ
// Accent: indigo | Semantic: emerald (save/success) | red (danger)
// ─────────────────────────────────────────────────────────────────────────────

/** Join class names, filtering out falsy values */
export const cx = (...a) => a.filter(Boolean).join(" ")

// ─── Form Fields ──────────────────────────────────────────────────────────────

/** Standard full-width input / select / textarea */
export const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-slate-900 outline-none placeholder:text-slate-400 " +
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 shadow-none " +
  "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 " +
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/25 transition-colors duration-150"

/** Append to baseField when the field is disabled/read-only */
export const fieldDisabled =
  "bg-slate-100 text-slate-500 cursor-not-allowed opacity-80 " +
  "dark:bg-slate-800/70 dark:text-slate-400"

/** Read-only display field (not editable, but not greyed out) */
export const readonlyFieldCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[15px] md:text-base " +
  "text-slate-700 select-text " +
  "dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300"

/** Compact variant — override padding/font for tight layouts */
export const compactInput = "!py-2 !px-4 !text-[16px] !leading-normal"

// ─── Labels & Helper Text ─────────────────────────────────────────────────────

/** Form field label */
export const labelCls =
  "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"

/** Hint / helper text below a field */
export const helpTextCls =
  "mt-1 text-sm text-slate-500 dark:text-slate-400"

/** Validation error message below a field */
export const errorTextCls =
  "mt-1 text-sm text-red-500 dark:text-red-400"

// ─── Table Cell Input ─────────────────────────────────────────────────────────

/** Compact numeric input for data-entry tables */
export const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] md:text-[13px] text-slate-900 outline-none tabular-nums " +
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 " +
  "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 " +
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 transition-colors duration-150"

// ─── Buttons ─────────────────────────────────────────────────────────────────

/** Primary save / submit button (emerald — semantic: success/positive action) */
export const submitBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 " +
  "text-base font-semibold text-white shadow-sm cursor-pointer " +
  "hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.35)] hover:scale-[1.02] " +
  "active:scale-[.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 " +
  "transition-all duration-200"

/** Reset / clear form button */
export const resetBtnCls =
  "inline-flex items-center justify-center rounded-2xl " +
  "border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 " +
  "shadow-sm transition-all duration-200 " +
  "hover:bg-slate-100 hover:shadow-md hover:scale-[1.03] " +
  "active:scale-[.97] cursor-pointer " +
  "dark:border-slate-600 dark:bg-slate-700/60 dark:text-white " +
  "dark:hover:bg-slate-700/50 dark:hover:shadow-lg " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"

/** Secondary / outline button (indigo) */
export const secondaryBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-2xl " +
  "border border-indigo-300 bg-white px-6 py-3 text-base font-medium text-indigo-700 " +
  "shadow-sm transition-all duration-200 " +
  "hover:bg-indigo-50 hover:border-indigo-400 hover:scale-[1.02] " +
  "active:scale-[.97] cursor-pointer " +
  "dark:border-indigo-700 dark:bg-transparent dark:text-indigo-300 " +
  "dark:hover:bg-indigo-900/20 dark:hover:border-indigo-500 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"

// ─── Cards & Containers ───────────────────────────────────────────────────────

/** Standard content card */
export const cardCls =
  "rounded-2xl bg-white dark:bg-gray-800 " +
  "ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm"

/** Card with padding (most common usage) */
export const cardPaddedCls = cardCls + " p-5"

/** Modal dialog card */
export const modalCardCls =
  "w-full rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6"

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
export const badgePending  = badgeCls + " bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
export const badgeSuccess  = badgeCls + " bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
export const badgeDanger   = badgeCls + " bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
export const badgeNeutral  = badgeCls + " bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
export const badgeInfo     = badgeCls + " bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"

// ─── Spinner ─────────────────────────────────────────────────────────────────

/** Spinning indicator to place inside a loading button */
export const spinnerCls =
  "h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"

/** Page-level loading spinner */
export const pageSpinnerCls =
  "h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 " +
  "dark:border-gray-700 dark:border-t-indigo-400"
