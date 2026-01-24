// src/pages/operation-plan/AgriProcessingPlanDetail.jsx
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
//รายละเอียดแผนการแปรรูปผลผลิตการเกษตร//
/** ---------------- Utils ---------------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => {
  if (v === "" || v === null || v === undefined) return 0
  const n = Number(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}
const sanitizeNumberInput = (s) => {
  const cleaned = String(s ?? "").replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  if (parts.length <= 2) return cleaned
  return `${parts[0]}.${parts.slice(1).join("")}`
}
const fmtQty = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(toNumber(n))
const fmtMoney = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(toNumber(n))

/** ---------------- UI styles ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

/** ---------------- Table definition ---------------- */
const MONTHS = [
  { key: "m04", label: "เม.ย.", month: 4 },
  { key: "m05", label: "พ.ค.", month: 5 },
  { key: "m06", label: "มิ.ย.", month: 6 },
  { key: "m07", label: "ก.ค.", month: 7 },
  { key: "m08", label: "ส.ค.", month: 8 },
  { key: "m09", label: "ก.ย.", month: 9 },
  { key: "m10", label: "ต.ค.", month: 10 },
  { key: "m11", label: "พ.ย.", month: 11 },
  { key: "m12", label: "ธ.ค.", month: 12 },
  { key: "m01", label: "ม.ค.", month: 1 },
  { key: "m02", label: "ก.พ.", month: 2 },
  { key: "m03", label: "มี.ค.", month: 3 },
]

const ITEMS = [
  { type: "group", label: "ข้าวสารและผลิตภัณฑ์ (ผลั่วทั่วไป)" },
  { type: "item", id: "rice_general", name: "ทั่วไป", unit: "ตัน", unitPrice: "" },
  { type: "item", id: "rice_organic", name: "อินทรีย์", unit: "ตัน", unitPrice: "" },
  { type: "group", label: "ผลพลอยได้" },
  { type: "item", id: "byproduct", name: "ผลพลอยได้", unit: "ตัน", unitPrice: "" },
]

const EDITABLE_ITEMS = ITEMS.filter((x) => x.type === "item")

function buildInitialQty() {
  const out = {}
  EDITABLE_ITEMS.forEach((it) => {
    out[it.id] = {}
    MONTHS.forEach((m) => (out[it.id][m.key] = ""))
  })
  return out
}

function buildInitialPrice() {
  const out = {}
  EDITABLE_ITEMS.forEach((it) => (out[it.id] = String(it.unitPrice ?? "")))
  return out
}

/** layout width */
const COL_W = { product: 320, unit: 80, price: 120, month: 86, totalQty: 120, totalAmt: 150 }
const LEFT_W = COL_W.product + COL_W.unit + COL_W.price
const RIGHT_W = MONTHS.length * COL_W.month + COL_W.totalQty + COL_W.totalAmt
const TOTAL_W = LEFT_W + RIGHT_W

/** stripe */
const STRIPE = {
  headEven: "bg-slate-100/90 dark:bg-slate-700/70",
  headOdd: "bg-slate-200/95 dark:bg-slate-600/70",
  cellEven: "bg-slate-50/90 dark:bg-slate-800/70",
  cellOdd: "bg-slate-200/70 dark:bg-slate-700/55",
  footEven: "bg-emerald-100/55 dark:bg-emerald-900/15",
  footOdd: "bg-emerald-200/75 dark:bg-emerald-900/30",
}
const monthStripeHead = (idx) => (idx % 2 === 1 ? STRIPE.headOdd : STRIPE.headEven)
const monthStripeCell = (idx) => (idx % 2 === 1 ? STRIPE.cellOdd : STRIPE.cellEven)
const monthStripeFoot = (idx) => (idx % 2 === 1 ? STRIPE.footOdd : STRIPE.footEven)

/** ====================================================== */
/** ================= COMPONENT =========================== */
/** ====================================================== */

const AgriProcessingPlanDetail = ({ branchId, branchName, yearBE, onYearBEChange }) => {
  const [priceById, setPriceById] = useState(() => buildInitialPrice())
  const [qtyById, setQtyById] = useState(() => buildInitialQty())
  const canEdit = !!branchId

  /** dynamic height */
  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(760)
  const recalcTableCardHeight = useCallback(() => {
    const el = tableCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 800
    setTableCardHeight(Math.max(700, Math.floor(vh - rect.top - 4)))
  }, [])

  useEffect(() => {
    recalcTableCardHeight()
    window.addEventListener("resize", recalcTableCardHeight)
    return () => window.removeEventListener("resize", recalcTableCardHeight)
  }, [recalcTableCardHeight])

  /** scroll sync */
  const bodyScrollRef = useRef(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const onBodyScroll = () => {
    const b = bodyScrollRef.current
    if (b) setScrollLeft(b.scrollLeft || 0)
  }

  /** arrow navigation */
  const inputRefs = useRef(new Map())
  const totalCols = 1 + MONTHS.length

  const registerInput = (row, col) => (el) => {
    const key = `${row}|${col}`
    if (!el) inputRefs.current.delete(key)
    else inputRefs.current.set(key, el)
  }

  const ensureInView = (el) => {
    const c = bodyScrollRef.current
    if (!c || !el) return
    el.scrollIntoView({ block: "nearest", inline: "nearest" })
  }

  const handleArrowNav = (e) => {
    const k = e.key
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) return
    const row = Number(e.currentTarget.dataset.row)
    const col = Number(e.currentTarget.dataset.col)

    let r = row
    let c = col
    if (k === "ArrowLeft") c--
    if (k === "ArrowRight") c++
    if (k === "ArrowUp") r--
    if (k === "ArrowDown") r++

    r = Math.max(0, Math.min(EDITABLE_ITEMS.length - 1, r))
    c = Math.max(0, Math.min(totalCols - 1, c))

    const target = inputRefs.current.get(`${r}|${c}`)
    if (!target) return

    e.preventDefault()
    target.focus()
    target.select?.()
    ensureInView(target)
  }

  /** compute totals */
  const computed = useMemo(() => {
    const itemTotals = {}
    const monthQtyTotals = {}
    const monthAmtTotals = {}
    let grandQty = 0
    let grandAmt = 0

    MONTHS.forEach((m) => {
      monthQtyTotals[m.key] = 0
      monthAmtTotals[m.key] = 0
    })

    EDITABLE_ITEMS.forEach((it) => {
      const price = toNumber(priceById[it.id])
      let rowQty = 0
      let rowAmt = 0
      MONTHS.forEach((m) => {
        const q = toNumber(qtyById[it.id][m.key])
        const amt = q * price
        rowQty += q
        rowAmt += amt
        monthQtyTotals[m.key] += q
        monthAmtTotals[m.key] += amt
      })
      grandQty += rowQty
      grandAmt += rowAmt
      itemTotals[it.id] = { qty: rowQty, amt: rowAmt }
    })

    return { itemTotals, monthQtyTotals, monthAmtTotals, grandQty, grandAmt }
  }, [qtyById, priceById])

  /** ====================================================== */
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xl font-extrabold">รายละเอียดแผนการแปรรูปผลผลิตการเกษตร</div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <input className={baseField} value={yearBE} onChange={(e) => onYearBEChange?.(e.target.value)} placeholder="ปี พ.ศ." />
          <div className={cx(baseField, "col-span-2", !canEdit && "opacity-60")}>
            {branchName || "— ยังไม่เลือกสาขา —"}
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div ref={bodyScrollRef} onScroll={onBodyScroll} className="flex-1 overflow-auto">
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.product }} />
              <col style={{ width: COL_W.unit }} />
              <col style={{ width: COL_W.price }} />
              {MONTHS.map((m) => (
                <col key={m.key} style={{ width: COL_W.month }} />
              ))}
              <col style={{ width: COL_W.totalQty }} />
              <col style={{ width: COL_W.totalAmt }} />
            </colgroup>

            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-100">
                <th>ประเภทสินค้า</th>
                <th>หน่วย</th>
                <th>ราคา/หน่วย</th>
                {MONTHS.map((m) => (
                  <th key={m.key}>{m.label}</th>
                ))}
                <th>รวมหน่วย</th>
                <th>รวมเงิน</th>
              </tr>
            </thead>

            <tbody>
              {ITEMS.map((row, idx) => {
                if (row.type === "group") {
                  return (
                    <tr key={idx} className="bg-slate-200 font-bold">
                      <td colSpan={3 + MONTHS.length + 2} className="px-3 py-2">
                        {row.label}
                      </td>
                    </tr>
                  )
                }

                const r = EDITABLE_ITEMS.findIndex((x) => x.id === row.id)
                return (
                  <Fragment key={row.id}>
                    <tr>
                      <td rowSpan={2} className="px-3 py-2 font-semibold">
                        {row.name}
                      </td>
                      <td className="text-center">{row.unit}</td>
                      <td>
                        <input
                          ref={registerInput(r, 0)}
                          data-row={r}
                          data-col={0}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={priceById[row.id]}
                          onChange={(e) => setPriceById({ ...priceById, [row.id]: sanitizeNumberInput(e.target.value) })}
                        />
                      </td>
                      {MONTHS.map((m, mi) => (
                        <td key={m.key}>
                          <input
                            ref={registerInput(r, mi + 1)}
                            data-row={r}
                            data-col={mi + 1}
                            onKeyDown={handleArrowNav}
                            className={cellInput}
                            value={qtyById[row.id][m.key]}
                            onChange={(e) =>
                              setQtyById({
                                ...qtyById,
                                [row.id]: { ...qtyById[row.id], [m.key]: sanitizeNumberInput(e.target.value) },
                              })
                            }
                          />
                        </td>
                      ))}
                      <td className="text-right font-bold">{fmtQty(computed.itemTotals[row.id]?.qty)}</td>
                      <td />
                    </tr>

                    <tr className="bg-slate-50">
                      <td className="text-center font-semibold">บาท</td>
                      <td />
                      {MONTHS.map((m) => (
                        <td key={m.key} className="text-right">
                          {fmtMoney(toNumber(qtyById[row.id][m.key]) * toNumber(priceById[row.id]))}
                        </td>
                      ))}
                      <td />
                      <td className="text-right font-bold">{fmtMoney(computed.itemTotals[row.id]?.amt)}</td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AgriProcessingPlanDetail
