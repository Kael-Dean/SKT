// src/pages/work/buy/BuyWeighSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "ตัวเลขและการคำนวณ" — entry/exit weight, gross, moisture, impurity, deduction
// (auto or manual), net, gram, unit price, amount. Desktop card moved verbatim
// out of Buy.jsx's <form>.
// ─────────────────────────────────────────────────────────────────────────────
import { cx, baseField, fieldDisabled, labelCls, helpTextCls, errorTextCls } from "../../../lib/styles"
import {
  onlyDigits, thb, moneyToNumber, formatMoneyInput, suggestDeductionWeight, isEnabledInput, MOISTURE_STD,
} from "./buyShared"

export default function BuyWeighSection({ form }) {
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
          <label className={labelCls}>น้ำหนักก่อนชั่ง (กก.)</label>
          <input
            ref={refs.entryWeightKg}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("entryWeightKg"))}
            value={order.entryWeightKg}
            onChange={(e) => updateOrder("entryWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
            onFocus={() => {
              clearHint("entryWeightKg")
              clearError("entryWeightKg")
            }}
            onKeyDown={onEnter("entryWeightKg")}
            placeholder="เช่น 12000"
            aria-invalid={errors.entryWeightKg ? true : undefined}
          />
          {errors.entryWeightKg && <p className={errorTextCls}>{errors.entryWeightKg}</p>}
        </div>

        <div>
          <label className={labelCls}>น้ำหนักหลังชั่ง (กก.)</label>
          <input
            ref={refs.exitWeightKg}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("exitWeightKg"))}
            value={order.exitWeightKg}
            onChange={(e) => updateOrder("exitWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
            onFocus={() => {
              clearHint("exitWeightKg")
              clearError("exitWeightKg")
            }}
            onKeyDown={onEnter("exitWeightKg")}
            placeholder="เช่น 7000"
            aria-invalid={errors.exitWeightKg ? true : undefined}
          />
          {errors.exitWeightKg && <p className={errorTextCls}>{errors.exitWeightKg}</p>}
        </div>

        <div>
          <label className={labelCls}>น้ำหนักจากตาชั่ง (กก.)</label>
          <input disabled className={cx(baseField, fieldDisabled)} value={Math.round(grossFromScale * 100) / 100} />
          <p className={helpTextCls}>คำนวณจาก |หลังชั่ง − ก่อนชั่ง|</p>
        </div>

        {/* ความชื้น */}
        <div>
          <label className={labelCls}>ความชื้น (%)</label>
          <input
            ref={refs.moisturePct}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("moisturePct"))}
            value={order.moisturePct}
            onChange={(e) => updateOrder("moisturePct", onlyDigits(e.target.value))}
            onFocus={() => { clearHint("moisturePct"); clearError("moisturePct") }}
            onKeyDown={onEnter("moisturePct")}
            placeholder="เช่น 18"
          />
          <p className={helpTextCls}>{MOISTURE_STD}</p>
          {errors.moisturePct && <p className={errorTextCls}>{errors.moisturePct}</p>}
        </div>

        {/* สิ่งเจือปน */}
        <div>
          <label className={labelCls}>สิ่งเจือปน (%)</label>
          <input
            ref={refs.impurityPct}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("impurityPct"))}
            value={order.impurityPct}
            onChange={(e) => updateOrder("impurityPct", onlyDigits(e.target.value))}
            onFocus={() => { clearHint("impurityPct"); clearError("impurityPct") }}
            onKeyDown={onEnter("impurityPct")}
            placeholder="เช่น 2"
          />
          {errors.impurityPct && <p className={errorTextCls}>{errors.impurityPct}</p>}
        </div>

        {/* หักน้ำหนัก */}
        <div className="">
          <div className="flex items-center justify-between">
            <label className={labelCls}>หักน้ำหนัก (ความชื้น+สิ่งเจือปน) (กก.)</label>
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
          {errors.deductWeightKg && <p className={errorTextCls}>{errors.deductWeightKg}</p>}
        </div>

        <div>
          <label className={labelCls}>น้ำหนักสุทธิ (กก.)</label>
          <input disabled className={cx(baseField, fieldDisabled)} value={Math.round(netWeight * 100) / 100} />
        </div>

        {/* gram */}
        <div>
          <label className={labelCls}>คุณภาพข้าว (gram)</label>
          <input
            ref={refs.gram}
            inputMode="numeric"
            className={cx(baseField, redFieldCls("gram"))}
            value={order.gram}
            onChange={(e) => updateOrder("gram", onlyDigits(e.target.value))}
            onFocus={() => { clearHint("gram"); clearError("gram") }}
            onKeyDown={onEnter("gram")}
            placeholder="เช่น 85"
          />
          {errors.gram && <p className={errorTextCls}>{errors.gram}</p>}
        </div>

        {/* ราคาต่อกก. */}
        <div>
          <label className={labelCls}>ราคาต่อกก. (บาท)</label>
          <input
            ref={refs.unitPrice}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("unitPrice"))}
            value={order.unitPrice}
            onChange={(e) => updateOrder("unitPrice", e.target.value.replace(/[^\d.]/g, ""))}
            onFocus={() => { clearHint("unitPrice"); clearError("unitPrice") }}
            onKeyDown={onEnter("unitPrice")}
            placeholder="เช่น 12.50"
          />
          <p className={helpTextCls}>ถ้ากรอกราคา ระบบจะคำนวณ “เป็นเงิน” ให้อัตโนมัติ</p>
          {errors.unitPrice && <p className={errorTextCls}>{errors.unitPrice}</p>}
        </div>

        {/* เป็นเงิน */}
        <div>
          <label className={labelCls}>เป็นเงิน (บาท)</label>
          <input
            ref={refs.amountTHB}
            inputMode="decimal"
            className={cx(baseField, redFieldCls("amountTHB"))}
            value={order.amountTHB}
            onChange={(e) => updateOrder("amountTHB", formatMoneyInput(e.target.value))}
            onFocus={() => {
              clearHint("amountTHB")
              clearError("amountTHB")
            }}
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
          {errors.amountTHB && <p className={errorTextCls}>{errors.amountTHB}</p>}
        </div>
      </div>
    </div>
  )
}
