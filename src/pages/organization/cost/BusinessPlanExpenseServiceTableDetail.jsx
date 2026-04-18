import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import { useSidebarOpen } from "../../../components/AppLayout"
import { useBusinessCosts } from "../../../lib/useBusinessList"

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

/** ---------------- Business group (บริการ) ---------------- */
const BUSINESS_GROUP_ID = 8

/** ---------------- Rows (ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ) ---------------- */
const ROWS = [
    { code: "8", label: "ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ", kind: "section" },
    { code: "8.1", kind: "item", business_cost_id: 181 },
    { code: "8.2", kind: "item", business_cost_id: 185 },
    { code: "8.3", kind: "item", business_cost_id: 188 },
    { code: "8.4", kind: "item", business_cost_id: 198 },
    { code: "8.5", kind: "item", business_cost_id: 71 },
    { code: "8.6", kind: "item", business_cost_id: 197 },
    { code: "8.7", kind: "item", business_cost_id: 196 },
    { code: "8.8", kind: "item", business_cost_id: 202 },
    { code: "8.9", kind: "item", business_cost_id: 209 },
    { code: "8.10", kind: "item", business_cost_id: 192 },
    { code: "8.11", kind: "item", business_cost_id: 190 },
    { code: "8.12", kind: "item", business_cost_id: 187 },
    { code: "8.13", kind: "item", business_cost_id: 219 },
    { code: "8.14", kind: "item", business_cost_id: 199 },
    { code: "8.15", kind: "item", business_cost_id: 207 },
    { code: "8.16", kind: "item", business_cost_id: 216 },
    { code: "8.17", kind: "item", business_cost_id: 221 },
    { code: "8.18", kind: "item", business_cost_id: 203 },
    { code: "8.19", kind: "item", business_cost_id: 193 },
    { code: "8.20", kind: "item", business_cost_id: 217 },
    { code: "8.21", kind: "item", business_cost_id: 210 },
    { code: "8.23", kind: "item", business_cost_id: 200 },
    { code: "8.24", kind: "item", business_cost_id: 224 },
    { code: "8.25", kind: "item", business_cost_id: 218 },
    { code: "8.26", kind: "item", business_cost_id: 226 },
    { code: "8.27", kind: "item", business_cost_id: 230 },
]

const PLACEHOLDER_UNITS = [{ id: 0, name: "—", short: "—" }]

const COL_W = { code: 60, item: 300, cell: 100, total: 100 }
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  head: "bg-slate-100 dark:bg-slate-700",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100 dark:bg-emerald-900",
}
const monthStripeHead = (idx) => (idx % 2 === 1 ? "bg-slate-200 dark:bg-slate-600" : "bg-slate-100 dark:bg-slate-700");
const monthStripeCell = (idx) => (idx % 2 === 1 ? STRIPE.alt : STRIPE.cell);

const normalizeUnitName = (name) => String(name ?? "").trim().replace(/\s+/g, " ")
const shortUnit = (name, idx) => {
  const s = normalizeUnitName(name)
  if (!s) return `หน่วย${idx + 1}`
  return s.length <= 4 ? s : s.slice(0, 4)
}

const BusinessPlanExpenseServiceTableDetail = ({ branchId, branchName, yearBE, planId }) => {
  const { nameById: costNameById } = useBusinessCosts(BUSINESS_GROUP_ID)

  const displayRows = useMemo(
    () => ROWS.map((r) => r.business_cost_id && costNameById[r.business_cost_id] ? { ...r, label: costNameById[r.business_cost_id] } : r),
    [costNameById]
  )
  const itemRows = useMemo(() => displayRows.filter((r) => r.kind === "item"), [displayRows])

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

  const [units, setUnits] = useState([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  useEffect(() => {
    if (!effectiveBranchId) { setUnits([]); return }
    let alive = true
    ;(async () => {
      setIsLoadingUnits(true)
      try {
        const data = await apiAuth(`/lists/unit/search?branch_id=${effectiveBranchId}`)
        const rows = Array.isArray(data) ? data : []
        const normalized = rows
          .map((r) => ({
            id: Number(r.id || 0),
            name: r.unit_name || r.klang_name || r.unit || r.name || `หน่วย ${r.id}`,
            short: (r.unit_name || r.klang_name || r.unit || r.name || "").slice(0, 4)
          }))
          .filter((r) => r.id > 0)
        if (!alive) return
        setUnits(normalized)
      } catch (e) {
        if (!alive) return
        setUnits([])
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()
    return () => { alive = false }
  }, [effectiveBranchId])

  const unitCols = useMemo(() => {
    if (!units.length) return PLACEHOLDER_UNITS
    return units
  }, [units])

  const [valuesByCode, setValuesByCode] = useState({})
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const normalizeGrid = useCallback(
    (seed = {}) => {
      const next = {}
      for (const r of itemRows) {
        const rowSeed = seed?.[r.code] || {}
        const monthValues = {}
        for (const m of MONTHS) {
            const unitValues = {}
            for (const u of unitCols) {
                unitValues[u.id] = rowSeed?.[m.key]?.[u.id] ?? ""
            }
            monthValues[m.key] = unitValues
        }
        next[r.code] = monthValues
      }
      return next
    },
    [itemRows, unitCols]
  )

  useEffect(() => {
    setValuesByCode((prev) => normalizeGrid(prev))
  }, [normalizeGrid])

  const loadSavedFromBE = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0 || !effectiveBranchId || !unitCols.length || unitCols[0].id === 0) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/business-plan/${effectivePlanId}/costs/monthly?branch_id=${effectiveBranchId}&business_group_id=${BUSINESS_GROUP_ID}`)
      const rowsData = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data?.monthly_costs) ? data.monthly_costs : (Array.isArray(data) ? data : []))

      const bcToCode = new Map()
      for (const r of itemRows) {
        const bcId = Number(r.business_cost_id || 0)
        if (bcId) bcToCode.set(Number(bcId), r.code)
      }

      const seed = {}
      for (const cell of rowsData) {
        const bCostId = Number(cell.b_cost || cell.business_cost_id || 0)
        const unitId = Number(cell.unit_id || 0)
        
        if (!bCostId || !unitId) continue

        const code = bcToCode.get(bCostId)
        if (!code) continue

        if (!seed[code]) seed[code] = {}
        
        for (const m of MONTHS) {
          const valKey = `m${m.month}_value`
          const amount = cell.months?.[valKey] ?? cell[valKey] ?? (Number(cell.month) === m.month ? cell.amount : 0)

          if (amount !== undefined && amount !== null && amount !== 0) {
            if (!seed[code][m.key]) seed[code][m.key] = {}
            seed[code][m.key][unitId] = String(amount)
          }
        }
      }

      setValuesByCode(normalizeGrid(seed))
    } catch (e) {
      console.error("Load saved failed:", e)
      setValuesByCode(normalizeGrid({}))
    } finally {
      setIsLoadingSaved(false)
    }
  }, [effectivePlanId, effectiveBranchId, itemRows, unitCols, normalizeGrid])

  useEffect(() => {
    loadSavedFromBE()
  }, [loadSavedFromBE])

  const setCell = useCallback((code, monthKey, unitId, nextValue) => {
    setValuesByCode((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        [monthKey]: {
          ...(prev[code]?.[monthKey] || {}),
          [unitId]: nextValue
        }
      }
    }))
  }, [])
  
  const computed = useMemo(() => {
    const rowSums = {}
    const monthUnitSums = {}
    const unitGrandSums = {}
    let grandTotal = 0

    for (const m of MONTHS) {
      monthUnitSums[m.key] = {}
      for (const u of unitCols) monthUnitSums[m.key][u.id] = 0
    }
    for (const u of unitCols) unitGrandSums[u.id] = 0

    for (const r of itemRows) {
      rowSums[r.code] = {}
      for (const u of unitCols) {
        let sum = 0
        for (const m of MONTHS) {
          const v = toNumber(valuesByCode[r.code]?.[m.key]?.[u.id])
          monthUnitSums[m.key][u.id] += v
          sum += v
        }
        rowSums[r.code][u.id] = sum
        unitGrandSums[u.id] += sum
        grandTotal += sum
      }
    }

    return { rowSums, monthUnitSums, unitGrandSums, grandTotal }
  }, [valuesByCode, itemRows, unitCols])

  const sidebarOpen = useSidebarOpen()
  const tableWrapRef = useRef(null)
  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)
  useEffect(() => {
    const recalc = () => {
      const el = tableCardRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setTableCardHeight(Math.max(400, Math.floor(window.innerHeight - rect.top - 6)))
    }
    recalc()
    window.addEventListener("resize", recalc)
    return () => window.removeEventListener("resize", recalc)
  }, [])
  const inputRefs = useRef(new Map())

  const registerInput = useCallback((rIdx, cIdx) => (el) => {
    const key = `${rIdx}|${cIdx}`
    if (!el) inputRefs.current.delete(key)
    else inputRefs.current.set(key, el)
  }, [])

  const ensureInView = useCallback((el) => {
    const container = tableWrapRef.current
    if (!container || !el) return
    const pad = 20
    const frozenLeft = LEFT_W
    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()
    const visibleLeft = crect.left + frozenLeft + pad
    const visibleRight = crect.right - pad
    if (erect.left < visibleLeft) container.scrollLeft -= (visibleLeft - erect.left)
    else if (erect.right > visibleRight) container.scrollLeft += (erect.right - visibleRight)
    if (erect.top < crect.top + pad) container.scrollTop -= (crect.top + pad - erect.top)
    else if (erect.bottom > crect.bottom - pad) container.scrollTop += (erect.bottom - (crect.bottom - pad))
  }, [])

  const handleArrowNav = useCallback((e) => {
    const k = e.key
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(k)) return
    const rIdx = Number(e.currentTarget.dataset.row ?? 0)
    const cIdx = Number(e.currentTarget.dataset.col ?? 0)
    const totalCols = MONTHS.length * unitCols.length
    let nextR = rIdx, nextC = cIdx

    if (k === "ArrowLeft") {
      if (cIdx === 0) {
        if (rIdx > 0) { nextR = rIdx - 1; nextC = totalCols - 1 }
      } else nextC = cIdx - 1
    }
    if (k === "ArrowRight" || k === "Enter") {
      if (cIdx === totalCols - 1) {
        if (rIdx < itemRows.length - 1) { nextR = rIdx + 1; nextC = 0 }
      } else nextC = cIdx + 1
    }
    if (k === "ArrowUp") nextR = Math.max(0, rIdx - 1)
    if (k === "ArrowDown") nextR = Math.min(itemRows.length - 1, rIdx + 1)

    const target = inputRefs.current.get(`${nextR}|${nextC}`)
    if (target) {
      e.preventDefault(); target.focus()
      try { target.select() } catch {}
      requestAnimationFrame(() => ensureInView(target))
    }
  }, [itemRows.length, unitCols.length, ensureInView])

  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const buildBulkRowsForBE = useCallback(() => {
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error("FE: plan_id ไม่ถูกต้อง")
    if (!effectiveBranchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    if (!unitCols.length || unitCols[0].id === 0) throw new Error("FE: ไม่พบหน่วยในสาขา")
    
    const rows = []

    for (const r of itemRows) {
      const businessCostId = Number(r.business_cost_id || 0)
      if (!businessCostId) continue

      const rowData = valuesByCode[r.code] || {}
      for (const u of unitCols) {
          if (u.id <= 0) continue

          const monthsData = {
              m1_value: 0, m2_value: 0, m3_value: 0, m4_value: 0,
              m5_value: 0, m6_value: 0, m7_value: 0, m8_value: 0,
              m9_value: 0, m10_value: 0, m11_value: 0, m12_value: 0
          }

          let hasValue = false
          for (const m of MONTHS) {
              const amount = toNumber(rowData?.[m.key]?.[u.id])
              if (amount !== 0) hasValue = true
              monthsData[`m${m.month}_value`] = amount
          }

          if (hasValue) {
              rows.push({
                  unit_id: u.id,
                  b_cost: businessCostId,
                  months: monthsData
              })
          }
      }
    }

    return { rows }
  }, [effectivePlanId, effectiveBranchId, itemRows, valuesByCode, unitCols])

  const saveToBE = async () => {
    try {
        setNotice(null)
        const token = getToken()
        if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

        const built = buildBulkRowsForBE()
        setIsSaving(true)

        const res = await apiAuth(`/business-plan/${effectivePlanId}/costs/monthly?branch_id=${effectiveBranchId}`, {
            method: "POST",
            body: built,
        })

        setNotice({
            type: "success",
            title: "บันทึกสำเร็จ ✅",
            detail: `plan_id=${effectivePlanId} • สาขา ${effectiveBranchName} • บันทึก ${res?.monthly_rows_upserted ?? built.rows.length} รายการ`,
        })

        await loadSavedFromBE()

    } catch (e) {
        const status = e?.status || 0
        let title = "บันทึกไม่สำเร็จ ❌"
        let detail = e?.message || String(e)
        if (status === 422) {
            title = "422 Validation Error"
            detail = "ข้อมูลไม่ถูกต้อง (ดู console)"
        } else if (status === 400) {
            title = "400 Bad Request"
            detail = "ข้อมูลไม่ตรงกับข้อมูลรายปี"
        }
        setNotice({ type: "error", title, detail })
        console.error("Save Error:", e)
    } finally {
        setIsSaving(false)
    }
  }

  const RIGHT_W = (MONTHS.length * unitCols.length * COL_W.cell) + (unitCols.length * COL_W.total)
  const TOTAL_W = LEFT_W + RIGHT_W

  return (
    <>
      <div ref={tableCardRef} className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col" style={{ maxHeight: tableCardHeight }}>
        <div className="flex-1 overflow-auto" ref={tableWrapRef}>
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {MONTHS.map(m => unitCols.map(u => <col key={`${m.key}-${u.id}`} style={{ width: COL_W.cell }} />))}
              {unitCols.map(u => <col key={`total-${u.id}`} style={{ width: COL_W.total }} />)}
            </colgroup>

            <thead className="sticky top-0 z-20">
              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                <th rowSpan={2} className="border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600 sticky left-0 z-10 bg-slate-100 dark:bg-slate-700">รหัส</th>
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-left font-bold text-xs dark:border-slate-600 sticky left-[60px] z-10 bg-slate-100 dark:bg-slate-700">รายการ</th>
                {MONTHS.map((m, mIdx) => (
                    <th key={m.key} colSpan={unitCols.length} className={cx("border border-slate-300 px-1 py-2 text-center text-xs font-semibold dark:border-slate-600", monthStripeHead(mIdx))}>{m.label}</th>
                ))}
                <th colSpan={unitCols.length} className="border border-slate-300 px-1 py-2 text-center text-xs font-extrabold dark:border-slate-600 bg-slate-100 dark:bg-slate-700">รวม</th>
              </tr>
              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                {MONTHS.map((m, mIdx) => unitCols.map(u => (
                    <th key={`${m.key}-${u.id}`} className={cx("border border-slate-300 px-1 py-1 text-center text-[12px] font-medium dark:border-slate-600", monthStripeHead(mIdx))} title={u.name}>{u.name}</th>
                )))}
                {unitCols.map(u => (
                    <th key={`total-h-${u.id}`} className="border border-slate-300 px-1 py-1 text-center text-[12px] font-semibold dark:border-slate-600 bg-slate-100 dark:bg-slate-700" title={u.name}>{u.name}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayRows.map((r, rIdx) => {
                if (r.kind === "section") {
                  return (
                    <tr key={r.code} className="bg-slate-200 dark:bg-slate-700">
                      <td className="border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600 sticky left-0 z-10 bg-slate-200 dark:bg-slate-700">{r.code}</td>
                      <td colSpan={MONTHS.length * unitCols.length + unitCols.length + 1} className="border border-slate-300 px-2 py-2 font-extrabold text-xs dark:border-slate-600 sticky left-[60px] z-10 bg-slate-200 dark:bg-slate-700">{r.label}</td>
                    </tr>
                  )
                }

                const itemIndex = itemRows.findIndex(x => x.code === r.code)
                const rowBg = itemIndex % 2 === 1 ? STRIPE.alt : STRIPE.cell

                return (
                  <tr key={r.code} className={rowBg}>
                    <td className={cx("border border-slate-300 px-1 py-2 text-center text-xs dark:border-slate-600 sticky left-0 z-10", rowBg)}>{r.code}</td>
                    <td className={cx("border border-slate-300 px-2 py-2 text-left font-semibold text-xs dark:border-slate-600 sticky left-[60px] z-10", rowBg, trunc)} title={r.label}>{r.label}</td>
                    
                    {MONTHS.map((m, mIdx) => unitCols.map((u, ui) => {
                        const colIdx = mIdx * unitCols.length + ui
                        return (
                          <td key={`${r.code}-${m.key}-${u.id}`} className={cx("border border-slate-300 px-1 py-1 dark:border-slate-600", monthStripeCell(mIdx))}>
                            <input
                                ref={registerInput(itemIndex, colIdx)}
                                data-row={itemIndex} data-col={colIdx}
                                onKeyDown={handleArrowNav}
                                className={cellInput}
                                value={valuesByCode?.[r.code]?.[m.key]?.[u.id] ?? ""}
                                inputMode="decimal"
                                placeholder="0"
                                disabled={!branchId || u.id <= 0}
                                onChange={(e) => setCell(r.code, m.key, u.id, sanitizeNumberInput(e.target.value, { maxDecimals: 2 }))}
                            />
                          </td>
                        )
                    }))}

                    {unitCols.map(u => (
                        <td key={`total-${r.code}-${u.id}`} className={cx("border border-slate-300 px-1.5 py-1 text-right font-semibold text-xs dark:border-slate-600", rowBg)}>
                            {fmtMoney0(computed.rowSums[r.code]?.[u.id] ?? 0)}
                        </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
                <tr className={cx("text-slate-900 dark:text-slate-100", STRIPE.foot)}>
                    <td colSpan={2} className="border border-slate-300 px-2 py-2 text-center font-extrabold dark:border-slate-600 sticky left-0 z-10 bg-emerald-100 dark:bg-emerald-900">รวมทั้งหมด</td>
                    {MONTHS.map((m, mIdx) => unitCols.map(u => (
                        <td key={`tf-${m.key}-${u.id}`} className={cx("border border-slate-300 px-1.5 py-1 text-right font-bold text-xs dark:border-slate-600", monthStripeCell(mIdx))}>
                            {fmtMoney0(computed.monthUnitSums[m.key][u.id])}
                        </td>
                    )))}

                    {unitCols.map(u => (
                        <td key={`tf-total-${u.id}`} className="border border-slate-300 px-1.5 py-1 text-right font-bold text-xs dark:border-slate-600 bg-emerald-100 dark:bg-emerald-900">
                            {fmtMoney0(computed.unitGrandSums[u.id])}
                        </td>
                    ))}
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
            <div className="flex justify-end gap-3">
                <button
                type="button"
                onClick={loadSavedFromBE}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
                >
                รีเซ็ต
                </button>
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
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
            </div>
        </div>
      </div>
    <StickyTableScrollbar tableRef={tableWrapRef} sidebarOpen={sidebarOpen} />
    </>
  )
}

export default BusinessPlanExpenseServiceTableDetail