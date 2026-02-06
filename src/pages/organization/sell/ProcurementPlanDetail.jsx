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
const fmtQty = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(toNumber(n))
const fmtMoney = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(toNumber(n))

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
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

/** ✅ input พอดีกับ cell + ทึบ */
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

/** fallback (ถ้าโหลดหน่วยไม่ได้) */
const FALLBACK_UNITS = [
  { id: -1, short: "ปร", name: "ปร" },
  { id: -2, short: "รับ", name: "รับ" },
  { id: -3, short: "พร", name: "พร" },
]

/** ✅ lock width ให้ตรงกันทุกส่วน */
const COL_W = {
  product: 260,
  unit: 84,
  price: 130,
  cell: 86, // ช่องย่อยใต้เดือน และช่องรวม
}

const LEFT_W = COL_W.product + COL_W.unit + COL_W.price

/** ✅ Stripe สีเดือน คู่/คี่ ให้เห็นชัดขึ้น */
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

/** business_group=1 = จัดหา */
const PROCUREMENT_GROUP_ID = 1

/** ---------------- helpers ---------------- */
const normalizeUnitName = (s) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")

const shortUnit = (name, idx) => {
  const s = normalizeUnitName(name)
  if (!s) return `หน่วย${idx + 1}`
  // เอา 3 ตัวแรกพอ (กันยาว)
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
 *  ProcurementPlanDetail
 *  - ใช้ลิสสินค้า: /lists/products-by-group-latest?plan_id=...
 *  - โหลด/บันทึกจำนวน: /revenue/sale-goals + /revenue/sale-goals/bulk
 *  - บันทึกราคา: /unit-prices/bulk (fallback /unit-prices)
 *  - plan_id = yearBE-2568 (แบบหน้าค่าใช้จ่าย)
 * ======================================================================= */
function ProcurementPlanDetail({ branchId, branchName, yearBE, planId, onYearBEChange }) {
  const canEdit = !!branchId

  /** Plan แบบแปลงปีเหมือนหน้าค่าใช้จ่าย */
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

  /** ---------------- Units (sub columns under month) ---------------- */
  const [units, setUnits] = useState(FALLBACK_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  useEffect(() => {
    if (!branchId) {
      setUnits(FALLBACK_UNITS)
      return
    }
    let alive = true
    ;(async () => {
      setIsLoadingUnits(true)
      try {
        const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
        const rows = Array.isArray(data) ? data : []
        const normalized = rows
          .map((r, idx) => {
            const id = Number(r.id || 0)
            const name = r.unit_name || r.klang_name || r.unit || r.name || `หน่วย ${id || idx + 1}`
            return { id, name: normalizeUnitName(name), short: shortUnit(name, idx) }
          })
          .filter((x) => x.id > 0)

        if (!alive) return
        setUnits(normalized.length ? normalized : FALLBACK_UNITS)
      } catch (e) {
        console.error("[Units load] failed:", e)
        if (!alive) return
        setUnits(FALLBACK_UNITS)
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [branchId])

  /** ---------------- Products + latest prices (from list) ---------------- */
  const [products, setProducts] = useState([]) // each: {product_id, product_type, unit, sell_price, buy_price, unitprice_id, created_date}
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)

  const [priceByPid, setPriceByPid] = useState({}) // pid => { sell_price, buy_price, comment }
  const [qtyByPid, setQtyByPid] = useState({}) // pid => monthKey => unitId => qty string

  const productIds = useMemo(() => products.map((p) => String(p.product_id)), [products])

  /** widths depend on units */
  const qtyCols = useMemo(() => MONTHS.length * units.length, [units.length])
  const totalCols = useMemo(() => 1 + qtyCols, [qtyCols]) // col 0=ราคา, ที่เหลือ=จำนวน
  const RIGHT_W = useMemo(() => (MONTHS.length * units.length + units.length) * COL_W.cell, [units.length])
  const TOTAL_W = useMemo(() => LEFT_W + RIGHT_W, [RIGHT_W])

  /** ---------------- load products list ---------------- */
  const loadProducts = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0) {
      setProducts([])
      return
    }
    setIsLoadingProducts(true)
    try {
      const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${effectivePlanId}`)
      const g = data?.[String(PROCUREMENT_GROUP_ID)] || data?.[PROCUREMENT_GROUP_ID]
      const items = Array.isArray(g?.items) ? g.items : []

      const normalized = items
        .filter((x) => Number(x.business_group) === PROCUREMENT_GROUP_ID)
        .map((x) => ({
          unitprice_id: x.unitprice_id ?? null,
          plan_id: x.plan_id ?? null,
          product_id: Number(x.product_id || 0),
          product_type: x.product_type || "",
          unit: x.unit || "-",
          business_group: Number(x.business_group || 0),
          sell_price: x.sell_price ?? 0,
          buy_price: x.buy_price ?? 0,
          comment: x.comment ?? "",
          created_date: x.created_date ?? null,
        }))
        .filter((x) => x.product_id > 0)

      setProducts(normalized)

      // init price state from latest list
      const pMap = {}
      for (const it of normalized) {
        pMap[String(it.product_id)] = {
          sell_price: String(it.sell_price ?? ""),
          buy_price: String(it.buy_price ?? ""),
          comment: String(it.comment ?? ""),
        }
      }
      setPriceByPid(pMap)

      // init qty grid skeleton (keep existing values if already loaded)
      setQtyByPid((prev) => {
        const next = { ...prev }
        const uList = units.length ? units : FALLBACK_UNITS
        const empty = buildEmptyQtyGrid(normalized.map((x) => String(x.product_id)), uList)
        for (const pid of Object.keys(empty)) {
          if (!next[pid]) next[pid] = empty[pid]
          else {
            // ensure all months/units exist
            for (const m of MONTHS) {
              if (!next[pid][m.key]) next[pid][m.key] = {}
              for (const u of uList) {
                const uk = String(u.id)
                if (next[pid][m.key][uk] === undefined) next[pid][m.key][uk] = ""
              }
            }
          }
        }
        return next
      })
    } catch (e) {
      console.error("[Products load] failed:", e)
      setProducts([])
    } finally {
      setIsLoadingProducts(false)
    }
  }, [effectivePlanId, units.length])

  /** ---------------- load saved sale goals (quantities) ---------------- */
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const loadSavedFromBE = useCallback(async () => {
    if (!branchId) return
    if (!effectiveYearBE) return
    if (!products.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/revenue/sale-goals?year=${effectiveYearBE}&branch_id=${Number(branchId)}`)
      const cells = Array.isArray(data?.cells) ? data.cells : []

      const uList = units.length ? units : FALLBACK_UNITS
      const uSet = new Set(uList.map((u) => Number(u.id)))
      const pSet = new Set(products.map((p) => Number(p.product_id)))

      // seed empty then fill
      const empty = buildEmptyQtyGrid(products.map((p) => String(p.product_id)), uList)

      for (const c of cells) {
        const pid = Number(c.product_id || 0)
        const uid = Number(c.unit_id || 0)
        const mo = Number(c.month || 0)
        const amt = c.amount ?? c.value ?? 0

        if (!pSet.has(pid)) continue
        if (!uSet.has(uid)) continue
        const monthObj = MONTHS.find((m) => Number(m.month) === mo)
        if (!monthObj) continue

        empty[String(pid)][monthObj.key][String(uid)] = String(Number(amt || 0))
      }

      setQtyByPid(empty)
    } catch (e) {
      console.error("[Load saved sale-goals] failed:", e)
      // ถ้าโหลดไม่ได้ ก็ยังให้กรอกได้
    } finally {
      setIsLoadingSaved(false)
    }
  }, [branchId, effectiveYearBE, products.length, units.length])

  /** load sequence */
  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    // เมื่อได้สินค้าแล้ว ค่อยโหลดค่าที่เคยบันทึก
    loadSavedFromBE()
  }, [loadSavedFromBE])

  /** ---------------- table height ---------------- */
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

  /** scroll sync */
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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  /** ================== Arrow navigation + auto scroll ================== */
  const inputRefs = useRef(new Map())

  const registerInput = useCallback((row, col) => {
    const key = `${row}|${col}`
    return (el) => {
      if (!el) inputRefs.current.delete(key)
      else inputRefs.current.set(key, el)
    }
  }, [])

  const ensureInView = useCallback((el) => {
    const container = bodyScrollRef.current
    if (!container || !el) return

    const pad = 12
    const frozenLeft = COL_W.product

    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()

    const visibleLeft = crect.left + frozenLeft + pad
    const visibleRight = crect.right - pad
    const visibleTop = crect.top + pad
    const visibleBottom = crect.bottom - pad

    if (erect.left < visibleLeft) container.scrollLeft -= visibleLeft - erect.left
    else if (erect.right > visibleRight) container.scrollLeft += erect.right - visibleRight

    if (erect.top < visibleTop) container.scrollTop -= visibleTop - erect.top
    else if (erect.bottom > visibleBottom) container.scrollTop += erect.bottom - visibleBottom
  }, [])

  const handleArrowNav = useCallback(
    (e) => {
      const k = e.key
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) return

      const row = Number(e.currentTarget.dataset.row ?? 0)
      const col = Number(e.currentTarget.dataset.col ?? 0)

      let nextRow = row
      let nextCol = col

      if (k === "ArrowLeft") nextCol = col - 1
      if (k === "ArrowRight") nextCol = col + 1
      if (k === "ArrowUp") nextRow = row - 1
      if (k === "ArrowDown") nextRow = row + 1

      const maxRow = Math.max(0, products.length - 1)
      const maxCol = Math.max(0, totalCols - 1)

      if (nextRow < 0) nextRow = 0
      if (nextRow > maxRow) nextRow = maxRow
      if (nextCol < 0) nextCol = 0
      if (nextCol > maxCol) nextCol = maxCol

      const target = inputRefs.current.get(`${nextRow}|${nextCol}`)
      if (!target) return

      e.preventDefault()
      target.focus()
      try {
        target.select()
      } catch {}
      requestAnimationFrame(() => ensureInView(target))
    },
    [products.length, totalCols, ensureInView]
  )

  /** ---------------- setters ---------------- */
  const setPriceField = (pid, field, value) => {
    setPriceByPid((prev) => {
      const next = { ...prev }
      const cur = next[String(pid)] || { sell_price: "", buy_price: "", comment: "" }
      next[String(pid)] = { ...cur, [field]: value }
      return next
    })
  }

  const setQtyCell = (pid, monthKey, unitId, value) => {
    setQtyByPid((prev) => {
      const next = { ...prev }
      const pKey = String(pid)
      const mKey = String(monthKey)
      const uKey = String(unitId)
      if (!next[pKey]) next[pKey] = {}
      if (!next[pKey][mKey]) next[pKey][mKey] = {}
      next[pKey][mKey] = { ...next[pKey][mKey], [uKey]: value }
      return next
    })
  }

  /** ---------------- totals ---------------- */
  const computed = useMemo(() => {
    // รวมต่อแถว: qtySum, valueSum (sell), costSum (buy)
    const row = {}
    let grandValue = 0
    let grandCost = 0
    let grandQty = 0

    for (const p of products) {
      const pid = String(p.product_id)
      const prices = priceByPid[pid] || {}
      const sell = toNumber(prices.sell_price ?? p.sell_price ?? 0)
      const buy = toNumber(prices.buy_price ?? p.buy_price ?? 0)

      let qtySum = 0
      for (const m of MONTHS) {
        for (const u of units) {
          qtySum += toNumber(qtyByPid?.[pid]?.[m.key]?.[String(u.id)])
        }
      }

      const value = qtySum * sell
      const cost = qtySum * buy

      row[pid] = { qtySum, value, cost }
      grandQty += qtySum
      grandValue += value
      grandCost += cost
    }

    return { row, grandQty, grandValue, grandCost }
  }, [products, priceByPid, qtyByPid, units])

  /** ---------------- save ---------------- */
  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const saveAll = async () => {
    try {
      setNotice(null)
      const token = getToken()
      if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")
      if (!branchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
      if (!effectivePlanId || effectivePlanId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (${effectivePlanId})`)
      if (!effectiveYearBE) throw new Error("FE: yearBE ไม่ถูกต้อง")
      if (!products.length) throw new Error("FE: ไม่มีสินค้าในธุรกิจจัดหา")

      setIsSaving(true)

      /** 1) save unit prices (sell/buy) */
      const priceItems = products.map((p) => {
        const pid = String(p.product_id)
        const cur = priceByPid[pid] || {}
        return {
          product_id: Number(p.product_id),
          sell_price: toNumber(cur.sell_price ?? p.sell_price ?? 0),
          buy_price: toNumber(cur.buy_price ?? p.buy_price ?? 0),
          comment: String(cur.comment ?? p.comment ?? ""),
        }
      })

      // try bulk first
      try {
        await apiAuth(`/unit-prices/bulk`, {
  method: "PUT",
  body: {
    year: Number(effectiveYearBE),      // ✅ เพิ่ม year
    plan_id: Number(effectivePlanId),   // ✅ ส่งไปด้วยเพื่อ backward compatible
    branch_id: Number(branchId),
    items: priceItems,
  },
})

      } catch (e) {
        const st = e?.status
        if (st === 404 || st === 405) {
          // fallback: post per item
          for (const it of priceItems) {
            await apiAuth(`/unit-prices`, {
              method: "POST",
              body: {
                plan_id: effectivePlanId,
                product_id: it.product_id,
                sell_price: it.sell_price,
                buy_price: it.buy_price,
                comment: it.comment,
              },
            })
          }
        } else {
          throw e
        }
      }

      /** 2) save sale goals quantities */
      const cells = []
      for (const p of products) {
        const pid = String(p.product_id)
        for (const m of MONTHS) {
          for (const u of units) {
            const amt = toNumber(qtyByPid?.[pid]?.[m.key]?.[String(u.id)])
            // ส่ง 0 ด้วย เพื่อให้ล้างค่าแล้วทับของเดิมได้แน่นอน
            cells.push({
              unit_id: Number(u.id),
              product_id: Number(p.product_id),
              month: Number(m.month),
              amount: amt,
            })
          }
        }
      }

      await apiAuth(`/revenue/sale-goals/bulk`, {
        method: "PUT",
        body: {
          year: Number(effectiveYearBE),
          branch_id: Number(branchId),
          cells,
        },
      })

      setNotice({
        type: "success",
        title: "บันทึกสำเร็จ ✅",
        detail: `สาขา ${branchName || branchId} • ปี ${effectiveYearBE} (plan_id=${effectivePlanId}) • สินค้า ${products.length} รายการ`,
      })

      // reload latest price list + saved values
      await loadProducts()
      await loadSavedFromBE()
    } catch (e) {
      const status = e?.status || 0
      let title = "บันทึกไม่สำเร็จ ❌"
      let detail = e?.message || String(e)
      if (status === 401) {
        title = "401 Unauthorized"
        detail = "Token ไม่ผ่าน/หมดอายุ → Logout/Login ใหม่"
      } else if (status === 403) {
        title = "403 Forbidden"
        detail = "สิทธิ์ไม่พอ (role ไม่อนุญาต)"
      } else if (status === 404) {
        title = "404 Not Found"
        detail = "ไม่พบ route / ไม่พบข้อมูลที่เกี่ยวข้อง (ดู console)"
      } else if (status === 422) {
        title = "422 Validation Error"
        detail = "รูปแบบข้อมูลไม่ผ่าน schema ของ BE (ดู console)"
      }

      setNotice({ type: "error", title, detail })
      console.groupCollapsed("%c[ProcurementPlanDetail] Save failed ❌", "color:#ef4444;font-weight:800;")
      console.error("status:", status, "title:", title, "detail:", detail)
      console.error("yearBE:", effectiveYearBE, "plan_id:", effectivePlanId)
      console.error("branch_id:", branchId, "branch:", branchName)
      console.error("units:", units)
      console.error("products:", products?.slice(0, 3))
      console.error("raw error:", e)
      console.groupEnd()
    } finally {
      setIsSaving(false)
    }
  }

  const NoticeBox = ({ notice }) => {
    if (!notice) return null
    const isErr = notice.type === "error"
    const isOk = notice.type === "success"
    const cls = isErr
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200"
      : isOk
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
      : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
    return (
      <div className={cx("mb-3 rounded-2xl border p-3 text-sm", cls)}>
        <div className="font-extrabold">{notice.title}</div>
        {notice.detail && <div className="mt-1 text-[13px] opacity-95">{notice.detail}</div>}
      </div>
    )
  }

  /** ---------------- Render ---------------- */
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-bold">
              ประมาณการรายได้ — ธุรกิจจัดหา (รายเดือน)
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              ({periodLabel}) • ปี {effectiveYearBE} • plan_id {effectivePlanId} • สาขา {branchName || "-"} • หน่วย{" "}
              {isLoadingUnits ? "กำลังโหลด..." : units.length}
              {isLoadingProducts ? " • โหลดสินค้า/ราคา..." : ""}
              {isLoadingSaved ? " • โหลดค่าที่บันทึกไว้..." : ""}
            </div>

            <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              รวมทั้งปี (โดยประมาณ):{" "}
              <span className="font-extrabold">{fmtMoney(computed.grandValue)}</span>{" "}
              บาท • ต้นทุน <span className="font-extrabold">{fmtMoney(computed.grandCost)}</span> บาท
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              * กรอก “จำนวน” ระบบคำนวณ “บาท” ให้ (ตามราคาล่าสุดจาก UnitPrice)
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => loadProducts()}
              disabled={isLoadingProducts || isSaving}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         disabled:opacity-60 disabled:cursor-not-allowed
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              รีเฟรชสินค้า/ราคา
            </button>

            <button
              type="button"
              onClick={saveAll}
              disabled={!canEdit || isSaving}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white
                         hover:bg-emerald-700 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         disabled:opacity-60 disabled:cursor-not-allowed"
              title={!canEdit ? "ต้องเลือกสาขาก่อน" : "บันทึกขึ้น BE + กลับมาเห็นค่าล่าสุด"}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</div>
            <div className={baseField}>{branchName || (branchId ? `สาขา id: ${branchId}` : "-")}</div>
          </div>

          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">ปีแผน (พ.ศ.)</div>
            <div className={baseField}>{String(effectiveYearBE)}</div>
          </div>

          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">หมายเหตุ</div>
            <div className={baseField}>
              {products.length ? `สินค้า ${products.length} รายการ` : isLoadingProducts ? "กำลังโหลด..." : "ไม่พบสินค้า"}
            </div>
          </div>
        </div>
      </div>

      <NoticeBox notice={notice} />

      {/* Table */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div
          ref={bodyScrollRef}
          onScroll={onBodyScroll}
          className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700"
        >
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.product }} />
              <col style={{ width: COL_W.unit }} />
              <col style={{ width: COL_W.price }} />

              {/* month cells */}
              {MONTHS.map((m) =>
                units.map((u) => (
                  <col key={`${m.key}-${u.id}`} style={{ width: COL_W.cell }} />
                ))
              )}

              {/* summary per unit at right */}
              {units.map((u) => (
                <col key={`sum-${u.id}`} style={{ width: COL_W.cell }} />
              ))}
            </colgroup>

            <thead className="sticky top-0 z-20">
              {/* Row 1: month group headers */}
              <tr className="text-slate-800 dark:text-slate-100">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 border border-slate-300 px-3 py-3 text-left font-extrabold dark:border-slate-600 bg-slate-100 dark:bg-slate-700"
                >
                  ประเภทสินค้า
                </th>
                <th
                  rowSpan={2}
                  className="border border-slate-300 px-2 py-3 text-center font-bold dark:border-slate-600 bg-slate-100 dark:bg-slate-700"
                >
                  หน่วย
                </th>
                <th
                  rowSpan={2}
                  className="border border-slate-300 px-2 py-3 text-center font-bold dark:border-slate-600 bg-slate-100 dark:bg-slate-700"
                >
                  ราคา/หน่วย
                </th>

                {MONTHS.map((m, idx) => (
                  <th
                    key={m.key}
                    colSpan={units.length}
                    className={cx(
                      "border border-slate-300 px-2 py-3 text-center font-extrabold dark:border-slate-600",
                      monthStripeHead(idx)
                    )}
                  >
                    {m.label}
                  </th>
                ))}

                <th
                  colSpan={units.length}
                  className="border border-slate-300 px-2 py-3 text-center font-extrabold dark:border-slate-600 bg-slate-100 dark:bg-slate-700"
                >
                  รวมทั้งปี
                </th>
              </tr>

              {/* Row 2: unit headers under each month */}
              <tr className="text-slate-800 dark:text-slate-100">
                {MONTHS.map((m, idx) => (
                  <Fragment key={`u-${m.key}`}>
                    {units.map((u) => (
                      <th
                        key={`${m.key}-${u.id}-h`}
                        className={cx(
                          "border border-slate-300 px-2 py-2 text-center text-[12px] font-bold dark:border-slate-600",
                          monthStripeHead(idx)
                        )}
                        title={u.name || u.short}
                      >
                        {u.short || u.name || "-"}
                      </th>
                    ))}
                  </Fragment>
                ))}

                {units.map((u) => (
                  <th
                    key={`sumh-${u.id}`}
                    className="border border-slate-300 px-2 py-2 text-center text-[12px] font-bold dark:border-slate-600 bg-slate-100 dark:bg-slate-700"
                    title={u.name || u.short}
                  >
                    {u.short || u.name || "-"}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {!products.length ? (
                <tr>
                  <td colSpan={3 + MONTHS.length * units.length + units.length} className="p-4 text-center text-slate-500">
                    {isLoadingProducts ? "กำลังโหลดสินค้า..." : "ยังไม่พบสินค้าในธุรกิจจัดหา (group_id=1) ของแผนนี้"}
                  </td>
                </tr>
              ) : (
                products.map((p, rIdx) => {
                  const pid = String(p.product_id)
                  const prices = priceByPid[pid] || {}
                  const sell = prices.sell_price ?? ""
                  const rowComputed = computed.row[pid] || { qtySum: 0, value: 0, cost: 0 }

                  // sum per unit (both months)
                  const sumByUnit = {}
                  for (const u of units) sumByUnit[String(u.id)] = 0
                  for (const m of MONTHS) {
                    for (const u of units) {
                      sumByUnit[String(u.id)] += toNumber(qtyByPid?.[pid]?.[m.key]?.[String(u.id)])
                    }
                  }

                  return (
                    <tr key={pid} className="border-b border-slate-200 dark:border-slate-700">
                      <td className="sticky left-0 z-10 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                        <div className="font-bold">{p.product_type}</div>
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          product_id: {p.product_id}
                        </div>
                      </td>

                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center font-semibold">
                        {p.unit || "-"}
                      </td>

                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-2">
                        <input
                          ref={registerInput(rIdx, 0)}
                          data-row={rIdx}
                          data-col={0}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={String(sell ?? "")}
                          inputMode="decimal"
                          placeholder={String(p.sell_price ?? 0)}
                          onChange={(e) => setPriceField(pid, "sell_price", sanitizeNumberInput(e.target.value))}
                          disabled={!canEdit}
                          title="ราคาขาย/หน่วย (แก้ได้)"
                        />
                        {/* buy_price เก็บไว้ ไม่โชว์ใน UI เพื่อให้ BE คำนวณ cost ได้ */}
                        <input
                          type="hidden"
                          value={String(prices.buy_price ?? p.buy_price ?? 0)}
                          readOnly
                        />
                      </td>

                      {/* months cells */}
                      {MONTHS.map((m, mIdx) => (
                        <Fragment key={`${pid}-${m.key}`}>
                          {units.map((u, uIdx) => {
                            const col = 1 + mIdx * units.length + uIdx
                            return (
                              <td
                                key={`${pid}-${m.key}-${u.id}`}
                                className={cx(
                                  "border border-slate-200 dark:border-slate-700 px-2 py-2",
                                  monthStripeCell(mIdx)
                                )}
                              >
                                <input
                                  ref={registerInput(rIdx, col)}
                                  data-row={rIdx}
                                  data-col={col}
                                  onKeyDown={handleArrowNav}
                                  className={cellInput}
                                  value={qtyByPid?.[pid]?.[m.key]?.[String(u.id)] ?? ""}
                                  inputMode="decimal"
                                  placeholder="0"
                                  onChange={(e) =>
                                    setQtyCell(pid, m.key, String(u.id), sanitizeNumberInput(e.target.value))
                                  }
                                  disabled={!canEdit}
                                />
                              </td>
                            )
                          })}
                        </Fragment>
                      ))}

                      {/* sum per unit */}
                      {units.map((u) => (
                        <td
                          key={`${pid}-sum-${u.id}`}
                          className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right font-bold bg-slate-50 dark:bg-slate-700/30"
                          title="รวมจำนวนทั้งปี (หน่วยนี้)"
                        >
                          {fmtQty(sumByUnit[String(u.id)] || 0)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>

            <tfoot className="sticky bottom-0 z-20">
              <tr className="text-slate-900 dark:text-slate-100">
                <td
                  className="sticky left-0 z-30 border border-slate-300 px-3 py-3 font-extrabold dark:border-slate-600 bg-emerald-100 dark:bg-emerald-900/20"
                >
                  รวมทั้งตาราง
                </td>
                <td className="border border-slate-300 px-2 py-3 text-center font-bold dark:border-slate-600 bg-emerald-100 dark:bg-emerald-900/20">
                  —
                </td>
                <td className="border border-slate-300 px-2 py-3 text-right font-bold dark:border-slate-600 bg-emerald-100 dark:bg-emerald-900/20">
                  {fmtMoney(computed.grandValue)}
                </td>

                {/* keep footer scroll with body */}
                <td
                  colSpan={MONTHS.length * units.length}
                  className="border border-slate-300 px-2 py-3 dark:border-slate-600"
                >
                  <div
                    style={{
                      transform: `translateX(-${scrollLeft}px)`,
                      width: RIGHT_W - units.length * COL_W.cell,
                    }}
                    className="text-xs text-slate-600 dark:text-slate-300"
                  >
                    รวมรายได้ทั้งปี (คำนวณจากจำนวน × ราคาขาย) • รวมต้นทุน (จำนวน × ราคาซื้อ)
                  </div>
                </td>

                {units.map((u) => (
                  <td
                    key={`grand-sum-${u.id}`}
                    className="border border-slate-300 px-2 py-3 text-right font-extrabold dark:border-slate-600 bg-emerald-100 dark:bg-emerald-900/20"
                  >
                    {/* รวมหน่วยทั้งปี (แสดงเป็นจำนวนรวมของทุกสินค้า) */}
                    {(() => {
                      let s = 0
                      for (const p of products) {
                        const pid = String(p.product_id)
                        for (const m of MONTHS) {
                          s += toNumber(qtyByPid?.[pid]?.[m.key]?.[String(u.id)])
                        }
                      }
                      return fmtQty(s)
                    })()}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ProcurementPlanDetail
