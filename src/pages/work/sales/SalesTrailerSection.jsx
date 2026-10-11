// src/pages/work/sales/SalesTrailerSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sales "รถพ่วง". Default export = DESKTOP section (round 2): count ComboBox
// in the header, one compact group per trailer. At ≥lg each side (หน้า/หลัง)
// is one table-like row under a single column header; at md each side falls
// back to a labelled 3-column grid. Same `getTRef(idx, key)` refs and DOM
// order = `trailerOrder` → the Enter chain (`focusNextTrailer`) is unchanged.
// `TrailerCountCombo` / `TrailerSideFields` are exported for the phone accordion.
// ─────────────────────────────────────────────────────────────────────────────
import { Plus, Trash2 } from "lucide-react"
import ComboBox from "../../../components/ComboBox"
import { cx, cardCls, baseField, fieldDisabled, labelCls, errorTextCls, iconBtnCls, neutralBtnCls } from "../../../lib/styles"
import { SalesCommentField } from "./SalesSummary"
import { onlyDigits, formatMoneyInput, trailerCountOptions, nf, thb, fieldId, trailerFieldId } from "./salesShared"

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
const MOBILE_LABELS = { scaleNo: "เลขที่ใบชั่ง", unitPrice: "ราคาต่อกก. (บาท)", gram: "คุณภาพ (กรัม)", plate: "ทะเบียน", weight: "น้ำหนักสุทธิ (กก.)", amount: "เป็นเงิน (บาท)" }

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
  const red = (key) => terr[key] && "!border-red-500 ring-2 !ring-red-300 dark:!border-red-400 dark:!ring-red-500/40"
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
const MAX_TRAILERS = trailerCountOptions.length

// One grid template for the column header and both rows (≥lg). Column order
// = trailerOrder (scaleNo → unitPrice → gram → plate → weight → amount) so
// Tab order and the Enter chain run left → right.
const ROW_COLS = "lg:grid-cols-[3rem_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.15fr)_minmax(0,1.25fr)]"
const COLUMNS = [
  { k: "scaleNo", head: "ใบชั่ง", label: "เลขที่ใบชั่ง" },
  { k: "unitPrice", head: "ราคา/กก. (บาท)", label: "ราคาต่อกก. (บาท)", num: true, suffix: "บาท" },
  { k: "gram", head: "คุณภาพ (กรัม)", label: "คุณภาพ (กรัม)", num: true },
  { k: "plate", head: "ทะเบียน", label: "ทะเบียน" },
  { k: "weight", head: "น้ำหนักสุทธิ (กก.)", label: "น้ำหนักสุทธิ (กก.)", num: true, suffix: "กก." },
  { k: "amount", head: "เป็นเงิน", label: "เป็นเงิน (บาท)", num: true },
]
const SIDE_NAME = { front: "หน้า", back: "หลัง" }
const SANITIZE = {
  scaleNo: (v) => v,
  unitPrice: (v) => v.replace(/[^\d.]/g, ""),
  gram: (v) => onlyDigits(v),
  plate: (v) => v.toUpperCase(),
  weight: (v) => v.replace(/[^\d.]/g, ""),
}
const INPUT_MODE = { unitPrice: "decimal", gram: "numeric", weight: "decimal" }

// baseField (not cellInput): these cells stay ≥16px on phones, so no `cell-input` opt-out.
// Padding stays non-important so the `xl:pr-11` suffix gutter can still win.
const cellInputCls = cx(baseField, "h-10 min-w-0 !rounded-xl px-2.5 py-0")
const cellErrCls = "!border-red-500 ring-2 !ring-red-300 dark:!border-red-400 dark:!ring-red-500/40"

/** One side (หน้า/หลัง) of trailer `idx` — a table row at ≥lg, a labelled 3-col grid at md. */
function TrailerRow({ form, idx, side, amount }) {
  const { trailers, errors, getTRef, updateTrailer, onEnterTrailer } = form
  const t = trailers[idx] || {}
  const terr = errors?.trailers?.[idx] || {}
  const K = SIDE[side].keys
  const fid = (key) => trailerFieldId(idx, key)
  return (
    <div className={cx("mt-2 grid gap-3 md:grid-cols-3 lg:items-center lg:gap-x-2 lg:gap-y-0", ROW_COLS)}>
      <div className="md:col-span-3 lg:col-span-1">
        <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600">
          <span className="lg:sr-only">พ่วง</span>{SIDE_NAME[side]}
        </span>
      </div>

      {COLUMNS.map((c) => {
        const key = K[c.k]
        const bad = !!terr[key]
        const label = (
          <label htmlFor={fid(key)} className="mb-1 block text-sm font-medium text-gray-700 lg:sr-only dark:text-gray-200">
            <span className="sr-only">คันที่ {idx + 1} พ่วง{SIDE_NAME[side]} </span>{c.label}
          </label>
        )
        if (c.k === "amount") {
          // Read-only result shown as text — still focusable (a stop in the Enter chain).
          return (
            <div key={c.k} className="min-w-0">
              {label}
              <input
                id={fid(key)}
                ref={getTRef(idx, key)}
                readOnly
                tabIndex={0}
                aria-readonly="true"
                value={amount > 0 ? thb(amount) : "—"}
                onKeyDown={onEnterTrailer(idx, key)}
                className="h-10 w-full min-w-0 truncate rounded-xl bg-transparent px-2.5 text-right text-[15px] font-semibold tabular-nums text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:max-xl:text-sm dark:text-gray-100"
              />
            </div>
          )
        }
        return (
          <div key={c.k} className="min-w-0">
            {label}
            <div className="relative">
              <input
                id={fid(key)}
                ref={getTRef(idx, key)}
                inputMode={INPUT_MODE[c.k]}
                autoCapitalize={c.k === "plate" ? "characters" : undefined}
                className={cx(cellInputCls, c.num && "text-right tabular-nums", c.suffix && "xl:pr-11", bad && cellErrCls)}
                value={t[key] ?? ""}
                onChange={(e) => updateTrailer(idx, key, SANITIZE[c.k](e.target.value))}
                onKeyDown={onEnterTrailer(idx, key)}
                aria-invalid={bad ? true : undefined}
                aria-describedby={bad ? `${fid(key)}-err` : undefined}
              />
              {c.suffix && (
                <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-sm text-gray-500 xl:inline dark:text-gray-400">
                  {c.suffix}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function SalesTrailerSection({ form }) {
  const { trailers, trailersCount, setTrailersCount, removeTrailer, trailerSummary, errors, focusFirstOfTrailer } = form
  const addTrailer = () => {
    if (trailersCount >= MAX_TRAILERS) return
    const next = trailersCount // index of the new trailer
    setTrailersCount(trailersCount + 1)
    // the trailers effect appends the row on a later render → focus after it
    setTimeout(() => focusFirstOfTrailer(next), 60)
  }
  return (
    <section id="trailers-block" aria-labelledby="sales-sec-trailers" className={cx(cardCls, "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sales-sec-trailers" className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100">รถพ่วง</h2>
        <div className="flex items-center gap-3">
          <label htmlFor={fieldId("trailerCount")} className="text-sm font-medium text-gray-700 dark:text-gray-200">จำนวนรถพ่วง</label>
          <div className="w-32">
            <TrailerCountCombo form={form} />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {trailers.map((_t, idx) => {
          const row = trailerSummary.rows[idx]
          const net = row?.net ?? 0
          const amount = row?.amount ?? 0
          const terr = errors?.trailers?.[idx] || {}
          const errKeys = Object.keys(terr).filter((k) => k !== "_net")
          const titleId = `sales-t${idx}-title`
          return (
            <div key={idx} role="group" aria-labelledby={titleId} className="rounded-xl bg-gray-50 p-3 lg:p-4 dark:bg-gray-900/40">
              <div className="flex items-center justify-between gap-3">
                <h3 id={titleId} className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">รถคันที่ {idx + 1}</h3>
                <div className="flex items-center gap-2">
                  <p className={cx("text-sm tabular-nums", net > 0 ? "text-gray-600 dark:text-gray-300" : "text-gray-500 dark:text-gray-400")}>
                    {nf(net)} กก. · <span className={cx(net > 0 && "font-semibold text-gray-900 dark:text-gray-100")}>{thb(amount)}</span>
                  </p>
                  {trailers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTrailer(idx)}
                      aria-label={`ลบรถคันที่ ${idx + 1}`}
                      title={`ลบรถคันที่ ${idx + 1}`}
                      className={cx(iconBtnCls, "-my-1 hover:text-red-700 dark:hover:text-red-400")}
                    >
                      <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </div>

              {/* column header — once per trailer (≥lg); the per-cell labels are sr-only there */}
              <div aria-hidden="true" className={cx("mt-2 hidden gap-x-2 text-xs font-medium text-gray-500 lg:grid dark:text-gray-400", ROW_COLS)}>
                <span />
                {COLUMNS.map((c) => (
                  <span key={c.k} className={cx("truncate", c.num ? "pr-2.5 text-right" : "pl-2.5")}>{c.head}</span>
                ))}
              </div>

              <TrailerRow form={form} idx={idx} side="front" amount={row?.front.amount ?? 0} />
              <TrailerRow form={form} idx={idx} side="back" amount={row?.back.amount ?? 0} />

              {(errKeys.length > 0 || terr._net) && (
                <ul className="mt-2 space-y-0.5">
                  {errKeys.map((k) => (
                    <li key={k} id={`${trailerFieldId(idx, k)}-err`} className={errorTextCls}>{terr[k]}</li>
                  ))}
                  {terr._net && <li className={errorTextCls}>{terr._net}</li>}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={addTrailer}
        disabled={trailersCount >= MAX_TRAILERS}
        className={cx(neutralBtnCls, "mt-3 md:h-9")}
      >
        <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
        เพิ่มคัน
      </button>

      <SalesCommentField form={form} />
    </section>
  )
}
