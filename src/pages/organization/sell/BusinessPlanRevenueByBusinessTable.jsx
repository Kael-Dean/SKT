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
const fmtMoney0 = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

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
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-md border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

/** ---------------- Table definition ---------------- */
const PERIOD_DEFAULT = "1 เม.ย.68-31 มี.ค.69"

const COL_W = { code: 60, item: 320, cell: 104, total: 110 }
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  headEven: "bg-slate-100 dark:bg-slate-700",
  headOdd: "bg-slate-200 dark:bg-slate-600",
  cellEven: "bg-white dark:bg-slate-900",
  cellOdd: "bg-slate-50 dark:bg-slate-800",
  footEven: "bg-emerald-100 dark:bg-emerald-900",
  footOdd: "bg-emerald-200 dark:bg-emerald-800",
  section: "bg-slate-100/80 dark:bg-slate-800",
}

const FALLBACK_UNITS = [
  { id: 1, name: "สุรินทร์" },
  { id: 2, name: "โนนนารายณ์" },
]

/** ---------------- Mapping: (earning_id + business_group) -> businessearnings.id ---------------- */
const BUSINESS_EARNINGS_SEED = [
  { id: 1, earning_id: 1, business_group: 1 },
  { id: 2, earning_id: 2, business_group: 1 },
  { id: 3, earning_id: 3, business_group: 1 },
  { id: 4, earning_id: 4, business_group: 1 },
  { id: 5, earning_id: 5, business_group: 1 },
  { id: 6, earning_id: 6, business_group: 1 },
  { id: 7, earning_id: 6, business_group: 2 },
  { id: 8, earning_id: 8, business_group: 2 },
  { id: 9, earning_id: 2, business_group: 2 },
  { id: 10, earning_id: 7, business_group: 2 },
  { id: 11, earning_id: 6, business_group: 3 },
  { id: 12, earning_id: 15, business_group: 3 },
  { id: 13, earning_id: 14, business_group: 3 },
  { id: 14, earning_id: 13, business_group: 3 },
  { id: 15, earning_id: 12, business_group: 3 },
  { id: 16, earning_id: 11, business_group: 3 },
  { id: 17, earning_id: 10, business_group: 3 },
  { id: 18, earning_id: 9, business_group: 3 },
  { id: 19, earning_id: 6, business_group: 4 },
  { id: 20, earning_id: 18, business_group: 4 },
  { id: 21, earning_id: 17, business_group: 4 },
  { id: 22, earning_id: 16, business_group: 4 },
  { id: 23, earning_id: 14, business_group: 4 },
  { id: 24, earning_id: 12, business_group: 4 },
  { id: 25, earning_id: 11, business_group: 4 },
  { id: 26, earning_id: 10, business_group: 4 },
  { id: 27, earning_id: 9, business_group: 4 },
  { id: 28, earning_id: 22, business_group: 4 },
  { id: 29, earning_id: 4, business_group: 4 },
  { id: 30, earning_id: 6, business_group: 5 },
  { id: 31, earning_id: 4, business_group: 5 },
  { id: 32, earning_id: 21, business_group: 5 },
  { id: 33, earning_id: 20, business_group: 5 },
  { id: 34, earning_id: 10, business_group: 5 },
  { id: 35, earning_id: 9, business_group: 5 },
  { id: 36, earning_id: 19, business_group: 5 },
  { id: 37, earning_id: 6, business_group: 6 },
  { id: 38, earning_id: 29, business_group: 6 },
  { id: 39, earning_id: 28, business_group: 6 },
  { id: 40, earning_id: 27, business_group: 6 },
  { id: 41, earning_id: 26, business_group: 6 },
  { id: 42, earning_id: 25, business_group: 6 },
  { id: 43, earning_id: 24, business_group: 6 },
  { id: 44, earning_id: 22, business_group: 6 },
  { id: 45, earning_id: 22, business_group: 8 },
  { id: 46, earning_id: 23, business_group: 8 },
  { id: 47, earning_id: 6, business_group: 8 },
]

const BUSINESS_EARNING_ID_MAP = (() => {
  const m = new Map()
  for (const r of BUSINESS_EARNINGS_SEED) {
    const key = `${Number(r.earning_id)}:${Number(r.business_group)}`
    if (!m.has(key)) m.set(key, Number(r.id))
  }
  return m
})()

const resolveBusinessEarningId = (earningId, businessGroupId) =>
  BUSINESS_EARNING_ID_MAP.get(`${Number(earningId)}:${Number(businessGroupId)}`) ?? null

const resolveRowBusinessEarningId = (row) => {
  if (row?.business_earning_id) return Number(row.business_earning_id)
  if (!row?.earning_id || !row?.business_group) return null
  return resolveBusinessEarningId(row.earning_id, row.business_group)
}

/** ---------------- Rows (รายการรายได้) ---------------- */
const ROWS = [
  { code: "REV", label: "ประมาณการ รายได้เฉพาะธุรกิจ", kind: "title" },

  { code: "1", label: "รายได้เฉพาะ ธุรกิจจัดหา", kind: "section" },
  { code: "1.1", label: "ค่าตอบแทนจัดหาวัสดุ", kind: "item", business_group: 1, earning_id: 1 },
  { code: "1.2", label: "รายได้จากส่งเสริมการขาย", kind: "item", business_group: 1, earning_id: 2 },
  { code: "1.3", label: "ดอกเบี้ยรับ-ลูกหนี้การค้า", kind: "item", business_group: 1, earning_id: 3 },
  { code: "1.4", label: "กำไรจากการตีราคาสินค้าเพิ่มขึ้น", kind: "item", business_group: 1, earning_id: 4 },
  { code: "1.5", label: "รางวัล สกต.ดีเด่น", kind: "item", business_group: 1, earning_id: 5 },
  { code: "1.6", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 1, earning_id: 6 },
  { code: "1.T", label: "รวมธุรกิจจัดหา", kind: "subtotal" },

  { code: "2", label: "รายได้เฉพาะ ธุรกิจจัดหา-ปั๊มน้ำมัน", kind: "section" },
  { code: "2.1", label: "รางวัลคุณภาพ", kind: "item", business_group: 2, earning_id: 7 },
  { code: "2.2", label: "รายได้ค่าส่งเสริมการขาย", kind: "item", business_group: 2, earning_id: 2 },
  { code: "2.3", label: "รายได้ค่าบริการสมาชิก", kind: "item", business_group: 2, earning_id: 8 },
  { code: "2.4", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 2, earning_id: 6 },
  { code: "2.T", label: "รวมธุรกิจจัดหา-ปั๊มน้ำมัน", kind: "subtotal" },

  { code: "3", label: "รายได้เฉพาะธุรกิจรวบรวม", kind: "section" },
  { code: "3.1", label: "รายได้รถบรรทุก", kind: "item", business_group: 3, earning_id: 9 },
  { code: "3.2", label: "รายได้จากการชะลอ", kind: "item", business_group: 3, earning_id: 10 },
  { code: "3.3", label: "รายได้จากการส่งออกคุณภาพข้าวเปลือก", kind: "item", business_group: 3, earning_id: 11 },
  { code: "3.4", label: "รายได้จากกระสอบ", kind: "item", business_group: 3, earning_id: 12 },
  { code: "3.5", label: "รายได้ค่าบริการตลาดกลาง", kind: "item", business_group: 3, earning_id: 13 },
  { code: "3.6", label: "เงินชดเชยดอกเบี้ยประกัน", kind: "item", business_group: 3, earning_id: 14 },
  { code: "3.7", label: "รายได้เงินอุดหนุน", kind: "item", business_group: 3, earning_id: 15 },
  { code: "3.8", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 3, earning_id: 6 },
  { code: "3.T", label: "รวมธุรกิจรวบรวม", kind: "subtotal" },

  { code: "4", label: "รายได้เฉพาะ ธุรกิจแปรรูป", kind: "section" },
  { code: "4.1", label: "กำไรจากการตีราคาสินค้าเพิ่มขึ้น", kind: "item", business_group: 4, earning_id: 4 },
  { code: "4.2", label: "ดอกเบี้ยเงินฝาก", kind: "item", business_group: 4, earning_id: 22 },
  { code: "4.3", label: "รายได้รถบรรทุก", kind: "item", business_group: 4, earning_id: 9 },
  { code: "4.4", label: "รายได้โครงการชะลอ", kind: "item", business_group: 4, earning_id: 10 },
  { code: "4.5", label: "รายได้จากการรับจ้างสี", kind: "item", business_group: 4, earning_id: 16 },
  { code: "4.6", label: "รายได้จากกระสอบ", kind: "item", business_group: 4, earning_id: 12 },
  { code: "4.7", label: "เงินชดเชยดอกเบี้ยประกัน", kind: "item", business_group: 4, earning_id: 14 },
  { code: "4.8", label: "รายได้เงินอุดหนุน-การจำหน่ายข้าวสาร", kind: "item", business_group: 4, earning_id: 17 },
  { code: "4.9", label: "รายได้เงินอุดหนุน-ซื้อเครื่องจักร", kind: "item", business_group: 4, earning_id: 18 },
  { code: "4.10", label: "รายได้จากการตรวจสอบคุณภาพข้าวเปลือก", kind: "item", business_group: 4, earning_id: 11 },
  { code: "4.11", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 4, earning_id: 6 },
  { code: "4.T", label: "รวมธุรกิจแปรรูป", kind: "subtotal" },

  { code: "5", label: "รายได้เฉพาะ ธุรกิจแปรรูป-เมล็ดพันธุ์", kind: "section" },
  { code: "5.1", label: "เมล็ดพันธุ์ขาดบัญชีได้รับชดใช้", kind: "item", business_group: 5, earning_id: 19 },
  { code: "5.2", label: "รายได้รถบรรทุก", kind: "item", business_group: 5, earning_id: 9 },
  { code: "5.3", label: "รายได้โครงการชะลอ", kind: "item", business_group: 5, earning_id: 10 },
  { code: "5.4", label: "รายได้เงินอุดหนุนจากการผลิตเมล็ดพันธุ์", kind: "item", business_group: 5, earning_id: 20 },
  { code: "5.5", label: "รายได้เกษตรกร", kind: "item", business_group: 5, earning_id: 21 },
  { code: "5.6", label: "กำไรจากการตีราคาสินค้าเพิ่มขึ้น", kind: "item", business_group: 5, earning_id: 4 },
  { code: "5.7", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 5, earning_id: 6 },
  { code: "5.T", label: "รวมธุรกิจแปรรูป-เมล็ดพันธุ์", kind: "subtotal" },

  { code: "6", label: "รายได้ศูนย์อบรม", kind: "section" },
  { code: "6.1", label: "ดอกเบี้ยเงินฝาก", kind: "item", business_group: 8, earning_id: 22 },
  { code: "6.2", label: "รายได้ค่าจัดการ", kind: "item", business_group: 8, earning_id: 23 },
  { code: "6.3", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 8, earning_id: 6 },
  { code: "6.T", label: "รายได้ศูนย์อบรม", kind: "subtotal" },
]

function buildInitialValues(unitIds) {
  const out = {}
  ROWS.forEach((r) => {
    if (r.kind !== "item") return
    const row = {}
    unitIds.forEach((uid) => (row[String(uid)] = ""))
    out[r.code] = row
  })
  return out
}

/** =====================================================================
 * BusinessPlanRevenueByBusinessTable
 * ===================================================================== */
const BusinessPlanRevenueByBusinessTable = (props) => {
  const branchId = Number(props?.branchId ?? props?.branch_id ?? 0) || 0
  const branchName = String(props?.branchName ?? props?.branch_name ?? "").trim()
  const yearBE = props?.yearBE ?? props?.year_be ?? props?.year ?? null
  const planId = Number(props?.planId ?? props?.plan_id ?? 0) || 0

  const [earningNameById, setEarningNameById] = useState({})
  useEffect(() => {
    let alive = true
    apiAuth("/lists/earning-type-names").then((d) => { if (alive && d) setEarningNameById(d) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const displayRows = useMemo(
    () => ROWS.map((r) => r.earning_id && earningNameById[r.earning_id] ? { ...r, label: earningNameById[r.earning_id] } : r),
    [earningNameById]
  )

  const effectiveBranchName = branchName || (branchId ? `#${branchId}` : "— ยังไม่ได้เลือกสาขา —")
  const effectiveYear = yearBE ?? "-"
  const periodLabel = props?.periodLabel || props?.period_label || PERIOD_DEFAULT

  const canEdit = !!branchId

  const [period, setPeriod] = useState(periodLabel || PERIOD_DEFAULT)
  const [units, setUnits] = useState(FALLBACK_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const unitIds = useMemo(() => units.map((u) => Number(u.id)).filter((x) => x > 0), [units])
  const cols = useMemo(
    () => units.map((u) => ({ key: String(u.id), label: String(u.name || `หน่วย ${u.id}`) })),
    [units]
  )

  const [valuesByCode, setValuesByCode] = useState(() =>
    buildInitialValues(unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id))
  )
  /** ✅ โหลดหน่วยตามสาขา */
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!branchId) { setUnits(FALLBACK_UNITS); return }
      setIsLoadingUnits(true)
      try {
        const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
        const rows = Array.isArray(data) ? data : []
        const normalized = rows
          .map((r, idx) => {
            const id = Number(r.id || 0)
            const name = r.unit_name || r.klang_name || r.unit || r.name || `หน่วย ${id || idx + 1}`
            return { id, name: String(name || "").trim() }
          })
          .filter((x) => x.id > 0)

        if (!alive) return
        setUnits(normalized.length ? normalized : FALLBACK_UNITS)
      } catch (e) {
        if (!alive) return
        setUnits(FALLBACK_UNITS)
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()
    return () => { alive = false }
  }, [branchId])

  /** ✅ sync state เมื่อ units เปลี่ยน */
  useEffect(() => {
    const ids = unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)
    setValuesByCode((prev) => {
      const next = buildInitialValues(ids)
      for (const code of Object.keys(next)) {
        const prevRow = prev?.[code] || {}
        for (const uid of ids) {
          const k = String(uid)
          if (prevRow[k] !== undefined) next[code][k] = prevRow[k]
        }
      }
      return next
    })
  }, [unitIds.join("|")])

  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])
  /** ✅ โหลดค่าจาก BE */
  const normalizeGrid = useCallback(
    (seed) => {
      const out = buildInitialValues(unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id))
      for (const r of itemRows) {
        const code = r.code
        const rowSeed = seed?.[code] || {}
        for (const u of unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)) {
          const k = String(u)
          if (rowSeed[k] !== undefined) out[code][k] = String(rowSeed[k] ?? "")
        }
      }
      return out
    },
    [itemRows, unitIds]
  )

  const loadSavedFromBE = useCallback(async () => {
    if (!planId || planId <= 0 || !branchId || !units?.length) return
    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/business-plan/${planId}/earnings?branch_id=${Number(branchId)}`)
      const unitCells = Array.isArray(data?.unit_cells) ? data.unit_cells : []

      const beToCode = new Map()
      for (const r of itemRows) {
        const beId = resolveRowBusinessEarningId(r)
        if (beId) beToCode.set(Number(beId), r.code)
      }

      const seed = {}
      for (const cell of unitCells) {
        const uId = Number(cell.unit_id || 0)
        const bEarnId = Number(cell.business_earning_id || 0)
        const amount = Number(cell.amount || 0)
        if (!uId || !bEarnId) continue
        const code = beToCode.get(bEarnId)
        if (!code) continue
        if (!seed[code]) seed[code] = {}
        seed[code][String(uId)] = String(amount)
      }
      setValuesByCode(prev => normalizeGrid(seed))
    } catch (e) {
      setValuesByCode(prev => normalizeGrid({}))
    } finally {
      setIsLoadingSaved(false)
    }
  }, [planId, branchId, units?.length, itemRows, normalizeGrid])

  useEffect(() => { loadSavedFromBE() }, [loadSavedFromBE])

  /** ================== ✅ Arrow navigation ================== */
  const inputRefs = useRef(new Map())
  const sidebarOpen = useSidebarOpen()
  const tableWrapRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)
  useEffect(() => {
    const recalc = () => {
      const el = tableWrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setTableCardHeight(Math.max(400, Math.floor(window.innerHeight - rect.top - 6)))
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
    
    const totalCols = cols.length

    let nextR = rIdx, nextC = cIdx

    if (k === "ArrowLeft") {
      if (cIdx === 0) {
        if (rIdx > 0) { nextR = rIdx - 1; nextC = totalCols - 1 }
      } else nextC = cIdx - 1
    }

    if (k === "ArrowRight" || k === "Enter") {
      if (cIdx === totalCols - 1) {
        if (rIdx < itemRows.length - 1) { nextR = rIdx + 1; nextC = 0 }
      } else nextC = cIdx + 1
    }

    if (k === "ArrowUp") nextR = Math.max(0, rIdx - 1)
    if (k === "ArrowDown") nextR = Math.min(itemRows.length - 1, rIdx + 1)

    const target = inputRefs.current.get(`${nextR}|${nextC}`)
    if (target) {
      e.preventDefault()
      target.focus()
      try { target.select() } catch {}
      requestAnimationFrame(() => ensureInView(target))
    }
  }, [itemRows.length, cols.length, ensureInView])

  /** ---------------- Computed Totals ---------------- */
  const computed = useMemo(() => {
    const rowTotal = {}
    const colTotal = {}
    cols.forEach((c) => (colTotal[c.key] = 0))

    for (const r of ROWS) {
      if (r.kind !== "item") continue
      const v = valuesByCode[r.code] || {}
      let sum = 0
      for (const c of cols) {
        const n = toNumber(v[c.key])
        sum += n
        colTotal[c.key] += n
      }
      rowTotal[r.code] = sum
    }

    const sectionSum = (startCode, endCode) => {
      const codes = itemRows.map((x) => x.code).filter((code) => code >= startCode && code <= endCode)
      const perCol = {}
      cols.forEach((c) => (perCol[c.key] = 0))
      let total = 0
      for (const code of codes) {
        const v = valuesByCode[code] || {}
        for (const c of cols) {
          const n = toNumber(v[c.key])
          perCol[c.key] += n
          total += n
        }
      }
      return { perCol, total }
    }

    const subtotals = {
      "1.T": sectionSum("1.1", "1.6"),
      "2.T": sectionSum("2.1", "2.4"),
      "3.T": sectionSum("3.1", "3.8"),
      "4.T": sectionSum("4.1", "4.11"),
      "5.T": sectionSum("5.1", "5.7"),
      "6.T": sectionSum("6.1", "6.3"),
    }

    const grandPerCol = {}
    cols.forEach((c) => (grandPerCol[c.key] = 0))
    let grand = 0
    for (const k of Object.keys(subtotals)) {
      const s = subtotals[k]
      cols.forEach((c) => (grandPerCol[c.key] += s.perCol[c.key]))
      grand += s.total
    }

    return { rowTotal, colTotal, subtotals, grandPerCol, grand }
  }, [cols, itemRows, valuesByCode])

  const RIGHT_W = useMemo(() => cols.length * COL_W.cell + COL_W.total, [cols.length])
  const TOTAL_W = useMemo(() => LEFT_W + RIGHT_W, [RIGHT_W])

  const setCell = (code, colKey, raw) => {
    const v = sanitizeNumberInput(raw, { maxDecimals: 3 })
    setValuesByCode((prev) => ({ ...prev, [code]: { ...(prev[code] || {}), [colKey]: v } }))
  }

  /** ---------------- Save (bulk) ---------------- */
  const [saveMsg, setSaveMsg] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const buildBulkRowsForBE = () => {
    if (!planId || planId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (plan_id=${planId})`)
    if (!branchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    if (!units.length) throw new Error("FE: สาขานี้ไม่มีหน่วย หรือโหลดหน่วยไม่สำเร็จ")

    const rows = []
    const skipped = []
    const blocked = []

    for (const r of itemRows) {
      const businessEarningId = resolveRowBusinessEarningId(r)
      const rowObj = valuesByCode[r.code] || {}

      let rowSum = 0
      for (const u of units) rowSum += toNumber(rowObj[String(u.id)])

      if (!businessEarningId) {
        skipped.push({ code: r.code, label: r.label, earning_id: r.earning_id ?? null, business_group: r.business_group ?? null })
        if (rowSum !== 0) blocked.push({ code: r.code, label: r.label })
        continue
      }

      const unit_values = []
      let branch_total = 0
      for (const u of units) {
        const amount = toNumber(rowObj[String(u.id)])
        branch_total += amount
        unit_values.push({ unit_id: Number(u.id), amount })
      }

      rows.push({ branch_id: branchId, business_earning_id: Number(businessEarningId), unit_values, branch_total, comment: period })
    }

    if (blocked.length) {
      throw new Error("FE: มีรายการยังไม่แมพ แต่คุณกรอกตัวเลขแล้ว: " + blocked.map((x) => `${x.code}`).join(", "))
    }
    return { rows, skipped }
  }

  const saveAll = async () => {
    let payload = null
    try {
      setSaveMsg(null)
      const token = getToken()
      if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

      const built = buildBulkRowsForBE()
      payload = { rows: built.rows }

      setIsSaving(true)
      const res = await apiAuth(`/business-plan/${planId}/earnings/bulk`, { method: "POST", body: payload })

      setSaveMsg({ ok: true, title: "บันทึกสำเร็จ ✅", detail: `สาขา ${effectiveBranchName} • ปี ${effectiveYear} • upserted: ${res?.branch_totals_upserted ?? "-"}${built?.skipped?.length ? ` • skipped: ${built.skipped.length}` : ""}` })
    } catch (e) {
      setSaveMsg({ ok: false, title: "บันทึกไม่สำเร็จ", detail: e?.message || String(e) })
    } finally {
      setIsSaving(false)
    }
  }

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    const ids = unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)
    setValuesByCode(buildInitialValues(ids))
  }

  /** ---------------- CSS Classes ---------------- */
  const stickyShadow = "shadow-[0_0_0_1px_rgba(148,163,184,0.6)] dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]"
  const headCell = "px-1.5 py-1.5 text-[12px] font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-600 align-middle text-center"
  const cellClass = "px-1.5 py-1.5 text-[12px] border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 align-middle"
  
  const leftHeadCellCode = cx(headCell, "sticky left-0 z-20", stickyShadow)
  const leftHeadCellItem = cx(headCell, "sticky z-20 text-left", stickyShadow)
  const leftCellCode = cx(cellClass, "sticky left-0 z-10 text-center font-medium", stickyShadow)
  const leftCellItem = cx(cellClass, "sticky z-10 font-semibold", stickyShadow)
  
  const rowDivider = "border-b-[2px] border-b-slate-300 dark:border-b-slate-600"
  const footerBorder = "border-t-[2px] border-t-emerald-500 dark:border-t-emerald-600"

  return (
    <>
    <div className="overflow-x-auto p-3">
    <div className="space-y-3 mx-auto" style={{ width: TOTAL_W }}>
      {/* Header Info */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="text-[16px] font-bold">รายได้เฉพาะ</div>
          <div className="text-xl md:text-2xl font-extrabold">
            (เชื่อม BE: business-plan/earnings)
          </div>
          <div className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">
            หน่วย: พันบาท • ปี {effectiveYear} • สาขา {effectiveBranchName}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 max-w-xl">
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ช่วงแผน</label>
              <input className={baseField} value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</label>
              <div className={cx(baseField, "flex items-center justify-between", !canEdit && "opacity-70")}>
                <span className="font-semibold">{effectiveBranchName}</span>
                <span className="text-sm text-slate-500 dark:text-slate-300">id: {branchId || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700" ref={tableWrapRef} style={{ maxHeight: tableCardHeight }}>
          <table className="min-w-full border-collapse" style={{ width: TOTAL_W }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {cols.map((c) => <col key={`c-${c.key}`} style={{ width: COL_W.cell }} />)}
              <col style={{ width: COL_W.total }} />
            </colgroup>
            
            <thead className="sticky top-0 z-30">
              <tr>
                <th className={cx(leftHeadCellCode, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>รหัส</th>
                <th className={cx(leftHeadCellItem, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")} style={{ left: COL_W.code }}>รายการ</th>
                {cols.map((c) => (
                  <th key={`th-${c.key}`} className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>{c.label}</th>
                ))}
                <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>รวม</th>
              </tr>
            </thead>
            
            <tbody>
              {displayRows.map((r, rowIdx) => {
                const isItem = r.kind === "item"
                const itemIndex = isItem ? itemRows.findIndex((x) => x.code === r.code) : -1
                const isUnmapped = isItem && !resolveRowBusinessEarningId(r)
                
                let bg = STRIPE.cellEven
                let fontClass = "font-medium"
                if (r.kind === "title") { bg = STRIPE.headEven; fontClass = "font-extrabold text-slate-800 dark:text-white" }
                else if (r.kind === "section") { bg = STRIPE.section; fontClass = "font-bold text-slate-700 dark:text-slate-200" }
                else if (r.kind === "subtotal" || r.kind === "grandtotal") { bg = STRIPE.footEven; fontClass = "font-extrabold text-emerald-800 dark:text-emerald-300" }
                else if (rowIdx % 2 === 1) { bg = STRIPE.cellOdd }

                const bottomBorder = (r.kind === "section" || r.kind === "subtotal" || r.kind === "title") ? rowDivider : "border-b border-slate-200 dark:border-slate-700"

                if (!isItem) {
                  const s = r.kind === "subtotal" ? computed.subtotals[r.code] : (r.kind === "grandtotal" ? { perCol: computed.grandPerCol, total: computed.grand } : null)
                  return (
                    <tr key={r.code} className={cx(bg, fontClass, bottomBorder)}>
                      <td className={cx(leftCellCode, bg)}>{r.kind === "title" ? "" : r.code}</td>
                      <td className={cx(leftCellItem, bg)} style={{ left: COL_W.code }}>{r.label}</td>
                      {cols.map((c) => (
                        <td key={`${r.code}-${c.key}`} className={cx(cellClass, "text-right")}>
                          {s ? fmtMoney0(s.perCol?.[c.key] ?? 0) : ""}
                        </td>
                      ))}
                      <td className={cx(cellClass, "text-right")}>{s ? fmtMoney0(s.total ?? 0) : ""}</td>
                    </tr>
                  )
                }

                // Item Row
                const v = valuesByCode[r.code] || {}
                return (
                  <tr key={r.code} className={cx(bg, fontClass, isUnmapped && "bg-amber-50 dark:bg-amber-900/20")}>
                    <td className={cx(leftCellCode, bg, isUnmapped && "bg-amber-50 dark:bg-amber-900/20")}>{r.code}</td>
                    <td className={cx(leftCellItem, bg, isUnmapped && "bg-amber-50 dark:bg-amber-900/20")} style={{ left: COL_W.code }} title={isUnmapped ? "ยังไม่แมพ" : ""}>
                      {r.label} {isUnmapped && <span className="ml-1 text-[10px] text-amber-600">(ยังไม่แมพ)</span>}
                    </td>
                    {cols.map((c, colIndex) => (
                      <td key={`${r.code}-${c.key}`} className={cellClass}>
                        <input
                          ref={registerInput(itemIndex, colIndex)}
                          data-row={itemIndex} data-col={colIndex}
                          onKeyDown={(e) => handleArrowNav(e)}
                          className={cellInput}
                          inputMode="decimal"
                          value={v[c.key] ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => setCell(r.code, c.key, e.target.value)}
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className={cx(cellClass, "text-right font-bold text-emerald-700 dark:text-emerald-400")}>
                      {fmtMoney0(computed.rowTotal[r.code] ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Action Buttons (ล่างขวา) */}
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
              onClick={resetAll}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              รีเซ็ต
            </button>

            <button
              type="button"
              onClick={saveAll}
              disabled={isSaving || !canEdit}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white transition",
                (isSaving || !canEdit)
                  ? "bg-slate-300 text-slate-700 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:scale-[1.03] active:scale-[.98] cursor-pointer"
              )}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

      </div>
    </div>
    </div>
    <StickyTableScrollbar tableRef={tableWrapRef} sidebarOpen={sidebarOpen} />
    </>
  )
}

export default BusinessPlanRevenueByBusinessTable