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
  const intPart = parts[0] ?? ""
  if (parts.length <= 1) return intPart
  const decRaw = parts.slice(1).join("")
  const dec = decRaw.slice(0, Math.max(0, maxDecimals))
  if (maxDecimals <= 0) return intPart
  return `${intPart}.${dec}`
}
const fmtMoney = (n) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(n))

/** ---------------- API ---------------- */
const API_BASE_RAW = import.meta.env.VITE_API_BASE_CUSTOM || import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || ""
const API_BASE = String(API_BASE_RAW || "").replace(/\/+$/, "")

class ApiError extends Error {
  constructor(message, meta = {}) {
    super(message)
    this.name = "ApiError"; Object.assign(this, meta)
  }
}

const getToken = () => localStorage.getItem("token") || ""

async function apiAuth(path, { method = "GET", body } = {}) {
  if (!API_BASE) throw new ApiError("FE: VITE_API_BASE not set", { status: 0 })
  const token = getToken()
  const url = `${API_BASE}${path}`

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  }).catch(e => { throw new ApiError("FE: Network/CORS/DNS failure", { status: 0, cause: e }) })

  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch {}

  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`
    throw new ApiError(msg, { status: res.status, data })
  }
  return data
}

/** ---------------- Definitions ---------------- */
const MONTHS = [
  { key: "m04", label: "เม.ย.", month: 4 }, { key: "m05", label: "พ.ค.", month: 5 },
  { key: "m06", label: "มิ.ย.", month: 6 }, { key: "m07", label: "ก.ค.", month: 7 },
  { key: "m08", label: "ส.ค.", month: 8 }, { key: "m09", label: "ก.ย.", month: 9 },
  { key: "m10", label: "ต.ค.", month: 10 }, { key: "m11", label: "พ.ย.", month: 11 },
  { key: "m12", label: "ธ.ค.", month: 12 }, { key: "m01", label: "ม.ค.", month: 1 },
  { key: "m02", label: "ก.พ.", month: 2 }, { key: "m03", label: "มี.ค.", month: 3 },
]

const ThonthunDetail = ({ branchName, yearBE, planId }) => {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [values, setValues] = useState({}) // { [productId]: { [monthKey]: { buy: "", sell: "" } } }
  
  const effectiveYear = useMemo(() => Number(yearBE || (planId ? planId + 2568 : 0) || 0), [yearBE, planId])
  const periodLabel = useMemo(() => `1 เม.ย.${String(effectiveYear).slice(-2)}-31 มี.ค.${String(effectiveYear + 1).slice(-2)}`, [effectiveYear])

  const loadData = useCallback(async () => {
    if (!effectiveYear) return
    setIsLoading(true)
    try {
      const [productsData, pricesData] = await Promise.all([
        apiAuth("/lists/product/search", { auth: false }).catch(() => []),
        apiAuth(`/unit-prices/monthly/${effectiveYear}`, { auth: true }).catch(() => ({ items: [] })) // Assume new endpoint
      ])

      const productList = (Array.isArray(productsData) ? productsData : productsData?.items || [])
        .map(p => ({ id: p.product_id || p.id, name: p.product_name || p.name }))
        .filter(p => p.id && p.name)
      
      setItems(productList)

      const loadedValues = {}
      const priceItems = pricesData?.items || []
      for(const price of priceItems) {
        const pId = price.product_id
        const month = MONTHS.find(m => m.month === price.month)
        if(!pId || !month) continue
        if(!loadedValues[pId]) loadedValues[pId] = {}
        loadedValues[pId][month.key] = {
          buy: String(price.buy_price || ""),
          sell: String(price.sell_price || ""),
        }
      }
      setValues(loadedValues)

    } catch (e) {
      console.error("Failed to fetch initial data", e)
      setItems([])
      setValues({})
    } finally {
      setIsLoading(false)
    }
  }, [effectiveYear])

  useEffect(() => {
    loadData()
  }, [loadData])

  const setCell = (productId, monthKey, field, value) => {
    setValues(prev => {
      const next = {...prev}
      if(!next[productId]) next[productId] = {}
      if(!next[productId][monthKey]) next[productId][monthKey] = { buy: "", sell: "" }
      next[productId][monthKey][field] = value
      return next
    })
  }

  const tableScrollRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)
  useEffect(() => {
    const recalc = () => {
      const el = tableScrollRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setTableCardHeight(Math.max(400, Math.floor(window.innerHeight - rect.top - 100)))
    }
    recalc()
    window.addEventListener("resize", recalc)
    return () => window.removeEventListener("resize", recalc)
  }, [])

  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const saveToBE = async () => {
    setIsSaving(true); setNotice(null)
    try {
      const payloadItems = []
      for (const pId of Object.keys(values)) {
        for (const mKey of Object.keys(values[pId])) {
          const month = MONTHS.find(m => m.key === mKey)
          if (!month) continue
          
          const buyPrice = toNumber(values[pId][mKey].buy)
          const sellPrice = toNumber(values[pId][mKey].sell)

          if(buyPrice > 0 || sellPrice > 0) {
            payloadItems.push({
              product_id: Number(pId),
              month: month.month,
              buy_price: buyPrice,
              sell_price: sellPrice,
            })
          }
        }
      }

      const res = await apiAuth(`/unit-prices/bulk-monthly`, {
        method: "PUT",
        body: { year: effectiveYear, items: payloadItems },
      })
      setNotice({ type: "success", title: "บันทึกสำเร็จ ✅", detail: `บันทึก ${res?.saved_count ?? payloadItems.length} รายการ` })
    } catch (e) {
      setNotice({ type: "error", title: "บันทึกไม่สำเร็จ ❌", detail: e.message || String(e) })
    } finally {
      setIsSaving(false)
    }
  }
  
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col">
        <div className="overflow-auto" ref={tableScrollRef} style={{ maxHeight: tableCardHeight }}>
          <table className="border-collapse text-sm w-full">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-100 dark:bg-slate-700">
                <th rowSpan={2} className="p-2 border sticky left-0 z-10 bg-slate-100 dark:bg-slate-700">รายการสินค้า</th>
                {MONTHS.map(m => (
                    <th key={m.key} colSpan={2} className="p-2 border">{m.label}</th>
                ))}
              </tr>
              <tr className="bg-slate-100 dark:bg-slate-700">
                {MONTHS.flatMap(m => [
                    <th key={`${m.key}-buy`} className="p-1 border text-xs font-normal">ทุนซื้อ</th>,
                    <th key={`${m.key}-sell`} className="p-1 border text-xs font-normal">ทุนขาย</th>
                ])}
              </tr>
            </thead>
            <tbody>
              {items.map((it, rIdx) => (
                <tr key={it.id} className={rIdx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-700/30"}>
                  <td className="border border-slate-300 px-2 py-2 sticky left-0 bg-inherit z-10 font-semibold text-xs dark:border-slate-600">{it.name}</td>
                  {MONTHS.flatMap(m => {
                    const buyVal = values[it.id]?.[m.key]?.buy ?? ""
                    const sellVal = values[it.id]?.[m.key]?.sell ?? ""
                    return [
                      <td key={`${m.key}-buy`} className="border border-slate-300 px-1 py-1 dark:border-slate-600">
                         <input
                            type="text"
                            className="w-full min-w-0 box-border rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-right text-[12px] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            placeholder="0.00"
                            value={buyVal}
                            onChange={e => setCell(it.id, m.key, 'buy', sanitizeNumberInput(e.target.value))}
                         />
                      </td>,
                      <td key={`${m.key}-sell`} className="border border-slate-300 px-1 py-1 dark:border-slate-600">
                         <input
                            type="text"
                            className="w-full min-w-0 box-border rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-right text-[12px] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            placeholder="0.00"
                            value={sellVal}
                            onChange={e => setCell(it.id, m.key, 'sell', sanitizeNumberInput(e.target.value))}
                         />
                      </td>
                    ]
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
            {notice && (
              <div className={cx("mb-3 rounded-2xl border p-3 text-sm", notice.type === 'error' ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200")}>
                <div className="font-extrabold">{notice.title}</div>
                {notice.detail && <div className="mt-1 text-[13px] opacity-95 whitespace-pre-wrap">{notice.detail}</div>}
              </div>
            )}
            <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={loadData}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
                >
                  รีเซ็ต
                </button>
                <button
                  type="button"
                  onClick={saveToBE}
                  disabled={isSaving}
                  className={cx(
                    "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white",
                    "shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 hover:scale-[1.03] active:scale-[.98] transition",
                    isSaving && "opacity-60 hover:scale-100 cursor-not-allowed"
                  )}
                >
                  {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
            </div>
        </div>
      </div>
      <StickyTableScrollbar tableRef={tableScrollRef} />
    </div>
  )
}

export default ThonthunDetail