import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"

/** ---------------- Utils ---------------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => {
  if (v === "" || v === null || v === undefined) return 0
  const n = Number(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}
const sanitizeNumberInput = (s, { maxDecimals = 3 } = {}) => {
  const cleaned = String(s ?? "").replace(/[^\d.]/g, "")
  if (!cleaned) return ""
  const parts = cleaned.split(".")
  if (parts.length <= 1) return parts[0]
  return `${parts[0]}.${parts.slice(1).join("").slice(0, maxDecimals)}`
}
const fmtMoney = (n) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(n))

/** ---------------- API ---------------- */
const API_BASE = String(
  import.meta.env.VITE_API_BASE_CUSTOM ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "")

class ApiError extends Error {
  constructor(message, meta = {}) {
    super(message)
    this.name = "ApiError"
    Object.assign(this, meta)
  }
}

const getToken = () =>
  String(
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    ""
  ).trim()

async function apiAuth(path, { method = "GET", body } = {}) {
  if (!API_BASE) throw new ApiError("FE: VITE_API_BASE not set", { status: 0 })
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: "include",
  }).catch((e) => { throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", { status: 0, cause: e }) })

  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new ApiError((data?.detail || data?.message) || `HTTP ${res.status}`, { status: res.status, data })
  return data
}

/** ---------------- Definitions ---------------- */
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

const FIELDS = ["buy", "sell"]
const FIELD_LABEL = { buy: "ทุนซื้อ", sell: "ทุนขาย" }
// 12 months × 2 fields = 24 focusable cells per row
const TOTAL_COLS = MONTHS.length * FIELDS.length

const COL_W = { product: 200, cell: 88 }
const TOTAL_W = COL_W.product + TOTAL_COLS * COL_W.cell + 2 * COL_W.cell

const STRIPE = {
  headEven: "bg-slate-100 dark:bg-slate-700",
  headOdd:  "bg-slate-200 dark:bg-slate-600",
  cellEven: "bg-white dark:bg-slate-900",
  cellOdd:  "bg-slate-50 dark:bg-slate-800",
  footEven: "bg-emerald-100 dark:bg-emerald-900",
  footOdd:  "bg-emerald-200 dark:bg-emerald-800",
}

const monthStripeHead = (mi) => (mi % 2 === 1 ? STRIPE.headOdd : STRIPE.headEven)
const monthStripeCell = (mi) => (mi % 2 === 1 ? STRIPE.cellOdd : STRIPE.cellEven)

const cellInput =
  "w-full min-w-0 box-border rounded-md border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

/** =======================================================================
 * ThonthunDetail — ประมาณการต้นทุนสินค้า (รายเดือน)
 * ======================================================================= */
function ThonthunDetail({ branchId, branchName, yearBE, planId }) {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [values, setValues] = useState({}) // { [productId]: { [monthKey]: { buy: "", sell: "" } } }

  const effectiveYear = useMemo(
    () => Number(yearBE || (planId ? Number(planId) + 2568 : 0) || 0),
    [yearBE, planId]
  )

  const loadData = useCallback(async () => {
    if (!effectiveYear) return
    setIsLoading(true)
    try {
      const branchParam = branchId ? `?branch_id=${branchId}` : ""
      const [productsData, pricesData] = await Promise.all([
        apiAuth("/lists/product/search").catch(() => []),
        apiAuth(`/unit-prices/monthly/${effectiveYear}${branchParam}`).catch(() => ({ items: [] })),
      ])

      const productList = (Array.isArray(productsData) ? productsData : productsData?.items || [])
        .map((p) => ({ id: p.product_id || p.id, name: p.product_type || p.product_name || p.name }))
        .filter((p) => p.id && p.name)

      setItems(productList)

      const loaded = {}
      for (const price of pricesData?.items || []) {
        const pid = String(price.product_id)
        const m = MONTHS.find((mo) => mo.month === price.month)
        if (!m) continue
        if (!loaded[pid]) loaded[pid] = {}
        loaded[pid][m.key] = {
          buy: price.buy_price != null ? String(toNumber(price.buy_price) || "") : "",
          sell: price.sell_price != null ? String(toNumber(price.sell_price) || "") : "",
        }
      }
      setValues(loaded)
    } catch (e) {
      console.error("ThonthunDetail loadData failed", e)
    } finally {
      setIsLoading(false)
    }
  }, [effectiveYear, branchId])

  useEffect(() => { loadData() }, [loadData])

  const setCell = useCallback((productId, monthKey, field, value) => {
    const pid = String(productId)
    setValues((prev) => ({
      ...prev,
      [pid]: {
        ...(prev[pid] || {}),
        [monthKey]: { ...(prev[pid]?.[monthKey] || { buy: "", sell: "" }), [field]: value },
      },
    }))
  }, [])

  /** ---------------- Summary (avg per product, avg per month) ---------------- */
  const sums = useMemo(() => {
    const perProduct = {}
    const perMonth = {} // { [monthKey]: { buySum, buyCount, sellSum, sellCount } }

    for (const m of MONTHS) {
      perMonth[m.key] = { buySum: 0, buyCount: 0, sellSum: 0, sellCount: 0 }
    }

    for (const it of items) {
      const pid = String(it.id)
      let buySum = 0, buyCount = 0, sellSum = 0, sellCount = 0
      for (const m of MONTHS) {
        const cell = values[pid]?.[m.key] || {}
        const b = toNumber(cell.buy), s = toNumber(cell.sell)
        if (b > 0) { buySum += b; buyCount++; perMonth[m.key].buySum += b; perMonth[m.key].buyCount++ }
        if (s > 0) { sellSum += s; sellCount++; perMonth[m.key].sellSum += s; perMonth[m.key].sellCount++ }
      }
      perProduct[pid] = {
        avgBuy: buyCount > 0 ? buySum / buyCount : 0,
        avgSell: sellCount > 0 ? sellSum / sellCount : 0,
      }
    }
    return { perProduct, perMonth }
  }, [items, values])

  /** ---------------- Dynamic height ---------------- */
  const tableWrapRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)
  useEffect(() => {
    const recalc = () => {
      const el = tableWrapRef.current
      if (!el) return
      setTableCardHeight(Math.max(400, Math.floor(window.innerHeight - el.getBoundingClientRect().top - 100)))
    }
    recalc()
    window.addEventListener("resize", recalc)
    return () => window.removeEventListener("resize", recalc)
  }, [])

  /** ---------------- Arrow navigation ---------------- */
  const inputRefs = useRef(new Map())
  const registerInput = useCallback((rIdx, cIdx) => (el) => {
    const key = `${rIdx}|${cIdx}`
    if (!el) inputRefs.current.delete(key)
    else inputRefs.current.set(key, el)
  }, [])

  const ensureInView = useCallback((el) => {
    const container = tableWrapRef.current
    if (!container || !el) return
    const pad = 20
    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()
    if (erect.left < crect.left + COL_W.product + pad)
      container.scrollLeft -= crect.left + COL_W.product + pad - erect.left
    else if (erect.right > crect.right - pad)
      container.scrollLeft += erect.right - (crect.right - pad)
    if (erect.top < crect.top + pad)
      container.scrollTop -= crect.top + pad - erect.top
    else if (erect.bottom > crect.bottom - pad)
      container.scrollTop += erect.bottom - (crect.bottom - pad)
  }, [])

  const handleArrowNav = useCallback((e) => {
    const k = e.key
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(k)) return

    const rIdx = Number(e.currentTarget.dataset.row ?? 0)
    const cIdx = Number(e.currentTarget.dataset.col ?? 0)
    let nextR = rIdx, nextC = cIdx

    if (k === "ArrowLeft") {
      if (cIdx === 0 && rIdx > 0) { nextR = rIdx - 1; nextC = TOTAL_COLS - 1 }
      else nextC = Math.max(0, cIdx - 1)
    } else if (k === "ArrowRight" || k === "Enter") {
      if (cIdx === TOTAL_COLS - 1) { if (rIdx < items.length - 1) { nextR = rIdx + 1; nextC = 0 } }
      else nextC = cIdx + 1
    } else if (k === "ArrowUp") {
      nextR = Math.max(0, rIdx - 1)
    } else if (k === "ArrowDown") {
      nextR = Math.min(items.length - 1, rIdx + 1)
    }

    const target = inputRefs.current.get(`${nextR}|${nextC}`)
    if (target) {
      e.preventDefault()
      target.focus()
      try { target.select() } catch {}
      requestAnimationFrame(() => ensureInView(target))
    }
  }, [items.length, ensureInView])

  /** ---------------- Save ---------------- */
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const saveToBE = useCallback(async (overrideValues) => {
    if (!effectiveYear) return
    setIsSaving(true); setSaveMsg(null)
    try {
      const src = overrideValues ?? values
      const payloadItems = []
      for (const it of items) {
        const pid = String(it.id)
        for (const m of MONTHS) {
          const cell = src[pid]?.[m.key] || {}
          payloadItems.push({
            product_id: Number(pid),
            month: m.month,
            buy_price: toNumber(cell.buy),
            sell_price: toNumber(cell.sell),
          })
        }
      }
      const res = await apiAuth("/unit-prices/bulk-monthly", {
        method: "PUT",
        body: { year: effectiveYear, branch_id: branchId ? Number(branchId) : null, items: payloadItems },
      })
      setSaveMsg({ ok: true, title: "บันทึกสำเร็จ", detail: `บันทึก ${res?.saved_count ?? payloadItems.length} รายการ` })
    } catch (e) {
      setSaveMsg({ ok: false, title: "บันทึกไม่สำเร็จ", detail: e.message || String(e) })
    } finally {
      setIsSaving(false)
    }
  }, [effectiveYear, branchId, items, values])

  const resetAll = useCallback(async () => {
    if (!confirm("รีเซ็ตข้อมูลทั้งหมดในตารางและบันทึกค่าว่าง (0) ลงระบบ?")) return
    const empty = {}
    for (const it of items) {
      empty[String(it.id)] = {}
      for (const m of MONTHS) empty[String(it.id)][m.key] = { buy: "", sell: "" }
    }
    setValues(empty)
    if (items.length && effectiveYear) await saveToBE(empty)
  }, [items, effectiveYear, saveToBE])

  /** ---------------- Styles ---------------- */
  const stickyShadow = "shadow-[0_0_0_1px_rgba(148,163,184,0.6)] dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]"
  const headCell = "px-1.5 py-1.5 text-[12px] font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-600"
  const leftHeadCell = cx(headCell, "sticky left-0 z-20", stickyShadow)
  const leftBodyCell = "px-1.5 py-1.5 text-[12px] border-r border-slate-200 dark:border-slate-700 sticky left-0 z-10"
  const cellClass = "px-1 py-1 text-[12px] border-r border-slate-200 dark:border-slate-700"
  const footerBorder = "border-t-[2px] border-t-emerald-500 dark:border-t-emerald-600"

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูล...</div>
  }

  return (
    <>
      <div className="w-full">
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div
            className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700"
            ref={tableWrapRef}
            style={{ maxHeight: tableCardHeight }}
          >
            <table className="min-w-full border-collapse" style={{ width: TOTAL_W }}>
              <colgroup>
                <col style={{ width: COL_W.product }} />
                {MONTHS.flatMap((m) =>
                  FIELDS.map((f) => <col key={`${m.key}-${f}`} style={{ width: COL_W.cell }} />)
                )}
                <col style={{ width: COL_W.cell }} />
                <col style={{ width: COL_W.cell }} />
              </colgroup>

              <thead className="sticky top-0 z-30">
                {/* Row 1: product label + month group headers + summary */}
                <tr>
                  <th
                    rowSpan={2}
                    className={cx(leftHeadCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")}
                  >
                    รายการสินค้า
                  </th>
                  {MONTHS.map((m, mi) => (
                    <th
                      key={m.key}
                      colSpan={2}
                      className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 text-center")}
                    >
                      {m.label}
                    </th>
                  ))}
                  <th
                    colSpan={2}
                    className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600 align-middle text-center")}
                  >
                    เฉลี่ยทั้งปี
                  </th>
                </tr>
                {/* Row 2: buy/sell sub-headers per month + summary sub-headers */}
                <tr>
                  {MONTHS.flatMap((m, mi) =>
                    FIELDS.map((f) => (
                      <th
                        key={`${m.key}-${f}`}
                        className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 font-medium text-slate-700 dark:text-slate-200 text-center")}
                      >
                        {FIELD_LABEL[f]}
                      </th>
                    ))
                  )}
                  <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600 font-medium text-center")}>
                    {FIELD_LABEL.buy}
                  </th>
                  <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600 font-medium text-center")}>
                    {FIELD_LABEL.sell}
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((it, rIdx) => {
                  const pid = String(it.id)
                  const stripeCls = rIdx % 2 === 0 ? STRIPE.cellEven : STRIPE.cellOdd
                  return (
                    <tr key={pid}>
                      <td className={cx(leftBodyCell, stripeCls, stickyShadow)}>
                        <div className="font-semibold truncate">{it.name}</div>
                      </td>
                      {MONTHS.flatMap((m, mi) =>
                        FIELDS.map((f, fi) => {
                          const cIdx = mi * 2 + fi
                          const val = values[pid]?.[m.key]?.[f] ?? ""
                          return (
                            <td key={`${m.key}-${f}`} className={cx(cellClass, monthStripeCell(mi))}>
                              <input
                                ref={registerInput(rIdx, cIdx)}
                                data-row={rIdx}
                                data-col={cIdx}
                                onKeyDown={handleArrowNav}
                                className={cellInput}
                                placeholder="0.000"
                                value={val}
                                onChange={(e) =>
                                  setCell(it.id, m.key, f, sanitizeNumberInput(e.target.value))
                                }
                              />
                            </td>
                          )
                        })
                      )}
                      <td className={cx(cellClass, STRIPE.footEven, "text-right font-semibold text-slate-700 dark:text-slate-200 px-2")}>
                        {sums.perProduct[pid]?.avgBuy > 0 ? fmtMoney(sums.perProduct[pid].avgBuy) : "-"}
                      </td>
                      <td className={cx(cellClass, STRIPE.footEven, "text-right font-bold text-emerald-700 dark:text-emerald-400 px-2")}>
                        {sums.perProduct[pid]?.avgSell > 0 ? fmtMoney(sums.perProduct[pid].avgSell) : "-"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              <tfoot className="sticky bottom-[28px] z-20">
                <tr>
                  <td className={cx(leftBodyCell, STRIPE.footOdd, stickyShadow, footerBorder)}>
                    <div className="font-bold text-center text-[13px]">เฉลี่ย</div>
                  </td>
                  {MONTHS.flatMap((m, mi) =>
                    FIELDS.map((f) => {
                      const s = sums.perMonth[m.key]
                      const avg = f === "buy"
                        ? (s.buyCount > 0 ? s.buySum / s.buyCount : 0)
                        : (s.sellCount > 0 ? s.sellSum / s.sellCount : 0)
                      return (
                        <td
                          key={`${m.key}-${f}`}
                          className={cx(cellClass, monthStripeHead(mi), footerBorder, "text-right font-semibold text-slate-800 dark:text-slate-200 px-2")}
                        >
                          {avg > 0 ? fmtMoney(avg) : "-"}
                        </td>
                      )
                    })
                  )}
                  <td className={cx(cellClass, STRIPE.footOdd, footerBorder)} />
                  <td className={cx(cellClass, STRIPE.footOdd, footerBorder)} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="shrink-0 pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
            {saveMsg && (
              <div
                className={cx(
                  "mb-3 rounded-xl border p-3 text-[13px]",
                  saveMsg.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                    : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200"
                )}
              >
                <div className="font-bold">{saveMsg.title}</div>
                <div className="mt-0.5 opacity-90">{saveMsg.detail}</div>
              </div>
            )}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
              <button
                type="button"
                onClick={resetAll}
                disabled={isSaving || !items.length}
                className={cx(
                  "inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold transition",
                  isSaving || !items.length
                    ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
                )}
              >
                รีเซ็ต
              </button>
              <button
                type="button"
                onClick={() => saveToBE()}
                disabled={isSaving || !effectiveYear}
                className={cx(
                  "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white transition",
                  isSaving || !effectiveYear
                    ? "bg-slate-300 text-slate-700 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:scale-[1.03] active:scale-[.98] cursor-pointer"
                )}
              >
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <StickyTableScrollbar tableRef={tableWrapRef} />
    </>
  )
}

export default ThonthunDetail
