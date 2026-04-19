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
  import.meta.env.VITE_API_BASE_CUSTOM || import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || ""
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
}

const monthStripeHead = (mi) => (mi % 2 === 1 ? STRIPE.headOdd : STRIPE.headEven)
const monthStripeCell = (mi) => (mi % 2 === 1 ? STRIPE.cellOdd : STRIPE.cellEven)

const FALLBACK_UNITS = [{ id: 1, name: "หน่วย 1" }]

/** ---------------- Rows builder (auto-generated from BE, BG=7) ---------------- */
const BUSINESS_GROUP_ID = 7
const SECTION_CODE = "2"

const buildRowsFromEarnings = (items) => {
  const rows = []
  items.forEach((it, i) => {
    rows.push({
      code: `${SECTION_CODE}.${i + 1}`,
      kind: "item",
      business_earning_id: Number(it.id),
    })
  })
  return rows
}

/** state shape: { [rowCode]: { [monthKey]: { [unitId]: string } } } */
function buildInitialValues(unitIds, rows) {
  const out = {}
  for (const r of rows) {
    if (r.kind !== "item") continue
    const row = {}
    for (const m of MONTHS) {
      row[m.key] = {}
      for (const uid of unitIds) row[m.key][String(uid)] = ""
    }
    out[r.code] = row
  }
  return out
}

const normBranchName = (b) => String(b?.branch_name ?? b?.name ?? b?.label ?? b?.branch ?? "").trim()
const normBranchId = (b) => Number(b?.id ?? b?.branch_id ?? b?.value ?? 0) || 0
const normUnit = (u, idx = 0) => {
  const id = Number(u?.id ?? 0) || 0
  const name = u?.klang_name ?? u?.unit_name ?? u?.unit ?? u?.name ?? `หน่วย ${id || idx + 1}`
  return { id, name: String(name || "").trim() }
}

/** =====================================================================
 * BusinessPlanOtherIncomeTable
 * ===================================================================== */
const BusinessPlanOtherIncomeTable = (props) => {
  const {
    branchId, branch_id, branch, selectedBranch,
    branchName: pBranchName,
    yearBE, year_be, year,
    planId, plan_id,
  } = props || {}

  const { items: businessEarnings, nameById: earningNameById } = useBusinessEarnings(BUSINESS_GROUP_ID)
  const ROWS = useMemo(() => buildRowsFromEarnings(businessEarnings), [businessEarnings])
  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [ROWS])
  const displayRows = useMemo(
    () => ROWS.map((r) => r.business_earning_id && earningNameById[r.business_earning_id] ? { ...r, label: earningNameById[r.business_earning_id] } : r),
    [ROWS, earningNameById]
  )

  const [units, setUnits] = useState(FALLBACK_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const _pickNumber = useCallback((v) => {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
    const digits = String(v).match(/\d+/g)
    if (!digits) return null
    const nd = Number(digits.join(""))
    return Number.isFinite(nd) && nd > 0 ? nd : null
  }, [])

  const incomingBranchId = useMemo(() => {
    const cands = [branchId, branch_id, branch?.id, selectedBranch?.id, branch?.branch_id, selectedBranch?.branch_id]
    for (const c of cands) {
      const n = _pickNumber(c)
      if (n) return n
    }
    const ls = _pickNumber(localStorage.getItem("branch_id") || localStorage.getItem("selected_branch_id"))
    return ls || null
  }, [branchId, branch_id, branch, selectedBranch, _pickNumber])

  const [resolvedBranchId, setResolvedBranchId] = useState(null)
  const [resolvedBranchName, setResolvedBranchName] = useState(pBranchName || "")
  const branchIdEff = resolvedBranchId || incomingBranchId || null

  useEffect(() => { if (pBranchName) setResolvedBranchName(pBranchName) }, [pBranchName])

  useEffect(() => {
    if (incomingBranchId) { setResolvedBranchId(incomingBranchId); return }
    const name = String(pBranchName || resolvedBranchName || "").trim()
    if (!name) return
    let alive = true
    ;(async () => {
      try {
        let rows = null
        try {
          const data = await apiAuth(`/lists/branch/search?branch_name=${encodeURIComponent(name)}`)
          if (Array.isArray(data)) rows = data
          else if (Array.isArray(data?.items)) rows = data.items
        } catch {}
        if (!alive || !rows || !rows.length) return
        const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ")
        const target = norm(name)
        const found = rows.find((r) => norm(r.branch_name || r.name).includes(target)) || rows[0]
        const id = _pickNumber(found?.id || found?.branch_id)
        if (id) {
          setResolvedBranchId(id)
          setResolvedBranchName(found?.branch_name || found?.name || name)
        }
      } catch {}
    })()
    return () => { alive = false }
  }, [incomingBranchId, pBranchName, resolvedBranchName, _pickNumber])

  const canEdit = !!branchIdEff

  const effectivePlanId = useMemo(() => {
    const p = Number(planId || plan_id || 0)
    if (Number.isFinite(p) && p > 0) return p
    const y = Number(yearBE || year_be || year || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [planId, plan_id, yearBE, year_be, year])

  const effectiveYearBE = useMemo(() => {
    const y = Number(yearBE || year_be || year || 0)
    if (Number.isFinite(y) && y >= 2569) return y
    const p = Number(effectivePlanId || 0)
    return Number.isFinite(p) && p > 0 ? 2568 + p : 2569
  }, [yearBE, year_be, year, effectivePlanId])

  const effectiveBranchDisplay = resolvedBranchName || (branchIdEff ? `#${branchIdEff}` : "— ยังไม่ได้เลือกสาขา —")

  const unitIds = useMemo(() => units.map((u) => Number(u.id)).filter((x) => x > 0), [units])
  const unitCols = useMemo(
    () => units.map((u) => ({ key: String(u.id), label: String(u.name || `หน่วย ${u.id}`) })),
    [units]
  )

  const [valuesByCode, setValuesByCode] = useState(() =>
    buildInitialValues(unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id), [])
  )

  const rowIdByCode = useMemo(() => {
    const m = {}
    for (const r of itemRows) m[r.code] = Number(r.business_earning_id || 0) || null
    return m
  }, [itemRows])

  /** Load units for branch */
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!branchIdEff) { setUnits(FALLBACK_UNITS); return }
      setIsLoadingUnits(true)
      try {
        const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchIdEff)}`)
        const arr = Array.isArray(data) ? data : []
        const normalized = arr.map((u, idx) => normUnit(u, idx)).filter((x) => x.id > 0)
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
  }, [branchIdEff])

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
    [unitIds, ROWS, itemRows]
  )

  /** โหลดข้อมูลรายเดือนจาก BE */
  const loadSavedFromBE = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0 || !branchIdEff || !units?.length) return
    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/business-plan/${effectivePlanId}/earnings/monthly?branch_id=${Number(branchIdEff)}`)
      const monthlyEarnings = Array.isArray(data?.monthly_earnings) ? data.monthly_earnings : []

      const beToCode = new Map()
      for (const r of itemRows) {
        const beId = rowIdByCode[r.code]
        if (beId) beToCode.set(Number(beId), r.code)
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
  }, [effectivePlanId, branchIdEff, units?.length, normalizeGrid, rowIdByCode])

  useEffect(() => { loadSavedFromBE() }, [loadSavedFromBE])

  /** Arrow Navigation */
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

    const rowSum = {}
    const colSum = {}
    for (const m of MONTHS) {
      colSum[m.key] = {}
      for (const uid of uids) colSum[m.key][uid] = 0
    }

    for (const r of itemRows) {
      const row = valuesByCode[r.code] || {}
      let total = 0
      for (const m of MONTHS) {
        for (const uid of uids) {
          const v = toNumber(row[m.key]?.[uid])
          total += v
          colSum[m.key][uid] = (colSum[m.key][uid] || 0) + v
        }
      }
      rowSum[r.code] = { total }
    }

    let grand = 0
    for (const m of MONTHS) for (const uid of uids) grand += colSum[m.key][uid] || 0
    return { rowSum, colSum, grand }
  }, [valuesByCode, unitCols])

  const RIGHT_W = useMemo(() => MONTHS.length * (unitCols.length * COL_W.cell + COL_W.total) + COL_W.total, [unitCols.length])
  const TOTAL_W = useMemo(() => LEFT_W + RIGHT_W, [RIGHT_W])

  const setCell = (code, monthKey, unitId, raw) => {
    const nextVal = sanitizeNumberInput(raw, { maxDecimals: 3 })
    setValuesByCode((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        [monthKey]: { ...(prev[code]?.[monthKey] || {}), [String(unitId)]: nextVal },
      },
    }))
  }

  /** Save (monthly) */
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const buildMonthlyPayload = useCallback(() => {
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error("FE: plan_id ไม่ถูกต้อง")
    if (!branchIdEff) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    if (!units.length) throw new Error("FE: ยังไม่มีหน่วย")

    const rows = []
    const skipped = []
    const blocked = []

    for (const r of itemRows) {
      const beId = rowIdByCode[r.code]
      const rowObj = valuesByCode[r.code] || {}

      let hasValue = false
      outer: for (const m of MONTHS) {
        for (const u of units) {
          if (toNumber(rowObj[m.key]?.[String(u.id)]) !== 0) { hasValue = true; break outer }
        }
      }

      if (!beId) {
        skipped.push({ code: r.code, business_earning_id: r.business_earning_id })
        if (hasValue) blocked.push(r.code)
        continue
      }

      for (const u of units) {
        const months = {}
        for (const m of MONTHS) months[m.beKey] = toNumber(rowObj[m.key]?.[String(u.id)])
        rows.push({ unit_id: Number(u.id), b_earning: Number(beId), months })
      }
    }

    if (blocked.length) throw new Error("FE: มีแถวที่ยังไม่แมพ แต่กรอกตัวเลขแล้ว: " + blocked.join(", "))
    return { rows, skipped }
  }, [effectivePlanId, branchIdEff, units, rowIdByCode, valuesByCode])

  const onSave = useCallback(async () => {
    if (!canEdit) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const { rows, skipped } = buildMonthlyPayload()
      const res = await apiAuth(`/business-plan/${effectivePlanId}/earnings/monthly`, {
        method: "POST",
        body: { rows },
      })
      setSaveMsg({
        ok: true,
        title: "บันทึกสำเร็จ ✅",
        detail: `สาขา ${effectiveBranchDisplay} • ปี ${effectiveYearBE} • rows=${res?.monthly_rows_upserted ?? rows.length}${skipped.length ? ` • skipped=${skipped.length}` : ""}`,
      })
    } catch (e) {
      setSaveMsg({ ok: false, title: "บันทึกไม่สำเร็จ ❌", detail: e?.message || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }, [buildMonthlyPayload, effectivePlanId, canEdit, effectiveBranchDisplay, effectiveYearBE])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    const ids = unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)
    setValuesByCode(buildInitialValues(ids, ROWS))
  }

  /** CSS Classes */
  const stickyShadow = "shadow-[0_0_0_1px_rgba(148,163,184,0.6)] dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]"
  const headCell = "px-1.5 py-1.5 text-[12px] font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-600 align-middle text-center"
  const cellClass = "px-1.5 py-1.5 text-[12px] border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 align-middle"
  const leftHeadCellCode = cx(headCell, "sticky left-0 z-20", stickyShadow)
  const leftHeadCellItem = cx(headCell, "sticky z-20 text-left", stickyShadow)
  const leftCellCode = cx(cellClass, "sticky left-0 z-10 text-center font-medium", stickyShadow)
  const leftCellItem = cx(cellClass, "sticky z-10 font-semibold", stickyShadow)

  return (
    <>
    <div className="space-y-3 w-full p-3">
      {/* Header Info */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="text-[16px] font-bold">รายได้อื่นๆ</div>
          <div className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">
            หน่วย: พันบาท • ปี {effectiveYearBE || "-"} • สาขา {effectiveBranchDisplay}
            {isLoadingSaved && <span className="ml-2 text-indigo-500">⏳ กำลังโหลด...</span>}
          </div>
          <div className="mt-4 max-w-xs">
            <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</label>
            <div className={cx(baseField, "flex items-center justify-between", !canEdit && "opacity-70")}>
              <span className="font-semibold">{effectiveBranchDisplay}</span>
              <span className="text-sm text-slate-500 dark:text-slate-300">id: {branchIdEff || "—"}</span>
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
                      <th
                        key={`uh-${m.key}-${u.key}`}
                        className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 text-[9px] leading-[1.15] whitespace-normal break-words px-0.5")}
                        title={u.label}
                      >
                        {u.label}
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
                const isUnmapped = isItem && !rowIdByCode[r.code]

                const bg = rowIdx % 2 === 1 ? STRIPE.cellOdd : STRIPE.cellEven
                const bottomBorder = "border-b border-slate-200 dark:border-slate-700"

                if (!isItem) {
                  return (
                    <tr key={r.code} className={cx(bg, "font-medium", bottomBorder)}>
                      <td className={cx(leftCellCode, bg)}>{r.code}</td>
                      <td className={cx(leftCellItem, bg)} style={{ left: COL_W.code }}>{r.label}</td>
                      {MONTHS.map((m, mi) => (
                        <Fragment key={`${r.code}-${m.key}`}>
                          {unitCols.map((u) => (
                            <td key={`${r.code}-${m.key}-${u.key}`} className={cx(cellClass, monthStripeCell(mi), "text-right")}>
                              {fmtMoney0(computed.colSum[m.key]?.[u.key] ?? 0)}
                            </td>
                          ))}
                          <td className={cx(cellClass, monthStripeCell(mi), "text-right font-bold text-emerald-700 dark:text-emerald-400")}>
                            {fmtMoney0(unitCols.reduce((acc, u) => acc + (computed.colSum[m.key]?.[u.key] ?? 0), 0))}
                          </td>
                        </Fragment>
                      ))}
                      <td className={cx(cellClass, "text-right")}>{fmtMoney0(computed.grand ?? 0)}</td>
                    </tr>
                  )
                }

                // Item Row
                const rowObj = valuesByCode[r.code] || {}
                return (
                  <tr key={r.code} className={cx(bg, "font-medium", bottomBorder, isUnmapped && "bg-amber-50 dark:bg-amber-900/20")}>
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
                                className={cx(cellInput, !canEdit || isUnmapped ? "opacity-60 cursor-not-allowed" : "")}
                                inputMode="decimal"
                                value={rowObj[m.key]?.[u.key] ?? ""}
                                disabled={!canEdit || isUnmapped}
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
                      {fmtMoney0(computed.rowSum[r.code]?.total ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!canEdit && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-900">
            ยังไม่พบสาขา — กรุณาเลือกสาขาก่อน
          </div>
        )}

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
              onClick={onSave}
              disabled={saving || !canEdit}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white transition",
                (saving || !canEdit)
                  ? "bg-slate-300 text-slate-700 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:scale-[1.03] active:scale-[.98] cursor-pointer"
              )}
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </div>
    <StickyTableScrollbar tableRef={tableWrapRef} sidebarOpen={sidebarOpen} />
    </>
  )
}

export default BusinessPlanOtherIncomeTable
