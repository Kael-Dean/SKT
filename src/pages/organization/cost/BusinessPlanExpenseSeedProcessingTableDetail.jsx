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

  let res
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body != null ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    throw new ApiError("FE: Network/CORS/DNS failure", { status: 0, cause: e })
  }

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

const BUSINESS_GROUP_ID = 5 // ธุรกิจเมล็ดพันธุ์

const BUSINESS_COSTS_SEED = [
  { id: 146, cost_id: 2, business_group: 5 }, { id: 147, cost_id: 7, business_group: 5 },
  { id: 148, cost_id: 39, business_group: 5 }, { id: 149, cost_id: 8, business_group: 5 },
  { id: 150, cost_id: 13, business_group: 5 }, { id: 151, cost_id: 21, business_group: 5 },
  { id: 152, cost_id: 26, business_group: 5 }, { id: 153, cost_id: 34, business_group: 5 },
  { id: 154, cost_id: 13, business_group: 5 }, { id: 155, cost_id: 27, business_group: 5 },
  { id: 156, cost_id: 12, business_group: 5 }, { id: 157, cost_id: 66, business_group: 5 },
  { id: 158, cost_id: 5, business_group: 5 }, { id: 159, cost_id: 63, business_group: 5 },
  { id: 160, cost_id: 67, business_group: 5 }, { id: 161, cost_id: 76, business_group: 5 },
  { id: 162, cost_id: 75, business_group: 5 }, { id: 163, cost_id: 74, business_group: 5 },
  { id: 164, cost_id: 73, business_group: 5 }, { id: 165, cost_id: 72, business_group: 5 },
  { id: 166, cost_id: 14, business_group: 5 }, { id: 167, cost_id: 64, business_group: 5 },
  { id: 168, cost_id: 24, business_group: 5 }, { id: 169, cost_id: 18, business_group: 5 },
  { id: 170, cost_id: 42, business_group: 5 }, { id: 171, cost_id: 9, business_group: 5 },
  { id: 172, cost_id: 28, business_group: 5 }, { id: 173, cost_id: 11, business_group: 5 },
  { id: 174, cost_id: 31, business_group: 5 }, { id: 175, cost_id: 65, business_group: 5 },
  { id: 176, cost_id: 10, business_group: 5 }, { id: 177, cost_id: 71, business_group: 5 },
  { id: 178, cost_id: 62, business_group: 5 }, { id: 179, cost_id: 68, business_group: 5 },
  { id: 180, cost_id: 36, business_group: 5 },
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
  { code: "7", label: "ค่าใช้จ่ายเฉพาะ ธุรกิจเมล็ดพันธุ์", kind: "section" },
  { code: "7.1", label: "ค่าใช้จ่ายในการขาย", kind: "item", cost_id: 2 },
  { code: "7.2", label: "เงินเดือนและค่าจ้าง", kind: "item", cost_id: 7 },
  { code: "7.3", label: "เบี้ยเลี้ยง", kind: "item", cost_id: 39 },
  { code: "7.4", label: "ค่าทำงานในวันหยุด", kind: "item", cost_id: 8 },
  { code: "7.5", label: "ค่าน้ำมันเชื้อเพลิง", kind: "item", cost_id: 13, business_cost_id: 150 },
  { code: "7.6", label: "ค่าเหนื่อยเจ้าหน้าที่", kind: "item", cost_id: 21 },
  { code: "7.7", label: "ค่าของใช้สำนักงาน", kind: "item", cost_id: 26 },
  { code: "7.8", label: "ค่าเครื่องเขียนแบบพิมพ์", kind: "item", cost_id: 34 },
  { code: "7.9", label: "ค่าน้ำมันเชื้อเพลิงใช้ไป", kind: "item", cost_id: 13, business_cost_id: 154 },
  { code: "7.10", label: "ค่าบริการสมาชิก", kind: "item", cost_id: 27 },
  { code: "7.11", label: "ค่าถ่ายเอกสาร", kind: "item", cost_id: 12 },
  { code: "7.12", label: "สวัสดิการเจ้าหน้าที่", kind: "item", cost_id: 66 },
  { code: "7.13", label: "ค่าส่งเสริมการขาย", kind: "item", cost_id: 5 },
  { code: "7.14", label: "ค่าธรรมเนียมโอนเงิน", kind: "item", cost_id: 63 },
  { code: "7.15", label: "การเคลื่อนย้าย", kind: "item", cost_id: 67 },
  { code: "7.16", label: "ดอกเบี้ยชุมชนสร้างไทย", kind: "item", cost_id: 76 },
  { code: "7.17", label: "ดอกเบี้ยจ่ายเงินกู้ ก.พ.ส.", kind: "item", cost_id: 75 },
  { code: "7.18", label: "ดอกเบี้ยจ่ายเงินกู้เครื่องผสมปุ๋ย", kind: "item", cost_id: 74 },
  { code: "7.19", label: "ดอกเบี้ยจ่ายเงินกู้ ธ.ก.ส. นา", kind: "item", cost_id: 73 },
  { code: "7.20", label: "โครงการเกษตรกร", kind: "item", cost_id: 72 },
  { code: "7.21", label: "ค่าโทรศัพท์", kind: "item", cost_id: 14 },
  { code: "7.22", label: "เงินสมทบประกันสังคม", kind: "item", cost_id: 64 },
  { code: "7.23", label: "ค่าประชาสัมพันธ์", kind: "item", cost_id: 24 },
  { code: "7.24", label: "* ค่าเสื่อมราคา - ครุภัณฑ์", kind: "item", cost_id: 18 },
  { code: "7.25", label: "* ค่าเสื่อมราคา - เครื่องจักร", kind: "item", cost_id: 42 },
  { code: "7.26", label: "ค่าเบี้ยประกันภัย", kind: "item", cost_id: 9 },
  { code: "7.27", label: "ค่าซ่อมบำรุงยานพาหนะ", kind: "item", cost_id: 28 },
  { code: "7.28", label: "ค่าใช้จ่ายยานพาหนะ", kind: "item", cost_id: 11 },
  { code: "7.29", label: "ค่าซ่อมบำรุง-อาคาร", kind: "item", cost_id: 31 },
  { code: "7.30", label: "งานบ้านงานครัว", kind: "item", cost_id: 65 },
  { code: "7.31", label: "ค่าซ่อมบำรุง-ครุภัณฑ์", kind: "item", cost_id: 10 },
  { code: "7.32", label: "ค่าวัสดุ", kind: "item", cost_id: 71 },
  { code: "7.33", label: "ค่าของขวัญสมานคุณ", kind: "item", cost_id: 62 },
  { code: "7.34", label: "ดอกเบี้ย เงินสะสมเจ้าหน้าที่", kind: "item", cost_id: 68 },
  { code: "7.35", label: "ค่าใช้จ่ายเบ็ดเตล็ด", kind: "item", cost_id: 36 },
]

const BusinessPlanExpenseSeedProcessingTableDetail = (props) => {
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

  const computed = useMemo(() => {
    const rowSums = {}
    for (const r of itemRows) {
        rowSums[r.code] = {}
        for (const u of units) {
            let sum = 0;
            for(const m of MONTHS) {
                sum += toNumber(monthlyValues[r.code]?.[m.key]?.[u.id])
            }
            rowSums[r.code][u.id] = sum
        }
    }
    return { rowSums }
  }, [monthlyValues, itemRows, units])

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

              if (Math.abs(yearlyVal - monthlySum) > 0.01) {
                  errors.push(`แถว ${r.code} (${r.label}) หน่วย ${u.unit_name}: ยอดรวมรายเดือน (${fmtMoney(monthlySum)}) ไม่เท่ากับยอดรวมปี (${fmtMoney(yearlyVal)})`)
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
          throw new Error("ยอดรวมไม่ตรงกัน:\n" + errors.join("\n"))
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
            <h1 className="text-lg font-bold">ค่าใช้จ่ายเฉพาะ ธุรกิจเมล็ดพันธุ์ (รายเดือน)</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                ปี {effectiveYear} • สาขา {branchName || "-"} {isLoading ? "(กำลังโหลด...)" : ""}
            </p>
        </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="border-collapse text-sm w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-700">
                <th rowSpan={2} className="p-2 border sticky left-0 z-10 bg-slate-100 dark:bg-slate-700">รายการ</th>
                <th rowSpan={2} className="p-2 border">หน่วย</th>
                <th rowSpan={2} className="p-2 border">ยอดรวม<br/>(ทั้งปี)</th>
                {MONTHS.map(m => <th key={m.key} className="p-2 border">{m.label}</th>)}
                <th rowSpan={2} className="p-2 border">ยอดรวม<br/>(รายเดือน)</th>
                 <th rowSpan={2} className="p-2 border">ผลต่าง</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.flatMap((r, rIdx) => 
                units.map((u, uIdx) => {
                  const yearlyTotal = yearlyTotals[r.code]?.[u.id] ?? 0
                  const monthlyTotal = computed.rowSums[r.code]?.[u.id] ?? 0
                  const diff = yearlyTotal - monthlyTotal
                  const isDiff = Math.abs(diff) > 0.01

                  return (
                    <tr key={`${r.code}-${u.id}`} className={uIdx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-800/50"}>
                      {uIdx === 0 && <td rowSpan={units.length} className="p-2 border sticky left-0 bg-inherit z-10">{r.label}</td>}
                      <td className="p-2 border">{u.unit_name}</td>
                      <td className="p-2 border text-right">{fmtMoney(yearlyTotal)}</td>
                      {MONTHS.map(m => (
                        <td key={m.key} className="p-1 border">
                           <input 
                              type="text"
                              className="w-full text-right bg-white dark:bg-slate-900 px-1 py-0.5 rounded-md border-slate-300"
                              placeholder="0.00"
                              value={monthlyValues[r.code]?.[m.key]?.[u.id] ?? ""}
                              onChange={e => setCell(r.code, m.key, u.id, sanitizeNumberInput(e.target.value))}
                              disabled={yearlyTotal === 0}
                           />
                        </td>
                      ))}
                      <td className={`p-2 border text-right font-semibold ${isDiff ? 'text-red-500' : ''}`}>{fmtMoney(monthlyTotal)}</td>
                      <td className={`p-2 border text-right font-semibold ${isDiff ? 'text-red-500' : ''}`}>{fmtMoney(diff)}</td>
                    </tr>
                  )
                })
              )}
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

export default BusinessPlanExpenseSeedProcessingTableDetail