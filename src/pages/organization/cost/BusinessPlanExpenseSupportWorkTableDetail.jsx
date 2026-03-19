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

const BUSINESS_GROUP_ID = 6

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

const BusinessPlanExpenseSupportWorkTableDetail = (props) => {
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
            <h1 className="text-lg font-bold">ค่าใช้จ่ายดำเนินงาน (รายเดือน)</h1>
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

export default BusinessPlanExpenseSupportWorkTableDetail