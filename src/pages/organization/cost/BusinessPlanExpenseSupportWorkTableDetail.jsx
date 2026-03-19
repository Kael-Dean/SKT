import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"

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
const fmtMoney = (n) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(n))


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
const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-md border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const trunc = "whitespace-nowrap overflow-hidden text-ellipsis"

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

/** ---------------- Business group (งานสนับสนุน) ---------------- */
const BUSINESS_GROUP_ID = 6

/** ---------------- Mapping: cost_id + business_group -> businesscosts.id ---------------- */
const BUSINESS_COSTS_SEED = [
    { id: 181, cost_id: 7, business_group: 6 }, { id: 182, cost_id: 78, business_group: 6 },
    { id: 183, cost_id: 79, business_group: 6 }, { id: 184, cost_id: 77, business_group: 6 },
    { id: 185, cost_id: 8, business_group: 6 }, { id: 186, cost_id: 61, business_group: 6 },
    { id: 187, cost_id: 21, business_group: 6 }, { id: 188, cost_id: 34, business_group: 6 },
    { id: 189, cost_id: 81, business_group: 6 }, { id: 190, cost_id: 19, business_group: 6 },
    { id: 191, cost_id: 20, business_group: 6 }, { id: 192, cost_id: 18, business_group: 6 },
    { id: 193, cost_id: 31, business_group: 6 }, { id: 194, cost_id: 22, business_group: 6 },
    { id: 195, cost_id: 68, business_group: 6 }, { id: 196, cost_id: 16, business_group: 6 },
    { id: 197, cost_id: 14, business_group: 6 }, { id: 198, cost_id: 26, business_group: 6 },
    { id: 199, cost_id: 66, business_group: 6 }, { id: 200, cost_id: 64, business_group: 6 },
    { id: 201, cost_id: 82, business_group: 6 }, { id: 202, cost_id: 11, business_group: 6 },
    { id: 203, cost_id: 9, business_group: 6 }, { id: 204, cost_id: 83, business_group: 6 },
    { id: 205, cost_id: 84, business_group: 6 }, { id: 206, cost_id: 85, business_group: 6 },
    { id: 207, cost_id: 23, business_group: 6 }, { id: 208, cost_id: 86, business_group: 6 },
    { id: 209, cost_id: 10, business_group: 6 }, { id: 210, cost_id: 63, business_group: 6 },
    { id: 211, cost_id: 87, business_group: 6 }, { id: 212, cost_id: 23, business_group: 6 },
    { id: 213, cost_id: 24, business_group: 6 }, { id: 214, cost_id: 88, business_group: 6 },
    { id: 215, cost_id: 89, business_group: 6 }, { id: 216, cost_id: 90, business_group: 6 },
    { id: 217, cost_id: 28, business_group: 6 }, { id: 218, cost_id: 62, business_group: 6 },
    { id: 219, cost_id: 54, business_group: 6 }, { id: 220, cost_id: 91, business_group: 6 },
    { id: 221, cost_id: 65, business_group: 6 }, { id: 222, cost_id: 56, business_group: 6 },
    { id: 223, cost_id: 27, business_group: 6 }, { id: 224, cost_id: 35, business_group: 6 },
    { id: 225, cost_id: 92, business_group: 6 }, { id: 226, cost_id: 93, business_group: 6 },
    { id: 227, cost_id: 94, business_group: 6 }, { id: 228, cost_id: 95, business_group: 6 },
    { id: 229, cost_id: 96, business_group: 6 }, { id: 230, cost_id: 36, business_group: 6 },
]

const BUSINESS_COST_ID_MAP = (() => {
  const m = new Map()
  for (const r of BUSINESS_COSTS_SEED) {
    const key = `${Number(r.cost_id)}:${Number(r.business_group)}`
    if (!m.has(key)) m.set(key, Number(r.id))
  }
  return m
})()

const resolveBusinessCostId = (costId, businessGroupId) =>
  BUSINESS_COST_ID_MAP.get(`${Number(costId)}:${Number(businessGroupId)}`) ?? null

const resolveRowBusinessCostId = (row) => {
  if (row?.business_cost_id) return Number(row.business_cost_id)
  return resolveBusinessCostId(row?.cost_id, BUSINESS_GROUP_ID)
}

/** ---------------- Rows (ค่าใช้จ่ายดำเนินงาน) ---------------- */
const ROWS = [
    { code: "9", label: "ค่าใช้จ่ายดำเนินงาน", kind: "section" },
    { code: "9.1", label: "เงินเดือนและค่าจ้าง", kind: "item", cost_id: 7 },
    { code: "9.2", label: "ค่าเบี้ยประชุม-กรรมการ", kind: "item", cost_id: 78 },
    { code: "9.3", label: "ค่าเบี้ยเลี้ยงพาหนะกรรมการ", kind: "item", cost_id: 79 },
    { code: "9.4", label: "ค่าเบี้ยเลี้ยง จนท.", kind: "item", cost_id: 77 },
    { code: "9.5", label: "ทำงานในวันหยุด", kind: "item", cost_id: 8 },
    { code: "9.6", label: "ค่ารับรอง", kind: "item", cost_id: 61 },
    { code: "9.7", label: "ค่าเหนื่อยเจ้าหน้าที่", kind: "item", cost_id: 21 },
    { code: "9.8", label: "ค่าเครื่องเขียนแบบพิมพ์", kind: "item", cost_id: 34 },
    { code: "9.9", label: "ค่าใช้จ่ายในการประชุมสหกรณ์ใหญ่", kind: "item", cost_id: 81 },
    { code: "9.10", label: "ค่าเสื่อมราคาอาคาร", kind: "item", cost_id: 19 },
    { code: "9.11", label: "ค่าเสื่อมราคา-ยานพาหนะ", kind: "item", cost_id: 20 },
    { code: "9.12", label: "ค่าเสื่อมราคา-ครุภัณฑ์", kind: "item", cost_id: 18 },
    { code: "9.13", label: "ค่าซ่อมบำรุงอาคาร", kind: "item", cost_id: 31 },
    { code: "9.14", label: "ค่าน้ำประปา", kind: "item", cost_id: 22 },
    { code: "9.15", label: "ดอกเบี้ยจ่ายเงินสะสม", kind: "item", cost_id: 68 },
    { code: "9.16", label: "ค่าไฟฟ้า", kind: "item", cost_id: 16 },
    { code: "9.17", label: "ค่าโทรศัพท์", kind: "item", cost_id: 14 },
    { code: "9.18", label: "ค่าของใช้สำนักงาน", kind: "item", cost_id: 26 },
    { code: "9.19", label: "สวัสดิการเจ้าหน้าที่", kind: "item", cost_id: 66 },
    { code: "9.20", label: "เงินสมทบ-ประกันสังคม", kind: "item", cost_id: 64 },
    { code: "9.21", label: "เงินสมทบกองทุนเงินทดแทนฯ", kind: "item", cost_id: 82 },
    { code: "9.22", label: "ค่าใช้จ่ายยานพาหนะ", kind: "item", cost_id: 11 },
    { code: "9.23", label: "ค่าเบี้ยประกันภัย", kind: "item", cost_id: 9 },
    { code: "9.24", label: "ค่าเช่าสำนักงาน", kind: "item", cost_id: 82, business_cost_id: 204 },
    { code: "9.25", label: "ค่าแบบฟอร์ม-กรรมการ", kind: "item", cost_id: 84 },
    { code: "9.26", label: "ค่าใช้จ่ายในการประชุมคณะกรรมการ", kind: "item", cost_id: 85 },
    { code: "9.27", label: "ค่าน้ำมันเชื้อเพลิงใช้ไป - 4 ล้อ", kind: "item", cost_id: 23, business_cost_id: 207 },
    { code: "9.28", label: "ค่าใช้จ่ายในการประชุมระดับอำเภอ", kind: "item", cost_id: 86 },
    { code: "9.29", label: "ค่าซ่อมบำรุงครุภัณฑ์", kind: "item", cost_id: 10 },
    { code: "9.30", label: "ค่าธรรมเนียมโอนเงินธนาคาร", kind: "item", cost_id: 63 },
    { code: "9.31", label: "ขาดทุนจากการยกเลิกใช้ครุภัณฑ์", kind: "item", cost_id: 86, business_cost_id: 211 },
    { code: "9.32", label: "ค่าน้ำมันเชื้อเพลิง - 4 ล้อ", kind: "item", cost_id: 23, business_cost_id: 212 },
    { code: "9.33", label: "ค่ากิจกรรมสัมพันธ์", kind: "item", cost_id: 24 },
    { code: "9.34", label: "ค่าตอบแทนที่ปรึกษาด้านบัญชี", kind: "item", cost_id: 88 },
    { code: "9.35", label: "ค่าตอบแทนผู้ตรวจสอบกิจการ", kind: "item", cost_id: 89 },
    { code: "9.36", label: "ค่าตอบแทนประจำตำแหน่ง", kind: "item", cost_id: 90 },
    { code: "9.37", label: "ค่าซ่อมบำรุงยานพาหนะ", kind: "item", cost_id: 28 },
    { code: "9.38", label: "ค่าของขวัญสมานคุณ", kind: "item", cost_id: 62 },
    { code: "9.39", label: "ค่าตกแต่งภูมิทัศน์", kind: "item", cost_id: 54 },
    { code: "9.40", label: "ค่าใช้จ่ายสำรอง", kind: "item", cost_id: 91, business_cost_id: 220 },
    { code: "9.41", label: "ค่าใช้จ่ายงานบ้านงานครัว", kind: "item", cost_id: 65 },
    { code: "9.42", label: "ค่าประชาสัมพันธ์", kind: "item", cost_id: 56 },
    { code: "9.43", label: "ค่าบริการสมาชิก", kind: "item", cost_id: 27 },
    { code: "9.44", label: "ค่าภาษีโรงเรือน", kind: "item", cost_id: 35 },
    { code: "9.45", label: "ยืนยันยอดสมาชิก", kind: "item", cost_id: 92 },
    { code: "9.46", label: "ค่าจ้างทำความสะอาดสำนักงาน", kind: "item", cost_id: 93 },
    { code: "9.47", label: "ค่ารักษาความปลอดภัยสำนักงาน", kind: "item", cost_id: 94 },
    { code: "9.48", label: "การศึกษอบรม/ศึกษาดูงาน", kind: "item", cost_id: 95 },
    { code: "9.49", label: "การดำเนินคดี", kind: "item", cost_id: 96 },
    { code: "9.50", label: "ค่าใช้จ่ายเบ็ดเตล็ด", kind: "item", cost_id: 36 },
]

/** ---------------- Table sizing ---------------- */
const COL_W = { code: 60, item: 300, month: 90, total: 100 }
const LEFT_W = COL_W.code + COL_W.item
const RIGHT_W = MONTHS.length * COL_W.month + COL_W.total
const TOTAL_W = LEFT_W + RIGHT_W

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

const BusinessPlanExpenseSupportWorkTableDetail = ({ branchId, branchName, yearBE, planId }) => {
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
    if (Number.isFinite(y) && y >= 2500) return y
    return 2569
  }, [yearBE])

  const periodLabel = useMemo(() => {
    const yy = String(effectiveYear).slice(-2)
    const yyNext = String(effectiveYear + 1).slice(-2)
    return `1 เม.ย.${yy}-31 มี.ค.${yyNext}`
  }, [effectiveYear])

  const [valuesByCode, setValuesByCode] = useState({})
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const normalizeGrid = useCallback(
    (seed = {}) => {
      const next = {}
      for (const r of itemRows) {
        const rowSeed = seed?.[r.code] || {}
        const monthValues = {}
        for (const m of MONTHS) {
            monthValues[m.key] = rowSeed[m.key] ?? ""
        }
        next[r.code] = monthValues
      }
      return next
    },
    [itemRows]
  )

  useEffect(() => {
    setValuesByCode((prev) => normalizeGrid(prev))
  }, [normalizeGrid])

  const loadSavedFromBE = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0 || !effectiveBranchId) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/business-plan/${effectivePlanId}/costs/monthly?branch_id=${effectiveBranchId}&business_group_id=${BUSINESS_GROUP_ID}`)
      const monthlyCosts = Array.isArray(data?.monthly_costs) ? data.monthly_costs : []

      const bcToCode = new Map()
      for (const r of itemRows) {
        const bcId = resolveRowBusinessCostId(r)
        if (bcId) bcToCode.set(Number(bcId), r.code)
      }

      const seed = {}
      for (const cell of monthlyCosts) {
        const bCostId = Number(cell.business_cost_id || 0)
        const monthNum = Number(cell.month || 0)
        const amount = Number(cell.amount || 0)
        const month = MONTHS.find(m => m.month === monthNum)

        if (!bCostId || !month) continue

        const code = bcToCode.get(bCostId)
        if (!code) continue

        if (!seed[code]) seed[code] = {}
        seed[code][month.key] = String(amount)
      }

      setValuesByCode(normalizeGrid(seed))
    } catch (e) {
      console.error("[Support Work Detail Load saved] failed:", e)
      setValuesByCode(normalizeGrid({}))
    } finally {
      setIsLoadingSaved(false)
    }
  }, [effectivePlanId, effectiveBranchId, itemRows, normalizeGrid])

  useEffect(() => {
    loadSavedFromBE()
  }, [loadSavedFromBE])

  const setCell = (code, monthKey, nextValue) => {
    setValuesByCode((prev) => {
      const next = { ...prev }
      const row = { ...(next[code] || {}) }
      row[monthKey] = nextValue
      next[code] = row
      return next
    })
  }
  
  const computed = useMemo(() => {
    const rowTotal = {}
    const monthTotal = {}
    let grandTotal = 0

    for (const m of MONTHS) monthTotal[m.key] = 0

    for (const r of itemRows) {
      const row = valuesByCode[r.code] || {}
      let sum = 0
      for (const m of MONTHS) {
        const v = toNumber(row[m.key])
        monthTotal[m.key] += v
        sum += v
      }
      rowTotal[r.code] = sum
      grandTotal += sum
    }

    return { rowTotal, monthTotal, grandTotal }
  }, [valuesByCode, itemRows])

  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const buildBulkRowsForBE = useCallback(() => {
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error("FE: plan_id ไม่ถูกต้อง")
    if (!effectiveBranchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    
    const costs = []
    const unmapped = []

    for (const r of itemRows) {
      const businessCostId = resolveRowBusinessCostId(r)
      if (!businessCostId) {
        unmapped.push(r.code)
        continue
      }
      const rowData = valuesByCode[r.code] || {}
      for (const m of MONTHS) {
        const amount = toNumber(rowData[m.key])
        if(amount > 0) {
            costs.push({
                business_cost_id: businessCostId,
                month: m.month,
                amount: amount,
            })
        }
      }
    }
    
    if (unmapped.length > 0) {
        console.warn("Unmapped rows will be skipped:", unmapped)
    }

    return { costs }
  }, [effectivePlanId, effectiveBranchId, itemRows, valuesByCode])

  const saveToBE = async () => {
    let payload = null
    try {
        setNotice(null)
        const token = getToken()
        if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

        const built = buildBulkRowsForBE()
        payload = {
            plan_id: effectivePlanId,
            branch_id: effectiveBranchId,
            business_group_id: BUSINESS_GROUP_ID,
            costs: built.costs
        }
        setIsSaving(true)

        const res = await apiAuth(`/business-plan/costs/bulk-monthly`, {
            method: "POST",
            body: payload,
        })

        setNotice({
            type: "success",
            title: "บันทึกสำเร็จ ✅",
            detail: `plan_id=${effectivePlanId} • สาขา ${effectiveBranchName} • บันทึก ${res?.saved_count ?? built.costs.length} รายการ`,
        })

        await loadSavedFromBE()

    } catch (e) {
        const status = e?.status || 0
        let title = "บันทึกไม่สำเร็จ ❌"
        let detail = e?.message || String(e)
        if (status === 422) {
            title = "422 Validation Error"
            detail = "ข้อมูลไม่ถูกต้อง (ดู console)"
        }
        setNotice({ type: "error", title, detail })
        console.error("[Save Support Work Expense Detail] failed:", e)
    } finally {
        setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ประมาณการค่าใช้จ่ายแผนธุรกิจ (งานสนับสนุน) - รายเดือน</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                ({periodLabel}) • ปี {effectiveYear} • plan_id {effectivePlanId} • สาขา {effectiveBranchName}
                {isLoadingSaved ? " • โหลดค่าที่บันทึกไว้..." : ""}
            </div>
             <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              รวมทั้งหมด (บาท): <span className="font-extrabold">{fmtMoney(computed.grandTotal)}</span>
            </div>
        </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {MONTHS.map((m) => <col key={m.key} style={{ width: COL_W.month }} />)}
              <col style={{ width: COL_W.total }} />
            </colgroup>

            <thead className="sticky top-0 z-20">
              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                <th className="border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600 sticky left-0 z-10 bg-slate-100 dark:bg-slate-700">รหัส</th>
                <th className="border border-slate-300 px-2 py-2 text-left font-bold text-xs dark:border-slate-600 sticky left-[60px] z-10 bg-slate-100 dark:bg-slate-700">รายการ</th>
                {MONTHS.map(m => (
                    <th key={m.key} className="border border-slate-300 px-1 py-2 text-center text-xs font-semibold dark:border-slate-600">{m.label}</th>
                ))}
                <th className="border border-slate-300 px-1 py-2 text-center text-xs font-extrabold dark:border-slate-600">รวม</th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((r, rIdx) => {
                if (r.kind === "section") {
                  return (
                    <tr key={r.code} className="bg-slate-200 dark:bg-slate-700">
                      <td className="border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600 sticky left-0 z-10 bg-slate-200 dark:bg-slate-700">{r.code}</td>
                      <td colSpan={MONTHS.length + 2} className="border border-slate-300 px-2 py-2 font-extrabold text-xs dark:border-slate-600 sticky left-[60px] z-10 bg-slate-200 dark:bg-slate-700">{r.label}</td>
                    </tr>
                  )
                }

                const rowBg = rIdx % 2 === 1 ? STRIPE.alt : STRIPE.cell
                const rowSum = computed.rowTotal[r.code] || 0

                return (
                  <tr key={r.code} className={rowBg}>
                    <td className={cx("border border-slate-300 px-1 py-2 text-center text-xs dark:border-slate-600 sticky left-0 z-10", rowBg)}>{r.code}</td>
                    <td className={cx("border border-slate-300 px-2 py-2 text-left font-semibold text-xs dark:border-slate-600 sticky left-[60px] z-10", rowBg, trunc)} title={r.label}>{r.label}</td>
                    {MONTHS.map((m) => (
                        <td key={`${r.code}-${m.key}`} className="border border-slate-300 px-1 py-1 dark:border-slate-600">
                            <input
                                className={cellInput}
                                value={valuesByCode?.[r.code]?.[m.key] ?? ""}
                                inputMode="decimal"
                                placeholder="0"
                                onChange={(e) => setCell(r.code, m.key, sanitizeNumberInput(e.target.value, { maxDecimals: 2 }))}
                            />
                        </td>
                    ))}
                    <td className="border border-slate-300 px-1 py-2 text-right font-extrabold text-xs dark:border-slate-600">{fmtMoney0(rowSum)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
                <tr className={cx("text-slate-900 dark:text-slate-100", STRIPE.foot)}>
                    <td colSpan={2} className="border border-slate-300 px-2 py-2 text-center font-extrabold text-xs dark:border-slate-600 sticky left-0 z-10 bg-emerald-100/55 dark:bg-emerald-900/20">รวมทั้งสิ้น</td>
                    {MONTHS.map(m => (
                        <td key={`total-${m.key}`} className="border border-slate-300 px-1 py-2 text-right font-bold text-xs dark:border-slate-600">
                            {fmtMoney(computed.monthTotal[m.key] || 0)}
                        </td>
                    ))}
                    <td className="border border-slate-300 px-1 py-2 text-right font-extrabold text-xs dark:border-slate-600">
                        {fmtMoney(computed.grandTotal)}
                    </td>
                </tr>
            </tfoot>
          </table>
        </div>
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
            {notice && (
                 <div className={cx("mb-3 rounded-2xl border p-3 text-sm", notice.type === 'error' ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
                    <div className="font-extrabold">{notice.title}</div>
                    {notice.detail && <div className="mt-1 text-[13px] opacity-95">{notice.detail}</div>}
                </div>
            )}
            <div className="flex justify-end">
                <button
                type="button"
                disabled={isSaving}
                onClick={saveToBE}
                className={cx(
                    "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white",
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

export default BusinessPlanExpenseSupportWorkTableDetail