import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "@/lib/api"
/*รายละเอียดแผนการรวบรวมผลผลิตการเกษตร*/
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
const fmtQty = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(toNumber(n))
const fmtMoney = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(toNumber(n))

/** ---------------- Constants ---------------- */
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

/** ---------------- Layout widths ---------------- */
const COL_W = {
  product: 280,
  unit: 70,
  price: 110,
  month: 86,
  totalQty: 95,
  totalAmt: 120,
}
const LEFT_W = COL_W.product + COL_W.unit + COL_W.price
const RIGHT_W = MONTHS.length * COL_W.month + COL_W.totalQty + COL_W.totalAmt
const TOTAL_W = LEFT_W + RIGHT_W

/** ---------------- Styles ---------------- */
const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const STRIPE = {
  headEven: "bg-slate-100/90 dark:bg-slate-700/70",
  headOdd: "bg-slate-200/95 dark:bg-slate-600/70",
  cellEven: "bg-white dark:bg-slate-900",
  cellOdd: "bg-slate-50 dark:bg-slate-800",
  footEven: "bg-emerald-100/55 dark:bg-emerald-900/15",
  footOdd: "bg-emerald-200/75 dark:bg-emerald-900/30",
}
const monthStripeHead = (idx) => (idx % 2 === 1 ? STRIPE.headOdd : STRIPE.headEven)
const monthStripeCell = (idx) => (idx % 2 === 1 ? STRIPE.cellOdd : STRIPE.cellEven)
const monthStripeFoot = (idx) => (idx % 2 === 1 ? STRIPE.footOdd : STRIPE.footEven)
const dashIfAny = (any, formatted) => (any ? formatted : "-")

/** ---------------- Default items (fallback) ---------------- */
const FALLBACK_ITEMS = [
  { type: "group", label: "รายละเอียดแผนการรวบรวมผลผลิตการเกษตร" },
  { type: "item", id: "item_1", product_id: null, name: "รายการ 1", unit: "ตัน", sell_price: "" },
  { type: "item", id: "item_2", product_id: null, name: "รายการ 2", unit: "ตัน", sell_price: "" },
]

function buildInitialQty(editableItems) {
  const out = {}
  ;(editableItems || []).forEach((it) => {
    out[it.id] = {}
    MONTHS.forEach((m) => (out[it.id][m.key] = ""))
  })
  return out
}

function buildInitialPrice(editableItems) {
  const out = {}
  ;(editableItems || []).forEach((it) => {
    out[it.id] = {
      sell_price: String(it.sell_price ?? ""),
      comment: String(it.comment ?? ""),
    }
  })
  return out
}

const AgriCollectionPlanTable = ({ branchId, branchName, yearBE, planId }) => {
  const [items, setItems] = useState(FALLBACK_ITEMS)
  const editableItems = useMemo(() => (Array.isArray(items) ? items.filter((x) => x.type === "item") : []), [items])

  const effectivePlanId = useMemo(() => {
    const p = Number(planId || 0)
    if (Number.isFinite(p) && p > 0) return p
    const y = Number(yearBE || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [planId, yearBE])

  const effectiveYearBE = useMemo(() => {
    const y = Number(yearBE || 0)
    if (Number.isFinite(y) && y >= 2569) return y
    const p = Number(planId || 0)
    return Number.isFinite(p) && p > 0 ? 2568 + p : 2569
  }, [yearBE, planId])

  // ✅ load units by branch (ใช้ unit_id ตัวแรก)
  const [units, setUnits] = useState([])
  const defaultUnitId = useMemo(() => {
    const u = (units || []).find((x) => Number(x?.id) > 0)
    return u ? Number(u.id) : null
  }, [units])

  const canEdit = !!branchId && !!defaultUnitId

  useEffect(() => {
    if (!branchId) {
      setUnits([])
      return
    }
    let alive = true
    ;(async () => {
      try {
        const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
        const rows = Array.isArray(data) ? data : []
        const normalized = rows
          .map((r) => ({
            id: Number(r.id || 0),
            name: String(r.unit_name || r.unit || r.name || "").trim(),
          }))
          .filter((x) => x.id > 0)
        if (!alive) return
        setUnits(normalized)
      } catch (e) {
        if (!alive) return
        setUnits([])
      }
    })()
    return () => {
      alive = false
    }
  }, [branchId])

  const [priceById, setPriceById] = useState(() => buildInitialPrice(FALLBACK_ITEMS.filter((x) => x.type === "item")))
  const [qtyById, setQtyById] = useState(() => buildInitialQty(FALLBACK_ITEMS.filter((x) => x.type === "item")))
  const [showPayload, setShowPayload] = useState(false)

  // ✅ sync state when items change
  useEffect(() => {
    setPriceById((prev) => {
      const next = buildInitialPrice(editableItems.length ? editableItems : FALLBACK_ITEMS.filter((x) => x.type === "item"))
      for (const k of Object.keys(prev || {})) {
        if (next[k] !== undefined) next[k] = { ...next[k], ...prev[k] }
      }
      return next
    })

    setQtyById((prev) => {
      const next = buildInitialQty(editableItems.length ? editableItems : FALLBACK_ITEMS.filter((x) => x.type === "item"))
      for (const id of Object.keys(next)) {
        if (!prev?.[id]) continue
        for (const m of MONTHS) {
          if (prev[id][m.key] !== undefined) next[id][m.key] = prev[id][m.key]
        }
      }
      return next
    })
  }, [editableItems])

  const setQtyCell = (itemId, monthKey, nextValue) => {
    setQtyById((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [monthKey]: nextValue },
    }))
  }

  const setPriceField = (itemId, field, nextValue) => {
    setPriceById((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { sell_price: "", comment: "" }), [field]: nextValue },
    }))
  }

  const computed = useMemo(() => {
    const itemTotals = {}
    const monthQtyTotals = {}
    const monthAmtTotals = {}
    const monthAny = {}
    let anyAll = false
    let grandQty = 0
    let grandAmt = 0

    MONTHS.forEach((m) => {
      monthQtyTotals[m.key] = 0
      monthAmtTotals[m.key] = 0
      monthAny[m.key] = false
    })

    editableItems.forEach((it) => {
      const pr = priceById[it.id] || {}
      const sell = toNumber(pr.sell_price)
      let rowQty = 0
      let rowAmt = 0
      let rowAny = false

      MONTHS.forEach((m) => {
        const raw = qtyById?.[it.id]?.[m.key] ?? ""
        if (raw !== "") {
          rowAny = true
          anyAll = true
          monthAny[m.key] = true
        }
        const q = toNumber(raw)
        const amt = q * sell
        rowQty += q
        rowAmt += amt
        monthQtyTotals[m.key] += q
        monthAmtTotals[m.key] += amt
      })

      grandQty += rowQty
      grandAmt += rowAmt
      itemTotals[it.id] = { qty: rowQty, amt: rowAmt, any: rowAny }
    })

    return { itemTotals, monthQtyTotals, monthAmtTotals, monthAny, anyAll, grandQty, grandAmt }
  }, [qtyById, priceById, editableItems])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setPriceById(buildInitialPrice(editableItems))
    setQtyById(buildInitialQty(editableItems))
  }

  const payload = useMemo(() => {
    return {
      table_code: "AGRI_COLLECTION_PLAN_TABLE",
      year_be: effectiveYearBE,
      plan_id: effectivePlanId,
      branch_id: branchId ? Number(branchId) : null,
      unit_id_for_save: defaultUnitId,
      items: editableItems.map((it) => ({
        id: it.id,
        product_id: it.product_id ?? null,
        sell_price: toNumber(priceById[it.id]?.sell_price),
        values: MONTHS.reduce((acc, m) => {
          acc[m.key] = toNumber(qtyById?.[it.id]?.[m.key])
          return acc
        }, {}),
      })),
    }
  }, [effectiveYearBE, effectivePlanId, branchId, defaultUnitId, qtyById, priceById, editableItems])

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      alert("คัดลอก JSON payload แล้ว ✅")
    } catch {
      alert("คัดลอกไม่สำเร็จ")
    }
  }

  // ---- table height + scroll ----
  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(760)
  const recalcTableCardHeight = useCallback(() => {
    const el = tableCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 800
    const bottomPadding = 4
    const h = Math.max(700, Math.floor(vh - rect.top - bottomPadding))
    setTableCardHeight(h)
  }, [])
  useEffect(() => {
    recalcTableCardHeight()
    window.addEventListener("resize", recalcTableCardHeight)
    return () => window.removeEventListener("resize", recalcTableCardHeight)
  }, [recalcTableCardHeight])

  const bodyScrollRef = useRef(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const rafRef = useRef(0)
  const onBodyScroll = () => {
    const b = bodyScrollRef.current
    if (!b) return
    const x = b.scrollLeft || 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => setScrollLeft(x))
  }
  useEffect(() => {
    requestAnimationFrame(() => {
      const b = bodyScrollRef.current
      if (b) setScrollLeft(b.scrollLeft || 0)
    })
    return () => rafRef.current && cancelAnimationFrame(rafRef.current)
  }, [])

  const stickyProductHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyProductCellBase = "sticky left-0 z-[60] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  const colCount = 3 + MONTHS.length + 2 // product + unit + sell + months + totals

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold">ยอดขาย</div>
              <div className="text-xl md:text-2xl font-extrabold">รายละเอียดแผนการรวบรวมผลผลิตการเกษตร</div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ปี (พ.ศ.)</label>
                <div className={cx(baseField, "flex items-center justify-between")}>
                  <span className="font-semibold">{effectiveYearBE}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-300">plan_id: {effectivePlanId || "—"}</span>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</label>
                <div className={cx(baseField, "flex items-center justify-between", !canEdit && "opacity-70")}>
                  <span className="font-semibold">{branchName ? branchName : "— ยังไม่เลือกสาขา —"}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-300">
                    id: {branchId || "—"} • unit_id: {defaultUnitId || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={copyPayload}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              คัดลอก JSON
            </button>
            <button
              type="button"
              onClick={() => setShowPayload((v) => !v)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              {showPayload ? "ซ่อน payload" : "ดู payload"}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              ล้างข้อมูล
            </button>
          </div>
        </div>

        {showPayload && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800
                          dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
            <pre className="max-h-72 overflow-auto">{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Table Card */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700" ref={bodyScrollRef} onScroll={onBodyScroll}>
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.product }} />
              <col style={{ width: COL_W.unit }} />
              <col style={{ width: COL_W.price }} />
              {MONTHS.map((m) => (
                <col key={`c-${m.key}`} style={{ width: COL_W.month }} />
              ))}
              <col style={{ width: COL_W.totalQty }} />
              <col style={{ width: COL_W.totalAmt }} />
            </colgroup>

            <thead>
              <tr>
                <th className={cx("px-3 py-3 text-left text-sm font-bold", stickyProductHeader)} rowSpan={2}>
                  ประเภทสินค้า
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  หน่วย
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  ราคา/หน่วย
                </th>
                <th className={cx("px-2 py-2 text-center text-sm font-bold", STRIPE.headEven)} colSpan={MONTHS.length}>
                  เดือน
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  รวม (ตัน)
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  รวม (บาท)
                </th>
              </tr>
              <tr>
                {MONTHS.map((m, idx) => (
                  <th key={`h-${m.key}`} className={cx("px-2 py-2 text-center text-sm font-semibold", monthStripeHead(idx))}>
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {items.map((row, idx) => {
                if (row.type === "group") {
                  return (
                    <tr key={`g-${idx}`}>
                      <td colSpan={colCount} className="px-3 py-2 font-bold text-slate-900 bg-slate-100 dark:bg-slate-700 dark:text-slate-100">
                        {row.label}
                      </td>
                    </tr>
                  )
                }

                const it = row
                const pr = priceById[it.id] || { sell_price: "" }
                const sell = pr.sell_price ?? ""
                const t = computed.itemTotals[it.id] || { qty: 0, amt: 0, any: false }

                return (
                  <tr key={`r-${it.id}`}>
                    <td className={cx("px-3 py-2", stickyProductCellBase, idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      <div className="font-semibold">{it.name}</div>
                      {it.product_id ? <div className="text-xs text-slate-500">product_id: {it.product_id}</div> : null}
                    </td>

                    <td className={cx("px-2 py-2 text-center", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>{it.unit}</td>

                    <td className={cx("px-2 py-2", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      <input
                        className={cellInput}
                        value={sell}
                        disabled={!canEdit}
                        onChange={(e) => setPriceField(it.id, "sell_price", sanitizeNumberInput(e.target.value))}
                      />
                    </td>

                    {MONTHS.map((m, mi) => {
                      const raw = qtyById?.[it.id]?.[m.key] ?? ""
                      return (
                        <td key={`c-${it.id}-${m.key}`} className={cx("px-1 py-1", monthStripeCell(mi))}>
                          <input
                            className={cellInput}
                            value={raw}
                            disabled={!canEdit}
                            onChange={(e) => setQtyCell(it.id, m.key, sanitizeNumberInput(e.target.value))}
                          />
                        </td>
                      )
                    })}

                    <td className={cx("px-2 py-2 text-right font-semibold", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      {dashIfAny(t.any, fmtQty(t.qty))}
                    </td>
                    <td className={cx("px-2 py-2 text-right font-semibold", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      {dashIfAny(t.any, fmtMoney(t.amt))}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr>
                <td className={cx("px-3 py-3 font-extrabold", stickyProductHeader)}>รวมทั้งหมด</td>
                <td className={cx("px-2 py-3 text-center font-bold", STRIPE.footEven)}>-</td>
                <td className={cx("px-2 py-3 text-center font-bold", STRIPE.footEven)}>-</td>

                {MONTHS.map((m, idx) => (
                  <td key={`f-${m.key}`} className={cx("px-2 py-3 text-right font-bold", monthStripeFoot(idx))}>
                    {dashIfAny(computed.monthAny[m.key], fmtQty(computed.monthQtyTotals[m.key]))}
                  </td>
                ))}

                <td className={cx("px-2 py-3 text-right font-extrabold", STRIPE.footEven)}>
                  {dashIfAny(computed.anyAll, fmtQty(computed.grandQty))}
                </td>
                <td className={cx("px-2 py-3 text-right font-extrabold", STRIPE.footEven)}>
                  {dashIfAny(computed.anyAll, fmtMoney(computed.grandAmt))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-300">
          scrollLeft: {Math.round(scrollLeft)} px
        </div>
      </div>
    </div>
  )
}

export default AgriCollectionPlanTable
