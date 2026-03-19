import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"

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
const fmtMoney0 = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))
const fmtDec3Str = (v) => {
  const n = toNumber(v)
  if (!Number.isFinite(n)) return "0.000"
  return n.toFixed(3)
}

/** ---------------- API (token = localStorage.token) ---------------- */
const API_BASE_RAW =
  import.meta.env.VITE_API_BASE_CUSTOM ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
const API_BASE = String(API_BASE_RAW || "").replace(/\/+$/, "")

class ApiError extends Error {
  constructor(message, meta = {}) {
    super(message)
    this.name = "ApiError"
    Object.assign(this, meta)
  }
}

const getToken = () => localStorage.getItem("token") || ""

async function apiAuth(path, { method = "GET", body, auth = true } = {}) {
    if (!API_BASE) throw new ApiError("FE: ยังไม่ได้ตั้ง API Base (VITE_API_BASE...)", { status: 0 })
    const token = getToken()
    const url = `${API_BASE}${path}`
  
    let res
    try {
      res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body != null ? JSON.stringify(body) : undefined,
        credentials: "omit",
      })
    } catch (e) {
      throw new ApiError("FE: เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", { status: 0, cause: e })
    }
  
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
  
    if (!res.ok) {
      const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`
      throw new ApiError(msg, { status: res.status, data })
    }
    return data
}

/** ---------------- UI styles & constants ---------------- */
const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-md border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const trunc = "whitespace-nowrap overflow-hidden text-ellipsis"

const MONTHS = [
    { key: "m04", label: "เม.ย.", month: 4 }, { key: "m05", label: "พ.ค.", month: 5 },
    { key: "m06", label: "มิ.ย.", month: 6 }, { key: "m07", label: "ก.ค.", month: 7 },
    { key: "m08", label: "ส.ค.", month: 8 }, { key: "m09", label: "ก.ย.", month: 9 },
    { key: "m10", label: "ต.ค.", month: 10 }, { key: "m11", label: "พ.ย.", month: 11 },
    { key: "m12", label: "ธ.ค.", month: 12 }, { key: "m01", label: "ม.ค.", month: 1 },
    { key: "m02", label: "ก.พ.", month: 2 }, { key: "m03", label: "มี.ค.", month: 3 },
]

const COL_W = { id: 80, item: 300, cell: 90 }
const LEFT_W = COL_W.id + COL_W.item
const RIGHT_W = MONTHS.length * (COL_W.cell * 2)
const TOTAL_W = LEFT_W + RIGHT_W

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

const ThonthunDetail = ({ yearBE, planId }) => {
    const effectiveYear = useMemo(() => {
        const y = Number(yearBE || 0)
        if (Number.isFinite(y) && y >= 2500) return y
        const p = Number(planId || 0)
        return Number.isFinite(p) && p > 0 ? p + 2568 : 2569
    }, [yearBE, planId])

    const periodLabel = useMemo(() => `ปีงบประมาณ ${effectiveYear}`, [effectiveYear])

    const [items, setItems] = useState([])
    const [isLoadingItems, setIsLoadingItems] = useState(false)
    
    useEffect(() => {
        let alive = true
        setIsLoadingItems(true)
        apiAuth("/lists/product/search", { auth: false })
            .then(data => {
                if (!alive) return
                const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
                const normalized = arr
                    .map(r => ({ id: Number(r?.id ?? 0), name: String(r?.product_name || r?.name || "").trim() }))
                    .filter(x => x.id > 0 && x.name)
                    .sort((a, b) => a.id - b.id)
                setItems(normalized)
            })
            .catch(e => console.error("Failed to load products", e))
            .finally(() => alive && setIsLoadingItems(false))
        return () => { alive = false }
    }, [])

    const [valuesById, setValuesById] = useState({})
    const [isLoadingSaved, setIsLoadingSaved] = useState(false)

    const normalizeGrid = useCallback((seed = {}) => {
        const next = {}
        for (const it of items) {
            const pid = it.id
            next[pid] = {}
            for (const m of MONTHS) {
                const s = seed[pid]?.[m.key] || {}
                next[pid][m.key] = {
                    buy: s.buy ?? s.buy_price ?? "",
                    sell: s.sell ?? s.sell_price ?? "",
                }
            }
        }
        return next
    }, [items])

    const loadSavedFromBE = useCallback(async () => {
        if (!effectiveYear || !items.length) return
        setIsLoadingSaved(true)
        try {
            const data = await apiAuth(`/unit-prices/monthly/${effectiveYear}`, { auth: false })
            const monthlyPrices = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
            const seed = {}
            for (const price of monthlyPrices) {
                const pid = Number(price.product_id || 0)
                const monthNum = Number(price.month || 0)
                const month = MONTHS.find(m => m.month === monthNum)
                if (!pid || !month) continue
                if (!seed[pid]) seed[pid] = {}
                seed[pid][month.key] = {
                    buy: price.buy_price ?? "",
                    sell: price.sell_price ?? "",
                }
            }
            setValuesById(normalizeGrid(seed))
        } catch (e) {
            console.error("[ThonthunDetail] load saved failed:", e)
            setValuesById(normalizeGrid({}))
        } finally {
            setIsLoadingSaved(false)
        }
    }, [effectiveYear, items, normalizeGrid])

    useEffect(() => {
        if (items.length > 0) loadSavedFromBE()
    }, [items, loadSavedFromBE])

    const setCell = (productId, monthKey, field, nextValue) => {
        setValuesById(prev => {
            const next = { ...prev }
            if (!next[productId]) next[productId] = {}
            if (!next[productId][monthKey]) next[productId][monthKey] = { buy: "", sell: "" }
            next[productId][monthKey] = { ...next[productId][monthKey], [field]: nextValue }
            return next
        })
    }

    const [saveNotice, setSaveNotice] = useState(null)
    const [isSaving, setIsSaving] = useState(false)

    const saveToBE = async () => {
        setIsSaving(true)
        setSaveNotice(null)
        try {
            if (!items.length) throw new Error("ยังไม่มีรายการสินค้า")
            
            const payloadItems = []
            for(const pid of Object.keys(valuesById)) {
                for(const m of MONTHS) {
                    const values = valuesById[pid]?.[m.key]
                    if (values && (values.buy || values.sell)) {
                        payloadItems.push({
                            product_id: Number(pid),
                            month: m.month,
                            buy_price: fmtDec3Str(values.buy),
                            sell_price: fmtDec3Str(values.sell),
                        })
                    }
                }
            }
            
            const payload = { year: effectiveYear, items: payloadItems }
            const res = await apiAuth(`/unit-prices/bulk-monthly`, { method: "PUT", body: payload, auth: true })

            setSaveNotice({ type: "success", title: "บันทึกสำเร็จ ✅", detail: `ปี ${effectiveYear}, บันทึก ${res?.saved_count ?? payloadItems.length} รายการ` })
            await loadSavedFromBE()
        } catch (e) {
            setSaveNotice({ type: "error", title: "บันทึกไม่สำเร็จ ❌", detail: e.message || String(e) })
            console.error("[ThonthunDetail] Save failed:", e)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="text-lg font-bold">ประมาณการต้นทุนสินค้า (ต้นทุนซื้อ/ต้นทุนการขาย) - รายเดือน</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {periodLabel} {isLoadingItems && "• โหลดรายการ..."} {isLoadingSaved && "• โหลดข้อมูลที่บันทึก..."}
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
                        <colgroup>
                            <col style={{ width: COL_W.id }} />
                            <col style={{ width: COL_W.item }} />
                            {MONTHS.map(m => <Fragment key={m.key}><col style={{ width: COL_W.cell }} /><col style={{ width: COL_W.cell }} /></Fragment>)}
                        </colgroup>
                        <thead className="sticky top-0 z-20">
                            <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                                <th rowSpan={2} className="border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600 sticky left-0 z-10 bg-slate-100 dark:bg-slate-700">รหัส</th>
                                <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-left font-bold text-xs dark:border-slate-600 sticky left-[80px] z-10 bg-slate-100 dark:bg-slate-700">รายการ</th>
                                {MONTHS.map(m => (
                                    <th key={m.key} colSpan={2} className="border border-slate-300 px-1 py-2 text-center text-xs font-semibold dark:border-slate-600">{m.label}</th>
                                ))}
                            </tr>
                            <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                                {MONTHS.map(m => (
                                    <Fragment key={m.key}>
                                        <th className="border border-slate-300 px-1 py-1 text-center text-[11px] font-medium dark:border-slate-600">ต้นทุนซื้อ</th>
                                        <th className="border border-slate-300 px-1 py-1 text-center text-[11px] font-medium dark:border-slate-600">ต้นทุนขาย</th>
                                    </Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it, rIdx) => {
                                const rowBg = rIdx % 2 === 1 ? STRIPE.alt : STRIPE.cell
                                return (
                                    <tr key={it.id} className={rowBg}>
                                        <td className={cx("border border-slate-300 px-1 py-2 text-center text-xs dark:border-slate-600 sticky left-0 z-10", rowBg)}>{it.id}</td>
                                        <td className={cx("border border-slate-300 px-2 py-2 text-left font-semibold text-xs dark:border-slate-600 sticky left-[80px] z-10", rowBg, trunc)} title={it.name}>{it.name}</td>
                                        {MONTHS.map(m => (
                                            <Fragment key={`${it.id}-${m.key}`}>
                                                <td className="border border-slate-300 px-1 py-1 dark:border-slate-600">
                                                    <input
                                                        className={cellInput}
                                                        value={valuesById[it.id]?.[m.key]?.buy ?? ""}
                                                        onChange={e => setCell(it.id, m.key, 'buy', sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))}
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="border border-slate-300 px-1 py-1 dark:border-slate-600">
                                                    <input
                                                        className={cellInput}
                                                        value={valuesById[it.id]?.[m.key]?.sell ?? ""}
                                                        onChange={e => setCell(it.id, m.key, 'sell', sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))}
                                                        placeholder="0"
                                                    />
                                                </td>
                                            </Fragment>
                                        ))}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
                    {saveNotice && (
                         <div className={cx("mb-3 rounded-2xl border p-3 text-sm", saveNotice.type === 'error' ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
                            <div className="font-extrabold">{saveNotice.title}</div>
                            {saveNotice.detail && <div className="mt-1 text-[13px] opacity-95">{saveNotice.detail}</div>}
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button
                        type="button"
                        disabled={isSaving}
                        onClick={saveToBE}
                        className={cx(
                            "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white",
                            "shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 hover:scale-[1.03] active:scale-[.98] transition",
                            isSaving && "opacity-60 hover:scale-100 cursor-not-allowed"
                        )}
                        >
                        {isSaving ? "กำลังบันทึก..." : "บันทึกลงระบบ"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ThonthunDetail
