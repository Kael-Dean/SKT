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

/** ---------------- Constants ---------------- */
// แผนปีบัญชี เม.ย.–มี.ค.
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

// ✅ ธุรกิจบริการ: ใช้รายการบริการ-ศูนย์ฝึกตามลิสต์
// เปลี่ยน group เป็น 6 (ฝึกอบรม) เพื่อให้ดึง “บริการ-ศูนย์ฝึก” ได้ตรง
const SERVICE_GROUP_ID = 6 // เผื่อ fallback ยิง BE
const SERVICE_TITLE = "ยอดขายธุรกิจบริการ"
const SERVICE_ITEM_NAME = "บริการ-ศูนย์ฝึก"

const normalizeServiceName = (s) =>
  String(s ?? "")
    .trim()
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")

const COL_W = {
  product: 320,
  unit: 80,
  price: 130,
  cell: 86,
}

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

/** ---------------- Styles ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

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

  /** Plan แบบแปลงปีเหมือนหน้าอื่น: 2569 => 1 */
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

  /** -------- Units by branch (เหมือนธุรกิจจัดหา) -------- */
  const [units, setUnits] = useState([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  const loadUnits = useCallback(async () => {
    if (!branchId) {
      setUnits([])
      return
    }
    setIsLoadingUnits(true)
    try {
      const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
      const rows = Array.isArray(data) ? data : []
      const normalized = rows
        .map((r, idx) => {
          const id = Number(r.id || 0)
          const name = r.klang_name || r.unit_name || r.unit || r.name || `หน่วย ${idx + 1}`
          return { id, name: normalizeUnitName(name), short: shortUnit(name, idx) }
        })
        .filter((x) => x.id > 0)
      setUnits(normalized)
    } catch (e) {
      console.error("[service] load units failed:", e)
      setUnits([])
    } finally {
      setIsLoadingUnits(false)
    }
  }, [branchId])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  const savableUnits = useMemo(() => (units || []).filter((u) => Number(u?.id) > 0), [units])

  /** -------- Load service items: only "บริการ-ศูนย์ฝึก" -------- */
  const [items, setItems] = useState([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  const [priceById, setPriceById] = useState({})
  const [qtyById, setQtyById] = useState({})
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [showPayload, setShowPayload] = useState(false)

  const canEdit = !!branchId && !!effectivePlanId && effectivePlanId > 0 && savableUnits.length > 0

  const loadItems = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0) {
      setItems([])
      setPriceById({})
      setQtyById({})
      return
    }

    setIsLoadingItems(true)
    try {
      // 1) พยายามใช้ลิสต์จาก FE ก่อน
      const staticList = getProductsByGroupLatestPricesFromAnySource(props)
      let rows = normalizeStaticListToItems(staticList, SERVICE_GROUP_ID)
      // ถ้ากลุ่มนี้ไม่มีในลิสต์ ให้ไล่หาจากทุกกลุ่ม (เผื่อ BE ย้ายกลุ่ม/คนละ group)
      if (!rows || !rows.length) rows = flattenAnyGroupItems(staticList)

      // 2) fallback ยิง BE ถ้าไม่มีลิสต์
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
        // ✅ คัดเฉพาะรายการชื่อ “บริการ-ศูนย์ฝึก”
        .filter((x) => normalizeServiceName(x.name) === normalizeServiceName(SERVICE_ITEM_NAME))

      setItems(normalized)
      setPriceById(buildInitialPrice(normalized))
      setQtyById((prev) => {
        const empty = buildEmptyQtyGrid(normalized, savableUnits)
        // merge เดิมถ้ามี
        for (const rowId of Object.keys(empty)) {
          if (!prev?.[rowId]) continue
          for (const m of MONTHS) {
            for (const u of savableUnits) {
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
      setItems([])
      setPriceById({})
      setQtyById({})
    } finally {
      setIsLoadingItems(false)
    }
  }, [effectivePlanId, props, savableUnits])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  /** -------- Load saved sale-goals (ทุกหน่วยของสาขา) -------- */
  const loadSaved = useCallback(async () => {
    if (!branchId || !effectivePlanId || effectivePlanId <= 0) return
    if (!items.length) return
    if (!savableUnits.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(
        `/revenue/sale-goals?plan_id=${Number(effectivePlanId)}&branch_id=${Number(branchId)}`
      )
      const cells = Array.isArray(data?.cells) ? data.cells : []

      const pidToRowId = {}
      for (const it of items) pidToRowId[String(it.product_id)] = it.id

      const uSet = new Set(savableUnits.map((u) => Number(u.id)))

      const next = buildEmptyQtyGrid(items, savableUnits)
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
  }, [branchId, effectivePlanId, items, savableUnits])

  useEffect(() => {
    loadSaved()
  }, [loadSaved])

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

  /** -------- Computed (เหมือนธุรกิจจัดหา) -------- */
  const computed = useMemo(() => {
    const perUnitGrand = {}
    for (const u of savableUnits) perUnitGrand[String(u.id)] = 0

    const perRowUnit = {} // {rowId:{uid:sumQty}}
    let grandQty = 0
    let grandValue = 0

    for (const it of items) {
      const rowId = String(it.id)
      perRowUnit[rowId] = {}
      for (const u of savableUnits) perRowUnit[rowId][String(u.id)] = 0

      const pr = priceById[rowId] || {}
      const sell = toNumber(pr.sell_price ?? it.sell_price ?? 0)

      for (const m of MONTHS) {
        for (const u of savableUnits) {
          const uid = String(u.id)
          const raw = qtyById?.[rowId]?.[m.key]?.[uid] ?? ""
          const q = toNumber(raw)
          if (!q) continue

          perRowUnit[rowId][uid] += q
          perUnitGrand[uid] = (perUnitGrand[uid] || 0) + q
          grandQty += q
          grandValue += q * sell
        }
      }
    }

    return { perUnitGrand, perRowUnit, grandQty, grandValue }
  }, [items, qtyById, priceById, savableUnits])

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

  const [isLoadingUnitsPrices, setIsLoadingUnitsPrices] = useState(false)

  const loadLatestPricesIntoRow = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0) return
    if (!items.length) return
    setIsLoadingUnitsPrices(true)
    try {
      // optional: ถ้ามี endpoint list ล่าสุดแล้วจะเอามาทับ
      // ปล่อยไว้เป็นโครง — หน้านี้เน้นกรอกยอดขายรายเดือน/หน่วย
    } finally {
      setIsLoadingUnitsPrices(false)
    }
  }, [effectivePlanId, items])

  useEffect(() => {
    loadLatestPricesIntoRow()
  }, [loadLatestPricesIntoRow])

  const saveAll = useCallback(async () => {
    if (!canEdit) {
      setSaveMsg({ ok: false, title: "บันทึกไม่ได้", detail: "ยังไม่มีสาขา/หน่วยของสาขา/plan_id" })
      return
    }

    setIsSaving(true)
    setSaveMsg(null)
    try {
      // 1) prices (พยายามส่งแบบ plan_id ก่อน ถ้า BE รุ่นเก่าใช้ year)
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

      // 2) goals
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
      // reload saved to ensure latest numbers shown
      setTimeout(() => {
        // fire and forget
        ;(async () => {
          try {
            const data = await apiAuth(
              `/revenue/sale-goals?plan_id=${Number(effectivePlanId)}&branch_id=${Number(branchId)}`
            )
            const cells = Array.isArray(data?.cells) ? data.cells : []

            const pidToRowId = {}
            for (const it of items) pidToRowId[String(it.product_id)] = it.id

            const uSet = new Set(savableUnits.map((u) => Number(u.id)))

            const next = buildEmptyQtyGrid(items, savableUnits)
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
          } catch {}
        })()
      }, 300)
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
  }, [
    canEdit,
    effectivePlanId,
    effectiveYearBE,
    payload.prices,
    payload.cells,
    branchId,
    branchName,
    items,
    savableUnits,
  ])

  /** -------- UI sizes -------- */
  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(520)

  useEffect(() => {
    const calc = () => {
      const vh = window.innerHeight || 800
      // เผื่อ header + form
      setTableCardHeight(Math.max(420, Math.min(760, vh - 280)))
    }
    calc()
    window.addEventListener("resize", calc)
    return () => window.removeEventListener("resize", calc)
  }, [])

  const TOTAL_W = useMemo(() => {
    const unitsCount = Math.max(1, savableUnits.length || 0)
    // 3 fixed + (12 months * units) + (sum * units)
    return (
      COL_W.product +
      COL_W.unit +
      COL_W.price +
      MONTHS.length * unitsCount * COL_W.cell +
      unitsCount * COL_W.cell
    )
  }, [savableUnits.length])

  return (
    <div className="w-full">
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-bold">{SERVICE_TITLE}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              ({periodLabel}) • หน่วย: {savableUnits.length} • รายการ: {items.length} • โหลดค่าที่บันทึก:{" "}
              {isLoadingSaved ? "กำลังโหลด..." : "พร้อม"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPayload((s) => !s)}
              className={cx(
                "rounded-xl border px-3 py-2 text-sm",
                "border-slate-200 bg-slate-50 hover:bg-slate-100",
                "dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
              )}
            >
              {showPayload ? "ซ่อน payload" : "ดู payload"}
            </button>

            <button
              type="button"
              onClick={saveAll}
              disabled={!canEdit || isSaving}
              className={cx(
                "rounded-xl px-4 py-2 text-sm font-semibold transition",
                !canEdit || isSaving
                  ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

        {showPayload && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800
                          dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
            <pre className="max-h-72 overflow-auto">{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}

        {saveMsg && (
          <div
            className={cx(
              "mt-4 rounded-2xl border p-4 text-sm",
              saveMsg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
                : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100"
            )}
          >
            <div className="font-semibold">{saveMsg.title}</div>
            <div className="opacity-90">{saveMsg.detail}</div>
          </div>
        )}
      </div>

      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700">
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.product }} />
              <col style={{ width: COL_W.unit }} />
              <col style={{ width: COL_W.price }} />
              {MONTHS.map((m) =>
                savableUnits.map((u) => <col key={`c-${m.key}-${u.id}`} style={{ width: COL_W.cell }} />)
              )}
              {savableUnits.map((u) => <col key={`c-sum-${u.id}`} style={{ width: COL_W.cell }} />)}
            </colgroup>

            <thead>
              <tr>
                <th className={cx("px-3 py-2 font-semibold border-b border-slate-200 dark:border-slate-700", STRIPE.headEven)}>
                  ประเภทบริการ
                </th>
                <th className={cx("px-2 py-2 font-semibold border-b border-slate-200 dark:border-slate-700 text-center", STRIPE.headEven)}>
                  หน่วย
                </th>
                <th className={cx("px-2 py-2 font-semibold border-b border-slate-200 dark:border-slate-700 text-center", STRIPE.headEven)}>
                  ราคา/หน่วย
                </th>

                {MONTHS.map((m, idx) => (
                  <th
                    key={m.key}
                    className={cx(
                      "px-2 py-2 font-semibold border-b border-slate-200 dark:border-slate-700 text-center",
                      monthStripeHead(idx)
                    )}
                    colSpan={savableUnits.length || 1}
                  >
                    {m.label}
                  </th>
                ))}

                <th className={cx("px-2 py-2 font-semibold border-b border-slate-200 dark:border-slate-700 text-center", STRIPE.headEven)} colSpan={savableUnits.length || 1}>
                  รวม
                </th>
              </tr>

              <tr>
                <th className={cx("px-3 py-2 border-b border-slate-200 dark:border-slate-700", STRIPE.headEven)} />
                <th className={cx("px-2 py-2 border-b border-slate-200 dark:border-slate-700", STRIPE.headEven)} />
                <th className={cx("px-2 py-2 border-b border-slate-200 dark:border-slate-700", STRIPE.headEven)} />

                {MONTHS.map((m, mi) => (
                  <Fragment key={`sub-${m.key}`}>
                    {(savableUnits.length ? savableUnits : [{ id: "_" }]).map((u, ui) => (
                      <th
                        key={`sub-${m.key}-${u.id}`}
                        className={cx(
                          "px-2 py-2 font-semibold border-b border-slate-200 dark:border-slate-700 text-center",
                          monthStripeHead(mi)
                        )}
                      >
                        {savableUnits.length ? (u.short || `U${ui + 1}`) : "—"}
                      </th>
                    ))}
                  </Fragment>
                ))}

                {(savableUnits.length ? savableUnits : [{ id: "_" }]).map((u, ui) => (
                  <th
                    key={`sumh-${u.id}`}
                    className={cx("px-2 py-2 font-semibold border-b border-slate-200 dark:border-slate-700 text-center", STRIPE.headEven)}
                  >
                    {savableUnits.length ? (u.short || `U${ui + 1}`) : "—"}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {items.map((it, rowIdx) => {
                const pr = priceById[it.id] || {}
                return (
                  <tr key={it.id} className={rowIdx % 2 === 0 ? STRIPE.cellEven : STRIPE.cellOdd}>
                    <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                      <div className="font-semibold">{it.name || "-"}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">product_id: {it.product_id}</div>
                    </td>

                    <td className="px-2 py-2 border-b border-slate-200 dark:border-slate-700 text-center font-semibold">
                      {it.unit || "-"}
                    </td>

                    <td className="px-2 py-2 border-b border-slate-200 dark:border-slate-700">
                      <input
                        className={cellInput}
                        inputMode="decimal"
                        value={String(pr.sell_price ?? "")}
                        placeholder={String(it.sell_price ?? 0)}
                        onChange={(e) => setPriceField(it.id, "sell_price", sanitizeNumberInput(e.target.value))}
                      />
                      <input type="hidden" value={String(pr.buy_price ?? it.buy_price ?? 0)} readOnly />
                    </td>

                    {MONTHS.map((m, mi) => (
                      <Fragment key={`${it.id}-${m.key}`}>
                        {(savableUnits.length ? savableUnits : [{ id: "_" }]).map((u) => {
                          const uid = String(u.id)
                          const v = qtyById?.[String(it.id)]?.[m.key]?.[uid] ?? ""
                          return (
                            <td
                              key={`${it.id}-${m.key}-${uid}`}
                              className={cx(
                                "px-1 py-1 border-b border-slate-200 dark:border-slate-700",
                                monthStripeCell(mi)
                              )}
                            >
                              <input
                                className={cellInput}
                                inputMode="decimal"
                                value={String(v ?? "")}
                                onChange={(e) =>
                                  setQtyCell(String(it.id), m.key, uid, sanitizeNumberInput(e.target.value))
                                }
                              />
                            </td>
                          )
                        })}
                      </Fragment>
                    ))}

                    {(savableUnits.length ? savableUnits : [{ id: "_" }]).map((u) => {
                      const uid = String(u.id)
                      const sumU = computed.perRowUnit?.[String(it.id)]?.[uid] || 0
                      return (
                        <td
                          key={`${it.id}-sum-${uid}`}
                          className={cx(
                            "px-2 py-2 border-b border-slate-200 dark:border-slate-700 text-right font-semibold",
                            STRIPE.footEven
                          )}
                        >
                          {fmtQty(sumU)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              <tr className={STRIPE.footOdd}>
                <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 font-bold">รวมทั้งสิ้น</td>
                <td className="px-2 py-2 border-b border-slate-200 dark:border-slate-700" />
                <td className="px-2 py-2 border-b border-slate-200 dark:border-slate-700 text-right font-bold">
                  {fmtMoney(computed.grandValue)}
                </td>

                {MONTHS.map((m) => (
                  <Fragment key={`g-${m.key}`}>
                    {(savableUnits.length ? savableUnits : [{ id: "_" }]).map((u) => (
                      <td key={`g-${m.key}-${u.id}`} className="px-2 py-2 border-b border-slate-200 dark:border-slate-700" />
                    ))}
                  </Fragment>
                ))}

                {(savableUnits.length ? savableUnits : [{ id: "_" }]).map((u) => (
                  <td
                    key={`g-sum-${u.id}`}
                    className="px-2 py-2 border-b border-slate-200 dark:border-slate-700 text-right font-bold"
                  >
                    {fmtQty(computed.perUnitGrand?.[String(u.id)] || 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {!canEdit && (
          <div className="p-3 text-sm text-amber-900 bg-amber-50 border-t border-amber-200 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            ยังไม่พร้อมบันทึก — กรุณาเลือกสาขา และรอโหลดหน่วย/รายการให้ครบ
          </div>
        )}
      </div>
    </div>
  )
}

export default ServiceBusinessPlanDetail
