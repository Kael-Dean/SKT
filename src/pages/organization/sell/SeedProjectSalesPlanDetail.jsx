import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"

/* รายละเอียดแผนโครงการผลิตเมล็ดพันธุ์ — ยอดขาย (ตารางตามภาพ) */

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

const fmtQty = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(toNumber(n))
const fmtPrice = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(toNumber(n))
// ตารางนี้ “หน่วย : พันบาท” ตามภาพ -> ปกติเลขมักออกเป็นจำนวนเต็ม
const fmtMoney = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const cellTextInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-left text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const MONTHS = [
  { key: "m04", label: "เม.ย.", colNo: 4 },
  { key: "m05", label: "พ.ค.", colNo: 5 },
  { key: "m06", label: "มิ.ย.", colNo: 6 },
  { key: "m07", label: "ก.ค.", colNo: 7 },
  { key: "m08", label: "ส.ค.", colNo: 8 },
  { key: "m09", label: "ก.ย.", colNo: 9 },
  { key: "m10", label: "ต.ค.", colNo: 10 },
  { key: "m11", label: "พ.ย.", colNo: 11 },
  { key: "m12", label: "ธ.ค.", colNo: 12 },
  { key: "m01", label: "ม.ค.", colNo: 13 },
  { key: "m02", label: "ก.พ.", colNo: 14 },
  { key: "m03", label: "มี.ค.", colNo: 15 },
]

// ให้ “เหมือน Excel ในรูป” = มีหลายบรรทัดว่างให้กรอก
const DEFAULT_ROWS = 12
const makeRow = (i) => ({
  id: `row_${i + 1}`,
  name: i === 0 ? "เมล็ดพันธุ์ข้าว" : "",
  unit: "ตัน",
  unitPrice: "",
})

function buildInitialRows() {
  return Array.from({ length: DEFAULT_ROWS }, (_, i) => makeRow(i))
}
function buildInitialQty(rows) {
  const out = {}
  rows.forEach((r) => {
    out[r.id] = {}
    MONTHS.forEach((m) => (out[r.id][m.key] = ""))
  })
  return out
}

const COL_W = { product: 320, unit: 80, price: 120, month: 86, totalQty: 120, totalAmt: 150 }
const LEFT_W = COL_W.product + COL_W.unit + COL_W.price
const RIGHT_W = MONTHS.length * COL_W.month + COL_W.totalQty + COL_W.totalAmt
const TOTAL_W = LEFT_W + RIGHT_W

const STRIPE = {
  headEven: "bg-slate-100/90 dark:bg-slate-700/70",
  headOdd: "bg-slate-200/95 dark:bg-slate-600/70",
  cellEven: "bg-white dark:bg-slate-900",
  cellOdd: "bg-slate-50 dark:bg-slate-800",
  footEven: "bg-emerald-100/55 dark:bg-emerald-900/15",
  footOdd: "bg-emerald-200/75 dark:bg-emerald-900/30",
}
const monthStripeHead = (idx) => (idx % 2 === 1 ? STRIPE.headOdd : STRIPE.headEven)
const monthStripeCell = (idx) => (idx % 2 === 1 ? STRIPE.cellOdd : STRIPE.cellEven)
const monthStripeFoot = (idx) => (idx % 2 === 1 ? STRIPE.footOdd : STRIPE.footEven)

// “เส้นตารางแบบ Excel” (ประมาณใกล้เคียง) — ใช้ dotted
const gridCell = "border border-slate-300 border-dotted dark:border-slate-600"

const SeedProjectSalesPlanDetail = ({ branchId, branchName, yearBE, onYearBEChange }) => {
  const [rows, setRows] = useState(() => buildInitialRows())
  const [qtyById, setQtyById] = useState(() => buildInitialQty(buildInitialRows()))
  const [showPayload, setShowPayload] = useState(false)
  const canEdit = !!branchId

  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(760)
  const recalcTableCardHeight = useCallback(() => {
    const el = tableCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 800
    const h = Math.max(700, Math.floor(vh - rect.top - 4))
    setTableCardHeight(h)
  }, [])
  useEffect(() => {
    recalcTableCardHeight()
    window.addEventListener("resize", recalcTableCardHeight)
    return () => window.removeEventListener("resize", recalcTableCardHeight)
  }, [recalcTableCardHeight])

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
    return () => rafRef.current && cancelAnimationFrame(rafRef.current)
  }, [])

  // Arrow nav (ราคา + เดือนตัน)
  const inputRefs = useRef(new Map())
  const qtyCols = MONTHS.length
  const totalCols = 1 + qtyCols // 0=ราคา, 1..=เดือนตัน
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
    const frozenLeft = COL_W.product
    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()
    const visibleLeft = crect.left + frozenLeft + pad
    const visibleRight = crect.right - pad
    const visibleTop = crect.top + pad
    const visibleBottom = crect.bottom - pad
    if (erect.left < visibleLeft) container.scrollLeft -= visibleLeft - erect.left
    else if (erect.right > visibleRight) container.scrollLeft += erect.right - visibleRight
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
      if (nextRow > rows.length - 1) nextRow = rows.length - 1
      if (nextCol < 0) nextCol = 0
      if (nextCol > totalCols - 1) nextCol = totalCols - 1
      const target = inputRefs.current.get(`${nextRow}|${nextCol}`)
      if (!target) return
      e.preventDefault()
      target.focus()
      try {
        target.select()
      } catch {}
      requestAnimationFrame(() => ensureInView(target))
    },
    [ensureInView, rows.length, totalCols]
  )

  const getQtyColIndex = (monthIdx) => 1 + monthIdx

  const setRowMeta = (rowId, patch) =>
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))

  const setQtyCell = (rowId, monthKey, nextValue) =>
    setQtyById((prev) => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [monthKey]: nextValue } }))

  const computed = useMemo(() => {
    const rowTotals = {}
    const monthQtyTotals = {}
    const monthAmtTotals = {}
    let grandQty = 0
    let grandAmt = 0

    MONTHS.forEach((m) => {
      monthQtyTotals[m.key] = 0
      monthAmtTotals[m.key] = 0
    })

    rows.forEach((r) => {
      const price = toNumber(r.unitPrice)
      let rowQty = 0
      let rowAmt = 0
      MONTHS.forEach((m) => {
        const q = toNumber(qtyById?.[r.id]?.[m.key])
        const amt = q * price
        rowQty += q
        rowAmt += amt
        monthQtyTotals[m.key] += q
        monthAmtTotals[m.key] += amt
      })
      grandQty += rowQty
      grandAmt += rowAmt
      rowTotals[r.id] = { qty: rowQty, amt: rowAmt }
    })

    return { rowTotals, monthQtyTotals, monthAmtTotals, grandQty, grandAmt }
  }, [rows, qtyById])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    const freshRows = buildInitialRows()
    setRows(freshRows)
    setQtyById(buildInitialQty(freshRows))
  }

  const payload = useMemo(() => {
    return {
      table_code: "SEED_PROJECT_SALES_PLAN_DETAIL",
      table_name: "รายละเอียดแผนโครงการผลิตเมล็ดพันธุ์ (ยอดขาย)",
      year_be: yearBE,
      branch_id: branchId ? Number(branchId) : null,
      branch_name: branchName || null,
      unit_note: "พันบาท",
      months: MONTHS.map((m) => ({ key: m.key, label: m.label })),
      rows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        unit: r.unit,
        unit_price: toNumber(r.unitPrice),
        values: MONTHS.reduce((acc, m) => {
          acc[m.key] = toNumber(qtyById?.[r.id]?.[m.key])
          return acc
        }, {}),
        totals: computed.rowTotals?.[r.id] ?? { qty: 0, amt: 0 },
      })),
      totals: {
        month_qty: computed.monthQtyTotals,
        month_amount: computed.monthAmtTotals,
        grand_qty: computed.grandQty,
        grand_amount: computed.grandAmt,
      },
    }
  }, [yearBE, branchId, branchName, rows, qtyById, computed])

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      alert("คัดลอก JSON payload แล้ว ✅")
    } catch (e) {
      console.error(e)
      alert("คัดลอกไม่สำเร็จ — เปิด payload แล้ว copy เองได้ครับ")
      setShowPayload(true)
    }
  }

  const stickyProductHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyProductCellBase = "sticky left-0 z-[60] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  return (
    <div className="space-y-3">
      {/* header card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="relative">
              <div className="text-center">
                <div className="text-lg font-bold">ยอดขาย</div>
                <div className="text-xl md:text-2xl font-extrabold">
                  รายละเอียดแผนโครงการผลิตเมล็ดพันธุ์ของ สกต. สุรินทร์ จำกัด
                </div>
                <div className="mt-1 text-base font-bold">ปี {yearBE || "—"}</div>
              </div>

              <div className="absolute right-0 top-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
                หน่วย : <span className="font-extrabold">พันบาท</span>
              </div>

              <div className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">
                * กรอก “ตัน” แล้วระบบคำนวณ “บาท(พันบาท)” ให้ (จำนวน × ราคา/หน่วย)
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ปี (พ.ศ.)</label>
                <input
                  className={baseField}
                  value={yearBE}
                  onChange={(e) => onYearBEChange?.(e.target.value)}
                  placeholder="เช่น 2568"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</label>
                <div className={cx(baseField, "flex items-center justify-between", !branchId && "opacity-70")}>
                  <span className="font-semibold">{branchName ? branchName : "— ยังไม่เลือกสาขา —"}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-300">id: {branchId || "—"}</span>
                </div>
                {!branchId && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">* กลับไปเลือกสาขาด้านบนก่อน</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={copyPayload}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white
                         shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                         hover:bg-emerald-700 hover:scale-[1.03] active:scale-[.98] transition cursor-pointer"
            >
              คัดลอก JSON (รอส่ง BE)
            </button>

            <button
              type="button"
              onClick={() => setShowPayload((v) => !v)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              {showPayload ? "ซ่อน payload" : "ดู payload"}
            </button>

            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              ล้างข้อมูล
            </button>
          </div>
        </div>

        {showPayload && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
            <pre className="max-h-72 overflow-auto">{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* table card */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div className="p-2 md:p-3 shrink-0">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-base md:text-lg font-bold">
              ตารางกรอกข้อมูล — {branchName ? `สาขา: ${branchName}` : "ยังไม่เลือกสาขา"}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              * ช่อง “ประเภทสินค้า” กรอกชื่อได้เหมือนแบบฟอร์ม Excel
            </div>
          </div>
        </div>

        <div
          ref={bodyScrollRef}
          onScroll={onBodyScroll}
          className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700"
        >
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.product }} />
              <col style={{ width: COL_W.unit }} />
              <col style={{ width: COL_W.price }} />
              {MONTHS.map((m) => (
                <col key={`c-${m.key}`} style={{ width: COL_W.month }} />
              ))}
              <col style={{ width: COL_W.totalQty }} />
              <col style={{ width: COL_W.totalAmt }} />
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              {/* header row 1 */}
              <tr className="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                <th rowSpan={2} className={cx(gridCell, "px-3 py-2 text-left", stickyProductHeader)}>
                  ประเภทสินค้า
                </th>
                <th rowSpan={2} className={cx(gridCell, "px-3 py-2 text-center")}>
                  หน่วยนับ
                </th>
                <th rowSpan={2} className={cx(gridCell, "px-3 py-2 text-center")}>
                  ราคา<br />
                  ต่อหน่วย<br />
                  <span className="text-xs font-medium">(บาท)</span>
                </th>

                <th colSpan={MONTHS.length} className={cx(gridCell, "px-3 py-2 text-center font-extrabold")}>
                  มูลค่าสินค้าที่ขายในแต่ละเดือน <span className="font-bold">(พันบาท)</span>
                </th>

                <th colSpan={2} className={cx(gridCell, "px-3 py-2 text-center font-extrabold")}>
                  รวมทั้งหมด
                </th>
              </tr>

              {/* header row 2 (months + total labels) */}
              <tr className="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                {MONTHS.map((m, idx) => (
                  <th
                    key={`h-${m.key}`}
                    className={cx(gridCell, "px-2 py-2 text-center text-xs md:text-sm", monthStripeHead(idx))}
                  >
                    {m.label}
                  </th>
                ))}
                <th className={cx(gridCell, "px-2 py-2 text-center text-xs md:text-sm")}>จำนวนหน่วย</th>
                <th className={cx(gridCell, "px-2 py-2 text-center text-xs md:text-sm")}>
                  จำนวนเงิน<br />
                  <span className="text-xs font-medium">(พันบาท)</span>
                </th>
              </tr>

              {/* header row 3 (column numbers (1)-(17)) */}
              <tr className="bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <th className={cx(gridCell, "px-3 py-1 text-center text-[11px]", stickyProductHeader)}>(1)</th>
                <th className={cx(gridCell, "px-3 py-1 text-center text-[11px]")}>(2)</th>
                <th className={cx(gridCell, "px-3 py-1 text-center text-[11px]")}>(3)</th>
                {MONTHS.map((m, idx) => (
                  <th
                    key={`no-${m.key}`}
                    className={cx(gridCell, "px-2 py-1 text-center text-[11px]", monthStripeHead(idx))}
                  >
                    ({m.colNo})
                  </th>
                ))}
                <th className={cx(gridCell, "px-2 py-1 text-center text-[11px]")}>(16)</th>
                <th className={cx(gridCell, "px-2 py-1 text-center text-[11px]")}>(17)</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => {
                const rowBg = idx % 2 === 1 ? "bg-slate-50 dark:bg-slate-800" : "bg-white dark:bg-slate-900"
                const totalQty = computed.rowTotals?.[r.id]?.qty ?? 0
                const totalAmt = computed.rowTotals?.[r.id]?.amt ?? 0
                const price = toNumber(r.unitPrice)

                return (
                  <Fragment key={r.id}>
                    {/* qty row */}
                    <tr className={rowBg}>
                      <td
                        rowSpan={2}
                        className={cx(gridCell, "px-3 py-2 font-semibold", stickyProductCellBase, rowBg)}
                      >
                        <input
                          className={cx(cellTextInput, "font-semibold")}
                          value={r.name ?? ""}
                          disabled={!canEdit}
                          placeholder="พิมพ์ประเภทสินค้า..."
                          onChange={(e) => setRowMeta(r.id, { name: e.target.value })}
                        />
                      </td>

                      <td className={cx(gridCell, "px-3 py-2 text-center font-semibold")}>
                        {r.unit || "ตัน"}
                      </td>

                      <td className={cx(gridCell, "px-3 py-2")}>
                        <input
                          ref={registerInput(idx, 0)}
                          data-row={idx}
                          data-col={0}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={r.unitPrice ?? ""}
                          disabled={!canEdit}
                          inputMode="decimal"
                          placeholder="0"
                          onChange={(e) => setRowMeta(r.id, { unitPrice: sanitizeNumberInput(e.target.value) })}
                        />
                      </td>

                      {MONTHS.map((m, mi) => {
                        const col = getQtyColIndex(mi)
                        return (
                          <td
                            key={`${r.id}-${m.key}-qty`}
                            className={cx(gridCell, "px-2 py-2", monthStripeCell(mi))}
                          >
                            <input
                              ref={registerInput(idx, col)}
                              data-row={idx}
                              data-col={col}
                              onKeyDown={handleArrowNav}
                              className={cellInput}
                              value={qtyById?.[r.id]?.[m.key] ?? ""}
                              disabled={!canEdit}
                              inputMode="decimal"
                              placeholder={r.name ? "0" : ""}
                              onChange={(e) => setQtyCell(r.id, m.key, sanitizeNumberInput(e.target.value))}
                            />
                          </td>
                        )
                      })}

                      <td className={cx(gridCell, "px-2 py-2 text-right font-extrabold")}>{fmtQty(totalQty)}</td>
                      <td className={cx(gridCell, "px-2 py-2")} />
                    </tr>

                    {/* amount row */}
                    <tr className={rowBg}>
                      <td className={cx(gridCell, "px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200")}>
                        บาท
                      </td>
                      <td className={cx(gridCell, "px-3 py-2")} />
                      {MONTHS.map((m, mi) => {
                        const q = toNumber(qtyById?.[r.id]?.[m.key])
                        const amt = q * price
                        return (
                          <td
                            key={`${r.id}-${m.key}-amt`}
                            className={cx(
                              gridCell,
                              "px-2 py-2 text-right text-slate-700 dark:text-slate-200",
                              monthStripeCell(mi)
                            )}
                          >
                            {r.name ? fmtMoney(amt) : ""}
                          </td>
                        )
                      })}
                      <td className={cx(gridCell, "px-2 py-2")} />
                      <td className={cx(gridCell, "px-2 py-2 text-right font-extrabold")}>
                        {r.name ? fmtMoney(totalAmt) : ""}
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* footer totals (ล็อกด้านล่าง + เลื่อนไปพร้อมกัน) */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex w-full">
            <div className="shrink-0" style={{ width: LEFT_W }}>
              <table className="border-collapse text-sm" style={{ width: LEFT_W, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: COL_W.product }} />
                  <col style={{ width: COL_W.unit }} />
                  <col style={{ width: COL_W.price }} />
                </colgroup>
                <tbody>
                  <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                    <td className={cx(gridCell, "px-3 py-2")}>รวม</td>
                    <td className={cx(gridCell, "px-2 py-2 text-center")}>ตัน</td>
                    <td className={cx(gridCell, "px-2 py-2 text-right text-slate-600 dark:text-slate-300")}>
                      {/* ช่องราคาของ “รวม” ในภาพจริงมักไม่ใช้งาน */}
                      {""}
                    </td>
                  </tr>
                  <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                    <td className={cx(gridCell, "px-3 py-2")}>{""}</td>
                    <td className={cx(gridCell, "px-2 py-2 text-center")}>บาท</td>
                    <td className={cx(gridCell, "px-2 py-2 text-right text-slate-600 dark:text-slate-300")}>
                      {/* เว้นว่างให้เหมือนฟอร์ม */}
                      {""}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex-1 overflow-hidden">
              <div style={{ width: RIGHT_W, transform: `translateX(-${scrollLeft}px)`, willChange: "transform" }}>
                <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                  <colgroup>
                    {MONTHS.map((m) => (
                      <col key={`f-${m.key}`} style={{ width: COL_W.month }} />
                    ))}
                    <col style={{ width: COL_W.totalQty }} />
                    <col style={{ width: COL_W.totalAmt }} />
                  </colgroup>
                  <tbody>
                    {/* totals qty row */}
                    <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                      {MONTHS.map((m, idx) => (
                        <td key={`tq-${m.key}`} className={cx(gridCell, "px-2 py-2 text-right", monthStripeFoot(idx))}>
                          {fmtQty(computed.monthQtyTotals?.[m.key] ?? 0)}
                        </td>
                      ))}
                      <td className={cx(gridCell, "px-2 py-2 text-right")}>{fmtQty(computed.grandQty ?? 0)}</td>
                      <td className={cx(gridCell, "px-2 py-2")} />
                    </tr>

                    {/* totals amount row */}
                    <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                      {MONTHS.map((m, idx) => (
                        <td key={`ta-${m.key}`} className={cx(gridCell, "px-2 py-2 text-right", monthStripeFoot(idx))}>
                          {fmtMoney(computed.monthAmtTotals?.[m.key] ?? 0)}
                        </td>
                      ))}
                      <td className={cx(gridCell, "px-2 py-2")} />
                      <td className={cx(gridCell, "px-2 py-2 text-right")}>{fmtMoney(computed.grandAmt ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-3 md:p-4 text-sm text-slate-600 dark:text-slate-300">
          หมายเหตุ: ตอนนี้ยังเป็น Mock สำหรับกรอกข้อมูล/รวมยอด/เตรียม JSON เท่านั้น (ยังไม่บันทึกลง BE)
        </div>
      </div>
    </div>
  )
}

export default SeedProjectSalesPlanDetail
