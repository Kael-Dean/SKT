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

/** ---------------- UI styles ---------------- */
// ปรับขนาด font และ padding ใน input ให้เล็กลง
const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-md border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] outline-none " +
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

const FALLBACK_UNITS = [
  { id: -1, short: "ปร", name: "ปร" },
  { id: -2, short: "รับ", name: "รับ" },
  { id: -3, short: "พร", name: "พร" },
]

// ลดความกว้างของแต่ละคอลัมน์เพื่อให้เห็นข้อมูลในหน้าจอได้มากขึ้น
const COL_W = {
  product: 200,
  unit: 64,
  price: 90,
  cell: 100, 
}
const LEFT_W = COL_W.product + COL_W.unit + COL_W.price

// ✅ แก้ไข: ลบ opacity ออกทั้งหมด เพื่อให้คอลัมน์ที่ sticky พื้นหลังทึบ ไม่โปร่งแสง
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

const PROCUREMENT_GROUP_ID = 1

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
 * ProcurementPlanDetail
 * ======================================================================= */
function ProcurementPlanDetail(props) {
  const { branchId, branch_id, branch, selectedBranch, branchName, yearBE, planId } = props || {}

  const [units, setUnits] = useState(FALLBACK_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)
  const [resolvedBranchId, setResolvedBranchId] = useState(null)
  const [resolvedBranchName, setResolvedBranchName] = useState(branchName || "")

  const _pickNumber = useCallback((v) => {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
    const digits = String(v).match(/\d+/g)
    if (!digits) return null
    const nd = Number(digits.join(""))
    return Number.isFinite(nd) && nd > 0 ? nd : null
  }, [])

  const incomingBranchId = useMemo(() => {
    const cands = [branchId, branch_id, branch?.id, selectedBranch?.id, branch?.branch_id, selectedBranch?.branch_id]
    for (const c of cands) {
      const n = _pickNumber(c)
      if (n) return n
    }
    const ls = _pickNumber(localStorage.getItem("branch_id") || localStorage.getItem("selected_branch_id"))
    return ls || null
  }, [branchId, branch_id, branch, selectedBranch, _pickNumber])

  const branchIdEff = resolvedBranchId || incomingBranchId || null

  useEffect(() => {
    if (branchName) setResolvedBranchName(branchName)
  }, [branchName])

  useEffect(() => {
    if (incomingBranchId) {
      setResolvedBranchId(incomingBranchId)
      return
    }
    const name = String(branchName || resolvedBranchName || "").trim()
    if (!name) return
    let alive = true
    ;(async () => {
      try {
        const tryPaths = [`/lists/branch/search?branch_name=${encodeURIComponent(name)}`]
        let rows = null
        for (const path of tryPaths) {
          try {
            const data = await apiAuth(path)
            if (Array.isArray(data)) rows = data
            else if (Array.isArray(data?.items)) rows = data.items
            if (rows && rows.length) break
          } catch {}
        }
        if (!alive || !rows || !rows.length) return
        const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ")
        const target = norm(name)
        const found = rows.find((r) => norm(r.branch_name || r.name).includes(target)) || rows[0]
        const id = _pickNumber(found?.id || found?.branch_id)
        if (id) {
          setResolvedBranchId(id)
          setResolvedBranchName(found?.branch_name || found?.name || name)
        }
      } catch {}
    })()
    return () => { alive = false }
  }, [incomingBranchId, branchName, resolvedBranchName, _pickNumber])

  const canEdit = !!branchIdEff
  const savableUnits = useMemo(() => (units || []).filter((u) => Number(u?.id) > 0), [units])
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

  const [unitPriceMap, setUnitPriceMap] = useState({})
  const [isLoadingUnitPrices, setIsLoadingUnitPrices] = useState(false)

  const loadUnitPricesForYear = useCallback(async () => {
    const y = Number(effectiveYearBE || 0)
    if (!Number.isFinite(y) || y <= 0) {
      setUnitPriceMap({})
      return
    }
    setIsLoadingUnitPrices(true)
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
    } finally {
      setIsLoadingUnitPrices(false)
    }
  }, [effectiveYearBE])

  useEffect(() => { loadUnitPricesForYear() }, [loadUnitPricesForYear])

  useEffect(() => {
    if (!branchIdEff) { setUnits(FALLBACK_UNITS); return }
    let alive = true
    ;(async () => {
      setIsLoadingUnits(true)
      try {
        const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchIdEff)}`)
        const rows = Array.isArray(data) ? data : []
        const normalized = rows.map((r, idx) => {
          const id = Number(r.id || 0)
          const name = r.unit_name || r.klang_name || r.unit || r.name || `หน่วย ${id || idx + 1}`
          return { id, name: normalizeUnitName(name), short: shortUnit(name, idx) }
        }).filter((x) => x.id > 0)
        if (!alive) return
        setUnits(normalized.length ? normalized : FALLBACK_UNITS)
      } catch {
        if (!alive) return
        setUnits(FALLBACK_UNITS)
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()
    return () => { alive = false }
  }, [branchIdEff])

  const [products, setProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [priceByPid, setPriceByPid] = useState({})
  const [qtyByPid, setQtyByPid] = useState({})

  const unitCols = useMemo(() => {
    const list = (units || []).slice()
    if (!list.length) return FALLBACK_UNITS
    return list.map((u, idx) => ({ ...u, short: u.short || shortUnit(u.name || "", idx) }))
  }, [units])

  const RIGHT_W = useMemo(() => {
    const monthColsW = MONTHS.length * unitCols.length * COL_W.cell
    const totalColsW = unitCols.length * (COL_W.cell + COL_W.price) // Space for Qty + Baht totals
    return monthColsW + totalColsW
  }, [unitCols.length])
  
  const TOTAL_W = useMemo(() => LEFT_W + RIGHT_W, [RIGHT_W])

  const loadProducts = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0) { setProducts([]); return }
    setIsLoadingProducts(true)
    try {
      const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${effectivePlanId}`)
      const g = data?.[String(PROCUREMENT_GROUP_ID)] || data?.[PROCUREMENT_GROUP_ID]
      const items = Array.isArray(g?.items) ? g.items : []
      const normalized = items
        .filter((x) => Number(x.business_group) === PROCUREMENT_GROUP_ID)
        .map((x) => {
          const pid = Number(x.product_id || 0)
          const fallback = unitPriceMap[String(pid)] || null
          const sellMerged = (x.sell_price === null || x.sell_price === undefined || Number(x.sell_price) === 0) && fallback ? fallback.sell_price : (x.sell_price ?? 0)
          const buyMerged = (x.buy_price === null || x.buy_price === undefined || Number(x.buy_price) === 0) && fallback ? fallback.buy_price : (x.buy_price ?? 0)
          return {
            unitprice_id: x.unitprice_id ?? null,
            product_id: pid,
            product_type: x.product_type || "",
            unit: x.unit || "-",
            business_group: Number(x.business_group || 0),
            sell_price: sellMerged,
            buy_price: buyMerged,
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
    } catch {
      setProducts([])
    } finally {
      setIsLoadingProducts(false)
    }
  }, [effectivePlanId, unitCols, unitPriceMap])

  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const loadSavedFromBE = useCallback(async () => {
    if (!branchIdEff || !effectivePlanId || effectivePlanId <= 0 || !products.length) return
    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/revenue/sale-goals?plan_id=${Number(effectivePlanId)}&branch_id=${Number(branchIdEff)}`)
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
  }, [branchIdEff, effectivePlanId, products, unitCols])

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { loadSavedFromBE() }, [loadSavedFromBE])

  const productRows = useMemo(() => products.map((p) => ({ ...p, product_id: Number(p.product_id), unit: String(p.unit || "-").trim() })), [products])

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

  // Calculate all sums: per month per unit, per product per unit, and grand totals
  const sums = useMemo(() => {
    const perMonth = {} 
    const perProduct = {} 
    const grandUnitTotals = {} 

    // Initialize objects
    for (const m of MONTHS) {
      perMonth[m.key] = {}
      for (const u of unitCols) perMonth[m.key][String(u.id)] = { qty: 0, baht: 0 }
    }
    for (const p of productRows) {
      const pid = String(p.product_id)
      perProduct[pid] = {}
      for (const u of unitCols) perProduct[pid][String(u.id)] = { qty: 0, baht: 0 }
    }
    for (const u of unitCols) grandUnitTotals[String(u.id)] = { qty: 0, baht: 0 }

    let grandValue = 0

    // Accumulate values
    for (const p of productRows) {
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
  }, [productRows, priceByPid, qtyByPid, unitCols])

  /** ---------------- Arrow Navigation Logic ---------------- */
  const inputRefs = useRef(new Map())
  const sidebarOpen = useSidebarOpen()
  const tableWrapRef = useRef(null)

  /** ---------------- Dynamic height (fills viewport) ---------------- */
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
    
    // คำนวณจำนวนคอลัมน์ทั้งหมดที่สามารถ Focus ได้ (1 ราคาต่อหน่วย + [จำนวนเดือน * จำนวนหน่วย])
    const totalCols = 1 + (MONTHS.length * unitCols.length) 

    let nextR = rIdx, nextC = cIdx

    if (k === "ArrowLeft") {
      if (cIdx === 0) {
        // ถ้าอยู่เซลล์ซ้ายสุด (ราคา) ให้ขึ้นไปแถวบน คอลัมน์ขวาสุด
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
        // ถ้าอยู่เซลล์ขวาสุด ให้ลงไปแถวถัดไป คอลัมน์แรก (ราคา)
        if (rIdx < productRows.length - 1) {
          nextR = rIdx + 1
          nextC = 0
        }
      } else {
        nextC = cIdx + 1
      }
    }

    if (k === "ArrowUp") nextR = Math.max(0, rIdx - 1)
    if (k === "ArrowDown") nextR = Math.min(productRows.length - 1, rIdx + 1)

    const target = inputRefs.current.get(`${nextR}|${nextC}`)
    if (target) {
      e.preventDefault()
      target.focus()
      try { target.select() } catch {}
      requestAnimationFrame(() => ensureInView(target))
    }
  }, [productRows.length, unitCols.length, ensureInView])

  /** ---------------- Save ---------------- */
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const saveAll = useCallback(async () => {
    if (!branchIdEff || !effectivePlanId || !productRows.length) return
    setIsSaving(true); setSaveMsg(null)
    try {
      const priceItems = products.map((p) => {
        const pid = Number(p.product_id), cur = priceByPid[String(pid)] || {}
        return { product_id: pid, sell_price: toNumber(cur.sell_price ?? p.sell_price ?? 0), buy_price: toNumber(cur.buy_price ?? p.buy_price ?? 0), comment: String(cur.comment ?? p.comment ?? "") }
      })
      await apiAuth(`/unit-prices/bulk`, { method: "PUT", body: { year: Number(effectiveYearBE), items: priceItems } })

      const cells = []
      for (const p of productRows) {
        const pid = Number(p.product_id)
        for (const m of MONTHS) {
          for (const u of unitCols) {
            const uid = Number(u.id), v = qtyByPid?.[String(pid)]?.[m.key]?.[String(uid)] ?? "", n = toNumber(v)
            if (n > 0) cells.push({ unit_id: uid, product_id: pid, month: Number(m.month), amount: n })
          }
        }
      }
      await apiAuth(`/revenue/sale-goals/bulk`, { method: "PUT", body: { plan_id: Number(effectivePlanId), branch_id: Number(branchIdEff), cells } })
      setSaveMsg({ ok: true, title: "บันทึกสำเร็จ", detail: `สาขา ${resolvedBranchName} • ปี ${effectiveYearBE}` })

      await loadSavedFromBE()
      await loadUnitPricesForYear()
    } catch (e) {
      setSaveMsg({ ok: false, title: "บันทึกไม่สำเร็จ", detail: e?.message || String(e) })
    } finally { setIsSaving(false) }
  }, [branchIdEff, effectivePlanId, effectiveYearBE, productRows, products, priceByPid, qtyByPid, unitCols, resolvedBranchName, loadSavedFromBE, loadProducts, loadUnitPricesForYear])

  /** ---------------- rendering helpers ---------------- */
  const stickyShadow = "shadow-[0_0_0_1px_rgba(148,163,184,0.6)] dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]"
  // ปรับขนาด font ใน Header ให้เป็น text-[12px]
  const headCell = "px-1.5 py-1.5 text-[12px] font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-600"
  const leftHeadCell = cx(headCell, "sticky left-0 z-20", stickyShadow)
  // ปรับขนาด font ใน Cell ให้เป็น text-[12px]
  const leftCell = "px-1.5 py-1.5 text-[12px] text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700"
  const leftCellSticky = cx(leftCell, "sticky left-0 z-10", stickyShadow)
  const cellClass = "px-1 py-1 text-[12px] border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
  const rowDivider = "border-b-[2px] border-b-slate-300 dark:border-b-slate-600"
  const footerBorder = "border-t-[2px] border-t-emerald-500 dark:border-t-emerald-600"

  return (
    <>
    <div className="w-full">
      {/* 🟢 แก้ไข: นำปุ่มบันทึกและข้อความแจ้งเตือนออกจากส่วน Header ด้านบน */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[16px] font-bold">ยอดขายธุรกิจจัดหา</div>
          <div className="text-[12px] text-slate-600 dark:text-slate-300">
            ({periodLabel}) • ปี {effectiveYearBE} • สาขา {resolvedBranchName || "-"}
          </div>
        </div>
      </div>

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
              {/* Header Row 1 */}
              <tr>
                <th className={cx(leftHeadCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>
                  ประเภทสินค้า
                </th>
                <th className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>
                  หน่วยนับ
                </th>
                <th className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>
                  ราคาต่อหน่วย<br/>(บาท)
                </th>
                <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")} colSpan={MONTHS.length * unitCols.length}>
                  มูลค่าสินค้าที่ขายในแต่ละเดือน (พันบาท)
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
              {productRows.map((p, rowIdx) => {
                const pid = String(p.product_id), prices = priceByPid[pid] || {}, sell = toNumber(prices.sell_price ?? p.sell_price ?? 0)
                const stripeCls = rowIdx % 2 === 0 ? STRIPE.cellEven : STRIPE.cellOdd

                return (
                  <Fragment key={pid}>
                    {/* ข้อมูล 1: แถวจำนวนหน่วย (Inputs) */}
                    <tr className="group">
                      <td rowSpan={2} className={cx(leftCellSticky, stripeCls, rowDivider, "align-middle")}>
                        <div className="font-semibold">{p.product_type || "-"}</div>
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
                            const n = toNumber(qtyByPid?.[pid]?.[m.key]?.[uid] ?? "")
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
            ยังไม่พบสาขา — กรุณาเลือกสาขาก่อน
          </div>
        )}
        
        {/* 🟢 แก้ไข: ย้ายปุ่มบันทึกและ Alert มาไว้ด้านล่างเหมือนหน้า BusinessPlanExpenseTable */}
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
              onClick={() => { loadSavedFromBE(); loadProducts() }}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              รีเซ็ต
            </button>
            <button
              className={cx(
                "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white transition",
                (isSaving || !canEdit)
                  ? "bg-slate-300 text-slate-700 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:scale-[1.03] active:scale-[.98]"
              )}
              disabled={isSaving || !canEdit}
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

export default ProcurementPlanDetail