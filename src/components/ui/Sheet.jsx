// src/components/ui/Sheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE modal primitive for trading pages (plan §A5): a bottom sheet on phones,
// a centered dialog from `md` up. One place owns dvh, safe-area, the on-screen
// keyboard, focus trap and dismiss behaviour — pages never write
// `fixed inset-0` themselves.
//
//   <Sheet open={open} onClose={close} title="รายละเอียดสมาชิก" size="lg"
//          footer={<button className={primaryBtnCls}>บันทึก</button>}>
//     …
//   </Sheet>
//
// Props
//   open, onClose          onClose runs on Esc / backdrop / X (not while busy)
//   title, subtitle        title is required for aria-labelledby
//   busy                   aria-busy + dismiss disabled (saving…)
//   size                   'sm' | 'md' | 'lg' | 'full'  (desktop width; 'full'
//                          also fills the height on both)
//   z                      default 10040 — see the z-stack below
//   initialFocus           CSS selector | null (focus the panel itself) |
//                          undefined = first field on desktop, the close button
//                          on phones (keyboard must not pop before the sheet lands)
//   footer                 sticky bottom slot (pb-safe); omit for none.
//                          Phone convention: `grid grid-cols-2 gap-3` with
//                          h-12 buttons, primary on the RIGHT; ≥md
//                          `md:flex md:justify-end md:gap-2`
//   hideHandle             hide the phone drag handle
//
// Phone: fixed to the bottom, rounded top, max-height =
//   min(100dvh, visualViewport.height) - 1rem, and lifted above the on-screen
//   keyboard (visualViewport offset) so a focused input is always visible.
// Desktop: centered, max-h 90dvh. Header/footer never scroll; the body does
// (min-h-0 overflow-y-auto overscroll-contain).
//
// ── Z-STACK (the only place this is written down — keep in sync) ────────────
//   Sidebar overlay             9990
//   Sidebar panel               9999
//   StickyTableScrollbar       10000
//   Sheet (this)               10040   ← modals / bottom sheets / ResultSheet
//   SelectDropdown / ComboBox  10050   ← popovers open above a Sheet
//   ComboBox picker Sheet      10050      (phone full-screen picker)
//   ThaiDatePicker             10050
//   ConfirmDialog              10070
//   Toaster                    10080
//   HrModal stays at z-50 (HR module, out of scope).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef } from "react"
import { X } from "lucide-react"
import Portal from "../Portal"
import useModalDismiss from "../../lib/useModalDismiss"
import useFocusTrap from "../../lib/useFocusTrap"
import useVisualViewport from "../../hooks/useVisualViewport"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { cx, iconBtnCls } from "../../lib/styles"

const SIZE = {
  sm: "md:max-w-md",
  md: "md:max-w-lg",
  lg: "md:max-w-2xl",
  full: "md:max-w-4xl md:h-[90dvh]",
}

function SheetBody({
  onClose,
  title,
  subtitle,
  busy = false,
  size = "sm",
  z = 10040,
  initialFocus,
  footer,
  children,
  hideHandle = false,
  className = "",
}) {
  const titleId = useId()
  const subId = useId()
  const panelRef = useRef(null)
  const isPhone = useIsPhone()
  const vv = useVisualViewport()
  const { backdropProps } = useModalDismiss(onClose, { disabled: busy })

  const selector = initialFocus === undefined ? (isPhone ? "[data-sheet-close]" : undefined) : initialFocus
  useFocusTrap(panelRef, { active: true, initialSelector: selector })

  // Phone: once the keyboard has risen (~150ms), bring the focused field into
  // the middle of the (now shorter) sheet body…
  const onBodyFocus = (e) => {
    if (!isPhone) return
    const el = e.target
    if (!el?.matches?.("input, select, textarea")) return
    setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 150)
  }
  // …and again whenever the visual viewport actually changes height (the
  // keyboard animation finishes later than 150ms on some devices).
  useEffect(() => {
    if (!isPhone) return
    const el = document.activeElement
    if (!el || !panelRef.current?.contains(el) || !el.matches("input, select, textarea")) return
    el.scrollIntoView({ block: "center" })
  }, [isPhone, vv.height])

  // Visual viewport → sheet geometry (phone only; desktop uses 90dvh via CSS)
  const innerH = typeof window !== "undefined" ? window.innerHeight : 0
  const vvHeight = vv.height || innerH
  const lift = isPhone ? Math.max(0, innerH - vv.offsetTop - vvHeight) : 0
  const vars = {
    "--sheet-max-h": `calc(min(100dvh, ${vvHeight}px) - 1rem)`,
    "--sheet-lift": `${lift}px`,
  }

  return (
    <Portal>
      <div
        style={{ zIndex: z }}
        className="fixed inset-0 flex items-end justify-center bg-gray-900/40 animate-fade-in dark:bg-black/60 md:items-center md:p-4"
        {...backdropProps}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={subtitle ? subId : undefined}
          aria-busy={busy || undefined}
          tabIndex={-1}
          style={vars}
          className={cx(
            "flex w-full flex-col bg-white shadow-2xl ring-1 ring-gray-200 focus:outline-none animate-sheet-in",
            "dark:bg-surface dark:ring-line-strong dark:shadow-black/60",
            "rounded-t-3xl max-h-(--sheet-max-h) mb-(--sheet-lift) md:mb-0 md:rounded-2xl md:max-h-[90dvh]",
            size === "full" && "h-(--sheet-max-h)",
            SIZE[size] ?? SIZE.sm,
            className,
          )}
        >
          {!hideHandle && (
            <div className="flex shrink-0 justify-center pt-2 md:hidden" aria-hidden="true">
              <span className="h-1 w-9 rounded-full bg-gray-300 dark:bg-white/20" />
            </div>
          )}

          <header className="flex shrink-0 items-start gap-3 border-b border-gray-100 px-4 pb-3 pt-3 dark:border-line md:px-6 md:pt-5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-bold text-balance leading-snug text-gray-900 dark:text-gray-100 md:text-lg">
                {title}
              </h2>
              {subtitle && (
                <p id={subId} className="mt-0.5 text-sm text-pretty text-gray-500 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => !busy && onClose?.()}
              disabled={busy}
              aria-label="ปิด"
              data-sheet-close
              className={cx(iconBtnCls, "-mr-2 -mt-1")}
            >
              <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </button>
          </header>

          <div
            onFocus={onBodyFocus}
            className={cx("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6", !footer && "pb-safe-4")}
          >
            {children}
          </div>

          {footer && (
            <footer className="shrink-0 border-t border-gray-100 px-4 pt-3 pb-safe-3 dark:border-line md:px-6 md:pb-4">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </Portal>
  )
}

/** Bottom sheet (phone) / centered dialog (desktop). Renders nothing while closed. */
export default function Sheet({ open, ...props }) {
  if (!open) return null
  return <SheetBody {...props} />
}
