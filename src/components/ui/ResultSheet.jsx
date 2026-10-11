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
//   primary   { label, onClick, loading }  secondary same; both optional
// Built on <Sheet size="sm">; primary button takes initial focus.
// ─────────────────────────────────────────────────────────────────────────────
import { CircleCheck, CircleX } from "lucide-react"
import Sheet from "./Sheet"
import { cx, neutralBtnCls, primaryBtnCls } from "../../lib/styles"

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
  return (
    <Sheet open={open} onClose={onClose} title={title} size="sm" initialFocus="[data-autofocus]" hideHandle>
      <div className="flex flex-col items-center text-center">
        <span className={cx("flex size-14 items-center justify-center rounded-full", ring)} aria-hidden="true">
          <Icon className="size-8" strokeWidth={1.75} />
        </span>
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
              className={cx(primaryBtnCls, "h-12 w-full md:flex-1")}
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
