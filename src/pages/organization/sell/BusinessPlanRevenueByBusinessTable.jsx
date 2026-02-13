import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/** ---------------- Utils ---------------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => {
  if (v === "" || v === null || v === undefined) return 0
  const n = Number(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}
const sanitizeNumberInput = (s) => {
  const cleaned = String(s ?? "").replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  if (parts.length <= 2) return cleaned
  return `${parts[0]}.${parts.slice(1).join("")}`
}
const fmtMoney0 = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

/** ---------------- API (เหมือนหน้าธุรกิจจัดหา) ---------------- */
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
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeader(token),
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
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

/** ---------------- Table definition ---------------- */
const PERIOD_DEFAULT = "1 เม.ย.68-31 มี.ค.69"

const ROWS = [
  { code: "REV", label: "ประมาณการ รายได้เฉพาะธุรกิจ", kind: "title" },

  { code: "1", label: "รายได้เฉพาะ ธุรกิจจัดหา", kind: "section" },
  { code: "1.1", label: "ค่าตอบแทนจัดหาวัสดุ", kind: "item" },
  { code: "1.2", label: "รายได้จากส่งเสริมการขาย", kind: "item" },
  { code: "1.3", label: "ดอกเบี้ยรับ-ลูกหนี้การค้า", kind: "item" },
  { code: "1.4", label: "กำไรจากการตีราคาสินค้าเพิ่มขึ้น", kind: "item" },
  { code: "1.5", label: "รางวัล สกต.ดีเด่น", kind: "item" },
  { code: "1.6", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "1.T", label: "รวมธุรกิจจัดหา", kind: "subtotal" },

  { code: "2", label: "รายได้เฉพาะ ธุรกิจจัดหา-ปั๊มน้ำมัน", kind: "section" },
  { code: "2.1", label: "รางวัลคุณภาพ", kind: "item" },
  { code: "2.2", label: "รายได้ค่าส่งเสริมการขาย", kind: "item" },
  { code: "2.3", label: "รายได้ค่าบริการสมาชิก", kind: "item" },
  { code: "2.4", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "2.T", label: "รวมธุรกิจจัดหา-ปั๊มน้ำมัน", kind: "subtotal" },

  { code: "3", label: "รายได้เฉพาะธุรกิจรวบรวม", kind: "section" },
  { code: "3.1", label: "รายได้จากบริการ", kind: "item" },
  { code: "3.2", label: "รายได้จากการชะลอ", kind: "item" },
  { code: "3.3", label: "รายได้จากการส่งออกคุณภาพข้าวเปลือก", kind: "item" },
  { code: "3.4", label: "รายได้จากกระสอบ", kind: "item" },
  { code: "3.5", label: "รายได้ค่าบริการตลาดกลาง", kind: "item" },
  { code: "3.6", label: "เงินชดเชยดอกเบี้ยประกัน", kind: "item" },
  { code: "3.7", label: "รายได้เงินอุดหนุน", kind: "item" },
  { code: "3.8", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "3.T", label: "รวมธุรกิจรวบรวม", kind: "subtotal" },

  { code: "4", label: "รายได้เฉพาะ ธุรกิจแปรรูป", kind: "section" },
  { code: "4.1", label: "กำไรจากการตีราคาสินค้าเพิ่มขึ้น", kind: "item" },
  { code: "4.2", label: "ดอกเบี้ยเงินฝาก", kind: "item" },
  { code: "4.3", label: "รายได้รถบรรทุก", kind: "item" },
  { code: "4.4", label: "รายได้โครงการชะลอ", kind: "item" },
  { code: "4.5", label: "รายได้จากการรับจ้างสี", kind: "item" },
  { code: "4.6", label: "รายได้จากกระสอบ", kind: "item" },
  { code: "4.7", label: "เงินชดเชยดอกเบี้ยประกัน", kind: "item" },
  { code: "4.8", label: "รายได้เงินอุดหนุน-การจำหน่ายข้าวสาร", kind: "item" },
  { code: "4.9", label: "รายได้เงินอุดหนุน-ซื้อเครื่องจักร", kind: "item" },
  { code: "4.10", label: "รายได้จากการตรวจสอบคุณภาพข้าวเปลือก", kind: "item" },
  { code: "4.11", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "4.T", label: "รวมธุรกิจแปรรูป", kind: "subtotal" },

  { code: "5", label: "รายได้เฉพาะ ธุรกิจแปรรูป-เมล็ดพันธุ์", kind: "section" },
  { code: "5.1", label: "เมล็ดพันธุ์ขาดบัญชีได้รับชดใช้", kind: "item" },
  { code: "5.2", label: "รายได้รถบรรทุก", kind: "item" },
  { code: "5.3", label: "รายได้โครงการชะลอ", kind: "item" },
  { code: "5.4", label: "รายได้เงินอุดหนุนจากการผลิตเมล็ดพันธุ์", kind: "item" },
  { code: "5.5", label: "รายได้เกษตรกร", kind: "item" },
  { code: "5.6", label: "กำไรจากการตีราคาสินค้าเพิ่มขึ้น", kind: "item" },
  { code: "5.7", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "5.T", label: "รวมธุรกิจแปรรูป-เมล็ดพันธุ์", kind: "subtotal" },

  { code: "6", label: "รายได้ศูนย์โคออม", kind: "section" },
  { code: "6.1", label: "ดอกเบี้ยเงินฝาก", kind: "item" },
  { code: "6.2", label: "รายได้ค่าจัดการ", kind: "item" },
  { code: "6.3", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "6.T", label: "รวมศูนย์โคออม", kind: "subtotal" },

  { code: "G.T", label: "รวมรายได้", kind: "grandtotal" },
]

/** lock width ให้ตรงกันทุกส่วน */
const COL_W = { code: 72, item: 420, cell: 120, total: 120 }
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

/** fallback units ถ้ายังไม่ได้เลือกสาขา/ดึงไม่สำเร็จ */
const FALLBACK_UNITS = [
  { id: 1, name: "สุรินทร์" },
  { id: 2, name: "โนนนารายณ์" },
]

function buildInitialValues(unitIds) {
  const out = {}
  ROWS.forEach((r) => {
    if (r.kind !== "item") return
    const row = {}
    unitIds.forEach((uid) => (row[String(uid)] = ""))
    out[r.code] = row
  })
  return out
}

const BusinessPlanRevenueByBusinessTable = (props) => {
  // รองรับได้ทั้ง branchId / branch_id
  const branchId = Number(props?.branchId ?? props?.branch_id ?? 0) || 0

  const [period, setPeriod] = useState(PERIOD_DEFAULT)
  const [units, setUnits] = useState(FALLBACK_UNITS)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  const unitIds = useMemo(() => units.map((u) => Number(u.id)).filter((x) => x > 0), [units])
  const cols = useMemo(() => units.map((u) => ({ key: String(u.id), label: String(u.name || `หน่วย ${u.id}`) })), [units])

  const [valuesByCode, setValuesByCode] = useState(() => buildInitialValues(unitIds.length ? unitIds : FALLBACK_UNITS.map((x) => x.id)))
  const [showPayload, setShowPayload] = useState(false)

  /** ✅ โหลดหน่วยตามสาขา (เหมือนหน้าธุรกิจจัดหา) */
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
      } catch (e) {
        console.error("[Revenue Specific Units load] failed:", e)
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

  /** ✅ เมื่อ units เปลี่ยน: preserve ค่าเดิมเท่าที่ map ได้ */
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

  /** ✅ ขยายความสูงตารางให้มากขึ้น */
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

  /** ✅ sync footer with horizontal scroll */
  const bodyScrollRef = useRef(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const rafRef = useRef(0)

  const onBodyScroll = () => {
    const b = bodyScrollRef.current
    if (!b) return
    const x = b.scrollLeft || 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => setScrollLeft(x))
  }

  useEffect(() => {
    requestAnimationFrame(() => {
      const b = bodyScrollRef.current
      if (b) setScrollLeft(b.scrollLeft || 0)
    })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  /** ================== ✅ Arrow navigation ================== */
  const inputRefs = useRef(new Map())
  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])
  const totalCols = cols.length

  const registerInput = useCallback((row, col) => {
    const key = `${row}|${col}`
    return (el) => {
      if (!el) inputRefs.current.delete(key)
      else inputRefs.current.set(key, el)
    }
  }, [])

  const ensureInView = useCallback((el) => {
    const container = bodyScrollRef.current
    if (!container || !el) return
    const pad = 12
    const frozenLeft = LEFT_W
    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()

    // vertical
    const topHidden = erect.top < crect.top + pad
    const bottomHidden = erect.bottom > crect.bottom - pad
    if (topHidden) container.scrollTop -= crect.top + pad - erect.top
    else if (bottomHidden) container.scrollTop += erect.bottom - (crect.bottom - pad)

    // horizontal
    const leftHidden = erect.left < crect.left + frozenLeft + pad
    const rightHidden = erect.right > crect.right - pad
    if (leftHidden) container.scrollLeft -= crect.left + frozenLeft + pad - erect.left
    else if (rightHidden) container.scrollLeft += erect.right - (crect.right - pad)
  }, [])

  const focusCell = useCallback(
    (rowIndex, colIndex) => {
      const r = itemRows[rowIndex]
      const c = cols[colIndex]
      if (!r || !c) return
      const el = inputRefs.current.get(`${r.code}|${c.key}`)
      if (el) {
        el.focus()
        el.select?.()
        ensureInView(el)
      }
    },
    [cols, ensureInView, itemRows]
  )

  const onKeyDownCell = useCallback(
    (e, rowIndex, colIndex) => {
      const key = e.key
      if (key === "Enter") {
        e.preventDefault()
        if (colIndex < totalCols - 1) focusCell(rowIndex, colIndex + 1)
        else focusCell(Math.min(itemRows.length - 1, rowIndex + 1), 0)
        return
      }
      if (key === "ArrowLeft") {
        e.preventDefault()
        focusCell(rowIndex, Math.max(0, colIndex - 1))
        return
      }
      if (key === "ArrowRight") {
        e.preventDefault()
        focusCell(rowIndex, Math.min(totalCols - 1, colIndex + 1))
        return
      }
      if (key === "ArrowUp") {
        e.preventDefault()
        focusCell(Math.max(0, rowIndex - 1), colIndex)
        return
      }
      if (key === "ArrowDown") {
        e.preventDefault()
        focusCell(Math.min(itemRows.length - 1, rowIndex + 1), colIndex)
      }
    },
    [focusCell, itemRows.length, totalCols]
  )

  /** ---------------- computed totals ---------------- */
  const computed = useMemo(() => {
    const rowTotal = {}
    const colTotal = {}
    cols.forEach((c) => (colTotal[c.key] = 0))

    // per item row
    for (const r of ROWS) {
      if (r.kind !== "item") continue
      const v = valuesByCode[r.code] || {}
      let sum = 0
      for (const c of cols) {
        const n = toNumber(v[c.key])
        sum += n
        colTotal[c.key] += n
      }
      rowTotal[r.code] = sum
    }

    // helper: sum item rows within section
    const sectionSum = (startCode, endCode) => {
      const codes = itemRows
        .map((x) => x.code)
        .filter((code) => code >= startCode && code <= endCode)
      const perCol = {}
      cols.forEach((c) => (perCol[c.key] = 0))
      let total = 0
      for (const code of codes) {
        const v = valuesByCode[code] || {}
        for (const c of cols) {
          const n = toNumber(v[c.key])
          perCol[c.key] += n
          total += n
        }
      }
      return { perCol, total }
    }

    const subtotals = {
      "1.T": sectionSum("1.1", "1.6"),
      "2.T": sectionSum("2.1", "2.4"),
      "3.T": sectionSum("3.1", "3.8"),
      "4.T": sectionSum("4.1", "4.11"),
      "5.T": sectionSum("5.1", "5.7"),
      "6.T": sectionSum("6.1", "6.3"),
    }

    // grand
    const grandPerCol = {}
    cols.forEach((c) => (grandPerCol[c.key] = 0))
    let grand = 0
    for (const k of Object.keys(subtotals)) {
      const s = subtotals[k]
      cols.forEach((c) => (grandPerCol[c.key] += s.perCol[c.key]))
      grand += s.total
    }

    return { rowTotal, colTotal, subtotals, grandPerCol, grand }
  }, [cols, itemRows, valuesByCode])

  const RIGHT_W = useMemo(() => cols.length * COL_W.cell + COL_W.total, [cols.length])
  const TOTAL_W = useMemo(() => LEFT_W + RIGHT_W, [RIGHT_W])

  /** ---------------- handlers ---------------- */
  const setCell = (code, colKey, raw) => {
    const v = sanitizeNumberInput(raw)
    setValuesByCode((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        [colKey]: v,
      },
    }))
  }

  const payload = useMemo(() => {
    const out = {
      period,
      branch_id: branchId || null,
      units: cols.map((c) => ({ unit_id: Number(c.key), unit_name: c.label })),
      items: [],
    }
    for (const r of ROWS) {
      if (r.kind !== "item") continue
      const v = valuesByCode[r.code] || {}
      const perUnit = {}
      cols.forEach((c) => (perUnit[c.key] = toNumber(v[c.key])))
      out.items.push({
        code: r.code,
        label: r.label,
        per_unit: perUnit,
        total: computed.rowTotal[r.code] || 0,
      })
    }
    out.subtotals = Object.fromEntries(
      Object.entries(computed.subtotals).map(([k, s]) => [
        k,
        { per_unit: s.perCol, total: s.total },
      ])
    )
    out.grand_total = { per_unit: computed.grandPerCol, total: computed.grand }
    return out
  }, [branchId, cols, computed, period, valuesByCode])

  return (
    <div className="w-full">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              รายได้เฉพาะ (ดึงหน่วยตามสาขา)
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              สาขา: {branchId ? `#${branchId}` : "— ยังไม่ได้เลือกสาขา —"}{" "}
              {isLoadingUnits ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
                  กำลังโหลดหน่วย...
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-[520px] md:flex-row md:justify-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">ช่วงแผน</label>
              <input className={baseField} value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>

            <div className="flex items-end gap-2">
              <button
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowPayload((s) => !s)}
                type="button"
              >
                {showPayload ? "ซ่อน JSON" : "ดู JSON"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* HEADER */}
          <div className={cx("border-b border-slate-200 dark:border-slate-700", STRIPE.head)}>
            <div className="flex w-full">
              {/* left frozen */}
              <div className="shrink-0" style={{ width: LEFT_W }}>
                <table className="border-collapse text-sm" style={{ width: LEFT_W, tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: COL_W.code }} />
                    <col style={{ width: COL_W.item }} />
                  </colgroup>
                  <thead>
                    <tr className="font-bold text-slate-800 dark:text-slate-100">
                      <th className="border border-slate-300 px-2 py-2 text-center dark:border-slate-600">รหัส</th>
                      <th className="border border-slate-300 px-3 py-2 text-left dark:border-slate-600">รายการ</th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* right scrollable */}
              <div className="flex-1 overflow-hidden">
                <div style={{ width: RIGHT_W }}>
                  <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                    <colgroup>
                      {cols.map((c) => (
                        <col key={`h-${c.key}`} style={{ width: COL_W.cell }} />
                      ))}
                      <col style={{ width: COL_W.total }} />
                    </colgroup>
                    <thead>
                      <tr className="font-bold text-slate-800 dark:text-slate-100">
                        {cols.map((c) => (
                          <th key={c.key} className="border border-slate-300 px-2 py-2 text-center dark:border-slate-600">
                            {c.label}
                          </th>
                        ))}
                        <th className="border border-slate-300 px-2 py-2 text-center dark:border-slate-600">รวม</th>
                      </tr>
                    </thead>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* BODY */}
          <div
            ref={tableCardRef}
            className="relative w-full"
            style={{ height: tableCardHeight, maxHeight: tableCardHeight }}
          >
            <div
              ref={bodyScrollRef}
              onScroll={onBodyScroll}
              className="absolute inset-0 overflow-auto overscroll-contain"
            >
              <div style={{ width: TOTAL_W }}>
                <div className="flex w-full">
                  {/* left frozen */}
                  <div className="shrink-0" style={{ width: LEFT_W }}>
                    <table className="border-collapse text-sm" style={{ width: LEFT_W, tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: COL_W.code }} />
                        <col style={{ width: COL_W.item }} />
                      </colgroup>
                      <tbody>
                        {ROWS.map((r, idx) => {
                          const isAlt = idx % 2 === 1
                          const bg = r.kind === "title" ? STRIPE.head : isAlt ? STRIPE.alt : STRIPE.cell
                          const font =
                            r.kind === "title"
                              ? "font-extrabold"
                              : r.kind === "section"
                                ? "font-bold"
                                : r.kind === "subtotal" || r.kind === "grandtotal"
                                  ? "font-extrabold"
                                  : "font-medium"
                          return (
                            <tr key={`L-${r.code}`} className={cx(bg, font)}>
                              <td className="border border-slate-300 px-2 py-2 text-center dark:border-slate-600">
                                {r.kind === "title" ? "" : r.code}
                              </td>
                              <td className="border border-slate-300 px-3 py-2 text-left dark:border-slate-600">
                                {r.label}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* right scrollable */}
                  <div className="flex-1 overflow-hidden">
                    <div style={{ width: RIGHT_W }}>
                      <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                        <colgroup>
                          {cols.map((c) => (
                            <col key={`b-${c.key}`} style={{ width: COL_W.cell }} />
                          ))}
                          <col style={{ width: COL_W.total }} />
                        </colgroup>

                        <tbody>
                          {ROWS.map((r, idx) => {
                            const isAlt = idx % 2 === 1
                            const bg = r.kind === "title" ? STRIPE.head : isAlt ? STRIPE.alt : STRIPE.cell
                            const font =
                              r.kind === "title"
                                ? "font-extrabold"
                                : r.kind === "section"
                                  ? "font-bold"
                                  : r.kind === "subtotal" || r.kind === "grandtotal"
                                    ? "font-extrabold"
                                    : "font-medium"

                            // item row index for navigation
                            const itemIndex = r.kind === "item" ? itemRows.findIndex((x) => x.code === r.code) : -1

                            if (r.kind === "title" || r.kind === "section") {
                              return (
                                <tr key={`R-${r.code}`} className={cx(bg, font)}>
                                  {cols.map((c) => (
                                    <td
                                      key={`${r.code}-${c.key}`}
                                      className="border border-slate-300 px-2 py-2 text-right dark:border-slate-600"
                                    />
                                  ))}
                                  <td className="border border-slate-300 px-2 py-2 text-right dark:border-slate-600" />
                                </tr>
                              )
                            }

                            if (r.kind === "subtotal") {
                              const s = computed.subtotals[r.code] || { perCol: {}, total: 0 }
                              return (
                                <tr key={`R-${r.code}`} className={cx(bg, font)}>
                                  {cols.map((c) => (
                                    <td
                                      key={`${r.code}-${c.key}`}
                                      className="border border-slate-300 px-2 py-2 text-right dark:border-slate-600"
                                    >
                                      {fmtMoney0(s.perCol?.[c.key] ?? 0)}
                                    </td>
                                  ))}
                                  <td className="border border-slate-300 px-2 py-2 text-right dark:border-slate-600">
                                    {fmtMoney0(s.total ?? 0)}
                                  </td>
                                </tr>
                              )
                            }

                            if (r.kind === "grandtotal") {
                              return (
                                <tr key={`R-${r.code}`} className={cx(bg, font, STRIPE.foot)}>
                                  {cols.map((c) => (
                                    <td
                                      key={`${r.code}-${c.key}`}
                                      className="border border-slate-300 px-2 py-2 text-right dark:border-slate-600"
                                    >
                                      {fmtMoney0(computed.grandPerCol?.[c.key] ?? 0)}
                                    </td>
                                  ))}
                                  <td className="border border-slate-300 px-2 py-2 text-right dark:border-slate-600">
                                    {fmtMoney0(computed.grand ?? 0)}
                                  </td>
                                </tr>
                              )
                            }

                            // item row
                            const v = valuesByCode[r.code] || {}
                            return (
                              <tr key={`R-${r.code}`} className={cx(bg, font)}>
                                {cols.map((c, colIndex) => (
                                  <td
                                    key={`${r.code}-${c.key}`}
                                    className="border border-slate-300 px-2 py-1.5 dark:border-slate-600"
                                  >
                                    <input
                                      ref={registerInput(r.code, c.key)}
                                      className={cellInput}
                                      inputMode="decimal"
                                      value={v[c.key] ?? ""}
                                      onChange={(e) => setCell(r.code, c.key, e.target.value)}
                                      onKeyDown={(e) => onKeyDownCell(e, itemIndex, colIndex)}
                                      placeholder="0"
                                    />
                                  </td>
                                ))}
                                <td className="border border-slate-300 px-2 py-2 text-right dark:border-slate-600">
                                  {fmtMoney0(computed.rowTotal[r.code] ?? 0)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER totals */}
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20">
            <div className="flex w-full">
              <div className="shrink-0" style={{ width: LEFT_W }}>
                <table className="border-collapse text-sm" style={{ width: LEFT_W, tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: COL_W.code }} />
                    <col style={{ width: COL_W.item }} />
                  </colgroup>
                  <tbody>
                    <tr className={cx("font-extrabold text-slate-900 dark:text-emerald-100", STRIPE.foot)}>
                      <td className="border border-slate-200 px-2 py-2 text-center dark:border-slate-700" />
                      <td className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">รวมรายได้</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex-1 overflow-hidden">
                <div style={{ width: RIGHT_W, transform: `translateX(-${scrollLeft}px)`, willChange: "transform" }}>
                  <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                    <colgroup>
                      {cols.map((c) => (
                        <col key={`f-${c.key}`} style={{ width: COL_W.cell }} />
                      ))}
                      <col style={{ width: COL_W.total }} />
                    </colgroup>
                    <tbody>
                      <tr className={cx("font-extrabold text-slate-900 dark:text-emerald-100", STRIPE.foot)}>
                        {cols.map((c) => (
                          <td
                            key={`ft-${c.key}`}
                            className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700"
                          >
                            {fmtMoney0(computed.colTotal?.[c.key] ?? 0)}
                          </td>
                        ))}
                        <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                          {fmtMoney0(computed.grand ?? 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {showPayload ? (
            <div className="p-3 md:p-4">
              <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Payload (debug)</div>
              <pre className="max-h-[420px] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          ) : null}

          <div className="shrink-0 p-3 md:p-4 text-sm text-slate-600 dark:text-slate-300">
            หมายเหตุ: ตอนนี้เพิ่ม “ดึงหน่วยตามสาขา” แล้ว (เหมือนหน้าธุรกิจจัดหา) — ถ้าจะผูก BE บันทึก/โหลดค่าล่าสุด เดี๋ยวต่อ endpoint ได้ต่อเลย
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessPlanRevenueByBusinessTable
