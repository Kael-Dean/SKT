import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import { useSidebarOpen } from "../../../components/AppLayout"
import { useAuxCosts } from "../../../lib/useBusinessList"

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

const buildRowsFromAuxItems = (items) => {
  const rows = [{ code: "COGS", label: "ประมาณการต้นทุนสินค้า", kind: "title" }]

  const groupOrder = []
  const groups = new Map()
  for (const it of items) {
    const bgId = Number(it.business_group_id)
    if (!groups.has(bgId)) {
      groupOrder.push(bgId)
      groups.set(bgId, { name: String(it.business_group_name || ""), items: [] })
    }
    groups.get(bgId).items.push(it)
  }

  groupOrder.forEach((bgId, gi) => {
    const g = groups.get(bgId)
    const sectionCode = String(gi + 1)
    rows.push({ code: sectionCode, label: `ต้นทุนขาย ${g.name}`, kind: "section" })
    g.items.forEach((it, i) => {
      rows.push({ code: `${sectionCode}.${i + 1}`, kind: "item", aux_id: Number(it.id) })
    })
    rows.push({ code: `${sectionCode}.T`, label: `รวม${g.name}`, kind: "subtotal" })
  })

  rows.push({ code: "G.T", label: "รวมต้นทุน", kind: "grandtotal" })
  return rows
}

const PLACEHOLDER_UNITS = [{ id: 0, name: "—", short: "—" }]

/** ---------------- Table sizing ---------------- */
const COL_W = { code: 60, item: 300, cell: 100, total: 100 }
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  head: "bg-slate-100 dark:bg-slate-700",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  subtotal: "bg-emerald-100 dark:bg-emerald-900",
  grandtotal: "bg-emerald-200 dark:bg-emerald-800"
}
const monthStripeHead = (idx) => (idx % 2 === 1 ? "bg-slate-200 dark:bg-slate-600" : "bg-slate-100 dark:bg-slate-700");
const monthStripeCell = (idx) => (idx % 2 === 1 ? STRIPE.alt : STRIPE.cell);


const BusinessPlanRepCostSummaryTableDetail = ({ branchId, branchName, yearBE, planId }) => {
  const { items: auxItems, nameById: auxNameById } = useAuxCosts()

  const ROWS = useMemo(() => buildRowsFromAuxItems(auxItems), [auxItems])

  const displayRows = useMemo(
    () => ROWS.map((r) => r.aux_id && auxNameById[r.aux_id] ? { ...r, label: auxNameById[r.aux_id] } : r),
    [ROWS, auxNameById]
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

  /** ---------------- Units (columns) ---------------- */
  const [units, setUnits] = useState([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  useEffect(() => {
    if (!effectiveBranchId) {
      setUnits([])
      return
    }

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
        console.error("[AuxCost Units load] failed:", e)
        if (!alive) return
        setUnits([])
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [effectiveBranchId])
  
  const unitCols = useMemo(() => {
    if (!units.length) return PLACEHOLDER_UNITS
    return units
  }, [units])


  /** ---------------- Values (grid) ---------------- */
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
      // โหลดข้อมูล (พยายามรองรับ GET จาก /aux/monthly ในอนาคตด้วย)
      const data = await apiAuth(`/business-plan/${effectivePlanId}/aux/monthly?branch_id=${effectiveBranchId}`)
      
      const rowsData = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : [])

      const auxToCode = new Map()
      for (const r of itemRows) {
        if (r.aux_id) auxToCode.set(Number(r.aux_id), r.code)
      }

      const seed = {}
      for (const cell of rowsData) {
        const auxId = Number(cell.b_aux || cell.aux_id || cell.b_cost || 0)
        const unitId = Number(cell.unit_id || 0)
        
        const unit = unitCols.find(u => u.id === unitId)
        if (!auxId || !unit) continue

        const code = auxToCode.get(auxId)
        if (!code) continue

        if (!seed[code]) seed[code] = {}

        // Map ค่า m1_value ... m12_value กลับมาลงตาราง Frontend
        for (const m of MONTHS) {
            const valKey = `m${m.month}_value`
            const amount = Number(cell[valKey] ?? cell.months?.[valKey] ?? 0)
            
            if (amount !== 0) {
               if (!seed[code][m.key]) seed[code][m.key] = {}
               seed[code][m.key][unit.id] = String(amount)
            }
        }
      }

      setValuesByCode(normalizeGrid(seed))
    } catch (e) {
      console.error("[AuxCost Detail Load saved] failed:", e)
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
  
  const sectionMap = useMemo(() => {
    const m = {}
    const subtotals = ROWS.filter((r) => r.kind === "subtotal")
    for (const s of subtotals) {
      const prefix = s.code.replace(/\.T$/, "") + "."
      m[s.code] = ROWS.filter((r) => r.kind === "item" && r.code.startsWith(prefix)).map((r) => r.code)
    }
    return m
  }, [ROWS])

  const computed = useMemo(() => {
    const totals = {}
    
    for (const r of ROWS) {
        totals[r.code] = {
            byUnit: unitCols.reduce((acc, u) => ({...acc, [u.id]: 0}), {}),
            total: 0
        }
    }

    for (const r of itemRows) {
        let rowTotal = 0
        for (const u of unitCols) {
            let unitTotal = 0
            for (const m of MONTHS) {
                unitTotal += toNumber(valuesByCode[r.code]?.[m.key]?.[u.id])
            }
            totals[r.code].byUnit[u.id] = unitTotal
            rowTotal += unitTotal
        }
        totals[r.code].total = rowTotal
    }

    for (const subtotalCode of Object.keys(sectionMap)) {
        let grandSubTotal = 0
        for (const u of unitCols) {
            let unitSubTotal = 0
            for (const itemCode of sectionMap[subtotalCode]) {
                unitSubTotal += totals[itemCode].byUnit[u.id]
            }
            totals[subtotalCode].byUnit[u.id] = unitSubTotal
            grandSubTotal += unitSubTotal
        }
        totals[subtotalCode].total = grandSubTotal
    }

    let grandTotalValue = 0
    for (const u of unitCols) {
        let unitGrandTotal = 0
        for (const subtotalCode of Object.keys(sectionMap)) {
            unitGrandTotal += totals[subtotalCode].byUnit[u.id]
        }
        totals["G.T"].byUnit[u.id] = unitGrandTotal
        grandTotalValue += unitGrandTotal
    }
    totals["G.T"].total = grandTotalValue

    return totals
  }, [valuesByCode, itemRows, unitCols, sectionMap, ROWS])

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

  // 🔴 จุดสำคัญที่ 1: จัดโครงสร้าง Payload ใหม่ให้ตรงกับ Backend
  const buildBulkRowsForBE = useCallback(() => {
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error("FE: plan_id ไม่ถูกต้อง")
    if (!unitCols.length || unitCols[0].id === 0) throw new Error("FE: ไม่พบหน่วยในสาขา")
    
    const rows = []
    
    for (const r of itemRows) {
        if (!r.aux_id) continue

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
                
                // Map m.month (1-12) ไปเป็น m1_value ถึง m12_value
                monthsData[`m${m.month}_value`] = amount
            }

            if (hasValue) {
                rows.push({
                    unit_id: u.id,
                    b_aux: r.aux_id,
                    months: monthsData
                })
            }
        }
    }

    return { rows } // ส่งคีย์เป็น 'rows' ตรงกับ BE BulkSaveMonthlyAuxIn
  }, [effectivePlanId, itemRows, valuesByCode, unitCols])

  const saveToBE = async () => {
    let payload = null
    try {
        setNotice(null)
        const token = getToken()
        if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

        const built = buildBulkRowsForBE()
        payload = built
        setIsSaving(true)

        const res = await apiAuth(`/business-plan/${effectivePlanId}/aux/monthly?branch_id=${effectiveBranchId}`, {
            method: "POST", 
            body: payload,
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
            detail = "รูปแบบข้อมูลที่ส่งไปไม่ตรงกับที่ Backend รองรับ"
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
                const totalInfo = computed[r.code]
                const isSpecialRow = r.kind === 'subtotal' || r.kind === 'grandtotal'
                const rowBg = r.kind === 'grandtotal' ? STRIPE.grandtotal : r.kind === 'subtotal' ? STRIPE.subtotal : (rIdx % 2 === 1 ? STRIPE.alt : STRIPE.cell)
                const font = isSpecialRow ? 'font-extrabold' : ''

                if (r.kind === 'title' || r.kind === 'section') {
                    return (
                        <tr key={r.code} className="bg-slate-200 dark:bg-slate-700">
                          <td className="border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600 sticky left-0 z-10 bg-slate-200 dark:bg-slate-700">{r.kind==='section' ? r.code: ''}</td>
                          <td colSpan={MONTHS.length * unitCols.length + unitCols.length + 1} className="border border-slate-300 px-2 py-2 font-extrabold text-xs dark:border-slate-600 sticky left-[60px] z-10 bg-slate-200 dark:bg-slate-700">{r.label}</td>
                        </tr>
                    )
                }

                const itemIndex = r.kind === 'item' ? itemRows.findIndex(x => x.code === r.code) : -1

                return (
                  <tr key={r.code} className={cx(rowBg, font)}>
                    <td className={cx("border border-slate-300 px-1 py-2 text-center text-xs dark:border-slate-600 sticky left-0 z-10", rowBg)}>{isSpecialRow ? '' : r.code}</td>
                    <td className={cx("border border-slate-300 px-2 py-2 text-left font-semibold text-xs dark:border-slate-600 sticky left-[60px] z-10", rowBg, trunc)} title={r.label}>{r.label}</td>
                    
                    {MONTHS.map((m, mIdx) => unitCols.map((u, ui) => {
                        const colIdx = mIdx * unitCols.length + ui
                        return (
                          <td key={`${r.code}-${m.key}-${u.id}`} className={cx("border border-slate-300 px-1 py-1 dark:border-slate-600", monthStripeCell(mIdx))}>
                           {r.kind === 'item' ? (
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
                           ) : (
                               <div className="px-1.5 py-1 text-right text-xs">{fmtMoney0(totalInfo?.byUnit[u.id] ?? 0)}</div>
                           )}
                          </td>
                        )
                    }))}

                    {unitCols.map(u => (
                        <td key={`total-${r.code}-${u.id}`} className={cx("border border-slate-300 px-1.5 py-1 text-right font-semibold text-xs dark:border-slate-600", rowBg)}>
                            {fmtMoney0(totalInfo?.byUnit[u.id] ?? 0)}
                        </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
             <tfoot className="sticky bottom-0 z-20">
                <tr className={cx("text-slate-900 dark:text-slate-100", STRIPE.grandtotal)}>
                    <td colSpan={2} className="border border-slate-300 px-2 py-2 text-center font-extrabold dark:border-slate-600 sticky left-0 z-10 bg-emerald-200 dark:bg-emerald-800">รวมทั้งหมด</td>
                    {MONTHS.map((m, mIdx) => unitCols.map(u => {
                        let monthUnitTotal = 0;
                        for (const subtotalCode of Object.keys(sectionMap)) {
                            for(const itemCode of sectionMap[subtotalCode]) {
                                monthUnitTotal += toNumber(valuesByCode[itemCode]?.[m.key]?.[u.id])
                            }
                        }
                        return <td key={`tf-${m.key}-${u.id}`} className={cx("border border-slate-300 px-1.5 py-1 text-right font-bold text-xs dark:border-slate-600", monthStripeCell(mIdx))}>{fmtMoney0(monthUnitTotal)}</td>
                    }))}

                    {unitCols.map(u => (
                        <td key={`tf-total-${u.id}`} className="border border-slate-300 px-1.5 py-1 text-right font-bold text-xs dark:border-slate-600 bg-emerald-200 dark:bg-emerald-800">{fmtMoney0(computed["G.T"]?.byUnit[u.id] ?? 0)}</td>
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
                disabled={isSaving || !unitCols.length || unitCols[0].id === 0}
                onClick={saveToBE}
                className={cx(
                    "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white",
                    "shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 hover:scale-[1.03] active:scale-[.98] transition",
                    (isSaving || !unitCols.length || unitCols[0].id === 0) && "opacity-60 hover:scale-100 cursor-not-allowed"
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

export default BusinessPlanRepCostSummaryTableDetail