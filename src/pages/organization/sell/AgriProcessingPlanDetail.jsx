// src/pages/operation-plan/AgriProcessingPlanDetail.jsx
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../lib/api"

/* รายละเอียดแผนการแปรรูปผลผลิตการเกษตร (ตารางรูปแบบ Excel) */

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
const fmtMoney = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(toNumber(n))

const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

// เดือน: เม.ย. → มี.ค.
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

/** ✅ ใช้ลิสประเภทสินค้าจาก BE ของ “แปรรูป” */
const PROCESSING_GROUP_ID = 4

/** fallback เผื่อ BE ยังไม่พร้อม */
const FALLBACK_ITEMS = [
  { type: "group", label: "ข้าวสารและผลิตภัณฑ์ (ผลั่วทั่วไป)" },
  { type: "item", id: "rice_general", product_id: null, name: "ทั่วไป", unit: "ตัน", unitPrice: "" },
  { type: "item", id: "rice_organic", product_id: null, name: "อินทรีย์", unit: "ตัน", unitPrice: "" },
  { type: "group", label: "ผลพลอยได้" },
  { type: "item", id: "byproduct", product_id: null, name: "ผลพลอยได้", unit: "ตัน", unitPrice: "" },
]

function buildInitialQty(editableItems) {
  const out = {}
  ;(editableItems || []).forEach((it) => {
    out[it.id] = {}
    MONTHS.forEach((m) => (out[it.id][m.key] = ""))
  })
  return out
}

function buildInitialPrice(editableItems) {
  const out = {}
  ;(editableItems || []).forEach((it) => (out[it.id] = String(it.unitPrice ?? "")))
  return out
}

// widths ให้ใกล้ Excel (และเข้ากับของเดิม)
const COL_W = {
  product: 280,
  unit: 70,
  price: 110,
  month: 86,
  totalQty: 95,
  totalAmt: 120,
}
const LEFT_W = COL_W.product + COL_W.unit + COL_W.price
const RIGHT_W = MONTHS.length * COL_W.month + COL_W.totalQty + COL_W.totalAmt
const TOTAL_W = LEFT_W + RIGHT_W

// stripe เดือนแบบเดิม (ทำให้อ่านง่าย)
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

const dashIfAny = (any, formatted) => (any ? formatted : "-")

const AgriProcessingPlanDetail = ({ branchId, branchName, yearBE, onYearBEChange }) => {
  /** ✅ items from BE (fallback ได้) */
  const [items, setItems] = useState(FALLBACK_ITEMS)
  const editableItems = useMemo(() => (Array.isArray(items) ? items.filter((x) => x.type === "item") : []), [items])

  const [priceById, setPriceById] = useState(() => buildInitialPrice(editableItems.length ? editableItems : FALLBACK_ITEMS.filter((x) => x.type === "item")))
  const [qtyById, setQtyById] = useState(() => buildInitialQty(editableItems.length ? editableItems : FALLBACK_ITEMS.filter((x) => x.type === "item")))
  const [showPayload, setShowPayload] = useState(false)
  const canEdit = !!branchId

  /** ✅ plan_id: 2569 => 1 */
  const planId = useMemo(() => {
    const y = Number(yearBE || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [yearBE])

  /** ✅ โหลดลิสประเภทสินค้า “แปรรูป” จาก BE */
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!planId || planId <= 0) return

        const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${Number(planId)}`)
        const group = data?.[String(PROCESSING_GROUP_ID)] || data?.[PROCESSING_GROUP_ID]
        const list = Array.isArray(group?.items) ? group.items : []

        const normalizedItems = list
          .filter((x) => Number(x.business_group || 0) === PROCESSING_GROUP_ID)
          .map((x) => ({
            type: "item",
            id: String(x.product_id || x.id || "").trim(),
            product_id: Number(x.product_id || x.id || 0) || null,
            name: String(x.product_type || x.name || "").trim(),
            unit: String(x.unit || "ตัน").trim(),
            unitPrice: x.sell_price ?? "",
          }))
          .filter((x) => x.id && x.name)

        if (!alive) return

        if (normalizedItems.length) {
          const headerLabel =
            String(group?.group_name || group?.name || "รายการสินค้าแปรรูป").trim() || "รายการสินค้าแปรรูป"

          setItems([{ type: "group", label: headerLabel }, ...normalizedItems])
        } else {
          setItems(FALLBACK_ITEMS)
        }
      } catch (e) {
        console.warn("[AgriProcessing] load products failed:", e)
        if (!alive) return
        setItems(FALLBACK_ITEMS)
      }
    })()

    return () => {
      alive = false
    }
  }, [planId])

  /** ✅ sync state ตาม items (เพิ่ม/ลดแถวแล้วกรอกได้ต่อเนื่อง) */
  useEffect(() => {
    setPriceById((prev) => {
      const next = buildInitialPrice(editableItems)
      for (const k of Object.keys(prev || {})) {
        if (next[k] !== undefined) next[k] = prev[k]
      }
      return next
    })

    setQtyById((prev) => {
      const next = buildInitialQty(editableItems)
      for (const id of Object.keys(next)) {
        if (!prev?.[id]) continue
        for (const m of MONTHS) {
          if (prev[id][m.key] !== undefined) next[id][m.key] = prev[id][m.key]
        }
      }
      return next
    })
  }, [editableItems])

  // height full screen like other tables
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

  // scroll sync footer
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

  // arrow nav (เฉพาะแถวที่กรอกได้)
  const inputRefs = useRef(new Map())
  const totalCols = 1 + MONTHS.length // col0 = ราคา, col1..12 = qty

  const editableIndexById = useMemo(() => {
    const m = {}
    editableItems.forEach((it, idx) => (m[it.id] = idx))
    return m
  }, [editableItems])

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
    const frozenLeft = COL_W.product // sticky column
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
      if (nextRow > editableItems.length - 1) nextRow = editableItems.length - 1
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
    [ensureInView, totalCols, editableItems.length]
  )

  const getQtyColIndex = (monthIdx) => 1 + monthIdx

  const setQtyCell = (itemId, monthKey, nextValue) => {
    setQtyById((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [monthKey]: nextValue },
    }))
  }

  const setUnitPrice = (itemId, nextValue) => {
    setPriceById((prev) => ({ ...prev, [itemId]: nextValue }))
  }

  const computed = useMemo(() => {
    const itemTotals = {}
    const monthQtyTotals = {}
    const monthAmtTotals = {}
    const monthAny = {}
    let anyAll = false
    let grandQty = 0
    let grandAmt = 0

    MONTHS.forEach((m) => {
      monthQtyTotals[m.key] = 0
      monthAmtTotals[m.key] = 0
      monthAny[m.key] = false
    })

    editableItems.forEach((it) => {
      const priceRaw = priceById[it.id] ?? ""
      const price = toNumber(priceRaw)
      let rowQty = 0
      let rowAmt = 0
      let rowAny = false

      MONTHS.forEach((m) => {
        const raw = qtyById?.[it.id]?.[m.key] ?? ""
        if (raw !== "") {
          rowAny = true
          anyAll = true
          monthAny[m.key] = true
        }
        const q = toNumber(raw)
        const amt = q * price
        rowQty += q
        rowAmt += amt
        monthQtyTotals[m.key] += q
        monthAmtTotals[m.key] += amt
      })

      grandQty += rowQty
      grandAmt += rowAmt

      itemTotals[it.id] = { qty: rowQty, amt: rowAmt, any: rowAny, priceRaw }
    })

    return { itemTotals, monthQtyTotals, monthAmtTotals, monthAny, anyAll, grandQty, grandAmt }
  }, [qtyById, priceById, editableItems])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setPriceById(buildInitialPrice(editableItems))
    setQtyById(buildInitialQty(editableItems))
  }

  const payload = useMemo(() => {
    return {
      table_code: "AGRI_PROCESSING_PLAN_DETAIL",
      table_name: "รายละเอียดแผนการแปรรูปผลผลิตการเกษตร",
      year_be: yearBE,
      plan_id: planId,
      branch_id: branchId ? Number(branchId) : null,
      branch_name: branchName || null,
      months: MONTHS.map((m) => ({ key: m.key, label: m.label, month: m.month })),
      items: editableItems.map((it) => ({
        id: it.id,
        product_id: it.product_id ?? null,
        name: it.name,
        unit: it.unit,
        unit_price: toNumber(priceById[it.id]),
        values: MONTHS.reduce((acc, m) => {
          acc[m.key] = toNumber(qtyById?.[it.id]?.[m.key])
          return acc
        }, {}),
      })),
      totals: {
        month_qty: computed.monthQtyTotals,
        month_amount: computed.monthAmtTotals,
        grand_qty: computed.grandQty,
        grand_amount: computed.grandAmt,
      },
    }
  }, [yearBE, planId, branchId, branchName, qtyById, priceById, computed, editableItems])

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

  // sticky styles (ทึบ)
  const stickyProductHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyProductCellBase =
    "sticky left-0 z-[60] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  // จำนวนคอลัมน์ทั้งหมดตาม excel: 3 ซ้าย + 12 เดือน + 2 รวม = 17
  const colCount = 3 + MONTHS.length + 2

  return (
    <div className="space-y-3">
      {/* Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold">ยอดขาย</div>
              <div className="text-xl md:text-2xl font-extrabold">
                รายละเอียดแผนการแปรรูปผลผลิตการเกษตรของ สกก.สุรินทร์ จำกัด
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">หน่วย : พันบาท</div>
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
        <div
          className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700"
          ref={bodyScrollRef}
          onScroll={onBodyScroll}
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
              <tr className="bg-white dark:bg-slate-800">
                <th colSpan={colCount} className="border border-slate-300 px-3 py-2 dark:border-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">ยอดขาย</span>
                    <span className="text-sm font-semibold">หน่วย : พันบาท</span>
                  </div>
                </th>
              </tr>
              <tr className="bg-white dark:bg-slate-800">
                <th colSpan={colCount} className="border border-slate-300 px-3 py-2 text-center font-bold dark:border-slate-600">
                  รายละเอียดแผนการแปรรูปผลผลิตการเกษตรของ สกก.สุรินทร์ จำกัด
                </th>
              </tr>
              <tr className="bg-white dark:bg-slate-800">
                <th colSpan={colCount} className="border border-slate-300 px-3 py-2 text-center font-bold dark:border-slate-600">
                  ปี {yearBE || "—"}
                </th>
              </tr>

              <tr className="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                <th
                  rowSpan={3}
                  className={cx("border border-slate-300 px-3 py-2 text-left dark:border-slate-600", stickyProductHeader)}
                >
                  ประเภทสินค้า
                </th>
                <th rowSpan={3} className="border border-slate-300 px-3 py-2 text-center dark:border-slate-600">
                  หน่วย<br />นับ
                </th>
                <th rowSpan={3} className="border border-slate-300 px-3 py-2 text-center dark:border-slate-600">
                  ราคา<br />
                  <span className="text-xs font-medium">ต่อหน่วย (บาท)</span>
                </th>

                <th
                  colSpan={MONTHS.length}
                  className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600"
                >
                  มูลค่าสินค้าที่ขายในแต่ละเดือน (พันบาท)
                </th>

                <th colSpan={2} className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600">
                  รวมทั้งหมด
                </th>
              </tr>

              <tr className="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                {MONTHS.map((m, idx) => (
                  <th
                    key={`h-${m.key}`}
                    className={cx(
                      "border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600",
                      monthStripeHead(idx)
                    )}
                  >
                    {m.label}
                  </th>
                ))}
                <th className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600">
                  จำนวน<br />หน่วย
                </th>
                <th className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600">
                  จำนวนเงิน<br />
                  <span className="text-xs font-medium">(พันบาท)</span>
                </th>
              </tr>

              <tr className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {Array.from({ length: colCount }).map((_, i) => (
                  <th
                    key={`idx-${i}`}
                    className={cx(
                      "border border-slate-200 px-2 py-1 text-center text-[11px] dark:border-slate-700",
                      i >= 3 && i < 3 + MONTHS.length ? monthStripeCell(i - 3) : ""
                    )}
                  >
                    ({i + 1})
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {items.map((row, idxAll) => {
                if (row.type === "group") {
                  return (
                    <tr key={`g-${idxAll}`} className="bg-slate-200/70 dark:bg-slate-700/60">
                      <td
                        className={cx(
                          "border border-slate-200 px-3 py-2 font-extrabold dark:border-slate-700",
                          stickyProductCellBase,
                          "bg-slate-200 dark:bg-slate-700"
                        )}
                      >
                        {row.label}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                      {MONTHS.map((m, mi) => (
                        <td
                          key={`g-${idxAll}-${m.key}`}
                          className={cx("border border-slate-200 px-2 py-2 dark:border-slate-700", monthStripeCell(mi))}
                        />
                      ))}
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                    </tr>
                  )
                }

                const it = row
                const navRow = editableIndexById[it.id] ?? 0
                const rowBg = navRow % 2 === 1 ? "bg-slate-50 dark:bg-slate-800" : "bg-white dark:bg-slate-900"

                const priceRaw = priceById[it.id] ?? ""
                const priceNum = toNumber(priceRaw)

                const rowAny = computed.itemTotals?.[it.id]?.any ?? false
                const totalQty = computed.itemTotals?.[it.id]?.qty ?? 0
                const totalAmt = computed.itemTotals?.[it.id]?.amt ?? 0

                return (
                  <Fragment key={it.id}>
                    {/* ===== Row: ตัน (กรอกได้) ===== */}
                    <tr className={rowBg}>
                      <td
                        rowSpan={2}
                        className={cx(
                          "border border-slate-200 px-3 py-2 font-semibold dark:border-slate-700",
                          stickyProductCellBase,
                          rowBg
                        )}
                      >
                        <span className="pl-3">— {it.name}</span>
                        {Number(it.product_id || 0) > 0 ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">product_id: {it.product_id}</div>
                        ) : null}
                      </td>

                      <td className="border border-slate-200 px-2 py-2 text-center font-semibold dark:border-slate-700">
                        ตัน
                      </td>

                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700">
                        <input
                          ref={registerInput(navRow, 0)}
                          data-row={navRow}
                          data-col={0}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={priceRaw}
                          disabled={!canEdit}
                          inputMode="decimal"
                          placeholder="0"
                          onChange={(e) => setUnitPrice(it.id, sanitizeNumberInput(e.target.value))}
                        />
                      </td>

                      {MONTHS.map((m, mi) => {
                        const col = getQtyColIndex(mi)
                        const raw = qtyById?.[it.id]?.[m.key] ?? ""
                        return (
                          <td
                            key={`${it.id}-${m.key}-qty`}
                            className={cx("border border-slate-200 px-2 py-2 dark:border-slate-700", monthStripeCell(mi))}
                          >
                            <input
                              ref={registerInput(navRow, col)}
                              data-row={navRow}
                              data-col={col}
                              onKeyDown={handleArrowNav}
                              className={cellInput}
                              value={raw}
                              disabled={!canEdit}
                              inputMode="decimal"
                              placeholder=""
                              onChange={(e) => setQtyCell(it.id, m.key, sanitizeNumberInput(e.target.value))}
                            />
                          </td>
                        )
                      })}

                      <td className="border border-slate-200 px-2 py-2 text-right font-extrabold dark:border-slate-700">
                        {dashIfAny(rowAny, fmtQty(totalQty))}
                      </td>

                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                    </tr>

                    {/* ===== Row: บาท (คำนวณ) ===== */}
                    <tr className={rowBg}>
                      <td className="border border-slate-200 px-2 py-2 text-center font-semibold dark:border-slate-700">
                        บาท
                      </td>

                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />

                      {MONTHS.map((m, mi) => {
                        const rawQty = qtyById?.[it.id]?.[m.key] ?? ""
                        const q = toNumber(rawQty)
                        const amt = q * priceNum
                        const show = rawQty !== "" && String(priceRaw ?? "") !== ""
                        return (
                          <td
                            key={`${it.id}-${m.key}-amt`}
                            className={cx(
                              "border border-slate-200 px-2 py-2 text-right text-slate-700 dark:border-slate-700 dark:text-slate-200",
                              monthStripeCell(mi)
                            )}
                          >
                            {show ? fmtMoney(amt) : "-"}
                          </td>
                        )
                      })}

                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />

                      <td className="border border-slate-200 px-2 py-2 text-right font-extrabold dark:border-slate-700">
                        {dashIfAny(rowAny && String(priceRaw ?? "") !== "", fmtMoney(totalAmt))}
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ===== Footer totals ===== */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex w-full">
            {/* LEFT fixed */}
            <div className="shrink-0" style={{ width: LEFT_W }}>
              <table className="border-collapse text-sm" style={{ width: LEFT_W, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: COL_W.product }} />
                  <col style={{ width: COL_W.unit }} />
                  <col style={{ width: COL_W.price }} />
                </colgroup>
                <tbody>
                  <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700">รวม</td>
                    <td className="border border-slate-200 px-2 py-2 text-center dark:border-slate-700">ตัน</td>
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                  </tr>
                  <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700">รวม</td>
                    <td className="border border-slate-200 px-2 py-2 text-center dark:border-slate-700">บาท</td>
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* RIGHT follow scroll */}
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
                    <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                      {MONTHS.map((m, idx) => (
                        <td
                          key={`tq-${m.key}`}
                          className={cx("border border-slate-200 px-2 py-2 text-right dark:border-slate-700", monthStripeFoot(idx))}
                        >
                          {computed.monthAny[m.key] ? fmtQty(computed.monthQtyTotals[m.key] ?? 0) : "-"}
                        </td>
                      ))}
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {computed.anyAll ? fmtQty(computed.grandQty ?? 0) : "-"}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                    </tr>

                    <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                      {MONTHS.map((m, idx) => (
                        <td
                          key={`ta-${m.key}`}
                          className={cx("border border-slate-200 px-2 py-2 text-right dark:border-slate-700", monthStripeFoot(idx))}
                        >
                          {computed.monthAny[m.key] ? fmtMoney(computed.monthAmtTotals[m.key] ?? 0) : "-"}
                        </td>
                      ))}
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {computed.anyAll ? fmtMoney(computed.grandAmt ?? 0) : "-"}
                      </td>
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

export default AgriProcessingPlanDetail
