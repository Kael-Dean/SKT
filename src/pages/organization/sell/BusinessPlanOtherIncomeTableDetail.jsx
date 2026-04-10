import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import { useSidebarOpen } from "../../../components/AppLayout"

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
const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] md:text-[13px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const trunc = "whitespace-nowrap overflow-hidden text-ellipsis"

/** ---------------- Mapping: (earning_id + business_group) -> businessearnings.id ---------------- */
const BUSINESS_EARNINGS_SEED = [
  { id: 37, earning_id: 6, business_group: 7 },
  { id: 38, earning_id: 29, business_group: 7 },
  { id: 39, earning_id: 28, business_group: 7 },
  { id: 40, earning_id: 27, business_group: 7 },
  { id: 41, earning_id: 26, business_group: 7 },
  { id: 42, earning_id: 25, business_group: 7 },
  { id: 43, earning_id: 24, business_group: 7 },
  { id: 44, earning_id: 22, business_group: 7 },
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

const resolveRowBusinessEarningId = (row) => {
  if (row?.business_earning_id) return Number(row.business_earning_id)
  if (!row?.earning_id || !row?.business_group) return null
  return resolveBusinessEarningId(row.earning_id, row.business_group)
}

/** ---------------- Rows (รายได้อื่นๆ) ---------------- */
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

/** ---------------- Table sizing ---------------- */
const COL_W = { code: 60, item: 280, unit: 130, total: 90 }
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  head: "bg-slate-100 dark:bg-slate-700",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100 dark:bg-emerald-900",
}

/** =====================================================================
 * BusinessPlanOtherIncomeTableDetail  (รายปี — ไม่มีเดือน)
 * ===================================================================== */
const BusinessPlanOtherIncomeTableDetail = ({ branchId, branchName, yearBE, planId }) => {
  const [earningNameById, setEarningNameById] = useState({})
  useEffect(() => {
    let alive = true
    apiAuth("/lists/earning-type-names").then((d) => { if (alive && d) setEarningNameById(d) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const displayRows = useMemo(
    () => ROWS.map((r) => r.earning_id && earningNameById[r.earning_id] ? { ...r, label: earningNameById[r.earning_id] } : r),
    [earningNameById]
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
          }))
          .filter((r) => r.id > 0)
        if (!alive) return
        setUnits(normalized)
      } catch {
        if (!alive) return
        setUnits([])
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()
    return () => { alive = false }
  }, [effectiveBranchId])

  /** ---------------- Values (rowCode → unitId → string) ---------------- */
  const [valuesByCode, setValuesByCode] = useState({})
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const normalizeGrid = useCallback(
    (seed = {}) => {
      const next = {}
      for (const r of itemRows) {
        const rowSeed = seed[r.code] || {}
        const keep = {}
        for (const u of units) keep[u.id] = rowSeed[u.id] ?? ""
        next[r.code] = keep
      }
      return next
    },
    [itemRows, units]
  )

  const loadSavedFromBE = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0 || !effectiveBranchId || !units.length) return
    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/business-plan/${effectivePlanId}/earnings?branch_id=${effectiveBranchId}`)
      const unitEarnings = Array.isArray(data?.unit_earnings) ? data.unit_earnings : []

      const beToCode = new Map()
      for (const r of itemRows) {
        const beId = resolveRowBusinessEarningId(r)
        if (beId) beToCode.set(Number(beId), r.code)
      }

      const seed = {}
      for (const cell of unitEarnings) {
        const uId = Number(cell.unit_id || 0)
        const bEarnId = Number(cell.business_earning_id || 0)
        const amount = Number(cell.amount || 0)
        if (!uId || !bEarnId) continue
        const code = beToCode.get(bEarnId)
        if (!code) continue
        if (!seed[code]) seed[code] = {}
        seed[code][uId] = String(amount)
      }

      setValuesByCode(normalizeGrid(seed))
    } catch {
      setValuesByCode(normalizeGrid({}))
    } finally {
      setIsLoadingSaved(false)
    }
  }, [effectivePlanId, effectiveBranchId, units.length, itemRows, normalizeGrid])

  useEffect(() => { setValuesByCode((prev) => normalizeGrid(prev)) }, [units, normalizeGrid])
  useEffect(() => { loadSavedFromBE() }, [loadSavedFromBE])

  const setCell = useCallback((code, unitId, nextValue) => {
    setValuesByCode((prev) => ({
      ...prev,
      [code]: { ...(prev[code] || {}), [unitId]: nextValue },
    }))
  }, [])

  /** ---------------- Computed totals ---------------- */
  const computed = useMemo(() => {
    const rowTotal = {}
    const unitTotal = {}
    let grand = 0
    for (const u of units) unitTotal[u.id] = 0
    for (const r of itemRows) {
      const row = valuesByCode[r.code] || {}
      let sum = 0
      for (const u of units) {
        const v = toNumber(row[u.id])
        unitTotal[u.id] += v
        sum += v
      }
      rowTotal[r.code] = sum
      grand += sum
    }
    return { rowTotal, unitTotal, grand }
  }, [valuesByCode, itemRows, units])

  /** ---------------- Height + Arrow nav ---------------- */
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

  const bodyScrollRef = useRef(null)
  const sidebarOpen = useSidebarOpen()
  const inputRefs = useRef(new Map())
  const totalCols = units.length

  const registerInput = useCallback((row, col) => (el) => {
    const key = `${row}|${col}`
    if (!el) inputRefs.current.delete(key)
    else inputRefs.current.set(key, el)
  }, [])

  const ensureInView = useCallback((el) => {
    const container = bodyScrollRef.current
    if (!container || !el) return
    const pad = 10
    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()
    const visibleLeft = crect.left + LEFT_W + pad
    const visibleRight = crect.right - pad
    if (erect.left < visibleLeft) container.scrollLeft -= visibleLeft - erect.left
    else if (erect.right > visibleRight) container.scrollLeft += erect.right - visibleRight
    if (erect.top < crect.top + pad) container.scrollTop -= crect.top + pad - erect.top
    else if (erect.bottom > crect.bottom - pad) container.scrollTop += erect.bottom - (crect.bottom - pad)
  }, [])

  const handleArrowNav = useCallback((e) => {
    const k = e.key
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(k)) return
    const row = Number(e.currentTarget.dataset.row ?? 0)
    const col = Number(e.currentTarget.dataset.col ?? 0)
    let nextRow = row, nextCol = col
    if (k === "ArrowLeft") {
      if (col === 0) { if (row > 0) { nextRow = row - 1; nextCol = totalCols - 1 } }
      else nextCol = col - 1
    }
    if (k === "ArrowRight" || k === "Enter") {
      if (col === totalCols - 1) { if (row < itemRows.length - 1) { nextRow = row + 1; nextCol = 0 } }
      else nextCol = col + 1
    }
    if (k === "ArrowUp") nextRow = Math.max(0, row - 1)
    if (k === "ArrowDown") nextRow = Math.min(itemRows.length - 1, row + 1)
    const target = inputRefs.current.get(`${nextRow}|${nextCol}`)
    if (!target) return
    e.preventDefault()
    target.focus()
    try { target.select() } catch {}
    requestAnimationFrame(() => ensureInView(target))
  }, [ensureInView, itemRows.length, totalCols])

  /** ---------------- Save ---------------- */
  const [saveNotice, setSaveNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const buildBulkRowsForBE = () => {
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (plan_id=${effectivePlanId})`)
    if (!effectiveBranchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    if (!units.length) throw new Error("FE: สาขานี้ไม่มีหน่วย หรือโหลดหน่วยไม่สำเร็จ")

    const rows = []
    const skipped = []
    const blocked = []

    for (const r of itemRows) {
      const businessEarningId = resolveRowBusinessEarningId(r)
      const rowObj = valuesByCode[r.code] || {}
      let rowSum = 0
      for (const u of units) rowSum += toNumber(rowObj[u.id])

      if (!businessEarningId) {
        skipped.push({ code: r.code, label: r.label })
        if (rowSum !== 0) blocked.push(r.code)
        continue
      }

      const unit_values = []
      let branch_total = 0
      for (const u of units) {
        const amount = toNumber(rowObj[u.id])
        branch_total += amount
        if (amount !== 0) unit_values.push({ unit_id: u.id, amount })
      }

      rows.push({
        branch_id: effectiveBranchId,
        business_earning_id: businessEarningId,
        unit_values,
        branch_total,
        comment: periodLabel,
      })
    }

    if (blocked.length) throw new Error("FE: มีรายการยังไม่แมพ แต่คุณกรอกตัวเลขแล้ว: " + blocked.join(", "))
    return { rows, skipped }
  }

  const saveToBE = async () => {
    try {
      setSaveNotice(null)
      const token = getToken()
      if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")
      const built = buildBulkRowsForBE()
      setIsSaving(true)
      const res = await apiAuth(`/business-plan/${effectivePlanId}/earnings/bulk`, {
        method: "POST",
        body: { rows: built.rows },
      })
      setSaveNotice({
        type: "success",
        title: "บันทึกสำเร็จ ✅",
        detail: `สาขา ${effectiveBranchName} • ปี ${effectiveYear} • upserted: ${res?.branch_totals_upserted ?? "-"}${built.skipped.length ? ` • skipped: ${built.skipped.length}` : ""}`,
      })
      await loadSavedFromBE()
    } catch (e) {
      const status = e?.status || 0
      let title = "บันทึกไม่สำเร็จ ❌"
      let detail = e?.message || String(e)
      if (status === 401) { title = "401 Unauthorized"; detail = "Token ไม่ผ่าน/หมดอายุ → Logout/Login ใหม่" }
      else if (status === 403) { title = "403 Forbidden"; detail = "สิทธิ์ไม่พอ (role ไม่อนุญาต)" }
      else if (status === 404) { title = "404 Not Found"; detail = `ไม่พบแผน — plan_id=${effectivePlanId}` }
      else if (status === 422) { title = "422 Validation Error"; detail = "รูปแบบข้อมูลไม่ผ่าน schema ของ BE (ดู console)" }
      setSaveNotice({ type: "error", title, detail })
      console.error("Save Error:", e)
    } finally {
      setIsSaving(false)
    }
  }

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    const empty = {}
    for (const r of itemRows) {
      const keep = {}
      for (const u of units) keep[u.id] = ""
      empty[r.code] = keep
    }
    setValuesByCode(empty)
    setSaveNotice({ type: "info", title: "ล้างข้อมูลแล้ว", detail: "รีเซ็ตค่าที่กรอกเป็นว่าง" })
  }

  /** widths */
  const RIGHT_W = Math.max(1, units.length) * COL_W.unit + COL_W.total
  const TOTAL_W = LEFT_W + RIGHT_W

  const stickyCodeHeader = "sticky left-0 z-[95] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyItemHeader = "sticky z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyCodeCell = "sticky left-0 z-[70] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  return (
    <div className="space-y-3 mx-auto p-3">
      {/* Info bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[15px] font-bold text-slate-800 dark:text-slate-100">รายได้อื่นๆ (รายปี)</div>
          <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            หน่วย: พันบาท • ปี {effectiveYear} ({periodLabel}) • สาขา {effectiveBranchName}
            {(isLoadingUnits || isLoadingSaved) && <span className="ml-2 text-indigo-500">⏳ กำลังโหลด...</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={resetAll}
            disabled={isSaving}
            className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[.97] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ล้างข้อมูล
          </button>
          <button
            type="button"
            onClick={saveToBE}
            disabled={isSaving || !effectiveBranchId || !units.length}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white active:scale-[.97] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className={cx(
          "rounded-xl border px-4 py-2.5 text-sm",
          saveNotice.type === "success" ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200" :
          saveNotice.type === "error" ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 text-red-800 dark:text-red-200" :
          "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        )}>
          <span className="font-semibold">{saveNotice.title}</span>
          {saveNotice.detail && <span className="ml-2 opacity-80">{saveNotice.detail}</span>}
        </div>
      )}

      {/* Table */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ maxHeight: tableCardHeight }}
      >
        <div ref={bodyScrollRef} className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700">
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {units.length ? units.map((u) => <col key={u.id} style={{ width: COL_W.unit }} />) : <col style={{ width: COL_W.unit }} />}
              <col style={{ width: COL_W.total }} />
            </colgroup>

            <thead className={cx("sticky top-0 z-[80]", STRIPE.head)}>
              <tr className="text-slate-800 dark:text-slate-100">
                <th rowSpan={2} className={cx("border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600", stickyCodeHeader)} />
                <th rowSpan={2} className={cx("border border-slate-300 px-2 py-2 text-left font-bold text-xs dark:border-slate-600", stickyItemHeader, trunc)} style={{ left: COL_W.code }}>
                  รายการ
                </th>
                <th
                  colSpan={(units.length || 1) + 1}
                  className={cx("border border-slate-300 px-2 py-2 text-center font-extrabold text-xs dark:border-slate-600", STRIPE.head)}
                >
                  <span className={trunc}>สกต. {effectiveBranchName}</span>
                </th>
              </tr>
              <tr className="text-slate-800 dark:text-slate-100">
                {units.length ? (
                  units.map((u) => (
                    <th key={u.id} className={cx("border border-slate-300 px-1 py-2 text-center text-[11px] md:text-xs dark:border-slate-600", STRIPE.head, trunc)} title={u.name}>
                      {u.name}
                    </th>
                  ))
                ) : (
                  <th className={cx("border border-slate-300 px-2 py-2 text-center text-xs dark:border-slate-600", STRIPE.head)}>
                    {isLoadingUnits ? "กำลังโหลด..." : "ไม่มีหน่วย"}
                  </th>
                )}
                <th className={cx("border border-slate-300 px-1 py-2 text-center text-[11px] md:text-xs font-extrabold dark:border-slate-600", STRIPE.head)}>
                  รวม
                </th>
              </tr>
            </thead>

            <tbody>
              {displayRows.map((r) => {
                const itemIndex = itemRows.findIndex((x) => x.code === r.code)
                const rowBg = itemIndex % 2 === 1 ? STRIPE.alt : STRIPE.cell

                return (
                  <tr key={r.code} className={rowBg}>
                    <td className={cx("border border-slate-300 px-1 py-2 text-center text-xs dark:border-slate-600", stickyCodeCell, rowBg)}>{r.code}</td>
                    <td className={cx("border border-slate-300 px-2 py-1 text-left text-xs dark:border-slate-600 sticky z-[55]", rowBg, trunc)} style={{ left: COL_W.code }} title={r.label}>
                      {r.label}
                    </td>
                    {units.length ? units.map((u, uIdx) => (
                      <td key={u.id} className={cx("border border-slate-300 dark:border-slate-600 px-1 py-1", rowBg)}>
                        <input
                          ref={registerInput(itemIndex, uIdx)}
                          data-row={itemIndex}
                          data-col={uIdx}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={valuesByCode?.[r.code]?.[u.id] ?? ""}
                          inputMode="decimal"
                          placeholder="0"
                          disabled={!effectiveBranchId}
                          onChange={(e) => setCell(r.code, u.id, sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))}
                        />
                      </td>
                    )) : (
                      <td className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-center text-xs text-slate-400">—</td>
                    )}
                    <td className={cx("border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-right font-semibold text-xs", rowBg)}>
                      {fmtMoney0(computed.rowTotal[r.code] ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-[80]">
              <tr className={cx("text-slate-900 dark:text-slate-100", STRIPE.foot)}>
                <td colSpan={2} className={cx("border border-slate-300 dark:border-slate-600 px-2 py-2 text-center font-extrabold text-xs sticky left-0 z-[90]", STRIPE.foot)}>
                  รวมทั้งหมด
                </td>
                {units.length ? units.map((u) => (
                  <td key={u.id} className={cx("border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-right font-bold text-xs", STRIPE.foot)}>
                    {fmtMoney0(computed.unitTotal[u.id] ?? 0)}
                  </td>
                )) : <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-right text-xs">—</td>}
                <td className={cx("border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-right font-extrabold text-xs", STRIPE.foot)}>
                  {fmtMoney0(computed.grand)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <StickyTableScrollbar scrollRef={bodyScrollRef} sidebarOpen={sidebarOpen} />
    </div>
  )
}

export default BusinessPlanOtherIncomeTableDetail
