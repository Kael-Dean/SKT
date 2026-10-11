// src/pages/work/sales/SalesTrailerSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sales "ข้อมูลรถพ่วงหลายคัน". Default export = desktop block (DOM identical
// to the pre-split page: count ComboBox + one card per trailer with
// พ่วงหน้า / พ่วงหลัง zones). `TrailerCountCombo` and `TrailerSideFields` are
// the same inputs (same `getTRef(idx, key)` refs → `focusNextTrailer` Enter
// chain) exported for the phone accordion.
// ─────────────────────────────────────────────────────────────────────────────
import ComboBox from "../../../components/ComboBox"
import { cx, baseField, fieldDisabled, labelCls, errorTextCls } from "../../../lib/styles"
import { onlyDigits, formatMoneyInput, trailerCountOptions, round2, thb, fieldId, trailerFieldId } from "./salesShared"

/** จำนวนรถพ่วง (1–10). */
export function TrailerCountCombo({ form }) {
  const { trailersCount, setTrailersCount, refs, focusFirstOfTrailer } = form
  return (
    <ComboBox
      id={fieldId("trailerCount")}
      options={trailerCountOptions}
      value={String(trailersCount)}
      onChange={(id) => setTrailersCount(Number(id))}
      buttonRef={refs.trailerCount}
      onEnterNext={() => focusFirstOfTrailer(0)}
      searchable={false}
      title="จำนวนรถพ่วง"
      ariaLabel="จำนวนรถพ่วง"
    />
  )
}

const SIDE = {
  front: {
    keys: { scaleNo: "scaleNoFront", unitPrice: "unitPriceFront", gram: "gramFront", plate: "licensePlateFront", weight: "frontWeightKg", amount: "amountFront" },
    labels: { scaleNo: "เลขที่ใบชั่งพ่วงหน้า", plate: "ทะเบียนพ่วงหน้า", weight: "น้ำหนักสุทธิพ่วงหน้า (กก.)", amount: "เป็นเงิน (พ่วงหน้า)" },
    ph: { scaleNo: "เช่น SCL-2025-000123", plate: "เช่น 1กก-1234 กทม.", weight: "เช่น 7,000" },
  },
  back: {
    keys: { scaleNo: "scaleNoBack", unitPrice: "unitPriceBack", gram: "gramBack", plate: "licensePlateBack", weight: "backWeightKg", amount: "amountBack" },
    labels: { scaleNo: "เลขที่ใบชั่งพ่วงหลัง", plate: "ทะเบียนพ่วงหลัง", weight: "น้ำหนักสุทธิพ่วงหลัง (กก.)", amount: "เป็นเงิน (พ่วงหลัง)" },
    ph: { scaleNo: "เช่น SCL-2025-000124", plate: "เช่น 1กก-5678 กทม.", weight: "เช่น 12,000" },
  },
}
// Mobile labels (copy deck §6.2): the sub-heading "พ่วงหน้า/พ่วงหลัง" carries the side.
const MOBILE_LABELS = { scaleNo: "เลขที่ใบชั่ง", unitPrice: "ราคาต่อกก. (บาท)", gram: "คุณภาพ (gram)", plate: "ทะเบียน", weight: "น้ำหนักสุทธิ (กก.)", amount: "เป็นเงิน (บาท)" }

/**
 * The 6 fields of one side of trailer `idx` in `trailerOrder` sequence:
 * scaleNo → unitPrice → gram → plate → weight → amount. Renders the field
 * <div>s only — the caller owns the grid container.
 */
export function TrailerSideFields({ form, idx, side = "front", amount = 0, mobile = false }) {
  const { trailers, errors, getTRef, updateTrailer, onEnterTrailer } = form
  const t = trailers[idx] || {}
  const terr = errors?.trailers?.[idx] || {}
  const { keys: K, labels: L, ph: P } = SIDE[side]
  const lbl = (k) => (mobile ? MOBILE_LABELS[k] : (L[k] ?? MOBILE_LABELS[k]))
  const red = (key) => terr[key] && "border-red-500 ring-2 ring-red-300"
  const numCls = mobile ? "text-right tabular-nums" : ""
  // a11y: K.* already carries the side (scaleNoFront…), so `sales-t{idx}-{key}` is unique
  const fid = (key) => trailerFieldId(idx, key)
  const eid = (key) => `${fid(key)}-err`
  const desc = (key) => (terr[key] ? eid(key) : undefined)
  return (
    <>
      <div className="md:col-span-1">
        <label className={labelCls} htmlFor={fid(K.scaleNo)}>{lbl("scaleNo")}</label>
        <input
          id={fid(K.scaleNo)}
          ref={getTRef(idx, K.scaleNo)}
          className={cx(baseField, red(K.scaleNo))}
          value={t[K.scaleNo]}
          onChange={(e) => updateTrailer(idx, K.scaleNo, e.target.value)}
          onKeyDown={onEnterTrailer(idx, K.scaleNo)}
          placeholder={P.scaleNo}
          aria-invalid={terr[K.scaleNo] ? true : undefined}
          aria-describedby={desc(K.scaleNo)}
        />
        {terr[K.scaleNo] && <p id={eid(K.scaleNo)} className={errorTextCls}>{terr[K.scaleNo]}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor={fid(K.unitPrice)}>{lbl("unitPrice")}</label>
        <input
          id={fid(K.unitPrice)}
          ref={getTRef(idx, K.unitPrice)}
          inputMode="decimal"
          className={cx(baseField, numCls, red(K.unitPrice))}
          value={t[K.unitPrice]}
          onChange={(e) => updateTrailer(idx, K.unitPrice, e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={onEnterTrailer(idx, K.unitPrice)}
          placeholder="เช่น 15.00"
          aria-invalid={terr[K.unitPrice] ? true : undefined}
          aria-describedby={desc(K.unitPrice)}
        />
        {terr[K.unitPrice] && <p id={eid(K.unitPrice)} className={errorTextCls}>{terr[K.unitPrice]}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor={fid(K.gram)}>{lbl("gram")}</label>
        <input
          id={fid(K.gram)}
          ref={getTRef(idx, K.gram)}
          inputMode="numeric"
          className={cx(baseField, numCls)}
          value={t[K.gram]}
          onChange={(e) => updateTrailer(idx, K.gram, onlyDigits(e.target.value))}
          onKeyDown={onEnterTrailer(idx, K.gram)}
          placeholder="เช่น 85"
        />
      </div>

      <div>
        <label className={labelCls} htmlFor={fid(K.plate)}>{lbl("plate")}</label>
        <input
          id={fid(K.plate)}
          ref={getTRef(idx, K.plate)}
          className={cx(baseField, red(K.plate))}
          value={t[K.plate]}
          onChange={(e) => updateTrailer(idx, K.plate, e.target.value.toUpperCase())}
          onKeyDown={onEnterTrailer(idx, K.plate)}
          placeholder={P.plate}
          autoCapitalize="characters"
          aria-invalid={terr[K.plate] ? true : undefined}
          aria-describedby={desc(K.plate)}
        />
        {terr[K.plate] && <p id={eid(K.plate)} className={errorTextCls}>{terr[K.plate]}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor={fid(K.weight)}>{lbl("weight")}</label>
        <input
          id={fid(K.weight)}
          ref={getTRef(idx, K.weight)}
          inputMode="decimal"
          className={cx(baseField, numCls, mobile && "text-lg", red(K.weight))}
          value={t[K.weight]}
          onChange={(e) => updateTrailer(idx, K.weight, e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={onEnterTrailer(idx, K.weight)}
          placeholder={P.weight}
          aria-invalid={terr[K.weight] ? true : undefined}
          aria-describedby={desc(K.weight)}
        />
        {terr[K.weight] && <p id={eid(K.weight)} className={errorTextCls}>{terr[K.weight]}</p>}
      </div>

      <div className="md:col-span-1">
        <label className={labelCls} htmlFor={fid(K.amount)}>{lbl("amount")}</label>
        <input
          id={fid(K.amount)}
          ref={getTRef(idx, K.amount)}
          className={cx(baseField, fieldDisabled, numCls)}
          value={formatMoneyInput(String(amount))}
          readOnly
          tabIndex={0}
          onKeyDown={onEnterTrailer(idx, K.amount)}
          aria-readonly="true"
          placeholder="คำนวณอัตโนมัติ"
        />
      </div>
    </>
  )
}

/* ============================ DESKTOP ============================ */
export default function SalesTrailerSection({ form }) {
  const { trailers, trailerSummary, errors } = form
  return (
    <div id="trailers-block" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-transparent dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        <h3 className="text-lg font-semibold">ข้อมูลรถพ่วงหลายคัน</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="w-full sm:w-64 md:w-60">
          <label className={labelCls} htmlFor={fieldId("trailerCount")}>จำนวนรถพ่วง</label>
          <TrailerCountCombo form={form} />
        </div>
      </div>

      {/* รายการรถพ่วง */}
      <div className="mt-4 grid gap-4">
        {trailers.map((_t, idx) => {
          const row = trailerSummary.rows[idx]
          const net = row?.net ?? 0
          const amount = row?.amount ?? 0
          const terr = errors?.trailers?.[idx] || {}
          return (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-slate-500" />
                  <div className="font-semibold">รถพ่วง #{idx + 1}</div>
                </div>
                {net > 0 && (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    น้ำหนักรวม: <b>{round2(net)} กก.</b> | เป็นเงินโดยประมาณ: <b>{thb(amount)}</b>
                  </div>
                )}
              </div>

              {/* โซนแยก: พ่วงหน้า / พ่วงหลัง */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* พ่วงหน้า */}
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-700/60 p-4">
                  <div className="mb-2 font-semibold flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    พ่วงหน้า
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <TrailerSideFields form={form} idx={idx} side="front" amount={row?.front.amount ?? 0} />
                  </div>
                </div>

                {/* พ่วงหลัง */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-600 p-4">
                  <div className="mb-2 font-semibold flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-slate-500" />
                    พ่วงหลัง
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <TrailerSideFields form={form} idx={idx} side="back" amount={row?.back.amount ?? 0} />
                  </div>
                </div>
              </div>

              {terr._net && <p className={errorTextCls}>{terr._net}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
