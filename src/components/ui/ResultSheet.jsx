// src/components/ui/ResultSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Outcome of a save — replaces `alert()` after Buy/Sales submit.
//
//   <ResultSheet open={!!result} tone="success"
//     title="บันทึกออเดอร์แล้ว" description="เลขที่ 2567/0012"
//     lines={[{ label: "น้ำหนักสุทธิ", value: "1,240 กก." }, { label: "เป็นเงิน", value: thb(amount) }]}
//     primary={{ label: "ทำรายการใหม่", onClick: reset }}
//     secondary={{ label: "ดูออเดอร์", onClick: () => navigate("/order") }}
//     onClose={() => setResult(null)} />
//
//   tone      'success' | 'error'   (error: title gets role="alert")
//   lines     [{ label, value, tone? }]  — Sales passes one line per trailer
//   primary   { label, onClick, loading, disabled, tone? }  secondary same (neutral); both optional
//             tone defaults from the sheet: success → "submit" (emerald —
//             spec §3.6), error → "primary" (indigo — recovering is not saving).
//             Pass primary.tone to override.
// Built on <Sheet size="sm">; primary button takes initial focus.
// Success shows the mascot (mood success); error keeps the plain icon.
// ─────────────────────────────────────────────────────────────────────────────
import { CircleCheck, CircleX } from "lucide-react"
import Sheet from "./Sheet"
import Mascot from "./Mascot"
import { cx, neutralBtnCls, primaryBtnCls, submitBtnCls } from "../../lib/styles"

const BTN_TONE = { submit: submitBtnCls, primary: primaryBtnCls }

const TONE = {
  success: { Icon: CircleCheck, ring: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
  error: { Icon: CircleX, ring: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300" },
}

export default function ResultSheet({
  open,
  tone = "success",
  title,
  description,
  lines = [],
  primary,
  secondary,
  onClose,
}) {
  const { Icon, ring } = TONE[tone] ?? TONE.success
  const primaryTone = primary?.tone ?? (tone === "error" ? "primary" : "submit")
  return (
    <Sheet open={open} onClose={onClose} title={title} size="sm" initialFocus="[data-autofocus]" hideHandle>
      <div className="flex flex-col items-center text-center">
        {tone === "success" ? (
          // น้องหอมทอง jumps once (mood 4 → SuccessHold, no loop). The small check
          // keeps the emerald "saved" signal for anyone who reads color first. It sits
          // outside the mascot box (left-full) so it never covers her arms or body.
          <span className="relative" aria-hidden="true">
            <Mascot mood="success" size={120} />
            <span className={cx("absolute left-full bottom-3 -ml-4 flex size-8 items-center justify-center rounded-full", ring)}>
              <Icon className="size-5" strokeWidth={2} />
            </span>
          </span>
        ) : (
          <span className={cx("flex size-14 items-center justify-center rounded-full", ring)} aria-hidden="true">
            <Icon className="size-8" strokeWidth={1.75} />
          </span>
        )}
        {description && (
          <p
            role={tone === "error" ? "alert" : "status"}
            className="mt-3 max-w-prose text-sm leading-relaxed text-pretty text-gray-600 dark:text-gray-300"
          >
            {description}
          </p>
        )}
      </div>

      {lines.length > 0 && (
        <dl className="mt-4 divide-y divide-gray-100 rounded-2xl bg-gray-50 px-4 dark:divide-gray-700/70 dark:bg-gray-900/40">
          {lines.map((l, i) => (
            <div key={l.key ?? i} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-sm text-gray-500 dark:text-gray-400">{l.label}</dt>
              <dd
                className={cx(
                  "text-right text-sm font-semibold tabular-nums",
                  l.tone === "error"
                    ? "text-red-600 dark:text-red-400"
                    : l.tone === "success"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-gray-900 dark:text-gray-100",
                )}
              >
                {l.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {(primary || secondary) && (
        <div className="mt-5 flex flex-col gap-2 md:flex-row-reverse">
          {primary && (
            <button
              type="button"
              data-autofocus
              onClick={primary.onClick}
              disabled={primary.disabled || primary.loading}
              aria-busy={primary.loading || undefined}
              className={cx(BTN_TONE[primaryTone] ?? BTN_TONE.submit, "h-12 w-full md:flex-1")}
            >
              {primary.label}
            </button>
          )}
          {secondary && (
            <button
              type="button"
              onClick={secondary.onClick}
              disabled={secondary.disabled}
              className={cx(neutralBtnCls, "h-12 w-full md:flex-1")}
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
