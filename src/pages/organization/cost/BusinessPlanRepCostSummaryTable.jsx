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
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const trunc = "whitespace-nowrap overflow-hidden text-ellipsis"

/** ---------------- Table definition (ผูก aux_id ตรงกับ DB แล้ว) ---------------- */
const ROWS = [
  { code: "COGS", label: "ประมาณการต้นทุนสินค้า", kind: "title" },

  { code: "1", label: "ต้นทุนขาย ธุรกิจจัดหาฯ", kind: "section" },
  { code: "1.1", label: "ค่าใช้จ่ายในการซื้อ", kind: "item", aux_id: 1 },
  { code: "1.2", label: "หักสินค้าเสื่อมสภาพ", kind: "item", aux_id: 2 },
  { code: "1.T", label: "รวมธุรกิจจัดหาฯ", kind: "subtotal" },

  { code: "2", label: "ต้นทุนขาย ธุรกิจจัดหาฯ-ปั๊มน้ำมัน", kind: "section" },
  { code: "2.1", label: "ค่าใช้จ่ายในการซื้อ", kind: "item", aux_id: 3 },
  { code: "2.2", label: "หักสินค้าเบิกใช้", kind: "item", aux_id: 4 },
  { code: "2.T", label: "รวมธุรกิจจัดหาฯ-ปั๊มน้ำมัน", kind: "subtotal" },

  { code: "3", label: "ต้นทุนขาย ธุรกิจรวบรวม", kind: "section" },
  { code: "3.1", label: "ค่าใช้จ่ายในการซื้อ", kind: "item", aux_id: 5 },
  { code: "3.T", label: "รวมธุรกิจรวบรวม", kind: "subtotal" },

  { code: "4", label: "ต้นทุนขาย ธุรกิจแปรรูป", kind: "section" },
  { code: "4.1", label: "ค่าใช้จ่ายในการซื้อ", kind: "item", aux_id: 6 },
  { code: "4.2", label: "ค่าใช้จ่ายในการผลิต", kind: "item", aux_id: 7 },
  { code: "4.3", label: "ค่าเสื่อมราคาโรงสี", kind: "item", aux_id: 8 },
  { code: "4.4", label: "ค่าเสื่อมราคาเครื่องจักร", kind: "item", aux_id: 9 },
  { code: "4.5", label: "เงินเดือนจนท.ผลิต", kind: "item", aux_id: 10 },
  { code: "4.6", label: "ค่าซ่อมเครื่องจักรโรงสี", kind: "item", aux_id: 11 },
  { code: "4.7", label: "ค่าวัสดุ", kind: "item", aux_id: 12 },
  { code: "4.8", label: "ค่าไฟฟ้า", kind: "item", aux_id: 13 },
  { code: "4.9", label: "ค่ากระสอบ", kind: "item", aux_id: 14 },
  { code: "4.10", label: "ค่าจ้างสี", kind: "item", aux_id: 15 },
  { code: "4.11", label: "ค่าน้ำมัน", kind: "item", aux_id: 16 },
  { code: "4.12", label: "ค่าเคลื่อนย้าย", kind: "item", aux_id: 17 },
  { code: "4.13", label: "ค่าจัดเก็บ", kind: "item", aux_id: 18 },
  { code: "4.14", label: "ค่าอบข้าวเปลือก", kind: "item", aux_id: 19 },
  { code: "4.T", label: "รวมธุรกิจแปรรูป", kind: "subtotal" },

  { code: "5", label: "ต้นทุนขาย ธุรกิจแปรรูป-เมล็ดพันธุ์", kind: "section" },
  { code: "5.1", label: "ค่าใช้จ่ายในการซื้อ", kind: "item", aux_id: 20 },
  { code: "5.2", label: "ค่าใช้จ่ายในการผลิต", kind: "item", aux_id: 21 },
  { code: "5.3", label: "ค่าไฟฟ้า", kind: "item", aux_id: 22 },
  { code: "5.4", label: "ค่าเสื่อมอาคาร", kind: "item", aux_id: 23 },
  { code: "5.5", label: "ค่าเสื่อมเครื่องจักรโรงคัด", kind: "item", aux_id: 24 },
  { code: "5.6", label: "ค่าน้ำมัน", kind: "item", aux_id: 25 },
  { code: "5.7", label: "ค่ากระสอบ", kind: "item", aux_id: 26 },
  { code: "5.T", label: "รวมธุรกิจแปรรูป-เมล็ดพันธุ์", kind: "subtotal" },

  { code: "6", label: "คชจ.ศูนย์ฝึกอบรม", kind: "section" },
  { code: "6.1", label: "คชจ.ศูนย์ฝึกอบรม", kind: "item", aux_id: 27 },
  { code: "6.T", label: "รวมศูนย์ฝึกอบรม", kind: "subtotal" },

  { code: "G.T", label: "รวมต้นทุน", kind: "grandtotal" },
]

/** lock width ให้ตรงกันทุกส่วน */
const COL_W = { code: 72, item: 320, cell: 120, total: 120 }
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

const BusinessPlanRepCostSummaryTable = ({ branchId, branchName, yearBE, planId }) => {
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
    if (Number.isFinite(y) && y >= 2500) return y - 2568
    return 0
  }, [planId, yearBE])

  const effectiveYear = useMemo(() => {
    const y = Number(yearBE || 0)
    if (Number.isFinite(y) && y >= 2500) return y
    return 2569
  }, [yearBE])

  const defaultPeriodLabel = useMemo(() => {
    const yy = String(effectiveYear).slice(-2)
    const yyNext = String(effectiveYear + 1).slice(-2)
    return `1 เม.ย.${yy}-31 มี.ค.${yyNext}`
  }, [effectiveYear])

  const [period, setPeriod] = useState(defaultPeriodLabel)
  useEffect(() => setPeriod(defaultPeriodLabel), [defaultPeriodLabel])

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
      setUnits([])
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
        console.error("[AuxCost Units load] failed:", e)
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
      const data = await apiAuth(`/business-plan/${effectivePlanId}/aux-costs?branch_id=${effectiveBranchId}`)
      const unitCells = Array.isArray(data) ? data : []

      // แมพ aux_id เข้ากับ code ของแถว
      const auxToCode = new Map()
      for (const r of itemRows) {
        if (r.aux_id) auxToCode.set(Number(r.aux_id), r.code)
      }

      const seed = {}
      for (const cell of unitCells) {
        const uId = Number(cell.unit_id || 0)
        const aId = Number(cell.aux_id || 0)
        const amount = Number(cell.amount || 0)
        if (!uId || !aId) continue

        const code = auxToCode.get(aId)
        if (!code) continue

        if (!seed[code]) seed[code] = {}
        
        // ถ้าเป็น 0 ใส่เป็นช่องว่างเพื่อให้กรอกง่ายขึ้น
        seed[code][uId] = amount === 0 ? "" : String(amount)
      }

      setValuesByCode(normalizeGrid(seed))
    } catch (e) {
      console.error("[AuxCost Load saved] failed:", e)
      setValuesByCode(normalizeGrid({}))
    } finally {
      setIsLoadingSaved(false)
    }
  }, [effectivePlanId, effectiveBranchId, units.length, itemRows, normalizeGrid])

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

  /** ---------------- Totals ---------------- */
  const sectionMap = useMemo(
    () => ({
      "1.T": ["1.1", "1.2"],
      "2.T": ["2.1", "2.2"],
      "3.T": ["3.1"],
      "4.T": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12", "4.13", "4.14"],
      "5.T": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"],
      "6.T": ["6.1"],
    }),
    []
  )

  const sumCodes = useCallback(
    (codes) => {
      const uSum = {}
      let total = 0
      for (const u of units) uSum[u.id] = 0

      for (const c of codes) {
        const v = valuesByCode[c] || {}
        for (const u of units) {
          const val = toNumber(v[u.id])
          uSum[u.id] += val
          total += val
        }
      }
      return { units: uSum, total }
    },
    [valuesByCode, units]
  )

  const computed = useMemo(() => {
    const rowTotal = {}

    // สำหรับแถวที่มีให้กรอก (items) ไม่จำยอดรวมไว้ที่นี่เพราะมันจะดึงไปโชว์ในตารางยาก เก็บเป็นผลรวมรายบรรทัด
    for (const r of itemRows) {
      const row = valuesByCode[r.code] || {}
      let sum = 0
      for (const u of units) sum += toNumber(row[u.id])
      rowTotal[r.code] = { total: sum } // ไม่เก็บแยกยูนิต เพราะ render หยิบตรงๆ จาก input เลย
    }

    // subtotals
    for (const k of Object.keys(sectionMap)) {
      rowTotal[k] = sumCodes(sectionMap[k])
    }

    // grand total
    const allItems = Object.values(sectionMap).flat()
    rowTotal["G.T"] = sumCodes(allItems)

    const colTotal = {}
    for (const u of units) {
      colTotal[u.id] = rowTotal["G.T"].units[u.id] || 0
    }

    return {
      rowTotal,
      colTotal,
      grand: rowTotal["G.T"].total,
    }
  }, [valuesByCode, itemRows, sectionMap, sumCodes, units])

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

  useEffect(() => {
    requestAnimationFrame(() => {
      const b = bodyScrollRef.current
      if (b) setScrollLeft(b.scrollLeft || 0)
    })
    return () => rafRef.current && cancelAnimationFrame(rafRef.current)
  }, [])

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

    const cells = []

    for (const r of itemRows) {
      if (!r.aux_id) continue // ข้ามอันที่ไม่มี (กรณีตกหล่น)

      const rowObj = valuesByCode[r.code] || {}
      for (const u of units) {
        const amount = toNumber(rowObj[u.id])
        // ตาม BE รับค่า "ทุกช่อง" ไปทับเพื่อให้เรากดลบ (0) ได้
        cells.push({
          unit_id: u.id,
          aux_id: r.aux_id,
          amount,
          comment: period,
        })
      }
    }

    return {
      branch_id: effectiveBranchId,
      cells,
    }
  }, [effectivePlanId, effectiveBranchId, units, itemRows, valuesByCode, period])

  const payloadPreview = useMemo(() => {
    try {
      const built = buildBulkRowsForBE()
      return {
        plan_id: effectivePlanId,
        endpoint: `PUT /business-plan/${effectivePlanId}/aux-costs/bulk`,
        body: built,
      }
    } catch (e) {
      return { error: e?.message || String(e) }
    }
  }, [buildBulkRowsForBE, effectivePlanId])

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payloadPreview, null, 2))
      setNotice({ type: "success", title: "คัดลอก JSON แล้ว ✅", detail: "คัดลอก payload สำหรับ BE แล้ว" })
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
      payload = built

      setIsSaving(true)
      const res = await apiAuth(`/business-plan/${effectivePlanId}/aux-costs/bulk`, {
        method: "PUT",
        body: payload,
      })

      setNotice({
        type: "success",
        title: "บันทึกสำเร็จ ✅",
        detail: `plan_id=${effectivePlanId} • สาขา ${effectiveBranchName} • inserted: ${res?.inserted ?? 0}, updated: ${res?.updated ?? 0}`,
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
      console.error("[BusinessPlanRepCostSummaryTable] Save failed:", e, payload)
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
  const RIGHT_W = Math.max(1, units.length) * COL_W.cell + COL_W.total
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
              <div className="text-lg font-bold">ประมาณการต้นทุนสินค้า</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                ปี {effectiveYear} • plan_id {effectivePlanId || "-"} • สาขา {effectiveBranchName} • หน่วย{" "}
                {isLoadingUnits ? "กำลังโหลด..." : units.length}
                {isLoadingSaved ? " • โหลดค่าที่บันทึกไว้..." : ""}
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
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">รวมต้นทุนทั้งหมด (บาท)</label>
                <div className={cx(readonlyField, "flex items-center justify-end font-extrabold")}>
                  {fmtMoney0(computed.grand)}
                </div>
              </div>
            </div>
          </div>

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

        {showPayload && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
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
            <div className="text-base md:text-lg font-bold">ตารางต้นทุน (กรอกได้)</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">* Arrow keys วิ่งข้ามช่องได้</div>
          </div>
        </div>

        <div ref={bodyScrollRef} onScroll={onBodyScroll} className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700">
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {units.length ? units.map((u) => <col key={u.id} style={{ width: COL_W.cell }} />) : <col style={{ width: COL_W.cell }} />}
              <col style={{ width: COL_W.total }} />
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                <th rowSpan={2} className={cx("border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600", stickyCodeHeader)} />
                <th
                  rowSpan={2}
                  className={cx("border border-slate-300 px-3 py-2 text-left font-bold dark:border-slate-600", stickyLeftHeader, trunc)}
                  style={{ left: COL_W.code }}
                >
                  รายการ
                </th>

                <th colSpan={(units.length ? units.length : 1) + 1} className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600">
                  <span className={trunc}>สกต. {effectiveBranchName}</span>
                </th>
              </tr>

              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                {units.length ? (
                  units.map((u) => (
                    <th key={u.id} className="border border-slate-300 px-2 py-2 text-center text-[11px] md:text-sm dark:border-slate-600" title={u.name}>
                      <div className={trunc}>{u.name}</div>
                    </th>
                  ))
                ) : (
                  <th className="border border-slate-300 px-2 py-2 text-center text-xs dark:border-slate-600">
                    {isLoadingUnits ? "กำลังโหลด..." : "ไม่มีหน่วย"}
                  </th>
                )}
                <th className="border border-slate-300 px-2 py-2 text-center text-[11px] md:text-sm font-extrabold dark:border-slate-600">รวม</th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((r) => {
                const t = computed.rowTotal[r.code]

                if (r.kind === "title" || r.kind === "section") {
                  return (
                    <tr key={r.code} className="bg-slate-200/70 dark:bg-slate-700/55">
                      <td className={cx("border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600", stickyCodeCell)}>
                        {r.kind === "section" ? r.code : ""}
                      </td>
                      <td
                        colSpan={(units.length ? units.length : 1) + 2}
                        className={cx(
                          "border border-slate-300 px-3 py-2 font-extrabold dark:border-slate-600",
                          "sticky z-[55] bg-slate-200/70 dark:bg-slate-700/55",
                          trunc
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
                const isSubtotal = r.kind === "subtotal"
                const isGrand = r.kind === "grandtotal"
                const rowCls = isGrand
                  ? "bg-emerald-200/60 dark:bg-emerald-900/35"
                  : isSubtotal
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : rowBg
                const font = isGrand || isSubtotal ? "font-extrabold" : "font-semibold"

                return (
                  <tr key={r.code} className={rowCls}>
                    <td className={cx("border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600", stickyCodeCell, rowCls, font)}>
                      {isSubtotal || isGrand ? "" : r.code}
                    </td>

                    <td
                      className={cx("border border-slate-300 px-3 py-2 text-left dark:border-slate-600", "sticky z-[50]", rowCls, font, trunc)}
                      style={{ left: COL_W.code }}
                      title={r.label}
                    >
                      {r.label}
                    </td>

                    {units.length ? (
                      units.map((u, colIdx) => (
                        <td key={`${r.code}-${u.id}`} className="border border-slate-300 px-2 py-2 dark:border-slate-600">
                          {r.kind === "item" ? (
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
                              value={valuesByCode?.[r.code]?.[u.id] ?? ""}
                              inputMode="decimal"
                              placeholder="0"
                              onChange={(e) => setCell(r.code, u.id, sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))}
                            />
                          ) : (
                            <div className={cx("text-right", font)}>{fmtMoney0(t?.units?.[u.id] ?? 0)}</div>
                          )}
                        </td>
                      ))
                    ) : (
                      <td className="border border-slate-300 px-2 py-2 dark:border-slate-600 text-center text-xs text-slate-500">—</td>
                    )}

                    <td className={cx("border border-slate-300 px-2 py-2 text-right dark:border-slate-600", font)}>
                      {fmtMoney0(t?.total ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* footer totals */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex w-full">
            <div className="shrink-0" style={{ width: LEFT_W }}>
              <table className="border-collapse text-sm" style={{ width: LEFT_W, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: COL_W.code }} />
                  <col style={{ width: COL_W.item }} />
                </colgroup>
                <tbody>
                  <tr className={cx("font-extrabold text-slate-900 dark:text-emerald-100", STRIPE.foot)}>
                    <td className="border border-slate-200 px-2 py-2 text-center dark:border-slate-700" />
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">รวมต้นทุน</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex-1 overflow-hidden">
              <div style={{ width: RIGHT_W, transform: `translateX(-${scrollLeft}px)`, willChange: "transform" }}>
                <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                  <colgroup>
                    {units.length ? units.map((u) => <col key={`f-${u.id}`} style={{ width: COL_W.cell }} />) : <col style={{ width: COL_W.cell }} />}
                    <col style={{ width: COL_W.total }} />
                  </colgroup>
                  <tbody>
                    <tr className={cx("font-extrabold text-slate-900 dark:text-emerald-100", STRIPE.foot)}>
                      {units.length ? (
                        units.map((u) => (
                          <td key={u.id} className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                            {fmtMoney0(computed.colTotal[u.id] || 0)}
                          </td>
                        ))
                      ) : (
                        <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                      )}
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">{fmtMoney0(computed.grand)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Action bar (bottom) */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              บันทึก: <span className="font-mono">PUT /business-plan/{`{plan_id}`}/aux-costs/bulk</span> • plan_id=
              {effectivePlanId || "-"} • ปี={effectiveYear} • สาขา={effectiveBranchName}
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

export default BusinessPlanRepCostSummaryTable