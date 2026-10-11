// src/pages/work/buy/BuyWeighSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Weights, moisture/impurity, deduction (auto or manual), net, gram, unit
// price, amount. Phone: one field per row + calc cards. Desktop (≥md, R2):
// "ชั่งน้ำหนักและราคา" card (2 input rows + read-only calc strip + หมายเหตุ).
// ─────────────────────────────────────────────────────────────────────────────
import { cx, baseField, labelCls, helpTextCls, errorTextCls, cardCls } from "../../../lib/styles"
import {
  onlyDigits, thb, nf, moneyToNumber, formatMoneyInput, suggestDeductionWeight, isEnabledInput, MOISTURE_STD,
  fieldId, errId, describedBy, sectionH2Cls,
} from "./buyShared"

export default function BuyWeighSection({ form }) {
  return form.isPhone ? <PhoneWeighSection form={form} /> : <DesktopWeighSection form={form} />
}

/* ═══════════════════════════════ PHONE (<md) — UI-SPEC §3.3 ═══════════════════════════════ */

const phoneLabelCls = "mb-1 block text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300"

/** Numeric input with a unit suffix inside the field (right-aligned, tabular) */
function UnitInput({ id, inputRef, suffix, prefix, big = false, className = "", ...props }) {
  return (
    <div className="relative">
      {prefix && (
        <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-gray-500 dark:text-gray-400">
          {prefix}
        </span>
      )}
      <input
        id={id}
        ref={inputRef}
        className={cx(baseField, "text-right tabular-nums", big ? "text-lg font-semibold" : "", prefix && "pl-8", suffix && "pr-16", className)}
        {...props}
      />
      {suffix && (
        <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
          {suffix}
        </span>
      )}
    </div>
  )
}

function PhoneWeighSection({ form }) {
  const {
    order, updateOrder, refs, errors, clearHint, clearError, redFieldCls, redHintCls, onEnter,
    grossFromScale, autoDeduct, netWeight,
  } = form
  const suggested = Math.round(suggestDeductionWeight(grossFromScale, order.moisturePct, order.impurityPct) * 100) / 100

  const numField = (key, label, opts) => (
    <div>
      <label className={phoneLabelCls} htmlFor={fieldId(key)}>{label}</label>
      <UnitInput
        id={fieldId(key)}
        inputRef={refs[key]}
        inputMode={opts.inputMode ?? "decimal"}
        suffix={opts.suffix}
        prefix={opts.prefix}
        big={opts.big}
        className={redFieldCls(key)}
        value={order[key]}
        onChange={(e) => { updateOrder(key, opts.sanitize(e.target.value)); clearError(key) }}
        onFocus={() => clearHint(key)}
        onKeyDown={opts.onKeyDown ?? onEnter(key)}
        placeholder={opts.placeholder}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? errId(key) : opts.help ? `buy-${key}-help` : undefined}
      />
      {opts.help && !errors[key] && <p id={`buy-${key}-help`} className={helpTextCls}>{opts.help}</p>}
      {errors[key] && <p id={errId(key)} className={errorTextCls}>{errors[key]}</p>}
    </div>
  )
  const dec = (v) => v.replace(/[^\d.]/g, "")

  return (
    <div className="space-y-4">
      {numField("entryWeightKg", "น้ำหนักเข้า (กก.)", { suffix: "กก.", big: true, sanitize: dec, placeholder: "0" })}
      {numField("exitWeightKg", "น้ำหนักออก (กก.)", { suffix: "กก.", big: true, sanitize: dec, placeholder: "0" })}

      {/* calc card A */}
      <dl className={cx(cardCls, "flex items-baseline justify-between gap-4 bg-gray-50 p-4 dark:bg-gray-800/60")}>
        <dt className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">จากตาชั่ง (กก.)</dt>
        <dd className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{nf(grossFromScale)} กก.</dd>
      </dl>

      <div className="grid grid-cols-2 gap-3">
        {numField("moisturePct", "ความชื้น (%)", { suffix: "%", sanitize: onlyDigits, placeholder: "0", help: `มาตรฐาน ${MOISTURE_STD}%` })}
        {numField("impurityPct", "สิ่งเจือปน (%)", { suffix: "%", sanitize: onlyDigits, placeholder: "0" })}
      </div>

      {/* calc card B — หักน้ำหนัก */}
      <section className={cx(cardCls, "p-4")}>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">หักน้ำหนัก (กก.)</p>
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">คำนวณจากความชื้นและสิ่งเจือปน</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{nf(order.manualDeduct ? autoDeduct : suggested)} กก.</p>
        </div>
        <label className="mt-3 flex min-h-touch cursor-pointer items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-700/70">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">กำหนดเอง</span>
          <span className="relative inline-flex size-11 items-center justify-center">
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={order.manualDeduct}
              onChange={(e) => updateOrder("manualDeduct", e.target.checked)}
            />
            <span
              aria-hidden="true"
              className={cx(
                "block h-6 w-10 rounded-full bg-gray-300 transition-colors duration-150 dark:bg-gray-600",
                "peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-gray-800",
              )}
            />
            <span aria-hidden="true" className="pointer-events-none absolute left-[7px] size-5 rounded-full bg-white shadow-sm transition-transform duration-150 peer-checked:translate-x-4" />
          </span>
        </label>
        {order.manualDeduct && (
          <div className="mt-3">
            <label className={phoneLabelCls} htmlFor={fieldId("deductWeightKg")}>หักน้ำหนัก (กก.)</label>
            <UnitInput
              id={fieldId("deductWeightKg")}
              inputRef={refs.deductWeightKg}
              inputMode="decimal"
              suffix="กก."
              className={cx(errors.deductWeightKg && "border-red-400", redHintCls("deductWeightKg"))}
              value={order.deductWeightKg}
              onChange={(e) => updateOrder("deductWeightKg", dec(e.target.value))}
              onFocus={() => clearHint("deductWeightKg")}
              onKeyDown={onEnter("deductWeightKg")}
              placeholder={String(suggested)}
              aria-invalid={errors.deductWeightKg ? true : undefined}
              aria-describedby={describedBy(errors, "deductWeightKg")}
            />
            {errors.deductWeightKg && <p id={errId("deductWeightKg")} className={errorTextCls}>{errors.deductWeightKg}</p>}
          </div>
        )}
      </section>

      {/* calc card C — สุทธิ */}
      <dl className={cx(cardCls, "flex items-baseline justify-between gap-4 p-4 ring-indigo-200/60 dark:ring-indigo-500/30")}>
        <dt className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-200">น้ำหนักสุทธิ (กก.)</dt>
        <dd className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100" aria-live="polite">{nf(netWeight)} กก.</dd>
      </dl>

      {numField("gram", "คุณภาพ (กรัม)", { inputMode: "numeric", sanitize: onlyDigits, placeholder: "เช่น 85" })}
      {numField("unitPrice", "ราคาต่อกก. (บาท)", { suffix: "บาท/กก.", big: true, sanitize: dec, placeholder: "0.00" })}
      {numField("amountTHB", "เป็นเงิน (บาท)", {
        prefix: "฿", big: true, sanitize: formatMoneyInput, placeholder: "0.00",
        help: "คำนวณให้อัตโนมัติ แก้ได้ถ้ายอดจริงต่างกัน",
        onKeyDown: (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); e.currentTarget.blur() } },
      })}
      {!!order.amountTHB && !errors.amountTHB && (
        <p className={cx(helpTextCls, "-mt-2 text-right")}>≈ {thb(moneyToNumber(order.amountTHB))}</p>
      )}
    </div>
  )
}

/* ═══════════════════════════════ DESKTOP (≥md) — R2 "ชั่งน้ำหนักและราคา" ═══════════════════════════════
 * Row 1: ก่อนชั่ง | หลังชั่ง | ความชื้น | สิ่งเจือปน.  Calc strip (read-only figures, not
 * disabled inputs): จากตาชั่ง − หัก (switch "กำหนดเอง" swaps in an input) = สุทธิ.
 * Row 2: คุณภาพ (กรัม) | ราคาต่อกก. | เป็นเงิน (2 cols).  หมายเหตุ last.
 * Enter order is unchanged: entry → exit → moisture → impurity → [deduct] → gram →
 * unitPrice → amountTHB → ปุ่มบันทึก (refs.submitBtn lives in OrderSummaryPanel).
 * ════════════════════════════════════════════════════════════════════════════════════════════════════ */

function DesktopWeighSection({ form }) {
  const {
    order, updateOrder, refs, errors, clearHint, clearError, redFieldCls, redHintCls, onEnter,
    grossFromScale, autoDeduct, netWeight,
  } = form
  const suggested = Math.round(suggestDeductionWeight(grossFromScale, order.moisturePct, order.impurityPct) * 100) / 100
  const dec = (v) => v.replace(/[^\d.]/g, "")

  const numField = (key, label, opts) => {
    const helpId = `buy-${key}-help`
    return (
      <div className={opts.span}>
        <label className={cx(labelCls, opts.labelHint && "flex items-baseline justify-between gap-2")} htmlFor={fieldId(key)}>
          {label}
          {opts.labelHint && <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{opts.labelHint}</span>}
        </label>
        <UnitInput
          id={fieldId(key)}
          inputRef={refs[key]}
          inputMode={opts.inputMode ?? "decimal"}
          suffix={opts.suffix}
          prefix={opts.prefix}
          big={opts.big}
          className={cx(opts.pad, redFieldCls(key))}
          value={order[key]}
          onChange={(e) => { updateOrder(key, opts.sanitize(e.target.value)); clearError(key) }}
          onFocus={() => clearHint(key)}
          onKeyDown={opts.onKeyDown ?? onEnter(key)}
          placeholder={opts.placeholder}
          autoComplete="off"
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={errors[key] ? errId(key) : opts.help ? helpId : undefined}
        />
        {errors[key]
          ? <p id={errId(key)} className={errorTextCls}>{errors[key]}</p>
          : opts.help ? <p id={helpId} className={helpTextCls}>{opts.help}</p> : null}
      </div>
    )
  }

  const toggleManual = (checked) => {
    updateOrder("manualDeduct", checked)
    if (checked) {
      // start from the computed figure so สุทธิ doesn't jump to the gross weight
      if (String(order.deductWeightKg).trim() === "") updateOrder("deductWeightKg", String(suggested))
      requestAnimationFrame(() => {
        const el = refs.deductWeightKg?.current
        el?.focus()
        try { el?.select() } catch { /* ignore */ }
      })
    }
  }

  return (
    <section aria-labelledby="buy-sec-weigh" className={cx(cardCls, "p-5")}>
      <h2 id="buy-sec-weigh" className={sectionH2Cls}>ชั่งน้ำหนักและราคา</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {numField("entryWeightKg", "น้ำหนักก่อนชั่ง", { suffix: "กก.", sanitize: dec, placeholder: "0" })}
        {numField("exitWeightKg", "น้ำหนักหลังชั่ง", { suffix: "กก.", sanitize: dec, placeholder: "0" })}
        {numField("moisturePct", "ความชื้น", { suffix: "%", sanitize: onlyDigits, placeholder: "0", labelHint: `เกณฑ์ ${MOISTURE_STD}%` })}
        {numField("impurityPct", "สิ่งเจือปน", { suffix: "%", sanitize: onlyDigits, placeholder: "0" })}
      </div>

      {/* แถบคำนวณ: จากตาชั่ง − หัก = สุทธิ */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-inset ring-gray-200/70 dark:bg-gray-900/40 dark:ring-gray-700/70">
        <dl className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-baseline gap-1.5">
            <dt>จากตาชั่ง</dt>
            <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{nf(grossFromScale)} กก.</dd>
          </div>
          <span aria-hidden="true" className="text-gray-400 dark:text-gray-500">−</span>
          <div className="flex items-center gap-1.5">
            <dt>{order.manualDeduct ? <label htmlFor={fieldId("deductWeightKg")}>หัก</label> : "หัก"}</dt>
            <dd className="tabular-nums">
              {order.manualDeduct ? (
                <UnitInput
                  id={fieldId("deductWeightKg")}
                  inputRef={refs.deductWeightKg}
                  inputMode="decimal"
                  suffix="กก."
                  className={cx("w-36 !py-1.5", errors.deductWeightKg && "border-red-500", redHintCls("deductWeightKg"))}
                  value={order.deductWeightKg}
                  onChange={(e) => { updateOrder("deductWeightKg", dec(e.target.value)); clearError("deductWeightKg") }}
                  onFocus={() => clearHint("deductWeightKg")}
                  onKeyDown={onEnter("deductWeightKg")}
                  placeholder={String(suggested)}
                  autoComplete="off"
                  aria-invalid={errors.deductWeightKg ? true : undefined}
                  aria-describedby={describedBy(errors, "deductWeightKg")}
                />
              ) : (
                <span className="font-semibold text-gray-900 dark:text-gray-100">{nf(autoDeduct)} กก.</span>
              )}
            </dd>
          </div>
          <span aria-hidden="true" className="text-gray-400 dark:text-gray-500">=</span>
          <div className="flex items-baseline gap-1.5">
            <dt className="font-medium text-gray-700 dark:text-gray-200">สุทธิ</dt>
            <dd className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-50" aria-live="polite">{nf(netWeight)} กก.</dd>
          </div>
        </dl>

        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={order.manualDeduct}
              onChange={(e) => toggleManual(e.target.checked)}
            />
            <span
              aria-hidden="true"
              className={cx(
                "block h-5 w-9 rounded-full bg-gray-300 transition-colors duration-150 dark:bg-gray-600",
                "peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-gray-50 dark:peer-focus-visible:ring-offset-gray-900",
              )}
            />
            <span aria-hidden="true" className="pointer-events-none absolute left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-150 peer-checked:translate-x-4" />
          </span>
          กำหนดน้ำหนักหักเอง
        </label>
      </div>
      {errors.deductWeightKg && <p id={errId("deductWeightKg")} className={errorTextCls}>{errors.deductWeightKg}</p>}

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {numField("gram", "คุณภาพข้าว", { inputMode: "numeric", suffix: "กรัม", sanitize: onlyDigits, placeholder: "เช่น 85" })}
        {numField("unitPrice", "ราคาต่อกก.", { suffix: "บาท/กก.", pad: "!pr-20", sanitize: dec, placeholder: "0.00" })}
        {numField("amountTHB", "เป็นเงิน", {
          span: "md:col-span-2",
          prefix: "฿",
          big: true,
          sanitize: formatMoneyInput,
          placeholder: "0.00",
          labelHint: "คำนวณจากน้ำหนัก × ราคา แก้ได้",
          onKeyDown: (e) => {
            if (e.key === "Enter" && !e.isComposing) {
              e.preventDefault()
              const btn = refs.submitBtn?.current
              if (btn && isEnabledInput(btn)) {
                try { btn.scrollIntoView({ block: "nearest" }) } catch { /* ignore */ }
                btn.focus?.()
              }
            }
          },
        })}
      </div>

      <div className="mt-4">
        <label className={labelCls} htmlFor="buy-comment">หมายเหตุ</label>
        <textarea
          id="buy-comment"
          ref={refs.comment}
          rows={2}
          className={cx(baseField, "resize-y")}
          value={order.comment}
          onChange={(e) => updateOrder("comment", e.target.value)}
          onKeyDown={onEnter("comment")}
          placeholder="เช่น ความชื้นวัดซ้ำรอบบ่าย"
        />
      </div>
    </section>
  )
}

