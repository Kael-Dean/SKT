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
const fmtTimeTH = (d) =>
  d
    ? new Intl.DateTimeFormat("th-TH", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(d)
    : "—"

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

const readonlyField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black shadow-none dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100"

const cellInput =
  "w-full h-8 rounded-lg border border-slate-300 bg-white px-1 " +
  "text-right text-[12px] md:text-[13px] leading-4 outline-none tabular-nums " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const badgeOk =
  "inline-flex items-center rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-1 text-xs font-semibold dark:bg-emerald-900/40 dark:text-emerald-100"
const badgeWarn =
  "inline-flex items-center rounded-full bg-amber-100 text-amber-900 px-2.5 py-1 text-xs font-semibold dark:bg-amber-900/40 dark:text-amber-100"
const badgeErr =
  "inline-flex items-center rounded-full bg-rose-100 text-rose-900 px-2.5 py-1 text-xs font-semibold dark:bg-rose-900/40 dark:text-rose-100"

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

const PERIOD_DEFAULT = "2568"

/** Grid sizing: ทำให้ “เต็มกรอบ” */
const GRID = {
  code: "52px",
  item: "minmax(240px, 1.8fr)",
  unit: "minmax(72px, 1fr)",
  total: "minmax(78px, 0.9fr)",
}

/** fallback units (ถ้าโหลดหน่วยไม่ได้) */
const FALLBACK_UNITS = [{ id: 1, name: "หน่วย 1" }]

/** ---------------- Mapping: (earning_id + business_group) -> businessearnings.id ---------------- */
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
  { code: "2.1", label: "รายได้ดอกเบี้ยรับ", kind: "item", business_group: 7, earning_id: 24 },
  { code: "2.2", label: "รายได้เงินฝาก/ผลประโยชน์จากเงินฝาก", kind: "item", business_group: 7, earning_id: 25 },
  { code: "2.3", label: "รายได้ค่าธรรมเนียม", kind: "item", business_group: 7, earning_id: 26 },
  { code: "2.4", label: "รายได้จากการบริจาค", kind: "item", business_group: 7, earning_id: 5 }, // ⚠️ ถ้า BE ยังไม่มี mapping (5,7) จะ skip
  { code: "2.5", label: "รายได้เงินอุดหนุนจากรัฐ", kind: "item", business_group: 7, earning_id: 27 },
  { code: "2.6", label: "รายได้จากการรับรู้", kind: "item", business_group: 7, earning_id: 28 },
  { code: "2.7", label: "รายได้จากการขายซองประมูล", kind: "item", business_group: 7, earning_id: 29 },
  { code: "2.8", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 7, earning_id: 6 },
  { code: "2.T", label: "รวม", kind: "subtotal" },
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

/** ---------------- normalizers ---------------- */
const normBranchName = (b) => String(b?.branch_name ?? b?.name ?? b?.label ?? b?.branch ?? "").trim()
const normBranchId = (b) => Number(b?.id ?? b?.branch_id ?? b?.value ?? 0) || 0
const normUnit = (u, idx = 0) => {
  const id = Number(u?.id ?? 0) || 0
  const name = u?.klang_name ?? u?.unit_name ?? u?.unit ?? u?.name ?? `หน่วย ${id || idx + 1}`
  return { id, name: String(name || "").trim() }
}

const BusinessPlanOtherIncomeTable = (props) => {
  const planId = Number(props?.planId ?? props?.plan_id ?? 0) || 0
  const yearBE = props?.yearBE ?? props?.year_be ?? props?.year ?? null
  const initialBranchId = Number(props?.branchId ?? props?.branch_id ?? 0) || 0

  const [period, setPeriod] = useState(props?.periodLabel || props?.period_label || PERIOD_DEFAULT)

  /** dropdown branches */
  const [branches, setBranches] = useState([])
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const [branchId, setBranchId] = useState(initialBranchId)

  /** units become table columns */
  const [units, setUnits] = useState(FALLBACK_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  const unitIds = useMemo(() => units.map((u) => Number(u.id)).filter((x) => x > 0), [units])
  const cols = useMemo(
    () => units.map((u) => ({ key: String(u.id), label: String(u.name || `หน่วย ${u.id}`) })),
    [units]
  )

  const gridTemplate = useMemo(() => {
    return `${GRID.code} ${GRID.item} ${cols.map(() => GRID.unit).join(" ")} ${GRID.total}`
  }, [cols])

  const [valuesByCode, setValuesByCode] = useState(() =>
    buildInitialValues(unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id))
  )

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastLoadedAt, setLastLoadedAt] = useState(null)
  const [saveNotice, setSaveNotice] = useState(null)
  const [lastSaveMeta, setLastSaveMeta] = useState(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [showPayload, setShowPayload] = useState(false)

  const noticeTimerRef = useRef(0)
  const pushNotice = useCallback((notice, { autoHideMs = 0 } = {}) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setSaveNotice(notice || null)
    if (autoHideMs && autoHideMs > 0) noticeTimerRef.current = setTimeout(() => setSaveNotice(null), autoHideMs)
  }, [])
  useEffect(() => {
    return () => noticeTimerRef.current && clearTimeout(noticeTimerRef.current)
  }, [])

  const rowIdByCode = useMemo(() => {
    const m = {}
    for (const r of itemRows) m[r.code] = resolveBusinessEarningId(r.earning_id, r.business_group)
    return m
  }, [])

  const unmapped = useMemo(() => {
    const list = []
    for (const r of itemRows)
      if (!rowIdByCode[r.code]) list.push({ code: r.code, earning_id: r.earning_id, group: r.business_group })
    return list
  }, [rowIdByCode])

  /** load branches */
  useEffect(() => {
    let alive = true
    ;(async () => {
      setIsLoadingBranches(true)
      try {
        const data = await apiAuth(`/lists/branch/search`)
        const arr = Array.isArray(data) ? data : []
        const norm = arr.map((b) => ({ id: normBranchId(b), name: normBranchName(b) })).filter((x) => x.id > 0)
        if (!alive) return
        setBranches(norm)
        if (!branchId && norm.length) setBranchId(norm[0].id)
      } catch (e) {
        console.error("[OtherIncome branches] failed:", e)
      } finally {
        if (alive) setIsLoadingBranches(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** load units for selected branch */
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!branchId) {
        setUnits(FALLBACK_UNITS)
        return
      }
      setIsLoadingUnits(true)
      try {
        const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
        const arr = Array.isArray(data) ? data : []
        const normalized = arr.map((u, idx) => normUnit(u, idx)).filter((x) => x.id > 0)
        if (!alive) return
        setUnits(normalized.length ? normalized : FALLBACK_UNITS)
      } catch (e) {
        console.error("[OtherIncome units] failed:", e)
        if (!alive) return
        setUnits(FALLBACK_UNITS)
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [branchId])

  /** when units change -> preserve existing values */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const loadSavedFromBE = useCallback(async () => {
    if (!planId || planId <= 0) return
    if (!branchId) return
    if (!units?.length) return

    setLoading(true)
    setErrorMsg("")
    try {
      const data = await apiAuth(`/business-plan/${planId}/earnings?branch_id=${Number(branchId)}`)
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

      setValuesByCode(normalizeGrid(seed))
      setLastLoadedAt(new Date())
    } catch (e) {
      console.error("[OtherIncome loadSavedFromBE] failed:", e)
      setValuesByCode(normalizeGrid({}))
      setErrorMsg(e?.message || "โหลดข้อมูลล่าสุดไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [planId, branchId, units?.length, normalizeGrid, rowIdByCode])

  useEffect(() => {
    loadSavedFromBE()
  }, [loadSavedFromBE])

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

  const onChangeCell = (code, unitKey, raw) => {
    const nextVal = sanitizeNumberInput(raw, { maxDecimals: 3 })
    setValuesByCode((prev) => ({
      ...prev,
      [code]: { ...(prev[code] || {}), [unitKey]: nextVal },
    }))
  }

  const buildPayload = useCallback(() => {
    if (!planId || planId <= 0) throw new Error("FE: plan_id ไม่ถูกต้อง")
    if (!branchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
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
        branch_id: Number(branchId),
        business_earning_id: Number(beId),
        unit_values,
        branch_total,
        comment: period,
      })
    }

    if (blocked.length) throw new Error("FE: มีแถวที่ยังไม่แมพ แต่กรอกตัวเลขแล้ว: " + blocked.join(", "))
    return { rows, skipped }
  }, [planId, branchId, cols, period, rowIdByCode, valuesByCode])

  const onSave = useCallback(async () => {
    setSaving(true)
    setErrorMsg("")
    pushNotice(null)
    try {
      const payload = buildPayload()
      const res = await apiAuth(`/business-plan/${planId}/earnings/bulk`, {
        method: "POST",
        body: { rows: payload.rows },
      })

      setLastSaveMeta({ ok: true, at: new Date(), res })
      pushNotice(
        {
          type: "success",
          title: "บันทึกส่งไป BE สำเร็จ ✅",
          detail: `rows=${res?.rows ?? payload.rows.length} • unit_cells_upserted=${res?.unit_cells_upserted ?? "-"} • branch_totals_upserted=${res?.branch_totals_upserted ?? "-"}${
            payload?.skipped?.length ? ` • skipped=${payload.skipped.length}` : ""
          }`,
        },
        { autoHideMs: 0 }
      )
      await loadSavedFromBE()
    } catch (e) {
      console.error(e)
      const status = e?.status || 0
      let title = "บันทึกไม่สำเร็จ ❌"
      let detail = e?.message || "บันทึกไม่สำเร็จ"
      if (status === 401) {
        title = "401 Unauthorized"
        detail = "Token หมดอายุ/ไม่ผ่าน → Logout/Login ใหม่"
      } else if (status === 422) {
        title = "422 Validation Error"
        detail = "รูปแบบข้อมูลไม่ผ่าน schema ของ BE (ดู console)"
      }
      setLastSaveMeta({ ok: false, at: new Date(), res: { status, detail } })
      pushNotice({ type: "error", title, detail }, { autoHideMs: 0 })
      setErrorMsg(detail)
    } finally {
      setSaving(false)
    }
  }, [buildPayload, loadSavedFromBE, planId, pushNotice])

  const saveStatusPill = useMemo(() => {
    if (saving) return { cls: badgeWarn, text: "กำลังบันทึก..." }
    if (!lastSaveMeta) return { cls: "text-xs text-slate-500", text: "ยังไม่เคยบันทึก" }
    if (lastSaveMeta.ok) return { cls: badgeOk, text: `บันทึกล่าสุดสำเร็จ • ${fmtTimeTH(lastSaveMeta.at)}` }
    return { cls: badgeErr, text: `บันทึกล่าสุดไม่สำเร็จ • ${fmtTimeTH(lastSaveMeta.at)}` }
  }, [lastSaveMeta, saving])

  const loadStatusPill = useMemo(() => {
    if (loading || isLoadingUnits) return { cls: badgeWarn, text: "กำลังโหลดค่าล่าสุด..." }
    if (!lastLoadedAt) return { cls: "text-xs text-slate-500", text: "ยังไม่ได้โหลดจาก BE" }
    return { cls: badgeOk, text: `โหลดล่าสุด • ${fmtTimeTH(lastLoadedAt)}` }
  }, [loading, isLoadingUnits, lastLoadedAt])

  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(820)
  const recalcTableCardHeight = useCallback(() => {
    const el = tableCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 900
    setTableCardHeight(Math.max(640, Math.floor(vh - rect.top - 10)))
  }, [])
  useEffect(() => {
    recalcTableCardHeight()
    window.addEventListener("resize", recalcTableCardHeight)
    return () => window.removeEventListener("resize", recalcTableCardHeight)
  }, [recalcTableCardHeight])

  const onCopyPayload = useCallback(async () => {
    try {
      const p = buildPayload()
      await navigator.clipboard?.writeText(JSON.stringify({ rows: p.rows }, null, 2))
      pushNotice({ type: "success", title: "คัดลอกแล้ว ✅", detail: "คัดลอก payload (rows) แล้ว" }, { autoHideMs: 3500 })
    } catch (e) {
      pushNotice({ type: "error", title: "คัดลอกไม่สำเร็จ", detail: e?.message || String(e) }, { autoHideMs: 6000 })
    }
  }, [buildPayload, pushNotice])

  return (
    <div className="w-full px-3 md:px-6 pt-5 pb-3">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xl md:text-2xl font-bold">รายได้อื่นๆ</div>
          <div className="text-slate-600 dark:text-slate-300 text-sm">
            BE: <span className="font-mono">GET /business-plan/{`{plan_id}`}/earnings?branch_id=...</span> •{" "}
            <span className="font-mono">POST /business-plan/{`{plan_id}`}/earnings/bulk</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={saveStatusPill.cls}>{saveStatusPill.text}</span>
            <span className={loadStatusPill.cls}>{loadStatusPill.text}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:w-[980px]">
          <div>
            <div className="mb-1 text-sm text-slate-600 dark:text-slate-300">สาขา</div>
            <select
              className={baseField}
              value={branchId || ""}
              onChange={(e) => setBranchId(Number(e.target.value || 0))}
              disabled={isLoadingBranches}
            >
              {!branchId ? <option value="">— เลือกสาขา —</option> : null}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || `สาขา #${b.id}`}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-slate-500">
              {isLoadingBranches ? "กำลังโหลดสาขา..." : isLoadingUnits ? "กำลังโหลดหน่วยของสาขา..." : ""}
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm text-slate-600 dark:text-slate-300">ช่วงเวลา</div>
            <input className={baseField} value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>

          <div>
            <div className="mb-1 text-sm text-slate-600 dark:text-slate-300">plan_id</div>
            <div className={readonlyField}>{planId || "—"}</div>
          </div>

          <div className="flex items-end gap-2">
            <button
              className={cx(
                "w-full rounded-2xl px-4 py-3 font-semibold",
                "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950",
                "dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
                (loading || saving || !branchId) && "opacity-60 cursor-not-allowed"
              )}
              onClick={loadSavedFromBE}
              disabled={loading || saving || !branchId}
              title="โหลดค่าล่าสุดจาก BE"
            >
              {loading ? "กำลังโหลด..." : "โหลดล่าสุด"}
            </button>

            <button
              className={cx(
                "rounded-2xl px-4 py-3 font-semibold",
                "bg-white border border-slate-300 text-slate-900 hover:bg-slate-50",
                "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
              )}
              onClick={() => setShowPayload((s) => !s)}
            >
              ดู JSON
            </button>

            <button
              className={cx(
                "rounded-2xl px-4 py-3 font-semibold",
                "bg-white border border-slate-300 text-slate-900 hover:bg-slate-50",
                "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
              )}
              onClick={onCopyPayload}
              title="คัดลอก payload"
            >
              คัดลอก
            </button>
          </div>
        </div>
      </div>

      {unmapped.length > 0 && (
        <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="font-semibold">⚠️ รายการที่ยังไม่แมพ (ถ้ามีตัวเลขจะบันทึกไม่ได้)</div>
          <div className="mt-1 text-sm">
            {unmapped.map((u) => `${u.code} (earning_id=${u.earning_id}, group=${u.group})`).join(" • ")}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-900">
          <div className="text-sm">{errorMsg}</div>
        </div>
      )}

      {saveNotice && (
        <div
          className={cx(
            "mb-3 rounded-2xl border px-4 py-3",
            saveNotice.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : saveNotice.type === "error"
              ? "border-rose-300 bg-rose-50 text-rose-900"
              : "border-slate-200 bg-slate-50 text-slate-800"
          )}
        >
          <div className="font-semibold">{saveNotice.title}</div>
          {saveNotice.detail ? <div className="text-sm mt-0.5">{saveNotice.detail}</div> : null}
        </div>
      )}

      {/* ✅ ตาราง “เต็มกรอบ” + footer ชิดตาราง (ไม่มี gap) */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-sm overflow-hidden"
        style={{ height: tableCardHeight }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className={cx("border-b border-slate-200 dark:border-slate-700", STRIPE.head)}>
            <div className="grid items-center" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="px-2 py-2"></div>
              <div className="px-2 py-2 font-extrabold text-lg md:text-xl">รายการ</div>
              <div className="px-2 py-2 text-center font-semibold col-span-1" style={{ gridColumn: `span ${cols.length + 1}` }}>
                หน่วยของสาขา {yearBE ? `(ปี ${yearBE})` : ""}
              </div>
            </div>

            <div className="grid border-t border-slate-200 dark:border-slate-700 items-center" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="px-2 py-2"></div>
              <div className="px-2 py-2 font-semibold text-sm"></div>
              {cols.map((c) => (
                <div key={c.key} className="px-1 py-2 text-center font-semibold text-xs md:text-sm truncate" title={c.label}>
                  {c.label}
                </div>
              ))}
              <div className="px-1 py-2 text-center font-semibold text-xs md:text-sm">รวม</div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto">
            {ROWS.map((r, idx) => {
              const isAlt = idx % 2 === 1
              const rowBg = r.kind === "subtotal" ? STRIPE.foot : isAlt ? STRIPE.alt : STRIPE.cell
              const mapped = r.kind === "item" ? !!rowIdByCode[r.code] : true
              const rowH = r.kind === "item" ? "min-h-[44px]" : "min-h-[36px]"

              return (
                <div
                  key={r.code}
                  className={cx("grid border-b border-slate-200 dark:border-slate-700 items-center", rowBg, rowH)}
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div className="px-2 py-2 text-right font-semibold">{r.kind === "item" ? r.code : ""}</div>

                  <div className="px-2 py-2 font-semibold overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className={cx("text-[13px] md:text-sm whitespace-nowrap overflow-hidden text-ellipsis")}>{r.label}</span>
                      {r.kind === "item" && !mapped ? <span className={badgeWarn}>ยังไม่แมพ</span> : null}
                    </div>
                  </div>

                  {r.kind === "item" ? (
                    <>
                      {cols.map((c) => (
                        <div key={c.key} className="px-1 py-2">
                          <input
                            className={cx(cellInput, !mapped && "opacity-50 cursor-not-allowed")}
                            disabled={!mapped}
                            inputMode="decimal"
                            value={valuesByCode[r.code]?.[c.key] ?? ""}
                            onChange={(e) => onChangeCell(r.code, c.key, e.target.value)}
                          />
                        </div>
                      ))}
                      <div className="px-1 py-2 pr-3 text-right font-semibold tabular-nums">{fmtMoney0(computed.rowSum?.[r.code]?.total ?? 0)}</div>
                    </>
                  ) : (
                    <>
                      {cols.map((c) => (
                        <div key={c.key} className="px-1 py-2 text-right font-bold tabular-nums">
                          {fmtMoney0(computed.colSum?.[c.key] ?? 0)}
                        </div>
                      ))}
                      <div className="px-1 py-2 pr-3 text-right font-extrabold tabular-nums">{fmtMoney0(computed.grand)}</div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer (ชิดตาราง ไม่มีกั้น gap) */}
          <div
            className={cx(
              "border-t border-slate-200 dark:border-slate-700",
              STRIPE.foot,
              "shadow-[0_-8px_20px_-16px_rgba(0,0,0,0.35)]"
            )}
          >
            <div className="flex items-center justify-between px-3 py-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                plan_id=<span className="font-mono">{planId || "—"}</span> • branch_id=
                <span className="font-mono">{branchId || "—"}</span> • period=<span className="font-mono">{period}</span>
              </div>
              <button
                className={cx(
                  "rounded-2xl px-6 py-3 font-semibold",
                  "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
                disabled={saving || loading || !branchId}
                onClick={onSave}
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPayload && (
        <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Payload (rows)</div>
            <button
              className={cx(
                "rounded-2xl px-4 py-2 font-semibold",
                "bg-white border border-slate-300 text-slate-900 hover:bg-slate-50",
                "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
              )}
              onClick={onCopyPayload}
            >
              คัดลอก
            </button>
          </div>
          <pre className="mt-3 text-xs overflow-auto rounded-xl bg-slate-900 text-slate-50 p-3">
            {(() => {
              try {
                const p = buildPayload()
                return JSON.stringify({ rows: p.rows }, null, 2)
              } catch (e) {
                return String(e?.message || e)
              }
            })()}
          </pre>
        </div>
      )}
    </div>
  )
}

export default BusinessPlanOtherIncomeTable
