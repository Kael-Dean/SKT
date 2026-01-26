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

/** ---------------- Table definition ---------------- */
const MONTHS = [
  { key: "m04", label: "เม.ย.", month: 4, no: "(4)" },
  { key: "m05", label: "พ.ค.", month: 5, no: "(5)" },
  { key: "m06", label: "มิ.ย.", month: 6, no: "(6)" },
  { key: "m07", label: "ก.ค.", month: 7, no: "(7)" },
  { key: "m08", label: "ส.ค.", month: 8, no: "(8)" },
  { key: "m09", label: "ก.ย.", month: 9, no: "(9)" },
  { key: "m10", label: "ต.ค.", month: 10, no: "(10)" },
  { key: "m11", label: "พ.ย.", month: 11, no: "(11)" },
  { key: "m12", label: "ธ.ค.", month: 12, no: "(12)" },
  { key: "m01", label: "ม.ค.", month: 1, no: "(13)" },
  { key: "m02", label: "ก.พ.", month: 2, no: "(14)" },
  { key: "m03", label: "มี.ค.", month: 3, no: "(15)" },
]

const makeId = () => {
  try {
    // eslint-disable-next-line no-undef
    return crypto.randomUUID()
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`
  }
}

const DEFAULT_ITEMS = [
  { id: "service_1", name: "รายได้จากบริการ", unit: "หน่วย", unitPrice: "" },
  { id: "service_2", name: "", unit: "", unitPrice: "" },
  { id: "service_3", name: "", unit: "", unitPrice: "" },
  { id: "service_4", name: "", unit: "", unitPrice: "" },
  { id: "service_5", name: "", unit: "", unitPrice: "" },
  { id: "service_6", name: "", unit: "", unitPrice: "" },
  { id: "service_7", name: "", unit: "", unitPrice: "" },
  { id: "service_8", name: "", unit: "", unitPrice: "" },
]

function buildInitialQty(items) {
  const out = {}
  items.forEach((it) => {
    out[it.id] = {}
    MONTHS.forEach((m) => {
      out[it.id][m.key] = ""
    })
  })
  return out
}

function buildInitialPrice(items) {
  const out = {}
  items.forEach((it) => {
    out[it.id] = String(it.unitPrice ?? "")
  })
  return out
}

function buildInitialMeta(items) {
  const out = {}
  items.forEach((it) => {
    out[it.id] = { name: it.name ?? "", unit: it.unit ?? "" }
  })
  return out
}

/** ✅ lock width ให้ตรงกันทุกส่วน */
const COL_W = {
  product: 260,
  unit: 92,
  price: 140,
  cell: 92, // เดือน + รวม
}

const LEFT_W = COL_W.product + COL_W.unit + COL_W.price
const RIGHT_W = (MONTHS.length + 2) * COL_W.cell // 12 เดือน + รวม 2 ช่อง
const TOTAL_W = LEFT_W + RIGHT_W

/** ✅ Stripe สีเดือน คู่/คี่ */
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

const ServiceBusinessPlanDetail = ({ branchId, branchName, yearBE, onYearBEChange }) => {
  const [items, setItems] = useState(() => DEFAULT_ITEMS.map((x) => ({ ...x })))
  const [metaById, setMetaById] = useState(() => buildInitialMeta(DEFAULT_ITEMS))
  const [priceById, setPriceById] = useState(() => buildInitialPrice(DEFAULT_ITEMS))
  const [qtyById, setQtyById] = useState(() => buildInitialQty(DEFAULT_ITEMS))

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

  // col 0 = ราคา, col 1..12 = จำนวนรายเดือน
  const totalCols = 1 + MONTHS.length

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
    const frozenLeft = COL_W.product // sticky ซ้ายจริง ๆ

    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()

    const visibleLeft = crect.left + frozenLeft + pad
    const visibleRight = crect.right - pad
    const visibleTop = crect.top + pad
    const visibleBottom = crect.bottom - pad

    if (erect.left < visibleLeft) {
      container.scrollLeft -= visibleLeft - erect.left
    } else if (erect.right > visibleRight) {
      container.scrollLeft += erect.right - visibleRight
    }

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

      if (nextRow < 0) nextRow = 0
      if (nextRow > items.length - 1) nextRow = items.length - 1
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
    [ensureInView, items.length, totalCols]
  )
  /** ===================================================================== */

  const setQtyCell = (itemId, monthKey, nextValue) => {
    setQtyById((prev) => {
      const copy = { ...prev }
      const row = { ...(copy[itemId] || {}) }
      row[monthKey] = nextValue
      copy[itemId] = row
      return copy
    })
  }

  const setUnitPrice = (itemId, nextValue) => {
    setPriceById((prev) => ({ ...prev, [itemId]: nextValue }))
  }

  const setMeta = (itemId, patch) => {
    setMetaById((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), ...patch } }))
  }

  const computed = useMemo(() => {
    const itemQtyTotal = {}
    const itemAmtTotal = {}
    const monthQtyTotal = {}
    const monthAmtTotal = {}
    let grandQty = 0
    let grandAmt = 0

    MONTHS.forEach((m) => {
      monthQtyTotal[m.key] = 0
      monthAmtTotal[m.key] = 0
    })

    items.forEach((it) => {
      const price = toNumber(priceById[it.id]) // บาท/หน่วย
      let sumQ = 0
      let sumAmt = 0

      MONTHS.forEach((m) => {
        const q = toNumber(qtyById?.[it.id]?.[m.key])
        const amtThbK = (q * price) / 1000 // พันบาท
        sumQ += q
        sumAmt += amtThbK

        monthQtyTotal[m.key] += q
        monthAmtTotal[m.key] += amtThbK
      })

      itemQtyTotal[it.id] = sumQ
      itemAmtTotal[it.id] = sumAmt
      grandQty += sumQ
      grandAmt += sumAmt
    })

    return { itemQtyTotal, itemAmtTotal, monthQtyTotal, monthAmtTotal, grandQty, grandAmt }
  }, [items, qtyById, priceById])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    const base = DEFAULT_ITEMS.map((x) => ({ ...x }))
    setItems(base)
    setMetaById(buildInitialMeta(base))
    setPriceById(buildInitialPrice(base))
    setQtyById(buildInitialQty(base))
  }

  const addRow = () => {
    const id = makeId()
    const next = [...items, { id, name: "", unit: "", unitPrice: "" }]
    setItems(next)
    setMetaById((p) => ({ ...p, [id]: { name: "", unit: "" } }))
    setPriceById((p) => ({ ...p, [id]: "" }))
    setQtyById((p) => {
      const copy = { ...p }
      copy[id] = {}
      MONTHS.forEach((m) => (copy[id][m.key] = ""))
      return copy
    })
  }

  const removeRow = (id) => {
    if (!confirm("ลบแถวนี้?")) return
    setItems((prev) => prev.filter((x) => x.id !== id))
    setMetaById((prev) => {
      const c = { ...prev }
      delete c[id]
      return c
    })
    setPriceById((prev) => {
      const c = { ...prev }
      delete c[id]
      return c
    })
    setQtyById((prev) => {
      const c = { ...prev }
      delete c[id]
      return c
    })
  }

  const payload = useMemo(() => {
    return {
      table_code: "SERVICE_BUSINESS_PLAN_DETAIL",
      table_name: "รายละเอียดแผนธุรกิจบริการ",
      year_be: yearBE,
      branch_id: branchId ? Number(branchId) : null,
      branch_name: branchName || null,
      unit_note: "หน่วย: พันบาท (คำนวณจาก จำนวน × ราคา/หน่วย ÷ 1000)",
      months: MONTHS.map((m) => ({ key: m.key, label: m.label, month: m.month })),
      items: items.map((it) => ({
        id: it.id,
        name: (metaById?.[it.id]?.name ?? "").trim(),
        unit: (metaById?.[it.id]?.unit ?? "").trim(),
        unit_price_baht: toNumber(priceById[it.id]),
        qty_by_month: MONTHS.reduce((acc, m) => {
          acc[m.key] = toNumber(qtyById?.[it.id]?.[m.key])
          return acc
        }, {}),
        amount_kbaht_by_month: MONTHS.reduce((acc, m) => {
          const q = toNumber(qtyById?.[it.id]?.[m.key])
          const p = toNumber(priceById[it.id])
          acc[m.key] = (q * p) / 1000
          return acc
        }, {}),
        total_qty: computed.itemQtyTotal?.[it.id] ?? 0,
        total_amount_kbaht: computed.itemAmtTotal?.[it.id] ?? 0,
      })),
      totals: {
        month_qty_total: computed.monthQtyTotal,
        month_amount_kbaht_total: computed.monthAmtTotal,
        grand_qty: computed.grandQty,
        grand_amount_kbaht: computed.grandAmt,
      },
    }
  }, [yearBE, branchId, branchName, items, metaById, priceById, qtyById, computed])

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

  /** ✅ sticky z-index + พื้นหลังทึบ */
  const stickyProductHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyProductCellBase = "sticky left-0 z-[60] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold">ยอดขาย</div>
              <div className="text-xl md:text-2xl font-extrabold">
                รายละเอียดแผนธุรกิจบริการ ศูนย์คัดบรรจุของ สกก. สุรินทร์ จำกัด
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                หน่วย: พันบาท (คำนวณจาก จำนวน × ราคา/หน่วย ÷ 1000)
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
              onClick={addRow}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              เพิ่มแถว
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
              ตารางแผนธุรกิจบริการ — {branchName ? `สาขา: ${branchName}` : "ยังไม่เลือกสาขา"}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              * กรอก “จำนวน” รายเดือน → ระบบคำนวณ “พันบาท” ให้อัตโนมัติ
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
              {MONTHS.map((m) => (
                <col key={`col-${m.key}`} style={{ width: COL_W.cell }} />
              ))}
              <col style={{ width: COL_W.cell }} />
              <col style={{ width: COL_W.cell }} />
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              {/* Row 1: Main headers */}
              <tr className="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                <th
                  rowSpan={3}
                  className={cx("border border-slate-300 px-3 py-2 text-center dark:border-slate-600", stickyProductHeader)}
                >
                  ประเภทสินค้า
                  <div className="mt-1 text-xs font-normal text-slate-600 dark:text-slate-200">(1)</div>
                </th>
                <th rowSpan={3} className="border border-slate-300 px-3 py-2 text-center dark:border-slate-600">
                  หน่วยนับ
                  <div className="mt-1 text-xs font-normal text-slate-600 dark:text-slate-200">(2)</div>
                </th>
                <th rowSpan={3} className="border border-slate-300 px-3 py-2 text-center dark:border-slate-600">
                  ราคา/หน่วย (บาท)
                  <div className="mt-1 text-xs font-normal text-slate-600 dark:text-slate-200">(3)</div>
                </th>

                <th
                  colSpan={MONTHS.length}
                  className="border border-slate-300 px-3 py-2 text-center font-bold dark:border-slate-600"
                >
                  มูลค่าสินค้า/บริการในแต่ละเดือน (พันบาท)
                </th>

                <th colSpan={2} className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600">
                  รวมทั้งหมด
                </th>
              </tr>

              {/* Row 2: Month labels + total labels */}
              <tr className="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                {MONTHS.map((m, idx) => (
                  <th
                    key={`mhead-${m.key}`}
                    className={cx("border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600", monthStripeHead(idx))}
                  >
                    {m.label}
                  </th>
                ))}
                <th className="border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600">
                  จำนวนหน่วย
                </th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600">
                  จำนวนเงิน (พันบาท)
                </th>
              </tr>

              {/* Row 3: Column numbers (4)-(17) */}
              <tr className="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                {MONTHS.map((m, idx) => (
                  <th
                    key={`mno-${m.key}`}
                    className={cx("border border-slate-300 px-2 py-1 text-center text-xs font-normal dark:border-slate-600", monthStripeHead(idx))}
                  >
                    {m.no}
                  </th>
                ))}
                <th className="border border-slate-300 px-2 py-1 text-center text-xs font-normal dark:border-slate-600">(16)</th>
                <th className="border border-slate-300 px-2 py-1 text-center text-xs font-normal dark:border-slate-600">(17)</th>
              </tr>
            </thead>

            <tbody>
              {items.map((it, rowIdx) => {
                const price = toNumber(priceById[it.id])

                const rowBg =
                  rowIdx % 2 === 1 ? "bg-slate-50 dark:bg-slate-800" : "bg-white dark:bg-slate-900"

                const name = metaById?.[it.id]?.name ?? ""
                const unit = metaById?.[it.id]?.unit ?? ""

                return (
                  <Fragment key={it.id}>
                    {/* Row A: Qty inputs */}
                    <tr className={rowBg}>
                      <td
                        rowSpan={2}
                        className={cx(
                          "border border-slate-200 px-3 py-2 font-semibold dark:border-slate-700",
                          stickyProductCellBase,
                          rowBg
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            className={cx(cellTextInput, "text-sm font-semibold")}
                            value={name}
                            disabled={!canEdit}
                            placeholder="พิมพ์ประเภทสินค้า/บริการ..."
                            onChange={(e) => setMeta(it.id, { name: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => removeRow(it.id)}
                            className={cx(
                              "shrink-0 rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700",
                              "hover:bg-slate-100 active:scale-[.98] transition",
                              "dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40",
                              !canEdit && "opacity-60 pointer-events-none"
                            )}
                            title="ลบแถว"
                          >
                            ลบ
                          </button>
                        </div>
                      </td>

                      <td rowSpan={2} className="border border-slate-200 px-3 py-2 text-center dark:border-slate-700">
                        <input
                          className={cx(cellTextInput, "text-center")}
                          value={unit}
                          disabled={!canEdit}
                          placeholder="หน่วยนับ"
                          onChange={(e) => setMeta(it.id, { unit: e.target.value })}
                        />
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

                      {MONTHS.map((m, monthIdx) => {
                        const col = 1 + monthIdx
                        return (
                          <td
                            key={`${it.id}-${m.key}-qty`}
                            className={cx("border border-slate-200 px-2 py-2 dark:border-slate-700", monthStripeCell(monthIdx))}
                          >
                            <input
                              ref={registerInput(rowIdx, col)}
                              data-row={rowIdx}
                              data-col={col}
                              onKeyDown={handleArrowNav}
                              className={cellInput}
                              value={qtyById?.[it.id]?.[m.key] ?? ""}
                              disabled={!canEdit}
                              inputMode="decimal"
                              placeholder="0"
                              onChange={(e) => setQtyCell(it.id, m.key, sanitizeNumberInput(e.target.value))}
                            />
                          </td>
                        )
                      })}

                      <td className="border border-slate-200 px-2 py-2 text-right font-bold dark:border-slate-700">
                        {fmtQty(computed.itemQtyTotal?.[it.id] ?? 0)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-right font-bold dark:border-slate-700">
                        {fmtMoney(computed.itemAmtTotal?.[it.id] ?? 0)}
                      </td>
                    </tr>

                    {/* Row B: Amount (kTHB) computed */}
                    <tr className={rowBg}>
                      {MONTHS.map((m, monthIdx) => {
                        const q = toNumber(qtyById?.[it.id]?.[m.key])
                        const amt = (q * price) / 1000 // พันบาท
                        return (
                          <td
                            key={`${it.id}-${m.key}-amt`}
                            className={cx(
                              "border border-slate-200 px-2 py-2 text-right text-slate-700 dark:border-slate-700 dark:text-slate-200",
                              monthStripeCell(monthIdx)
                            )}
                          >
                            {fmtMoney(amt)}
                          </td>
                        )
                      })}

                      <td className="border border-slate-200 px-2 py-2 text-right font-extrabold text-slate-800 dark:border-slate-700 dark:text-slate-100">
                        {fmtMoney(computed.itemAmtTotal?.[it.id] ?? 0)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-right font-extrabold text-slate-800 dark:border-slate-700 dark:text-slate-100">
                        {fmtMoney(computed.itemAmtTotal?.[it.id] ?? 0)}
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER totals (sync scroll) */}
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
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">รวม</td>
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700 text-center">
                      {/** โชว์หน่วยแบบในรูป (ผู้ใช้จะพิมพ์เองในแถว) */}
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">จำนวน</span>
                    </td>
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                  </tr>
                  <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">รวม</td>
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700 text-center">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">บาท</span>
                    </td>
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex-1 overflow-hidden">
              <div style={{ width: RIGHT_W, transform: `translateX(-${scrollLeft}px)`, willChange: "transform" }}>
                <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                  <colgroup>
                    {MONTHS.map((m) => (
                      <col key={`fcol-${m.key}`} style={{ width: COL_W.cell }} />
                    ))}
                    <col style={{ width: COL_W.cell }} />
                    <col style={{ width: COL_W.cell }} />
                  </colgroup>

                  <tbody>
                    {/* Totals: Qty */}
                    <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                      {MONTHS.map((m, idx) => (
                        <td
                          key={`sum-qty-${m.key}`}
                          className={cx("border border-slate-200 px-2 py-2 text-right dark:border-slate-700", monthStripeFoot(idx))}
                        >
                          {fmtQty(computed.monthQtyTotal?.[m.key] ?? 0)}
                        </td>
                      ))}
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtQty(computed.grandQty ?? 0)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtMoney(computed.grandAmt ?? 0)}
                      </td>
                    </tr>

                    {/* Totals: Amount (kTHB) */}
                    <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                      {MONTHS.map((m, idx) => (
                        <td
                          key={`sum-amt-${m.key}`}
                          className={cx("border border-slate-200 px-2 py-2 text-right dark:border-slate-700", monthStripeFoot(idx))}
                        >
                          {fmtMoney(computed.monthAmtTotal?.[m.key] ?? 0)}
                        </td>
                      ))}
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtMoney(computed.grandAmt ?? 0)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtMoney(computed.grandAmt ?? 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-3 md:p-4 text-sm text-slate-600 dark:text-slate-300">
          หมายเหตุ: ตอนนี้เป็น Mock สำหรับกรอกข้อมูล/รวมยอด/เตรียม JSON เท่านั้น (ยังไม่บันทึกลง BE)
        </div>
      </div>
    </div>
  )
}

export default ServiceBusinessPlanDetail
