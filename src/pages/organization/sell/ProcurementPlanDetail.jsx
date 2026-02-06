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

// ✅ ทำ input เล็กลง (กระชับขึ้น)
const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] md:text-[13px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

// ✅ ให้หัวคอลัมน์/รายการตัดคำและไม่ดันความกว้าง
const trunc = "whitespace-nowrap overflow-hidden text-ellipsis"

/** ---------------- Business group ----------------
 * ทำแนวเดียวกับหน้าค่าใช้จ่ายดำเนินงาน
 */
const BUSINESS_GROUP_ID = 1

/** ---------------- Mapping: cost_id + business_group -> businesscosts.id ----------------
 * จาก businesscosts.csv (business_group=1) id 1..35
 */
const BUSINESS_COSTS_SEED = [
  { id: 1, cost_id: 2, business_group: 1 },
  { id: 2, cost_id: 3, business_group: 1 },
  { id: 3, cost_id: 4, business_group: 1 },
  { id: 4, cost_id: 5, business_group: 1 },
  { id: 5, cost_id: 6, business_group: 1 },
  { id: 6, cost_id: 7, business_group: 1 },
  { id: 7, cost_id: 8, business_group: 1 },
  { id: 8, cost_id: 9, business_group: 1 },
  { id: 9, cost_id: 10, business_group: 1 },
  { id: 10, cost_id: 11, business_group: 1 },
  { id: 11, cost_id: 12, business_group: 1 },
  { id: 12, cost_id: 13, business_group: 1 },
  { id: 13, cost_id: 14, business_group: 1 },
  { id: 14, cost_id: 15, business_group: 1 },
  { id: 15, cost_id: 16, business_group: 1 },
  { id: 16, cost_id: 17, business_group: 1 },
  { id: 17, cost_id: 18, business_group: 1 },
  { id: 18, cost_id: 19, business_group: 1 },
  { id: 19, cost_id: 20, business_group: 1 },
  { id: 20, cost_id: 21, business_group: 1 },
  { id: 21, cost_id: 22, business_group: 1 },
  { id: 22, cost_id: 23, business_group: 1 },
  { id: 23, cost_id: 24, business_group: 1 },
  { id: 24, cost_id: 25, business_group: 1 },
  { id: 25, cost_id: 26, business_group: 1 },
  { id: 26, cost_id: 27, business_group: 1 },
  { id: 27, cost_id: 28, business_group: 1 },
  { id: 28, cost_id: 29, business_group: 1 },
  { id: 29, cost_id: 30, business_group: 1 },
  { id: 30, cost_id: 31, business_group: 1 },
  { id: 31, cost_id: 32, business_group: 1 },
  { id: 32, cost_id: 33, business_group: 1 },
  { id: 33, cost_id: 34, business_group: 1 },
  { id: 34, cost_id: 35, business_group: 1 },
  { id: 35, cost_id: 36, business_group: 1 },
]

const BUSINESS_COST_ID_MAP = (() => {
  const m = new Map()
  for (const r of BUSINESS_COSTS_SEED) {
    const key = `${Number(r.cost_id)}:${Number(r.business_group)}`
    if (!m.has(key)) m.set(key, Number(r.id)) // ซ้ำเก็บตัวแรก
  }
  return m
})()

const resolveBusinessCostId = (costId, businessGroupId) =>
  BUSINESS_COST_ID_MAP.get(`${Number(costId)}:${Number(businessGroupId)}`) ?? null

const resolveRowBusinessCostId = (row) => {
  if (row?.business_cost_id) return Number(row.business_cost_id)
  return resolveBusinessCostId(row?.cost_id, BUSINESS_GROUP_ID)
}
/** ---------------- Rows (รายการค่าใช้จ่าย) ---------------- */
const ROWS = [
  { code: "3", label: "ค่าใช้จ่ายเฉพาะ ธุรกิจจัดหาสินค้า", kind: "section" },

  { code: "3.1", label: "ค่าใช้จ่ายในการขาย", kind: "item", cost_id: 2 },
  { code: "3.2", label: "ค่าใช้สถานที่ทำการค้าที่สินค้า", kind: "item", cost_id: 3 },
  { code: "3.3", label: "หนี้สงสัยจะสูญ-ลูกหนี้การค้า", kind: "item", cost_id: 4 },
  { code: "3.4", label: "ค่าส่งเสริมการขาย", kind: "item", cost_id: 5 },
  { code: "3.5", label: "ขาดทุนจากการตีราคาสินค้าลดลง", kind: "item", cost_id: 6 },
  { code: "3.6", label: "เงินเดือนและค่าจ้าง", kind: "item", cost_id: 7 },
  { code: "3.7", label: "ทำงานในวันหยุด", kind: "item", cost_id: 8 },
  { code: "3.8", label: "ค่าเบี้ยประกันภัย", kind: "item", cost_id: 9 },
  { code: "3.9", label: "ค่าซ่อมบำรุง-ครุภัณฑ์", kind: "item", cost_id: 10 },
  { code: "3.10", label: "ค่าใช้จ่ายยานพาหนะ", kind: "item", cost_id: 11 },
  { code: "3.11", label: "ค่าถ่ายเอกสาร", kind: "item", cost_id: 12 },
  { code: "3.12", label: "ค่าน้ำมันเชื้อเพลิงใช้ไป", kind: "item", cost_id: 13 },
  { code: "3.13", label: "ค่าโทรศัพท์", kind: "item", cost_id: 14 },
  { code: "3.14", label: "ค่าธรรมเนียมโอนเงิน ธก.", kind: "item", cost_id: 15 },
  { code: "3.15", label: "ค่าไฟฟ้า", kind: "item", cost_id: 16 },
  { code: "3.16", label: "ดอกเบี้ยจ่าย ธ.ก.ส.", kind: "item", cost_id: 17 },
  { code: "3.17", label: "ค่าเสื่อมราคา-ครุภัณฑ์", kind: "item", cost_id: 18 },
  { code: "3.18", label: "ค่าเสื่อมราคา-งาน/อาคาร", kind: "item", cost_id: 19 },
  { code: "3.19", label: "ค่าเสื่อมราคา-ยานพาหนะ", kind: "item", cost_id: 20 },
  { code: "3.20", label: "ค่าเหนื่อยเจ้าหน้าที่", kind: "item", cost_id: 21 },
  { code: "3.21", label: "ค่าน้ำประปา", kind: "item", cost_id: 22 },
  { code: "3.22", label: "ค่าเชื้อเพลิง", kind: "item", cost_id: 23 },
  { code: "3.23", label: "ค่าประชาสัมพันธ์", kind: "item", cost_id: 24 },
  { code: "3.24", label: "ค่าเสียหายสินค้าเสื่อมสภาพ", kind: "item", cost_id: 25 },
  { code: "3.25", label: "ค่าของใช้สำนักงาน", kind: "item", cost_id: 26 },
  { code: "3.26", label: "ค่าบริการสมาชิก", kind: "item", cost_id: 27 },
  { code: "3.27", label: "ค่าซ่อมบำรุง-ยานพาหนะ", kind: "item", cost_id: 28 },
  { code: "3.28", label: "ค่าเคลื่อนย้ายสินค้า", kind: "item", cost_id: 29 },
  { code: "3.29", label: "ค่าธรรมเนียมโอนเงินบัตรสินเชื่อ", kind: "item", cost_id: 30 },
  { code: "3.30", label: "ค่าซ่อมบำรุง-อาคาร", kind: "item", cost_id: 31 },
  { code: "3.31", label: "หนี้สงสัยจะสูญ-ลูกหนี้ตั๋วแทน", kind: "item", cost_id: 32 },
  { code: "3.32", label: "หนี้สงสัยจะสูญ-บัตรเกษตรสุขใจ", kind: "item", cost_id: 33 },
  { code: "3.33", label: "ค่าเครื่องเขียนแบบพิมพ์", kind: "item", cost_id: 34 },
  { code: "3.34", label: "ค่าภาษีโรงเรือน", kind: "item", cost_id: 35 },
  { code: "3.35", label: "ค่าใช้จ่ายเบ็ดเตล็ด", kind: "item", cost_id: 36 },
]

/** ---------------- ✅ Table sizing (ลดความกว้างตามที่ขอ) ----------------
 * เดิม: code 72, item 380, unit 180, total 120
 * ใหม่: code 56, item 260, unit 130, total 90  (กระชับขึ้น)
 */
const COL_W = { code: 56, item: 260, unit: 130, total: 90 }
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

/**
 * Props from OperationPlan:
 * - branchId, branchName, yearBE, planId
 */
const BusinessPlanExpenseTable = ({ branchId, branchName, yearBE, planId }) => {
  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])

  const effectiveBranchId = useMemo(() => Number(branchId || 0) || 0, [branchId])
  const effectiveBranchName = useMemo(
    () => branchName || (effectiveBranchId ? `สาขา id: ${effectiveBranchId}` : "-"),
    [branchName, effectiveBranchId]
  )

  const effectivePlanId = useMemo(() => {
    const p = Number(planId || 0)
    if (Number.isFinite(p) && p > 0) return p
    const y = Number(yearBE || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [planId, yearBE])

  const effectiveYear = useMemo(() => {
    const y = Number(yearBE || 0)
    if (Number.isFinite(y) && y >= 2569) return y
    const p = Number(planId || 0)
    return Number.isFinite(p) && p > 0 ? p + 2568 : 2569
  }, [yearBE, planId])

  const periodLabel = useMemo(() => {
    const yy = String(effectiveYear).slice(-2)
    const yyNext = String(effectiveYear + 1).slice(-2)
    return `1 เม.ย.${yy}-31 มี.ค.${yyNext}`
  }, [effectiveYear])

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
        console.error("[Units load] failed:", e)
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

  /** ---------------- Values ---------------- */
  const [valuesByCode, setValuesByCode] = useState({})
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const normalizeGrid = useCallback(
    (seed = {}) => {
      const next = {}
      for (const r of itemRows) {
        const rowSeed = seed[r.code] || {}
        const keep = {}
        for (const u of units) keep[u.id] = rowSeed[u.id] ?? ""
        next[r.code] = keep
      }
      return next
    },
    [itemRows, units]
  )

  const loadSavedFromBE = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0) return
    if (!effectiveBranchId) return
    if (!units.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/business-plan/${effectivePlanId}/costs?branch_id=${effectiveBranchId}`)
      const unitCells = Array.isArray(data?.unit_cells) ? data.unit_cells : []
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
      console.error("[Load saved] failed:", e)
      setValuesByCode(normalizeGrid({}))
    } finally {
      setIsLoadingSaved(false)
    }
  }, [effectivePlanId, effectiveBranchId, units.length, itemRows, normalizeGrid])

  useEffect(() => {
    setValuesByCode((prev) => normalizeGrid(prev))
  }, [units, normalizeGrid])

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
  }, [itemRows])

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

  /** ---------------- Height + Scroll + Arrow nav ---------------- */
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
  const [scrollLeft, setScrollLeft] = useState(0)
  const rafRef = useRef(0)
  const onBodyScroll = () => {
    const b = bodyScrollRef.current
    if (!b) return
    const x = b.scrollLeft || 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => setScrollLeft(x))
  }
  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), [])

  const inputRefs = useRef(new Map())
  const totalCols = units.length

  const ensureInView = useCallback((inputEl) => {
    const container = bodyScrollRef.current
    if (!container || !inputEl) return
    const cRect = container.getBoundingClientRect()
    const iRect = inputEl.getBoundingClientRect()
    const pad = 12
    const leftOverflow = iRect.left < cRect.left + pad
    const rightOverflow = iRect.right > cRect.right - pad
    if (leftOverflow) container.scrollLeft -= Math.max(0, (cRect.left + pad) - iRect.left)
    if (rightOverflow) container.scrollLeft += Math.max(0, iRect.right - (cRect.right - pad))
  }, [])

  const onCellKeyDown = useCallback(
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
  const [saveNotice, setSaveNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const buildBulkRowsForBE = () => {
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (plan_id=${effectivePlanId})`)
    if (!effectiveBranchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    if (!units.length) throw new Error("FE: สาขานี้ไม่มีหน่วย หรือโหลดหน่วยไม่สำเร็จ")

    const rows = []
    const skipped = []
    const blocked = []

    for (const r of itemRows) {
      const businessCostId = resolveRowBusinessCostId(r)

      const rowObj = valuesByCode[r.code] || {}
      let rowSum = 0
      for (const u of units) rowSum += toNumber(rowObj[u.id])

      // ยังไม่แมพ → ข้ามได้เฉพาะกรณีแถวนี้เป็น 0 ทั้งหมด
      if (!businessCostId) {
        skipped.push({ code: r.code, label: r.label, cost_id: r.cost_id })
        if (rowSum !== 0) blocked.push({ code: r.code, label: r.label, cost_id: r.cost_id })
        continue
      }

      const unit_values = []
      let branch_total = 0

      // ส่งครบทุก unit (รวม 0) เพื่อให้ล้างค่าแล้วทับของเดิมได้แน่นอน
      for (const u of units) {
        const amount = toNumber(rowObj[u.id])
        branch_total += amount
        unit_values.push({ unit_id: u.id, amount })
      }

      rows.push({
        // ใส่ branch_id ในแถวไว้ด้วย (ไม่เสียหาย) แต่สำคัญสุดคือเราจะส่ง branch_id ที่ระดับ body + query ด้วย
        branch_id: effectiveBranchId,
        business_cost_id: businessCostId,
        unit_values,
        branch_total,
        comment: periodLabel,
      })
    }

    if (blocked.length) {
      throw new Error("FE: มีรายการยังไม่แมพ แต่คุณกรอกตัวเลขแล้ว: " + blocked.map((x) => `${x.code}`).join(", "))
    }

    return { rows, skipped }
  }

  const saveToBE = async () => {
    let payload = null
    try {
      setSaveNotice(null)
      const token = getToken()
      if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

      const built = buildBulkRowsForBE()
      // ✅ สำคัญ: ส่ง branch_id ที่ระดับ body ด้วย (admin token บางตัวไม่มี branch_location)
      payload = { branch_id: effectiveBranchId, rows: built.rows }
      setIsSaving(true)

      // ✅ และส่งซ้ำใน query param กัน BE ฝั่ง validate แบบ Query(...)
      const res = await apiAuth(
        `/business-plan/${effectivePlanId}/costs/bulk?branch_id=${effectiveBranchId}`,
        {
          method: "POST",
          body: payload,
        }
      )

      setSaveNotice({
        type: "success",
        title: "บันทึกสำเร็จ ✅",
        detail: `สาขา ${effectiveBranchName} • ปี ${effectiveYear} • upserted: ${res?.branch_totals_upserted ?? "-"}${built?.skipped?.length ? ` • skipped: ${built.skipped.length}` : ""}`,
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

      setSaveNotice({ type: "error", title, detail })
      console.groupCollapsed("%c[BusinessPlanExpenseTable] Save failed ❌", "color:#ef4444;font-weight:800;")
      console.error("status:", status, "title:", title, "detail:", detail)
      console.error("year:", effectiveYear, "plan_id:", effectivePlanId)
      console.error("branch_id:", effectiveBranchId, "branch:", effectiveBranchName)
      console.error("units:", units)
      if (payload) console.error("payload preview:", payload.rows?.slice(0, 2))
      console.error("raw error:", e)
      console.groupEnd()
    } finally {
      setIsSaving(false)
    }
  }

  const copyPayload = async () => {
    try {
      const built = buildBulkRowsForBE()
      const payload = { branch_id: effectiveBranchId, rows: built.rows }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setSaveNotice({ type: "success", title: "คัดลอกแล้ว ✅", detail: "คัดลอก payload สำหรับ BE แล้ว" })
    } catch (e) {
      setSaveNotice({ type: "error", title: "คัดลอกไม่สำเร็จ", detail: e?.message || String(e) })
    }
  }

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    const empty = {}
    for (const r of itemRows) {
      const keep = {}
      for (const u of units) keep[u.id] = ""
      empty[r.code] = keep
    }
    setValuesByCode(empty)
    setSaveNotice({ type: "info", title: "ล้างข้อมูลแล้ว", detail: "รีเซ็ตค่าที่กรอกเป็นว่าง" })
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
    <div className="w-full">
      {/* Header info */}
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
        <div>
          <div className="mb-1 text-sm font-bold text-slate-700 dark:text-slate-200">ปีแผน (พ.ศ.)</div>
          <input className={readonlyField} value={effectiveYear} readOnly />
        </div>
        <div>
          <div className="mb-1 text-sm font-bold text-slate-700 dark:text-slate-200">ช่วงเวลา</div>
          <input className={readonlyField} value={periodLabel} readOnly />
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 text-sm font-bold text-slate-700 dark:text-slate-200">หมายเหตุ</div>
          <input className={readonlyField} value={"สินค้า 10 รายการ"} readOnly />
        </div>
      </div>

      {/* Unmapped warning */}
      {unmappedStatic?.length ? (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <div className="font-extrabold">มีรายการยังไม่แมพ business_cost_id ({unmappedStatic.length})</div>
          <div className="mt-1 text-[13px] opacity-90">
            ถ้ากรอกตัวเลขในรายการเหล่านี้ ระบบจะบล็อกไม่ให้บันทึก
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {unmappedStatic.map((u) => (
              <span
                key={u.code}
                className="rounded-full bg-amber-100 px-2 py-1 text-[12px] font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
              >
                {u.code} • {u.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Notice */}
      <NoticeBox notice={saveNotice} />

      {/* Table */}
      <div
        ref={tableCardRef}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        style={{ height: tableCardHeight }}
      >
        <div className={cx("flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700", STRIPE.head)}>
          <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
            ประมาณการต้นทุน (ธุรกิจจัดหา) • สาขา: {effectiveBranchName}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              onClick={copyPayload}
            >
              คัดลอก payload
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              onClick={resetAll}
            >
              ล้างทั้งหมด
            </button>
            <button
              type="button"
              disabled={isSaving}
              className={cx(
                "rounded-xl px-3 py-2 text-xs font-extrabold text-white",
                isSaving ? "bg-emerald-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
              )}
              onClick={saveToBE}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col">
          {/* table header */}
          <div className="shrink-0 border-b border-slate-200 dark:border-slate-700">
            <div className="flex">
              <div
                className={cx("flex shrink-0 items-center border-r border-slate-200 dark:border-slate-700", STRIPE.head)}
                style={{ width: LEFT_W }}
              >
                <div className={cx("border-r border-slate-200 px-2 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200", trunc)} style={{ width: COL_W.code }}>
                  รายการ
                </div>
                <div className={cx("px-2 py-2 text-xs font-bold text-slate-700 dark:text-slate-200", trunc)} style={{ width: COL_W.item }}>
                  ประเภทสินค้า
                </div>
              </div>

              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex" style={{ transform: `translateX(${-scrollLeft}px)` }}>
                  {units.map((u) => (
                    <div
                      key={u.id}
                      className={cx("border-r border-slate-200 px-2 py-2 text-center text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200", trunc, STRIPE.head)}
                      style={{ width: COL_W.unit }}
                      title={u.name}
                    >
                      {u.name}
                    </div>
                  ))}
                  <div
                    className={cx("px-2 py-2 text-right text-xs font-bold text-slate-700 dark:text-slate-200", STRIPE.head)}
                    style={{ width: COL_W.total }}
                  >
                    รวม
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* table body */}
          <div ref={bodyScrollRef} onScroll={onBodyScroll} className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <tbody>
                {ROWS.map((r, ri) => {
                  if (r.kind === "section") {
                    return (
                      <tr key={r.code}>
                        <td
                          className={cx("border border-slate-300 bg-slate-100 px-2 py-2 text-left text-xs font-extrabold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100", trunc)}
                          colSpan={2 + units.length + 1}
                        >
                          {r.label}
                        </td>
                      </tr>
                    )
                  }

                  const row = valuesByCode[r.code] || {}
                  const isAlt = ri % 2 === 1

                  return (
                    <tr key={r.code} className={isAlt ? STRIPE.alt : STRIPE.cell}>
                      {/* code */}
                      <td
                        className={cx("border border-slate-300 px-2 py-2 text-left text-xs font-bold dark:border-slate-600", trunc)}
                        style={{ width: COL_W.code }}
                        title={r.code}
                      >
                        {r.code}
                      </td>

                      {/* item label */}
                      <td
                        className={cx("border border-slate-300 px-2 py-2 text-left text-xs dark:border-slate-600", trunc)}
                        style={{ width: COL_W.item }}
                        title={r.label}
                      >
                        {r.label}
                      </td>

                      {/* units */}
                      {units.map((u, ci) => {
                        const key = `${r.code}|${u.id}`
                        const val = row[u.id] ?? ""
                        return (
                          <td
                            key={key}
                            className="border border-slate-300 px-1 py-1 dark:border-slate-600"
                            style={{ width: COL_W.unit }}
                          >
                            <input
                              ref={(el) => {
                                if (!el) return
                                inputRefs.current.set(`${itemRows.findIndex((x) => x.code === r.code)}|${ci}`, el)
                              }}
                              data-row={itemRows.findIndex((x) => x.code === r.code)}
                              data-col={ci}
                              onKeyDown={onCellKeyDown}
                              className={cellInput}
                              value={val}
                              inputMode="decimal"
                              placeholder=""
                              onChange={(e) => setCell(r.code, u.id, sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))}
                              onFocus={(e) => {
                                try {
                                  e.target.select()
                                } catch {}
                              }}
                            />
                          </td>
                        )
                      })}

                      {/* row total */}
                      <td
                        className="border border-slate-300 px-2 py-2 text-right text-xs font-extrabold dark:border-slate-600"
                        style={{ width: COL_W.total }}
                      >
                        {fmtMoney0(computed.rowTotal[r.code] || 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* footer totals */}
              <tfoot>
                <tr className={STRIPE.foot}>
                  <td
                    className="border border-slate-300 px-2 py-2 text-left text-xs font-extrabold dark:border-slate-600"
                    colSpan={2}
                  >
                    รวมทั้งหมด
                  </td>

                  {units.map((u) => (
                    <td key={u.id} className="border border-slate-300 px-2 py-2 text-right font-extrabold text-xs dark:border-slate-600">
                      {fmtMoney0(computed.unitTotal[u.id] || 0)}
                    </td>
                  ))}

                  <td className="border border-slate-300 px-1 py-2 text-right font-extrabold text-xs dark:border-slate-600">
                    {fmtMoney0(computed.grand)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action bar */}
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
            {saveNotice && (
              <div
                className={cx(
                  "mb-3 rounded-2xl border p-3 text-sm",
                  saveNotice.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200"
                    : saveNotice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-rose-200"
                    : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
                )}
              >
                <div className="font-extrabold">{saveNotice.title}</div>
                {saveNotice.detail && <div className="mt-1 text-[13px] opacity-95">{saveNotice.detail}</div>}
              </div>
            )}

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                บันทึก: <span className="font-mono">POST /business-plan/{`{plan_id}`}/costs/bulk</span> • ปี={effectiveYear} • สาขา={effectiveBranchName}
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  let payload = null
                  try {
                    setSaveNotice(null)
                    const token = getToken()
                    if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

                    // build bulk rows
                    if (!effectivePlanId || effectivePlanId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (plan_id=${effectivePlanId})`)
                    if (!effectiveBranchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
                    if (!units.length) throw new Error("FE: สาขานี้ไม่มีหน่วย หรือโหลดหน่วยไม่สำเร็จ")

                    const rows = []
                    for (const r of itemRows) {
                      const businessCostId = resolveBusinessCostId(r.cost_id, BUSINESS_GROUP_ID)
                      if (!businessCostId) throw new Error(`FE: หา business_cost_id ไม่เจอ (cost_id=${r.cost_id})`)

                      const row = valuesByCode[r.code] || {}
                      const unit_values = []
                      let branch_total = 0

                      for (const u of units) {
                        const amount = toNumber(row[u.id])
                        branch_total += amount
                        if (amount !== 0) unit_values.push({ unit_id: u.id, amount })
                      }

                      rows.push({
                        branch_id: effectiveBranchId,
                        business_cost_id: businessCostId,
                        unit_values,
                        branch_total,
                        comment: periodLabel,
                      })
                    }
                    payload = { branch_id: effectiveBranchId, rows }

                    setIsSaving(true)
                    const res = await apiAuth(
                      `/business-plan/${effectivePlanId}/costs/bulk?branch_id=${effectiveBranchId}`,
                      {
                        method: "POST",
                        body: payload,
                      }
                    )

                    setSaveNotice({
                      type: "success",
                      title: "บันทึกสำเร็จ ✅",
                      detail: `upserted: ${res?.branch_totals_upserted ?? "-"}`,
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

                    setSaveNotice({ type: "error", title, detail })
                    console.error(e)
                  } finally {
                    setIsSaving(false)
                  }
                }}
                className={cx(
                  "rounded-2xl px-4 py-2 text-sm font-extrabold text-white shadow-sm",
                  isSaving ? "bg-emerald-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>

            <div className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
              {isLoadingUnits ? "กำลังโหลดหน่วย..." : units.length ? `หน่วย: ${units.length} รายการ` : "ยังไม่มีหน่วย"}
              {isLoadingSaved ? " • กำลังโหลดค่าที่เคยบันทึก..." : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessPlanExpenseTable
