// src/components/ui/StickyActionBar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Primary action(s) for a long form. On phones it is a bar fixed to the bottom
// (portaled to <body>, above the home indicator, hidden while the on-screen
// keyboard is up so it never covers the focused field); on desktop it renders
// inline where you place it.
//
//   <StickyActionBar
//     summary={<>ยอดสุทธิ <b>{thb(total)}</b></>}
//     secondary={{ label: "ย้อนกลับ", onClick: prev }}
//     primary={{ label: "ถัดไป", onClick: next, disabled, loading, type: "button" }} />
//
//   primary     { label, onClick, disabled, loading, type = "button", tone = "submit" }
//               tone "submit"  = emerald — saves/confirms ("บันทึก…")
//               tone "primary" = indigo  — moves on ("ถัดไป"); spec §1.3: ถัดไป ≠ บันทึก
//   secondary   { label, onClick, disabled, loading, type = "button" } (neutral)
//   summary               node shown above (phone) / left of (desktop) the buttons
//   hideWhenKeyboard      default true
//
// Phone layout reserves space with a spacer (h-24) so the page can scroll its
// last field above the bar. z-30 (below Sidebar 9990 and every overlay).
//
// While the phone bar is visible it publishes its height (incl. the safe-area
// padding) as `--sticky-bar-h` on <html>; <Toaster> reads it to float toasts
// above the bar. Removed on unmount and while hidden. One bar per page.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { LoaderCircle } from "lucide-react"
import useVisualViewport from "../../hooks/useVisualViewport"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { cx, neutralBtnCls, primaryBtnCls, submitBtnCls } from "../../lib/styles"

const BAR_VAR = "--sticky-bar-h"
const PRIMARY_TONE = { submit: submitBtnCls, primary: primaryBtnCls }

function ActionButton({ action, variant }) {
  if (!action) return null
  const { label, onClick, disabled = false, loading = false, type = "button", tone = "submit" } = action
  const isPrimary = variant === "primary"
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        isPrimary ? (PRIMARY_TONE[tone] ?? submitBtnCls) : neutralBtnCls,
        "h-12 px-4 py-0",
        isPrimary ? "flex-[2]" : "flex-1",
        "md:flex-none md:px-6",
      )}
    >
      {loading && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />}
      {label}
    </button>
  )
}

export default function StickyActionBar({
  summary,
  primary,
  secondary,
  hideWhenKeyboard = true,
  className = "",
}) {
  const isPhone = useIsPhone()
  const { keyboardOpen } = useVisualViewport()
  const hidden = isPhone && hideWhenKeyboard && keyboardOpen
  const barRef = useRef(null)

  // Publish the visible bar's height so the Toaster can sit above it.
  useEffect(() => {
    const el = barRef.current
    const root = document.documentElement
    if (!isPhone || hidden || !el) return
    const write = () => root.style.setProperty(BAR_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`)
    write()
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(write) : null
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      root.style.removeProperty(BAR_VAR)
    }
  }, [isPhone, hidden])

  const buttons = (
    <div className="flex items-center gap-3">
      <ActionButton action={secondary} variant="secondary" />
      <ActionButton action={primary} variant="primary" />
    </div>
  )

  if (!isPhone) {
    return (
      <div className={cx("mt-6 flex flex-wrap items-center justify-end gap-4", className)}>
        {summary && <div className="min-w-0 flex-1 text-sm text-gray-700 dark:text-gray-200">{summary}</div>}
        {buttons}
      </div>
    )
  }

  return (
    <>
      {/* Spacer so the last field can scroll above the fixed bar */}
      <div aria-hidden="true" className="h-24" />
      {createPortal(
        <div
          ref={barRef}
          aria-hidden={hidden || undefined}
          className={cx(
            "fixed inset-x-0 bottom-0 z-30 border-t border-gray-200/80 bg-white/90 px-4 pt-3 pb-safe-3 backdrop-blur-md",
            "dark:border-line dark:bg-canvas/85",
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            hidden && "pointer-events-none translate-y-full",
            className,
          )}
        >
          {summary && (
            <div className="mb-2 min-w-0 text-sm leading-relaxed text-gray-700 dark:text-gray-200">{summary}</div>
          )}
          {buttons}
        </div>,
        document.body,
      )}
    </>
  )
}
