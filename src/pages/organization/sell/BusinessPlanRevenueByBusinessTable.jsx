import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import { useSidebarOpen } from "../../../components/AppLayout"
import { useBusinessEarnings } from "../../../lib/useBusinessList"

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
const fmtMoney0 = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

/** ---------------- API ---------------- */
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

const getToken = () => {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("auth_token") ||
    ""
  return String(raw || "").trim()
}

const buildAuthHeader = (tokenRaw) => {
  const t = String(tokenRaw || "").trim()
  if (!t) return {}
  if (t.toLowerCase().startsWith("bearer ")) return { Authorization: t }
  const cleaned = t.replace(/^bearer\s+/i, "").trim()
  return { Authorization: `Bearer ${cleaned}` }
}

async function apiAuth(path, { method = "GET", body } = {}) {
  if (!API_BASE) throw new ApiError("FE: ยังไม่ได้ตั้ง API Base (VITE_API_BASE...)", { status: 0 })
  const token = getToken()
  const url = `${API_BASE}${path}`
  let res
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...buildAuthHeader(token) },
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: "include",
    })
  } catch (e) {
    throw new ApiError("FE: เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (Network/CORS/DNS)", { status: 0, url, method, cause: e })
  }
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || (typeof data === "string" && data) || `HTTP ${res.status}`
    throw new ApiError(msg, { status: res.status, url, method, data })
  }
  return data
}

/** ---------------- UI styles ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-md border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

/** ---------------- Months (fiscal year: เม.ย. → มี.ค.) ---------------- */
const MONTHS = [
  { key: "m04", label: "เม.ย.", beKey: "m4_value" },
  { key: "m05", label: "พ.ค.", beKey: "m5_value" },
  { key: "m06", label: "มิ.ย.", beKey: "m6_value" },
  { key: "m07", label: "ก.ค.", beKey: "m7_value" },
  { key: "m08", label: "ส.ค.", beKey: "m8_value" },
  { key: "m09", label: "ก.ย.", beKey: "m9_value" },
  { key: "m10", label: "ต.ค.", beKey: "m10_value" },
  { key: "m11", label: "พ.ย.", beKey: "m11_value" },
  { key: "m12", label: "ธ.ค.", beKey: "m12_value" },
  { key: "m01", label: "ม.ค.", beKey: "m1_value" },
  { key: "m02", label: "ก.พ.", beKey: "m2_value" },
  { key: "m03", label: "มี.ค.", beKey: "m3_value" },
]

/** ---------------- Table layout ---------------- */
const COL_W = { code: 60, item: 240, cell: 82, total: 100 }
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  headEven: "bg-slate-100 dark:bg-slate-700",
  headOdd: "bg-slate-200 dark:bg-slate-600",
  cellEven: "bg-white dark:bg-slate-900",
  cellOdd: "bg-slate-50 dark:bg-slate-800",
  footEven: "bg-emerald-100 dark:bg-emerald-900",
  footOdd: "bg-emerald-200 dark:bg-emerald-800",
  section: "bg-slate-100/80 dark:bg-slate-800",
}

const monthStripeHead = (mi) => (mi % 2 === 1 ? STRIPE.headOdd : STRIPE.headEven)
const monthStripeCell = (mi) => (mi % 2 === 1 ? STRIPE.cellOdd : STRIPE.cellEven)

const FALLBACK_UNITS = [
  { id: 1, name: "สุรินทร์" },
  { id: 2, name: "โนนนารายณ์" },
]

/** ---------------- Rows builder (auto-generated from BE) ---------------- */
const buildRowsFromEarnings = (items) => {
  const rows = [{ code: "REV", label: "ประมาณการ รายได้เฉพาะธุรกิจ", kind: "title" }]

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
    rows.push({ code: sectionCode, label: `รายได้เฉพาะ ${g.name}`, kind: "section" })
    g.items.forEach((it, i) => {
      rows.push({ code: `${sectionCode}.${i + 1}`, kind: "item", business_earning_id: Number(it.id) })
    })
    rows.push({ code: `${sectionCode}.T`, label: `รวม${g.name}`, kind: "subtotal" })
  })

  return rows
}

/** state shape: { [rowCode]: { [monthKey]: { [unitId]: string } } } */
function buildInitialValues(unitIds, rows) {
  const out = {}
  rows.forEach((r) => {
    if (r.kind !== "item") return
    const row = {}
    MONTHS.forEach((m) => {
      row[m.key] = {}
      unitIds.forEach((uid) => { row[m.key][String(uid)] = "" })
    })
    out[r.code] = row
  })
  return out
}

/** =====================================================================
 * BusinessPlanRevenueByBusinessTable
 * ===================================================================== */
const BusinessPlanRevenueByBusinessTable = (props) => {
  const branchId = Number(props?.branchId ?? props?.branch_id ?? 0) || 0
  const branchName = String(props?.branchName ?? props?.branch_name ?? "").trim()
  const yearBE = props?.yearBE ?? props?.year_be ?? props?.year ?? null
  const planId = Number(props?.planId ?? props?.plan_id ?? 0) || 0

  const { items: businessEarnings, nameById: earningNameById } = useBusinessEarnings()

  const ROWS = useMemo(() => buildRowsFromEarnings(businessEarnings), [businessEarnings])

  const displayRows = useMemo(
    () => ROWS.map((r) => r.business_earning_id && earningNameById[r.business_earning_id] ? { ...r, label: earningNameById[r.business_earning_id] } : r),
    [ROWS, earningNameById]
  )

  const effectiveBranchName = branchName || (branchId ? `#${branchId}` : "— ยังไม่ได้เลือกสาขา —")
  const effectiveYear = yearBE ?? "-"
  const canEdit = !!branchId

  const [units, setUnits] = useState(FALLBACK_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const unitIds = useMemo(() => units.map((u) => Number(u.id)).filter((x) => x > 0), [units])
  const unitCols = useMemo(
    () => units.map((u) => ({ key: String(u.id), label: String(u.name || `หน่วย ${u.id}`) })),
    [units]
  )

  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [ROWS])

  const [valuesByCode, setValuesByCode] = useState(() =>
    buildInitialValues(unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id), [])
  )

  /** โหลดหน่วยตามสาขา */
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!branchId) { setUnits(FALLBACK_UNITS); return }
      setIsLoadingUnits(true)
      try {
        const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
        const rows = Array.isArray(data) ? data : []
        const normalized = rows
          .map((r, idx) => {
            const id = Number(r.id || 0)
            const name = r.unit_name || r.klang_name || r.unit || r.name || `หน่วย ${id || idx + 1}`
            return { id, name: String(name || "").trim() }
          })
          .filter((x) => x.id > 0)
        if (!alive) return
        setUnits(normalized.length ? normalized : FALLBACK_UNITS)
      } catch {
        if (!alive) return
        setUnits(FALLBACK_UNITS)
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()
    return () => { alive = false }
  }, [branchId])

  /** sync state เมื่อ units/ROWS เปลี่ยน */
  useEffect(() => {
    const ids = unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)
    setValuesByCode((prev) => {
      const next = buildInitialValues(ids, ROWS)
      for (const code of Object.keys(next)) {
        for (const m of MONTHS) {
          for (const uid of ids) {
            const k = String(uid)
            if (prev?.[code]?.[m.key]?.[k] !== undefined) next[code][m.key][k] = prev[code][m.key][k]
          }
        }
      }
      return next
    })
  }, [unitIds.join("|"), ROWS])

  const normalizeGrid = useCallback(
    (seed) => {
      const ids = unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)
      const out = buildInitialValues(ids, ROWS)
      for (const r of itemRows) {
        const code = r.code
        const rowSeed = seed?.[code] || {}
        for (const m of MONTHS) {
          for (const uid of ids) {
            const k = String(uid)
            if (rowSeed[m.key]?.[k] !== undefined) out[code][m.key][k] = String(rowSeed[m.key][k] ?? "")
          }
        }
      }
      return out
    },
    [itemRows, unitIds, ROWS]
  )

  /** โหลดข้อมูลรายเดือนจาก BE */
  const loadSavedFromBE = useCallback(async () => {
    if (!planId || planId <= 0 || !branchId || !units?.length) return
    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/business-plan/${planId}/earnings/monthly?branch_id=${Number(branchId)}`)
      const monthlyEarnings = Array.isArray(data?.monthly_earnings) ? data.monthly_earnings : []

      const beToCode = new Map()
      for (const r of itemRows) {
        const beId = Number(r.business_earning_id || 0)
        if (beId) beToCode.set(beId, r.code)
      }

      const seed = {}
      for (const entry of monthlyEarnings) {
        const uid = String(Number(entry.unit_id || 0))
        const bEarnId = Number(entry.b_earning || 0)
        const monthsData = entry.months || {}
        const code = beToCode.get(bEarnId)
        if (!code || !entry.unit_id) continue
        if (!seed[code]) seed[code] = {}
        for (const m of MONTHS) {
          if (!seed[code][m.key]) seed[code][m.key] = {}
          seed[code][m.key][uid] = String(monthsData[m.beKey] ?? 0)
        }
      }
      setValuesByCode(normalizeGrid(seed))
    } catch {
      setValuesByCode(normalizeGrid({}))
    } finally {
      setIsLoadingSaved(false)
    }
  }, [planId, branchId, units?.length, itemRows, normalizeGrid])

  useEffect(() => { loadSavedFromBE() }, [loadSavedFromBE])

  /** Arrow navigation */
  const inputRefs = useRef(new Map())
  const sidebarOpen = useSidebarOpen()
  const tableWrapRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)
  useEffect(() => {
    const recalc = () => {
      const el = tableWrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setTableCardHeight(Math.max(400, Math.floor(window.innerHeight - rect.top - 100)))
    }
    recalc()
    window.addEventListener("resize", recalc)
    return () => window.removeEventListener("resize", recalc)
  }, [])

  const registerInput = useCallback((rIdx, cIdx) => (el) => {
    const key = `${rIdx}|${cIdx}`
    if (!el) inputRefs.current.delete(key)
    else inputRefs.current.set(key, el)
  }, [])

  const ensureInView = useCallback((el) => {
    const container = tableWrapRef.current
    if (!container || !el) return
    const pad = 20
    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()
    const visibleLeft = crect.left + LEFT_W + pad
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
      if (cIdx === 0) { if (rIdx > 0) { nextR = rIdx - 1; nextC = totalCols - 1 } }
      else nextC = cIdx - 1
    }
    if (k === "ArrowRight" || k === "Enter") {
      if (cIdx === totalCols - 1) { if (rIdx < itemRows.length - 1) { nextR = rIdx + 1; nextC = 0 } }
      else nextC = cIdx + 1
    }
    if (k === "ArrowUp") nextR = Math.max(0, rIdx - 1)
    if (k === "ArrowDown") nextR = Math.min(itemRows.length - 1, rIdx + 1)
    const target = inputRefs.current.get(`${nextR}|${nextC}`)
    if (target) {
      e.preventDefault()
      target.focus()
      try { target.select() } catch {}
      requestAnimationFrame(() => ensureInView(target))
    }
  }, [itemRows.length, unitCols.length, ensureInView])

  /** Computed totals */
  const computed = useMemo(() => {
    const uids = unitCols.map((u) => u.key)

    const emptyMU = () => {
      const mu = {}
      for (const m of MONTHS) { mu[m.key] = {}; for (const uid of uids) mu[m.key][uid] = 0 }
      return mu
    }

    const rowTotal = {}
    for (const r of itemRows) {
      const row = valuesByCode[r.code] || {}
      let s = 0
      for (const m of MONTHS) for (const uid of uids) s += toNumber(row[m.key]?.[uid])
      rowTotal[r.code] = s
    }

    const sectionSum = (startCode, endCode) => {
      const mu = emptyMU()
      let total = 0
      for (const r of itemRows) {
        if (r.code < startCode || r.code > endCode) continue
        const row = valuesByCode[r.code] || {}
        for (const m of MONTHS) {
          for (const uid of uids) {
            const n = toNumber(row[m.key]?.[uid])
            mu[m.key][uid] += n
            total += n
          }
        }
      }
      return { mu, total }
    }

    const subtotals = {
      "1.T": sectionSum("1.1", "1.6"),
      "2.T": sectionSum("2.1", "2.4"),
      "3.T": sectionSum("3.1", "3.8"),
      "4.T": sectionSum("4.1", "4.11"),
      "5.T": sectionSum("5.1", "5.7"),
      "6.T": sectionSum("6.1", "6.3"),
    }

    const grandMU = emptyMU()
    let grand = 0
    for (const s of Object.values(subtotals)) {
      for (const m of MONTHS) for (const uid of uids) grandMU[m.key][uid] += s.mu[m.key]?.[uid] ?? 0
      grand += s.total
    }

    return { rowTotal, subtotals, grandMU, grand }
  }, [unitCols, valuesByCode, itemRows])

  const RIGHT_W = useMemo(() => MONTHS.length * (unitCols.length * COL_W.cell + COL_W.total) + COL_W.total, [unitCols.length])
  const TOTAL_W = useMemo(() => LEFT_W + RIGHT_W, [RIGHT_W])

  const setCell = (code, monthKey, unitId, raw) => {
    const v = sanitizeNumberInput(raw, { maxDecimals: 3 })
    setValuesByCode((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        [monthKey]: { ...(prev[code]?.[monthKey] || {}), [String(unitId)]: v },
      },
    }))
  }

  /** Save (monthly) */
  const [saveMsg, setSaveMsg] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const buildMonthlyPayload = () => {
    if (!planId || planId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (plan_id=${planId})`)
    if (!branchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    if (!units.length) throw new Error("FE: สาขานี้ไม่มีหน่วย หรือโหลดหน่วยไม่สำเร็จ")

    const rows = []
    const skipped = []
    const blocked = []

    for (const r of itemRows) {
      const businessEarningId = Number(r.business_earning_id || 0)
      const rowObj = valuesByCode[r.code] || {}

      let hasValue = false
      outer: for (const m of MONTHS) {
        for (const u of units) {
          if (toNumber(rowObj[m.key]?.[String(u.id)]) !== 0) { hasValue = true; break outer }
        }
      }

      if (!businessEarningId) {
        skipped.push({ code: r.code, label: r.label })
        if (hasValue) blocked.push(r.code)
        continue
      }

      for (const u of units) {
        const months = {}
        for (const m of MONTHS) months[m.beKey] = toNumber(rowObj[m.key]?.[String(u.id)])
        rows.push({ unit_id: Number(u.id), b_earning: Number(businessEarningId), months })
      }
    }

    if (blocked.length) throw new Error("FE: มีรายการยังไม่แมพ แต่คุณกรอกตัวเลขแล้ว: " + blocked.join(", "))
    return { rows, skipped }
  }

  const saveAll = async () => {
    try {
      setSaveMsg(null)
      const token = getToken()
      if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")
      const { rows, skipped } = buildMonthlyPayload()
      setIsSaving(true)
      const res = await apiAuth(`/business-plan/${planId}/earnings/monthly`, { method: "POST", body: { rows } })
      setSaveMsg({
        ok: true,
        title: "บันทึกสำเร็จ ✅",
        detail: `สาขา ${effectiveBranchName} • ปี ${effectiveYear} • rows=${res?.monthly_rows_upserted ?? rows.length}${skipped.length ? ` • skipped=${skipped.length}` : ""}`,
      })
    } catch (e) {
      setSaveMsg({ ok: false, title: "บันทึกไม่สำเร็จ", detail: e?.message || String(e) })
    } finally {
      setIsSaving(false)
    }
  }

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    const ids = unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)
    setValuesByCode(buildInitialValues(ids))
  }

  /** CSS Classes */
  const stickyShadow = "shadow-[0_0_0_1px_rgba(148,163,184,0.6)] dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]"
  const headCell = "px-1.5 py-1.5 text-[12px] font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-600 align-middle text-center"
  const cellClass = "px-1.5 py-1.5 text-[12px] border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 align-middle"
  const leftHeadCellCode = cx(headCell, "sticky left-0 z-20", stickyShadow)
  const leftHeadCellItem = cx(headCell, "sticky z-20 text-left", stickyShadow)
  const leftCellCode = cx(cellClass, "sticky left-0 z-10 text-center font-medium", stickyShadow)
  const leftCellItem = cx(cellClass, "sticky z-10 font-semibold", stickyShadow)
  const rowDivider = "border-b-[2px] border-b-slate-300 dark:border-b-slate-600"

  return (
    <>
    <div className="space-y-3 w-full p-3">
      {/* Header Info */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="text-[16px] font-bold">รายได้เฉพาะ</div>
          <div className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">
            หน่วย: พันบาท • ปี {effectiveYear} • สาขา {effectiveBranchName}
            {isLoadingSaved && <span className="ml-2 text-indigo-500">⏳ กำลังโหลด...</span>}
          </div>
          <div className="mt-4 max-w-xs">
            <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</label>
            <div className={cx(baseField, "flex items-center justify-between", !canEdit && "opacity-70")}>
              <span className="font-semibold">{effectiveBranchName}</span>
              <span className="text-sm text-slate-500 dark:text-slate-300">id: {branchId || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div
          className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700"
          ref={tableWrapRef}
          style={{ maxHeight: tableCardHeight }}
        >
          <table className="min-w-full border-collapse" style={{ width: TOTAL_W }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {MONTHS.map((m) => (
                <Fragment key={`cg-${m.key}`}>
                  {unitCols.map((u) => <col key={`cg-${m.key}-${u.key}`} style={{ width: COL_W.cell }} />)}
                  <col style={{ width: COL_W.total }} />
                </Fragment>
              ))}
              <col style={{ width: COL_W.total }} />
            </colgroup>

            <thead className="sticky top-0 z-30">
              {/* Row 1: Month super-headers */}
              <tr>
                <th className={cx(leftHeadCellCode, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={2}>
                  รหัส
                </th>
                <th className={cx(leftHeadCellItem, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")} style={{ left: COL_W.code }} rowSpan={2}>
                  รายการ
                </th>
                {MONTHS.map((m, mi) => (
                  <th key={`mh-${m.key}`} className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600")} colSpan={unitCols.length + 1}>
                    {m.label}
                  </th>
                ))}
                <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={2}>
                  รวมทั้งหมด
                </th>
              </tr>
              {/* Row 2: Unit sub-headers + per-month total */}
              <tr>
                {MONTHS.map((m, mi) => (
                  <Fragment key={`uh-${m.key}`}>
                    {unitCols.map((u) => (
                      <th key={`uh-${m.key}-${u.key}`} className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 text-[10px]")}>
                        {u.label.length <= 5 ? u.label : u.label.slice(0, 5)}
                      </th>
                    ))}
                    <th className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 text-[10px] text-emerald-700 dark:text-emerald-400")}>
                      รวม
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayRows.map((r, rowIdx) => {
                const isItem = r.kind === "item"
                const itemIndex = isItem ? itemRows.findIndex((x) => x.code === r.code) : -1
                const isUnmapped = isItem && !Number(r.business_earning_id || 0)

                let bg = STRIPE.cellEven
                let fontClass = "font-medium"
                if (r.kind === "title") { bg = STRIPE.headEven; fontClass = "font-extrabold text-slate-800 dark:text-white" }
                else if (r.kind === "section") { bg = STRIPE.section; fontClass = "font-bold text-slate-700 dark:text-slate-200" }
                else if (r.kind === "subtotal" || r.kind === "grandtotal") { bg = STRIPE.footEven; fontClass = "font-extrabold text-emerald-800 dark:text-emerald-300" }
                else if (rowIdx % 2 === 1) { bg = STRIPE.cellOdd }

                const bottomBorder = (r.kind === "section" || r.kind === "subtotal" || r.kind === "title")
                  ? rowDivider
                  : "border-b border-slate-200 dark:border-slate-700"

                if (!isItem) {
                  const s = r.kind === "subtotal" ? computed.subtotals[r.code]
                    : r.kind === "grandtotal" ? { mu: computed.grandMU, total: computed.grand }
                    : null
                  return (
                    <tr key={r.code} className={cx(bg, fontClass, bottomBorder)}>
                      <td className={cx(leftCellCode, bg)}>{r.kind === "title" ? "" : r.code}</td>
                      <td className={cx(leftCellItem, bg)} style={{ left: COL_W.code }}>{r.label}</td>
                      {MONTHS.map((m, mi) => (
                        <Fragment key={`${r.code}-${m.key}`}>
                          {unitCols.map((u) => (
                            <td key={`${r.code}-${m.key}-${u.key}`} className={cx(cellClass, monthStripeCell(mi), "text-right")}>
                              {s ? fmtMoney0(s.mu[m.key]?.[u.key] ?? 0) : ""}
                            </td>
                          ))}
                          <td className={cx(cellClass, monthStripeCell(mi), "text-right font-bold text-emerald-700 dark:text-emerald-400")}>
                            {s ? fmtMoney0(unitCols.reduce((acc, u) => acc + (s.mu[m.key]?.[u.key] ?? 0), 0)) : ""}
                          </td>
                        </Fragment>
                      ))}
                      <td className={cx(cellClass, "text-right")}>{s ? fmtMoney0(s.total ?? 0) : ""}</td>
                    </tr>
                  )
                }

                // Item Row
                const rowObj = valuesByCode[r.code] || {}
                return (
                  <tr key={r.code} className={cx(bg, fontClass, bottomBorder, isUnmapped && "bg-amber-50 dark:bg-amber-900/20")}>
                    <td className={cx(leftCellCode, bg, isUnmapped && "bg-amber-50 dark:bg-amber-900/20")}>{r.code}</td>
                    <td className={cx(leftCellItem, bg, isUnmapped && "bg-amber-50 dark:bg-amber-900/20")} style={{ left: COL_W.code }} title={isUnmapped ? "ยังไม่แมพ" : ""}>
                      {r.label} {isUnmapped && <span className="ml-1 text-[10px] text-amber-600">(ยังไม่แมพ)</span>}
                    </td>
                    {MONTHS.map((m, mi) => (
                      <Fragment key={`${r.code}-${m.key}`}>
                        {unitCols.map((u, ui) => {
                          const cIdx = mi * unitCols.length + ui
                          return (
                            <td key={`${r.code}-${m.key}-${u.key}`} className={cx(cellClass, monthStripeCell(mi))}>
                              <input
                                ref={registerInput(itemIndex, cIdx)}
                                data-row={itemIndex} data-col={cIdx}
                                onKeyDown={handleArrowNav}
                                className={cellInput}
                                inputMode="decimal"
                                value={rowObj[m.key]?.[u.key] ?? ""}
                                disabled={!canEdit}
                                onChange={(e) => setCell(r.code, m.key, u.key, e.target.value)}
                                placeholder="0"
                              />
                            </td>
                          )
                        })}
                        <td className={cx(cellClass, monthStripeCell(mi), "text-right font-bold text-emerald-700 dark:text-emerald-400")}>
                          {fmtMoney0(unitCols.reduce((acc, u) => acc + toNumber(rowObj[m.key]?.[u.key]), 0))}
                        </td>
                      </Fragment>
                    ))}
                    <td className={cx(cellClass, "text-right font-bold text-emerald-700 dark:text-emerald-400")}>
                      {fmtMoney0(computed.rowTotal[r.code] ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
          {saveMsg && (
            <div className={cx("mb-3 rounded-xl border p-3 text-[13px]",
              saveMsg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200"
            )}>
              <div className="font-bold">{saveMsg.title}</div>
              <div className="opacity-90 mt-0.5">{saveMsg.detail}</div>
            </div>
          )}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              รีเซ็ต
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={isSaving || !canEdit}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white transition",
                (isSaving || !canEdit)
                  ? "bg-slate-300 text-slate-700 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:scale-[1.03] active:scale-[.98] cursor-pointer"
              )}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </div>
    <StickyTableScrollbar tableRef={tableWrapRef} sidebarOpen={sidebarOpen} />
    </>
  )
}

export default BusinessPlanRevenueByBusinessTable
