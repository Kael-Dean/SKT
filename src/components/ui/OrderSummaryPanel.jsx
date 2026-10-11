// src/components/ui/OrderSummaryPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Desktop order summary + primary action for long trading forms (ซื้อ / ขาย).
// Sits in the right column of `grid lg:grid-cols-[minmax(0,1fr)_20rem]`; the
// page decides stickiness, e.g.
//   <aside className="lg:sticky lg:top-[calc(var(--topbar-h)+1rem)] lg:self-start">
//
//   <OrderSummaryPanel
//     title="สรุปรายการ"
//     rows={[
//       { label: "ลูกค้า", value: name || "ยังไม่ได้เลือก", emphasis: name ? undefined : "muted" },
//       { label: "น้ำหนักสุทธิ", value: "6,850 กก." },
//       { label: "ยอดเงิน", value: thb(total), emphasis: "total" },
//     ]}
//     primary={{ label: "บันทึกการซื้อ", onClick, loading, disabled, type: "submit", form: "buy-form" }}
//     primaryRef={submitBtnRef}
//     secondary={{ label: "ล้างฟอร์ม", onClick: askReset }}
//     hint={<><Kbd>Enter</Kbd> ไปช่องถัดไป · <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> บันทึก</>}
//   />
//
//   title       string — panel heading (h2)
//   rows        [{ label, value, emphasis?: "total" | "muted", hidden? }]
//               value = ReactNode; "total" = large bold figure, separated by a rule
//               (put it last); "muted" = placeholder-ish grey ("ยังไม่ได้เลือก")
//   primary     { label, onClick, loading, disabled, type = "button", form? }
//               emerald submit button, full width h-12. `form` lets the button
//               submit a <form id> it is not nested in.
//   primaryRef  ref forwarded to the primary <button> (Enter-navigation target)
//   secondary   { label, onClick, disabled } — neutral full-width button
//               (destructive actions should confirm via <ConfirmDialog> in the page)
//   hint        ReactNode under the buttons (keyboard hints — use <Kbd>)
//   footer      ReactNode rendered last (optional)
//
// Desktop only — phones use <Stepper> + <StickyActionBar>. Pure presentation:
// no state, no effects.
// ─────────────────────────────────────────────────────────────────────────────
import { LoaderCircle } from "lucide-react"
import { cardCls, cx, neutralBtnCls, submitBtnCls } from "../../lib/styles"

/** Keyboard key chip for hints: <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> */
export function Kbd({ children }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-gray-300 bg-gray-50 px-1.5 py-px font-sans text-xs font-medium text-gray-700 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200">
      {children}
    </kbd>
  )
}

export default function OrderSummaryPanel({
  title = "สรุปรายการ",
  rows = [],
  primary,
  primaryRef,
  secondary,
  hint,
  footer,
  className,
}) {
  const visible = rows.filter((r) => r && !r.hidden)
  const body = visible.filter((r) => r.emphasis !== "total")
  const totals = visible.filter((r) => r.emphasis === "total")

  return (
    <section aria-label={title} className={cx(cardCls, "p-5", className)}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>

      {body.length > 0 && (
        <dl className="mt-3 space-y-2.5 text-sm">
          {body.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-gray-500 dark:text-gray-400">{r.label}</dt>
              <dd
                className={cx(
                  "min-w-0 text-right tabular-nums break-words",
                  r.emphasis === "muted"
                    ? "text-gray-500 dark:text-gray-400"
                    : "font-medium text-gray-900 dark:text-gray-100",
                )}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {totals.length > 0 && (
        <dl className="mt-4 space-y-1 border-t border-gray-200 pt-4 dark:border-gray-700">
          {totals.map((r) => (
            <div key={r.label}>
              <dt className="text-sm text-gray-500 dark:text-gray-400">{r.label}</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-50 break-words">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {(primary || secondary) && (
        <div className="mt-5 flex flex-col gap-2">
          {primary && (
            <button
              ref={primaryRef}
              type={primary.type ?? "button"}
              form={primary.form}
              // While saving the button stays focusable (aria-disabled, not
              // disabled): a disabled button drops focus to <body>, so the
              // ResultSheet would hand focus back to the top of the page.
              onClick={(e) => {
                if (primary.loading) { e.preventDefault(); return }
                primary.onClick?.(e)
              }}
              disabled={primary.disabled}
              aria-disabled={primary.loading || undefined}
              aria-busy={primary.loading || undefined}
              className={cx(
                submitBtnCls,
                "h-12 w-full py-0 hover:scale-100 active:scale-[.98]",
                primary.loading && "cursor-wait opacity-60",
              )}
            >
              {primary.loading && (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
              )}
              {primary.label}
            </button>
          )}
          {secondary && (
            <button
              type="button"
              onClick={secondary.onClick}
              disabled={secondary.disabled}
              className={cx(neutralBtnCls, "w-full")}
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}

      {hint && (
        <div className="mt-3 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</div>
      )}

      {footer}
    </section>
  )
}
