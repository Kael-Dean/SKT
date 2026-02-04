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
  const parts = cleaned.split(".")
  if (parts.length === 1) return parts[0]
  const intPart = parts[0]
  const decPart = parts.slice(1).join("").slice(0, maxDecimals)
  return `${intPart}.${decPart}`
}
const fmtMoney0 = (n) => {
  try {
    return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Number(n || 0))
  } catch {
    return String(n || 0)
  }
}

/** ---------------- Config ---------------- */
const BUSINESS_GROUP_ID = 2 // จัดหา-ปั๊มน้ำมัน
const COL_W = {
  code: 56,
  item: 360,
  unit: 140,
  total: 140,
}
const LEFT_W = COL_W.code + COL_W.item

const STRIPE = {
  head: "bg-slate-100 dark:bg-slate-700/70",
  foot: "bg-slate-200/70 dark:bg-slate-700/55",
  odd: "bg-white dark:bg-slate-800",
  even: "bg-slate-50 dark:bg-slate-900/30",
}

const trunc = "truncate"
const readonlyField =
  "rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-700/60 dark:text-white"
const cellInput =
  "w-full rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-right text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"

/** ---------------- Fake rows (replace with your actual list if needed) ---------------- */
const DEFAULT_ROWS = [
  { kind: "section", code: "1", label: "ต้นทุนขาย ธุรกิจจัดหาฯ-ปั๊มน้ำมัน" },
  { kind: "item", code: "1.1", label: "ค่าใช้จ่ายในการซื้อ", cost_id: 2 },
  { kind: "item", code: "1.2", label: "หักสินค้าเบิกใช้", cost_id: 46 },
  { kind: "sum", code: "1.sum", label: "รวมธุรกิจจัดหาฯ-ปั๊มน้ำมัน" },
]

/** ---------------- Component ---------------- */
function BusinessPlanExpenseOilTable({
  /** You can pass these from parent (OperationPlan) */
  planId,
  year,
  branchId,
  branchName,
  periodLabel = "",
  /** Provide your auth token getter / api wrapper if different */
  getToken,
  apiAuth,
  /** Optional: override default rows */
  rows = DEFAULT_ROWS,
  /** Optional: card height */
  tableCardHeight = 560,
}) {
  const tableCardRef = useRef(null)
  const bodyScrollRef = useRef(null)
  const inputRefs = useRef(new Map())

  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showPayload, setShowPayload] = useState(false)

  /** Units of selected branch */
  const [units, setUnits] = useState([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  /** Saved values from BE */
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  /** Cells: valuesByCode[code][unit_id] = string */
  const [valuesByCode, setValuesByCode] = useState({})

  /** Effective params */
  const effectivePlanId = Number(planId || 0)
  const effectiveYear = year || ""
  const effectiveBranchId = Number(branchId || 0)
  const effectiveBranchName = branchName || "-"

  /** Rows for table rendering */
  const ROWS = useMemo(() => rows, [rows])

  /** Only input rows */
  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [ROWS])

  /** Resolve business_cost_id from (cost_id, business_group) -> BusinessCost.id (via seed in FE) */
  // NOTE: You likely already have this in your project; keep the same function signature.
  const resolveBusinessCostId = useCallback((cost_id, business_group_id) => {
    // TODO: replace with your seed lookup mapping.
    // This is a placeholder that returns cost_id for demo only.
    // In your real app: return BusinessCost.id from mapping (cost_id + business_group).
    return Number(cost_id || 0)
  }, [])

  const resolveRowBusinessCostId = useCallback(
    (row) => resolveBusinessCostId(row.cost_id, BUSINESS_GROUP_ID),
    [resolveBusinessCostId]
  )

  /** ---------------- Load units ---------------- */
  const loadUnits = useCallback(async () => {
    if (!effectiveBranchId) return
    try {
      setIsLoadingUnits(true)
      const token = getToken?.()
      if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

      const res = await apiAuth(`/lists/unit/search?branch_id=${effectiveBranchId}`)
      const list = Array.isArray(res) ? res : res?.items || res?.data || []
      const normalized = list
        .map((x) => ({
          id: Number(x.id || x.unit_id || 0),
          name: String(x.name || x.unit_name || "-"),
        }))
        .filter((x) => x.id)

      setUnits(normalized)
    } catch (e) {
      setUnits([])
      setNotice({ type: "error", title: "โหลดหน่วยไม่สำเร็จ", detail: e?.message || String(e) })
    } finally {
      setIsLoadingUnits(false)
    }
  }, [effectiveBranchId, apiAuth, getToken])

  /** ---------------- Load saved values ---------------- */
  const loadSavedFromBE = useCallback(async () => {
    if (!effectivePlanId || !effectiveBranchId) return
    try {
      setIsLoadingSaved(true)
      const token = getToken?.()
      if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

      // NOTE: endpoint based on your BE; adjust if your read endpoint differs
      // Expect response: [{ business_cost_id, unit_id, amount, branch_total, ... }, ...]
      const res = await apiAuth(`/business-plan/${effectivePlanId}/costs?branch_id=${effectiveBranchId}`)
      const items = Array.isArray(res) ? res : res?.items || res?.data || []

      // Map back into valuesByCode by matching business_cost_id -> row.code
      const next = {}
      for (const r of itemRows) {
        const keep = {}
        for (const u of units) keep[u.id] = ""
        next[r.code] = keep
      }

      const bcToCode = new Map()
      for (const r of itemRows) {
        const bc = resolveRowBusinessCostId(r)
        if (bc) bcToCode.set(Number(bc), r.code)
      }

      for (const it of items) {
        const bc = Number(it.business_cost_id || 0)
        const code = bcToCode.get(bc)
        if (!code) continue
        // unit values: either direct unit_id+amount OR nested unit_values
        if (Array.isArray(it.unit_values)) {
          for (const uv of it.unit_values) {
            const uid = Number(uv.unit_id || 0)
            const amt = uv.amount ?? 0
            if (next[code] && uid) next[code][uid] = String(amt ?? "")
          }
        } else {
          const uid = Number(it.unit_id || 0)
          const amt = it.amount ?? 0
          if (next[code] && uid) next[code][uid] = String(amt ?? "")
        }
      }

      setValuesByCode(next)
    } catch (e) {
      console.error("[Oil Load saved] failed:", e)
      setNotice({ type: "error", title: "โหลดค่าที่บันทึกไว้ไม่สำเร็จ", detail: e?.message || String(e) })
    } finally {
      setIsLoadingSaved(false)
    }
  }, [effectivePlanId, effectiveBranchId, apiAuth, getToken, itemRows, units, resolveRowBusinessCostId])

  /** Init: units + saved */
  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  useEffect(() => {
    if (!units.length) return
    // ensure structure exists
    setValuesByCode((prev) => {
      const next = { ...prev }
      for (const r of itemRows) {
        if (!next[r.code]) next[r.code] = {}
        for (const u of units) {
          if (next[r.code][u.id] === undefined) next[r.code][u.id] = ""
        }
      }
      return next
    })
  }, [units, itemRows])

  useEffect(() => {
    if (!effectivePlanId || !effectiveBranchId) return
    if (!units.length) return
    loadSavedFromBE()
  }, [effectivePlanId, effectiveBranchId, units.length, loadSavedFromBE])

  /** ---------------- Table calc ---------------- */
  const computed = useMemo(() => {
    const unitTotal = {}
    for (const u of units) unitTotal[u.id] = 0

    const rowSumByCode = {}
    for (const r of itemRows) {
      const row = valuesByCode[r.code] || {}
      let sum = 0
      for (const u of units) {
        const n = toNumber(row[u.id])
        sum += n
        unitTotal[u.id] = (unitTotal[u.id] || 0) + n
      }
      rowSumByCode[r.code] = sum
    }

    const grand = Object.values(unitTotal).reduce((a, b) => a + (Number(b) || 0), 0)
    return { unitTotal, rowSumByCode, grand }
  }, [valuesByCode, units, itemRows])

  /** ---------------- Cell set ---------------- */
  const setCell = useCallback((code, unitId, v) => {
    setValuesByCode((prev) => {
      const next = { ...prev }
      next[code] = { ...(next[code] || {}) }
      next[code][unitId] = v
      return next
    })
  }, [])

  /** ---------------- Arrow nav ---------------- */
  const totalCols = useMemo(() => Math.max(1, units.length), [units.length])

  const ensureInView = useCallback((el) => {
    const container = bodyScrollRef.current
    if (!container || !el) return
    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()

    const visibleTop = crect.top + 8
    const visibleBottom = crect.bottom - 8

    if (erect.top < visibleTop) container.scrollTop -= visibleTop - erect.top
    else if (erect.bottom > visibleBottom) container.scrollTop += erect.bottom - visibleBottom
  }, [])

  const handleArrowNav = useCallback(
    (e) => {
      const k = e.key
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) return

      const row = Number(e.currentTarget.dataset.row ?? 0)
      const col = Number(e.currentTarget.dataset.col ?? 0)

      let nextRow = row
      let nextCol = col
      if (k === "ArrowLeft") nextCol = col - 1
      if (k === "ArrowRight") nextCol = col + 1
      if (k === "ArrowUp") nextRow = row - 1
      if (k === "ArrowDown") nextRow = row + 1

      if (nextRow < 0) nextRow = 0
      if (nextRow > itemRows.length - 1) nextRow = itemRows.length - 1
      if (nextCol < 0) nextCol = 0
      if (nextCol > Math.max(0, totalCols - 1)) nextCol = Math.max(0, totalCols - 1)

      const target = inputRefs.current.get(`${nextRow}|${nextCol}`)
      if (!target) return

      e.preventDefault()
      target.focus()
      try {
        target.select()
      } catch {}

      requestAnimationFrame(() => ensureInView(target))
    },
    [ensureInView, itemRows.length, totalCols]
  )

  /** ---------------- Save (bulk) ---------------- */
  const buildBulkRowsForBE = useCallback(() => {
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error("FE: plan_id ไม่ถูกต้อง")
    if (!effectiveBranchId) throw new Error("FE: ยังไม่ได้เลือกสาขา")
    if (!units.length) throw new Error("FE: สาขานี้ไม่มีหน่วย หรือโหลดหน่วยไม่สำเร็จ")

    const rows = []
    for (const r of itemRows) {
      const businessCostId = resolveRowBusinessCostId(r)
      if (!businessCostId) throw new Error(`FE: หา business_cost_id ไม่เจอ (code=${r.code})`)

      const row = valuesByCode[r.code] || {}
      const unit_values = []
      let branch_total = 0

      for (const u of units) {
        const amount = toNumber(row[u.id])
        branch_total += amount
        unit_values.push({ unit_id: u.id, amount })
      }

      rows.push({
        branch_id: effectiveBranchId,
        business_cost_id: businessCostId,
        unit_values,
        branch_total,
        comment: periodLabel,
      })
    }

    return { rows }
  }, [effectivePlanId, effectiveBranchId, units, itemRows, valuesByCode, periodLabel, resolveRowBusinessCostId])

  const payloadPreview = useMemo(() => {
    try {
      const body = buildBulkRowsForBE()
      return { plan_id: effectivePlanId, endpoint: `/business-plan/${effectivePlanId}/costs/bulk`, body }
    } catch (e) {
      return { error: e?.message || String(e) }
    }
  }, [buildBulkRowsForBE, effectivePlanId])

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payloadPreview, null, 2))
      setNotice({ type: "success", title: "คัดลอก JSON แล้ว ✅", detail: "คัดลอก payload ที่ส่งเข้า BE แล้ว" })
    } catch (e) {
      setNotice({ type: "error", title: "คัดลอกไม่สำเร็จ", detail: e?.message || String(e) })
      setShowPayload(true)
    }
  }

  const saveToBE = async () => {
    try {
      setNotice(null)
      const token = getToken?.()
      if (!token) throw new Error("FE: ไม่พบ token → ต้อง Login ก่อน")

      const body = buildBulkRowsForBE()
      setIsSaving(true)

      await apiAuth(`/business-plan/${effectivePlanId}/costs/bulk`, {
        method: "POST",
        body,
      })

      setNotice({
        type: "success",
        title: "บันทึกสำเร็จ ✅",
        detail: `plan_id=${effectivePlanId} • สาขา ${effectiveBranchName}`,
      })

      await loadSavedFromBE()
    } catch (e) {
      setNotice({ type: "error", title: "บันทึกไม่สำเร็จ ❌", detail: e?.message || String(e) })
      console.error("[Oil Save] failed:", e)
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
    setNotice({ type: "info", title: "ล้างข้อมูลแล้ว", detail: "รีเซ็ตค่าที่กรอกเป็นว่าง" })
  }

  const NoticeBox = ({ notice }) => {
    if (!notice) return null
    const isErr = notice.type === "error"
    const isOk = notice.type === "success"
    const cls = isErr
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200"
      : isOk
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
      : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
    return (
      <div className={cx("mb-3 rounded-2xl border p-3 text-sm", cls)}>
        <div className="font-extrabold">{notice.title}</div>
        {notice.detail && <div className="mt-1 text-[13px] opacity-95">{notice.detail}</div>}
      </div>
    )
  }

  /** widths depend on units */
  const RIGHT_W = Math.max(1, units.length) * COL_W.unit + COL_W.total
  const TOTAL_W = LEFT_W + RIGHT_W

  const stickyLeftHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyCodeHeader =
    "sticky left-0 z-[95] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyCodeCell = "sticky left-0 z-[70] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-lg font-bold">ประมาณการค่าใช้จ่ายแผนธุรกิจ (ธุรกิจปั๊มน้ำมัน)</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              ({periodLabel}) • ปี {effectiveYear} • plan_id {effectivePlanId} • สาขา {effectiveBranchName} • หน่วย{" "}
              {isLoadingUnits ? "กำลังโหลด..." : units.length}
              {isLoadingSaved ? " • โหลดค่าที่บันทึกไว้..." : ""}
            </div>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              รวมทั้งหมด (บาท): <span className="font-extrabold">{fmtMoney0(computed.grand)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={copyPayload}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white
                         shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                         hover:bg-emerald-700 hover:scale-[1.03] active:scale-[.98] transition cursor-pointer"
            >
              คัดลอก JSON
            </button>

            <button
              type="button"
              onClick={() => setShowPayload((v) => !v)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              {showPayload ? "ซ่อน payload" : "ดู payload"}
            </button>

            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              ล้างข้อมูล
            </button>
          </div>
        </div>

        {showPayload && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800
                          dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
            <pre className="max-h-72 overflow-auto">{JSON.stringify(payloadPreview, null, 2)}</pre>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</div>
            <div className={readonlyField}>{effectiveBranchName}</div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">หน่วยของสาขา</div>
            <div className={readonlyField}>{isLoadingUnits ? "กำลังโหลด..." : `มี ${units.length} หน่วย`}</div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">รวมทั้งหมด (บาท)</div>
            <div className={readonlyField}>{fmtMoney0(computed.grand)}</div>
          </div>
        </div>
      </div>

      <NoticeBox notice={notice} />

      {/* Table */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div className="p-2 md:p-3 shrink-0">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-base md:text-lg font-bold">ตารางค่าใช้จ่าย (กรอกได้)</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              * พิมพ์ตัวเลขได้เลย (Arrow keys วิ่งข้ามช่องได้)
            </div>
          </div>
        </div>

        <div
          ref={bodyScrollRef}
          className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700"
        >
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {units.length ? units.map((u) => <col key={u.id} style={{ width: COL_W.unit }} />) : <col style={{ width: COL_W.unit }} />}
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
              {ROWS.map((r, idx) => {
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

                if (r.kind === "sum") {
                  const sum = computed.grand
                  return (
                    <tr key={r.code} className={cx("text-slate-900 dark:text-slate-100", STRIPE.foot)}>
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
                        title={r.label}
                      >
                        {r.label}
                      </td>

                      {units.length ? (
                        units.map((u) => (
                          <td
                            key={`sum-${u.id}`}
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
                        {fmtMoney0(sum)}
                      </td>
                    </tr>
                  )
                }

                // item
                const stripe = idx % 2 === 0 ? STRIPE.even : STRIPE.odd
                const rowSum = computed.rowSumByCode[r.code] || 0

                return (
                  <tr key={r.code} className={cx("text-slate-800 dark:text-slate-100", stripe)}>
                    <td
                      className={cx(
                        "border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600",
                        stickyCodeCell,
                        stripe
                      )}
                    >
                      {r.code}
                    </td>

                    <td
                      className={cx(
                        "border border-slate-300 px-2 py-2 text-left text-xs dark:border-slate-600",
                        "sticky z-[50]",
                        stripe,
                        trunc
                      )}
                      style={{ left: COL_W.code }}
                      title={r.label}
                    >
                      {r.label}
                    </td>

                    {units.length ? (
                      units.map((u, colIdx) => (
                        <td key={`${r.code}-${u.id}`} className="border border-slate-300 px-1 py-2 dark:border-slate-600">
                          <input
                            ref={(() => {
                              const key = `${itemRows.findIndex((x) => x.code === r.code)}|${colIdx}`
                              return (el) => {
                                if (!el) inputRefs.current.delete(key)
                                else inputRefs.current.set(key, el)
                              }
                            })()}
                            data-row={itemRows.findIndex((x) => x.code === r.code)}
                            data-col={colIdx}
                            onKeyDown={handleArrowNav}
                            className={cellInput}
                            value={valuesByCode?.[r.code]?.[u.id] ?? ""}
                            inputMode="decimal"
                            placeholder="0"
                            onChange={(e) => setCell(r.code, u.id, sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))}
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

        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              ยิงหน่วยจาก: <span className="font-mono">GET /lists/unit/search?branch_id=...</span> • บันทึก:{" "}
              <span className="font-mono">POST /business-plan/{`{plan_id}`}/costs/bulk</span> • plan_id{" "}
              <span className="font-mono">{effectivePlanId}</span> • สาขา {effectiveBranchName}
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

export default BusinessPlanExpenseOilTable
