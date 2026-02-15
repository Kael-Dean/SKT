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
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const readonlyField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black shadow-none dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100"

const cellInput =
  "w-full h-9 min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const badgeWarn =
  "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
const badgeOk =
  "inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900"
const badgeErr =
  "inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-900"

/** ---------------- Table definition ---------------- */
const PERIOD_DEFAULT = "1 เม.ย.68-31 มี.ค.69"

/** lock width ให้ตรงกันทุกส่วน */
const COL_W = { code: 72, item: 420, cell: 120, total: 120 }
const LEFT_W = COL_W.code + COL_W.item
const RIGHT_W = 3 * COL_W.cell + COL_W.total
const TOTAL_W = LEFT_W + RIGHT_W

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

/** ---------------- Mapping: (earning_id + business_group=7) -> businessearnings.id ---------------- */
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

/** ---------------- Rows (รายการรายได้อื่นๆ) ---------------- */
const ROWS = [
  { code: "OTHER", label: "ประมาณการ รายได้อื่นๆ", kind: "title" },

  { code: "2", label: "รายได้อื่นๆ", kind: "section" },
  { code: "2.1", label: "ดอกเบี้ยเงินฝากธนาคาร", kind: "item", business_group: 7, earning_id: 22 },
  { code: "2.2", label: "ค่าธรรมเนียมแรกเข้า", kind: "item", business_group: 7, earning_id: 24 },
  { code: "2.3", label: "ผลตอบแทนการถือหุ้น", kind: "item", business_group: 7, earning_id: 25 },
  { code: "2.4", label: "เงินรางวัลจากการลงทุน-ทวีสิน", kind: "item", business_group: 7, earning_id: 26 },
  { code: "2.5", label: "รายได้เงินอุดหนุนจากรัฐ", kind: "item", business_group: 7, earning_id: 27 },
  { code: "2.6", label: "รายได้จากการรับรู้", kind: "item", business_group: 7, earning_id: 28 },
  { code: "2.7", label: "รายได้จากการขายซองประมูล", kind: "item", business_group: 7, earning_id: 29 },
  { code: "2.8", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 7, earning_id: 6 },
  { code: "2.T", label: "รวม", kind: "subtotal" },
]

const itemRows = ROWS.filter((r) => r.kind === "item")

function buildInitialValues() {
  // ✅ ให้เหมือนหน้า RevenueByBusiness: เริ่มต้นเป็น "0"
  const out = {}
  for (const r of itemRows) out[r.code] = { hq: "0", surin: "0", nonnarai: "0" }
  return out
}

const findName = (b) => String(b?.name ?? b?.branch ?? b?.branch_name ?? b?.label ?? "").trim()
const findId = (b) => Number(b?.id ?? b?.branch_id ?? b?.value ?? 0) || 0

const resolveBranchesFromList = (list) => {
  const arr = Array.isArray(list) ? list : Array.isArray(list?.data) ? list.data : []
  const norm = arr.map((b) => ({ id: findId(b), name: findName(b), raw: b })).filter((b) => b.id > 0)

  const pickByIncludes = (includesAny = []) => {
    const found = norm.find((b) => includesAny.some((k) => b.name.includes(k)))
    return found || null
  }

  const surin = pickByIncludes(["สุรินทร์"])
  const nonnarai = pickByIncludes(["โนนนารายณ์", "โนนนาราย", "nonnarai"])
  const hq = pickByIncludes(["สำนักงานใหญ่", "สหกรณ์", "สกต", "สาขา"])
  return { hq, surin, nonnarai, all: norm }
}

const BusinessPlanOtherIncomeTable = (props) => {
  const planId = Number(props?.planId ?? props?.plan_id ?? 0) || 0

  const [period, setPeriod] = useState(PERIOD_DEFAULT)
  const [valuesByCode, setValuesByCode] = useState(() => buildInitialValues())
  const [showPayload, setShowPayload] = useState(false)

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [infoMsg, setInfoMsg] = useState("")

  // ✅ notice ต้องไม่หายตอนโหลดล่าสุด
  const [saveNotice, setSaveNotice] = useState(null) // {type:'success'|'error'|'info', title, detail}
  const [lastSaveMeta, setLastSaveMeta] = useState(null) // { ok, at: Date, res }

  const noticeTimerRef = useRef(0)
  const pushNotice = useCallback((notice, { autoHideMs = 0 } = {}) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setSaveNotice(notice || null)
    if (autoHideMs && autoHideMs > 0) {
      noticeTimerRef.current = setTimeout(() => setSaveNotice(null), autoHideMs)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    }
  }, [])

  /** branches (columns) */
  const [branches, setBranches] = useState(() => ({
    hq: { id: 1, label: "สาขา", name: "" },
    surin: { id: 2, label: "สุรินทร์", name: "" },
    nonnarai: { id: 3, label: "โนนนารายณ์", name: "" },
    _resolved: false,
    _fromApi: false,
  }))

  /** ✅ height ยาวขึ้น */
  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)

  const recalcTableCardHeight = useCallback(() => {
    const el = tableCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 900
    const bottomPadding = 6
    const h = Math.max(860, Math.floor(vh - rect.top - bottomPadding))
    setTableCardHeight(h)
  }, [])

  useEffect(() => {
    recalcTableCardHeight()
    window.addEventListener("resize", recalcTableCardHeight)
    return () => window.removeEventListener("resize", recalcTableCardHeight)
  }, [recalcTableCardHeight])

  useEffect(() => {
    requestAnimationFrame(() => recalcTableCardHeight())
  }, [showPayload, period, recalcTableCardHeight])

  /** ---------------- Map rows -> business_earning_id ---------------- */
  const rowIdByCode = useMemo(() => {
    const m = {}
    for (const r of itemRows) m[r.code] = resolveBusinessEarningId(r.earning_id, r.business_group)
    return m
  }, [])

  const unmapped = useMemo(() => {
    const list = []
    for (const r of itemRows) {
      const id = rowIdByCode[r.code]
      if (!id) list.push({ code: r.code, earning_id: r.earning_id, group: r.business_group, label: r.label })
    }
    return list
  }, [rowIdByCode])

  const isRowMapped = useCallback((code) => !!rowIdByCode[code], [rowIdByCode])

  /** ---------------- Load branches list (best effort) ---------------- */
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await apiAuth(`/lists/branch/search`, { method: "GET" })
        const r = resolveBranchesFromList(data)
        const next = {
          hq: { id: r.hq?.id || 1, label: "สาขา", name: r.hq?.name || "" },
          surin: { id: r.surin?.id || 2, label: "สุรินทร์", name: r.surin?.name || "" },
          nonnarai: { id: r.nonnarai?.id || 3, label: "โนนนารายณ์", name: r.nonnarai?.name || "" },
          _resolved: true,
          _fromApi: true,
        }
        if (alive) setBranches(next)
      } catch {
        if (alive) setBranches((p) => ({ ...p, _resolved: true, _fromApi: false }))
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  /** ---------------- Load saved values from BE (branch_totals only) ---------------- */
  const applyBranchTotalsToState = useCallback(
    (branchKey, totals) => {
      const map = new Map()
      for (const t of totals || []) {
        const id = Number(t?.business_earning_id ?? t?.b_earnings ?? 0) || 0
        const amt = toNumber(t?.amount ?? 0)
        if (id) map.set(id, amt)
      }

      setValuesByCode((prev) => {
        const next = { ...prev }
        for (const r of itemRows) {
          const bid = rowIdByCode[r.code]
          if (!bid) continue
          const val = map.has(bid) ? map.get(bid) : 0
          // ✅ เก็บ "0" ไว้ด้วย ไม่ให้กลายเป็น ""
          next[r.code] = { ...(next[r.code] || { hq: "0", surin: "0", nonnarai: "0" }), [branchKey]: String(val ?? 0) }
        }
        return next
      })
    },
    [rowIdByCode]
  )

  /**
   * ✅ loadFromBE แบบเหมือน RevenueByBusiness:
   * - หลัง save ต้อง refresh ล่าสุด "เสมอ" และ reset ก่อนโหลด เพื่อไม่ให้ค้างค่าเก่า
   * - แต่ไม่ฆ่า saveNotice
   */
  const loadFromBE = useCallback(
    async ({ silent = false, forceReset = true } = {}) => {
      if (!planId || planId <= 0) return
      setLoading(true)
      setErrorMsg("")
      if (!silent) setInfoMsg("")
      try {
        if (forceReset) setValuesByCode(buildInitialValues())

        const branchCalls = [
          { key: "hq", id: branches.hq.id },
          { key: "surin", id: branches.surin.id },
          { key: "nonnarai", id: branches.nonnarai.id },
        ]

        for (const b of branchCalls) {
          const data = await apiAuth(`/business-plan/${planId}/earnings?branch_id=${Number(b.id)}`)
          applyBranchTotalsToState(b.key, data?.branch_totals || [])
        }

        if (!silent) setInfoMsg("โหลดค่าที่บันทึกล่าสุดแล้ว")
      } catch (e) {
        console.error(e)
        setErrorMsg(e?.message || "โหลดข้อมูลไม่สำเร็จ")
      } finally {
        setLoading(false)
      }
    },
    [applyBranchTotalsToState, branches.hq.id, branches.nonnarai.id, branches.surin.id, planId]
  )

  useEffect(() => {
    if (!branches._resolved) return
    // ✅ initial load ก็ reset แล้วดึงจาก BE
    loadFromBE({ silent: true, forceReset: true })
  }, [branches._resolved, loadFromBE])

  /** ---------------- Computed totals ---------------- */
  const computed = useMemo(() => {
    const colSum = { hq: 0, surin: 0, nonnarai: 0 }
    const rowSum = {}

    for (const r of itemRows) {
      const v = valuesByCode[r.code] || {}
      const s = { hq: toNumber(v.hq), surin: toNumber(v.surin), nonnarai: toNumber(v.nonnarai) }
      const rt = s.hq + s.surin + s.nonnarai
      rowSum[r.code] = { ...s, total: rt }
      colSum.hq += s.hq
      colSum.surin += s.surin
      colSum.nonnarai += s.nonnarai
    }

    const grand = colSum.hq + colSum.surin + colSum.nonnarai
    return { rowSum, colSum, grand }
  }, [valuesByCode])

  /** ---------------- Handlers ---------------- */
  const onChangeCell = (code, key, raw) => {
    const nextVal = sanitizeNumberInput(raw, { maxDecimals: 3 })
    setValuesByCode((prev) => ({
      ...prev,
      [code]: { ...(prev[code] || { hq: "0", surin: "0", nonnarai: "0" }), [key]: nextVal },
    }))
  }

  const buildPayload = useCallback(() => {
    if (!planId || planId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (plan_id=${planId})`)

    const branchCalls = [
      { key: "hq", id: branches.hq.id },
      { key: "surin", id: branches.surin.id },
      { key: "nonnarai", id: branches.nonnarai.id },
    ]

    const rows = []
    const skipped = []
    const blocked = []

    for (const r of itemRows) {
      const businessEarningId = rowIdByCode[r.code]
      const v = valuesByCode[r.code] || {}
      const rowSum = toNumber(v.hq) + toNumber(v.surin) + toNumber(v.nonnarai)

      if (!businessEarningId) {
        skipped.push({ code: r.code, label: r.label, earning_id: r.earning_id, business_group: r.business_group })
        if (rowSum !== 0) blocked.push({ code: r.code, label: r.label })
        continue
      }

      for (const b of branchCalls) {
        rows.push({
          branch_id: Number(b.id),
          business_earning_id: Number(businessEarningId),
          unit_values: [],
          branch_total: toNumber(v[b.key]),
          comment: period,
        })
      }
    }

    if (blocked.length) {
      throw new Error("FE: มีรายการยังไม่แมพ แต่คุณกรอกตัวเลขแล้ว: " + blocked.map((x) => x.code).join(", "))
    }

    return { plan_id: planId, period, rows, skipped }
  }, [branches.hq.id, branches.nonnarai.id, branches.surin.id, period, planId, rowIdByCode, valuesByCode])

  const onSave = useCallback(async () => {
    setSaving(true)
    setErrorMsg("")
    setInfoMsg("")
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
          detail: `rows=${res?.rows ?? payload.rows.length} • branch_totals_upserted=${res?.branch_totals_upserted ?? "?"}${
            payload?.skipped?.length ? ` • skipped=${payload.skipped.length}` : ""
          }`,
        },
        { autoHideMs: 0 }
      )

      // ✅ สำคัญ: หลังบันทึกสำเร็จ ต้องเอาค่าล่าสุดจาก BE มาแสดง "เสมอ" (reset ก่อนโหลด)
      await loadFromBE({ silent: true, forceReset: true })
    } catch (e) {
      console.error(e)
      const status = e?.status || 0
      let title = "บันทึกส่งไป BE ไม่สำเร็จ ❌"
      let detail = e?.message || "บันทึกไม่สำเร็จ"

      if (status === 401) {
        title = "401 Unauthorized"
        detail = "Token ไม่ผ่าน/หมดอายุ → Logout/Login ใหม่"
      } else if (status === 403) {
        title = "403 Forbidden"
        detail = "สิทธิ์ไม่พอ (role ไม่อนุญาต)"
      } else if (status === 404) {
        title = "404 Not Found"
        detail = `ไม่พบแผน หรือ route ไม่ตรง — plan_id=${planId}`
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
  }, [buildPayload, loadFromBE, planId, pushNotice])

  const copyPayload = useCallback(async () => {
    try {
      const p = buildPayload()
      await navigator.clipboard?.writeText(JSON.stringify({ rows: p.rows }, null, 2))
      pushNotice(
        { type: "success", title: "คัดลอกแล้ว ✅", detail: "คัดลอก payload (rows) สำหรับ BE แล้ว" },
        { autoHideMs: 4000 }
      )
    } catch (e) {
      pushNotice({ type: "error", title: "คัดลอกไม่สำเร็จ", detail: e?.message || String(e) }, { autoHideMs: 6000 })
    }
  }, [buildPayload, pushNotice])

  /** ---------------- Render helpers ---------------- */
  const renderCell = (r, key) => {
    if (r.kind !== "item") return null
    const isDisabled = !rowIdByCode[r.code]
    return (
      <input
        className={cx(cellInput, isDisabled && "opacity-50 cursor-not-allowed")}
        value={valuesByCode[r.code]?.[key] ?? "0"}
        onChange={(e) => onChangeCell(r.code, key, e.target.value)}
        placeholder={isDisabled ? "—" : "0"}
        disabled={isDisabled}
        inputMode="decimal"
      />
    )
  }

  const renderRowTotal = (r) => {
    if (r.kind !== "item") return null
    const t = computed.rowSum?.[r.code]?.total ?? 0
    return <div className="text-right font-semibold">{fmtMoney0(t)}</div>
  }

  const saveStatusPill = useMemo(() => {
    if (saving) return { cls: badgeWarn, text: "กำลังบันทึก..." }
    if (!lastSaveMeta) return { cls: "text-xs text-slate-500", text: "ยังไม่เคยบันทึก" }
    if (lastSaveMeta.ok) return { cls: badgeOk, text: `บันทึกล่าสุดสำเร็จ • ${fmtTimeTH(lastSaveMeta.at)}` }
    return { cls: badgeErr, text: `บันทึกล่าสุดไม่สำเร็จ • ${fmtTimeTH(lastSaveMeta.at)}` }
  }, [lastSaveMeta, saving])

  /** ---------------- UI ---------------- */
  return (
    <div className="w-full px-3 md:px-6 py-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xl md:text-2xl font-bold">รายได้อื่นๆ</div>
          <div className="text-slate-600 dark:text-slate-300 text-sm">
            เชื่อม BE: <span className="font-mono">/business-plan/{`{plan_id}`}/earnings</span> และบันทึก{" "}
            <span className="font-mono">POST /business-plan/{`{plan_id}`}/earnings/bulk</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:w-[720px]">
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
                (loading || saving) && "opacity-60 cursor-not-allowed"
              )}
              onClick={() => loadFromBE({ silent: false, forceReset: true })}
              disabled={loading || saving}
              title="โหลดค่าที่บันทึกไว้"
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
              onClick={copyPayload}
              title="คัดลอก payload (rows)"
            >
              คัดลอก
            </button>
          </div>
        </div>
      </div>

      {unmapped.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="font-semibold">⚠️ รายการที่ยังไม่แมพ (ถ้ามีตัวเลขจะบันทึกไม่ได้)</div>
          <div className="mt-1 text-sm">
            {unmapped.map((u) => `${u.code} (earning_id=${u.earning_id}, group=${u.group})`).join(" • ")}
          </div>
        </div>
      )}

      {(errorMsg || infoMsg) && (
        <div
          className={cx(
            "mb-4 rounded-2xl border px-4 py-3",
            errorMsg ? "border-rose-300 bg-rose-50 text-rose-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"
          )}
        >
          <div className="text-sm">{errorMsg || infoMsg}</div>
        </div>
      )}

      {saveNotice && (
        <div
          className={cx(
            "mb-4 rounded-2xl border px-4 py-3",
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

      <div
        ref={tableCardRef}
        className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-sm"
      >
        <div className="overflow-hidden" style={{ height: tableCardHeight }}>
          {/* header */}
          <div className={cx("border-b border-slate-200 dark:border-slate-700", STRIPE.head)} style={{ width: TOTAL_W }}>
            <div className="flex">
              <div style={{ width: LEFT_W }} className="flex">
                <div style={{ width: COL_W.code }} className="px-3 py-3 font-semibold"></div>
                <div style={{ width: COL_W.item }} className="px-3 py-3 font-semibold">
                  รายการ
                </div>
              </div>

              <div className="flex-1">
                <div className="px-3 py-2 text-center font-semibold">สกต.สาขา</div>
                <div className="flex border-t border-slate-200 dark:border-slate-700">
                  <div style={{ width: COL_W.cell }} className="px-3 py-2 text-center font-semibold">
                    {branches.hq.label}
                  </div>
                  <div style={{ width: COL_W.cell }} className="px-3 py-2 text-center font-semibold">
                    {branches.surin.label}
                  </div>
                  <div style={{ width: COL_W.cell }} className="px-3 py-2 text-center font-semibold">
                    {branches.nonnarai.label}
                  </div>
                  <div style={{ width: COL_W.total }} className="px-3 py-2 text-center font-semibold">
                    รวม
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* body */}
          <div className="overflow-auto" style={{ height: tableCardHeight - 58 - 64 }}>
            <div style={{ width: TOTAL_W }}>
              {ROWS.map((r, idx) => {
                const isAlt = idx % 2 === 1
                const rowBg = r.kind === "subtotal" ? STRIPE.foot : isAlt ? STRIPE.alt : STRIPE.cell
                const mapped = r.kind === "item" ? isRowMapped(r.code) : true

                return (
                  <div
                    key={r.code}
                    className={cx("flex border-b border-slate-200 dark:border-slate-700", rowBg)}
                    style={{ minHeight: r.kind === "item" ? 56 : 44 }}
                  >
                    <div style={{ width: LEFT_W }} className="flex">
                      <div
                        style={{ width: COL_W.code }}
                        className={cx(
                          "px-3 py-3 text-right font-semibold",
                          r.kind === "title" && "text-lg",
                          r.kind === "section" && "text-base",
                          r.kind === "subtotal" && "text-base"
                        )}
                      >
                        {r.kind === "item" ? r.code : r.kind === "section" ? r.code : ""}
                      </div>

                      <div style={{ width: COL_W.item }} className="px-3 py-3 font-semibold">
                        <div className="flex items-center gap-2">
                          <span className={cx(r.kind === "title" && "text-lg")}>{r.label}</span>
                          {r.kind === "item" && !mapped ? <span className={badgeWarn}>ยังไม่แมพ</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1">
                      {r.kind === "title" ? (
                        <div className="px-3 py-3" />
                      ) : r.kind === "section" ? (
                        <div className="px-3 py-3" />
                      ) : r.kind === "subtotal" ? (
                        <div className="flex">
                          <div style={{ width: COL_W.cell }} className="px-3 py-3 text-right font-semibold">
                            {fmtMoney0(computed.colSum.hq)}
                          </div>
                          <div style={{ width: COL_W.cell }} className="px-3 py-3 text-right font-semibold">
                            {fmtMoney0(computed.colSum.surin)}
                          </div>
                          <div style={{ width: COL_W.cell }} className="px-3 py-3 text-right font-semibold">
                            {fmtMoney0(computed.colSum.nonnarai)}
                          </div>
                          <div style={{ width: COL_W.total }} className="px-3 py-3 text-right font-semibold">
                            {fmtMoney0(computed.grand)}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <div style={{ width: COL_W.cell }} className="px-3 py-2">
                            {renderCell(r, "hq")}
                          </div>
                          <div style={{ width: COL_W.cell }} className="px-3 py-2">
                            {renderCell(r, "surin")}
                          </div>
                          <div style={{ width: COL_W.cell }} className="px-3 py-2">
                            {renderCell(r, "nonnarai")}
                          </div>
                          <div style={{ width: COL_W.total }} className="px-3 py-2">
                            {renderRowTotal(r)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white dark:from-slate-950" />
        </div>

        {/* save bar */}
        <div className="sticky bottom-0 z-20 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  บันทึก: <span className="font-mono">POST /business-plan/{`{plan_id}`}/earnings/bulk</span> • plan_id={planId || "—"} • group=7
                </span>
                <span className={saveStatusPill.cls}>{saveStatusPill.text}</span>
              </div>
              <div className="text-xs mt-1 text-slate-500 dark:text-slate-400">
                {branches._fromApi
                  ? `สาขา: ${branches.hq.name || branches.hq.label}, ${branches.surin.name || branches.surin.label}, ${branches.nonnarai.name || branches.nonnarai.label}`
                  : "สาขา: (fallback id=1,2,3)"}
              </div>
            </div>

            <button
              className={cx(
                "rounded-2xl px-5 py-2.5 font-semibold",
                "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
                (saving || loading || !planId) && "opacity-60 cursor-not-allowed"
              )}
              onClick={onSave}
              disabled={saving || loading || !planId}
              title={!planId ? "ต้องมี plan_id" : "บันทึก"}
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>

      {showPayload && (
        <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold">Payload (preview)</div>
            <button
              className={cx(
                "rounded-xl px-3 py-2 text-sm font-semibold",
                "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950",
                "dark:bg-slate-100 dark:text-slate-900"
              )}
              onClick={() => {
                try {
                  const p = buildPayload()
                  navigator.clipboard?.writeText(JSON.stringify(p, null, 2))
                } catch {}
              }}
            >
              คัดลอก payload
            </button>
          </div>
          <pre className="max-h-[520px] overflow-auto rounded-xl bg-slate-950 text-slate-100 p-3 text-xs">
            {(() => {
              try {
                return JSON.stringify(buildPayload(), null, 2)
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
