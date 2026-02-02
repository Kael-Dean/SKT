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

/** ---------------- API helper ---------------- */
const API_BASE_RAW =
  import.meta.env.VITE_API_BASE_CUSTOM ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""

const API_BASE = String(API_BASE_RAW || "").replace(/\/+$/, "")

const safeJsonParse = (s) => {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/**
 * ✅ ดึง token แบบ “เอาให้เจอ”
 * - รองรับ key หลายแบบ
 * - รองรับเก็บเป็น JSON string (เช่น localStorage.auth = {"access_token":"..."})
 */
const extractToken = () => {
  // 1) keys ตรง ๆ ที่พบบ่อย
  const direct =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("jwt") ||
    sessionStorage.getItem("accessToken") ||
    sessionStorage.getItem("authToken")

  if (direct && typeof direct === "string") return direct

  // 2) บางโปรเจกต์เก็บเป็น JSON object
  const blobs = [
    localStorage.getItem("auth"),
    localStorage.getItem("user"),
    localStorage.getItem("session"),
    localStorage.getItem("profile"),
    localStorage.getItem("userdata"),
    sessionStorage.getItem("auth"),
    sessionStorage.getItem("user"),
    sessionStorage.getItem("session"),
    sessionStorage.getItem("profile"),
    sessionStorage.getItem("userdata"),
  ].filter(Boolean)

  for (const raw of blobs) {
    const obj = safeJsonParse(raw)
    if (!obj) continue
    const t =
      obj.access_token ||
      obj.token ||
      obj.jwt ||
      obj?.data?.access_token ||
      obj?.data?.token ||
      obj?.data?.jwt ||
      obj?.user?.access_token ||
      obj?.user?.token ||
      obj?.user?.jwt
    if (t) return String(t)
  }

  return ""
}

// JWT decode แบบเบา ๆ (เพื่อโชว์ role/user/exp เฉย ๆ ไม่ได้ใช้ verify)
const decodeJwtPayload = (token) => {
  try {
    const t = String(token || "")
    const pure = t.startsWith("Bearer ") ? t.slice(7) : t
    const parts = pure.split(".")
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : ""
    const json = atob(b64 + pad)
    return JSON.parse(json)
  } catch {
    return null
  }
}

const getAuthHeader = () => {
  const token = extractToken()
  if (!token) return {}
  return { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
}

class ApiError extends Error {
  constructor(message, meta = {}) {
    super(message)
    this.name = "ApiError"
    Object.assign(this, meta)
  }
}

async function apiFetch(path, { method = "GET", body } = {}) {
  if (!API_BASE) throw new Error("FE: ยังไม่ได้ตั้ง API Base (VITE_API_BASE / VITE_API_BASE_CUSTOM)")
  const url = `${API_BASE}${path}`

  let res
  try {
    const _auth = getAuthHeader()
    const _hasAuth = Boolean(_auth?.Authorization)
    if (!_hasAuth) {
      console.warn("[API DEBUG] Missing Authorization header for", url)
    }

    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ..._auth,
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    })
  } catch (err) {
    throw new ApiError("FE: เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (Network/CORS/DNS)", {
      status: 0,
      url,
      method,
      requestBody: body ?? null,
      responseBody: null,
      cause: err,
    })
  }

  const txt = await res.text()
  let data = null
  try {
    data = txt ? JSON.parse(txt) : null
  } catch {
    data = txt
  }

  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`
    throw new ApiError(msg, {
      status: res.status,
      url,
      method,
      requestBody: body ?? null,
      responseBody: data,
      responseText: txt,
    })
  }
  return data
}

/** ---------------- UI styles ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

/** ---------------- Plan year -> plan_id ---------------- */
/**
 * ตามที่คุณกำหนด:
 * ปี 2569 => plan_id 1
 * ปี 2570 => plan_id 2
 * ...
 * สูตร: plan_id = year - 2568
 */
const YEAR_BASE = 2569
const YEAR_COUNT = 11 // 2569..2579 (อีกสิบปี)
const yearOptions = Array.from({ length: YEAR_COUNT }, (_, i) => YEAR_BASE + i)

const yearToPlanId = (yearBE) => {
  const y = Number(yearBE || 0)
  if (!Number.isFinite(y) || y <= 0) return 0
  return y - 2568
}

const planIdToYear = (planId) => {
  const p = Number(planId || 0)
  if (!Number.isFinite(p) || p <= 0) return 0
  return p + 2568
}

/** ---------------- Table definition ---------------- */
const BRANCH_ID_BY_KEY = {
  hq: 1,
  surin: 2,
  nonnarai: 3,
}

const BUSINESS_GROUP_ID = 1 // ล็อก group 1 ตามที่ต้องการ

const COLS = [
  { key: "hq", label: "สาขา" },
  { key: "surin", label: "สุรินทร์" },
  { key: "nonnarai", label: "โนนนารายณ์" },
]

/**
 * ✅ cost_id ใน Excel = costtypes.id (2–106)
 * ไฟล์นี้ทำ group 1 (จัดหา) ตามรายการที่คุณใช้
 */
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

function buildInitialValues() {
  const out = {}
  ROWS.forEach((r) => {
    if (r.kind !== "item") return
    out[r.code] = { hq: "", surin: "", nonnarai: "" }
  })
  return out
}

/** ✅ lock width ให้ตรงกันทุกส่วน */
const COL_W = { code: 72, item: 380, cell: 120, total: 120 }
const LEFT_W = COL_W.code + COL_W.item
const RIGHT_W = COLS.length * COL_W.cell + COL_W.total
const TOTAL_W = LEFT_W + RIGHT_W

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

/**
 * ✅ สำคัญ: FE ต้องหา BusinessCost.id (ตาราง businesscosts)
 * จากคู่ค่า (cost_id, business_group=1) แล้วส่งไป BE เป็น business_cost_id
 *
 * group 1 seed ใน DB ของคุณ:
 *   businesscosts.id 1..35  <-> cost_id 2..36
 */
const BUSINESS_COSTS_SEED = (() => {
  const out = []
  for (let costId = 2; costId <= 36; costId++) {
    out.push({ id: costId - 1, cost_id: costId, business_group: 1 })
  }
  return out
})()

const BUSINESS_COST_ID_MAP = new Map(
  BUSINESS_COSTS_SEED.map((r) => [`${r.cost_id}:${r.business_group}`, r.id])
)

const resolveBusinessCostId = (costId, businessGroupId) => {
  const key = `${Number(costId)}:${Number(businessGroupId)}`
  return BUSINESS_COST_ID_MAP.get(key) ?? null
}

const BusinessPlanExpenseTable = () => {
  /** ---------------- Year selection ---------------- */
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = Number(localStorage.getItem("business_plan_year") || 0)
    if (saved && yearOptions.includes(saved)) return saved
    return YEAR_BASE
  })

  const planId = useMemo(() => yearToPlanId(selectedYear), [selectedYear])

  const periodLabel = useMemo(() => {
    const yy = String(selectedYear).slice(-2)
    const yyNext = String(selectedYear + 1).slice(-2)
    return `1 เม.ย.${yy}-31 มี.ค.${yyNext}`
  }, [selectedYear])

  useEffect(() => {
    localStorage.setItem("business_plan_year", String(selectedYear))
    localStorage.setItem("business_plan_id", String(planId))
    localStorage.setItem("plan_id", String(planId))
  }, [selectedYear, planId])

  const authDebug = (() => {
    const token = extractToken()
    const jwt = token ? decodeJwtPayload(token) : null
    const role =
      jwt?.role_id ??
      jwt?.role ??
      jwt?.roleId ??
      jwt?.roleID ??
      jwt?.user?.role_id ??
      null
    const userId = jwt?.user_id ?? jwt?.sub ?? null
    const exp = jwt?.exp ?? null
    return {
      tokenFound: Boolean(token),
      role,
      userId,
      exp,
    }
  })()

  /** ---------------- State ---------------- */
  const [valuesByCode, setValuesByCode] = useState(() => buildInitialValues())
  const [showPayload, setShowPayload] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState(null)

  /** ✅ ขยายความสูงตาราง */
  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)

  const recalcTableCardHeight = useCallback(() => {
    const el = tableCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 900
    const bottomPadding = 6
    const h = Math.max(860, Math.floor(vh - rect.top - bottomPadding))
    setTableCardHeight(h)
  }, [])

  useEffect(() => {
    recalcTableCardHeight()
    window.addEventListener("resize", recalcTableCardHeight)
    return () => window.removeEventListener("resize", recalcTableCardHeight)
  }, [recalcTableCardHeight])

  useEffect(() => {
    requestAnimationFrame(() => recalcTableCardHeight())
  }, [showPayload, selectedYear, recalcTableCardHeight])

  /** ✅ sync footer scroll */
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

  /** ✅ Arrow navigation */
  const inputRefs = useRef(new Map())
  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])
  const totalCols = COLS.length

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
      if (nextCol > totalCols - 1) nextCol = totalCols - 1

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

  const setCell = (code, colKey, nextValue) => {
    setValuesByCode((prev) => {
      const next = { ...prev }
      const row = { ...(next[code] || { hq: "", surin: "", nonnarai: "" }) }
      row[colKey] = nextValue
      next[code] = row
      return next
    })
  }

  const computed = useMemo(() => {
    const rowTotal = {}
    const colTotal = { hq: 0, surin: 0, nonnarai: 0 }
    let grand = 0

    itemRows.forEach((r) => {
      const v = valuesByCode[r.code] || { hq: 0, surin: 0, nonnarai: 0 }
      const a = toNumber(v.hq)
      const b = toNumber(v.surin)
      const c = toNumber(v.nonnarai)
      const sum = a + b + c

      rowTotal[r.code] = { hq: a, surin: b, nonnarai: c, total: sum }
      colTotal.hq += a
      colTotal.surin += b
      colTotal.nonnarai += c
      grand += sum
    })

    return { rowTotal, colTotal, grand }
  }, [valuesByCode, itemRows])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setValuesByCode(buildInitialValues())
    setSaveNotice({ type: "info", title: "ล้างข้อมูลแล้ว", detail: "ข้อมูลที่กรอกถูกรีเซ็ตเป็น 0" })
  }

  const canTalkBEReason = useMemo(() => {
    if (!API_BASE) return "FE: ยังไม่ได้ตั้ง API Base (VITE_API_BASE / VITE_API_BASE_CUSTOM)"
    if (!planId || planId <= 0) return `FE: plan_id ไม่ถูกต้อง (year=${selectedYear} -> plan_id=${planId})`
    return ""
  }, [planId, selectedYear])

  const buildBulkRowsForBE = () => {
    if (!API_BASE) throw new Error("FE: ยังไม่มี API Base (VITE_API_BASE / VITE_API_BASE_CUSTOM)")
    if (!planId || planId <= 0) throw new Error("FE: ไม่มี plan_id (เลือกปีให้ถูกต้อง)")

    COLS.forEach((c) => {
      if (!BRANCH_ID_BY_KEY[c.key]) throw new Error(`FE: ยังไม่ได้ตั้ง BRANCH_ID_BY_KEY สำหรับคอลัมน์: ${c.key}`)
    })

    const rows = []
    itemRows.forEach((r) => {
      const businessCostId = resolveBusinessCostId(r.cost_id, BUSINESS_GROUP_ID)
      if (!businessCostId) {
        throw new Error(
          `FE: หา businesscosts.id ไม่เจอจาก (cost_id=${r.cost_id}, business_group=${BUSINESS_GROUP_ID}) — ตรวจ seed/mapping`
        )
      }

      COLS.forEach((c) => {
        rows.push({
          branch_id: BRANCH_ID_BY_KEY[c.key],
          business_cost_id: businessCostId,
          unit_values: [],
          branch_total: toNumber(valuesByCode?.[r.code]?.[c.key] ?? 0),
          comment: periodLabel,
        })
      })
    })

    return { rows }
  }

  const saveToBE = async () => {
    let builtBody = null
    try {
      setSaveNotice(null)

      if (canTalkBEReason) {
        setSaveNotice({ type: "error", title: "บันทึกไม่ได้ (ฝั่ง FE)", detail: canTalkBEReason })
        console.groupCollapsed("%c[BusinessPlanExpenseTable] Save blocked (FE) ⛔", "color:#f97316;font-weight:800;")
        console.error("reason:", canTalkBEReason)
        console.error("year:", selectedYear)
        console.error("plan_id:", planId)
        console.error("API_BASE:", API_BASE || "(missing)")
        console.groupEnd()
        return
      }

      // ✅ เช็ค token ก่อนยิงไป BE (401 ส่วนใหญ่เกิดจากตรงนี้)
      const _token = extractToken()
      const _jwt = _token ? decodeJwtPayload(_token) : null
      const _role =
        _jwt?.role_id ??
        _jwt?.role ??
        _jwt?.roleId ??
        _jwt?.roleID ??
        _jwt?.user?.role_id ??
        null

      if (!_token) {
        const msg = "FE: ไม่พบ token ในเครื่อง → ต้อง Login ก่อน (หรือ token ถูกเก็บคนละ key)"
        setSaveNotice({ type: "error", title: "บันทึกไม่ได้ (ฝั่ง FE)", detail: msg })
        console.groupCollapsed("%c[BusinessPlanExpenseTable] Save blocked (No token) ⛔", "color:#f97316;font-weight:800;")
        console.error("reason:", msg)
        console.error("year:", selectedYear, "plan_id:", planId)
        console.error("localStorage keys:", Object.keys(localStorage || {}))
        console.groupEnd()
        return
      }

      // ถ้ามี token แต่ยังโดน 403 จะได้เห็น role ใน console
      if (_jwt) {
        console.log("[AUTH DEBUG] role_id:", _role, "user_id:", (_jwt?.user_id ?? _jwt?.sub ?? null), "exp:", _jwt?.exp ?? null)
      }

      setIsSaving(true)
      builtBody = buildBulkRowsForBE()

      const res = await apiFetch(`/business-plan/${planId}/costs/bulk`, {
        method: "POST",
        body: builtBody,
      })

      setSaveNotice({
        type: "success",
        title: "บันทึกสำเร็จ ✅",
        detail: `ปี ${selectedYear} (plan_id=${planId}) ถูกส่งขึ้นระบบแล้ว (upserted: ${res?.branch_totals_upserted ?? "-"})`,
      })

      console.groupCollapsed("%c[BusinessPlanExpenseTable] Save OK ✅", "color:#10b981;font-weight:800;")
      console.log("year:", selectedYear)
      console.log("plan_id:", planId)
      console.log("business_group_id:", BUSINESS_GROUP_ID)
      console.log("response:", res)
      console.groupEnd()
    } catch (e) {
      const token = extractToken()
      const jwt = token ? decodeJwtPayload(token) : null
      const role =
        jwt?.role_id ??
        jwt?.role ??
        jwt?.roleId ??
        jwt?.roleID ??
        jwt?.user?.role_id ??
        null

      const isApiErr = e?.name === "ApiError"
      const status = isApiErr ? Number(e?.status || 0) : 0

      let title = isApiErr ? "บันทึกไม่สำเร็จ (Server/BE)" : "บันทึกไม่สำเร็จ (ฝั่ง FE)"
      let detail = isApiErr
        ? `BE ตอบกลับ: ${e?.message || "error"} (HTTP ${e?.status ?? "-"})`
        : `${e?.message || e}`

      if (isApiErr && status === 401) {
        title = "บันทึกไม่ได้ (401 Unauthorized)"
        detail = token
          ? "ส่งไปถึง BE แล้ว แต่ BE ปฏิเสธ token (หมดอายุ/ไม่ถูกต้อง) → ลอง Logout/Login ใหม่"
          : "FE ไม่ได้แนบ Authorization (ไม่พบ token) → ต้อง Login ก่อน"
      }

      if (isApiErr && status === 403) {
        title = "บันทึกไม่ได้ (403 Forbidden)"
        detail =
          role !== null
            ? `token ผ่านแล้ว แต่สิทธิ์ไม่พอ (role_id=${role}) → ต้องใช้ผู้ใช้ที่มีสิทธิ์หรือให้ BE เปิดสิทธิ์`
            : "token ผ่านแล้ว แต่สิทธิ์ไม่พอ (role ไม่อนุญาต) → ต้องใช้ผู้ใช้ที่มีสิทธิ์"
      }

      setSaveNotice({ type: "error", title, detail })

      const hasAuth = Boolean(getAuthHeader().Authorization)

      console.groupCollapsed("%c[BusinessPlanExpenseTable] Save failed ❌", "color:#ef4444;font-weight:800;")
      console.error("title:", title)
      console.error("detail:", detail)
      console.error("hasAuthToken:", hasAuth)
      console.error("API_BASE:", API_BASE || "(missing)")
      console.error("year:", selectedYear)
      console.error("plan_id:", planId || "(missing)")
      console.error("business_group_id:", BUSINESS_GROUP_ID)
      console.error("BRANCH_ID_BY_KEY:", BRANCH_ID_BY_KEY)

      if (isApiErr) {
        console.error("status:", e.status)
        console.error("url:", e.url)
        console.error("method:", e.method)
        console.error("responseBody:", e.responseBody)
        if (typeof e.responseText === "string" && e.responseText) {
          console.error("responseText:", e.responseText.slice(0, 2000))
        }
      } else if (e?.cause) {
        console.error("cause:", e.cause)
      }

      if (builtBody?.rows) {
        console.error("payload rows:", builtBody.rows.length)
        console.error("payload preview (first 5):", builtBody.rows.slice(0, 5))
      }

      console.error(e)
      console.groupEnd()
    } finally {
      setIsSaving(false)
    }
  }

  const payload = useMemo(() => {
    const rows = ROWS.map((r) => {
      if (r.kind !== "item") return { code: r.code, label: r.label, kind: r.kind }
      const t = computed.rowTotal[r.code] || { hq: 0, surin: 0, nonnarai: 0, total: 0 }
      const business_cost_id = resolveBusinessCostId(r.cost_id, BUSINESS_GROUP_ID)
      return {
        code: r.code,
        label: r.label,
        kind: r.kind,
        cost_id: r.cost_id,
        business_cost_id,
        values: { hq: t.hq, surin: t.surin, nonnarai: t.nonnarai, total: t.total },
      }
    })

    return {
      table_code: "BUSINESS_PLAN_EXPENSES",
      table_name: "ประมาณการค่าใช้จ่ายแผนธุรกิจ",
      fiscal_year_be: selectedYear,
      plan_id: planId,
      plan_id_formula: "plan_id = year - 2568",
      business_group_id: BUSINESS_GROUP_ID,
      period: periodLabel,
      api_base: API_BASE || null,
      rows,
      totals: {
        hq: computed.colTotal.hq,
        surin: computed.colTotal.surin,
        nonnarai: computed.colTotal.nonnarai,
        total: computed.grand,
      },
    }
  }, [computed, selectedYear, planId, valuesByCode, periodLabel])

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setSaveNotice({ type: "success", title: "คัดลอกแล้ว ✅", detail: "คัดลอก JSON payload ลง clipboard แล้ว" })
    } catch (e) {
      console.error(e)
      setSaveNotice({ type: "error", title: "คัดลอกไม่สำเร็จ", detail: "เปิดดู payload แล้ว copy เองได้" })
      setShowPayload(true)
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

  /** ✅ sticky */
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
              <div className="text-lg font-bold">ประมาณการค่าใช้จ่ายแผนธุรกิจ (ธุรกิจจัดหาสินค้า)</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                ({periodLabel}) • ปี: <span className="font-semibold">{selectedYear}</span> • plan_id:{" "}
                <span className="font-semibold">{planId}</span> • group:{" "}
                <span className="font-semibold">{BUSINESS_GROUP_ID}</span>
              </div>

              {API_BASE && (
                <>
                  <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    API: <span className="font-mono">{API_BASE}</span>
                  </div>

                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Auth: <span className="font-semibold">{authDebug.tokenFound ? "มี token" : "ไม่มี token"}</span>
                    {" • "}
                    role_id: <span className="font-semibold">{authDebug.role ?? "-"}</span>
                    {" • "}
                    user: <span className="font-semibold">{authDebug.userId ?? "-"}</span>
                  </div>
                </>
              )}

              {canTalkBEReason && (
                <div className="mt-2 text-xs text-rose-700 dark:text-rose-300">
                  * บันทึกไม่ได้ตอนนี้: <span className="font-semibold">{canTalkBEReason}</span>
                </div>
              )}

              <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                รวมทั้งหมด (บาท): <span className="font-extrabold">{fmtMoney0(computed.grand)}</span>
              </div>
            </div>

            {/* ✅ Dropdown เลือกปี */}
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เลือกปีแผน (พ.ศ.)</label>
                <select
                  className={baseField}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y} (plan_id {yearToPlanId(y)})
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  สูตร: plan_id = ปี - 2568 (เช่น 2569→1)
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">plan_id (คำนวณอัตโนมัติ)</label>
                <div className={cx(baseField, "flex items-center justify-end font-extrabold")}>{planId}</div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  ปีที่ย้อนกลับจาก plan_id = {planIdToYear(planId) || "-"}
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ช่วงเวลา</label>
                <div className={cx(baseField, "flex items-center justify-center font-semibold")}>{periodLabel}</div>
              </div>
            </div>
          </div>

          {/* ปุ่มด้านบน */}
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={copyPayload}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
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
            <pre className="max-h-72 overflow-auto">{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}
      </div>

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
              * Arrow keys วิ่งข้ามช่องได้ • บันทึก = ส่ง <span className="font-semibold">business_cost_id</span> ให้ BE
            </div>
          </div>
        </div>

        <div
          ref={bodyScrollRef}
          onScroll={onBodyScroll}
          className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700"
        >
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {COLS.map((c) => (
                <col key={c.key} style={{ width: COL_W.cell }} />
              ))}
              <col style={{ width: COL_W.total }} />
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                <th
                  rowSpan={2}
                  className={cx("border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600", stickyCodeHeader)}
                />
                <th
                  rowSpan={2}
                  className={cx("border border-slate-300 px-3 py-2 text-left font-bold dark:border-slate-600", stickyLeftHeader, "left-[72px]")}
                  style={{ left: COL_W.code }}
                >
                  รายการ
                </th>
                <th
                  colSpan={COLS.length + 1}
                  className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600"
                >
                  สกต. สาขา
                </th>
              </tr>

              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600"
                  >
                    {c.label}
                  </th>
                ))}
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
                      <td
                        className={cx(
                          "border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600",
                          stickyCodeCell,
                          "bg-slate-200/70 dark:bg-slate-700/55"
                        )}
                      >
                        {r.code}
                      </td>
                      <td
                        colSpan={COLS.length + 2}
                        className={cx(
                          "border border-slate-300 px-3 py-2 font-extrabold dark:border-slate-600",
                          "sticky left-[72px] z-[55] bg-slate-200/70 dark:bg-slate-700/55"
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
                const t = computed.rowTotal[r.code] || { hq: 0, surin: 0, nonnarai: 0, total: 0 }
                const bcId = resolveBusinessCostId(r.cost_id, BUSINESS_GROUP_ID)

                return (
                  <tr key={r.code} className={rowBg}>
                    <td
                      className={cx(
                        "border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600",
                        stickyCodeCell,
                        rowBg
                      )}
                    >
                      {r.code}
                    </td>

                    <td
                      className={cx(
                        "border border-slate-300 px-3 py-2 text-left font-semibold dark:border-slate-600",
                        "sticky z-[50]",
                        rowBg
                      )}
                      style={{ left: COL_W.code }}
                      title={`cost_id=${r.cost_id} -> business_cost_id=${bcId ?? "?"}`}
                    >
                      {r.label}{" "}
                      <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-300">
                        (cost:{r.cost_id} → map:{bcId ?? "?"})
                      </span>
                    </td>

                    {COLS.map((c, colIdx) => (
                      <td key={`${r.code}-${c.key}`} className="border border-slate-300 px-2 py-2 dark:border-slate-600">
                        <input
                          ref={registerInput(idx, colIdx)}
                          data-row={idx}
                          data-col={colIdx}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={valuesByCode?.[r.code]?.[c.key] ?? ""}
                          inputMode="numeric"
                          placeholder="0"
                          onChange={(e) =>
                            setCell(r.code, c.key, sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))
                          }
                        />
                      </td>
                    ))}

                    <td className="border border-slate-300 px-2 py-2 text-right font-extrabold dark:border-slate-600">
                      {fmtMoney0(t.total)}
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
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">รวม</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex-1 overflow-hidden">
              <div style={{ width: RIGHT_W, transform: `translateX(-${scrollLeft}px)`, willChange: "transform" }}>
                <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                  <colgroup>
                    {COLS.map((c) => (
                      <col key={`f-${c.key}`} style={{ width: COL_W.cell }} />
                    ))}
                    <col style={{ width: COL_W.total }} />
                  </colgroup>
                  <tbody>
                    <tr className={cx("font-extrabold text-slate-900 dark:text-emerald-100", STRIPE.foot)}>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtMoney0(computed.colTotal.hq)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtMoney0(computed.colTotal.surin)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtMoney0(computed.colTotal.nonnarai)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtMoney0(computed.grand)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Action bar (ปุ่มบันทึกอยู่ล่าง) */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
          <NoticeBox notice={saveNotice} />

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              ปี {selectedYear} → plan_id {planId} • group=1 • ส่งขึ้น BE:{" "}
              <span className="font-mono">POST /business-plan/{`{plan_id}`}/costs/bulk</span>
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
              title={canTalkBEReason ? canTalkBEReason : "บันทึกลงระบบ"}
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
