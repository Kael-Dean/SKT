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
  subtotal: "bg-emerald-100 dark:bg-emerald-900",
  grandtotal: "bg-emerald-200 dark:bg-emerald-800"
}

const BusinessPlanRepCostSummaryTableDetail = ({ branchId, branchName, yearBE, planId }) => {
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
      const data = await apiAuth(`/business-plan/${effectivePlanId}/aux-costs/monthly?branch_id=${effectiveBranchId}`)
      const monthlyCosts = Array.isArray(data?.monthly_costs) ? data.monthly_costs : []

      const auxToCode = new Map()
      for (const r of itemRows) {
        if (r.aux_id) auxToCode.set(Number(r.aux_id), r.code)
      }

      const seed = {}
      for (const cell of monthlyCosts) {
        const auxId = Number(cell.aux_id || 0)
        const monthNum = Number(cell.month || 0)
        const amount = Number(cell.amount || 0)
        const month = MONTHS.find(m => m.month === monthNum)

        if (!auxId || !month) continue

        const code = auxToCode.get(auxId)
        if (!code) continue

        if (!seed[code]) seed[code] = {}
        seed[code][month.key] = String(amount)
      }

      setValuesByCode(normalizeGrid(seed))
    } catch (e) {
      console.error("[AuxCost Detail Load saved] failed:", e)
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
  
  const sectionMap = useMemo(() => ({
      "1.T": ["1.1", "1.2"],
      "2.T": ["2.1", "2.2"],
      "3.T": ["3.1"],
      "4.T": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12", "4.13", "4.14"],
      "5.T": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"],
      "6.T": ["6.1"],
  }), [])

  const computed = useMemo(() => {
    const totals = {}
    
    // Initialize totals
    for (const r of ROWS) {
        totals[r.code] = {
            monthly: MONTHS.reduce((acc, m) => ({...acc, [m.key]: 0}), {}),
            total: 0
        }
    }

    // Calculate item rows
    for (const r of itemRows) {
        let rowTotal = 0
        for (const m of MONTHS) {
            const val = toNumber(valuesByCode[r.code]?.[m.key])
            totals[r.code].monthly[m.key] = val
            rowTotal += val
        }
        totals[r.code].total = rowTotal
    }

    // Calculate subtotals
    for (const subtotalCode of Object.keys(sectionMap)) {
        let subtotalRowTotal = 0
        for (const m of MONTHS) {
            let monthSum = 0
            for (const itemCode of sectionMap[subtotalCode]) {
                monthSum += totals[itemCode].monthly[m.key]
            }
            totals[subtotalCode].monthly[m.key] = monthSum
            subtotalRowTotal += monthSum
        }
        totals[subtotalCode].total = subtotalRowTotal
    }

    // Calculate Grand Total
    let grandTotalValue = 0
    for (const m of MONTHS) {
        let grandMonthSum = 0
        for (const subtotalCode of Object.keys(sectionMap)) {
            grandMonthSum += totals[subtotalCode].monthly[m.key]
        }
        totals["G.T"].monthly[m.key] = grandMonthSum
        grandTotalValue += grandMonthSum
    }
    totals["G.T"].total = grandTotalValue

    return totals
  }, [valuesByCode, itemRows, sectionMap])

  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const buildBulkRowsForBE = useCallback(() => {
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error("FE: plan_id ไม่ถูกต้อง")
    if (!effectiveBranchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    
    const cells = []
    
    for (const r of itemRows) {
        if (!r.aux_id) continue

        const rowData = valuesByCode[r.code] || {}
        for (const m of MONTHS) {
            const amount = toNumber(rowData[m.key])
            if (amount > 0) {
                cells.push({
                    aux_id: r.aux_id,
                    month: m.month,
                    amount: amount,
                    comment: periodLabel,
                })
            }
        }
    }

    return {
        branch_id: effectiveBranchId,
        cells,
    }
  }, [effectivePlanId, effectiveBranchId, itemRows, valuesByCode, periodLabel])

  const saveToBE = async () => {
    let payload = null
    try {
        setNotice(null)
        const token = getToken()
        if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

        const built = buildBulkRowsForBE()
        payload = built
        setIsSaving(true)

        const res = await apiAuth(`/business-plan/${effectivePlanId}/aux-costs/bulk-monthly`, {
            method: "PUT",
            body: payload,
        })

        setNotice({
            type: "success",
            title: "บันทึกสำเร็จ ✅",
            detail: `plan_id=${effectivePlanId} • สาขา ${effectiveBranchName} • บันทึก ${res?.saved_count ?? built.cells.length} รายการ`,
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
        console.error("[Save RepCost Summary Detail] failed:", e)
    } finally {
        setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ประมาณการต้นทุนสินค้า - รายเดือน</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                ({periodLabel}) • ปี {effectiveYear} • plan_id {effectivePlanId} • สาขา {effectiveBranchName}
                {isLoadingSaved ? " • โหลดค่าที่บันทึกไว้..." : ""}
            </div>
             <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              รวมทั้งหมด (บาท): <span className="font-extrabold">{fmtMoney(computed["G.T"]?.total ?? 0)}</span>
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
                const totalInfo = computed[r.code]
                const rowBg = r.kind === 'subtotal' ? STRIPE.subtotal : r.kind === 'grandtotal' ? STRIPE.grandtotal : (rIdx % 2 === 1 ? STRIPE.alt : STRIPE.cell)
                const font = r.kind === 'subtotal' || r.kind === 'grandtotal' ? 'font-extrabold' : ''

                if (r.kind === 'title' || r.kind === 'section') {
                    return (
                        <tr key={r.code} className="bg-slate-200 dark:bg-slate-700">
                          <td className="border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600 sticky left-0 z-10 bg-slate-200 dark:bg-slate-700">{r.kind==='section' ? r.code: ''}</td>
                          <td colSpan={MONTHS.length + 2} className="border border-slate-300 px-2 py-2 font-extrabold text-xs dark:border-slate-600 sticky left-[60px] z-10 bg-slate-200 dark:bg-slate-700">{r.label}</td>
                        </tr>
                    )
                }

                return (
                  <tr key={r.code} className={cx(rowBg, font)}>
                    <td className={cx("border border-slate-300 px-1 py-2 text-center text-xs dark:border-slate-600 sticky left-0 z-10", rowBg)}>{r.code}</td>
                    <td className={cx("border border-slate-300 px-2 py-2 text-left font-semibold text-xs dark:border-slate-600 sticky left-[60px] z-10", rowBg, trunc)} title={r.label}>{r.label}</td>
                    
                    {MONTHS.map((m) => (
                        <td key={`${r.code}-${m.key}`} className="border border-slate-300 px-1 py-1 dark:border-slate-600">
                           {r.kind === 'item' ? (
                                <input
                                    className={cellInput}
                                    value={valuesByCode?.[r.code]?.[m.key] ?? ""}
                                    inputMode="decimal"
                                    placeholder="0"
                                    onChange={(e) => setCell(r.code, m.key, sanitizeNumberInput(e.target.value, { maxDecimals: 2 }))}
                                />
                           ) : (
                               <div className="px-1.5 py-1 text-right">{fmtMoney0(totalInfo?.monthly[m.key] ?? 0)}</div>
                           )}
                        </td>
                    ))}

                    <td className="border border-slate-300 px-1 py-2 text-right font-extrabold text-xs dark:border-slate-600">{fmtMoney0(totalInfo?.total ?? 0)}</td>
                  </tr>
                )
              })}
            </tbody>
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

export default BusinessPlanRepCostSummaryTableDetail