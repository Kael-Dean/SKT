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
const readonlyField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black shadow-none dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100"

const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] md:text-[13px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const trunc = "whitespace-nowrap overflow-hidden text-ellipsis"

/** ---------------- Business group: (กำหนดให้ใช้ business_group / business_id = 8) ---------------- */
const BUSINESS_GROUP_ID = 8

/** ---------------- Mapping: cost_id + business_group -> businesscosts.id ----------------
 * จาก businesscosts.csv (business_group=8) id 181..230
 * ⚠️ cost_id=23 ซ้ำ 2 แถว (id 207,212) -> map จะเลือกตัวแรก (207) ถ้าอยากใช้ตัวที่สองค่อย override business_cost_id
 */
const BUSINESS_COSTS_SEED = [
  { id: 181, cost_id: 7, business_group: 8 },
  { id: 182, cost_id: 78, business_group: 8 },
  { id: 183, cost_id: 79, business_group: 8 },
  { id: 184, cost_id: 77, business_group: 8 },
  { id: 185, cost_id: 8, business_group: 8 },
  { id: 186, cost_id: 61, business_group: 8 },
  { id: 187, cost_id: 21, business_group: 8 },
  { id: 188, cost_id: 34, business_group: 8 },
  { id: 189, cost_id: 81, business_group: 8 },
  { id: 190, cost_id: 19, business_group: 8 },
  { id: 191, cost_id: 20, business_group: 8 },
  { id: 192, cost_id: 18, business_group: 8 },
  { id: 193, cost_id: 31, business_group: 8 },
  { id: 194, cost_id: 22, business_group: 8 },
  { id: 195, cost_id: 68, business_group: 8 },
  { id: 196, cost_id: 16, business_group: 8 },
  { id: 197, cost_id: 14, business_group: 8 },
  { id: 198, cost_id: 26, business_group: 8 },
  { id: 199, cost_id: 66, business_group: 8 },
  { id: 200, cost_id: 64, business_group: 8 },
  { id: 201, cost_id: 82, business_group: 8 },
  { id: 202, cost_id: 11, business_group: 8 },
  { id: 203, cost_id: 9, business_group: 8 },
  { id: 204, cost_id: 83, business_group: 8 },
  { id: 205, cost_id: 84, business_group: 8 },
  { id: 206, cost_id: 85, business_group: 8 },
  { id: 207, cost_id: 23, business_group: 8 }, // ซ้ำ
  { id: 208, cost_id: 86, business_group: 8 },
  { id: 209, cost_id: 10, business_group: 8 },
  { id: 210, cost_id: 63, business_group: 8 },
  { id: 211, cost_id: 87, business_group: 8 },
  { id: 212, cost_id: 23, business_group: 8 }, // ซ้ำ
  { id: 213, cost_id: 24, business_group: 8 },
  { id: 214, cost_id: 88, business_group: 8 },
  { id: 215, cost_id: 89, business_group: 8 },
  { id: 216, cost_id: 90, business_group: 8 },
  { id: 217, cost_id: 28, business_group: 8 },
  { id: 218, cost_id: 62, business_group: 8 },
  { id: 219, cost_id: 54, business_group: 8 },
  { id: 220, cost_id: 91, business_group: 8 },
  { id: 221, cost_id: 65, business_group: 8 },
  { id: 222, cost_id: 56, business_group: 8 },
  { id: 223, cost_id: 27, business_group: 8 },
  { id: 224, cost_id: 35, business_group: 8 },
  { id: 225, cost_id: 92, business_group: 8 },
  { id: 226, cost_id: 93, business_group: 8 },
  { id: 227, cost_id: 94, business_group: 8 },
  { id: 228, cost_id: 95, business_group: 8 },
  { id: 229, cost_id: 96, business_group: 8 },
  { id: 230, cost_id: 36, business_group: 8 },
]

const BUSINESS_COST_ID_MAP = (() => {
  const m = new Map()
  for (const r of BUSINESS_COSTS_SEED) {
    const key = `${Number(r.cost_id)}:${Number(r.business_group)}`
    if (!m.has(key)) m.set(key, Number(r.id)) // ซ้ำเก็บตัวแรกเสมอ
  }
  return m
})()

const resolveBusinessCostId = (costId, businessGroupId) =>
  BUSINESS_COST_ID_MAP.get(`${Number(costId)}:${Number(businessGroupId)}`) ?? null

const resolveRowBusinessCostId = (row) => {
  // ✅ บังคับแมพ "ค่าวัสดุสนง." ให้เป็น business_cost_id = 71 ตามที่กำหนด
  if (Number(row?.cost_id) === 71) return 71
  if (row?.business_cost_id) return Number(row.business_cost_id)
  return resolveBusinessCostId(row?.cost_id, BUSINESS_GROUP_ID)
}

/** ---------------- Rows: ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ ---------------- */
const ROWS = [
  { code: "8", label: "ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ", kind: "section" },

  { code: "8.1", label: "เงินเดือนและค่าจ้าง", kind: "item", cost_id: 7 },
  { code: "8.2", label: "ค่าเบี้ยเลี้ยงทำงานวันหยุด", kind: "item", cost_id: 8 },
  { code: "8.3", label: "ค่าเครื่องเขียนแบบพิมพ์", kind: "item", cost_id: 34 },
  { code: "8.4", label: "ค่าของใช้สำนักงาน", kind: "item", cost_id: 26 },
  { code: "8.5", label: "ค่าวัสดุสนง.", kind: "item", cost_id: 71 },

  { code: "8.6", label: "ค่าโทรศัพท์", kind: "item", cost_id: 14 },
  { code: "8.7", label: "ค่าไฟฟ้า", kind: "item", cost_id: 16 },
  { code: "8.8", label: "ค่าใช้จ่ายยานพาหนะ", kind: "item", cost_id: 11 },
  { code: "8.9", label: "ค่าซ่อมแซมบำรุงรักษาครุภัณฑ์", kind: "item", cost_id: 10 },
  { code: "8.10", label: "ค่าเสื่อมราคาครุภัณฑ์", kind: "item", cost_id: 18 },
  { code: "8.11", label: "ค่าเสื่อมราคาอาคาร", kind: "item", cost_id: 19 },
  { code: "8.12", label: "ค่าป้ายหนัง จนท", kind: "item", cost_id: 21 },
  { code: "8.13", label: "ค่าตกแต่งภูมิทัศน์", kind: "item", cost_id: 54 },
  { code: "8.14", label: "สวัสดิการจนท.", kind: "item", cost_id: 66 },
  { code: "8.15", label: "ค่าน้ำมันเชื้อเพลิง", kind: "item", cost_id: 23 },
  { code: "8.16", label: "ค่าตอบแทนประจำตำแหน่ง", kind: "item", cost_id: 90 },
  { code: "8.17", label: "ค่าใช้จ่ายงานบ้านงานครัว", kind: "item", cost_id: 65 },
  { code: "8.18", label: "ค่าเบี้ยประกันภัย", kind: "item", cost_id: 9 },
  { code: "8.19", label: "ค่าซ่อมแซมบำรุงรักษาอาคาร", kind: "item", cost_id: 31 },
  { code: "8.20", label: "ค่าซ่อมแซมบำรุงรักษายานพาหนะ", kind: "item", cost_id: 28 },
  { code: "8.21", label: "ค่าธรรมเนียมในการโอนเงิน", kind: "item", cost_id: 63 },

  { code: "8.23", label: "เงินสมทบกองทุนประกันสังคม", kind: "item", cost_id: 64 },
  { code: "8.24", label: "ค่าภาษีโรงเรือน", kind: "item", cost_id: 35 },
  { code: "8.25", label: "ค่าของขวัญสมาคม", kind: "item", cost_id: 62 },
  { code: "8.26", label: "ค่าจ้างทำความสะอาด สนง.", kind: "item", cost_id: 93 },
  { code: "8.27", label: "ค่าใช้จ่ายเบ็ดเตล็ด", kind: "item", cost_id: 36 },
]

/** ---------------- Table sizing ---------------- */
const COL_W = { code: 56, item: 260, unit: 130, total: 90 }
const LEFT_W = COL_W.code + COL_W.item
const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

const BusinessPlanExpenseServiceTable = (props = {}) => {
  const { branchId, branchName, yearBE, planId } = props

  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])

  const effectiveBranchId = useMemo(() => Number(branchId || 0) || 0, [branchId])
  const effectiveBranchName = useMemo(
    () => branchName || (effectiveBranchId ? `สาขา id: ${effectiveBranchId}` : "-"),
    [branchName, effectiveBranchId]
  )

  // ✅ ใช้ planId จากตัวแม่ (fallback: yearBE-2568)
  const effectivePlanId = useMemo(() => {
    const p = Number(planId || 0) || 0
    if (p) return p
    const y = Number(yearBE || 0) || 0
    if (!y) return 0
    // FY 2569 -> plan_id 1, FY 2570 -> 2 (ตามแพทเทิร์นเดิมของโปรเจค)
    return Math.max(1, y - 2568)
  }, [planId, yearBE])

  const effectiveYear = useMemo(() => {
    const y = Number(yearBE || 0) || 0
    if (y) return y
    // fallback: ถ้าไม่มี yearBE ให้ derive จาก planId (planId 1 => 2569)
    if (effectivePlanId) return 2568 + effectivePlanId
    return 0
  }, [yearBE, effectivePlanId])

  /** ---------------- state ---------------- */
  const [units, setUnits] = useState([]) // [{id, name}]
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  // valuesByCode[code][unitId] = "123.000" (string)
  const [valuesByCode, setValuesByCode] = useState({})

  const [statusMsg, setStatusMsg] = useState("")
  const [statusType, setStatusType] = useState("idle") // idle | ok | warn | err | saving
  const [isSaving, setIsSaving] = useState(false)

  /** ---------------- refs for arrow nav ---------------- */
  const inputRefs = useRef(new Map()) // key: `${rowIdx}|${colIdx}` -> element

  /** ---------------- computed totals ---------------- */
  const computed = useMemo(() => {
    const rowTotal = {}
    const unitTotal = {}
    let grand = 0

    for (const r of itemRows) {
      let sumRow = 0
      for (const u of units) {
        const v = toNumber(valuesByCode?.[r.code]?.[u.id])
        sumRow += v
        unitTotal[u.id] = (unitTotal[u.id] || 0) + v
      }
      rowTotal[r.code] = sumRow
      grand += sumRow
    }
    return { rowTotal, unitTotal, grand }
  }, [itemRows, units, valuesByCode])

  /** ---------------- load units by branch ---------------- */
  const loadUnits = useCallback(async () => {
    if (!effectiveBranchId) {
      setUnits([])
      setStatusType("warn")
      setStatusMsg("ยังไม่ได้เลือกสาขา")
      return
    }
    setIsLoadingUnits(true)
    try {
      const data = await apiAuth(`/lists/unit/search?branch_id=${effectiveBranchId}`)
      const list = Array.isArray(data) ? data : data?.items || data?.data || []
      const mapped = list
        .map((x) => ({
          id: Number(x.id ?? x.unit_id ?? 0) || 0,
          name: String(x.unit ?? x.name ?? x.title ?? "").trim() || `หน่วย ${x.id}`,
        }))
        .filter((x) => x.id)

      setUnits(mapped)
      setStatusType("idle")
      setStatusMsg("")
    } catch (e) {
      setUnits([])
      setStatusType("err")
      setStatusMsg(e?.message || "โหลดหน่วยไม่สำเร็จ")
    } finally {
      setIsLoadingUnits(false)
    }
  }, [effectiveBranchId])

  /** ---------------- load latest saved costs ---------------- */
  const loadLatest = useCallback(async () => {
    if (!effectivePlanId || !effectiveBranchId) return
    try {
      const data = await apiAuth(
        `/business-plan/${effectivePlanId}/costs/latest?branch_id=${effectiveBranchId}&business_group=${BUSINESS_GROUP_ID}`
      )

      // expected: [{business_cost_id, cost_id, unit_id, amount}]
      const list = Array.isArray(data) ? data : data?.items || data?.data || []
      const next = {}
      for (const r of itemRows) {
        next[r.code] = {}
      }

      for (const it of list) {
        const costId = Number(it.cost_id ?? 0) || 0
        const unitId = Number(it.unit_id ?? 0) || 0
        const amount = it.amount ?? it.value ?? it.qty ?? 0

        const row = itemRows.find((x) => Number(x.cost_id) === costId)
        if (!row || !unitId) continue
        next[row.code] = next[row.code] || {}
        next[row.code][unitId] = String(amount ?? "")
      }

      setValuesByCode((prev) => ({ ...prev, ...next }))
      setStatusType("ok")
      setStatusMsg("โหลดข้อมูลล่าสุดแล้ว")
    } catch (e) {
      // ถ้า latest ไม่มี ให้เงียบ
    }
  }, [effectivePlanId, effectiveBranchId, itemRows])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  useEffect(() => {
    // เมื่อได้ units แล้วค่อย load latest เพื่อ map unit_id ได้ครบ
    if (units.length) loadLatest()
  }, [units, loadLatest])

  /** ---------------- helpers ---------------- */
  const setCell = useCallback((code, unitId, val) => {
    setValuesByCode((prev) => {
      const next = { ...(prev || {}) }
      next[code] = { ...(next[code] || {}) }
      next[code][unitId] = val
      return next
    })
  }, [])

  const handleArrowNav = useCallback((e) => {
    const key = e.key
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(key)) return
    const row = Number(e.currentTarget?.dataset?.row ?? -1)
    const col = Number(e.currentTarget?.dataset?.col ?? -1)
    if (row < 0 || col < 0) return

    e.preventDefault()

    const rowCount = itemRows.length
    const colCount = Math.max(1, units.length)

    let nr = row
    let nc = col

    if (key === "ArrowLeft") nc = Math.max(0, col - 1)
    if (key === "ArrowRight" || key === "Enter") nc = Math.min(colCount - 1, col + 1)
    if (key === "ArrowUp") nr = Math.max(0, row - 1)
    if (key === "ArrowDown") nr = Math.min(rowCount - 1, row + 1)

    const refKey = `${nr}|${nc}`
    const el = inputRefs.current.get(refKey)
    if (el) el.focus()
  }, [itemRows.length, units.length])

  /** ---------------- save (bulk) ---------------- */
  const buildPayload = useCallback(() => {
    const rows = []

    for (const r of itemRows) {
      const bcId = resolveRowBusinessCostId(r)
      if (!bcId) continue

      for (const u of units) {
        const raw = valuesByCode?.[r.code]?.[u.id]
        const n = toNumber(raw)
        if (!n) continue
        rows.push({
          plan_id: effectivePlanId,
          branch_id: effectiveBranchId,
          business_group: BUSINESS_GROUP_ID,
          business_cost_id: bcId,
          unit_id: u.id,
          amount: n,
        })
      }
    }
    return rows
  }, [effectivePlanId, effectiveBranchId, itemRows, units, valuesByCode])

  const saveToBE = useCallback(async () => {
    if (!effectivePlanId) {
      setStatusType("warn")
      setStatusMsg("ยังไม่มี plan_id")
      return
    }
    if (!effectiveBranchId) {
      setStatusType("warn")
      setStatusMsg("ยังไม่ได้เลือกสาขา")
      return
    }
    if (!units.length) {
      setStatusType("warn")
      setStatusMsg("ยังไม่มีหน่วยของสาขานี้")
      return
    }

    const unmapped = itemRows
      .filter((r) => !resolveRowBusinessCostId(r))
      .map((r) => `${r.label}(cost_id=${r.cost_id})`)
    if (unmapped.length) {
      setStatusType("warn")
      setStatusMsg(`ยังไม่แมพบางรายการ: ${unmapped.join(", ")}`)
      return
    }

    const payload = buildPayload()
    setIsSaving(true)
    setStatusType("saving")
    setStatusMsg("กำลังบันทึก...")

    try {
      await apiAuth(`/business-plan/${effectivePlanId}/costs/bulk`, {
        method: "POST",
        body: payload,
      })

      setStatusType("ok")
      setStatusMsg("บันทึกสำเร็จ ✅")
      // หลังบันทึก ให้โหลด latest กลับมาเสมอ
      await loadLatest()
    } catch (e) {
      setStatusType("err")
      setStatusMsg(`${e?.message || "บันทึกไม่สำเร็จ"} (ธุรกิจ=${BUSINESS_GROUP_ID})`)
    } finally {
      setIsSaving(false)
    }
  }, [effectivePlanId, effectiveBranchId, units.length, itemRows, buildPayload, loadLatest])

  /** ---------------- table sizes ---------------- */
  const TOTAL_W = useMemo(() => {
    const unitCols = units.length ? units.length : 1
    return LEFT_W + unitCols * COL_W.unit + COL_W.total
  }, [units.length])

  /** ---------------- sticky helpers ---------------- */
  const stickyCodeHeader =
    "sticky left-0 z-[70] bg-slate-100/90 dark:bg-slate-700/70 backdrop-blur"
  const stickyLeftHeader =
    "sticky z-[70] bg-slate-100/90 dark:bg-slate-700/70 backdrop-blur"
  const stickyCodeCell = "sticky left-0 z-[60]"
  const stickyLeftCell = "sticky z-[55]"

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">
              ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              business_group = <span className="font-mono">{BUSINESS_GROUP_ID}</span> • plan_id{" "}
              <span className="font-mono">{effectivePlanId || "-"}</span> • ปี{" "}
              <span className="font-mono">{effectiveYear || "-"}</span>
            </div>

            {statusMsg ? (
              <div
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
                  statusType === "ok" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100",
                  statusType === "warn" && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100",
                  statusType === "err" && "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-100",
                  statusType === "saving" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100",
                  statusType === "idle" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100"
                )}
              >
                <span className="text-base">
                  {statusType === "ok" ? "✅" : statusType === "warn" ? "⚠️" : statusType === "err" ? "❌" : "⏳"}
                </span>
                <span className={trunc}>{statusMsg}</span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:items-end md:gap-4">
            <div>
              <div className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">สาขา</div>
              <input className={readonlyField} value={effectiveBranchName} readOnly />
            </div>

            <div>
              <div className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">แผน</div>
              <input className={readonlyField} value={effectivePlanId ? `plan_id ${effectivePlanId}` : "-"} readOnly />
            </div>
          </div>
        </div>

        {/* Table */}
        <div
          className="w-full overflow-auto"
          style={{
            maxHeight: "calc(100vh - 230px)",
          }}
        >
          <div
            className="min-w-fit"
            style={{
              width: TOTAL_W,
            }}
          />
          <table className="w-full border-collapse text-sm" style={{ minWidth: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {units.length
                ? units.map((u) => <col key={u.id} style={{ width: COL_W.unit }} />)
                : <col style={{ width: COL_W.unit }} />}
              <col style={{ width: COL_W.total }} />
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                <th
                  rowSpan={2}
                  className={cx(
                    "border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600",
                    stickyCodeHeader
                  )}
                />
                <th
                  rowSpan={2}
                  className={cx(
                    "border border-slate-300 px-2 py-2 text-left font-bold text-xs dark:border-slate-600",
                    stickyLeftHeader,
                    trunc
                  )}
                  style={{ left: COL_W.code }}
                >
                  รายการ
                </th>

                <th
                  colSpan={(units.length ? units.length : 1) + 1}
                  className="border border-slate-300 px-2 py-2 text-center font-extrabold text-xs dark:border-slate-600"
                  title={`สกต. ${effectiveBranchName}`}
                >
                  <span className={trunc}>สกต. {effectiveBranchName}</span>
                </th>
              </tr>

              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                {units.length ? (
                  units.map((u) => (
                    <th
                      key={u.id}
                      className={cx(
                        "border border-slate-300 px-1 py-2 text-center text-[11px] md:text-xs dark:border-slate-600",
                        trunc
                      )}
                      title={u.name}
                    >
                      {u.name}
                    </th>
                  ))
                ) : (
                  <th className="border border-slate-300 px-2 py-2 text-center text-xs dark:border-slate-600">
                    {isLoadingUnits ? "กำลังโหลด..." : "ไม่มีหน่วย"}
                  </th>
                )}

                <th className="border border-slate-300 px-1 py-2 text-center text-[11px] md:text-xs font-extrabold dark:border-slate-600">
                  รวม
                </th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((r) => {
                if (r.kind === "section") {
                  return (
                    <tr key={r.code} className="bg-slate-200/70 dark:bg-slate-700/55">
                      <td
                        className={cx(
                          "border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600",
                          stickyCodeCell,
                          "bg-slate-200/70 dark:bg-slate-700/55"
                        )}
                      >
                        {r.code}
                      </td>
                      <td
                        colSpan={(units.length ? units.length : 1) + 2}
                        className={cx(
                          "border border-slate-300 px-2 py-2 font-extrabold text-xs dark:border-slate-600",
                          "sticky z-[55] bg-slate-200/70 dark:bg-slate-700/55",
                          trunc
                        )}
                        style={{ left: COL_W.code }}
                        title={r.label}
                      >
                        {r.label}
                      </td>
                    </tr>
                  )
                }

                const idx = itemRows.findIndex((x) => x.code === r.code)
                const rowBg = idx % 2 === 1 ? STRIPE.alt : STRIPE.cell
                const rowSum = computed.rowTotal[r.code] || 0
                const isUnmapped = !resolveRowBusinessCostId(r)

                return (
                  <tr key={r.code} className={rowBg}>
                    <td
                      className={cx(
                        "border border-slate-300 px-1 py-2 text-center text-xs dark:border-slate-600",
                        stickyCodeCell,
                        rowBg
                      )}
                      title={isUnmapped ? "ยังไม่แมพ (businesscosts)" : ""}
                    >
                      {r.code}
                    </td>

                    <td
                      className={cx(
                        "border border-slate-300 px-2 py-2 text-left font-semibold text-xs dark:border-slate-600",
                        "sticky z-[50]",
                        rowBg,
                        trunc
                      )}
                      style={{ left: COL_W.code }}
                      title={isUnmapped ? `${r.label} (ยังไม่แมพ cost_id=${r.cost_id})` : r.label}
                    >
                      <span className={cx(isUnmapped && "text-amber-700 dark:text-amber-200")}>{r.label}</span>
                    </td>

                    {units.length ? (
                      units.map((u, colIdx) => (
                        <td
                          key={`${r.code}-${u.id}`}
                          className="border border-slate-300 px-1 py-2 dark:border-slate-600"
                        >
                          <input
                            ref={(el) => {
                              const key = `${idx}|${colIdx}`
                              if (!el) inputRefs.current.delete(key)
                              else inputRefs.current.set(key, el)
                            }}
                            data-row={idx}
                            data-col={colIdx}
                            onKeyDown={handleArrowNav}
                            className={cellInput}
                            value={valuesByCode?.[r.code]?.[u.id] ?? ""}
                            inputMode="decimal"
                            placeholder="0"
                            onChange={(e) =>
                              setCell(r.code, u.id, sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))
                            }
                          />
                        </td>
                      ))
                    ) : (
                      <td className="border border-slate-300 px-2 py-2 dark:border-slate-600 text-center text-xs text-slate-500">
                        —
                      </td>
                    )}

                    <td className="border border-slate-300 px-1 py-2 text-right font-extrabold text-xs dark:border-slate-600">
                      {fmtMoney0(rowSum)}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-[75]">
              <tr className={cx("text-slate-900 dark:text-slate-100", STRIPE.foot)}>
                <td
                  className={cx(
                    "border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600",
                    stickyCodeCell,
                    STRIPE.foot
                  )}
                >
                  รวม
                </td>
                <td
                  className={cx(
                    "border border-slate-300 px-2 py-2 text-left font-extrabold text-xs dark:border-slate-600",
                    "sticky z-[60]",
                    STRIPE.foot,
                    trunc
                  )}
                  style={{ left: COL_W.code }}
                >
                  รวมทั้งสิ้น
                </td>

                {units.length ? (
                  units.map((u) => (
                    <td
                      key={`total-${u.id}`}
                      className="border border-slate-300 px-1 py-2 text-right font-bold text-xs dark:border-slate-600"
                      title={u.name}
                    >
                      {fmtMoney0(computed.unitTotal[u.id] || 0)}
                    </td>
                  ))
                ) : (
                  <td className="border border-slate-300 px-2 py-2 dark:border-slate-600" />
                )}

                <td className="border border-slate-300 px-1 py-2 text-right font-extrabold text-xs dark:border-slate-600">
                  {fmtMoney0(computed.grand)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ✅ แถบล่างสุดเหมือนไฟล์จัดหา */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              บันทึก: <span className="font-mono">POST /business-plan/{`{plan_id}`}/costs/bulk</span> • plan_id=
              {effectivePlanId || "-"} • ปี={effectiveYear} • สาขา={effectiveBranchName}
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={saveToBE}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white",
                "shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 hover:scale-[1.03] active:scale-[.98] transition",
                isSaving && "opacity-60 hover:scale-100 cursor-not-allowed"
              )}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึกลงระบบ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessPlanExpenseServiceTable
