import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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

/** ---------------- Table definition ---------------- */
const PERIOD_DEFAULT = "2568"

const COL_W = { code: 60, item: 320, cell: 104, total: 110 }
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  headEven: "bg-slate-100 dark:bg-slate-700",
  headOdd: "bg-slate-200 dark:bg-slate-600",
  cellEven: "bg-white dark:bg-slate-900",
  cellOdd: "bg-slate-50 dark:bg-slate-800",
  footEven: "bg-emerald-100 dark:bg-emerald-900",
  footOdd: "bg-emerald-200 dark:bg-emerald-800",
}

const FALLBACK_UNITS = [{ id: 1, name: "หน่วย 1" }]

/** ---------------- Mapping ---------------- */
const BUSINESS_EARNINGS_SEED = [
  { id: 1, earning_id: 1, business_group: 1 },
  { id: 2, earning_id: 2, business_group: 1 },
  { id: 3, earning_id: 3, business_group: 1 },
  { id: 4, earning_id: 4, business_group: 1 },
  { id: 5, earning_id: 5, business_group: 1 },
  { id: 6, earning_id: 6, business_group: 1 },
  { id: 7, earning_id: 6, business_group: 2 },
  { id: 8, earning_id: 8, business_group: 2 },
  { id: 9, earning_id: 2, business_group: 2 },
  { id: 10, earning_id: 7, business_group: 2 },
  { id: 11, earning_id: 6, business_group: 3 },
  { id: 12, earning_id: 15, business_group: 3 },
  { id: 13, earning_id: 14, business_group: 3 },
  { id: 14, earning_id: 13, business_group: 3 },
  { id: 15, earning_id: 12, business_group: 3 },
  { id: 16, earning_id: 11, business_group: 3 },
  { id: 17, earning_id: 10, business_group: 3 },
  { id: 18, earning_id: 9, business_group: 3 },
  { id: 19, earning_id: 6, business_group: 4 },
  { id: 20, earning_id: 18, business_group: 4 },
  { id: 21, earning_id: 17, business_group: 4 },
  { id: 22, earning_id: 16, business_group: 4 },
  { id: 23, earning_id: 14, business_group: 4 },
  { id: 24, earning_id: 12, business_group: 4 },
  { id: 25, earning_id: 11, business_group: 4 },
  { id: 26, earning_id: 10, business_group: 4 },
  { id: 27, earning_id: 9, business_group: 4 },
  { id: 28, earning_id: 22, business_group: 4 },
  { id: 29, earning_id: 4, business_group: 4 },
  { id: 30, earning_id: 6, business_group: 5 },
  { id: 31, earning_id: 4, business_group: 5 },
  { id: 32, earning_id: 21, business_group: 5 },
  { id: 33, earning_id: 20, business_group: 5 },
  { id: 34, earning_id: 10, business_group: 5 },
  { id: 35, earning_id: 9, business_group: 5 },
  { id: 36, earning_id: 19, business_group: 5 },
  { id: 37, earning_id: 6, business_group: 7 },
  { id: 38, earning_id: 29, business_group: 7 },
  { id: 39, earning_id: 28, business_group: 7 },
  { id: 40, earning_id: 27, business_group: 7 },
  { id: 41, earning_id: 26, business_group: 7 },
  { id: 42, earning_id: 25, business_group: 7 },
  { id: 43, earning_id: 24, business_group: 7 },
  { id: 44, earning_id: 22, business_group: 7 },
  { id: 45, earning_id: 22, business_group: 8 },
  { id: 46, earning_id: 23, business_group: 8 },
  { id: 47, earning_id: 6, business_group: 8 },
]

const BUSINESS_EARNING_ID_MAP = (() => {
  const m = new Map()
  for (const r of BUSINESS_EARNINGS_SEED) {
    const key = `${Number(r.earning_id)}:${Number(r.business_group)}`
    if (!m.has(key)) m.set(key, Number(r.id))
  }
  return m
})()

const resolveBusinessEarningId = (earningId, businessGroupId) =>
  BUSINESS_EARNING_ID_MAP.get(`${Number(earningId)}:${Number(businessGroupId)}`) ?? null

/** ---------------- Rows ---------------- */
const ROWS = [
  { code: "2.1", label: "รายได้ดอกเบี้ยรับ", kind: "item", business_group: 7, earning_id: 22 },
  { code: "2.2", label: "รายได้เงินฝาก/ผลประโยชน์จากเงินฝาก", kind: "item", business_group: 7, earning_id: 25 },
  { code: "2.3", label: "รายได้ค่าธรรมเนียม", kind: "item", business_group: 7, earning_id: 24 },
  { code: "2.4", label: "เงินรางวัลจากการลงทุน-ทวีสิน", kind: "item", business_group: 7, earning_id: 26 },
  { code: "2.5", label: "รายได้เงินอุดหนุนจากรัฐ", kind: "item", business_group: 7, earning_id: 27 },
  { code: "2.6", label: "รายได้จากการรับรู้", kind: "item", business_group: 7, earning_id: 28 },
  { code: "2.7", label: "รายได้จากการขายซองประมูล", kind: "item", business_group: 7, earning_id: 29 },
  { code: "2.8", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 7, earning_id: 6 },
]
const itemRows = ROWS.filter((r) => r.kind === "item")

function buildInitialValues(unitIds) {
  const out = {}
  for (const r of itemRows) {
    const row = {}
    for (const uid of unitIds) row[String(uid)] = ""
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
    periodLabel, period_label 
  } = props || {}

  const [units, setUnits] = useState(FALLBACK_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  // 1) จัดการ ID ให้โหลดแบบยืดหยุ่นเหมือน ProcurementPlanDetail
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

  useEffect(() => {
    if (pBranchName) setResolvedBranchName(pBranchName)
  }, [pBranchName])

  useEffect(() => {
    if (incomingBranchId) {
      setResolvedBranchId(incomingBranchId)
      return
    }
    const name = String(pBranchName || resolvedBranchName || "").trim()
    if (!name) return
    let alive = true
    ;(async () => {
      try {
        const tryPaths = [`/lists/branch/search?branch_name=${encodeURIComponent(name)}`]
        let rows = null
        for (const path of tryPaths) {
          try {
            const data = await apiAuth(path)
            if (Array.isArray(data)) rows = data
            else if (Array.isArray(data?.items)) rows = data.items
            if (rows && rows.length) break
          } catch {}
        }
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

  const [period, setPeriod] = useState(periodLabel || period_label || PERIOD_DEFAULT)

  const unitIds = useMemo(() => units.map((u) => Number(u.id)).filter((x) => x > 0), [units])
  const cols = useMemo(
    () => units.map((u) => ({ key: String(u.id), label: String(u.name || `หน่วย ${u.id}`) })),
    [units]
  )

  const [valuesByCode, setValuesByCode] = useState(() =>
    buildInitialValues(unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id))
  )
  
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [showPayload, setShowPayload] = useState(false)

  const rowIdByCode = useMemo(() => {
    const m = {}
    for (const r of itemRows) m[r.code] = resolveBusinessEarningId(r.earning_id, r.business_group)
    return m
  }, [])

  const unmapped = useMemo(() => {
    const list = []
    for (const r of itemRows) if (!rowIdByCode[r.code]) list.push({ code: r.code, earning_id: r.earning_id, group: r.business_group })
    return list
  }, [rowIdByCode])

  /** Load units for branch */
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!branchIdEff) {
        setUnits(FALLBACK_UNITS)
        return
      }
      setIsLoadingUnits(true)
      try {
        const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchIdEff)}`)
        const arr = Array.isArray(data) ? data : []
        const normalized = arr.map((u, idx) => normUnit(u, idx)).filter((x) => x.id > 0)
        if (!alive) return
        setUnits(normalized.length ? normalized : FALLBACK_UNITS)
      } catch (e) {
        if (!alive) return
        setUnits(FALLBACK_UNITS)
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()
    return () => { alive = false }
  }, [branchIdEff])

  /** Preserve existing values on unit change */
  useEffect(() => {
    const ids = unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)
    setValuesByCode((prev) => {
      const next = buildInitialValues(ids)
      for (const code of Object.keys(next)) {
        const prevRow = prev?.[code] || {}
        for (const uid of ids) {
          const k = String(uid)
          if (prevRow[k] !== undefined) next[code][k] = prevRow[k]
        }
      }
      return next
    })
  }, [unitIds.join("|")])

  const normalizeGrid = useCallback(
    (seed) => {
      const ids = unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)
      const out = buildInitialValues(ids)
      for (const r of itemRows) {
        const code = r.code
        const rowSeed = seed?.[code] || {}
        for (const uid of ids) {
          const k = String(uid)
          if (rowSeed[k] !== undefined) out[code][k] = String(rowSeed[k] ?? "")
        }
      }
      return out
    },
    [unitIds]
  )

  // โหลดข้อมูลล่าสุด (ใช้ branchIdEff และ effectivePlanId ที่คำนวณใหม่)
  const loadSavedFromBE = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0 || !branchIdEff || !units?.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/business-plan/${effectivePlanId}/earnings?branch_id=${Number(branchIdEff)}`)
      const unitCells = Array.isArray(data?.unit_cells) ? data.unit_cells : []

      const beToCode = new Map()
      for (const r of itemRows) {
        const beId = rowIdByCode[r.code]
        if (beId) beToCode.set(Number(beId), r.code)
      }

      const seed = {}
      for (const cell of unitCells) {
        const uId = Number(cell.unit_id || 0)
        const bEarnId = Number(cell.business_earning_id || 0)
        const amount = Number(cell.amount || 0)
        if (!uId || !bEarnId) continue
        const code = beToCode.get(bEarnId)
        if (!code) continue
        if (!seed[code]) seed[code] = {}
        seed[code][String(uId)] = String(amount)
      }

      setValuesByCode(prev => normalizeGrid(seed))
    } catch (e) {
      setValuesByCode(prev => normalizeGrid({}))
    } finally {
      setIsLoadingSaved(false)
    }
  }, [effectivePlanId, branchIdEff, units?.length, normalizeGrid, rowIdByCode])

  useEffect(() => { loadSavedFromBE() }, [loadSavedFromBE])

  /** ---------------- Arrow Navigation Logic ---------------- */
  const inputRefs = useRef(new Map())
  const tableWrapRef = useRef(null)

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
    
    const totalCols = cols.length

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
      e.preventDefault()
      target.focus()
      try { target.select() } catch {}
      requestAnimationFrame(() => ensureInView(target))
    }
  }, [itemRows.length, cols.length, ensureInView])

  /** ---------------- Computed ---------------- */
  const computed = useMemo(() => {
    const rowSum = {}
    const colSum = {}
    for (const c of cols) colSum[c.key] = 0

    for (const r of itemRows) {
      const row = valuesByCode[r.code] || {}
      let total = 0
      for (const c of cols) {
        const v = toNumber(row[c.key])
        total += v
        colSum[c.key] = (colSum[c.key] || 0) + v
      }
      rowSum[r.code] = { total }
    }

    let grand = 0
    for (const c of cols) grand += colSum[c.key] || 0
    return { rowSum, colSum, grand }
  }, [valuesByCode, cols])

  const RIGHT_W = useMemo(() => cols.length * COL_W.cell + COL_W.total, [cols.length])
  const TOTAL_W = useMemo(() => LEFT_W + RIGHT_W, [RIGHT_W])

  const onChangeCell = (code, unitKey, raw) => {
    const nextVal = sanitizeNumberInput(raw, { maxDecimals: 3 })
    setValuesByCode((prev) => ({ ...prev, [code]: { ...(prev[code] || {}), [unitKey]: nextVal } }))
  }

  const buildPayload = useCallback(() => {
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error("FE: plan_id ไม่ถูกต้อง")
    if (!branchIdEff) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    if (!cols.length) throw new Error("FE: ยังไม่มีหน่วย")

    const rows = []
    const skipped = []
    const blocked = []

    for (const r of itemRows) {
      const beId = rowIdByCode[r.code]
      const row = valuesByCode[r.code] || {}

      let branch_total = 0
      const unit_values = cols.map((c) => {
        const amount = toNumber(row[c.key])
        branch_total += amount
        return { unit_id: Number(c.key), amount }
      })

      if (!beId) {
        skipped.push({ code: r.code, earning_id: r.earning_id, business_group: r.business_group })
        if (branch_total !== 0) blocked.push(r.code)
        continue
      }

      rows.push({
        branch_id: Number(branchIdEff),
        business_earning_id: Number(beId),
        unit_values,
        branch_total,
        comment: period,
      })
    }

    if (blocked.length) throw new Error("FE: มีแถวที่ยังไม่แมพ แต่กรอกตัวเลขแล้ว: " + blocked.join(", "))
    return { rows, skipped }
  }, [effectivePlanId, branchIdEff, cols, period, rowIdByCode, valuesByCode])

  const onSave = useCallback(async () => {
    if (!canEdit) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const payload = buildPayload()
      const res = await apiAuth(`/business-plan/${effectivePlanId}/earnings/bulk`, {
        method: "POST",
        body: { rows: payload.rows },
      })

      setSaveMsg({
        ok: true,
        title: "บันทึกสำเร็จ ✅",
        detail: `สาขา ${effectiveBranchDisplay} • ปี ${effectiveYearBE} • rows=${res?.rows ?? payload.rows.length}`,
      })
    } catch (e) {
      setSaveMsg({
        ok: false,
        title: "บันทึกไม่สำเร็จ ❌",
        detail: e?.message || "บันทึกไม่สำเร็จ",
      })
    } finally {
      setSaving(false)
    }
  }, [buildPayload, loadSavedFromBE, effectivePlanId, canEdit, effectiveBranchDisplay, effectiveYearBE])

  const onCopyPayload = useCallback(async () => {
    try {
      const p = buildPayload()
      await navigator.clipboard?.writeText(JSON.stringify({ rows: p.rows }, null, 2))
      alert("คัดลอก payload สำหรับ BE แล้ว ✅")
    } catch (e) {
      alert("คัดลอกไม่สำเร็จ: " + String(e))
    }
  }, [buildPayload])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    const ids = unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)
    setValuesByCode(buildInitialValues(ids))
  }

  /** ---------------- CSS Classes ---------------- */
  const stickyShadow = "shadow-[0_0_0_1px_rgba(148,163,184,0.6)] dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]"
  const headCell = "px-1.5 py-1.5 text-[12px] font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-600 align-middle text-center"
  const cellClass = "px-1.5 py-1.5 text-[12px] border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 align-middle"
  
  const leftHeadCellCode = cx(headCell, "sticky left-0 z-20", stickyShadow)
  const leftHeadCellItem = cx(headCell, "sticky z-20 text-left", stickyShadow)
  const leftCellCode = cx(cellClass, "sticky left-0 z-10 text-center font-medium", stickyShadow)
  const leftCellItem = cx(cellClass, "sticky z-10 font-semibold", stickyShadow)
  
  const rowDivider = "border-b-[2px] border-b-slate-300 dark:border-b-slate-600"
  const footerBorder = "border-t-[2px] border-t-emerald-500 dark:border-t-emerald-600"

  return (
    <div className="w-full space-y-3">
      {/* Header Info */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="text-[16px] font-bold">รายได้อื่นๆ</div>
          <div className="text-xl md:text-2xl font-extrabold">
            (เชื่อม BE: business-plan/earnings)
          </div>
          <div className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">
            หน่วย: พันบาท • ปี {effectiveYearBE || "-"} • สาขา {effectiveBranchDisplay}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3 max-w-3xl">
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ช่วงแผน</label>
              <input className={baseField} value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</label>
              <div className={cx(baseField, "flex items-center justify-between", !canEdit && "opacity-70")}>
                <span className="font-semibold">{effectiveBranchDisplay}</span>
                <span className="text-sm text-slate-500 dark:text-slate-300">id: {branchIdEff || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {unmapped.length > 0 && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <div className="font-extrabold">⚠️ รายการที่ยังไม่แมพ (จะข้ามตอนบันทึกถ้าเป็น 0)</div>
          <div className="mt-1 text-[12px] opacity-95">{unmapped.map((x) => `${x.code} (grp=${x.group})`).join(" • ")}</div>
        </div>
      )}

      {showPayload && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
          <pre className="max-h-72 overflow-auto">
            {(() => {
              try { return JSON.stringify({ rows: buildPayload().rows }, null, 2) } 
              catch (e) { return String(e?.message || e) }
            })()}
          </pre>
        </div>
      )}

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-[70vh]" ref={tableWrapRef}>
          <table className="min-w-full border-collapse" style={{ width: TOTAL_W }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {cols.map((c) => <col key={`c-${c.key}`} style={{ width: COL_W.cell }} />)}
              <col style={{ width: COL_W.total }} />
            </colgroup>
            
            <thead className="sticky top-0 z-30">
              <tr>
                <th className={cx(leftHeadCellCode, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>รหัส</th>
                <th className={cx(leftHeadCellItem, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")} style={{ left: COL_W.code }}>รายการ</th>
                {cols.map((c) => (
                  <th key={`th-${c.key}`} className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>{c.label}</th>
                ))}
                <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>รวม</th>
              </tr>
            </thead>
            
            <tbody>
              {ROWS.map((r, rowIdx) => {
                const isItem = r.kind === "item"
                const itemIndex = isItem ? itemRows.findIndex((x) => x.code === r.code) : -1
                const isUnmapped = isItem && !rowIdByCode[r.code]
                
                let bg = STRIPE.cellEven
                let fontClass = "font-medium"
                if (r.kind === "title") { bg = STRIPE.headEven; fontClass = "font-extrabold text-slate-800 dark:text-white" }
                else if (r.kind === "section") { bg = STRIPE.section; fontClass = "font-bold text-slate-700 dark:text-slate-200" }
                else if (r.kind === "subtotal" || r.kind === "grandtotal") { bg = STRIPE.footEven; fontClass = "font-extrabold text-emerald-800 dark:text-emerald-300" }
                else if (rowIdx % 2 === 1) { bg = STRIPE.cellOdd }

                const bottomBorder = (r.kind === "subtotal") ? rowDivider : "border-b border-slate-200 dark:border-slate-700"

                if (!isItem) {
                  return (
                    <tr key={r.code} className={cx(bg, fontClass, bottomBorder)}>
                      <td className={cx(leftCellCode, bg)}>{r.kind === "title" ? "" : r.code}</td>
                      <td className={cx(leftCellItem, bg)} style={{ left: COL_W.code }}>{r.label}</td>
                      {cols.map((c) => (
                        <td key={`${r.code}-${c.key}`} className={cx(cellClass, "text-right")}>
                          {fmtMoney0(computed.colSum?.[c.key] ?? 0)}
                        </td>
                      ))}
                      <td className={cx(cellClass, "text-right")}>{fmtMoney0(computed.grand ?? 0)}</td>
                    </tr>
                  )
                }

                // Item Row
                const v = valuesByCode[r.code] || {}
                return (
                  <tr key={r.code} className={cx(bg, fontClass, isUnmapped && "bg-amber-50 dark:bg-amber-900/20")}>
                    <td className={cx(leftCellCode, bg, isUnmapped && "bg-amber-50 dark:bg-amber-900/20")}>{r.code}</td>
                    <td className={cx(leftCellItem, bg, isUnmapped && "bg-amber-50 dark:bg-amber-900/20")} style={{ left: COL_W.code }} title={isUnmapped ? "ยังไม่แมพ" : ""}>
                      {r.label} {isUnmapped && <span className="ml-1 text-[10px] text-amber-600">(ยังไม่แมพ)</span>}
                    </td>
                    {cols.map((c, colIndex) => (
                      <td key={`${r.code}-${c.key}`} className={cellClass}>
                        <input
                          ref={registerInput(itemIndex, colIndex)}
                          data-row={itemIndex} data-col={colIndex}
                          onKeyDown={(e) => handleArrowNav(e)}
                          className={cx(cellInput, !canEdit || isUnmapped ? "opacity-60 cursor-not-allowed" : "")}
                          inputMode="decimal"
                          value={v[c.key] ?? ""}
                          disabled={!canEdit || isUnmapped}
                          onChange={(e) => onChangeCell(r.code, c.key, e.target.value)}
                          placeholder="0"
                        />
                      </td>
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

        {/* Action Buttons (ล่างขวา) */}
        <div className="shrink-0 pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
          {saveMsg && (
            <div className={cx("mb-3 rounded-xl border p-3 text-[13px]", saveMsg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200")}>
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
              onClick={() => setShowPayload((v) => !v)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              {showPayload ? "ซ่อน payload" : "ดู payload"}
            </button>

            <button
              type="button"
              onClick={onCopyPayload}
              disabled={!canEdit}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              คัดลอก JSON
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
  )
}

export default BusinessPlanOtherIncomeTable