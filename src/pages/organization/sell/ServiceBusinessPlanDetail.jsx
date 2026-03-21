import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"

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

/** ---------------- API (no lib) ---------------- */
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

/** ---------------- UI styles ---------------- */
const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-md border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

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

const FALLBACK_UNITS = [
  { id: -1, short: "หน่วย", name: "หน่วย" },
]

const SERVICE_GROUP_ID = 6
const SERVICE_TITLE = "ยอดขายธุรกิจบริการ"
const SERVICE_ITEM_NAME = "บริการ-ศูนย์ฝึก"

const normalizeServiceName = (s) => String(s ?? "").trim().replace(/[–—−]/g, "-").replace(/\s+/g, " ")

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
const normalizeUnitName = (s) => String(s ?? "").trim().replace(/\s+/g, " ")

const shortUnit = (name, idx) => {
  const s = normalizeUnitName(name)
  if (!s) return `หน่วย${idx + 1}`
  return s.length <= 4 ? s : s.slice(0, 4)
}

function buildEmptyQtyGrid(items, unitList) {
  const out = {}
  for (const it of items || []) {
    const rowId = String(it.id)
    out[rowId] = {}
    for (const m of MONTHS) {
      out[rowId][m.key] = {}
      for (const u of unitList || []) {
        out[rowId][m.key][String(u.id)] = ""
      }
    }
  }
  return out
}

function buildInitialPrice(items) {
  const out = {}
  ;(items || []).forEach((it) => {
    out[it.id] = {
      sell_price: String(it.sell_price ?? ""),
      buy_price: String(it.buy_price ?? ""),
      comment: String(it.comment ?? ""),
    }
  })
  return out
}

function getProductsByGroupLatestPricesFromAnySource(props) {
  const fromProps = props?.products_by_group_latest_prices
  if (fromProps) return fromProps

  try {
    const w = typeof window !== "undefined" ? window : undefined
    const direct = w?.products_by_group_latest_prices
    if (direct) return direct
    const nested = w?.LISTS?.products_by_group_latest_prices
    if (nested) return nested
  } catch {}

  return null
}

function normalizeStaticListToItems(staticList, groupId) {
  if (!staticList) return null
  if (Array.isArray(staticList)) return staticList

  const g = staticList?.[String(groupId)] || staticList?.[groupId]
  if (Array.isArray(g)) return g
  if (Array.isArray(g?.items)) return g.items

  if (Array.isArray(staticList?.items)) return staticList.items

  return null
}

function flattenAnyGroupItems(staticList) {
  if (!staticList) return []
  if (Array.isArray(staticList)) return staticList
  const out = []
  for (const k of Object.keys(staticList)) {
    const v = staticList[k]
    if (Array.isArray(v)) out.push(...v)
    else if (Array.isArray(v?.items)) out.push(...v.items)
  }
  if (Array.isArray(staticList?.items)) out.push(...staticList.items)
  return out
}

/** =====================================================================
 * ServiceBusinessPlanDetail
 * ===================================================================== */
const ServiceBusinessPlanDetail = (props) => {
  const { branchId, branchName, yearBE, planId } = props || {}

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

  const periodLabel = useMemo(() => {
    const yy = String(effectiveYearBE).slice(-2)
    const yyNext = String(effectiveYearBE + 1).slice(-2)
    return `1 เม.ย.${yy}-31 มี.ค.${yyNext}`
  }, [effectiveYearBE])

  /** -------- Units by branch -------- */
  const [units, setUnits] = useState(FALLBACK_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  const loadUnits = useCallback(async () => {
    if (!branchId) {
      setUnits(FALLBACK_UNITS)
      return
    }
    setIsLoadingUnits(true)
    try {
      const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
      const rows = Array.isArray(data) ? data : []
      const normalized = rows
        .map((r, idx) => {
          const id = Number(r.id || 0)
          const name = r.klang_name || r.unit_name || r.unit || r.name || `หน่วย ${id || idx + 1}`
          return { id, name: normalizeUnitName(name), short: shortUnit(name, idx) }
        })
        .filter((x) => x.id > 0)
      setUnits(normalized.length ? normalized : FALLBACK_UNITS)
    } catch (e) {
      console.error("[service] load units failed:", e)
      setUnits(FALLBACK_UNITS)
    } finally {
      setIsLoadingUnits(false)
    }
  }, [branchId])

  useEffect(() => { loadUnits() }, [loadUnits])

  const savableUnits = useMemo(() => (units || []).filter((u) => Number(u?.id) > 0), [units])
  const unitCols = useMemo(() => {
    const list = (units || []).slice()
    if (!list.length) return FALLBACK_UNITS
    return list.map((u, idx) => ({ ...u, short: u.short || shortUnit(u.name || "", idx) }))
  }, [units])

  /** -------- Load service items -------- */
  const [items, setItems] = useState([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  const [priceById, setPriceById] = useState({})
  const [qtyById, setQtyById] = useState({})
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [showPayload, setShowPayload] = useState(false)

  const canEdit = !!branchId && !!effectivePlanId && effectivePlanId > 0 && savableUnits.length > 0

  const RIGHT_W = useMemo(() => {
    const monthColsW = MONTHS.length * unitCols.length * COL_W.cell
    const totalColsW = unitCols.length * (COL_W.cell + COL_W.price) 
    return monthColsW + totalColsW
  }, [unitCols.length])
  
  const TOTAL_W = useMemo(() => LEFT_W + RIGHT_W, [RIGHT_W])

  const loadItems = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0) {
      setItems([]); setPriceById({}); setQtyById({}); return
    }

    setIsLoadingItems(true)
    try {
      const staticList = getProductsByGroupLatestPricesFromAnySource(props)
      let rows = normalizeStaticListToItems(staticList, SERVICE_GROUP_ID)
      if (!rows || !rows.length) rows = flattenAnyGroupItems(staticList)

      if (!rows || !rows.length) {
        const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${Number(effectivePlanId)}`)
        const group = data?.[String(SERVICE_GROUP_ID)] || data?.[SERVICE_GROUP_ID]
        rows = Array.isArray(group?.items) ? group.items : flattenAnyGroupItems(data)
      }

      const normalized = (rows || [])
        .map((x, idx) => {
          const pid = Number(x.product_id || x.product || x.id || 0)
          const name = String(x.product_type || x.name || x.product_name || x.product || "").trim()
          return {
            id: String(pid || `svc_${idx}`),
            product_id: pid,
            name,
            unit: String(x.unit || x.unit_name || "-").trim() || "-",
            sell_price: x.sell_price ?? "",
            buy_price: x.buy_price ?? "",
            comment: x.comment ?? "",
            business_group: Number(x.business_group || SERVICE_GROUP_ID),
          }
        })
        .filter((x) => x.product_id > 0)
        .filter((x) => normalizeServiceName(x.name) === normalizeServiceName(SERVICE_ITEM_NAME))

      setItems(normalized)
      setPriceById(buildInitialPrice(normalized))
      setQtyById((prev) => {
        const empty = buildEmptyQtyGrid(normalized, unitCols)
        for (const rowId of Object.keys(empty)) {
          if (!prev?.[rowId]) continue
          for (const m of MONTHS) {
            for (const u of unitCols) {
              const uk = String(u.id)
              const v = prev?.[rowId]?.[m.key]?.[uk]
              if (v !== undefined) empty[rowId][m.key][uk] = v
            }
          }
        }
        return empty
      })
    } catch (e) {
      console.error("[service] load items failed:", e)
      setItems([]); setPriceById({}); setQtyById({})
    } finally {
      setIsLoadingItems(false)
    }
  }, [effectivePlanId, props, unitCols])

  useEffect(() => { loadItems() }, [loadItems])

  /** -------- Load saved sale-goals -------- */
  const loadSaved = useCallback(async () => {
    if (!branchId || !effectivePlanId || effectivePlanId <= 0 || !items.length || !savableUnits.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/revenue/sale-goals?plan_id=${Number(effectivePlanId)}&branch_id=${Number(branchId)}`)
      const cells = Array.isArray(data?.cells) ? data.cells : (Array.isArray(data) ? data : [])

      const pidToRowId = {}
      for (const it of items) pidToRowId[String(it.product_id)] = it.id
      const uSet = new Set(savableUnits.map((u) => Number(u.id)))
      const next = buildEmptyQtyGrid(items, unitCols)

      for (const c of cells) {
        const pid = Number(c.product_id || 0)
        const uid = Number(c.unit_id || 0)
        if (!pid || !uid) continue
        if (!uSet.has(uid)) continue
        const rowId = pidToRowId[String(pid)]
        if (!rowId) continue
        const mo = Number(c.month || 0)
        const mObj = MONTHS.find((m) => m.month === mo)
        if (!mObj) continue
        next[rowId][mObj.key][String(uid)] = String(Number(c.amount ?? c.value ?? 0))
      }
      setQtyById(next)
    } catch (e) {
      console.warn("[service] load saved failed:", e)
    } finally {
      setIsLoadingSaved(false)
    }
  }, [branchId, effectivePlanId, items, savableUnits, unitCols])

  useEffect(() => { loadSaved() }, [loadSaved])

  /** -------- Setters -------- */
  const setPriceField = (rowId, field, v) => {
    setPriceById((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || { sell_price: "", buy_price: "", comment: "" }), [field]: v },
    }))
  }
  const setQtyCell = (rowId, monthKey, unitKey, v) => {
    setQtyById((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [monthKey]: { ...(prev[rowId]?.[monthKey] || {}), [unitKey]: v } },
    }))
  }

  /** -------- Computed sums -------- */
  const sums = useMemo(() => {
    const perMonth = {} 
    const perProduct = {} 
    const grandUnitTotals = {} 

    for (const m of MONTHS) {
      perMonth[m.key] = {}
      for (const u of unitCols) perMonth[m.key][String(u.id)] = { qty: 0, baht: 0 }
    }
    for (const p of items) {
      const pid = String(p.id)
      perProduct[pid] = {}
      for (const u of unitCols) perProduct[pid][String(u.id)] = { qty: 0, baht: 0 }
    }
    for (const u of unitCols) grandUnitTotals[String(u.id)] = { qty: 0, baht: 0 }

    let grandValue = 0

    for (const p of items) {
      const pid = String(p.id)
      const prices = priceById[pid] || {}
      const sell = toNumber(prices.sell_price ?? p.sell_price ?? 0)

      for (const m of MONTHS) {
        for (const u of unitCols) {
          const uid = String(u.id)
          const n = toNumber(qtyById?.[pid]?.[m.key]?.[uid] ?? "")
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
  }, [items, priceById, qtyById, unitCols])

  /** ---------------- Arrow Navigation Logic ---------------- */
  const inputRefs = useRef(new Map())
  const tableWrapRef = useRef(null)

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
        if (rIdx < items.length - 1) {
          nextR = rIdx + 1
          nextC = 0
        }
      } else {
        nextC = cIdx + 1
      }
    }

    if (k === "ArrowUp") nextR = Math.max(0, rIdx - 1)
    if (k === "ArrowDown") nextR = Math.min(items.length - 1, rIdx + 1)

    const target = inputRefs.current.get(`${nextR}|${nextC}`)
    if (target) {
      e.preventDefault()
      target.focus()
      try { target.select() } catch {}
      requestAnimationFrame(() => ensureInView(target))
    }
  }, [items.length, unitCols.length, ensureInView])


  /** -------- Save -------- */
  const payload = useMemo(() => {
    return {
      plan_id: Number(effectivePlanId || 0),
      branch_id: branchId ? Number(branchId) : null,
      prices: items.map((it) => {
        const pr = priceById[it.id] || {}
        return {
          product_id: Number(it.product_id || 0),
          sell_price: toNumber(pr.sell_price),
          buy_price: toNumber(pr.buy_price),
          comment: String(pr.comment ?? ""),
        }
      }),
      cells: items
        .flatMap((it) =>
          MONTHS.flatMap((m) =>
            savableUnits.map((u) => ({
              unit_id: Number(u.id),
              product_id: Number(it.product_id || 0),
              month: Number(m.month),
              amount: toNumber(qtyById?.[it.id]?.[m.key]?.[String(u.id)] ?? 0),
            }))
          )
        )
        .filter((x) => x.amount !== 0),
    }
  }, [effectivePlanId, branchId, items, priceById, qtyById, savableUnits])

  const saveAll = useCallback(async () => {
    if (!canEdit) {
      setSaveMsg({ ok: false, title: "บันทึกไม่ได้", detail: "ยังไม่มีสาขา/หน่วยของสาขา/plan_id" })
      return
    }

    setIsSaving(true)
    setSaveMsg(null)
    try {
      try {
        await apiAuth(`/unit-prices/bulk`, {
          method: "PUT",
          body: { plan_id: Number(effectivePlanId), items: payload.prices },
        })
      } catch {
        await apiAuth(`/unit-prices/bulk`, {
          method: "PUT",
          body: { year: Number(effectiveYearBE), items: payload.prices },
        })
      }

      await apiAuth(`/revenue/sale-goals/bulk`, {
        method: "PUT",
        body: {
          plan_id: Number(effectivePlanId),
          branch_id: Number(branchId),
          cells: payload.cells,
        },
      })

      setSaveMsg({
        ok: true,
        title: "บันทึกสำเร็จ",
        detail: `ธุรกิจบริการ • ปี ${effectiveYearBE} (plan_id=${effectivePlanId}) • สาขา ${branchName || branchId}`,
      })

      await loadSaved()
      await loadUnitPricesForYear()
    } catch (e) {
      console.error("[service] save failed:", e)
      setSaveMsg({
        ok: false,
        title: "บันทึกไม่สำเร็จ",
        detail: e?.message || "Unknown error",
      })
    } finally {
      setIsSaving(false)
    }
  }, [canEdit, effectivePlanId, effectiveYearBE, payload.prices, payload.cells, branchId, branchName, loadSaved])

  /** ---------------- rendering helpers ---------------- */
  const stickyShadow = "shadow-[0_0_0_1px_rgba(148,163,184,0.6)] dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]"
  const headCell = "px-1.5 py-1.5 text-[12px] font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-600"
  const leftHeadCell = cx(headCell, "sticky left-0 z-20", stickyShadow)
  const leftCell = "px-1.5 py-1.5 text-[12px] text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700"
  const leftCellSticky = cx(leftCell, "sticky left-0 z-10", stickyShadow)
  const cellClass = "px-1 py-1 text-[12px] border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
  const rowDivider = "border-b-[2px] border-b-slate-300 dark:border-b-slate-600"
  const footerBorder = "border-t-[2px] border-t-emerald-500 dark:border-t-emerald-600"

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[16px] font-bold">{SERVICE_TITLE}</div>
          <div className="text-[12px] text-slate-600 dark:text-slate-300">
            ({periodLabel}) • ปี {effectiveYearBE} • สาขา {branchName || "-"}
            {isLoadingUnits ? " • โหลดหน่วย..." : ""}
            {isLoadingItems ? " • โหลดบริการ..." : ""}
            {isLoadingSaved ? " • โหลดค่าที่บันทึก..." : ""}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-[70vh]" ref={tableWrapRef}>
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
              {/* Header Row 1 */}
              <tr>
                <th className={cx(leftHeadCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>
                  ประเภทบริการ
                </th>
                <th className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>
                  หน่วยนับ
                </th>
                <th className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>
                  ราคาต่อหน่วย<br/>(บาท)
                </th>
                <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")} colSpan={MONTHS.length * unitCols.length}>
                  มูลค่างานบริการในแต่ละเดือน (พันบาท)
                </th>
                {unitCols.map((u, i) => (
                  <th key={`superh-tot-${u.id}`} className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} colSpan={2} rowSpan={2}>
                    รวมทั้งหมด {unitCols.length > 1 ? `(${u.name})` : ''}
                  </th>
                ))}
              </tr>
              {/* Header Row 2: รวมชื่อเดือน */}
              <tr>
                {MONTHS.map((m, mi) => (
                  <th key={`h2-${m.key}`} className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 text-center")} colSpan={unitCols.length}>
                    {m.label}
                  </th>
                ))}
              </tr>
              {/* Header Row 3: ชื่อหน่วยย่อยตามเดือน */}
              <tr>
                {MONTHS.map((m, mi) => (
                  <Fragment key={`h3-${m.key}`}>
                    {unitCols.map((u) => (
                      <th key={`h3-${m.key}-${u.id}`} className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 font-medium text-slate-700 dark:text-slate-200")}>
                        {u.name}
                      </th>
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
              {items.map((it, rowIdx) => {
                const pid = String(it.id), prices = priceById[pid] || {}, sell = toNumber(prices.sell_price ?? it.sell_price ?? 0)
                const stripeCls = rowIdx % 2 === 0 ? STRIPE.cellEven : STRIPE.cellOdd

                return (
                  <Fragment key={pid}>
                    {/* ข้อมูล 1: แถวจำนวนหน่วย (Inputs) */}
                    <tr className="group">
                      <td rowSpan={2} className={cx(leftCellSticky, stripeCls, rowDivider, "align-middle")}>
                        <div className="font-semibold">{it.name || "-"}</div>
                      </td>
                      <td className={cx(cellClass, stripeCls)}>
                        <div className="font-semibold text-center">{it.unit}</div>
                      </td>
                      <td rowSpan={2} className={cx(cellClass, stripeCls, rowDivider, "align-middle")}>
                        <input
                          ref={registerInput(rowIdx, 0)}
                          data-row={rowIdx} data-col={0}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={String(prices.sell_price ?? "")}
                          placeholder={String(it.sell_price ?? 0)}
                          onChange={(e) => setPriceField(pid, "sell_price", sanitizeNumberInput(e.target.value))}
                          disabled={!canEdit}
                        />
                      </td>
                      {MONTHS.map((m, mi) => (
                        <Fragment key={`${pid}-q-${m.key}`}>
                          {unitCols.map((u, ui) => {
                            const uid = String(u.id), v = qtyById?.[pid]?.[m.key]?.[uid] ?? ""
                            const colIdx = 1 + (mi * unitCols.length) + ui
                            return (
                              <td key={`${pid}-q-${m.key}-${uid}`} className={cx(cellClass, monthStripeCell(mi))}>
                                <input
                                  ref={registerInput(rowIdx, colIdx)}
                                  data-row={rowIdx} data-col={colIdx}
                                  onKeyDown={handleArrowNav}
                                  className={cellInput}
                                  value={String(v)}
                                  onChange={(e) => setQtyCell(pid, m.key, uid, sanitizeNumberInput(e.target.value))}
                                  disabled={!canEdit || Number(u.id) <= 0}
                                />
                              </td>
                            )
                          })}
                        </Fragment>
                      ))}
                      {/* ผลรวมของสินค้านั้น (หน่วย และ บาท) */}
                      {unitCols.map((u) => (
                        <Fragment key={`${pid}-sum-${u.id}`}>
                          <td className={cx(cellClass, STRIPE.footEven)}>
                            <div className="text-right font-semibold text-slate-800 dark:text-slate-200">
                              {fmtQty(sums.perProduct[pid]?.[String(u.id)]?.qty || 0)}
                            </div>
                          </td>
                          <td rowSpan={2} className={cx(cellClass, STRIPE.footEven, rowDivider, "align-middle")}>
                            <div className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                              {fmtMoney(sums.perProduct[pid]?.[String(u.id)]?.baht || 0)}
                            </div>
                          </td>
                        </Fragment>
                      ))}
                    </tr>

                    {/* ข้อมูล 2: แถวจำนวนเงิน/บาท (Calculated) */}
                    <tr className="group">
                      <td className={cx(cellClass, stripeCls, rowDivider)}>
                        <div className="text-[11px] text-center text-slate-500 dark:text-slate-400">บาท</div>
                      </td>
                      {MONTHS.map((m, mi) => (
                        <Fragment key={`${pid}-b-${m.key}`}>
                          {unitCols.map((u) => {
                            const uid = String(u.id)
                            const n = toNumber(qtyById?.[pid]?.[m.key]?.[uid] ?? "")
                            const b = n * sell
                            return (
                              <td key={`${pid}-b-${m.key}-${uid}`} className={cx(cellClass, monthStripeCell(mi), rowDivider)}>
                                <div className="px-1.5 text-right text-slate-600 dark:text-slate-300">
                                  {b > 0 ? fmtMoney(b) : "-"}
                                </div>
                              </td>
                            )
                          })}
                        </Fragment>
                      ))}
                      {unitCols.map((u) => (
                        <td key={`${pid}-sum-pad-${u.id}`} className={cx(cellClass, STRIPE.footEven, rowDivider)} />
                      ))}
                    </tr>
                  </Fragment>
                )
              })}

              {/* ----- FOOTER: สรุปยอดรวมทั้งหมด ด้านล่าง ----- */}
              {/* Footer 1: ผลรวมจำนวนหน่วย */}
              <tr>
                <td rowSpan={2} className={cx(leftCellSticky, STRIPE.footOdd, footerBorder, "align-middle")}>
                  <div className="font-bold text-center text-[13px]">รวม</div>
                </td>
                <td className={cx(cellClass, STRIPE.footOdd, footerBorder)}>
                  <div className="font-semibold text-center">หน่วย</div>
                </td>
                <td rowSpan={2} className={cx(cellClass, STRIPE.footOdd, footerBorder, "align-middle")} />
                
                {MONTHS.map((m, mi) => (
                  <Fragment key={`ft-q-${m.key}`}>
                    {unitCols.map((u) => (
                      <td key={`ft-q-${m.key}-${u.id}`} className={cx(cellClass, monthStripeHead(mi), footerBorder)}>
                        <div className="px-1.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                          {fmtQty(sums.perMonth[m.key][String(u.id)].qty)}
                        </div>
                      </td>
                    ))}
                  </Fragment>
                ))}
                
                {unitCols.map((u) => (
                  <Fragment key={`ft-sum-${u.id}`}>
                    <td className={cx(cellClass, STRIPE.footOdd, footerBorder)}>
                      <div className="text-right font-bold text-[13px] text-slate-900 dark:text-slate-100">
                        {fmtQty(sums.grandUnitTotals[String(u.id)].qty)}
                      </div>
                    </td>
                    <td rowSpan={2} className={cx(cellClass, STRIPE.footOdd, footerBorder, "align-middle")}>
                      <div className="text-right font-bold text-[14px] text-emerald-800 dark:text-emerald-300">
                        {fmtMoney(sums.grandUnitTotals[String(u.id)].baht)}
                      </div>
                    </td>
                  </Fragment>
                ))}
              </tr>

              {/* Footer 2: ผลรวมจำนวนเงิน */}
              <tr>
                <td className={cx(cellClass, STRIPE.footOdd)}>
                  <div className="text-[11px] font-semibold text-center text-slate-600 dark:text-slate-300">บาท</div>
                </td>
                {MONTHS.map((m, mi) => (
                  <Fragment key={`ft-b-${m.key}`}>
                    {unitCols.map((u) => (
                      <td key={`ft-b-${m.key}-${u.id}`} className={cx(cellClass, monthStripeHead(mi))}>
                        <div className="px-1.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                          {fmtMoney(sums.perMonth[m.key][String(u.id)].baht)}
                        </div>
                      </td>
                    ))}
                  </Fragment>
                ))}
                {unitCols.map((u) => (
                  <td key={`ft-pad-${u.id}`} className={cx(cellClass, STRIPE.footOdd)} />
                ))}
              </tr>

            </tbody>
          </table>
        </div>

        {!canEdit && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-900">
            ยังไม่พบสาขา หรือ สาขานี้ไม่มีหน่วยย่อย — กรุณาเลือกสาขาให้ถูกต้อง
          </div>
        )}
        
        {/* แถบบันทึก: ล่างสุด ขวา */}
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
                  setQtyById(buildEmptyQtyGrid(items, unitCols));
                }
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              ล้างข้อมูล
            </button>
            <button
              type="button"
              onClick={() => setShowPayload(!showPayload)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              {showPayload ? "ซ่อน payload" : "ดู payload"}
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
        
        {showPayload && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
            <pre className="max-h-72 overflow-auto">{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}

      </div>
    </div>
  )
}

export default ServiceBusinessPlanDetail