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

const BUSINESS_GROUP_ID = 1 // ธุรกิจจัดหาสินค้า

const BUSINESS_COSTS_SEED = [
    { id: 1, cost_id: 2, business_group: 1 }, { id: 2, cost_id: 3, business_group: 1 },
    { id: 3, cost_id: 4, business_group: 1 }, { id: 4, cost_id: 5, business_group: 1 },
    { id: 5, cost_id: 6, business_group: 1 }, { id: 6, cost_id: 7, business_group: 1 },
    { id: 7, cost_id: 8, business_group: 1 }, { id: 8, cost_id: 9, business_group: 1 },
    { id: 9, cost_id: 10, business_group: 1 }, { id: 10, cost_id: 11, business_group: 1 },
    { id: 11, cost_id: 12, business_group: 1 }, { id: 12, cost_id: 13, business_group: 1 },
    { id: 13, cost_id: 14, business_group: 1 }, { id: 14, cost_id: 15, business_group: 1 },
    { id: 15, cost_id: 16, business_group: 1 }, { id: 16, cost_id: 17, business_group: 1 },
    { id: 17, cost_id: 18, business_group: 1 }, { id: 18, cost_id: 19, business_group: 1 },
    { id: 19, cost_id: 20, business_group: 1 }, { id: 20, cost_id: 21, business_group: 1 },
    { id: 21, cost_id: 22, business_group: 1 }, { id: 22, cost_id: 23, business_group: 1 },
    { id: 23, cost_id: 24, business_group: 1 }, { id: 24, cost_id: 25, business_group: 1 },
    { id: 25, cost_id: 26, business_group: 1 }, { id: 26, cost_id: 27, business_group: 1 },
    { id: 27, cost_id: 28, business_group: 1 }, { id: 28, cost_id: 29, business_group: 1 },
    { id: 29, cost_id: 30, business_group: 1 }, { id: 30, cost_id: 31, business_group: 1 },
    { id: 31, cost_id: 32, business_group: 1 }, { id: 32, cost_id: 33, business_group: 1 },
    { id: 33, cost_id: 34, business_group: 1 }, { id: 34, cost_id: 35, business_group: 1 },
    { id: 35, cost_id: 36, business_group: 1 },
]

const BUSINESS_COST_ID_MAP = new Map(BUSINESS_COSTS_SEED.map(r => [`${r.cost_id}:${r.business_group}`, r.id]))
const resolveRowBusinessCostId = (row) => BUSINESS_COST_ID_MAP.get(`${row?.cost_id}:${BUSINESS_GROUP_ID}`) ?? null

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

const BusinessPlanExpenseTableDetail = (props) => {
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
            <h1 className="text-lg font-bold">ค่าใช้จ่ายเฉพาะ ธุรกิจจัดหาสินค้า (รายเดือน)</h1>
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

export default BusinessPlanExpenseTableDetail