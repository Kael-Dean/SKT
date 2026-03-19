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

/** ---------------- Business group (รวบรวม) ---------------- */
const BUSINESS_GROUP_ID = 3

/** ---------------- Mapping: cost_id + business_group -> businesscosts.id ---------------- */
const BUSINESS_COSTS_SEED = [
  { id: 66, cost_id: 2, business_group: 3 }, { id: 67, cost_id: 37, business_group: 3 },
  { id: 68, cost_id: 38, business_group: 3 }, { id: 69, cost_id: 7, business_group: 3 },
  { id: 70, cost_id: 39, business_group: 3 }, { id: 71, cost_id: 8, business_group: 3 },
  { id: 72, cost_id: 40, business_group: 3 }, { id: 73, cost_id: 10, business_group: 3 },
  { id: 74, cost_id: 41, business_group: 3 }, { id: 75, cost_id: 14, business_group: 3 },
  { id: 76, cost_id: 11, business_group: 3 }, { id: 77, cost_id: 13, business_group: 3 },
  { id: 78, cost_id: 42, business_group: 3 }, { id: 79, cost_id: 18, business_group: 3 },
  { id: 80, cost_id: 31, business_group: 3 }, { id: 81, cost_id: 26, business_group: 3 },
  { id: 82, cost_id: 43, business_group: 3 }, { id: 83, cost_id: 44, business_group: 3 },
  { id: 84, cost_id: 13, business_group: 3 }, { id: 85, cost_id: 19, business_group: 3 },
  { id: 86, cost_id: 9, business_group: 3 }, { id: 87, cost_id: 20, business_group: 3 },
  { id: 88, cost_id: 45, business_group: 3 }, { id: 89, cost_id: 27, business_group: 3 },
  { id: 90, cost_id: 21, business_group: 3 }, { id: 91, cost_id: 24, business_group: 3 },
  { id: 92, cost_id: 35, business_group: 3 }, { id: 93, cost_id: 46, business_group: 3 },
  { id: 94, cost_id: 47, business_group: 3 }, { id: 95, cost_id: 48, business_group: 3 },
  { id: 96, cost_id: 49, business_group: 3 }, { id: 97, cost_id: 50, business_group: 3 },
  { id: 98, cost_id: 51, business_group: 3 }, { id: 99, cost_id: 52, business_group: 3 },
  { id: 100, cost_id: 36, business_group: 3 },
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

/** ---------------- Rows (ค่าใช้จ่ายเฉพาะ ธุรกิจรวบรวม) ---------------- */
const ROWS = [
    { code: "5", label: "ค่าใช้จ่ายเฉพาะ ธุรกิจรวบรวม", kind: "section" },
    { code: "5.1", label: "ค่าใช้จ่ายในการขาย", kind: "item", cost_id: 2 },
    { code: "5.2", label: "ดอกเบี้ยจ่าย ธ.ก.ส เพื่อรวบรวม", kind: "item", cost_id: 37 },
    { code: "5.3", label: "หนี้สงสัยจะสูญ", kind: "item", cost_id: 38 },
    { code: "5.4", label: "เงินเดือนและค่าจ้าง", kind: "item", cost_id: 7 },
    { code: "5.5", label: "เบี้ยเลี้ยง", kind: "item", cost_id: 39 },
    { code: "5.6", label: "ทำงานในวันหยุด", kind: "item", cost_id: 8 },
    { code: "5.7", label: "ค่าอาหาร", kind: "item", cost_id: 40 },
    { code: "5.8", label: "ค่าซ่อมบำรุง-ครุภัณฑ์", kind: "item", cost_id: 10 },
    { code: "5.9", label: "กระสอบใช้ไป", kind: "item", cost_id: 41 },
    { code: "5.10", label: "ค่าโทรศัพท์", kind: "item", cost_id: 14 },
    { code: "5.11", label: "ค่าใช้จ่ายยานพาหนะ", kind: "item", cost_id: 11 },
    { code: "5.12", label: "ค่าน้ำมันเชื้อเพลิงใช้ไป", kind: "item", cost_id: 13 },
    { code: "5.13", label: "ค่าเสื่อมราคา-เครื่องจักร", kind: "item", cost_id: 42 },
    { code: "5.14", label: "ค่าเสื่อมราคา-ครุภัณฑ์", kind: "item", cost_id: 18 },
    { code: "5.15", label: "ค่าซ่อมบำรุง-อาคาร", kind: "item", cost_id: 31 },
    { code: "5.16", label: "ค่าของใช้สำนักงาน", kind: "item", cost_id: 26 },
    { code: "5.17", label: "ค่าลดหย่อนสินค้าขาดบัญชี", kind: "item", cost_id: 43 },
    { code: "5.18", label: "ค่าลดหย่อนสินค้าขาดบัญชี-ยางพารา", kind: "item", cost_id: 44 },
    { code: "5.19", label: "ค่าน้ำมันเชื้อเพลิงใช้ไป (รายการซ้ำ)", kind: "item", cost_id: 13, business_cost_id: 84 },
    { code: "5.20", label: "ค่าเสื่อมราคา-งาน/อาคาร", kind: "item", cost_id: 19 },
    { code: "5.21", label: "ค่าเบี้ยประกันภัย", kind: "item", cost_id: 9 },
    { code: "5.22", label: "ค่าเสื่อมราคา-ยานพาหนะ", kind: "item", cost_id: 20 },
    { code: "5.23", label: "ค่าบำรุงรักษา-รถตัก/ยานพาหนะ", kind: "item", cost_id: 45 },
    { code: "5.24", label: "ค่าบริการสมาชิก", kind: "item", cost_id: 27 },
    { code: "5.25", label: "ค่าเหนื่อยเจ้าหน้าที่", kind: "item", cost_id: 21 },
    { code: "5.26", label: "ค่าประชาสัมพันธ์", kind: "item", cost_id: 24 },
    { code: "5.27", label: "ค่าภาษีโรงเรือน", kind: "item", cost_id: 35 },
    { code: "5.28", label: "ตัดจ่าย", kind: "item", cost_id: 46 },
    { code: "5.29", label: "ดอกเบี้ยจ่าย ธ.ก.ส. เพื่อรอการขาย", kind: "item", cost_id: 47 },
    { code: "5.30", label: "ดอกเบี้ยจ่าย ก.ส.ส.", kind: "item", cost_id: 48 },
    { code: "5.31", label: "ขาดทุนจากการยกเลิกใช้อาคาร", kind: "item", cost_id: 49 },
    { code: "5.32", label: "ค่าเช่าสถานที่รวบรวม", kind: "item", cost_id: 50 },
    { code: "5.33", label: "ค่าลดหย่อนสินค้าขาดบัญชี-ข้าวโพด", kind: "item", cost_id: 51 },
    { code: "5.34", label: "โครงการชะลอข้าวเปลือก", kind: "item", cost_id: 52 },
    { code: "5.35", label: "ค่าใช้จ่ายเบ็ดเตล็ด", kind: "item", cost_id: 36 },
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

const BusinessPlanExpenseCollectionTableDetail = ({ branchId, branchName, yearBE, planId }) => {
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
      // ASSUMPTION: API returns monthly data now.
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
      console.error("[Collection Detail Load saved] failed:", e)
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

        // ASSUMPTION: New/updated bulk endpoint for monthly costs
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
        console.error("[Save Expense Detail] failed:", e)
    } finally {
        setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ประมาณการค่าใช้จ่ายแผนธุรกิจ (ธุรกิจรวบรวม) - รายเดือน</div>
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

export default BusinessPlanExpenseCollectionTableDetail