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

const BUSINESS_GROUP_ID = 4 // ธุรกิจแปรรูป

const BUSINESS_COSTS_SEED = [
  { id: 101, cost_id: 2, business_group: 4 }, { id: 102, cost_id: 69, business_group: 4 },
  { id: 103, cost_id: 68, business_group: 4 }, { id: 104, cost_id: 43, business_group: 4 },
  { id: 105, cost_id: 7, business_group: 4 }, { id: 106, cost_id: 39, business_group: 4 },
  { id: 107, cost_id: 8, business_group: 4 }, { id: 108, cost_id: 5, business_group: 4 },
  { id: 109, cost_id: 11, business_group: 4 }, { id: 110, cost_id: 13, business_group: 4 },
  { id: 111, cost_id: 14, business_group: 4 }, { id: 112, cost_id: 26, business_group: 4 },
  { id: 113, cost_id: 9, business_group: 4 }, { id: 114, cost_id: 18, business_group: 4 },
  { id: 115, cost_id: 19, business_group: 4 }, { id: 116, cost_id: 20, business_group: 4 },
  { id: 117, cost_id: 42, business_group: 4 }, { id: 118, cost_id: 34, business_group: 4 },
  { id: 119, cost_id: 29, business_group: 4 }, { id: 120, cost_id: 4, business_group: 4 },
  { id: 121, cost_id: 66, business_group: 4 }, { id: 122, cost_id: 65, business_group: 4 },
  { id: 123, cost_id: 21, business_group: 4 }, { id: 124, cost_id: 45, business_group: 4 },
  { id: 125, cost_id: 10, business_group: 4 }, { id: 126, cost_id: 64, business_group: 4 },
  { id: 127, cost_id: 63, business_group: 4 }, { id: 128, cost_id: 62, business_group: 4 },
  { id: 129, cost_id: 61, business_group: 4 }, { id: 130, cost_id: 27, business_group: 4 },
  { id: 131, cost_id: 24, business_group: 4 }, { id: 132, cost_id: 31, business_group: 4 },
  { id: 133, cost_id: 60, business_group: 4 }, { id: 134, cost_id: 35, business_group: 4 },
  { id: 135, cost_id: 59, business_group: 4 }, { id: 136, cost_id: 58, business_group: 4 },
  { id: 137, cost_id: 57, business_group: 4 }, { id: 138, cost_id: 41, business_group: 4 },
  { id: 139, cost_id: 16, business_group: 4 }, { id: 140, cost_id: 56, business_group: 4 },
  { id: 141, cost_id: 55, business_group: 4 }, { id: 142, cost_id: 54, business_group: 4 },
  { id: 143, cost_id: 53, business_group: 4 }, { id: 144, cost_id: 36, business_group: 4 },
  { id: 145, cost_id: 36, business_group: 4 },
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
  { code: "6", label: "ค่าใช้จ่ายเฉพาะ ธุรกิจแปรรูป", kind: "section" },
  { code: "6.1", label: "ค่าใช้จ่ายในการขาย", kind: "item", cost_id: 2 },
  { code: "6.2", label: "ค่าใช้จ่ายในการขาย ดวจ", kind: "item", cost_id: 69 },
  { code: "6.3", label: "ดอกเบี้ยจ่าย เงินสะสมจนท.", kind: "item", cost_id: 68 },
  { code: "6.4", label: "ค่าลดหย่อนสินค้าขาดบัญชี", kind: "item", cost_id: 43 },
  { code: "6.5", label: "เงินเดือนและค่าจ้าง", kind: "item", cost_id: 7 },
  { code: "6.5b", label: "เบี้ยเลี้ยง", kind: "item", cost_id: 39 },
  { code: "6.6", label: "ค่าทำงานในวันหยุด", kind: "item", cost_id: 8 },
  { code: "6.7", label: "ค่าส่งเสริมการขาย", kind: "item", cost_id: 5 },
  { code: "6.8", label: "ค่าใช้จ่ายยานพาหนะ", kind: "item", cost_id: 11 },
  { code: "6.9", label: "ค่าน้ำมันเชื้อเพลิง", kind: "item", cost_id: 13 },
  { code: "6.10", label: "ค่าโทรศัพท์", kind: "item", cost_id: 14 },
  { code: "6.11", label: "ค่าของใช้สำนักงาน", kind: "item", cost_id: 26 },
  { code: "6.12", label: "ค่าเบี้ยประกันภัย", kind: "item", cost_id: 9 },
  { code: "6.13", label: "* ค่าเสื่อมราคา - ครุภัณฑ์", kind: "item", cost_id: 18 },
  { code: "6.14", label: "* ค่าเสื่อมราคา - งาน, อาคาร", kind: "item", cost_id: 19 },
  { code: "6.15", label: "* ค่าเสื่อมราคา - ยานพาหนะ", kind: "item", cost_id: 20 },
  { code: "6.16", label: "* ค่าเสื่อมราคา - เครื่องจักรและอุปกรณ์", kind: "item", cost_id: 42 },
  { code: "6.17", label: "ค่าเครื่องเขียนแบบพิมพ์", kind: "item", cost_id: 34 },
  { code: "6.18", label: "ค่าชจ.ในการเคลื่อนย้าย", kind: "item", cost_id: 29 },
  { code: "6.19", label: "หนี้สงสัยจะสูญลูกหนี้การค้า", kind: "item", cost_id: 4 },
  { code: "6.20", label: "สวัสดิการจนท.", kind: "item", cost_id: 66 },
  { code: "6.21", label: "ค่าใช้จ่ายงานบ้านงานครัว", kind: "item", cost_id: 65 },
  { code: "6.22", label: "ค่าเบี้ยเลี้ยง จนท", kind: "item", cost_id: 21 },
  { code: "6.23", label: "ค่าบำรุงรักษา-รถตัก/ยานพาหนะ", kind: "item", cost_id: 45 },
  { code: "6.24", label: "ค่าบำรุงรักษา-ครุภัณฑ์", kind: "item", cost_id: 10 },
  { code: "6.25", label: "เงินสมทบประกันสังคม", kind: "item", cost_id: 64 },
  { code: "6.26", label: "ค่าธรรมเนียมในการโอนเงิน", kind: "item", cost_id: 63 },
  { code: "6.27", label: "ค่าของขวัญสมานคุณ", kind: "item", cost_id: 62 },
  { code: "6.28", label: "ค่ารับรอง", kind: "item", cost_id: 61 },
  { code: "6.29", label: "ค่าบริการสมาชิก", kind: "item", cost_id: 27 },
  { code: "6.30", label: "ค่ากิจกรรมสัมพันธ์", kind: "item", cost_id: 24 },
  { code: "6.31", label: "ค่าซ่อมแซมอาคาร", kind: "item", cost_id: 31 },
  { code: "6.32", label: "ค่าเบี้ยเลี้ยงกรรมการ", kind: "item", cost_id: 60 },
  { code: "6.33", label: "ค่าภาษีโรงเรือน", kind: "item", cost_id: 35 },
  { code: "6.34", label: "ค่าตามมาตรฐาน", kind: "item", cost_id: 59 },
  { code: "6.35", label: "ค่าจ่ายค่าสื่อสาร", kind: "item", cost_id: 58 },
  { code: "6.36", label: "ค่าสมาชิกระหว่างสากล", kind: "item", cost_id: 57 },
  { code: "6.37", label: "กระสอบใช้ไป", kind: "item", cost_id: 41 },
  { code: "6.38", label: "ค่าไฟฟ้า", kind: "item", cost_id: 16 },
  { code: "6.39", label: "ค่าโฆษณาประชาสัมพันธ์", kind: "item", cost_id: 56 },
  { code: "6.40", label: "ค่าปรับปรุงพื้นที่โรงสี", kind: "item", cost_id: 55 },
  { code: "6.41", label: "ค่าตกแต่งภูมิทัศน์", kind: "item", cost_id: 54 },
  { code: "6.42", label: "ค่าการใช้โปรแกรม", kind: "item", cost_id: 53 },
  { code: "6.45", label: "ค่าใช้จ่ายเบ็ดเตล็ด", kind: "item", cost_id: 36 },
]

const BusinessPlanExpenseProcessingTableDetail = (props) => {
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
            <h1 className="text-lg font-bold">ค่าใช้จ่ายเฉพาะ ธุรกิจแปรรูป (รายเดือน)</h1>
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

export default BusinessPlanExpenseProcessingTableDetail