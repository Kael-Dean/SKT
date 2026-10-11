// src/pages/work/buy/BuyWeighSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "ตัวเลขและการคำนวณ" — entry/exit weight, gross, moisture, impurity, deduction
// (auto or manual), net, gram, unit price, amount. Desktop card moved verbatim
// out of Buy.jsx's <form>.
// ─────────────────────────────────────────────────────────────────────────────
import { cx, baseField, fieldDisabled, labelCls, helpTextCls, errorTextCls, cardCls } from "../../../lib/styles"
import {
  onlyDigits, thb, nf, moneyToNumber, formatMoneyInput, suggestDeductionWeight, isEnabledInput, MOISTURE_STD,
  fieldId, errId, describedBy,
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

      {numField("gram", "คุณภาพ (gram)", { inputMode: "numeric", sanitize: onlyDigits, placeholder: "เช่น 85" })}
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

/* ═══════════════════════════════ DESKTOP (≥md) — unchanged tree ═══════════════════════════════ */

function DesktopWeighSection({ form }) {
  const {
    order, updateOrder, refs, errors, clearHint, clearError, redFieldCls, redHintCls, onEnter,
    grossFromScale, netWeight,
  } = form

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-transparent dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        <h3 className="text-lg font-semibold">ตัวเลขและการคำนวณ</h3>
      </div>

      {/* น้ำหนักก่อนชั่ง */}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor={fieldId("entryWeightKg")}>น้ำหนักก่อนชั่ง (กก.)</label>
          <input
            id={fieldId("entryWeightKg")}
            aria-describedby={describedBy(errors, "entryWeightKg")}
            ref={refs.entryWeightKg}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("entryWeightKg"))}
            value={order.entryWeightKg}
            onChange={(e) => { updateOrder("entryWeightKg", e.target.value.replace(/[^\d.]/g, "")); clearError("entryWeightKg") }}
            onFocus={() => clearHint("entryWeightKg")}
            onKeyDown={onEnter("entryWeightKg")}
            placeholder="เช่น 12000"
            aria-invalid={errors.entryWeightKg ? true : undefined}
          />
          {errors.entryWeightKg && <p id={errId("entryWeightKg")} className={errorTextCls}>{errors.entryWeightKg}</p>}
        </div>

        <div>
          <label className={labelCls} htmlFor={fieldId("exitWeightKg")}>น้ำหนักหลังชั่ง (กก.)</label>
          <input
            id={fieldId("exitWeightKg")}
            aria-describedby={describedBy(errors, "exitWeightKg")}
            ref={refs.exitWeightKg}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("exitWeightKg"))}
            value={order.exitWeightKg}
            onChange={(e) => { updateOrder("exitWeightKg", e.target.value.replace(/[^\d.]/g, "")); clearError("exitWeightKg") }}
            onFocus={() => clearHint("exitWeightKg")}
            onKeyDown={onEnter("exitWeightKg")}
            placeholder="เช่น 7000"
            aria-invalid={errors.exitWeightKg ? true : undefined}
          />
          {errors.exitWeightKg && <p id={errId("exitWeightKg")} className={errorTextCls}>{errors.exitWeightKg}</p>}
        </div>

        <div>
          <label className={labelCls} htmlFor={fieldId("grossFromScale")}>น้ำหนักจากตาชั่ง (กก.)</label>
          <input id={fieldId("grossFromScale")} disabled className={cx(baseField, fieldDisabled)} value={Math.round(grossFromScale * 100) / 100} />
          <p className={helpTextCls}>คำนวณจาก |หลังชั่ง − ก่อนชั่ง|</p>
        </div>

        {/* ความชื้น */}
        <div>
          <label className={labelCls} htmlFor={fieldId("moisturePct")}>ความชื้น (%)</label>
          <input
            id={fieldId("moisturePct")}
            aria-describedby={describedBy(errors, "moisturePct")}
            ref={refs.moisturePct}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("moisturePct"))}
            value={order.moisturePct}
            onChange={(e) => { updateOrder("moisturePct", onlyDigits(e.target.value)); clearError("moisturePct") }}
            onFocus={() => clearHint("moisturePct")}
            onKeyDown={onEnter("moisturePct")}
            placeholder="เช่น 18"
            aria-invalid={errors.moisturePct ? true : undefined}
          />
          <p className={helpTextCls}>{MOISTURE_STD}</p>
          {errors.moisturePct && <p id={errId("moisturePct")} className={errorTextCls}>{errors.moisturePct}</p>}
        </div>

        {/* สิ่งเจือปน */}
        <div>
          <label className={labelCls} htmlFor={fieldId("impurityPct")}>สิ่งเจือปน (%)</label>
          <input
            id={fieldId("impurityPct")}
            aria-describedby={describedBy(errors, "impurityPct")}
            ref={refs.impurityPct}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("impurityPct"))}
            value={order.impurityPct}
            onChange={(e) => { updateOrder("impurityPct", onlyDigits(e.target.value)); clearError("impurityPct") }}
            onFocus={() => clearHint("impurityPct")}
            onKeyDown={onEnter("impurityPct")}
            placeholder="เช่น 2"
            aria-invalid={errors.impurityPct ? true : undefined}
          />
          {errors.impurityPct && <p id={errId("impurityPct")} className={errorTextCls}>{errors.impurityPct}</p>}
        </div>

        {/* หักน้ำหนัก */}
        <div className="">
          <div className="flex items-center justify-between">
            <label className={labelCls} htmlFor={fieldId("deductWeightKg")}>หักน้ำหนัก (ความชื้น+สิ่งเจือปน) (กก.)</label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={order.manualDeduct}
                onChange={(e) => updateOrder("manualDeduct", e.target.checked)}
              />
              กำหนดเอง
            </label>
          </div>
          <input
            id={fieldId("deductWeightKg")}
            aria-describedby={describedBy(errors, "deductWeightKg")}
            ref={refs.deductWeightKg}
            inputMode="decimal"
            disabled={!order.manualDeduct}
            className={cx(
              baseField,
              !order.manualDeduct && fieldDisabled,
              errors.deductWeightKg && "border-red-400",
              order.manualDeduct && redHintCls("deductWeightKg")
            )}
            value={
              order.manualDeduct
                ? order.deductWeightKg
                : String(Math.round(suggestDeductionWeight(grossFromScale, order.moisturePct, order.impurityPct) * 100) / 100)
            }
            onChange={(e) => updateOrder("deductWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
            onFocus={() => clearHint("deductWeightKg")}
            onKeyDown={onEnter("deductWeightKg")}
            placeholder="ระบบคำนวณให้ หรือกำหนดเอง"
            aria-invalid={errors.deductWeightKg ? true : undefined}
          />
          {errors.deductWeightKg && <p id={errId("deductWeightKg")} className={errorTextCls}>{errors.deductWeightKg}</p>}
        </div>

        <div>
          <label className={labelCls} htmlFor={fieldId("netWeight")}>น้ำหนักสุทธิ (กก.)</label>
          <input id={fieldId("netWeight")} disabled className={cx(baseField, fieldDisabled)} value={Math.round(netWeight * 100) / 100} />
        </div>

        {/* gram */}
        <div>
          <label className={labelCls} htmlFor={fieldId("gram")}>คุณภาพข้าว (gram)</label>
          <input
            id={fieldId("gram")}
            aria-describedby={describedBy(errors, "gram")}
            ref={refs.gram}
            inputMode="numeric"
            className={cx(baseField, redFieldCls("gram"))}
            value={order.gram}
            onChange={(e) => { updateOrder("gram", onlyDigits(e.target.value)); clearError("gram") }}
            onFocus={() => clearHint("gram")}
            onKeyDown={onEnter("gram")}
            placeholder="เช่น 85"
            aria-invalid={errors.gram ? true : undefined}
          />
          {errors.gram && <p id={errId("gram")} className={errorTextCls}>{errors.gram}</p>}
        </div>

        {/* ราคาต่อกก. */}
        <div>
          <label className={labelCls} htmlFor={fieldId("unitPrice")}>ราคาต่อกก. (บาท)</label>
          <input
            id={fieldId("unitPrice")}
            aria-describedby={describedBy(errors, "unitPrice")}
            ref={refs.unitPrice}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("unitPrice"))}
            value={order.unitPrice}
            onChange={(e) => { updateOrder("unitPrice", e.target.value.replace(/[^\d.]/g, "")); clearError("unitPrice") }}
            onFocus={() => clearHint("unitPrice")}
            onKeyDown={onEnter("unitPrice")}
            placeholder="เช่น 12.50"
            aria-invalid={errors.unitPrice ? true : undefined}
          />
          <p className={helpTextCls}>ถ้ากรอกราคา ระบบจะคำนวณ “เป็นเงิน” ให้อัตโนมัติ</p>
          {errors.unitPrice && <p id={errId("unitPrice")} className={errorTextCls}>{errors.unitPrice}</p>}
        </div>

        {/* เป็นเงิน */}
        <div>
          <label className={labelCls} htmlFor={fieldId("amountTHB")}>เป็นเงิน (บาท)</label>
          <input
            id={fieldId("amountTHB")}
            aria-describedby={describedBy(errors, "amountTHB")}
            ref={refs.amountTHB}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("amountTHB"))}
            value={order.amountTHB}
            onChange={(e) => { updateOrder("amountTHB", formatMoneyInput(e.target.value)); clearError("amountTHB") }}
            onFocus={() => clearHint("amountTHB")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.isComposing) {
                e.preventDefault()
                const btn = refs.submitBtn?.current
                if (btn && isEnabledInput(btn)) {
                  try { btn.scrollIntoView({ block: "center" }) } catch { /* ignore */ }
                  btn.focus?.()
                }
              }
            }}
            placeholder="เช่น 60,000"
            aria-invalid={errors.amountTHB ? true : undefined}
          />
          {!!order.amountTHB && <p className={helpTextCls}>≈ {thb(moneyToNumber(order.amountTHB))}</p>}
          {errors.amountTHB && <p id={errId("amountTHB")} className={errorTextCls}>{errors.amountTHB}</p>}
        </div>
      </div>
    </div>
  )
}
