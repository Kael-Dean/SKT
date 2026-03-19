import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"

/** ---------------- Utils ---------------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => {
  if (v === "" || v === null || v === undefined) return 0
  const n = Number(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}
const sanitizeNumberInput = (s, { maxDecimals = 2 } = {}) => {
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
const fmtMoney = (n) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(n))

/** ---------------- API ---------------- */
const API_BASE_RAW = import.meta.env.VITE_API_BASE_CUSTOM || import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || ""
const API_BASE = String(API_BASE_RAW || "").replace(/\/+$/, "")

class ApiError extends Error {
  constructor(message, meta = {}) {
    super(message)
    this.name = "ApiError"; Object.assign(this, meta)
  }
}

const getToken = () => localStorage.getItem("token") || ""

async function apiAuth(path, { method = "GET", body } = {}) {
  if (!API_BASE) throw new ApiError("FE: VITE_API_BASE not set", { status: 0 })
  const token = getToken()
  const url = `${API_BASE}${path}`

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  }).catch(e => { throw new ApiError("FE: Network/CORS/DNS failure", { status: 0, cause: e }) })

  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch {}

  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`
    throw new ApiError(msg, { status: res.status, data })
  }
  return data
}

/** ---------------- Definitions ---------------- */
const MONTHS = [
  { key: "m04", label: "เม.ย.", month: 4 }, { key: "m05", label: "พ.ค.", month: 5 },
  { key: "m06", label: "มิ.ย.", month: 6 }, { key: "m07", label: "ก.ค.", month: 7 },
  { key: "m08", label: "ส.ค.", month: 8 }, { key: "m09", label: "ก.ย.", month: 9 },
  { key: "m10", label: "ต.ค.", month: 10 }, { key: "m11", label: "พ.ย.", month: 11 },
  { key: "m12", label: "ธ.ค.", month: 12 }, { key: "m01", label: "ม.ค.", month: 1 },
  { key: "m02", label: "ก.พ.", month: 2 }, { key: "m03", label: "มี.ค.", month: 3 },
]

const BUSINESS_GROUP_ID = 3 // ธุรกิจรวบรวม

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

const BUSINESS_COST_ID_MAP = new Map()
for (const r of BUSINESS_COSTS_SEED) {
    const key = `${r.cost_id}:${r.business_group}`
    if (!BUSINESS_COST_ID_MAP.has(key)) BUSINESS_COST_ID_MAP.set(key, r.id)
}

const resolveRowBusinessCostId = (row) => {
    if (row?.business_cost_id) return Number(row.business_cost_id)
    return BUSINESS_COST_ID_MAP.get(`${row?.cost_id}:${BUSINESS_GROUP_ID}`) ?? null
}

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

const BusinessPlanExpenseCollectionTableDetail = (props) => {
  const { branchId, branchName, yearBE, planId } = props || {}
  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])

  const [units, setUnits] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [yearlyTotals, setYearlyTotals] = useState({})
  const [monthlyValues, setMonthlyValues] = useState({})
  
  const effectiveBranchId = useMemo(() => Number(branchId || 0) || 0, [branchId])
  const effectivePlanId = useMemo(() => Number(planId || (yearBE - 2568) || 0), [planId, yearBE])
  const effectiveYear = useMemo(() => Number(yearBE || (planId + 2568) || 0), [yearBE, planId])

  const fetchData = useCallback(async () => {
    if (!effectiveBranchId || !effectivePlanId) return
    setIsLoading(true)
    try {
      const [unitsData, costsData] = await Promise.all([
        apiAuth(`/lists/unit/search?branch_id=${effectiveBranchId}`),
        apiAuth(`/business-plan/${effectivePlanId}/costs?branch_id=${effectiveBranchId}`),
      ])

      const loadedUnits = Array.isArray(unitsData) ? unitsData.map(u => ({...u, short: String(u.unit_name||"").slice(0,4)})) : []
      setUnits(loadedUnits)
      
      const bcToCode = new Map(itemRows.map(r => [resolveRowBusinessCostId(r), r.code]).filter(x => x[0]))
      const loadedTotals = {}
      if(costsData?.unit_costs){
          for(const cell of costsData.unit_costs) {
              const code = bcToCode.get(Number(cell.business_cost_id))
              if(!code) continue
              if(!loadedTotals[code]) loadedTotals[code] = {}
              loadedTotals[code][cell.unit_id] = toNumber(cell.amount)
          }
      }
      setYearlyTotals(loadedTotals)

    } catch (e) {
      console.error("Failed to fetch initial data", e)
      setUnits([])
      setYearlyTotals({})
    } finally {
      setIsLoading(false)
    }
  }, [effectiveBranchId, effectivePlanId, itemRows])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const setCell = (code, monthKey, unitId, value) => {
    setMonthlyValues(prev => {
      const next = {...prev}
      if(!next[code]) next[code] = {}
      if(!next[code][monthKey]) next[code][monthKey] = {}
      next[code][monthKey][unitId] = value
      return next
    })
  }
  
  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const saveToBE = async () => {
    setIsSaving(true); setNotice(null)
    try {
      const payloadRows = []
      let errors = []

      for(const r of itemRows) {
          const businessCostId = resolveRowBusinessCostId(r)
          if(!businessCostId) continue
          
          for(const u of units) {
              const yearlyVal = yearlyTotals[r.code]?.[u.id] ?? 0
              let monthlySum = 0
              const monthValues = {}
              
              for (const m of MONTHS) {
                  const val = toNumber(monthlyValues[r.code]?.[m.key]?.[u.id])
                  monthlySum += val
                  const beMonthKey = `m${m.month}_value`
                  monthValues[beMonthKey] = val
              }

              if (yearlyVal > 0 && Math.abs(yearlyVal - monthlySum) > 0.01) {
                  errors.push(`แถว ${r.code} (${u.name}): ยอดรวมรายเดือน (${fmtMoney(monthlySum)}) ไม่เท่ากับยอดปี (${fmtMoney(yearlyVal)})`)
              }

              if (yearlyVal > 0) {
                 payloadRows.push({
                    unit_id: u.id,
                    b_cost: businessCostId,
                    months: monthValues,
                 })
              }
          }
      }

      if(errors.length > 0) {
          throw new Error("ยอดรวมไม่ตรงกัน:\n- " + errors.join("\n- "))
      }

      const res = await apiAuth(`/business-plan/${effectivePlanId}/costs/monthly`, {
        method: "POST",
        body: { rows: payloadRows },
      })
      setNotice({ type: "success", title: "บันทึกสำเร็จ ✅", detail: `บันทึก ${res?.monthly_rows_upserted ?? 0} รายการ` })
    } catch (e) {
      setNotice({ type: "error", title: "บันทึกไม่สำเร็จ ❌", detail: e.message || String(e) })
    } finally {
      setIsSaving(false)
    }
  }
  
  return (
    <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h1 className="text-lg font-bold">ค่าใช้จ่ายเฉพาะ ธุรกิจรวบรวม (รายเดือน)</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                ปี {effectiveYear} • สาขา {branchName || "-"} {isLoading ? "(กำลังโหลด...)" : ""}
            </p>
        </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="border-collapse text-sm w-full">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-700">
              <tr>
                <th rowSpan={2} className="p-2 border">รายการ</th>
                <th rowSpan={2} className="p-2 border">ยอดรวมปี</th>
                {MONTHS.map(m => <th key={m.key} colSpan={units.length || 1} className="p-2 border font-semibold">{m.label}</th>)}
              </tr>
              <tr>
                {MONTHS.map(m => (
                    units.length > 0 ? units.map(u => (
                        <th key={`${m.key}-${u.id}`} className="p-1 border text-[11px] font-medium" title={u.name}>{u.short}</th>
                    )) : <th key={`${m.key}-unit`} className="p-1 border text-[11px] font-medium">-</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itemRows.map((r, rIdx) => {
                  const yearlyTotal = Object.values(yearlyTotals[r.code] || {}).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={r.code} className={rIdx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-800/50"}>
                      <td className="p-2 border sticky left-0 bg-inherit z-10 font-semibold">{r.label}</td>
                      <td className="p-2 border text-right font-bold">{fmtMoney(yearlyTotal)}</td>
                      {MONTHS.map(m => (
                        units.length > 0 ? units.map(u => {
                            const val = monthlyValues[r.code]?.[m.key]?.[u.id] ?? ""
                            return (
                                <td key={`${m.key}-${u.id}`} className="p-1 border">
                                    <input 
                                        type="text"
                                        className="w-24 text-right bg-white dark:bg-slate-900 px-1 py-0.5 rounded-md border-slate-300"
                                        placeholder="0.00"
                                        value={val}
                                        onChange={e => setCell(r.code, m.key, u.id, sanitizeNumberInput(e.target.value))}
                                        disabled={!yearlyTotals[r.code] || yearlyTotals[r.code][u.id] === 0}
                                    />
                                </td>
                            )
                        }) : <td key={`${m.key}-unit`} className="p-1 border text-center text-slate-400">-</td>
                    ))}
                    </tr>
                  )
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t">
            {notice && <div className={`mb-3 p-3 rounded-lg text-sm ${notice.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                <p className="font-bold">{notice.title}</p>
                <p className="whitespace-pre-wrap">{notice.detail}</p>
            </div>}
            <div className="flex justify-end">
                <button onClick={saveToBE} disabled={isSaving} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:bg-slate-400">
                  {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูลรายเดือน"}
                </button>
            </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessPlanExpenseCollectionTableDetail