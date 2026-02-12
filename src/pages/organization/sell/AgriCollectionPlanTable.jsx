import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../lib/api"
/*รายละเอียดแผนการรวบรวมผลผลิตการเกษตร*/
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

/** ---------------- Table definition (ตามเรฟรูป) ---------------- */
/** เดือน: เม.ย. → มี.ค. */
const MONTHS = [
  { key: "m04", label: "เม.ย." },
  { key: "m05", label: "พ.ค." },
  { key: "m06", label: "มิ.ย." },
  { key: "m07", label: "ก.ค." },
  { key: "m08", label: "ส.ค." },
  { key: "m09", label: "ก.ย." },
  { key: "m10", label: "ต.ค." },
  { key: "m11", label: "พ.ย." },
  { key: "m12", label: "ธ.ค." },
  { key: "m01", label: "ม.ค." },
  { key: "m02", label: "ก.พ." },
  { key: "m03", label: "มี.ค." },
]

/**
 * ✅ รายการสินค้า
 * เปลี่ยนให้ใช้ลิสจาก BE ของหน้ารวบรวม (group=3) เป็นหลัก
 * - fallback ไว้เผื่อ BE ยังไม่พร้อม/ยิงไม่ได้
 */
const COLLECTION_GROUP_ID = 3

const FALLBACK_ITEMS = [
  { id: "rice_dry_1", name: "ข้าวเปลือกแห้ง 1", unitName: "ตัน", unitPrice: "" },
  { id: "rice_dry_2", name: "ข้าวเปลือกแห้ง 2", unitName: "ตัน", unitPrice: "" },
  { id: "rice_fresh_1", name: "ข้าวเปลือกสด1", unitName: "ตัน", unitPrice: "" },
  { id: "rice_fresh_2", name: "ข้าวเปลือกสด2", unitName: "ตัน", unitPrice: "" },
  { id: "rice_offseason", name: "ข้าวเปลือกนาปรัง", unitName: "ตัน", unitPrice: "" },
  { id: "rubber", name: "ยางพารา", unitName: "ตัน", unitPrice: "" },
  { id: "cassava", name: "มันสำปะหลัง", unitName: "ตัน", unitPrice: "" },
  { id: "corn", name: "ข้าวโพดเลี้ยงสัตว์", unitName: "ตัน", unitPrice: "" },
]

/**
 * สร้าง state ตามรายการสินค้า (key = item.id)
 * - qtyById[itemId][monthKey] = string
 * - priceById[itemId] = string
 */
function buildInitialQty(items) {
  const out = {}
  ;(items || []).forEach((it) => {
    out[it.id] = {}
    MONTHS.forEach((m) => {
      out[it.id][m.key] = ""
    })
  })
  return out
}

function buildInitialPrice(items) {
  const out = {}
  ;(items || []).forEach((it) => {
    out[it.id] = String(it.unitPrice ?? "")
  })
  return out
}

/** ✅ widths (คงสไตล์เดิม แต่ปรับให้เหมาะกับเรฟใหม่) */
const COL_W = {
  product: 260,
  unit: 84,
  price: 130,
  cell: 90, // เดือน
  totalQty: 120,
  totalAmt: 150,
}

const LEFT_W = COL_W.product + COL_W.unit + COL_W.price
const RIGHT_W = MONTHS.length * COL_W.cell + COL_W.totalQty + COL_W.totalAmt
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

/**
 * Component: แผนการรวบรวมผลผลิตการเกษตร (ตามรูป)
 */
const AgriCollectionPlanTable = ({ branchId, branchName, yearBE, onYearBEChange }) => {
  // ✅ ใช้ลิสสินค้าจาก BE (fallback ได้)
  const [items, setItems] = useState(FALLBACK_ITEMS)

  const editableItems = useMemo(() => (Array.isArray(items) ? items : []), [items])

  const [priceById, setPriceById] = useState(() => buildInitialPrice(FALLBACK_ITEMS))
  const [qtyById, setQtyById] = useState(() => buildInitialQty(FALLBACK_ITEMS))
  const [showPayload, setShowPayload] = useState(false)
  const canEdit = !!branchId

  /** ✅ plan_id: 2569 => 1 */
  const planId = useMemo(() => {
    const y = Number(yearBE || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [yearBE])

  /** ✅ โหลดลิส “ประเภทสินค้า” จาก BE ของหน้ารวบรวม (business_group=3) */
  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        if (!planId || planId <= 0) return

        const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${Number(planId)}`)
        const group = data?.[String(COLLECTION_GROUP_ID)] || data?.[COLLECTION_GROUP_ID]
        const list = Array.isArray(group?.items) ? group.items : []

        const normalized = list
          .filter((x) => Number(x.business_group || 0) === COLLECTION_GROUP_ID)
          .map((x) => ({
            id: String(x.product_id || x.id || "").trim(),
            product_id: Number(x.product_id || x.id || 0),
            name: String(x.product_type || x.name || "").trim(),
            unitName: String(x.unit || "ตัน").trim(),
            // ใช้เป็นค่าเริ่มต้นได้ แต่หลัก ๆ คือ “ลิสประเภทสินค้า”
            unitPrice: x.sell_price ?? "",
          }))
          .filter((x) => x.id && x.name)

        if (!alive) return
        if (normalized.length) setItems(normalized)
        else setItems(FALLBACK_ITEMS)
      } catch (e) {
        console.warn("[AgriCollection] load products failed:", e)
        if (!alive) return
        setItems(FALLBACK_ITEMS)
      }
    })()

    return () => {
      alive = false
    }
  }, [planId])

  /** ✅ sync state ตาม items (กัน key หาย/เพิ่มแล้วกรอกไม่ได้) */
  useEffect(() => {
    setPriceById((prev) => {
      const next = buildInitialPrice(editableItems)
      // preserve ที่กรอกไว้
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

  /** ✅ ความสูงตารางเต็มจอ */
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

  /** ✅ sync scroll footer */
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

  // inputs: col0 = ราคา/หน่วย, col1..12 = เดือน (จำนวน)
  const qtyCols = MONTHS.length
  const totalCols = 1 + qtyCols

  /** ✅ Map id -> row index เฉพาะแถวที่กรอกได้ */
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

      // ✅ ตอนนี้ data-row คือ index ของ EDITABLE_ITEMS
      const row = Number(e.currentTarget.dataset.row ?? 0)
      const col = Number(e.currentTarget.dataset.col ?? 0)

      let nextRow = row
      let nextCol = col

      if (k === "ArrowLeft") nextCol = col - 1
      if (k === "ArrowRight") nextCol = col + 1
      if (k === "ArrowUp") nextRow = row - 1
      if (k === "ArrowDown") nextRow = row + 1

      // clamp (ใช้ EDITABLE_ITEMS ไม่ใช่ ITEMS)
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

  const computed = useMemo(() => {
    const itemQty = {}
    const itemAmt = {}
    const monthQtyTotals = {}
    const monthAmtTotals = {}
    const grand = { qty: 0, amt: 0 }

    MONTHS.forEach((m) => {
      monthQtyTotals[m.key] = 0
      monthAmtTotals[m.key] = 0
    })

    const getQty = (id, mkey) => toNumber(qtyById?.[id]?.[mkey])
    const getPrice = (id) => toNumber(priceById?.[id])

    for (const it of editableItems) {
      itemQty[it.id] = {}
      itemAmt[it.id] = {}

      MONTHS.forEach((m) => {
        const q = getQty(it.id, m.key)
        const amt = q * getPrice(it.id)

        itemQty[it.id][m.key] = q
        itemAmt[it.id][m.key] = amt

        monthQtyTotals[m.key] += q
        monthAmtTotals[m.key] += amt

        grand.qty += q
        grand.amt += amt
      })
    }

    return { itemQty, itemAmt, monthQtyTotals, monthAmtTotals, grand }
  }, [qtyById, priceById, editableItems])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setPriceById(buildInitialPrice(editableItems))
    setQtyById(buildInitialQty(editableItems))
  }

  /** payload (คงไว้เหมือนเดิม เผื่อส่ง BE) */
  const payload = useMemo(() => {
    return {
      table_code: "AGRI_COLLECTION_PLAN_DETAIL",
      table_name: "รายละเอียดแผนการรวบรวมผลผลิตการเกษตร",
      year_be: yearBE,
      plan_id: planId,
      branch_id: branchId ? Number(branchId) : null,
      branch_name: branchName || null,
      months: MONTHS.map((m) => ({ key: m.key, label: m.label })),
      items: editableItems.map((it) => ({
        id: it.id,
        product_id: it.product_id ?? null,
        name: it.name,
        unit: it.unitName,
        unit_price: toNumber(priceById[it.id]),
        values: MONTHS.reduce((acc, m) => {
          acc[m.key] = toNumber(qtyById?.[it.id]?.[m.key])
          return acc
        }, {}),
      })),
      totals: {
        month_qty: computed.monthQtyTotals,
        month_amount: computed.monthAmtTotals,
        grand_qty: computed.grand.qty,
        grand_amount: computed.grand.amt,
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

  /** ✅ sticky styles (ทึบ + zindex) */
  const stickyProductHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyProductCellBase =
    "sticky left-0 z-[60] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  return (
    <div className="space-y-3">
      {/* Header (เหมือนตัวเดิม) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold">ยอดขาย</div>
              <div className="text-xl md:text-2xl font-extrabold">
                รายละเอียดแผนการรวบรวมผลผลิตการเกษตร
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                หน่วย: พันบาท (คำนวณจาก จำนวน × ราคา/หน่วย)
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

              {MONTHS.map((m) => (
                <col key={`col-${m.key}`} style={{ width: COL_W.cell }} />
              ))}

              <col style={{ width: COL_W.totalQty }} />
              <col style={{ width: COL_W.totalAmt }} />
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              {/* row 1: headers */}
              <tr className="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                <th
                  rowSpan={3}
                  className={cx("border border-slate-300 px-3 py-2 text-center dark:border-slate-600", stickyProductHeader)}
                >
                  ประเภทสินค้า
                </th>
                <th rowSpan={3} className="border border-slate-300 px-3 py-2 text-center dark:border-slate-600">
                  หน่วยนับ
                </th>
                <th rowSpan={3} className="border border-slate-300 px-3 py-2 text-center dark:border-slate-600">
                  ราคา/ต่อหน่วย<br />
                  <span className="text-xs font-medium">(บาท)</span>
                </th>

                <th
                  colSpan={MONTHS.length}
                  className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600"
                >
                  ผลผลิตสินค้าที่รวบรวมในแต่ละเดือน (หน่วยนับ)
                </th>

                <th
                  colSpan={2}
                  className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600"
                >
                  รวมทั้งหมด
                </th>
              </tr>

              {/* row 2: เดือน + รวม */}
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
                  จำนวนหน่วย
                </th>
                <th className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600">
                  จำนวนเงิน<br />
                  <span className="text-xs font-medium">(พันบาท)</span>
                </th>
              </tr>

              {/* row 3: เลขลำดับคอลัมน์แบบในเรฟ */}
              <tr className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {Array.from({ length: 3 + MONTHS.length + 2 }).map((_, i) => (
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
              {editableItems.map((it, rowIdx) => {
                const isAuto = false

                // แถวทึบเพื่อไม่ให้ sticky เห็นทะลุ
                const rowBg =
                  rowIdx % 2 === 1 ? "bg-slate-50 dark:bg-slate-800" : "bg-white dark:bg-slate-900"

                // ✅ row index สำหรับ arrow-nav (เฉพาะ editable)
                const navRow = editableIndexById[it.id] ?? rowIdx

                // qty per month
                const qtyByMonth = MONTHS.map((m) => computed.itemQty?.[it.id]?.[m.key] ?? toNumber(qtyById?.[it.id]?.[m.key]))
                const amtByMonth = MONTHS.map((m) => computed.itemAmt?.[it.id]?.[m.key] ?? (toNumber(qtyById?.[it.id]?.[m.key]) * toNumber(priceById[it.id])))

                const totalQty = qtyByMonth.reduce((a, b) => a + toNumber(b), 0)
                const totalAmt = amtByMonth.reduce((a, b) => a + toNumber(b), 0)

                return (
                  <Fragment key={it.id}>
                    {/* ===== Row: จำนวน (ตัน) ===== */}
                    <tr className={rowBg}>
                      {/* product sticky */}
                      <td
                        rowSpan={2}
                        className={cx(
                          "border border-slate-200 px-3 py-2 font-semibold dark:border-slate-700",
                          stickyProductCellBase,
                          rowBg
                        )}
                      >
                        <div className="font-semibold">{it.name}</div>
                        {Number(it.product_id || 0) > 0 ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            product_id: {it.product_id}
                          </div>
                        ) : null}
                      </td>

                      {/* unit */}
                      <td className="border border-slate-200 px-3 py-2 text-center dark:border-slate-700">
                        {it.unitName}
                      </td>

                      {/* price */}
                      <td className="border border-slate-200 px-3 py-2 dark:border-slate-700">
                        <input
                          ref={registerInput(navRow, 0)}
                          data-row={navRow}
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

                      {/* months qty */}
                      {MONTHS.map((m, monthIdx) => {
                        const col = getQtyColIndex(monthIdx)
                        const stripe = monthStripeCell(monthIdx)

                        return (
                          <td
                            key={`${it.id}-${m.key}-qty`}
                            className={cx("border border-slate-200 px-2 py-2 dark:border-slate-700", stripe)}
                          >
                            <input
                              ref={registerInput(navRow, col)}
                              data-row={navRow}
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

                      {/* totals: qty */}
                      <td className="border border-slate-200 px-2 py-2 text-right font-extrabold dark:border-slate-700">
                        {fmtQty(totalQty)}
                      </td>

                      {/* totals: amount ช่องนี้ปล่อยว่างในแถวจำนวน */}
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                    </tr>

                    {/* ===== Row: บาท ===== */}
                    <tr className={rowBg}>
                      {/* unit: บาท */}
                      <td className="border border-slate-200 px-3 py-2 text-center font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                        บาท
                      </td>

                      {/* price blank */}
                      <td className="border border-slate-200 px-3 py-2 dark:border-slate-700" />

                      {/* months amount */}
                      {MONTHS.map((m, monthIdx) => {
                        const stripe = monthStripeCell(monthIdx)
                        return (
                          <td
                            key={`${it.id}-${m.key}-amt`}
                            className={cx(
                              "border border-slate-200 px-2 py-2 text-right text-slate-700 dark:border-slate-700 dark:text-slate-200",
                              stripe
                            )}
                          >
                            {fmtMoney(amtByMonth[monthIdx])}
                          </td>
                        )
                      })}

                      {/* totals qty blank */}
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />

                      {/* totals amount */}
                      <td className="border border-slate-200 px-2 py-2 text-right font-extrabold dark:border-slate-700">
                        {fmtMoney(totalAmt)}
                      </td>
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
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700">รวม (จำนวนหน่วย)</td>
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                  </tr>
                  <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700">รวม (จำนวนเงิน)</td>
                    <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
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
                      <col key={`f-${m.key}`} style={{ width: COL_W.cell }} />
                    ))}
                    <col style={{ width: COL_W.totalQty }} />
                    <col style={{ width: COL_W.totalAmt }} />
                  </colgroup>

                  <tbody>
                    {/* totals qty */}
                    <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                      {MONTHS.map((m, idx) => (
                        <td
                          key={`tq-${m.key}`}
                          className={cx(
                            "border border-slate-200 px-2 py-2 text-right dark:border-slate-700",
                            monthStripeFoot(idx)
                          )}
                        >
                          {fmtQty(computed.monthQtyTotals[m.key] ?? 0)}
                        </td>
                      ))}
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtQty(computed.grand.qty ?? 0)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                    </tr>

                    {/* totals amount */}
                    <tr className="font-extrabold text-slate-900 dark:text-emerald-100">
                      {MONTHS.map((m, idx) => (
                        <td
                          key={`ta-${m.key}`}
                          className={cx(
                            "border border-slate-200 px-2 py-2 text-right dark:border-slate-700",
                            monthStripeFoot(idx)
                          )}
                        >
                          {fmtMoney(computed.monthAmtTotals[m.key] ?? 0)}
                        </td>
                      ))}
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtMoney(computed.grand.amt ?? 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-3 md:p-4 text-sm text-slate-600 dark:text-slate-300">
          หมายเหตุ: ตอนนี้ยังเป็น Mock สำหรับกรอกข้อมูล/รวมยอด/เตรียม JSON เท่านั้น (ยังไม่บันทึกลง be )
        </div>
      </div>
    </div>
  )
}

export default AgriCollectionPlanTable
