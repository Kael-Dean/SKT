import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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
const fmtMoney0 = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

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
const readonlyField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black shadow-none dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100"

const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] md:text-[13px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const trunc = "whitespace-nowrap overflow-hidden text-ellipsis"

/** ---------------- Business group ----------------
 * ✅ หน้านี้ให้ใช้ business id = 8 (ตามที่ขอ)
 * หมายเหตุ: ระบบ BE ใช้ mapping ผ่านตาราง businesscosts ด้วยคู่ค่า (cost_id + business_group)
 */
const BUSINESS_GROUP_ID = 8

/** ---------------- Dynamic Mapping: cost_id + business_group -> businesscosts.id ----------------
 * พยายามดึง mapping จาก BE โดยตรงเพื่อให้ "แมพครบ" ตาม DB ล่าสุด
 * (ถ้า BE ไม่มี endpoint นี้จริง ๆ จะเห็นรายการยังไม่แมพ และจะบล็อกตอนบันทึกถ้ามีการกรอกตัวเลข)
 */
async function fetchBusinessCostsByGroup(businessGroupId) {
  const candidates = [
    `/lists/businesscosts/search?business_group=${businessGroupId}`,
    `/lists/businesscosts/search?business_group_id=${businessGroupId}`,
    `/lists/business-costs/search?business_group=${businessGroupId}`,
    `/lists/business-costs/search?business_group_id=${businessGroupId}`,
    `/businesscosts/search?business_group=${businessGroupId}`,
    `/businesscosts/search?business_group_id=${businessGroupId}`,
  ]

  let lastErr = null
  for (const path of candidates) {
    try {
      const data = await apiAuth(path)
      // รองรับหลายรูปแบบ: list ตรง ๆ หรือ {rows: []} หรือ {data: []}
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.data)
        ? data.data
        : []

      const normalized = rows
        .map((r) => ({
          id: Number(r.id || 0),
          cost_id: Number(r.cost_id || r.costId || 0),
          business_group: Number(r.business_group || r.businessGroup || r.business_group_id || businessGroupId || 0),
        }))
        .filter((r) => r.id > 0 && r.cost_id > 0)

      // ถ้า endpoint ตอบมาเป็นลิสว่าง เราถือว่ายังไม่เจอ → ลองตัวถัดไป
      if (!normalized.length) continue
      return { rows: normalized, from: path }
    } catch (e) {
      lastErr = e
      // ลอง endpoint ถัดไป
    }
  }

  const msg =
    lastErr?.message ||
    "ไม่พบ endpoint สำหรับโหลด mapping businesscosts (ลองหลาย path แล้ว)"
  throw new ApiError(msg, { status: lastErr?.status || 0, cause: lastErr })
}

/** ---------------- Rows: ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ ---------------- */
const ROWS = [
  { code: "8", label: "ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ", kind: "section" },

  { code: "8.1", label: "เงินเดือนและค่าจ้าง", kind: "item", cost_id: 7 },
  { code: "8.2", label: "ค่าเบี้ยเลี้ยงทำงานวันหยุด", kind: "item", cost_id: 8 },
  { code: "8.3", label: "ค่าเครื่องเขียนแบบพิมพ์", kind: "item", cost_id: 34 },
  { code: "8.4", label: "ค่าของใช้สำนักงาน", kind: "item", cost_id: 26 },

  { code: "8.5", label: "ค่าวัสดุสนง.", kind: "item", cost_id: 71 },

  { code: "8.6", label: "ค่าโทรศัพท์", kind: "item", cost_id: 14 },
  { code: "8.7", label: "ค่าไฟฟ้า", kind: "item", cost_id: 16 },
  { code: "8.8", label: "ค่าใช้จ่ายยานพาหนะ", kind: "item", cost_id: 11 },
  { code: "8.9", label: "ค่าซ่อมแซมบำรุงรักษาครุภัณฑ์", kind: "item", cost_id: 10 },
  { code: "8.10", label: "ค่าเสื่อมราคาครุภัณฑ์", kind: "item", cost_id: 18 },
  { code: "8.11", label: "ค่าเสื่อมราคาอาคาร", kind: "item", cost_id: 19 },
  { code: "8.12", label: "ค่าป้ายหนัง จนท", kind: "item", cost_id: 21 },
  { code: "8.13", label: "ค่าตกแต่งภูมิทัศน์", kind: "item", cost_id: 54 },
  { code: "8.14", label: "สวัสดิการจนท.", kind: "item", cost_id: 66 },
  { code: "8.15", label: "ค่าน้ำมันเชื้อเพลิง", kind: "item", cost_id: 23 },
  { code: "8.16", label: "ค่าตอบแทนประจำตำแหน่ง", kind: "item", cost_id: 90 },
  { code: "8.17", label: "ค่าใช้จ่ายงานบ้านงานครัว", kind: "item", cost_id: 65 },
  { code: "8.18", label: "ค่าเบี้ยประกันภัย", kind: "item", cost_id: 9 },
  { code: "8.19", label: "ค่าซ่อมแซมบำรุงรักษาอาคาร", kind: "item", cost_id: 31 },
  { code: "8.20", label: "ค่าซ่อมแซมบำรุงรักษายานพาหนะ", kind: "item", cost_id: 28 },
  { code: "8.21", label: "ค่าธรรมเนียมในการโอนเงิน", kind: "item", cost_id: 63 },

  { code: "8.23", label: "เงินสมทบกองทุนประกันสังคม", kind: "item", cost_id: 64 },
  { code: "8.24", label: "ค่าภาษีโรงเรือน", kind: "item", cost_id: 35 },
  { code: "8.25", label: "ค่าของขวัญสมาคม", kind: "item", cost_id: 62 },
  { code: "8.26", label: "ค่าจ้างทำความสะอาด สนง.", kind: "item", cost_id: 93 },
  { code: "8.27", label: "ค่าใช้จ่ายเบ็ดเตล็ด", kind: "item", cost_id: 36 },
]

/** ---------------- Table sizing ---------------- */
const COL_W = { code: 56, item: 260, unit: 130, total: 90 }
const LEFT_W = COL_W.code + COL_W.item
const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

const BusinessPlanExpenseServiceTable = (props = {}) => {
  const { branchId, branchName, yearBE, planId } = props

  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])

  const effectiveBranchId = useMemo(() => Number(branchId || 0) || 0, [branchId])
  const effectiveBranchName = useMemo(
    () => branchName || (effectiveBranchId ? `สาขา id: ${effectiveBranchId}` : "-"),
    [branchName, effectiveBranchId]
  )

  // ✅ ใช้ planId จากตัวแม่ (fallback: yearBE-2568)
  const effectivePlanId = useMemo(() => {
    const p = Number(planId || 0)
    if (Number.isFinite(p) && p > 0) return p
    const y = Number(yearBE || 0)
    if (Number.isFinite(y) && y >= 2500) return y - 2568
    return 0
  }, [planId, yearBE])

  const effectiveYear = useMemo(() => {
    const y = Number(yearBE || 0)
    if (Number.isFinite(y) && y >= 2500) return y
    // fallback ไม่เดาเยอะ
    return 2569
  }, [yearBE])

  const defaultPeriodLabel = useMemo(() => {
    const yy = String(effectiveYear).slice(-2)
    const yyNext = String(effectiveYear + 1).slice(-2)
    return `1 เม.ย.${yy}-31 มี.ค.${yyNext}`
  }, [effectiveYear])

  const [period, setPeriod] = useState(defaultPeriodLabel)
  useEffect(() => setPeriod(defaultPeriodLabel), [defaultPeriodLabel])

  /** ---------------- BusinessCosts mapping (จาก DB) ---------------- */
  const [businessCosts, setBusinessCosts] = useState([])
  const [isLoadingBusinessCosts, setIsLoadingBusinessCosts] = useState(false)
  const [businessCostsFrom, setBusinessCostsFrom] = useState("")
  const [businessCostsErr, setBusinessCostsErr] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setIsLoadingBusinessCosts(true)
      setBusinessCostsErr(null)
      try {
        const out = await fetchBusinessCostsByGroup(BUSINESS_GROUP_ID)
        if (!alive) return
        setBusinessCosts(out.rows || [])
        setBusinessCostsFrom(out.from || "")
      } catch (e) {
        console.error("[BusinessCosts mapping load] failed:", e)
        if (!alive) return
        setBusinessCosts([])
        setBusinessCostsFrom("")
        setBusinessCostsErr(e?.message || String(e))
      } finally {
        if (alive) setIsLoadingBusinessCosts(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const businessCostIdMap = useMemo(() => {
    const m = new Map()
    for (const r of businessCosts) {
      const key = `${Number(r.cost_id)}:${Number(r.business_group)}`
      // ถ้าซ้ำ ให้เก็บตัวแรก (เหมือนเดิม)
      if (!m.has(key)) m.set(key, Number(r.id))
    }
    return m
  }, [businessCosts])

  const resolveBusinessCostId = useCallback(
    (costId, businessGroupId) =>
      businessCostIdMap.get(`${Number(costId)}:${Number(businessGroupId)}`) ?? null,
    [businessCostIdMap]
  )

  const resolveRowBusinessCostId = useCallback(
    (row) => {
      if (row?.business_cost_id) return Number(row.business_cost_id)
      return resolveBusinessCostId(row?.cost_id, BUSINESS_GROUP_ID)
    },
    [resolveBusinessCostId]
  )

  /** ---------------- Units (columns) ---------------- */
  const [units, setUnits] = useState([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  useEffect(() => {
    if (!effectiveBranchId) {
      setUnits([])
      return
    }

    let alive = true
    ;(async () => {
      setIsLoadingUnits(true)
      setUnits([]) // เคลียร์ก่อน เพื่อให้เห็นว่าเปลี่ยนสาขาแล้วคอลัมน์รีเฟรช
      try {
        const data = await apiAuth(`/lists/unit/search?branch_id=${effectiveBranchId}`)
        const rows = Array.isArray(data) ? data : []
        const normalized = rows
          .map((r) => ({
            id: Number(r.id || 0),
            name: r.unit_name || r.klang_name || r.unit || r.name || `หน่วย ${r.id}`,
          }))
          .filter((r) => r.id > 0)

        if (!alive) return
        setUnits(normalized)
      } catch (e) {
        console.error("[Service Units load] failed:", e)
        if (!alive) return
        setUnits([])
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [effectiveBranchId])

  /** ---------------- Values (grid) ---------------- */
  const [valuesByCode, setValuesByCode] = useState({})
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const normalizeGrid = useCallback(
    (seed = {}) => {
      const next = {}
      for (const r of itemRows) {
        const rowSeed = seed?.[r.code] || {}
        const keep = {}
        for (const u of units) keep[u.id] = rowSeed[u.id] ?? ""
        next[r.code] = keep
      }
      return next
    },
    [itemRows, units]
  )

  useEffect(() => {
    setValuesByCode((prev) => normalizeGrid(prev))
  }, [normalizeGrid])

  const loadSavedFromBE = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0) return
    if (!effectiveBranchId) return
    if (!units.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/business-plan/${effectivePlanId}/costs?branch_id=${effectiveBranchId}`)
      const unitCells = Array.isArray(data?.unit_cells) ? data.unit_cells : []

      // map business_cost_id -> row.code (รองรับกรณี cost_id ซ้ำ)
      const bcToCode = new Map()
      for (const r of itemRows) {
        const bcId = resolveRowBusinessCostId(r)
        if (bcId) bcToCode.set(Number(bcId), r.code)
      }

      const seed = {}
      for (const cell of unitCells) {
        const uId = Number(cell.unit_id || 0)
        const bCostId = Number(cell.business_cost_id || 0)
        const amount = Number(cell.amount || 0)
        if (!uId || !bCostId) continue

        const code = bcToCode.get(bCostId)
        if (!code) continue

        if (!seed[code]) seed[code] = {}
        seed[code][uId] = String(amount)
      }

      setValuesByCode(normalizeGrid(seed))
    } catch (e) {
      console.error("[Service Load saved] failed:", e)
      setValuesByCode(normalizeGrid({}))
    } finally {
      setIsLoadingSaved(false)
    }
  }, [effectivePlanId, effectiveBranchId, units.length, itemRows, normalizeGrid, resolveRowBusinessCostId])

  useEffect(() => {
    loadSavedFromBE()
  }, [loadSavedFromBE])

  const setCell = (code, unitId, nextValue) => {
    setValuesByCode((prev) => {
      const next = { ...prev }
      const row = { ...(next[code] || {}) }
      row[unitId] = nextValue
      next[code] = row
      return next
    })
  }

  /** ---------------- Unmapped static list (แจ้งเหมือนไฟล์ค่าใช้จ่ายดำเนินงาน) ---------------- */
  const unmappedStatic = useMemo(() => {
    return itemRows
      .filter((r) => !resolveRowBusinessCostId(r))
      .map((r) => ({ code: r.code, label: r.label, cost_id: r.cost_id }))
  }, [itemRows, resolveRowBusinessCostId])

  /** ---------------- Totals ---------------- */
  const computed = useMemo(() => {
    const rowTotal = {}
    const unitTotal = {}
    let grand = 0

    for (const u of units) unitTotal[u.id] = 0

    for (const r of itemRows) {
      const row = valuesByCode[r.code] || {}
      let sum = 0
      for (const u of units) {
        const v = toNumber(row[u.id])
        unitTotal[u.id] += v
        sum += v
      }
      rowTotal[r.code] = sum
      grand += sum
    }

    return { rowTotal, unitTotal, grand }
  }, [valuesByCode, itemRows, units])

  /** ---------------- Height + Arrow nav ---------------- */
  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)

  const recalcTableCardHeight = useCallback(() => {
    const el = tableCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 900
    const bottomPadding = 6
    setTableCardHeight(Math.max(860, Math.floor(vh - rect.top - bottomPadding)))
  }, [])

  useEffect(() => {
    recalcTableCardHeight()
    window.addEventListener("resize", recalcTableCardHeight)
    return () => window.removeEventListener("resize", recalcTableCardHeight)
  }, [recalcTableCardHeight])

  const bodyScrollRef = useRef(null)
  const inputRefs = useRef(new Map())
  const totalCols = units.length

  const ensureInView = useCallback((el) => {
    const container = bodyScrollRef.current
    if (!container || !el) return

    const pad = 10
    const frozenLeft = LEFT_W
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

      if (nextRow < 0) nextRow = 0
      if (nextRow > itemRows.length - 1) nextRow = itemRows.length - 1
      if (nextCol < 0) nextCol = 0
      if (nextCol > Math.max(0, totalCols - 1)) nextCol = Math.max(0, totalCols - 1)

      const target = inputRefs.current.get(`${nextRow}|${nextCol}`)
      if (!target) return

      e.preventDefault()
      target.focus()
      try {
        target.select()
      } catch {}

      requestAnimationFrame(() => ensureInView(target))
    },
    [ensureInView, itemRows.length, totalCols]
  )

  /** ---------------- Save (bulk) ---------------- */
  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showPayload, setShowPayload] = useState(false)

  const buildBulkRowsForBE = useCallback(() => {
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error("FE: plan_id ไม่ถูกต้อง/ยังไม่ถูกส่งมา")
    if (!effectiveBranchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    if (!units.length) throw new Error("FE: สาขานี้ไม่มีหน่วย หรือโหลดหน่วยไม่สำเร็จ")

    const rows = []
    const skipped = []
    const blocked = []

    for (const r of itemRows) {
      const businessCostId = resolveRowBusinessCostId(r)

      // ตรวจยอดแถว (ไว้กันกรณี mapping หายแล้วผู้ใช้กรอกเลข)
      const rowObj = valuesByCode[r.code] || {}
      let rowSum = 0
      for (const u of units) rowSum += toNumber(rowObj[u.id])

      if (!businessCostId) {
        skipped.push({ code: r.code, label: r.label, cost_id: r.cost_id })
        if (rowSum !== 0) blocked.push({ code: r.code, label: r.label, cost_id: r.cost_id })
        continue
      }

      const unit_values = []
      let branch_total = 0
      for (const u of units) {
        const amount = toNumber(rowObj[u.id])
        branch_total += amount
        unit_values.push({ unit_id: u.id, amount })
      }

      rows.push({
        branch_id: effectiveBranchId,
        business_cost_id: businessCostId,
        unit_values,
        branch_total,
        comment: period,
      })
    }

    if (blocked.length) {
      throw new Error(
        `FE: มีบางรายการยังไม่มี mapping ใน businesscosts (ธุรกิจ=${BUSINESS_GROUP_ID}) แต่คุณกรอกตัวเลขแล้ว: ` +
          blocked.map((x) => `${x.code}`).join(", ")
      )
    }

    return { rows, skipped }
  }, [effectivePlanId, effectiveBranchId, units, itemRows, valuesByCode, period, resolveRowBusinessCostId])

  const payloadPreview = useMemo(() => {
    try {
      const out = buildBulkRowsForBE()
      return {
        plan_id: effectivePlanId,
        endpoint: `/business-plan/${effectivePlanId}/costs/bulk`,
        skipped: out.skipped,
        body: { rows: out.rows },
      }
    } catch (e) {
      return { error: e?.message || String(e) }
    }
  }, [buildBulkRowsForBE, effectivePlanId])

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payloadPreview, null, 2))
      setNotice({ type: "success", title: "คัดลอก JSON แล้ว ✅", detail: "คัดลอก payload ที่ส่งเข้า BE แล้ว" })
    } catch (e) {
      setNotice({ type: "error", title: "คัดลอกไม่สำเร็จ", detail: e?.message || String(e) })
      setShowPayload(true)
    }
  }

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setValuesByCode(normalizeGrid({}))
    setNotice({ type: "info", title: "ล้างข้อมูลแล้ว", detail: "รีเซ็ตค่าที่กรอกเป็นว่าง" })
  }

  const saveToBE = async () => {
    let payload = null
    try {
      setNotice(null)
      const token = getToken()
      if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

      const built = buildBulkRowsForBE()
      payload = { rows: built.rows }

      setIsSaving(true)
      const res = await apiAuth(`/business-plan/${effectivePlanId}/costs/bulk`, {
        method: "POST",
        body: payload,
      })

      const skippedMsg = built.skipped?.length
        ? ` • ข้าม ${built.skipped.length} รายการ (ยังไม่มี mapping)`
        : ""

      setNotice({
        type: "success",
        title: "บันทึกสำเร็จ ✅",
        detail: `plan_id=${effectivePlanId} • สาขา ${effectiveBranchName} • upserted: ${
          res?.branch_totals_upserted ?? "-"
        }${skippedMsg}`,
      })

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
        detail = `ไม่พบแผน หรือ route ไม่ตรง — plan_id=${effectivePlanId}`
      } else if (status === 422) {
        title = "422 Validation Error"
        detail = "รูปแบบข้อมูลไม่ผ่าน schema ของ BE (ดู console)"
      }

      setNotice({ type: "error", title, detail })
      console.error("[BusinessPlanExpenseServiceTable] Save failed:", e, payload)
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

  /** widths depend on units */
  const unitColsCount = units.length ? units.length : 1
  const RIGHT_W = unitColsCount * COL_W.unit + COL_W.total
  const TOTAL_W = LEFT_W + RIGHT_W

  const stickyLeftHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyCodeHeader =
    "sticky left-0 z-[95] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyCodeCell = "sticky left-0 z-[70] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold">ประมาณการรายได้/ค่าใช้จ่าย</div>
              <div className="mt-2 text-base font-extrabold text-slate-900 dark:text-slate-100">
                8) ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                ปี {effectiveYear} • plan_id {effectivePlanId || "-"} • สาขา {effectiveBranchName} • หน่วย{" "}
                {isLoadingUnits ? "กำลังโหลด..." : units.length}
                {isLoadingSaved ? " • โหลดค่าที่บันทึกไว้..." : ""}
              </div>
              <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-300">
                ธุรกิจ={BUSINESS_GROUP_ID} • mapping:{" "}
                {isLoadingBusinessCosts
                  ? "กำลังโหลด..."
                  : businessCostsErr
                  ? `โหลดไม่สำเร็จ (${businessCostsErr})`
                  : `เจอ ${businessCosts.length} รายการ${businessCostsFrom ? ` • ${businessCostsFrom}` : ""}`}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ช่วงเวลา (แก้ได้)</label>
                <input
                  className={baseField}
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder={defaultPeriodLabel}
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">รวมทั้งหมด (บาท)</label>
                <div className={cx(readonlyField, "flex items-center justify-end font-extrabold")}>
                  {fmtMoney0(computed.grand)}
                </div>
              </div>
            </div>
          </div>

          {/* ปุ่มด้านบน (ไม่มีปุ่มบันทึก — ปุ่มบันทึกอยู่ล่างสุด) */}
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={copyPayload}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white
                         shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                         hover:bg-emerald-700 hover:scale-[1.03] active:scale-[.98] transition cursor-pointer"
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

        {unmappedStatic.length > 0 ? (
          <div
            className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900
                       dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100"
          >
            <div className="font-extrabold">⚠️ รายการที่ยังไม่แมพ (จะข้ามตอนบันทึกถ้าเป็น 0)</div>
            <div className="mt-1 text-[13px] opacity-95">
              {unmappedStatic.map((x) => `${x.code} (cost_id=${x.cost_id})`).join(" • ")}
            </div>
          </div>
        ) : (
          <div
            className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900
                       dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100"
          >
            <div className="font-extrabold">✅ แมพครบแล้ว</div>
            <div className="mt-1 text-[13px] opacity-95">
              ไม่มีรายการที่ยังไม่แมพ (ทั้งหมด {itemRows.length} รายการ)
            </div>
          </div>
        )}

        {showPayload && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800
                          dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
            <pre className="max-h-72 overflow-auto">{JSON.stringify(payloadPreview, null, 2)}</pre>
          </div>
        )}
      </div>

      <NoticeBox notice={notice} />

      {/* Table Card */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div className="p-2 md:p-3 shrink-0">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-base md:text-lg font-bold">ตารางค่าใช้จ่าย (กรอกได้)</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              * พิมพ์ตัวเลขได้เลย (Arrow keys วิ่งข้ามช่องได้)
            </div>
          </div>
        </div>

        <div
          ref={bodyScrollRef}
          className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700"
        >
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {units.length
                ? units.map((u) => <col key={u.id} style={{ width: COL_W.unit }} />)
                : <col style={{ width: COL_W.unit }} />}
              <col style={{ width: COL_W.total }} />
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                <th
                  rowSpan={2}
                  className={cx(
                    "border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600",
                    stickyCodeHeader
                  )}
                />
                <th
                  rowSpan={2}
                  className={cx(
                    "border border-slate-300 px-2 py-2 text-left font-bold text-xs dark:border-slate-600",
                    stickyLeftHeader,
                    trunc
                  )}
                  style={{ left: COL_W.code }}
                >
                  รายการ
                </th>

                <th
                  colSpan={(units.length ? units.length : 1) + 1}
                  className="border border-slate-300 px-2 py-2 text-center font-extrabold text-xs dark:border-slate-600"
                  title={`สกต. ${effectiveBranchName}`}
                >
                  <span className={trunc}>สกต. {effectiveBranchName}</span>
                </th>
              </tr>

              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                {units.length ? (
                  units.map((u) => (
                    <th
                      key={u.id}
                      className={cx(
                        "border border-slate-300 px-1 py-2 text-center text-[11px] md:text-xs dark:border-slate-600",
                        trunc
                      )}
                      title={u.name}
                    >
                      {u.name}
                    </th>
                  ))
                ) : (
                  <th className="border border-slate-300 px-2 py-2 text-center text-xs dark:border-slate-600">
                    {isLoadingUnits ? "กำลังโหลด..." : "ไม่มีหน่วย"}
                  </th>
                )}

                <th className="border border-slate-300 px-1 py-2 text-center text-[11px] md:text-xs font-extrabold dark:border-slate-600">
                  รวม
                </th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((r) => {
                if (r.kind === "section") {
                  return (
                    <tr key={r.code} className="bg-slate-200/70 dark:bg-slate-700/55">
                      <td
                        className={cx(
                          "border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600",
                          stickyCodeCell,
                          "bg-slate-200/70 dark:bg-slate-700/55"
                        )}
                      >
                        {r.code}
                      </td>
                      <td
                        colSpan={(units.length ? units.length : 1) + 2}
                        className={cx(
                          "border border-slate-300 px-2 py-2 font-extrabold text-xs dark:border-slate-600",
                          "sticky z-[55] bg-slate-200/70 dark:bg-slate-700/55",
                          trunc
                        )}
                        style={{ left: COL_W.code }}
                        title={r.label}
                      >
                        {r.label}
                      </td>
                    </tr>
                  )
                }

                const idx = itemRows.findIndex((x) => x.code === r.code)
                const rowBg = idx % 2 === 1 ? STRIPE.alt : STRIPE.cell
                const rowSum = computed.rowTotal[r.code] || 0
                const isUnmapped = !resolveRowBusinessCostId(r)

                return (
                  <tr key={r.code} className={rowBg}>
                    <td
                      className={cx(
                        "border border-slate-300 px-1 py-2 text-center text-xs dark:border-slate-600",
                        stickyCodeCell,
                        rowBg
                      )}
                      title={isUnmapped ? "ยังไม่แมพ (businesscosts)" : ""}
                    >
                      {r.code}
                    </td>

                    <td
                      className={cx(
                        "border border-slate-300 px-2 py-2 text-left font-semibold text-xs dark:border-slate-600",
                        "sticky z-[50]",
                        rowBg,
                        trunc
                      )}
                      style={{ left: COL_W.code }}
                      title={isUnmapped ? `${r.label} (ยังไม่แมพ cost_id=${r.cost_id})` : r.label}
                    >
                      <span className={cx(isUnmapped && "text-amber-700 dark:text-amber-200")}>{r.label}</span>
                    </td>

                    {units.length ? (
                      units.map((u, colIdx) => (
                        <td
                          key={`${r.code}-${u.id}`}
                          className="border border-slate-300 px-1 py-2 dark:border-slate-600"
                        >
                          <input
                            ref={(el) => {
                              const key = `${idx}|${colIdx}`
                              if (!el) inputRefs.current.delete(key)
                              else inputRefs.current.set(key, el)
                            }}
                            data-row={idx}
                            data-col={colIdx}
                            onKeyDown={handleArrowNav}
                            className={cellInput}
                            inputMode="decimal"
                            value={valuesByCode?.[r.code]?.[u.id] ?? ""}
                            onChange={(e) => setCell(r.code, u.id, sanitizeNumberInput(e.target.value))}
                            placeholder="0"
                          />
                        </td>
                      ))
                    ) : (
                      <td className="border border-slate-300 px-1 py-2 text-center text-xs dark:border-slate-600">
                        -
                      </td>
                    )}

                    <td className="border border-slate-300 px-2 py-2 text-right font-bold text-xs dark:border-slate-600">
                      {fmtMoney0(rowSum)}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-[60]">
              <tr className={cx("text-slate-900 dark:text-slate-100", STRIPE.foot)}>
                <td
                  className={cx(
                    "border border-slate-300 px-1 py-2 text-center text-xs font-extrabold dark:border-slate-600",
                    stickyCodeCell,
                    STRIPE.foot
                  )}
                >
                  รวม
                </td>
                <td
                  className={cx(
                    "border border-slate-300 px-2 py-2 text-left text-xs font-extrabold dark:border-slate-600",
                    "sticky z-[55]",
                    STRIPE.foot,
                    trunc
                  )}
                  style={{ left: COL_W.code }}
                >
                  รวมทั้งสิ้น
                </td>

                {units.length ? (
                  units.map((u) => (
                    <td
                      key={`foot-${u.id}`}
                      className="border border-slate-300 px-2 py-2 text-right text-xs font-extrabold dark:border-slate-600"
                    >
                      {fmtMoney0(computed.unitTotal[u.id] || 0)}
                    </td>
                  ))
                ) : (
                  <td className="border border-slate-300 px-2 py-2 text-right text-xs font-extrabold dark:border-slate-600">
                    0
                  </td>
                )}

                <td className="border border-slate-300 px-2 py-2 text-right text-xs font-extrabold dark:border-slate-600">
                  {fmtMoney0(computed.grand)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Save bar (bottom right like other pages) */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700">
          <div className="flex flex-col gap-2 p-2 md:flex-row md:items-center md:justify-between md:p-3">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              endpoint: <span className="font-mono">{`/business-plan/${effectivePlanId || "-"}/costs/bulk`}</span> • ธุรกิจ{" "}
              {BUSINESS_GROUP_ID} • ปี {effectiveYear} • สาขา {effectiveBranchName}
            </div>

            <div className="flex items-center gap-2 md:justify-end">
              <button
                type="button"
                onClick={saveToBE}
                disabled={isSaving || !effectiveBranchId || !effectivePlanId}
                className={cx(
                  "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-extrabold text-white transition shadow-[0_10px_24px_rgba(16,185,129,0.35)]",
                  isSaving || !effectiveBranchId || !effectivePlanId
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[.98]"
                )}
              >
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessPlanExpenseServiceTable
