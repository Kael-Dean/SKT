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

/** ---------------- Helpers: resolve businesscosts.id from BE (fallback for missing seed) ---------------- */
const pickIdFromAny = (v) => {
  if (!v) return null
  const cand =
    v.id ??
    v.business_cost ??
    v.business_cost_id ??
    v.businesscost_id ??
    v.businessCostId ??
    v.businessCost ??
    null
  const n = Number(cand)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function fetchBusinessCostIdRemote(costId, businessGroupId) {
  const cid = Number(costId)
  const bg = Number(businessGroupId)
  if (!Number.isFinite(cid) || !Number.isFinite(bg)) return null

  const qs = `cost_id=${encodeURIComponent(cid)}&business_group=${encodeURIComponent(bg)}`
  const endpoints = [
    `/lists/businesscost/search?${qs}`,
    `/lists/businesscosts/search?${qs}`,
    `/lists/business-costs/search?${qs}`,
    `/lists/business_cost/search?${qs}`,
  ]

  for (const ep of endpoints) {
    try {
      const data = await apiAuth(ep)
      if (Array.isArray(data)) {
        const id = pickIdFromAny(data[0])
        if (id) return id
      } else {
        const id = pickIdFromAny(data)
        if (id) return id
      }
    } catch {
      // try next endpoint
    }
  }
  return null
}

/** ---------------- Dynamic mapping cache (filled from BE) ---------------- */
const DYNAMIC_BUSINESS_COST_ID_MAP = new Map()
const registerDynamicBusinessCostId = (costId, businessGroupId, businessCostId) => {
  const key = `${Number(costId)}:${Number(businessGroupId)}`
  const id = Number(businessCostId)
  if (!Number.isFinite(id) || id <= 0) return
  DYNAMIC_BUSINESS_COST_ID_MAP.set(key, id)
}
const resolveDynamicBusinessCostId = (costId, businessGroupId) =>
  DYNAMIC_BUSINESS_COST_ID_MAP.get(`${Number(costId)}:${Number(businessGroupId)}`) ?? null

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

/** ---------------- Business group: ฝึกอบรม (ตาม BusinessGroups id=6) ---------------- */
const BUSINESS_GROUP_ID = 6

/** ---------------- Mapping: cost_id + business_group -> businesscosts.id ----------------
 * จาก businesscosts.csv (business_group=6) id 181..230
 * ⚠️ cost_id=23 ซ้ำ 2 แถว (id 207,212) -> map จะเลือกตัวแรก (207) ถ้าอยากใช้ตัวที่สองค่อย override business_cost_id
 */
const BUSINESS_COSTS_SEED = [
  { id: 181, cost_id: 7, business_group: 6 },
  { id: 182, cost_id: 78, business_group: 6 },
  { id: 183, cost_id: 79, business_group: 6 },
  { id: 184, cost_id: 77, business_group: 6 },
  { id: 185, cost_id: 8, business_group: 6 },
  { id: 186, cost_id: 61, business_group: 6 },
  { id: 187, cost_id: 21, business_group: 6 },
  { id: 188, cost_id: 34, business_group: 6 },
  { id: 189, cost_id: 81, business_group: 6 },
  { id: 190, cost_id: 19, business_group: 6 },
  { id: 191, cost_id: 20, business_group: 6 },
  { id: 192, cost_id: 18, business_group: 6 },
  { id: 193, cost_id: 31, business_group: 6 },
  { id: 194, cost_id: 22, business_group: 6 },
  { id: 195, cost_id: 68, business_group: 6 },
  { id: 196, cost_id: 16, business_group: 6 },
  { id: 197, cost_id: 14, business_group: 6 },
  { id: 198, cost_id: 26, business_group: 6 },
  { id: 199, cost_id: 66, business_group: 6 },
  { id: 200, cost_id: 64, business_group: 6 },
  { id: 201, cost_id: 82, business_group: 6 },
  { id: 202, cost_id: 11, business_group: 6 },
  { id: 203, cost_id: 9, business_group: 6 },
  { id: 204, cost_id: 83, business_group: 6 },
  { id: 205, cost_id: 84, business_group: 6 },
  { id: 206, cost_id: 85, business_group: 6 },
  { id: 207, cost_id: 23, business_group: 6 }, // ซ้ำ
  { id: 208, cost_id: 86, business_group: 6 },
  { id: 209, cost_id: 10, business_group: 6 },
  { id: 210, cost_id: 63, business_group: 6 },
  { id: 211, cost_id: 87, business_group: 6 },
  { id: 212, cost_id: 23, business_group: 6 }, // ซ้ำ
  { id: 213, cost_id: 24, business_group: 6 },
  { id: 214, cost_id: 88, business_group: 6 },
  { id: 215, cost_id: 89, business_group: 6 },
  { id: 216, cost_id: 90, business_group: 6 },
  { id: 217, cost_id: 28, business_group: 6 },
  { id: 218, cost_id: 62, business_group: 6 },
  { id: 219, cost_id: 54, business_group: 6 },
  { id: 220, cost_id: 91, business_group: 6 },
  { id: 221, cost_id: 65, business_group: 6 },
  { id: 222, cost_id: 56, business_group: 6 },
  { id: 223, cost_id: 27, business_group: 6 },
  { id: 224, cost_id: 35, business_group: 6 },
  { id: 225, cost_id: 92, business_group: 6 },
  { id: 226, cost_id: 93, business_group: 6 },
  { id: 227, cost_id: 94, business_group: 6 },
  { id: 228, cost_id: 95, business_group: 6 },
  { id: 229, cost_id: 96, business_group: 6 },
  { id: 230, cost_id: 36, business_group: 6 },
]

const BUSINESS_COST_ID_MAP = (() => {
  const m = new Map()
  for (const r of BUSINESS_COSTS_SEED) {
    const key = `${Number(r.cost_id)}:${Number(r.business_group)}`
    if (!m.has(key)) m.set(key, Number(r.id)) // ซ้ำเก็บตัวแรกเสมอ
  }
  return m
})()

const resolveBusinessCostId = (costId, businessGroupId) =>
  BUSINESS_COST_ID_MAP.get(`${Number(costId)}:${Number(businessGroupId)}`) ?? null

const resolveRowBusinessCostId = (row) => {
  if (row?.business_cost_id) return Number(row.business_cost_id)

  // per-row override (กรณีบางรายการอยู่คนละ business_group)
  const bg = row?.business_group_override != null ? Number(row.business_group_override) : BUSINESS_GROUP_ID

  // 1) dynamic map (fetched from BE)
  const dyn = resolveDynamicBusinessCostId(row?.cost_id, bg)
  if (dyn) return dyn

  // 2) seeded map (csv snapshot)
  return resolveBusinessCostId(row?.cost_id, bg)
}

/** ---------------- Rows: ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ ---------------- */
const ROWS = [
  { code: "8", label: "ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ", kind: "section" },

  { code: "8.1", label: "เงินเดือนและค่าจ้าง", kind: "item", cost_id: 7 },
  { code: "8.2", label: "ค่าเบี้ยเลี้ยงทำงานวันหยุด", kind: "item", cost_id: 8 },
  { code: "8.3", label: "ค่าเครื่องเขียนแบบพิมพ์", kind: "item", cost_id: 34 },
  { code: "8.4", label: "ค่าของใช้สำนักงาน", kind: "item", cost_id: 26 },

  // ✅ FIX: วัสดุสนง. อยู่ business_group = 8 (ตามที่แจ้ง)
  { code: "8.5", label: "ค่าวัสดุสนง.", kind: "item", cost_id: 71, business_group_override: 8 },

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
  { code: "8.18", label: "ค่าโฆษณาประชาสัมพันธ์", kind: "item", cost_id: 56 },
  { code: "8.19", label: "ค่าบำเหน็จเจ้าหน้าที่", kind: "item", cost_id: 62 },
  { code: "8.20", label: "ค่าซ่อมแซมบำรุงรักษายานพาหนะ", kind: "item", cost_id: 28 },
  { code: "8.21", label: "ค่าบริการสมาชิก", kind: "item", cost_id: 27 },
  { code: "8.22", label: "ค่าภาษีโรงเรือน", kind: "item", cost_id: 35 },
  { code: "8.23", label: "ค่าเช่าสำนักงาน", kind: "item", cost_id: 83 },
  { code: "8.24", label: "แบบฟอร์มกรรมการ", kind: "item", cost_id: 84 },
  { code: "8.25", label: "ค่าประชุมคณะกรรมการ", kind: "item", cost_id: 85 },
  { code: "8.26", label: "เบี้ยประชุมกรรมการ", kind: "item", cost_id: 78 },
  { code: "8.27", label: "เบี้ยเลี้ยงพาหนะกรรมการ", kind: "item", cost_id: 79 },
  { code: "8.28", label: "เบี้ยเลี้ยงเจ้าหน้าที่", kind: "item", cost_id: 77 },
  { code: "8.29", label: "ค่าจัดประชุมใหญ่", kind: "item", cost_id: 81 },
  { code: "8.30", label: "ดอกเบี้ยจ่ายเงินสะสมเจ้าหน้าที่", kind: "item", cost_id: 68 },
  { code: "8.31", label: "ค่ารับรอง", kind: "item", cost_id: 61 },
  { code: "8.32", label: "ค่าประชุมระดับอำเภอ", kind: "item", cost_id: 86 },
  { code: "8.33", label: "ค่าซ่อมบำรุง-ครุภัณฑ์", kind: "item", cost_id: 10 },
  { code: "8.34", label: "ค่าธรรมเนียมโอนเงิน", kind: "item", cost_id: 63 },
  { code: "8.35", label: "ขาดทุนจากการเลิกใช้ครุภัณฑ์", kind: "item", cost_id: 87 },
  { code: "8.36", label: "ค่าตอบแทนที่ปรึกษาด้านบัญชี", kind: "item", cost_id: 88 },
  { code: "8.37", label: "ค่าตอบแทนผู้ตรวจสอบกิจการ", kind: "item", cost_id: 89 },
  { code: "8.38", label: "เงินสมทบประกันสังคม", kind: "item", cost_id: 64 },
  { code: "8.39", label: "เงินสมทบกองทุนเงินทดแทนประกันสังคม", kind: "item", cost_id: 82 },
  { code: "8.40", label: "ค่าประชาสัมพันธ์", kind: "item", cost_id: 24 },
  { code: "8.41", label: "งานบ้านงานครัว", kind: "item", cost_id: 65 },
  { code: "8.42", label: "ค่าเสื่อมราคา-ยานพาหนะ", kind: "item", cost_id: 20 },
  { code: "8.43", label: "ค่าเช่าสถานที่เก็บสินค้า", kind: "item", cost_id: 3 },
  { code: "8.44", label: "ค่าใช้โปรแกรม", kind: "item", cost_id: 53 },
  { code: "8.45", label: "ค่าไฟฟ้า", kind: "item", cost_id: 16 },
  { code: "8.46", label: "ค่าน้ำประปา", kind: "item", cost_id: 22 },
  { code: "8.47", label: "ค่าเบี้ยประกันภัย", kind: "item", cost_id: 9 },
  { code: "8.48", label: "ค่าซ่อมบำรุง-อาคาร", kind: "item", cost_id: 31 },
  { code: "8.49", label: "ค่าบำรุงรักษา-รถตัก/ยานพาหนะ", kind: "item", cost_id: 45 },
  { code: "8.50", label: "ค่าใช้จ่ายเบ็ดเตล็ด", kind: "item", cost_id: 36 },
]

/** ---------------- Table months (April..March) ---------------- */
const MONTHS = [
  { key: "april", label: "เม.ย." },
  { key: "may", label: "พ.ค." },
  { key: "june", label: "มิ.ย." },
  { key: "july", label: "ก.ค." },
  { key: "august", label: "ส.ค." },
  { key: "september", label: "ก.ย." },
  { key: "october", label: "ต.ค." },
  { key: "november", label: "พ.ย." },
  { key: "december", label: "ธ.ค." },
  { key: "january", label: "ม.ค." },
  { key: "february", label: "ก.พ." },
  { key: "march", label: "มี.ค." },
]

const MONTH_KEYS = MONTHS.map((m) => m.key)

/** ---------------- Default empty values ---------------- */
const emptyRowValues = () =>
  MONTH_KEYS.reduce((acc, k) => {
    acc[k] = ""
    return acc
  }, {})

/** ---------------- Component ---------------- */
const BusinessPlanExpenseServiceTable = (props = {}) => {
  const { branchId, branchName, yearBE, planId } = props

  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])

  // Prefetch mapping for rows that are in a different business_group (เช่น วัสดุสนง. cost_id=71, business_group=8)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const targets = itemRows.filter((r) => r?.business_group_override != null)
      for (const r of targets) {
        const bg = Number(r.business_group_override)
        // ถ้ามีอยู่แล้ว (seed/dynamic) ก็ไม่ต้องยิง
        if (resolveRowBusinessCostId(r)) continue
        const id = await fetchBusinessCostIdRemote(r.cost_id, bg)
        if (!alive) return
        if (id) registerDynamicBusinessCostId(r.cost_id, bg, id)
      }
    })()
    return () => {
      alive = false
    }
  }, [itemRows])

  const effectiveBranchId = useMemo(() => Number(branchId || 0), [branchId])
  const effectivePlanId = useMemo(() => Number(planId || 0), [planId])

  const [units, setUnits] = useState([])
  const [unitId, setUnitId] = useState("")
  const [loadingUnits, setLoadingUnits] = useState(false)

  const [latest, setLatest] = useState(null)
  const [loadingLatest, setLoadingLatest] = useState(false)

  const [valuesByCode, setValuesByCode] = useState(() => {
    const init = {}
    for (const r of itemRows) init[r.code] = emptyRowValues()
    return init
  })

  const [saveBusy, setSaveBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const [statusKind, setStatusKind] = useState("info") // info | ok | warn | err

  const [unmappedTouched, setUnmappedTouched] = useState([])

  const tableWrapRef = useRef(null)
  const inputRefs = useRef({})

  const itemRowsByCode = useMemo(() => {
    const m = new Map()
    for (const r of itemRows) m.set(r.code, r)
    return m
  }, [itemRows])

  /** ---------------- Build input order for Enter navigation ---------------- */
  const inputOrder = useMemo(() => {
    const list = []
    for (const r of itemRows) {
      for (const mk of MONTH_KEYS) list.push(`${r.code}:${mk}`)
    }
    return list
  }, [itemRows])

  const focusCell = useCallback((key) => {
    const el = inputRefs.current?.[key]
    if (el && typeof el.focus === "function") el.focus()
  }, [])

  const focusNext = useCallback(
    (key) => {
      const i = inputOrder.indexOf(key)
      if (i < 0) return
      const next = inputOrder[i + 1]
      if (next) focusCell(next)
    },
    [inputOrder, focusCell]
  )

  /** ---------------- Load units by branch ---------------- */
  const loadUnits = useCallback(async () => {
    if (!effectiveBranchId) {
      setUnits([])
      setUnitId("")
      return
    }
    setLoadingUnits(true)
    try {
      const data = await apiAuth(`/lists/unit/search?branch_id=${effectiveBranchId}`)
      const list = Array.isArray(data) ? data : []
      setUnits(list)
      if (list.length > 0) setUnitId((prev) => prev || String(list[0].id))
    } catch (e) {
      console.error("Load units failed", e)
      setUnits([])
      setUnitId("")
      setStatusKind("err")
      setStatusMsg(e?.message || "โหลดหน่วยไม่สำเร็จ")
    } finally {
      setLoadingUnits(false)
    }
  }, [effectiveBranchId])

  useEffect(() => {
    loadUnits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBranchId])

  /** ---------------- Load latest saved values ---------------- */
  const loadLatest = useCallback(async () => {
    setLatest(null)
    setUnmappedTouched([])
    if (!effectivePlanId || !effectiveBranchId) return
    setLoadingLatest(true)
    try {
      // NOTE: endpoint นี้อิงตาม pattern หน้าอื่น ๆ ในโปรเจค (ถ้า BE เปลี่ยนชื่อ endpoint ให้แก้ตรงนี้)
      const data = await apiAuth(
        `/expense/business-costs?plan_id=${effectivePlanId}&branch_id=${effectiveBranchId}&business_group=${BUSINESS_GROUP_ID}`
      )
      setLatest(data || null)

      // Apply latest -> valuesByCode
      const next = {}
      for (const r of itemRows) next[r.code] = emptyRowValues()

      // data.items: [{ business_cost, month, amount }] หรือรูปแบบใกล้เคียง
      const items = Array.isArray(data?.items) ? data.items : []
      const bcToCode = new Map()
      for (const r of itemRows) {
        const bcId = resolveRowBusinessCostId(r)
        if (bcId) bcToCode.set(Number(bcId), r.code)
      }

      for (const it of items) {
        const bcId = Number(it?.business_cost ?? it?.business_cost_id ?? it?.id ?? 0)
        const code = bcToCode.get(bcId)
        if (!code) continue
        const monthKey = String(it?.month || "").toLowerCase()
        if (!MONTH_KEYS.includes(monthKey)) continue
        const amt = it?.amount ?? it?.value ?? ""
        next[code] = { ...(next[code] || emptyRowValues()), [monthKey]: amt === 0 ? "0" : String(amt ?? "") }
      }

      setValuesByCode((prev) => {
        // preserve shape but apply latest
        const merged = { ...prev }
        for (const r of itemRows) merged[r.code] = next[r.code] || emptyRowValues()
        return merged
      })

      setStatusKind("ok")
      setStatusMsg("โหลดค่าล่าสุดแล้ว")
    } catch (e) {
      console.error("Load latest failed", e)
      setStatusKind("err")
      setStatusMsg(e?.message || "โหลดค่าล่าสุดไม่สำเร็จ")
    } finally {
      setLoadingLatest(false)
    }
  }, [effectivePlanId, effectiveBranchId, itemRows])

  useEffect(() => {
    loadLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePlanId, effectiveBranchId])

  /** ---------------- Computed totals ---------------- */
  const computed = useMemo(() => {
    const rowTotal = {}
    const colTotal = {}
    for (const mk of MONTH_KEYS) colTotal[mk] = 0

    for (const r of itemRows) {
      const v = valuesByCode?.[r.code] || {}
      let sum = 0
      for (const mk of MONTH_KEYS) {
        const n = toNumber(v[mk])
        sum += n
        colTotal[mk] += n
      }
      rowTotal[r.code] = sum
    }

    const grand = MONTH_KEYS.reduce((acc, mk) => acc + toNumber(colTotal[mk]), 0)
    return { rowTotal, colTotal, grand }
  }, [itemRows, valuesByCode])

  /** ---------------- Unmapped static list (for warning) ---------------- */
  const unmappedStatic = useMemo(() => {
    return itemRows
      .filter((r) => !resolveRowBusinessCostId(r))
      .map((r) => ({ code: r.code, label: r.label, cost_id: r.cost_id }))
  }, [itemRows])

  /** ---------------- Update a cell ---------------- */
  const setCell = useCallback((code, monthKey, raw) => {
    const s = sanitizeNumberInput(raw, { maxDecimals: 0 })
    setValuesByCode((prev) => ({
      ...prev,
      [code]: { ...(prev?.[code] || emptyRowValues()), [monthKey]: s },
    }))
  }, [])

  /** ---------------- Track user typed on unmapped row ---------------- */
  useEffect(() => {
    const blocked = []

    for (const r of itemRows) {
      const businessCostId = resolveRowBusinessCostId(r)
      const rowObj = valuesByCode?.[r.code] || {}
      const rowHas = MONTH_KEYS.some((mk) => toNumber(rowObj[mk]) !== 0)

      if (!businessCostId && rowHas) blocked.push(r)
    }

    if (blocked.length > 0) {
      setUnmappedTouched(
        blocked.map((r) => ({
          code: r.code,
          label: r.label,
          cost_id: r.cost_id,
        }))
      )
      setStatusKind("warn")
      setStatusMsg(
        `FE: มีบางรายการยังไม่มี mapping ใน businesscosts (ธุรกิจ=${BUSINESS_GROUP_ID}) แต่คุณกรอกตัวเลขแล้ว: ` +
          blocked.map((x) => `${x.code} (${x.cost_id})`).join(", ")
      )
    }
  }, [valuesByCode, itemRows])

  /** ---------------- Save ---------------- */
  const onSave = useCallback(async () => {
    if (!effectivePlanId) {
      setStatusKind("warn")
      setStatusMsg("ยังไม่ได้เลือกปี/แผน (plan_id)")
      return
    }
    if (!effectiveBranchId) {
      setStatusKind("warn")
      setStatusMsg("ยังไม่ได้เลือกสาขา (branch_id)")
      return
    }

    // Build payload (bulk)
    const payloadItems = []

    for (const r of itemRows) {
      const bg = r?.business_group_override != null ? Number(r.business_group_override) : BUSINESS_GROUP_ID
      const businessCostId = resolveRowBusinessCostId(r)

      // ถ้าไม่มี mapping -> บันทึกเป็น 0 ตามที่หน้าแจ้งเตือน
      for (const mk of MONTH_KEYS) {
        const amt = toNumber(valuesByCode?.[r.code]?.[mk])
        payloadItems.push({
          plan_id: effectivePlanId,
          branch_id: effectiveBranchId,
          business_group: bg,
          cost_id: Number(r.cost_id),
          business_cost: businessCostId, // FK businesscosts.id (ถ้า null ให้ BE จัดการ/ข้าม/ถือเป็น 0)
          month: mk,
          amount: amt,
        })
      }
    }

    setSaveBusy(true)
    setStatusKind("info")
    setStatusMsg("กำลังบันทึก...")

    try {
      // NOTE: endpoint bulk ให้เหมือน pattern หน้าอื่น ๆ (ถ้า BE เปลี่ยนชื่อ endpoint ให้แก้ตรงนี้)
      await apiAuth(`/expense/business-costs/bulk`, { method: "PUT", body: payloadItems })
      setStatusKind("ok")
      setStatusMsg("บันทึกสำเร็จ ✅")

      // reload latest always after success
      await loadLatest()
    } catch (e) {
      console.error("[BusinessPlanExpenseServiceTable] Save failed:", e, payloadItems)
      setStatusKind("err")
      setStatusMsg(e?.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaveBusy(false)
    }
  }, [effectivePlanId, effectiveBranchId, itemRows, valuesByCode, loadLatest])

  /** ---------------- Render helpers ---------------- */
  const badgeClass = useMemo(() => {
    if (statusKind === "ok") return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-100"
    if (statusKind === "warn") return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100"
    if (statusKind === "err") return "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-100"
    return "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
  }, [statusKind])

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-28 pt-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">ค่าใช้จ่ายเฉพาะธุรกิจบริการ</div>
            <div className="text-sm text-slate-500 dark:text-slate-300">
              สาขา: <span className="font-medium">{branchName || "-"}</span> · ปี:{" "}
              <span className="font-medium">{yearBE || "-"}</span> · plan_id:{" "}
              <span className="font-medium">{effectivePlanId || "-"}</span> · business_group:{" "}
              <span className="font-medium">{BUSINESS_GROUP_ID}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={cx("rounded-xl border px-3 py-2 text-sm", badgeClass)}>
              {statusMsg || "—"}
            </div>
          </div>
        </div>

        {unmappedTouched?.length > 0 && (
          <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
            <div className="font-semibold">⚠️ รายการที่ยังไม่แมพ (จะข้ามตอนบันทึกถ้าเป็น 0)</div>
            <div className="mt-1 text-sm">
              {unmappedTouched.map((u) => (
                <div key={u.code}>
                  {u.code} ({u.label}) (cost_id={u.cost_id})
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">สาขา</div>
            <input className={readonlyField} value={branchName || ""} readOnly />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">หน่วย (ตามสาขา)</div>
            <select
              className={baseField}
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={loadingUnits || !effectiveBranchId}
            >
              <option value="">{loadingUnits ? "กำลังโหลด..." : "— เลือกหน่วย —"}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unit}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">สถานะข้อมูลล่าสุด</div>
            <input
              className={readonlyField}
              value={loadingLatest ? "กำลังโหลด..." : latest ? "มีข้อมูลล่าสุด" : "—"}
              readOnly
            />
          </div>
        </div>

        <div ref={tableWrapRef} className="w-full overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-[980px] w-full table-fixed border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="w-[70px] border-b border-slate-200 px-2 py-2 text-left text-[12px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  รายการ
                </th>
                <th className="w-[220px] border-b border-slate-200 px-2 py-2 text-left text-[12px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  รายละเอียด
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m.key}
                    className="w-[70px] border-b border-slate-200 px-1 py-2 text-right text-[12px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    {m.label}
                  </th>
                ))}
                <th className="w-[90px] border-b border-slate-200 px-2 py-2 text-right text-[12px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  รวม
                </th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((r) => {
                if (r.kind === "section") {
                  return (
                    <tr key={r.code}>
                      <td
                        colSpan={2 + MONTHS.length + 1}
                        className="border-b border-slate-200 bg-slate-100 px-2 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
                      >
                        {r.label}
                      </td>
                    </tr>
                  )
                }

                const rowSum = computed.rowTotal[r.code] || 0
                const isUnmapped = !resolveRowBusinessCostId(r)

                const rowBg = isUnmapped
                  ? "bg-amber-50/40 dark:bg-amber-900/10"
                  : "bg-white dark:bg-slate-900"

                return (
                  <tr key={r.code} className={rowBg}>
                    <td className="border-b border-slate-200 px-2 py-2 text-[12px] text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      <div className={cx(trunc, "font-medium")} title={r.code}>
                        {r.code}
                      </div>
                    </td>

                    <td className="border-b border-slate-200 px-2 py-2 text-[12px] text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      <div className={cx(trunc)} title={isUnmapped ? "ยังไม่แมพ (businesscosts)" : ""}>
                        {r.label}
                        {isUnmapped ? <span className="ml-2 text-amber-700 dark:text-amber-200">(ยังไม่แมพ)</span> : null}
                      </div>
                    </td>

                    {MONTH_KEYS.map((mk) => {
                      const key = `${r.code}:${mk}`
                      const val = valuesByCode?.[r.code]?.[mk] ?? ""
                      return (
                        <td
                          key={key}
                          className="border-b border-slate-200 px-1 py-1 dark:border-slate-700"
                        >
                          <input
                            ref={(el) => (inputRefs.current[key] = el)}
                            className={cellInput}
                            value={val}
                            inputMode="numeric"
                            onChange={(e) => setCell(r.code, mk, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                focusNext(key)
                              }
                            }}
                          />
                        </td>
                      )
                    })}

                    <td className="border-b border-slate-200 px-2 py-1 text-right text-[12px] font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100">
                      {fmtMoney0(rowSum)}
                    </td>
                  </tr>
                )
              })}

              <tr className="bg-slate-50 dark:bg-slate-800">
                <td
                  colSpan={2}
                  className="border-t border-slate-200 px-2 py-2 text-[12px] font-bold text-slate-800 dark:border-slate-700 dark:text-slate-100"
                >
                  รวมทั้งหมด
                </td>
                {MONTH_KEYS.map((mk) => (
                  <td
                    key={mk}
                    className="border-t border-slate-200 px-1 py-2 text-right text-[12px] font-bold text-slate-800 dark:border-slate-700 dark:text-slate-100"
                  >
                    {fmtMoney0(computed.colTotal[mk] || 0)}
                  </td>
                ))}
                <td className="border-t border-slate-200 px-2 py-2 text-right text-[12px] font-extrabold text-slate-900 dark:border-slate-700 dark:text-white">
                  {fmtMoney0(computed.grand || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Save bar (bottom-right like other pages) */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-300">
            PUT: <span className="font-mono">/expense/business-costs/bulk</span> · GET latest:{" "}
            <span className="font-mono">/expense/business-costs</span>
          </div>
          <button
            className={cx(
              "rounded-2xl px-5 py-2.5 text-sm font-semibold shadow-sm transition",
              saveBusy
                ? "cursor-not-allowed bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            )}
            onClick={onSave}
            disabled={saveBusy}
          >
            {saveBusy ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BusinessPlanExpenseServiceTable