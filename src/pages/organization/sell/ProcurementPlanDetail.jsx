import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"

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
const fmtQty = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(toNumber(n))
const fmtMoney = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(toNumber(n))

/** ---------------- UI styles ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

/** ✅ input พอดีกับ cell + ทึบ */
const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

/** ---------------- Table definition ---------------- */
const MONTHS = [
  { key: "m04", label: "เม.ย.", month: 4 },
  { key: "m05", label: "พ.ค.", month: 5 },
  { key: "m06", label: "มิ.ย.", month: 6 },
  { key: "m07", label: "ก.ค.", month: 7 },
  { key: "m08", label: "ส.ค.", month: 8 },
  { key: "m09", label: "ก.ย.", month: 9 },
  { key: "m10", label: "ต.ค.", month: 10 },
  { key: "m11", label: "พ.ย.", month: 11 },
  { key: "m12", label: "ธ.ค.", month: 12 },
  { key: "m01", label: "ม.ค.", month: 1 },
  { key: "m02", label: "ก.พ.", month: 2 },
  { key: "m03", label: "มี.ค.", month: 3 },
]

const METRICS = [
  { key: "pr", label: "ปร" },
  { key: "recv", label: "รับ" },
  { key: "ph", label: "พร" },
]

const DEFAULT_ITEMS = [
  { id: "fertilizer", name: "ปุ๋ย", unit: "ตัน", unitPrice: 16.5 },
  { id: "seed", name: "เมล็ดพันธุ์ (จัดหา)", unit: "ตัน", unitPrice: 25.0 },
  { id: "chem", name: "เคมีการเกษตร", unit: "ขวด", unitPrice: 0.5 },
  { id: "agri_machine_vat", name: "จักรกลเกษตร (VAT)", unit: "เครื่อง", unitPrice: 6.0 },
  { id: "general_vat", name: "สินค้าทั่วไป (VAT)", unit: "ชิ้น", unitPrice: 0.05 },
  { id: "animal_feed", name: "อาหารสัตว์", unit: "ลัง", unitPrice: 0.6 },
  { id: "general", name: "สินค้าทั่วไป", unit: "ชิ้น", unitPrice: 0.008 },
  { id: "fruit", name: "ผลไม้", unit: "กก.", unitPrice: 0.016 },
  { id: "fuel", name: "น้ำมันเชื้อเพลิง", unit: "ลิตร", unitPrice: 33.0 },
  { id: "consignment_machine", name: "จักรกลฝากขาย", unit: "เครื่อง", unitPrice: 1.0 },
]

function buildInitialQty() {
  const out = {}
  DEFAULT_ITEMS.forEach((it) => {
    out[it.id] = {}
    MONTHS.forEach((m) => {
      out[it.id][m.key] = {}
      METRICS.forEach((k) => {
        out[it.id][m.key][k.key] = ""
      })
    })
  })
  return out
}

function buildInitialPrice() {
  const out = {}
  DEFAULT_ITEMS.forEach((it) => {
    out[it.id] = String(it.unitPrice ?? "")
  })
  return out
}

/** ✅ lock width ให้ตรงกันทุกส่วน */
const COL_W = {
  product: 260,
  unit: 84,
  price: 130,
  cell: 86, // ปร/รับ/พร และรวม
}

const LEFT_W = COL_W.product + COL_W.unit + COL_W.price
const RIGHT_W = (MONTHS.length * METRICS.length + METRICS.length) * COL_W.cell
const TOTAL_W = LEFT_W + RIGHT_W

/** ✅ Stripe สีเดือน คู่/คี่ ให้เห็นชัดขึ้น */
const STRIPE = {
  headEven: "bg-slate-100/90 dark:bg-slate-700/70",
  headOdd: "bg-slate-200/95 dark:bg-slate-600/70",
  cellEven: "bg-slate-50/90 dark:bg-slate-800/70",
  cellOdd: "bg-slate-200/70 dark:bg-slate-700/55",
  footEven: "bg-emerald-100/55 dark:bg-emerald-900/15",
  footOdd: "bg-emerald-200/75 dark:bg-emerald-900/30",
}

const monthStripeHead = (idx) => (idx % 2 === 1 ? STRIPE.headOdd : STRIPE.headEven)
const monthStripeCell = (idx) => (idx % 2 === 1 ? STRIPE.cellOdd : STRIPE.cellEven)
const monthStripeFoot = (idx) => (idx % 2 === 1 ? STRIPE.footOdd : STRIPE.footEven)

const ProcurementPlanDetail = ({ branchId, branchName, yearBE, onYearBEChange }) => {
  const [priceById, setPriceById] = useState(() => buildInitialPrice())
  const [qtyById, setQtyById] = useState(() => buildInitialQty())
  const [showPayload, setShowPayload] = useState(false)
  const canEdit = !!branchId

  /** ✅ ทำกล่องตารางให้สูงเต็มจอ */
  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(760)

  const recalcTableCardHeight = useCallback(() => {
    const el = tableCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 800
    const bottomPadding = 4
    const h = Math.max(700, Math.floor(vh - rect.top - bottomPadding))
    setTableCardHeight(h)
  }, [])

  useEffect(() => {
    recalcTableCardHeight()
    window.addEventListener("resize", recalcTableCardHeight)
    return () => window.removeEventListener("resize", recalcTableCardHeight)
  }, [recalcTableCardHeight])

  useEffect(() => {
    requestAnimationFrame(() => recalcTableCardHeight())
  }, [showPayload, branchName, yearBE, recalcTableCardHeight])

  /** ✅ เก็บ scrollLeft ของ body เพื่อให้ footer ขวาเลื่อนตามแบบ 1:1 */
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

  /** ================== ✅ Arrow navigation + auto scroll ================== */
  const inputRefs = useRef(new Map())

  const qtyCols = MONTHS.length * METRICS.length // จำนวนช่องกรอก (ไม่รวมราคา)
  const totalCols = 1 + qtyCols // col 0 = ราคา, col 1.. = จำนวน

  const registerInput = useCallback((row, col) => {
    const key = `${row}|${col}`
    return (el) => {
      if (!el) inputRefs.current.delete(key)
      else inputRefs.current.set(key, el)
    }
  }, [])

  /** ✅ FIX: หักพื้นที่คอลัมน์ sticky (ประเภทสินค้า) ตอนคำนวนว่า “เห็น/ไม่เห็น” */
  const ensureInView = useCallback((el) => {
    const container = bodyScrollRef.current
    if (!container || !el) return

    const pad = 12
    const frozenLeft = COL_W.product // คอลัมน์ที่ sticky ซ้ายจริง ๆ

    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()

    // พื้นที่ที่ “มองเห็นจริง” ของตาราง (ซ้ายต้องเริ่มหลังคอลัมน์ sticky)
    const visibleLeft = crect.left + frozenLeft + pad
    const visibleRight = crect.right - pad
    const visibleTop = crect.top + pad
    const visibleBottom = crect.bottom - pad

    // horizontal
    if (erect.left < visibleLeft) {
      container.scrollLeft -= visibleLeft - erect.left
    } else if (erect.right > visibleRight) {
      container.scrollLeft += erect.right - visibleRight
    }

    // vertical
    if (erect.top < visibleTop) {
      container.scrollTop -= visibleTop - erect.top
    } else if (erect.bottom > visibleBottom) {
      container.scrollTop += erect.bottom - visibleBottom
    }
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

      // clamp
      if (nextRow < 0) nextRow = 0
      if (nextRow > DEFAULT_ITEMS.length - 1) nextRow = DEFAULT_ITEMS.length - 1
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
    [ensureInView, totalCols]
  )

  const getQtyColIndex = (monthIdx, metricIdx) => 1 + monthIdx * METRICS.length + metricIdx
  /** ===================================================================== */

  const setQtyCell = (itemId, monthKey, metricKey, nextValue) => {
    setQtyById((prev) => {
      const copy = { ...prev }
      const a = { ...(copy[itemId] || {}) }
      const b = { ...(a[monthKey] || {}) }
      b[metricKey] = nextValue
      a[monthKey] = b
      copy[itemId] = a
      return copy
    })
  }

  const setUnitPrice = (itemId, nextValue) => {
    setPriceById((prev) => ({ ...prev, [itemId]: nextValue }))
  }

  const computed = useMemo(() => {
    const itemQtyTotals = {}
    const itemAmtTotals = {}
    const monthQtyTotals = {}
    const monthAmtTotals = {}
    const grandQty = { pr: 0, recv: 0, ph: 0 }
    const grandAmt = { pr: 0, recv: 0, ph: 0 }

    MONTHS.forEach((m) => {
      monthQtyTotals[m.key] = { pr: 0, recv: 0, ph: 0 }
      monthAmtTotals[m.key] = { pr: 0, recv: 0, ph: 0 }
    })

    DEFAULT_ITEMS.forEach((it) => {
      const price = toNumber(priceById[it.id])
      itemQtyTotals[it.id] = { pr: 0, recv: 0, ph: 0 }
      itemAmtTotals[it.id] = { pr: 0, recv: 0, ph: 0 }

      MONTHS.forEach((m) => {
        METRICS.forEach((k) => {
          const q = toNumber(qtyById?.[it.id]?.[m.key]?.[k.key])
          const amt = q * price

          itemQtyTotals[it.id][k.key] += q
          itemAmtTotals[it.id][k.key] += amt

          monthQtyTotals[m.key][k.key] += q
          monthAmtTotals[m.key][k.key] += amt

          grandQty[k.key] += q
          grandAmt[k.key] += amt
        })
      })
    })

    return { itemQtyTotals, itemAmtTotals, monthQtyTotals, monthAmtTotals, grandQty, grandAmt }
  }, [qtyById, priceById])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setPriceById(buildInitialPrice())
    setQtyById(buildInitialQty())
  }

  const payload = useMemo(() => {
    return {
      table_code: "PROCUREMENT_PLAN_DETAIL",
      table_name: "รายละเอียดแผนการจัดหาสินค้า",
      year_be: yearBE,
      branch_id: branchId ? Number(branchId) : null,
      branch_name: branchName || null,
      metrics: METRICS.map((m) => ({ key: m.key, label: m.label })),
      months: MONTHS.map((m) => ({ key: m.key, label: m.label, month: m.month })),
      items: DEFAULT_ITEMS.map((it) => ({
        id: it.id,
        name: it.name,
        unit: it.unit,
        unit_price: toNumber(priceById[it.id]),
        values: MONTHS.reduce((acc, m) => {
          acc[m.key] = METRICS.reduce((acc2, k) => {
            acc2[k.key] = toNumber(qtyById?.[it.id]?.[m.key]?.[k.key])
            return acc2
          }, {})
          return acc
        }, {}),
      })),
      totals: {
        grand_qty: computed.grandQty,
        grand_amount: computed.grandAmt,
      },
    }
  }, [yearBE, branchId, branchName, qtyById, priceById, computed.grandQty, computed.grandAmt])

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

  /** ✅ FIX: เพิ่ม z-index ของ sticky + ทำพื้นหลังทึบ (ไม่เห็นตารางหลัง) */
  const stickyProductHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyProductCellBase =
    "sticky left-0 z-[60] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold">ยอดขาย</div>
              <div className="text-xl md:text-2xl font-extrabold">รายละเอียดแผนการจัดหาสินค้า</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                หน่วย: พันบาท (คำนวณจาก จำนวน × ราคา/หน่วย)
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                  ปี (พ.ศ.)
                </label>
                <input
                  className={baseField}
                  value={yearBE}
                  onChange={(e) => onYearBEChange?.(e.target.value)}
                  placeholder="เช่น 2568"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                  สาขาที่เลือก
                </label>
                <div className={cx(baseField, "flex items-center justify-between", !canEdit && "opacity-70")}>
                  <span className="font-semibold">{branchName ? branchName : "— ยังไม่เลือกสาขา —"}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-300">id: {branchId || "—"}</span>
                </div>

                {!canEdit && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    * กลับไปเลือกสาขาด้านบนก่อน ถึงจะเริ่มกรอกได้
                  </div>
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
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800
                          dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
            <pre className="max-h-72 overflow-auto">{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Table Card */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div className="p-2 md:p-3 shrink-0">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-base md:text-lg font-bold">
              ตารางกรอกข้อมูล (Mock) — {branchName ? `สาขา: ${branchName}` : "ยังไม่เลือกสาขา"}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              * กรอก “จำนวน” แล้วระบบคำนวณ “บาท” ให้ (ยังไม่ส่ง BE)
            </div>
          </div>
        </div>

        {/* BODY scroll */}
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
              {MONTHS.map((m) =>
                METRICS.map((k) => <col key={`col-${m.key}-${k.key}`} style={{ width: COL_W.cell }} />)
              )}
              {METRICS.map((k) => <col key={`col-total-${k.key}`} style={{ width: COL_W.cell }} />)}
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              <tr className="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                <th
                  rowSpan={2}
                  className={cx("border border-slate-300 px-3 py-2 text-left dark:border-slate-600", stickyProductHeader)}
                >
                  ประเภทสินค้า
                </th>
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-center dark:border-slate-600">
                  หน่วย
                </th>
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-center dark:border-slate-600">
                  ราคา/หน่วย
                </th>

                {MONTHS.map((m, idx) => (
                  <th
                    key={m.key}
                    colSpan={METRICS.length}
                    className={cx("border border-slate-300 px-3 py-2 text-center font-bold dark:border-slate-600", monthStripeHead(idx))}
                  >
                    {m.label}
                  </th>
                ))}

                <th colSpan={METRICS.length} className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600">
                  รวมทั้งหมด
                </th>
              </tr>

              <tr className="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                {MONTHS.map((m, idx) =>
                  METRICS.map((k) => (
                    <th
                      key={`${m.key}-${k.key}`}
                      className={cx("border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600", monthStripeHead(idx))}
                    >
                      {k.label}
                    </th>
                  ))
                )}

                {METRICS.map((k) => (
                  <th key={`total-${k.key}`} className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600">
                    {k.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {DEFAULT_ITEMS.map((it, rowIdx) => {
                const price = toNumber(priceById[it.id])

                /** ✅ FIX: แถวทึบ (ไม่โปร่ง) เพื่อไม่เห็น/ไม่กดโดนของข้างหลัง sticky */
                const rowBg =
                  rowIdx % 2 === 1
                    ? "bg-slate-50 dark:bg-slate-800"
                    : "bg-white dark:bg-slate-900"

                return (
                  <Fragment key={it.id}>
                    <tr className={rowBg}>
                      <td
                        rowSpan={2}
                        className={cx(
                          "border border-slate-200 px-3 py-2 font-semibold dark:border-slate-700",
                          stickyProductCellBase,
                          rowBg
                        )}
                      >
                        {it.name}
                      </td>

                      <td rowSpan={2} className="border border-slate-200 px-3 py-2 text-center dark:border-slate-700">
                        {it.unit}
                      </td>

                      {/* ราคา (col=0) */}
                      <td rowSpan={2} className="border border-slate-200 px-3 py-2 dark:border-slate-700">
                        <input
                          ref={registerInput(rowIdx, 0)}
                          data-row={rowIdx}
                          data-col={0}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={priceById[it.id] ?? ""}
                          disabled={!canEdit}
                          inputMode="decimal"
                          placeholder="0"
                          onChange={(e) => setUnitPrice(it.id, sanitizeNumberInput(e.target.value))}
                        />
                      </td>

                      {/* จำนวน (col=1..n) */}
                      {MONTHS.map((m, monthIdx) =>
                        METRICS.map((k, metricIdx) => {
                          const col = getQtyColIndex(monthIdx, metricIdx)
                          return (
                            <td
                              key={`${it.id}-${m.key}-${k.key}-qty`}
                              className={cx(
                                "border border-slate-200 px-2 py-2 dark:border-slate-700",
                                monthStripeCell(monthIdx)
                              )}
                            >
                              <input
                                ref={registerInput(rowIdx, col)}
                                data-row={rowIdx}
                                data-col={col}
                                onKeyDown={handleArrowNav}
                                className={cellInput}
                                value={qtyById?.[it.id]?.[m.key]?.[k.key] ?? ""}
                                disabled={!canEdit}
                                inputMode="decimal"
                                placeholder="0"
                                onChange={(e) =>
                                  setQtyCell(it.id, m.key, k.key, sanitizeNumberInput(e.target.value))
                                }
                              />
                            </td>
                          )
                        })
                      )}

                      {METRICS.map((k) => (
                        <td
                          key={`${it.id}-${k.key}-qty-total`}
                          className="border border-slate-200 px-2 py-2 text-right font-bold dark:border-slate-700"
                        >
                          {fmtQty(computed.itemQtyTotals?.[it.id]?.[k.key] ?? 0)}
                        </td>
                      ))}
                    </tr>

                    <tr className={rowBg}>
                      {MONTHS.map((m, monthIdx) =>
                        METRICS.map((k) => {
                          const q = toNumber(qtyById?.[it.id]?.[m.key]?.[k.key])
                          const amt = q * price
                          return (
                            <td
                              key={`${it.id}-${m.key}-${k.key}-amt`}
                              className={cx(
                                "border border-slate-200 px-2 py-2 text-right text-slate-700 dark:border-slate-700 dark:text-slate-200",
                                monthStripeCell(monthIdx)
                              )}
                            >
                              {fmtMoney(amt)}
                            </td>
                          )
                        })
                      )}

                      {METRICS.map((k) => (
                        <td
                          key={`${it.id}-${k.key}-amt-total`}
                          className="border border-slate-200 px-2 py-2 text-right font-extrabold text-slate-800 dark:border-slate-700 dark:text-slate-100"
                        >
                          {fmtMoney(computed.itemAmtTotals?.[it.id]?.[k.key] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER totals */}
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
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700">รวม (จำนวน)</td>
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                  </tr>
                  <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700">รวม (บาท)</td>
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex-1 overflow-hidden">
              <div style={{ width: RIGHT_W, transform: `translateX(-${scrollLeft}px)`, willChange: "transform" }}>
                <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                  <colgroup>
                    {MONTHS.map((m) =>
                      METRICS.map((k) => <col key={`fcol-${m.key}-${k.key}`} style={{ width: COL_W.cell }} />)
                    )}
                    {METRICS.map((k) => <col key={`fcol-total-${k.key}`} style={{ width: COL_W.cell }} />)}
                  </colgroup>

                  <tbody>
                    <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                      {MONTHS.map((m, idx) =>
                        METRICS.map((k) => (
                          <td
                            key={`sum-qty-${m.key}-${k.key}`}
                            className={cx(
                              "border border-slate-200 px-2 py-2 text-right dark:border-slate-700",
                              monthStripeFoot(idx)
                            )}
                          >
                            {fmtQty(computed.monthQtyTotals?.[m.key]?.[k.key] ?? 0)}
                          </td>
                        ))
                      )}
                      {METRICS.map((k) => (
                        <td
                          key={`grand-qty-${k.key}`}
                          className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700"
                        >
                          {fmtQty(computed.grandQty?.[k.key] ?? 0)}
                        </td>
                      ))}
                    </tr>

                    <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                      {MONTHS.map((m, idx) =>
                        METRICS.map((k) => (
                          <td
                            key={`sum-amt-${m.key}-${k.key}`}
                            className={cx(
                              "border border-slate-200 px-2 py-2 text-right dark:border-slate-700",
                              monthStripeFoot(idx)
                            )}
                          >
                            {fmtMoney(computed.monthAmtTotals?.[m.key]?.[k.key] ?? 0)}
                          </td>
                        ))
                      )}
                      {METRICS.map((k) => (
                        <td
                          key={`grand-amt-${k.key}`}
                          className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700"
                        >
                          {fmtMoney(computed.grandAmt?.[k.key] ?? 0)}
                        </td>
                      ))}
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

export default ProcurementPlanDetail
