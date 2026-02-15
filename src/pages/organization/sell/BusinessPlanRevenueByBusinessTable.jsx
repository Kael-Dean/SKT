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
const fmtMoney0 = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

/** ---------------- API (เหมือนหน้าธุรกิจจัดหา) ---------------- */
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

const readonlyField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black shadow-none dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100"

const cellInput =
  "w-full h-9 min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"


/** ---------------- Table definition ---------------- */
const PERIOD_DEFAULT = "1 เม.ย.68-31 มี.ค.69"

/** lock width ให้ตรงกันทุกส่วน (ย่อให้เห็นได้ในหน้าเดียวมากขึ้น) */
const COL_W = { code: 60, item: 360, cell: 96, total: 96 }
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

const ROW_H = {
  title: 44,
  section: 44,
  item: 52,
  subtotal: 44,
  grandtotal: 44,
}
const rowH = (kind) => ROW_H[kind] ?? 44

/** fallback units ถ้ายังไม่ได้เลือกสาขา/ดึงไม่สำเร็จ */
const FALLBACK_UNITS = [
  { id: 1, name: "สุรินทร์" },
  { id: 2, name: "โนนนารายณ์" },
]

/** ---------------- Mapping: (earning_id + business_group) -> businessearnings.id ----------------
 * จากไฟล์ businessearnings
 */
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

/** ---------------- Rows (รายการรายได้) ----------------
 * ใส่ earning_id ให้ตรงกับไฟล์ earnings เท่าที่แมพได้
 * ถ้ายังไม่ชัวร์/ไม่มีใน earnings → ปล่อย earning_id = null (จะขึ้น “ยังไม่แมพ” เหมือนหน้า Expense)
 */
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
  // ⚠️ รายได้จากบริการ: ยังไม่มีชื่อในไฟล์ earnings ชัดเจน → ตั้งเป็น null ให้ขึ้น “ยังไม่แมพ”
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

  { code: "G.T", label: "รวมรายได้", kind: "grandtotal" },
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

const BusinessPlanRevenueByBusinessTable = (props) => {
  // รองรับได้ทั้ง branchId / branch_id
  const branchId = Number(props?.branchId ?? props?.branch_id ?? 0) || 0
  const branchName = String(props?.branchName ?? props?.branch_name ?? "").trim()
  const yearBE = props?.yearBE ?? props?.year_be ?? props?.year ?? null
  const planId = Number(props?.planId ?? props?.plan_id ?? 0) || 0

  const effectiveBranchName = branchName || (branchId ? `#${branchId}` : "— ยังไม่ได้เลือกสาขา —")
  const effectiveYear = yearBE ?? "-"
  const periodLabel = props?.periodLabel || props?.period_label || PERIOD_DEFAULT

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
  const [showPayload, setShowPayload] = useState(false)

  /** ✅ โหลดหน่วยตามสาขา (เหมือนหน้าธุรกิจจัดหา) */
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!branchId) {
        setUnits(FALLBACK_UNITS)
        return
      }
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
        console.error("[Revenue Units load] failed:", e)
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

  /** ✅ เมื่อ units เปลี่ยน: preserve ค่าเดิมเท่าที่ map ได้ */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitIds.join("|")])

  /** ---------------- ✅ Unmapped static list (แจ้งเหมือนหน้า Expense) ---------------- */
  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])
  const unmappedStatic = useMemo(() => {
    return itemRows
      .filter((r) => !resolveRowBusinessEarningId(r))
      .map((r) => ({
        code: r.code,
        label: r.label,
        earning_id: r.earning_id ?? null,
        business_group: r.business_group ?? null,
      }))
  }, [itemRows])

  /** ---------------- ✅ โหลดค่าที่เคยบันทึกจาก BE ---------------- */
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
    if (!planId || planId <= 0) return
    if (!branchId) return
    if (!units?.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/business-plan/${planId}/earnings?branch_id=${Number(branchId)}`)
      const unitCells = Array.isArray(data?.unit_cells) ? data.unit_cells : []

      // map business_earning_id -> code (เฉพาะที่แมพได้)
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

      setValuesByCode(normalizeGrid(seed))
    } catch (e) {
      console.error("[Revenue Load saved] failed:", e)
      setValuesByCode(normalizeGrid({}))
    } finally {
      setIsLoadingSaved(false)
    }
  }, [planId, branchId, units?.length, itemRows, normalizeGrid])

  useEffect(() => {
    loadSavedFromBE()
  }, [loadSavedFromBE])

  /** ---------------- ✅ Height + Scroll + Arrow nav (เหมือนเดิม) ---------------- */
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

  /** ================== ✅ Arrow navigation ================== */
  const inputRefs = useRef(new Map())
  const totalCols = cols.length

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

    // vertical
    const topHidden = erect.top < crect.top + pad
    const bottomHidden = erect.bottom > crect.bottom - pad
    if (topHidden) container.scrollTop -= crect.top + pad - erect.top
    else if (bottomHidden) container.scrollTop += erect.bottom - (crect.bottom - pad)

    // horizontal
    const leftHidden = erect.left < crect.left + frozenLeft + pad
    const rightHidden = erect.right > crect.right - pad
    if (leftHidden) container.scrollLeft -= crect.left + frozenLeft + pad - erect.left
    else if (rightHidden) container.scrollLeft += erect.right - (crect.right - pad)
  }, [])

  const focusCell = useCallback(
    (rowIndex, colIndex) => {
      const r = itemRows[rowIndex]
      const c = cols[colIndex]
      if (!r || !c) return
      const el = inputRefs.current.get(`${r.code}|${c.key}`)
      if (el) {
        el.focus()
        el.select?.()
        ensureInView(el)
      }
    },
    [cols, ensureInView, itemRows]
  )

  const onKeyDownCell = useCallback(
    (e, rowIndex, colIndex) => {
      const key = e.key
      if (key === "Enter") {
        e.preventDefault()
        if (colIndex < totalCols - 1) focusCell(rowIndex, colIndex + 1)
        else focusCell(Math.min(itemRows.length - 1, rowIndex + 1), 0)
        return
      }
      if (key === "ArrowLeft") {
        e.preventDefault()
        focusCell(rowIndex, Math.max(0, colIndex - 1))
        return
      }
      if (key === "ArrowRight") {
        e.preventDefault()
        focusCell(rowIndex, Math.min(totalCols - 1, colIndex + 1))
        return
      }
      if (key === "ArrowUp") {
        e.preventDefault()
        focusCell(Math.max(0, rowIndex - 1), colIndex)
        return
      }
      if (key === "ArrowDown") {
        e.preventDefault()
        focusCell(Math.min(itemRows.length - 1, rowIndex + 1), colIndex)
      }
    },
    [focusCell, itemRows.length, totalCols]
  )

  /** ---------------- computed totals (คงเดิม) ---------------- */
  const computed = useMemo(() => {
    const rowTotal = {}
    const colTotal = {}
    cols.forEach((c) => (colTotal[c.key] = 0))

    // per item row
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

    // helper: sum item rows within section
    const sectionSum = (startCode, endCode) => {
      const codes = itemRows
        .map((x) => x.code)
        .filter((code) => code >= startCode && code <= endCode)
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

    // grand
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

  /** ---------------- handlers ---------------- */
  const setCell = (code, colKey, raw) => {
    const v = sanitizeNumberInput(raw, { maxDecimals: 3 })
    setValuesByCode((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        [colKey]: v,
      },
    }))
  }

  /** ---------------- Save (bulk) ---------------- */
  const [saveNotice, setSaveNotice] = useState(null)
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

      // ยังไม่แมพ → ข้ามได้เฉพาะกรณีแถวนี้เป็น 0 ทั้งหมด
      if (!businessEarningId) {
        skipped.push({
          code: r.code,
          label: r.label,
          earning_id: r.earning_id ?? null,
          business_group: r.business_group ?? null,
        })
        if (rowSum !== 0) blocked.push({ code: r.code, label: r.label })
        continue
      }

      const unit_values = []
      let branch_total = 0

      // ส่งครบทุก unit (รวม 0) เพื่อให้ล้างค่าแล้วทับของเดิมได้แน่นอน
      for (const u of units) {
        const amount = toNumber(rowObj[String(u.id)])
        branch_total += amount
        unit_values.push({ unit_id: Number(u.id), amount })
      }

      rows.push({
        branch_id: branchId,
        business_earning_id: Number(businessEarningId),
        unit_values,
        branch_total,
        comment: period,
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
      payload = { rows: built.rows }

      setIsSaving(true)
      const res = await apiAuth(`/business-plan/${planId}/earnings/bulk`, {
        method: "POST",
        body: payload,
      })

      setSaveNotice({
        type: "success",
        title: "บันทึกสำเร็จ ✅",
        detail: `สาขา ${effectiveBranchName} • ปี ${effectiveYear} • upserted: ${res?.branch_totals_upserted ?? "-"}${
          built?.skipped?.length ? ` • skipped: ${built.skipped.length}` : ""
        }`,
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
        detail = `ไม่พบแผน หรือ route ไม่ตรง — plan_id=${planId}`
      } else if (status === 422) {
        title = "422 Validation Error"
        detail = "รูปแบบข้อมูลไม่ผ่าน schema ของ BE (ดู console)"
      }

      setSaveNotice({ type: "error", title, detail })
      console.groupCollapsed("%c[BusinessPlanRevenueByBusinessTable] Save failed ❌", "color:#ef4444;font-weight:800;")
      console.error("status:", status, "title:", title, "detail:", detail)
      console.error("year:", effectiveYear, "plan_id:", planId)
      console.error("branch_id:", branchId, "branch:", effectiveBranchName)
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
      await navigator.clipboard.writeText(JSON.stringify({ rows: built.rows }, null, 2))
      setSaveNotice({ type: "success", title: "คัดลอกแล้ว ✅", detail: "คัดลอก payload สำหรับ BE แล้ว" })
    } catch (e) {
      setSaveNotice({ type: "error", title: "คัดลอกไม่สำเร็จ", detail: e?.message || String(e) })
    }
  }

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    const ids = unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)
    const empty = buildInitialValues(ids)
    setValuesByCode(empty)
    setSaveNotice({ type: "info", title: "ล้างข้อมูลแล้ว", detail: "รีเซ็ตค่าที่กรอกเป็นว่าง" })
  }

  const payloadDebug = useMemo(() => {
    const out = {
      period,
      plan_id: planId || null,
      branch_id: branchId || null,
      units: cols.map((c) => ({ unit_id: Number(c.key), unit_name: c.label })),
      items: [],
    }
    for (const r of ROWS) {
      if (r.kind !== "item") continue
      const v = valuesByCode[r.code] || {}
      const perUnit = {}
      cols.forEach((c) => (perUnit[c.key] = toNumber(v[c.key])))
      out.items.push({
        code: r.code,
        label: r.label,
        business_group: r.business_group ?? null,
        earning_id: r.earning_id ?? null,
        business_earning_id: resolveRowBusinessEarningId(r),
        per_unit: perUnit,
        total: computed.rowTotal[r.code] || 0,
      })
    }
    out.subtotals = Object.fromEntries(
      Object.entries(computed.subtotals).map(([k, s]) => [k, { per_unit: s.perCol, total: s.total }])
    )
    out.grand_total = { per_unit: computed.grandPerCol, total: computed.grand }
    return out
  }, [branchId, cols, computed, period, planId, valuesByCode])

  return (
    <div className="w-full">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              รายได้เฉพาะ (เชื่อม BE: business-plan/earnings)
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              ปี {effectiveYear} • สาขา {effectiveBranchName} • หน่วย{" "}
              {isLoadingUnits ? "กำลังโหลด..." : units.length}
              {isLoadingSaved ? " • โหลดค่าที่บันทึกไว้..." : ""}
            </div>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              รวมทั้งหมด (บาท): <span className="font-extrabold">{fmtMoney0(computed.grand)}</span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-[640px] md:flex-row md:justify-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">ช่วงแผน</label>
              <input className={baseField} value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>

            <div className="flex items-end gap-2">
              <button
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowPayload((s) => !s)}
                type="button"
              >
                {showPayload ? "ซ่อน JSON" : "ดู JSON"}
              </button>
              <button
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={copyPayload}
                type="button"
              >
                คัดลอก payload
              </button>
              <button
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={resetAll}
                type="button"
              >
                ล้างข้อมูล
              </button>
            </div>
          </div>
        </div>

        {/* Unmapped banner */}
        {unmappedStatic.length > 0 ? (
          <div
            className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900
                       dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100"
          >
            <div className="font-extrabold">⚠️ รายการที่ยังไม่แมพ (จะข้ามตอนบันทึกถ้าเป็น 0)</div>
            <div className="mt-1 text-[13px] opacity-95">
              {unmappedStatic
                .map((x) => `${x.code} (earning_id=${x.earning_id ?? "?"}, group=${x.business_group ?? "?"})`)
                .join(" • ")}
            </div>
          </div>
        ) : (
          <div
            className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900
                       dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100"
          >
            <div className="font-extrabold">✅ แมพครบแล้ว</div>
            <div className="mt-1 text-[13px] opacity-95">ไม่มีรายการที่ยังไม่แมพ (ทั้งหมด {itemRows.length} รายการ)</div>
          </div>
        )}

        {/* Meta row */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</div>
            <div className={readonlyField}>{effectiveBranchName}</div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">plan_id</div>
            <div className={readonlyField}>{planId || "—"}</div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">รวมทั้งหมด (บาท)</div>
            <div className={readonlyField}>{fmtMoney0(computed.grand)}</div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* HEADER (sync horizontal scroll with body) */}
          <div className={cx("border-b border-slate-200 dark:border-slate-700", STRIPE.head)}>
            <div className="flex w-full">
              {/* left frozen */}
              <div className="shrink-0" style={{ width: LEFT_W }}>
                <table className="border-collapse text-sm" style={{ width: LEFT_W, tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: COL_W.code }} />
                    <col style={{ width: COL_W.item }} />
                  </colgroup>
                  <thead>
                    <tr className="font-bold text-slate-800 dark:text-slate-100">
                      <th className="border border-slate-300 px-2 py-2 text-center align-middle dark:border-slate-600">รหัส</th>
                      <th className="border border-slate-300 px-3 py-2 text-left align-middle dark:border-slate-600">รายการ</th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* right scrollable */}
              <div className="flex-1 overflow-hidden">
                <div style={{ width: RIGHT_W, transform: `translateX(-${scrollLeft}px)`, willChange: "transform" }}>
                  <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                    <colgroup>
                      {cols.map((c) => (
                        <col key={`h-${c.key}`} style={{ width: COL_W.cell }} />
                      ))}
                      <col style={{ width: COL_W.total }} />
                    </colgroup>
                    <thead>
                      <tr className="font-bold text-slate-800 dark:text-slate-100">
                        {cols.map((c) => (
                          <th key={c.key} className="border border-slate-300 px-2 py-2 text-center align-middle dark:border-slate-600">
                            {c.label}
                          </th>
                        ))}
                        <th className="border border-slate-300 px-2 py-2 text-center align-middle dark:border-slate-600">รวม</th>
                      </tr>
                    </thead>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* BODY */}
          <div ref={tableCardRef} className="relative w-full" style={{ height: tableCardHeight, maxHeight: tableCardHeight }}>
            <div ref={bodyScrollRef} onScroll={onBodyScroll} className="absolute inset-0 overflow-auto overscroll-contain">
              <div style={{ width: TOTAL_W }}>
                <div className="flex w-full">
                  {/* left frozen */}
                  <div className="shrink-0" style={{ width: LEFT_W }}>
                    <table className="border-collapse text-sm" style={{ width: LEFT_W, tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: COL_W.code }} />
                        <col style={{ width: COL_W.item }} />
                      </colgroup>
                      <tbody>
                        {ROWS.map((r, idx) => {
                          const isAlt = idx % 2 === 1
                          const h = rowH(r.kind)
                          const bg = r.kind === "title" ? STRIPE.head : isAlt ? STRIPE.alt : STRIPE.cell
                          const font =
                            r.kind === "title"
                              ? "font-extrabold"
                              : r.kind === "section"
                              ? "font-bold"
                              : r.kind === "subtotal" || r.kind === "grandtotal"
                              ? "font-extrabold"
                              : "font-medium"

                          const isUnmapped = r.kind === "item" && !resolveRowBusinessEarningId(r)

                          return (
                            <tr key={`L-${r.code}`} className={cx(bg, font, isUnmapped && "ring-1 ring-amber-300/70")} style={{ height: h }}>
                              <td className="border border-slate-300 px-2 py-2 text-center align-middle dark:border-slate-600">
                                {r.kind === "title" ? "" : r.code}
                              </td>
                              <td
                                className="border border-slate-300 px-3 py-2 text-left align-middle dark:border-slate-600"
                                title={isUnmapped ? `${r.label} (ยังไม่แมพ)` : r.label}
                              >
                                <span className={cx(isUnmapped && "text-amber-700 dark:text-amber-200")}>
                                  {r.label}
                                  {isUnmapped ? <span className="ml-2 text-xs font-bold">(ยังไม่แมพ)</span> : null}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* right scrollable */}
                  <div className="flex-1 overflow-hidden">
                    <div style={{ width: RIGHT_W }}>
                      <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                        <colgroup>
                          {cols.map((c) => (
                            <col key={`b-${c.key}`} style={{ width: COL_W.cell }} />
                          ))}
                          <col style={{ width: COL_W.total }} />
                        </colgroup>

                        <tbody>
                          {ROWS.map((r, idx) => {
                            const isAlt = idx % 2 === 1
                            const h = rowH(r.kind)
                            const bg = r.kind === "title" ? STRIPE.head : isAlt ? STRIPE.alt : STRIPE.cell
                            const font =
                              r.kind === "title"
                                ? "font-extrabold"
                                : r.kind === "section"
                                ? "font-bold"
                                : r.kind === "subtotal" || r.kind === "grandtotal"
                                ? "font-extrabold"
                                : "font-medium"

                            const itemIndex = r.kind === "item" ? itemRows.findIndex((x) => x.code === r.code) : -1
                            const isUnmapped = r.kind === "item" && !resolveRowBusinessEarningId(r)

                            if (r.kind === "title" || r.kind === "section") {
                              return (
                                <tr key={`R-${r.code}`} className={cx(bg, font)} style={{ height: h }}>
                                  {cols.map((c) => (
                                    <td key={`${r.code}-${c.key}`} className="border border-slate-300 px-2 py-2 text-right align-middle dark:border-slate-600" />
                                  ))}
                                  <td className="border border-slate-300 px-2 py-2 text-right align-middle dark:border-slate-600" />
                                </tr>
                              )
                            }

                            if (r.kind === "subtotal") {
                              const s = computed.subtotals[r.code] || { perCol: {}, total: 0 }
                              return (
                                <tr key={`R-${r.code}`} className={cx(bg, font)} style={{ height: h }}>
                                  {cols.map((c) => (
                                    <td
                                      key={`${r.code}-${c.key}`}
                                      className="border border-slate-300 px-2 py-2 text-right align-middle dark:border-slate-600"
                                    >
                                      {fmtMoney0(s.perCol?.[c.key] ?? 0)}
                                    </td>
                                  ))}
                                  <td className="border border-slate-300 px-2 py-2 text-right align-middle dark:border-slate-600">
                                    {fmtMoney0(s.total ?? 0)}
                                  </td>
                                </tr>
                              )
                            }

                            if (r.kind === "grandtotal") {
                              return (
                                <tr key={`R-${r.code}`} className={cx(bg, font, STRIPE.foot)} style={{ height: h }}>
                                  {cols.map((c) => (
                                    <td
                                      key={`${r.code}-${c.key}`}
                                      className="border border-slate-300 px-2 py-2 text-right align-middle dark:border-slate-600"
                                    >
                                      {fmtMoney0(computed.grandPerCol?.[c.key] ?? 0)}
                                    </td>
                                  ))}
                                  <td className="border border-slate-300 px-2 py-2 text-right align-middle dark:border-slate-600">
                                    {fmtMoney0(computed.grand ?? 0)}
                                  </td>
                                </tr>
                              )
                            }

                            // item row
                            const v = valuesByCode[r.code] || {}
                            return (
                              <tr key={`R-${r.code}`} className={cx(bg, font, isUnmapped && "ring-1 ring-amber-300/40")} style={{ height: h }}>
                                {cols.map((c, colIndex) => (
                                  <td key={`${r.code}-${c.key}`} className="border border-slate-300 px-2 py-1.5 align-middle dark:border-slate-600">
                                    <div className="h-full flex items-center">
                                    <input
                                      ref={registerInput(r.code, c.key)}
                                      className={cellInput}
                                      inputMode="decimal"
                                      value={v[c.key] ?? ""}
                                      onChange={(e) => setCell(r.code, c.key, e.target.value)}
                                      onKeyDown={(e) => onKeyDownCell(e, itemIndex, colIndex)}
                                      placeholder="0"
                                      title={isUnmapped ? "แถวนี้ยังไม่แมพ (จะบันทึกไม่ได้ถ้ามีตัวเลข)" : ""}
                                    />
                                    </div>
                                  </td>
                                ))}
                                <td className="border border-slate-300 px-2 py-2 text-right align-middle dark:border-slate-600">
                                  {fmtMoney0(computed.rowTotal[r.code] ?? 0)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER totals */}
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
                      <td className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">รวมรายได้</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex-1 overflow-hidden">
                <div style={{ width: RIGHT_W, transform: `translateX(-${scrollLeft}px)`, willChange: "transform" }}>
                  <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                    <colgroup>
                      {cols.map((c) => (
                        <col key={`f-${c.key}`} style={{ width: COL_W.cell }} />
                      ))}
                      <col style={{ width: COL_W.total }} />
                    </colgroup>
                    <tbody>
                      <tr className={cx("font-extrabold text-slate-900 dark:text-emerald-100", STRIPE.foot)}>
                        {cols.map((c) => (
                          <td key={`ft-${c.key}`} className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                            {fmtMoney0(computed.colTotal?.[c.key] ?? 0)}
                          </td>
                        ))}
                        <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                          {fmtMoney0(computed.grand ?? 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Debug payload */}
          {showPayload ? (
            <div className="p-3 md:p-4">
              <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Payload (debug)</div>
              <pre className="max-h-[420px] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                {JSON.stringify(payloadDebug, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* Action bar (เหมือนหน้า Expense) */}
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
            {saveNotice && (
              <div
                className={cx(
                  "mb-3 rounded-2xl border p-3 text-sm",
                  saveNotice.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200"
                    : saveNotice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                    : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
                )}
              >
                <div className="font-extrabold">{saveNotice.title}</div>
                {saveNotice.detail && <div className="mt-1 text-[13px] opacity-95">{saveNotice.detail}</div>}
              </div>
            )}

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                บันทึก: <span className="font-mono">POST /business-plan/{`{plan_id}`}/earnings/bulk</span> • ปี={effectiveYear} • สาขา={effectiveBranchName}
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
    </div>
  )
}

export default BusinessPlanRevenueByBusinessTable
