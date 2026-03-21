// src/lib/styles.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralized Tailwind class constants — import these in every page/component
// instead of defining locally. All constants include proper dark mode support.
// ─────────────────────────────────────────────────────────────────────────────

/** Join class names, filtering out falsy values */
export const cx = (...a) => a.filter(Boolean).join(" ")

// ─── Form Fields ──────────────────────────────────────────────────────────────

/** Standard full-width input / select / textarea */
export const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-slate-900 outline-none placeholder:text-slate-400 " +
  "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 shadow-none " +
  "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 " +
  "dark:focus:border-emerald-400 dark:focus:ring-emerald-400/25"

/** Append to baseField when the field is disabled/read-only */
export const fieldDisabled =
  "bg-slate-100 text-slate-500 cursor-not-allowed opacity-80 " +
  "dark:bg-slate-800/70 dark:text-slate-400"

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
  "text-right text-[12px] md:text-[13px] text-slate-900 outline-none " +
  "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"

// ─── Buttons ─────────────────────────────────────────────────────────────────

/** Primary save / submit button (emerald) */
export const submitBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 " +
  "text-base font-semibold text-white shadow-sm cursor-pointer " +
  "hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.35)] hover:scale-[1.02] " +
  "active:scale-[.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 " +
  "transition-all duration-200"

// ─── Spinner ─────────────────────────────────────────────────────────────────

/** Spinning indicator to place inside a loading button */
export const spinnerCls =
  "h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
