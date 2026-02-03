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
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const readonlyField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black shadow-none dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

/** ---------------- Year -> plan_id ----------------
 * ปีเริ่มจาก 2569 ไปอีกสิบปี (2569..2579)
 * plan_id = year - 2568 (2569 -> 1)
 */
const YEAR_BASE = 2569
const YEAR_COUNT = 11
const yearOptions = Array.from({ length: YEAR_COUNT }, (_, i) => YEAR_BASE + i)
const yearToPlanId = (yearBE) => Number(yearBE || 0) - 2568

/** ---------------- Business group / costs mapping ---------------- */
const BUSINESS_GROUP_ID = 1
const BUSINESS_COSTS_SEED = (() => {
  const out = []
  for (let costId = 2; costId <= 36; costId++) out.push({ id: costId - 1, cost_id: costId, business_group: 1 })
  return out
})()
const BUSINESS_COST_ID_MAP = new Map(BUSINESS_COSTS_SEED.map((r) => [`${r.cost_id}:${r.business_group}`, r.id]))
const resolveBusinessCostId = (costId, businessGroupId) =>
  BUSINESS_COST_ID_MAP.get(`${Number(costId)}:${Number(businessGroupId)}`) ?? null

/** ---------------- Rows ---------------- */
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

/** ---------------- Table sizing ---------------- */
const COL_W = { code: 72, item: 380, unit: 180, total: 120 }
const LEFT_W = COL_W.code + COL_W.item
const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

/**
 * Props จาก OperationPlan:
 * - branchId, branchName
 * (ปีจะเลือกเองจาก dropdown ในหน้านี้)
 */
const BusinessPlanExpenseTable = ({ branchId: branchIdProp, branchName: branchNameProp }) => {
  /** ---------------- Year: dropdown 2569..2579 ---------------- */
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = Number(localStorage.getItem("business_plan_year") || 0)
    if (saved >= 2569 && yearOptions.includes(saved)) return saved
    return 2569
  })

  useEffect(() => {
    // ถ้า localStorage เคยเป็น 2568 ให้ดันขึ้นมา 2569
    const saved = Number(localStorage.getItem("business_plan_year") || 0)
    if (saved && saved < 2569) {
      localStorage.setItem("business_plan_year", "2569")
      setSelectedYear(2569)
    }
  }, [])

  const planId = useMemo(() => yearToPlanId(selectedYear), [selectedYear])

  const periodLabel = useMemo(() => {
    const yy = String(selectedYear).slice(-2)
    const yyNext = String(selectedYear + 1).slice(-2)
    return `1 เม.ย.${yy}-31 มี.ค.${yyNext}`
  }, [selectedYear])

  useEffect(() => {
    localStorage.setItem("business_plan_year", String(selectedYear))
    localStorage.setItem("plan_id", String(planId))
  }, [selectedYear, planId])

  /** ---------------- Branch (locked from parent) ---------------- */
  const effectiveBranchId = useMemo(() => {
    const n = Number(branchIdProp || 0)
    return Number.isFinite(n) ? n : 0
  }, [branchIdProp])
  const effectiveBranchName = useMemo(() => branchNameProp || (effectiveBranchId ? `สาขา id: ${effectiveBranchId}` : "-"), [
    branchNameProp,
    effectiveBranchId,
  ])

  /** ---------------- Units (columns) from BE by branch ---------------- */
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

  /** ---------------- Values: row_code -> { unitId: \"...\" } ---------------- */
  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])
  const [valuesByCode, setValuesByCode] = useState({})

  useEffect(() => {
    setValuesByCode((prev) => {
      const next = { ...prev }
      for (const r of itemRows) {
        const current = next[r.code] ? { ...next[r.code] } : {}
        const keep = {}
        for (const u of units) keep[u.id] = current[u.id] ?? ""
        next[r.code] = keep
      }
      return next
    })
  }, [units, itemRows])

  const setCell = (code, unitId, nextValue) => {
    setValuesByCode((prev) => {
      const next = { ...prev }
      const row = { ...(next[code] || {}) }
      row[unitId] = nextValue
      next[code] = row
      return next
    })
  }

  /** ---------------- Computed totals ---------------- */
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

  /** ---------------- Table height + scroll sync + arrow nav ---------------- */
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
      try { target.select() } catch {}
      requestAnimationFrame(() => ensureInView(target))
    },
    [ensureInView, itemRows.length, totalCols]
  )

  /** ---------------- Save ---------------- */
  const [saveNotice, setSaveNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const buildBulkRowsForBE = () => {
    if (!planId || planId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (year=${selectedYear} -> plan_id=${planId})`)
    if (!effectiveBranchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    if (!units.length) throw new Error("FE: สาขานี้ไม่มีหน่วย หรือโหลดหน่วยไม่สำเร็จ")

    const rows = []
    for (const r of itemRows) {
      const businessCostId = resolveBusinessCostId(r.cost_id, BUSINESS_GROUP_ID)
      if (!businessCostId) throw new Error(`FE: หา business_cost_id ไม่เจอ (cost_id=${r.cost_id}, group=${BUSINESS_GROUP_ID})`)
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
    return { rows }
  }

  const saveToBE = async () => {
    let payload = null
    try {
      setSaveNotice(null)
      const token = getToken()
      if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")
      payload = buildBulkRowsForBE()
      setIsSaving(true)
      const res = await apiAuth(`/business-plan/${planId}/costs/bulk`, { method: "POST", body: payload })
      setSaveNotice({
        type: "success",
        title: "บันทึกสำเร็จ ✅",
        detail: `สาขา ${effectiveBranchName} • ปี ${selectedYear} (plan_id=${planId}) • upserted: ${res?.branch_totals_upserted ?? "-"}`,
      })
    } catch (e) {
      const status = e?.status || 0
      let title = "บันทึกไม่สำเร็จ ❌"
      let detail = e?.message || String(e)
      if (status === 401) { title = "401 Unauthorized"; detail = "Token ไม่ผ่าน/หมดอายุ → Logout/Login ใหม่" }
      else if (status === 403) { title = "403 Forbidden"; detail = "สิทธิ์ไม่พอ (role ไม่อนุญาต)" }
      else if (status === 404) { title = "404 Not Found"; detail = `ไม่พบแผน (BusinessPlan not found) หรือ route ไม่ตรง — plan_id=${planId}` }
      else if (status === 422) { title = "422 Validation Error"; detail = "รูปแบบข้อมูลไม่ผ่าน schema ของ BE (ดู console)" }
      setSaveNotice({ type: "error", title, detail })
      console.groupCollapsed("%c[BusinessPlanExpenseTable] Save failed ❌", "color:#ef4444;font-weight:800;")
      console.error("status:", status, "title:", title, "detail:", detail)
      console.error("year:", selectedYear, "plan_id:", planId)
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
      const payload = buildBulkRowsForBE()
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setSaveNotice({ type: "success", title: "คัดลอกแล้ว ✅", detail: "คัดลอก payload สำหรับ BE แล้ว" })
    } catch (e) {
      setSaveNotice({ type: "error", title: "คัดลอกไม่สำเร็จ", detail: e?.message || String(e) })
    }
  }

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setValuesByCode({})
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

  /** widths depend on units */
  const RIGHT_W = Math.max(1, units.length) * COL_W.unit + COL_W.total
  const TOTAL_W = LEFT_W + RIGHT_W

  const stickyLeftHeader = "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyCodeHeader = "sticky left-0 z-[95] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyCodeCell = "sticky left-0 z-[70] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold">ประมาณการค่าใช้จ่ายแผนธุรกิจ (ธุรกิจจัดหาสินค้า)</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                ({periodLabel}) • ปี: <span className="font-semibold">{selectedYear}</span> • สาขา:{" "}
                <span className="font-semibold">{effectiveBranchName}</span> • หน่วย:{" "}
                <span className="font-semibold">{isLoadingUnits ? "กำลังโหลด..." : units.length}</span>
              </div>
              <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                รวมทั้งหมด (บาท): <span className="font-extrabold">{fmtMoney0(computed.grand)}</span>
              </div>
            </div>

            {/* Controls (ปีเป็นดรอปดาว + สาขาแสดงอย่างเดียว) */}
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เลือกปีแผน (พ.ศ.)</label>
                <select className={baseField} value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก (จากข้างบน)</label>
                <div className={readonlyField}>{effectiveBranchName}</div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">หมายเหตุ</label>
                <div className={readonlyField}>{isLoadingUnits ? "กำลังโหลดหน่วย..." : `มี ${units.length} หน่วย`}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={copyPayload}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              คัดลอก payload
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
      </div>

      {/* Table Card */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div className="p-2 md:p-3 shrink-0">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-base md:text-lg font-bold">ตารางค่าใช้จ่าย (คอลัมน์เปลี่ยนตามสาขา)</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              * คอลัมน์ = หน่วยทั้งหมดของสาขาที่เลือก • Arrow keys วิ่งข้ามช่องได้
            </div>
          </div>
        </div>

        <div ref={bodyScrollRef} onScroll={onBodyScroll} className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700">
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {units.length ? units.map((u) => <col key={u.id} style={{ width: COL_W.unit }} />) : <col style={{ width: COL_W.unit }} />}
              <col style={{ width: COL_W.total }} />
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                <th rowSpan={2} className={cx("border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600", stickyCodeHeader)} />
                <th
                  rowSpan={2}
                  className={cx("border border-slate-300 px-3 py-2 text-left font-bold dark:border-slate-600", stickyLeftHeader)}
                  style={{ left: COL_W.code }}
                >
                  รายการ
                </th>
                <th
                  colSpan={(units.length ? units.length : 1) + 1}
                  className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600"
                >
                  สกต. {effectiveBranchName}
                </th>
              </tr>

              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                {units.length ? (
                  units.map((u) => (
                    <th key={u.id} className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600">
                      {u.name}
                    </th>
                  ))
                ) : (
                  <th className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600">
                    {isLoadingUnits ? "กำลังโหลดหน่วย..." : "ไม่มีหน่วย"}
                  </th>
                )}
                <th className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm font-extrabold dark:border-slate-600">
                  รวม
                </th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((r) => {
                if (r.kind === "section") {
                  return (
                    <tr key={r.code} className="bg-slate-200/70 dark:bg-slate-700/55">
                      <td className={cx("border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600", stickyCodeCell, "bg-slate-200/70 dark:bg-slate-700/55")}>
                        {r.code}
                      </td>
                      <td
                        colSpan={(units.length ? units.length : 1) + 2}
                        className={cx(
                          "border border-slate-300 px-3 py-2 font-extrabold dark:border-slate-600",
                          "sticky z-[55] bg-slate-200/70 dark:bg-slate-700/55"
                        )}
                        style={{ left: COL_W.code }}
                      >
                        {r.label}
                      </td>
                    </tr>
                  )
                }

                const idx = itemRows.findIndex((x) => x.code === r.code)
                const rowBg = idx % 2 === 1 ? STRIPE.alt : STRIPE.cell
                const rowSum = computed.rowTotal[r.code] || 0
                const bcId = resolveBusinessCostId(r.cost_id, BUSINESS_GROUP_ID)

                return (
                  <tr key={r.code} className={rowBg}>
                    <td className={cx("border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600", stickyCodeCell, rowBg)}>
                      {r.code}
                    </td>

                    <td
                      className={cx("border border-slate-300 px-3 py-2 text-left font-semibold dark:border-slate-600", "sticky z-[50]", rowBg)}
                      style={{ left: COL_W.code }}
                      title={`cost_id=${r.cost_id} -> business_cost_id=${bcId ?? "?"}`}
                    >
                      {r.label}
                    </td>

                    {units.length ? (
                      units.map((u, colIdx) => (
                        <td key={`${r.code}-${u.id}`} className="border border-slate-300 px-2 py-2 dark:border-slate-600">
                          <input
                            ref={registerInput(idx, colIdx)}
                            data-row={idx}
                            data-col={colIdx}
                            onKeyDown={handleArrowNav}
                            className={cellInput}
                            value={valuesByCode?.[r.code]?.[u.id] ?? ""}
                            inputMode="numeric"
                            placeholder="0"
                            onChange={(e) => setCell(r.code, u.id, sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))}
                          />
                        </td>
                      ))
                    ) : (
                      <td className="border border-slate-300 px-2 py-2 dark:border-slate-600 text-center text-xs text-slate-500">—</td>
                    )}

                    <td className="border border-slate-300 px-2 py-2 text-right font-extrabold dark:border-slate-600">
                      {fmtMoney0(rowSum)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Action bar */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
          <NoticeBox notice={saveNotice} />

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              บันทึก: <span className="font-mono">POST /business-plan/{`{plan_id}`}/costs/bulk</span> • ปี={selectedYear} • สาขา={effectiveBranchName}
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={saveToBE}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white",
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

export default BusinessPlanExpenseTable
