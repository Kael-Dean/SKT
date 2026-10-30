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
// Both tones show น้องหอมทอง on a tinted halo with a status badge pinned to her
// hip (<ResultEmblem>): success = jump + sparks + check, error = search pose + X
// that wobbles. Animations live in index.css (.animate-result-*), play once and
// collapse to the final frame under prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────────────────────
import Sheet from "./Sheet"
import Mascot from "./Mascot"
import { cx, neutralBtnCls, primaryBtnCls, submitBtnCls } from "../../lib/styles"

const BTN_TONE = { submit: submitBtnCls, primary: primaryBtnCls }

const TONE = {
  success: {
    mood: "success",
    halo: "bg-emerald-100/80 dark:bg-emerald-400/10",
    badge: "bg-emerald-600 dark:bg-emerald-500",
    ping: "bg-emerald-500/50",
    // Check mark in a 20×20 box
    glyph: ["M5.5 10.5l3 3 6-6.5"],
  },
  error: {
    mood: "empty",
    halo: "bg-red-100/70 dark:bg-red-400/10",
    badge: "bg-red-600 dark:bg-red-500",
    ping: null,
    glyph: ["M6.5 6.5l7 7", "M13.5 6.5l-7 7"],
  },
}

// Sparks fly out from the halo centre: [dx, dy] in px, alternating emerald / mascot gold.
const SPARKS = [
  [0, -62], [44, -44], [62, 0], [44, 40], [-44, 40], [-62, 0], [-44, -44], [22, -60],
]

/** Mascot + halo + status badge. Decorative: the title/description carry the meaning. */
function ResultEmblem({ tone }) {
  const t = TONE[tone] ?? TONE.success
  const success = tone !== "error"
  return (
    <span className="relative block size-[120px]" aria-hidden="true">
      <span className={cx("absolute inset-3 rounded-full animate-result-halo", t.halo)} />
      {success &&
        SPARKS.map(([dx, dy], i) => (
          <span
            key={i}
            className={cx(
              "absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] size-1.5 rounded-full animate-result-spark",
              i % 2 ? "bg-amber-400" : "bg-emerald-500",
            )}
            style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, animationDelay: `${0.3 + (i % 3) * 0.04}s` }}
          />
        ))}
      <Mascot mood={t.mood} size={120} />
      {/* Badge sits just right of her body (the character fills the middle ~60% of
          the box), ringed in the sheet colour so it reads as pinned on, not floating. */}
      <span className="absolute bottom-5 right-0 size-8 animate-result-pop">
        {t.ping && <span className={cx("absolute inset-0 rounded-full animate-result-ping", t.ping)} />}
        <span
          className={cx(
            "relative flex size-full items-center justify-center rounded-full text-white shadow-md shadow-black/10",
            "ring-[3px] ring-white dark:ring-surface",
            t.badge,
            !success && "animate-result-wobble",
          )}
        >
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {t.glyph.map((d, i) => (
              <path
                key={d}
                d={d}
                pathLength="1"
                strokeDasharray="1"
                className="animate-result-draw"
                style={i ? { animationDelay: "0.75s" } : undefined}
              />
            ))}
          </svg>
        </span>
      </span>
    </span>
  )
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
  const primaryTone = primary?.tone ?? (tone === "error" ? "primary" : "submit")
  return (
    <Sheet open={open} onClose={onClose} title={title} size="sm" initialFocus="[data-autofocus]" hideHandle>
      <div className="flex flex-col items-center text-center">
        <ResultEmblem tone={tone} />
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
            <div
              key={l.key ?? i}
              className="flex items-baseline justify-between gap-4 py-2.5 animate-result-row"
              style={{ animationDelay: `${0.45 + Math.min(i, 6) * 0.06}s` }}
            >
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
