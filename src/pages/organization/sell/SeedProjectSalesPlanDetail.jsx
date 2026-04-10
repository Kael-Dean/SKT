import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import { useSidebarOpen } from "../../../components/AppLayout"

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
const fmtMoney = (n) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(n))

/** ---------------- API ---------------- */
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

const getToken = () => {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("auth_token") ||
    ""
  return String(raw || "").trim()
}
const buildAuthHeader = (tokenRaw) => {
  const t = String(tokenRaw || "").trim()
  if (!t) return {}
  if (t.toLowerCase().startsWith("bearer ")) return { Authorization: t }
  const cleaned = t.replace(/^bearer\s+/i, "").trim()
  return { Authorization: `Bearer ${cleaned}` }
}

async function apiAuth(path, { method = "GET", body } = {}) {
  if (!API_BASE) throw new ApiError("FE: ยังไม่ได้ตั้ง API Base (VITE_API_BASE...)", { status: 0 })
  const token = getToken()
  const url = `${API_BASE}${path}`

  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeader(token),
      },
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: "include",
    })
  } catch (e) {
    throw new ApiError("FE: เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (Network/CORS/DNS)", {
      status: 0,
      url,
      method,
      cause: e,
    })
  }

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      (typeof data === "string" && data) ||
      `HTTP ${res.status}`
    throw new ApiError(msg, { status: res.status, url, method, data })
  }
  return data
}

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

const PLACEHOLDER_UNITS = [{ id: -1, name: "ปร", short: "ปร" }]
const SEED_GROUP_ID = 5

/** ---------------- Styles ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-md border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const COL_W = {
  product: 200,
  unit: 64,
  price: 90,
  cell: 100, 
}
const LEFT_W = COL_W.product + COL_W.unit + COL_W.price

const STRIPE = {
  headEven: "bg-slate-100 dark:bg-slate-700",
  headOdd: "bg-slate-200 dark:bg-slate-600",
  cellEven: "bg-white dark:bg-slate-900",
  cellOdd: "bg-slate-50 dark:bg-slate-800",
  footEven: "bg-emerald-100 dark:bg-emerald-900",
  footOdd: "bg-emerald-200 dark:bg-emerald-800",
}

const monthStripeHead = (idx) => (idx % 2 === 1 ? STRIPE.headOdd : STRIPE.headEven)
const monthStripeCell = (idx) => (idx % 2 === 1 ? STRIPE.cellOdd : STRIPE.cellEven)

/** ---------------- helpers ---------------- */
const normalizeUnitName = (name) => String(name ?? "").trim().replace(/\s+/g, " ")
const shortUnit = (name, idx) => {
  const s = normalizeUnitName(name)
  if (!s) return `หน่วย${idx + 1}`
  return s.length <= 4 ? s : s.slice(0, 4)
}

function buildEmptyQtyGrid(productIds, unitList) {
  const out = {}
  for (const pid of productIds) {
    out[pid] = {}
    for (const m of MONTHS) {
      out[pid][m.key] = {}
      for (const u of unitList) {
        out[pid][m.key][String(u.id)] = ""
      }
    }
  }
  return out
}

/** =======================================================================
 * SeedProjectSalesPlanDetail
 * ======================================================================= */
const SeedProjectSalesPlanDetail = ({ branchId, branchName, yearBE, onYearBEChange }) => {

  const planId = useMemo(() => {
    const y = Number(yearBE || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [yearBE])

  const periodLabel = "เม.ย.–มี.ค."
  const effectiveYearBE = Number(yearBE || 0)

  /** ---------------- Units ---------------- */
  const [units, setUnits] = useState(PLACEHOLDER_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  const loadUnits = useCallback(async () => {
    if (!branchId) {
      setUnits(PLACEHOLDER_UNITS)
      return
    }
    setIsLoadingUnits(true)
    try {
      const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
      const rows = Array.isArray(data) ? data : []
      const normalized = rows
        .map((r, idx) => {
          const name = String(r.klang_name || r.unit_name || r.unit || r.name || "").trim()
          return { id: Number(r.id || 0), name: normalizeUnitName(name), short: shortUnit(name, idx) }
        })
        .filter((x) => x.id > 0)
      setUnits(normalized.length ? normalized : PLACEHOLDER_UNITS)
    } catch (e) {
      console.error("[seed] load units failed:", e)
      setUnits(PLACEHOLDER_UNITS)
    } finally {
      setIsLoadingUnits(false)
    }
  }, [branchId])

  useEffect(() => { loadUnits() }, [loadUnits])

  const savableUnits = useMemo(() => (units || []).filter((u) => Number(u?.id) > 0), [units])
  const unitCols = useMemo(() => {
    const list = (units || []).slice()
    if (!list.length) return PLACEHOLDER_UNITS
    return list.map((u, idx) => ({ ...u, short: u.short || shortUnit(u.name || "", idx) }))
  }, [units])

  /** ---------------- Products list & Prices ---------------- */
  const [products, setProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [priceByPid, setPriceByPid] = useState({})
  const [qtyByPid, setQtyByPid] = useState({})

  const [unitPriceMap, setUnitPriceMap] = useState({})

  const loadUnitPricesForYear = useCallback(async () => {
    const y = Number(yearBE || 0)
    if (!Number.isFinite(y) || y <= 0) {
      setUnitPriceMap({})
      return
    }
    try {
      const data = await apiAuth(`/unit-prices/${y}`)
      const items = Array.isArray(data?.items) ? data.items : []
      const map = {}
      for (const it of items) {
        const pid = Number(it.product_id || it.product || 0)
        if (!pid) continue
        map[String(pid)] = { sell_price: String(it.sell_price ?? ""), buy_price: String(it.buy_price ?? ""), comment: String(it.comment ?? "") }
      }
      setUnitPriceMap(map)
    } catch {
      setUnitPriceMap({})
    }
  }, [yearBE])

  useEffect(() => { loadUnitPricesForYear() }, [loadUnitPricesForYear])

  const loadProducts = useCallback(async () => {
    if (!planId || planId <= 0) { setProducts([]); return }
    setIsLoadingProducts(true)
    try {
      const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${planId}`)
      const g = data?.[String(SEED_GROUP_ID)] || data?.[SEED_GROUP_ID]
      const items = Array.isArray(g?.items) ? g.items : []
      const normalized = items
        .filter((x) => Number(x.business_group) === SEED_GROUP_ID)
        .map((x) => {
          const pid = Number(x.product_id || 0)
          const fallback = unitPriceMap[String(pid)] || null
          const sellMerged = (x.sell_price === null || x.sell_price === undefined || Number(x.sell_price) === 0) && fallback ? fallback.sell_price : (x.sell_price ?? 0)
          
          return {
            product_id: pid,
            name: String(x.product_type || x.name || "").trim(),
            unit: x.unit || "ตัน",
            sell_price: sellMerged,
            buy_price: x.buy_price ?? 0,
            comment: (x.comment ?? "") || (fallback?.comment ?? ""),
          }
        }).filter((x) => x.product_id > 0)

      setProducts(normalized)
      
      const pMap = {}
      for (const it of normalized) {
        pMap[String(it.product_id)] = { sell_price: String(it.sell_price ?? ""), buy_price: String(it.buy_price ?? ""), comment: String(it.comment ?? "") }
      }
      setPriceByPid(pMap)
      
      setQtyByPid((prev) => {
        const next = { ...prev }
        const empty = buildEmptyQtyGrid(normalized.map((x) => String(x.product_id)), unitCols)
        for (const pid of Object.keys(empty)) {
          if (!next[pid]) next[pid] = empty[pid]
          else {
            for (const m of MONTHS) {
              if (!next[pid][m.key]) next[pid][m.key] = {}
              for (const u of unitCols) {
                const uk = String(u.id)
                if (next[pid][m.key][uk] === undefined) next[pid][m.key][uk] = ""
              }
            }
          }
        }
        return next
      })
    } catch (e) {
      console.error(e)
      setProducts([])
    } finally {
      setIsLoadingProducts(false)
    }
  }, [planId, unitCols, unitPriceMap])

  useEffect(() => { loadProducts() }, [loadProducts])

  /** ---------------- Load saved sale-goals ---------------- */
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const loadSavedFromBE = useCallback(async () => {
    if (!branchId || !planId || planId <= 0 || !products.length) return
    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/revenue/sale-goals?plan_id=${Number(planId)}&branch_id=${Number(branchId)}`)
      const cells = Array.isArray(data?.cells) ? data.cells : (Array.isArray(data) ? data : [])
      const empty = buildEmptyQtyGrid(products.map((p) => String(p.product_id)), unitCols)
      for (const c of cells) {
        const pid = Number(c.product_id || 0), uid = Number(c.unit_id || 0), mo = Number(c.month || 0), amt = c.amount ?? 0
        const monthObj = MONTHS.find((m) => Number(m.month) === mo)
        if (monthObj && empty[String(pid)]) {
          empty[String(pid)][monthObj.key][String(uid)] = String(Number(amt || 0))
        }
      }
      setQtyByPid(empty)
    } catch {
    } finally {
      setIsLoadingSaved(false)
    }
  }, [branchId, planId, products, unitCols])

  useEffect(() => { loadSavedFromBE() }, [loadSavedFromBE])

  const canEdit = !!branchId && !!planId && planId > 0 && !!savableUnits.length

  const setPriceField = useCallback((pid, field, value) => {
    setPriceByPid((prev) => ({ ...prev, [String(pid)]: { ...(prev[String(pid)] || {}), [field]: value } }))
  }, [])

  const setQtyField = useCallback((pid, mKey, uKey, value) => {
    setQtyByPid((prev) => {
      const pKey = String(pid)
      return {
        ...prev,
        [pKey]: {
          ...(prev[pKey] || {}),
          [mKey]: { ...(prev?.[pKey]?.[mKey] || {}), [uKey]: value }
        }
      }
    })
  }, [])

  /** ---------------- Computed ---------------- */
  const sums = useMemo(() => {
    const perMonth = {} 
    const perProduct = {} 
    const grandUnitTotals = {} 

    for (const m of MONTHS) {
      perMonth[m.key] = {}
      for (const u of unitCols) perMonth[m.key][String(u.id)] = { qty: 0, baht: 0 }
    }
    for (const p of products) {
      const pid = String(p.product_id)
      perProduct[pid] = {}
      for (const u of unitCols) perProduct[pid][String(u.id)] = { qty: 0, baht: 0 }
    }
    for (const u of unitCols) grandUnitTotals[String(u.id)] = { qty: 0, baht: 0 }

    let grandValue = 0

    for (const p of products) {
      const pid = String(p.product_id)
      const prices = priceByPid[pid] || {}
      const sell = toNumber(prices.sell_price ?? p.sell_price ?? 0)

      for (const m of MONTHS) {
        for (const u of unitCols) {
          const uid = String(u.id)
          const n = toNumber(qtyByPid?.[pid]?.[m.key]?.[uid] ?? "")
          const baht = n * sell

          perMonth[m.key][uid].qty += n
          perMonth[m.key][uid].baht += baht

          perProduct[pid][uid].qty += n
          perProduct[pid][uid].baht += baht

          grandUnitTotals[uid].qty += n
          grandUnitTotals[uid].baht += baht

          grandValue += baht
        }
      }
    }
    return { perMonth, perProduct, grandUnitTotals, grandValue }
  }, [products, priceByPid, qtyByPid, unitCols])

  /** ---------------- Arrow Navigation ---------------- */
  const inputRefs = useRef(new Map())
  const sidebarOpen = useSidebarOpen()
  const tableWrapRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)
  useEffect(() => {
    const recalc = () => {
      const el = tableWrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setTableCardHeight(Math.max(400, Math.floor(window.innerHeight - rect.top - 100)))
    }
    recalc()
    window.addEventListener("resize", recalc)
    return () => window.removeEventListener("resize", recalc)
  }, [])

  const registerInput = useCallback((rIdx, cIdx) => (el) => {
    const key = `${rIdx}|${cIdx}`
    if (!el) inputRefs.current.delete(key)
    else inputRefs.current.set(key, el)
  }, [])

  const ensureInView = useCallback((el) => {
    const container = tableWrapRef.current
    if (!container || !el) return
    const pad = 20
    const frozenLeft = LEFT_W
    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()

    const visibleLeft = crect.left + frozenLeft + pad
    const visibleRight = crect.right - pad

    if (erect.left < visibleLeft) container.scrollLeft -= (visibleLeft - erect.left)
    else if (erect.right > visibleRight) container.scrollLeft += (erect.right - visibleRight)
    
    if (erect.top < crect.top + pad) container.scrollTop -= (crect.top + pad - erect.top)
    else if (erect.bottom > crect.bottom - pad) container.scrollTop += (erect.bottom - (crect.bottom - pad))
  }, [])

  const handleArrowNav = useCallback((e) => {
    const k = e.key
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(k)) return
    
    const rIdx = Number(e.currentTarget.dataset.row ?? 0)
    const cIdx = Number(e.currentTarget.dataset.col ?? 0)
    
    const totalCols = 1 + (MONTHS.length * unitCols.length) 

    let nextR = rIdx, nextC = cIdx

    if (k === "ArrowLeft") {
      if (cIdx === 0) {
        if (rIdx > 0) {
          nextR = rIdx - 1
          nextC = totalCols - 1
        }
      } else {
        nextC = cIdx - 1
      }
    }

    if (k === "ArrowRight" || k === "Enter") {
      if (cIdx === totalCols - 1) {
        if (rIdx < products.length - 1) {
          nextR = rIdx + 1
          nextC = 0
        }
      } else {
        nextC = cIdx + 1
      }
    }

    if (k === "ArrowUp") nextR = Math.max(0, rIdx - 1)
    if (k === "ArrowDown") nextR = Math.min(products.length - 1, rIdx + 1)

    const target = inputRefs.current.get(`${nextR}|${nextC}`)
    if (target) {
      e.preventDefault()
      target.focus()
      try { target.select() } catch {}
      requestAnimationFrame(() => ensureInView(target))
    }
  }, [products.length, unitCols.length, ensureInView])

  /** ---------------- Save ---------------- */
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const saveAll = useCallback(async () => {
    if (!branchId || !planId || !products.length || !savableUnits.length) return
    setIsSaving(true); setSaveMsg(null)
    try {
      const priceItems = products.map((p) => {
        const pid = Number(p.product_id), cur = priceByPid[String(pid)] || {}
        return { product_id: pid, sell_price: toNumber(cur.sell_price ?? p.sell_price ?? 0), buy_price: toNumber(cur.buy_price ?? p.buy_price ?? 0), comment: String(cur.comment ?? p.comment ?? "") }
      })
      await apiAuth(`/unit-prices/bulk`, { method: "PUT", body: { year: effectiveYearBE, items: priceItems } })

      const cells = []
      for (const p of products) {
        const pid = Number(p.product_id)
        for (const m of MONTHS) {
          for (const u of savableUnits) {
            const uid = Number(u.id), v = qtyByPid?.[String(pid)]?.[m.key]?.[String(uid)] ?? "", n = toNumber(v)
            if (n > 0) cells.push({ unit_id: uid, product_id: pid, month: Number(m.month), amount: n, buy_price: toNumber(priceByPid[String(pid)]?.buy_price ?? 0) })
          }
        }
      }
      await apiAuth(`/revenue/sale-goals/bulk`, { method: "PUT", body: { plan_id: Number(planId), branch_id: Number(branchId), cells } })
      setSaveMsg({ ok: true, title: "บันทึกสำเร็จ", detail: `สาขา ${branchName || branchId} • ปี ${effectiveYearBE}` })

      await loadSavedFromBE()
      await loadUnitPricesForYear()
    } catch (e) {
      setSaveMsg({ ok: false, title: "บันทึกไม่สำเร็จ", detail: e?.message || String(e) })
    } finally { setIsSaving(false) }
  }, [branchId, planId, effectiveYearBE, products, priceByPid, qtyByPid, savableUnits, branchName, loadSavedFromBE, loadProducts, loadUnitPricesForYear])

  /** ---------------- rendering helpers ---------------- */
  const RIGHT_W = useMemo(() => {
    const monthColsW = MONTHS.length * unitCols.length * COL_W.cell
    const totalColsW = unitCols.length * (COL_W.cell + COL_W.price) 
    return monthColsW + totalColsW
  }, [unitCols.length])
  
  const TOTAL_W = useMemo(() => LEFT_W + RIGHT_W, [RIGHT_W])

  const stickyShadow = "shadow-[0_0_0_1px_rgba(148,163,184,0.6)] dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]"
  const headCell = "px-1.5 py-1.5 text-[12px] font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-600"
  const leftHeadCell = cx(headCell, "sticky left-0 z-20", stickyShadow)
  const leftCell = "px-1.5 py-1.5 text-[12px] text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700"
  const leftCellSticky = cx(leftCell, "sticky left-0 z-10", stickyShadow)
  const cellClass = "px-1 py-1 text-[12px] border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
  const rowDivider = "border-b-[2px] border-b-slate-300 dark:border-b-slate-600"
  const footerBorder = "border-t-[2px] border-t-emerald-500 dark:border-t-emerald-600"

  return (
    <>
    <div className="w-full">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700" ref={tableWrapRef} style={{ maxHeight: tableCardHeight }}>
          <table className="min-w-full border-collapse" style={{ width: TOTAL_W }}>
            <colgroup>
              <col style={{ width: COL_W.product }} />
              <col style={{ width: COL_W.unit }} />
              <col style={{ width: COL_W.price }} />
              {MONTHS.map((m) => unitCols.map((u) => <col key={`${m.key}-${u.id}`} style={{ width: COL_W.cell }} />))}
              {unitCols.map((u) => (
                <Fragment key={`totcol-${u.id}`}>
                  <col style={{ width: COL_W.cell }} />
                  <col style={{ width: COL_W.price }} />
                </Fragment>
              ))}
            </colgroup>
            
            <thead className="sticky top-0 z-30">
              <tr>
                <th className={cx(leftHeadCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>ประเภทสินค้า</th>
                <th className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>หน่วยนับ</th>
                <th className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>ราคาต่อหน่วย<br/>(บาท)</th>
                <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")} colSpan={MONTHS.length * unitCols.length}>มูลค่าสินค้าที่ขายในแต่ละเดือน (พันบาท)</th>
                {unitCols.map((u) => (
                  <th key={`superh-tot-${u.id}`} className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} colSpan={2} rowSpan={2}>
                    รวมทั้งหมด {unitCols.length > 1 ? `(${u.name})` : ''}
                  </th>
                ))}
              </tr>
              <tr>
                {MONTHS.map((m, mi) => (
                  <th key={`h2-${m.key}`} className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 text-center")} colSpan={unitCols.length}>{m.label}</th>
                ))}
              </tr>
              <tr>
                {MONTHS.map((m, mi) => (
                  <Fragment key={`h3-${m.key}`}>
                    {unitCols.map((u) => (
                      <th key={`h3-${m.key}-${u.id}`} className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 font-medium")}>{u.short}</th>
                    ))}
                  </Fragment>
                ))}
                {unitCols.map((u) => (
                  <Fragment key={`sumh-${u.id}`}>
                    <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>จำนวนหน่วย</th>
                    <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>จำนวนเงิน (บาท)</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            
            <tbody>
              {products.map((p, rowIdx) => {
                const pid = String(p.product_id), prices = priceByPid[pid] || {}, sell = toNumber(prices.sell_price ?? p.sell_price ?? 0)
                const stripeCls = rowIdx % 2 === 0 ? STRIPE.cellEven : STRIPE.cellOdd

                return (
                  <Fragment key={pid}>
                    <tr className="group">
                      <td rowSpan={2} className={cx(leftCellSticky, stripeCls, rowDivider, "align-middle")}>
                        <div className="font-semibold">{p.name || "-"}</div>
                      </td>
                      <td className={cx(cellClass, stripeCls)}>
                        <div className="font-semibold text-center">{p.unit}</div>
                      </td>
                      <td rowSpan={2} className={cx(cellClass, stripeCls, rowDivider, "align-middle")}>
                        <input
                          ref={registerInput(rowIdx, 0)}
                          data-row={rowIdx} data-col={0}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={String(prices.sell_price ?? "")}
                          placeholder={String(p.sell_price ?? 0)}
                          onChange={(e) => setPriceField(pid, "sell_price", sanitizeNumberInput(e.target.value))}
                          disabled={!canEdit}
                        />
                      </td>
                      {MONTHS.map((m, mi) => (
                        <Fragment key={`${pid}-q-${m.key}`}>
                          {unitCols.map((u, ui) => {
                            const uid = String(u.id), v = qtyByPid?.[pid]?.[m.key]?.[uid] ?? ""
                            const colIdx = 1 + (mi * unitCols.length) + ui
                            return (
                              <td key={`${pid}-q-${m.key}-${uid}`} className={cx(cellClass, monthStripeCell(mi))}>
                                <input
                                  ref={registerInput(rowIdx, colIdx)}
                                  data-row={rowIdx} data-col={colIdx}
                                  onKeyDown={handleArrowNav}
                                  className={cellInput}
                                  value={String(v)}
                                  onChange={(e) => setQtyField(pid, m.key, uid, sanitizeNumberInput(e.target.value))}
                                  disabled={!canEdit || Number(u.id) <= 0}
                                />
                              </td>
                            )
                          })}
                        </Fragment>
                      ))}
                      {unitCols.map((u) => (
                        <Fragment key={`${pid}-sum-${u.id}`}>
                          <td className={cx(cellClass, STRIPE.footEven)}>
                            <div className="text-right font-semibold text-slate-800 dark:text-slate-200">{fmtQty(sums.perProduct[pid]?.[String(u.id)]?.qty || 0)}</div>
                          </td>
                          <td rowSpan={2} className={cx(cellClass, STRIPE.footEven, rowDivider, "align-middle")}>
                            <div className="text-right font-bold text-emerald-700 dark:text-emerald-400">{fmtMoney(sums.perProduct[pid]?.[String(u.id)]?.baht || 0)}</div>
                          </td>
                        </Fragment>
                      ))}
                    </tr>

                    <tr className="group">
                      <td className={cx(cellClass, stripeCls, rowDivider)}>
                        <div className="text-[11px] text-center text-slate-500 dark:text-slate-400">บาท</div>
                      </td>
                      {MONTHS.map((m, mi) => (
                        <Fragment key={`${pid}-b-${m.key}`}>
                          {unitCols.map((u) => {
                            const uid = String(u.id), n = toNumber(qtyByPid?.[pid]?.[m.key]?.[uid] ?? ""), b = n * sell
                            return (
                              <td key={`${pid}-b-${m.key}-${uid}`} className={cx(cellClass, monthStripeCell(mi), rowDivider)}>
                                <div className="px-1.5 text-right text-slate-600 dark:text-slate-300">{b > 0 ? fmtMoney(b) : "-"}</div>
                              </td>
                            )
                          })}
                        </Fragment>
                      ))}
                      {unitCols.map((u) => <td key={`${pid}-sum-pad-${u.id}`} className={cx(cellClass, STRIPE.footEven, rowDivider)} />)}
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr>
                <td rowSpan={2} className={cx(leftCellSticky, STRIPE.footOdd, footerBorder, "align-middle")}><div className="font-bold text-center text-[13px]">รวม</div></td>
                <td className={cx(cellClass, STRIPE.footOdd, footerBorder)}><div className="font-semibold text-center">หน่วย</div></td>
                <td rowSpan={2} className={cx(cellClass, STRIPE.footOdd, footerBorder, "align-middle")} />
                
                {MONTHS.map((m, mi) => (
                  <Fragment key={`ft-q-${m.key}`}>
                    {unitCols.map((u) => (
                      <td key={`ft-q-${m.key}-${u.id}`} className={cx(cellClass, monthStripeHead(mi), footerBorder)}>
                        <div className="px-1.5 text-right font-semibold text-slate-800 dark:text-slate-200">{fmtQty(sums.perMonth[m.key][String(u.id)].qty)}</div>
                      </td>
                    ))}
                  </Fragment>
                ))}
                
                {unitCols.map((u) => (
                  <Fragment key={`ft-sum-${u.id}`}>
                    <td className={cx(cellClass, STRIPE.footOdd, footerBorder)}>
                      <div className="text-right font-bold text-[13px] text-slate-900 dark:text-slate-100">{fmtQty(sums.grandUnitTotals[String(u.id)].qty)}</div>
                    </td>
                    <td rowSpan={2} className={cx(cellClass, STRIPE.footOdd, footerBorder, "align-middle")}>
                      <div className="text-right font-bold text-[14px] text-emerald-800 dark:text-emerald-300">{fmtMoney(sums.grandUnitTotals[String(u.id)].baht)}</div>
                    </td>
                  </Fragment>
                ))}
              </tr>

              <tr>
                <td className={cx(cellClass, STRIPE.footOdd)}><div className="text-[11px] font-semibold text-center text-slate-600 dark:text-slate-300">บาท</div></td>
                {MONTHS.map((m, mi) => (
                  <Fragment key={`ft-b-${m.key}`}>
                    {unitCols.map((u) => (
                      <td key={`ft-b-${m.key}-${u.id}`} className={cx(cellClass, monthStripeHead(mi))}>
                        <div className="px-1.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">{fmtMoney(sums.perMonth[m.key][String(u.id)].baht)}</div>
                      </td>
                    ))}
                  </Fragment>
                ))}
                {unitCols.map((u) => <td key={`ft-pad-${u.id}`} className={cx(cellClass, STRIPE.footOdd)} />)}
              </tr>
            </tfoot>
          </table>
        </div>

        {!canEdit && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-900">
            ยังไม่พบสาขา หรือ สาขานี้ไม่มีหน่วยย่อย — กรุณาเลือกสาขาให้ถูกต้อง
          </div>
        )}
        
        <div className="shrink-0 pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
          {saveMsg && (
            <div className={cx("mb-3 rounded-xl border p-3 text-[13px]", saveMsg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200")}>
              <div className="font-bold">{saveMsg.title}</div>
              <div className="opacity-90 mt-0.5">{saveMsg.detail}</div>
            </div>
          )}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
            <button
              type="button"
              onClick={() => {
                if(confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) {
                  setQtyByPid(buildEmptyQtyGrid(products.map(p => String(p.product_id)), unitCols));
                }
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              รีเซ็ต
            </button>
            <button
              className={cx(
                "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white transition",
                (isSaving || !canEdit || !savableUnits.length)
                  ? "bg-slate-300 text-slate-700 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:scale-[1.03] active:scale-[.98] cursor-pointer"
              )}
              disabled={isSaving || !canEdit || !savableUnits.length}
              onClick={saveAll}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </div>
    <StickyTableScrollbar tableRef={tableWrapRef} sidebarOpen={sidebarOpen} />
    </>
  )
}

export default SeedProjectSalesPlanDetail
