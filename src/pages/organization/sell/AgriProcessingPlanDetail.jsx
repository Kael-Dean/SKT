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
const fmtMoney = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(toNumber(n))

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

/** ✅ token robust: รองรับหลาย key + กัน Bearer ซ้ำ */
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

const COL_W = {
  product: 260,
  unit: 84,
  price: 130,
  cell: 86,
}
const LEFT_W = COL_W.product + COL_W.unit + COL_W.price

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

/** ✅ business_group ของ “แปรรูป” */
const PROCESSING_GROUP_ID = 4

/** ---------------- helpers ---------------- */
const normalizeUnitName = (s) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")

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
 * AgriProcessingPlanDetail (STYLE + SAVE LIKE PROCUREMENT)
 * ======================================================================= */
function AgriProcessingPlanDetail(props) {
  const { branchId, branch_id, branch, selectedBranch, branchName, yearBE, planId } = props || {}

  /** Units */
  const [units, setUnits] = useState(FALLBACK_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  /** ---------------- Branch resolver ---------------- */
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

  useEffect(() => {
    const bId =
      _pickNumber(branchId) ||
      _pickNumber(branch_id) ||
      _pickNumber(branch?.id) ||
      _pickNumber(selectedBranch?.id) ||
      _pickNumber(selectedBranch?.branch_id) ||
      null

    setResolvedBranchId(bId)
    setResolvedBranchName(
      String(branchName || branch?.branch_name || selectedBranch?.branch_name || selectedBranch?.name || "").trim()
    )
  }, [_pickNumber, branchId, branch_id, branch, selectedBranch, branchName])

  const branchIdEff = resolvedBranchId

  /** ---------------- plan/year ---------------- */
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

  /** label */
  const periodLabel = useMemo(() => {
    // แผนปีบัญชี 1 เม.ย. - 31 มี.ค. (ใช้แบบเดิม)
    return "เม.ย.–มี.ค."
  }, [])

  /** ---------------- load units by branch ---------------- */
  const loadUnits = useCallback(async () => {
    if (!branchIdEff) {
      setUnits(FALLBACK_UNITS)
      return
    }
    setIsLoadingUnits(true)
    try {
      const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchIdEff)}`)
      const rows = Array.isArray(data) ? data : []
      const normalized = rows
        .map((r, idx) => {
          const id = Number(r.id || 0)
          const nm = normalizeUnitName(r.unit_name || r.unit || r.name || "")
          return { id, name: nm, short: shortUnit(nm, idx) }
        })
        .filter((x) => x.id > 0)

      setUnits(normalized.length ? normalized : FALLBACK_UNITS)
    } catch (e) {
      console.error("[Units load] failed:", e)
      setUnits(FALLBACK_UNITS)
    } finally {
      setIsLoadingUnits(false)
    }
  }, [branchIdEff])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  /** ---------------- unit prices map (latest cost/sell) ---------------- */
  const [unitPriceMap, setUnitPriceMap] = useState({})
  const [isLoadingUnitPrices, setIsLoadingUnitPrices] = useState(false)

  const loadUnitPricesForYear = useCallback(async () => {
    setIsLoadingUnitPrices(true)
    try {
      const data = await apiAuth(`/unit-prices?year=${Number(effectiveYearBE)}`)
      const rows = Array.isArray(data) ? data : []
      const map = {}
      for (const r of rows) {
        const pid = Number(r.product_id || r.product || 0)
        if (!pid) continue
        map[String(pid)] = {
          sell_price: toNumber(r.sell_price ?? 0),
          buy_price: toNumber(r.buy_price ?? 0),
          comment: String(r.comment ?? ""),
        }
      }
      setUnitPriceMap(map)
    } catch (e) {
      console.warn("[Load unit-prices] failed:", e)
      setUnitPriceMap({})
    } finally {
      setIsLoadingUnitPrices(false)
    }
  }, [effectiveYearBE])

  useEffect(() => {
    loadUnitPricesForYear()
  }, [loadUnitPricesForYear])

  /** ---------------- products + grid state ---------------- */
  const [products, setProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)

  // savableUnits: ใช้ units จริงเท่านั้น (id > 0)
  const savableUnits = useMemo(() => (units || []).filter((u) => Number(u.id) > 0), [units])

  const [priceByPid, setPriceByPid] = useState({})
  const [qtyByPid, setQtyByPid] = useState({})

  const loadProducts = useCallback(async () => {
    if (!effectivePlanId) return
    setIsLoadingProducts(true)
    try {
      const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${effectivePlanId}`)
      const g = data?.[String(PROCESSING_GROUP_ID)] || data?.[PROCESSING_GROUP_ID]
      const items = Array.isArray(g?.items) ? g.items : []

      // ✅ merge ราคาจาก unitPriceMap (ต้นทุนการขายที่เคยบันทึกไว้)
      const normalized = items
        .filter((x) => Number(x.business_group) === PROCESSING_GROUP_ID)
        .map((x) => {
          const pid = Number(x.product_id || x.id || 0)
          const fromCost = unitPriceMap[String(pid)] || {}
          return {
            product_id: pid,
            product_type: String(x.product_type || x.name || x.product || "").trim(),
            unit: String(x.unit || x.unit_name || "-").trim() || "-",
            business_group: Number(x.business_group || PROCESSING_GROUP_ID),
            sell_price: fromCost.sell_price ?? toNumber(x.sell_price ?? 0),
            buy_price: fromCost.buy_price ?? toNumber(x.buy_price ?? 0),
            comment: fromCost.comment ?? String(x.comment ?? ""),
          }
        })
        .filter((x) => x.product_id > 0)

      setProducts(normalized)

      const pMap = {}
      for (const it of normalized) {
        pMap[String(it.product_id)] = {
          sell_price: String(it.sell_price ?? ""),
          buy_price: String(it.buy_price ?? ""),
          comment: String(it.comment ?? ""),
        }
      }
      setPriceByPid(pMap)

      setQtyByPid((prev) => {
        const next = { ...prev }
        const uList = savableUnits.length ? savableUnits : []
        const empty = buildEmptyQtyGrid(normalized.map((x) => String(x.product_id)), uList)
        for (const pid of Object.keys(empty)) {
          if (!next[pid]) next[pid] = empty[pid]
          else {
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
  }, [effectivePlanId, savableUnits, unitPriceMap])

  /** Load saved quantities */
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const loadSavedFromBE = useCallback(async () => {
    if (!branchIdEff) return
    if (!effectivePlanId || effectivePlanId <= 0) return
    if (!products.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(
        `/revenue/sale-goals?plan_id=${Number(effectivePlanId)}&branch_id=${Number(branchIdEff)}`
      )
      const cells = Array.isArray(data?.cells) ? data.cells : []

      const uList = savableUnits.length ? savableUnits : []
      const uSet = new Set(uList.map((u) => Number(u.id)))
      const pSet = new Set(products.map((p) => Number(p.product_id)))

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
    } finally {
      setIsLoadingSaved(false)
    }
  }, [branchIdEff, effectivePlanId, products, savableUnits])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    loadSavedFromBE()
  }, [loadSavedFromBE])

  /** ---------------- table computed ---------------- */
  const unitCols = useMemo(() => {
    const list = (units || []).slice()
    if (!list.length) return FALLBACK_UNITS
    return list.map((u, idx) => ({ ...u, short: u.short || shortUnit(u.name || u.unit || u.unit_name || "", idx) }))
  }, [units])

  const productRows = useMemo(() => {
    const list = Array.isArray(products) ? products : []
    return list
      .filter((p) => Number(p.business_group) === PROCESSING_GROUP_ID)
      .map((p) => ({
        ...p,
        product_id: Number(p.product_id),
        product_type: String(p.product_type || "").trim(),
        unit: String(p.unit || "-").trim() || "-",
      }))
  }, [products])

  const setPriceField = useCallback((pid, field, value) => {
    setPriceByPid((prev) => {
      const next = { ...prev }
      const cur = next[String(pid)] || { sell_price: "", buy_price: "", comment: "" }
      next[String(pid)] = { ...cur, [field]: value }
      return next
    })
  }, [])

  const setQtyField = useCallback((pid, mKey, uKey, value) => {
    setQtyByPid((prev) => {
      const next = { ...prev }
      const pKey = String(pid)
      if (!next[pKey]) next[pKey] = {}
      if (!next[pKey][mKey]) next[pKey][mKey] = {}
      next[pKey][mKey] = { ...next[pKey][mKey], [uKey]: value }
      return next
    })
  }, [])

  const sums = useMemo(() => {
    const perUnit = {}
    for (const u of unitCols) perUnit[String(u.id)] = 0
    const perMonth = {}
    for (const m of MONTHS) perMonth[m.key] = 0
    let grandQty = 0
    let grandValue = 0
    let grandCost = 0

    for (const p of productRows) {
      const pid = String(p.product_id)
      const prices = priceByPid[pid] || {}
      const sell = toNumber(prices.sell_price ?? p.sell_price ?? 0)
      const buy = toNumber(prices.buy_price ?? p.buy_price ?? 0)

      for (const m of MONTHS) {
        let sumMonth = 0
        for (const u of unitCols) {
          const uid = String(u.id)
          const v = qtyByPid?.[pid]?.[m.key]?.[uid] ?? ""
          const n = toNumber(v)
          sumMonth += n
          perUnit[uid] = (perUnit[uid] || 0) + n
        }
        perMonth[m.key] += sumMonth
        grandQty += sumMonth
        grandValue += sumMonth * sell
        grandCost += sumMonth * buy
      }
    }

    return { perUnit, perMonth, grandQty, grandValue, grandCost }
  }, [productRows, priceByPid, qtyByPid, unitCols])

  /** ---------------- Save ---------------- */
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const canEdit = !!branchIdEff && !!savableUnits.length

  const saveAll = useCallback(async () => {
    if (!branchIdEff) throw new Error("FE: ยังไม่มี branch_id")
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (${effectivePlanId})`)
    if (!productRows.length) throw new Error("FE: ไม่มีรายการสินค้าให้บันทึก")
    const uList = savableUnits.length ? savableUnits : []
    if (!uList.length) throw new Error("FE: ไม่มีหน่วยของสาขาให้บันทึก")

    setIsSaving(true)
    setSaveMsg(null)

    try {
      // 1) Save unit prices
      const priceItems = products.map((p) => {
        const pid = Number(p.product_id)
        const cur = priceByPid[String(pid)] || {}
        return {
          product_id: pid,
          sell_price: toNumber(cur.sell_price ?? p.sell_price ?? 0),
          buy_price: toNumber(cur.buy_price ?? p.buy_price ?? 0),
          comment: String(cur.comment ?? p.comment ?? ""),
        }
      })

      // bulk first
      try {
        await apiAuth(`/unit-prices/bulk`, {
          method: "PUT",
          body: { year: Number(effectiveYearBE), items: priceItems },
        })
      } catch (e) {
        // fallback single
        try {
          for (const it of priceItems) {
            await apiAuth(`/unit-prices`, {
              method: "PUT",
              body: {
                year: Number(effectiveYearBE),
                product_id: it.product_id,
                sell_price: it.sell_price,
                buy_price: it.buy_price,
                comment: it.comment,
              },
            })
          }
        } catch (e2) {
          console.warn("[Save unit-prices fallback] failed:", e2)
        }
      }

      // 2) Save sale goals (qty grid)
      const cells = []
      for (const p of productRows) {
        const pid = Number(p.product_id)
        for (const m of MONTHS) {
          for (const u of uList) {
            const uid = Number(u.id)
            const v = qtyByPid?.[String(pid)]?.[m.key]?.[String(uid)] ?? ""
            const n = toNumber(v)
            if (!n) continue
            cells.push({
              unit_id: uid,
              product_id: pid,
              month: Number(m.month),
              amount: n,
            })
          }
        }
      }

      await apiAuth(`/revenue/sale-goals/bulk`, {
        method: "PUT",
        body: {
          plan_id: Number(effectivePlanId),
          branch_id: Number(branchIdEff),
          cells,
        },
      })

      setSaveMsg({
        ok: true,
        title: "บันทึกสำเร็จ",
        detail: `สาขา ${resolvedBranchName || branchIdEff} • ปี ${effectiveYearBE} (plan_id=${effectivePlanId}) • สินค้า ${products.length} รายการ`,
      })

      await loadSavedFromBE()
      await loadProducts()
      await loadUnitPricesForYear()
    } catch (e) {
      console.error("[Save] failed:", e)
      setSaveMsg({
        ok: false,
        title: "บันทึกไม่สำเร็จ",
        detail: e?.message || String(e),
      })
    } finally {
      setIsSaving(false)
    }
  }, [
    branchIdEff,
    effectivePlanId,
    effectiveYearBE,
    productRows,
    products,
    priceByPid,
    qtyByPid,
    savableUnits,
    resolvedBranchName,
    loadSavedFromBE,
    loadProducts,
    loadUnitPricesForYear,
  ])

  /** ---------------- rendering helpers ---------------- */
  const tableWrapRef = useRef(null)

  const stickyShadow = "shadow-[0_0_0_1px_rgba(148,163,184,0.6)] dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]"
  const headCell =
    "px-2 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-300/70 dark:border-slate-600/60"
  const leftHeadCell = cx(headCell, "sticky left-0 z-20", stickyShadow)
  const leftCell =
    "px-2 py-2 text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200/70 dark:border-slate-700/60"
  const leftCellSticky = cx(leftCell, "sticky left-0 z-10", stickyShadow)
  const cellClass =
    "px-1 py-1 border-b border-slate-200/70 dark:border-slate-700/60 text-slate-900 dark:text-slate-100"

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-2 py-1 text-right text-[13px] outline-none " +
    "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
    "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

  const TOTAL_W = useMemo(() => {
    const monthCells = MONTHS.length * unitCols.length * COL_W.cell
    const sumCells = unitCols.length * COL_W.cell
    return LEFT_W + monthCells + sumCells
  }, [unitCols])

  const sectionTitle = "text-[18px] font-bold text-slate-900 dark:text-slate-100"
  const subText = "text-sm text-slate-600 dark:text-slate-300"

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <div className={sectionTitle}>ยอดขายธุรกิจแปรรูป</div>
          <div className={subText}>
            ({periodLabel}) • ปี {effectiveYearBE} • plan_id {effectivePlanId} • สาขา {resolvedBranchName || "-"} • หน่วย{" "}
            {isLoadingUnits ? "กำลังโหลด..." : units.length}
            {isLoadingProducts ? " • โหลดสินค้า/ราคา..." : ""}
            {isLoadingUnitPrices ? " • โหลดต้นทุนการขาย..." : ""}
            {isLoadingSaved ? " • โหลดค่าที่เคยบันทึก..." : ""}
          </div>
        </div>
      </div>

      {saveMsg && (
        <div
          className={cx(
            "mb-4 rounded-2xl border p-4 text-sm",
            saveMsg.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100"
          )}
        >
          <div className="font-semibold">{saveMsg.title}</div>
          <div className="opacity-90">{saveMsg.detail}</div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700" ref={tableWrapRef}>
          <table className="min-w-full border-collapse" style={{ width: TOTAL_W }}>
            <colgroup>
              <col style={{ width: COL_W.product }} />
              <col style={{ width: COL_W.unit }} />
              <col style={{ width: COL_W.price }} />
              {MONTHS.map((m) =>
                unitCols.map((u) => <col key={`${m.key}-${u.id}`} style={{ width: COL_W.cell }} />)
              )}
              {unitCols.map((u) => (
                <col key={`sum-${u.id}`} style={{ width: COL_W.cell }} />
              ))}
            </colgroup>

            <thead>
              <tr>
                <th className={cx(leftHeadCell, STRIPE.headEven)} style={{ width: COL_W.product }}>
                  ประเภทสินค้า
                </th>
                <th className={cx(headCell, STRIPE.headEven)} style={{ width: COL_W.unit }}>
                  หน่วย
                </th>
                <th className={cx(headCell, STRIPE.headEven)} style={{ width: COL_W.price }}>
                  ราคา/หน่วย
                </th>

                {MONTHS.map((m, mi) => (
                  <th key={m.key} className={cx(headCell, monthStripeHead(mi))} colSpan={unitCols.length}>
                    {m.label}
                  </th>
                ))}

                <th className={cx(headCell, STRIPE.headEven)} colSpan={unitCols.length}>
                  รวม
                </th>
              </tr>

              <tr>
                <th className={cx(leftHeadCell, STRIPE.headEven)} style={{ width: COL_W.product }} />
                <th className={cx(headCell, STRIPE.headEven)} style={{ width: COL_W.unit }} />
                <th className={cx(headCell, STRIPE.headEven)} style={{ width: COL_W.price }} />

                {MONTHS.map((m, mi) => (
                  <Fragment key={`sub-${m.key}`}>
                    {unitCols.map((u) => (
                      <th key={`${m.key}-${u.id}-sub`} className={cx(headCell, monthStripeCell(mi))}>
                        {u.short}
                      </th>
                    ))}
                  </Fragment>
                ))}

                {unitCols.map((u) => (
                  <th key={`sum-h-${u.id}`} className={cx(headCell, STRIPE.headEven)}>
                    {u.short}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {productRows.map((p, idx) => {
                const pid = String(p.product_id)
                const prices = priceByPid[pid] || {}
                const sellPrice = prices.sell_price ?? ""
                const rowKey = `row-${pid}`

                return (
                  <tr key={rowKey}>
                    <td className={cx(leftCellSticky, idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)} style={{ width: COL_W.product }}>
                      <div className="font-semibold">{p.product_type || "-"}</div>
                      <div className="text-xs text-slate-500">product_id: {p.product_id}</div>
                    </td>

                    <td className={cx(cellClass, idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)} style={{ width: COL_W.unit }}>
                      <div className="text-center font-semibold">{p.unit || "-"}</div>
                    </td>

                    <td className={cx(cellClass, idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)} style={{ width: COL_W.price }}>
                      <input
                        className={inputClass}
                        value={String(sellPrice)}
                        disabled={!canEdit}
                        onChange={(e) => setPriceField(pid, "sell_price", sanitizeNumberInput(e.target.value))}
                      />
                    </td>

                    {MONTHS.map((m, mi) => (
                      <Fragment key={`${pid}-${m.key}`}>
                        {unitCols.map((u) => {
                          const uid = String(u.id)
                          const v = qtyByPid?.[pid]?.[m.key]?.[uid] ?? ""
                          return (
                            <td key={`${pid}-${m.key}-${uid}`} className={cx(cellClass, monthStripeCell(mi))}>
                              <input
                                className={inputClass}
                                value={String(v)}
                                disabled={!canEdit}
                                onChange={(e) => setQtyField(pid, m.key, uid, sanitizeNumberInput(e.target.value))}
                              />
                            </td>
                          )
                        })}
                      </Fragment>
                    ))}

                    {unitCols.map((u) => {
                      const uid = String(u.id)
                      let sumU = 0
                      for (const m of MONTHS) {
                        sumU += toNumber(qtyByPid?.[pid]?.[m.key]?.[uid] ?? 0)
                      }
                      return (
                        <td key={`${pid}-sum-${uid}`} className={cx(cellClass, STRIPE.footEven)}>
                          <div className="text-right font-semibold">{fmtQty(sumU)}</div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {/* totals row */}
              <tr>
                <td className={cx(leftCellSticky, STRIPE.footOdd)} style={{ width: COL_W.product }}>
                  <div className="font-bold">รวมทั้งสิ้น</div>
                </td>

                <td className={cx(cellClass, STRIPE.footOdd)} style={{ width: COL_W.unit }} />
                <td className={cx(cellClass, STRIPE.footOdd)} style={{ width: COL_W.price }}>
                  <div className="text-right font-bold">{fmtMoney(sums.grandValue)}</div>
                </td>

                {MONTHS.map((m, mi) => (
                  <Fragment key={`total-${m.key}`}>
                    {unitCols.map((u) => (
                      <td key={`total-${m.key}-${u.id}`} className={cx(cellClass, STRIPE.footOdd)} />
                    ))}
                  </Fragment>
                ))}

                {unitCols.map((u) => (
                  <td key={`g-sum-${u.id}`} className={cx(cellClass, STRIPE.footOdd)}>
                    <div className="text-right font-bold">{fmtQty(sums.perUnit[String(u.id)] || 0)}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {!canEdit && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            ยังไม่พบสาขา/branch_id — กรุณาเลือกสาขาก่อน ถึงจะบันทึกได้
          </div>
        )}
      </div>

      {/* Floating Save Button (bottom-right) */}
      <div className="fixed bottom-6 right-6 z-[80]">
        <button
          type="button"
          className={cx(
            "rounded-2xl px-6 py-3 font-semibold shadow-lg transition",
            isSaving || !canEdit
              ? "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300 cursor-not-allowed"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          )}
          disabled={isSaving || !canEdit}
          onClick={() => saveAll()}
        >
          {isSaving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  )
}

export default AgriProcessingPlanDetail
