import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../../lib/api"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import { useSidebarOpen } from "../../../components/AppLayout"
import { fetchProductsByGroup, onMasterDataChanged, ensureUnitPricesForProducts } from "../../../lib/useProductsByGroup"
import { SkeletonTableRows, ErrorState, EmptyState } from "../../../components/ui"

/* รายละเอียดแผนการรวบรวมผลผลิตการเกษตร */

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
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(n))

/** ---------------- UI styles ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-md border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] outline-none tabular-nums " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "transition-colors duration-150 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 " +
  "disabled:cursor-not-allowed disabled:opacity-60"

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

const FALLBACK_UNITS = [
  { id: -1, short: "หน่วย1", name: "หน่วย1" }
]

const COLLECTION_GROUP_ID = 3

const FALLBACK_ITEMS = [
  { id: "rice_dry_1", name: "ข้าวเปลือกแห้ง 1", unitName: "ตัน", unitPrice: "", product_id: 0, unitprice_id: null },
  { id: "rice_dry_2", name: "ข้าวเปลือกแห้ง 2", unitName: "ตัน", unitPrice: "", product_id: 0, unitprice_id: null },
  { id: "rice_fresh_1", name: "ข้าวเปลือกสด1", unitName: "ตัน", unitPrice: "", product_id: 0, unitprice_id: null },
  { id: "rice_fresh_2", name: "ข้าวเปลือกสด2", unitName: "ตัน", unitPrice: "", product_id: 0, unitprice_id: null },
  { id: "rice_offseason", name: "ข้าวเปลือกนาปรัง", unitName: "ตัน", unitPrice: "", product_id: 0, unitprice_id: null },
  { id: "rubber", name: "ยางพารา", unitName: "ตัน", unitPrice: "", product_id: 0, unitprice_id: null },
  { id: "cassava", name: "มันสำปะหลัง", unitName: "ตัน", unitPrice: "", product_id: 0, unitprice_id: null },
  { id: "corn", name: "ข้าวโพดเลี้ยงสัตว์", unitName: "ตัน", unitPrice: "", product_id: 0, unitprice_id: null },
]

const COL_W = {
  product: 200,
  unit: 64,
  price: 90,
  cell: 100,
}
const LEFT_W = COL_W.product + COL_W.unit + COL_W.price

const STRIPE = {
  headEven: "bg-slate-100 dark:bg-slate-700",
  headOdd: "bg-slate-200 dark:bg-slate-600",
  cellEven: "bg-white dark:bg-slate-900",
  cellOdd: "bg-slate-50 dark:bg-slate-800",
  footEven: "bg-emerald-100 dark:bg-emerald-900",
  footOdd: "bg-emerald-200 dark:bg-emerald-800",
}
const monthStripeHead = (idx) => (idx % 2 === 1 ? STRIPE.headOdd : STRIPE.headEven)
const monthStripeCell = (idx) => (idx % 2 === 1 ? STRIPE.cellOdd : STRIPE.cellEven)

const normalizeUnitName = (name) => String(name ?? "").trim().replace(/\s+/g, " ")
const shortUnit = (name, idx) => {
  const s = normalizeUnitName(name)
  if (!s) return `หน่วย${idx + 1}`
  return s.length <= 4 ? s : s.slice(0, 4)
}

function buildInitialQty(items, units) {
  const out = {}
    ; (items || []).forEach((it) => {
      out[it.id] = {}
      MONTHS.forEach((m) => {
        out[it.id][m.key] = {}
          ; (units || []).forEach((u) => {
            out[it.id][m.key][String(u.id)] = ""
          })
      })
    })
  return out
}

function buildInitialPrice(items) {
  const out = {}
    ; (items || []).forEach((it) => {
      out[it.id] = String(it.unitPrice ?? "")
    })
  return out
}

/**
 * Component: แผนการรวบรวมผลผลิตการเกษตร
 */
const AgriCollectionPlanTable = ({ branchId, branchName, yearBE, onYearBEChange }) => {
  const [items, setItems] = useState(FALLBACK_ITEMS)
  const [units, setUnits] = useState(FALLBACK_UNITS)

  const editableItems = useMemo(() => (Array.isArray(items) ? items : []), [items])

  const unitCols = useMemo(() => {
    const list = (units || []).slice()
    if (!list.length) return FALLBACK_UNITS
    return list.map((u, idx) => ({ ...u, short: u.short || shortUnit(u.name || "", idx) }))
  }, [units])

  const [priceById, setPriceById] = useState(() => buildInitialPrice(FALLBACK_ITEMS))
  const [qtyById, setQtyById] = useState(() => buildInitialQty(FALLBACK_ITEMS, FALLBACK_UNITS))

  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const canEdit = !!branchId

  const planId = useMemo(() => {
    const y = Number(yearBE || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [yearBE])

  /** ✅ โหลดข้อมูลหน่วยย่อยของสาขา */
  useEffect(() => {
    if (!branchId) { setUnits(FALLBACK_UNITS); return }
    let alive = true
      ; (async () => {
        try {
          const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
          const rows = Array.isArray(data) ? data : []
          const normalized = rows.map((r, idx) => {
            const id = Number(r.id || 0)
            const name = r.unit_name || r.klang_name || r.unit || r.name || `หน่วย ${id || idx + 1}`
            return { id, name: normalizeUnitName(name), short: shortUnit(name, idx) }
          }).filter((x) => x.id > 0)

          if (!alive) return
          setUnits(normalized.length ? normalized : FALLBACK_UNITS)
        } catch {
          if (!alive) return
          setUnits(FALLBACK_UNITS)
        }
      })()
    return () => { alive = false }
  }, [branchId])

  /** ✅ โหลดลิส “ประเภทสินค้า” (master + ราคาล่าสุด แบบ realtime) */
  const loadProducts = useCallback(async () => {
    if (!planId || planId <= 0) return
    setIsLoadingProducts(true)
    setLoadError(null)
    try {
      const merged = await fetchProductsByGroup(COLLECTION_GROUP_ID, Number(planId))

      const normalized = merged.map((x) => ({
        id: String(x.product_id || "").trim(),
        product_id: Number(x.product_id || 0),
        name: String(x.product_type || "").trim(),
        unitName: String(x.unit || "ตัน").trim(),
        unitPrice: x.sell_price ?? "",
        unitprice_id: x.unitprice_id ?? null,
      })).filter((x) => x.id && x.name)

      if (normalized.length) setItems(normalized)
      else setItems(FALLBACK_ITEMS)
    } catch (e) {
      setItems(FALLBACK_ITEMS)
      setLoadError(e?.message || "ไม่สามารถโหลดรายการสินค้าได้")
    } finally {
      setIsLoadingProducts(false)
    }
  }, [planId])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // refetch เมื่อ master data ถูกแก้จาก BusinessEdit
  useEffect(() => onMasterDataChanged(() => { loadProducts() }), [loadProducts])

  /** ✅ โหลดราคา (Unit Prices) ที่เคยเซฟไว้ในระบบ */
  const loadUnitPricesForYear = useCallback(async () => {
    const y = Number(yearBE || 0)
    if (!Number.isFinite(y) || y <= 0 || !editableItems.length) return
    try {
      const data = await apiAuth(`/unit-prices/${y}`)
      const remoteItems = Array.isArray(data?.items) ? data.items : []
      setPriceById((prev) => {
        const next = { ...prev }
        for (const remoteIt of remoteItems) {
          const pid = String(remoteIt.product_id || remoteIt.product || 0)
          const matchedItem = editableItems.find((x) => String(x.product_id) === pid)
          if (matchedItem) {
            next[matchedItem.id] = String(remoteIt.sell_price ?? "")
          }
        }
        return next
      })
    } catch { }
  }, [yearBE, editableItems])

  /** ✅ โหลดจำนวนปริมาณ (Sale Goals/Cells) ที่เคยเซฟไว้ในระบบ */
  const loadSavedFromBE = useCallback(async () => {
    if (!branchId || !planId || planId <= 0 || !editableItems.length) return
    try {
      const data = await apiAuth(`/revenue/sale-goals?plan_id=${Number(planId)}&branch_id=${Number(branchId)}`)
      const cells = Array.isArray(data?.cells) ? data.cells : (Array.isArray(data) ? data : [])
      setQtyById((prev) => {
        const next = { ...prev }
        for (const c of cells) {
          const pid = String(c.product_id || 0)
          const matchedItem = editableItems.find((x) => String(x.product_id) === pid)
          if (matchedItem) {
            const uid = String(c.unit_id || 0)
            const mo = Number(c.month || 0)
            const monthObj = MONTHS.find((m) => Number(m.month) === mo)
            if (monthObj) {
              if (!next[matchedItem.id]) next[matchedItem.id] = {}
              if (!next[matchedItem.id][monthObj.key]) next[matchedItem.id][monthObj.key] = {}
              next[matchedItem.id][monthObj.key][uid] = String(Number(c.amount || 0))
            }
          }
        }
        return next
      })
    } catch { }
  }, [branchId, planId, editableItems])

  /** ✅ sync state เบื้องต้นเมื่อเริ่ม หรือเมื่อ items/unitCols เปลี่ยนแปลง */
  useEffect(() => {
    setPriceById((prev) => {
      const next = buildInitialPrice(editableItems)
      for (const k of Object.keys(prev || {})) {
        if (next[k] !== undefined) next[k] = prev[k]
      }
      return next
    })

    setQtyById((prev) => {
      const next = buildInitialQty(editableItems, unitCols)
      for (const id of Object.keys(next)) {
        if (!prev?.[id]) continue
        for (const m of MONTHS) {
          for (const u of unitCols) {
            const uid = String(u.id)
            if (prev[id]?.[m.key]?.[uid] !== undefined) {
              next[id][m.key][uid] = prev[id][m.key][uid]
            }
          }
        }
      }
      return next
    })
  }, [editableItems, unitCols])

  /** ✅ โหลดข้อมูลจาก BE ทับลงมา */
  useEffect(() => { loadUnitPricesForYear() }, [loadUnitPricesForYear])
  useEffect(() => { loadSavedFromBE() }, [loadSavedFromBE])

  /** ================== ✅ Save to BE ==================
   * ส่งทุกเซลล์ (รวม 0/ค่าว่าง) เพื่อให้ BE เขียนทับค่าเดิม
   * ทำให้ "ลบเซลล์แล้วบันทึก" หรือ "รีเซ็ต" สามารถล้างค่าใน DB ได้จริง
   */
  const saveAll = useCallback(async (overrideQty, overridePrice) => {
    if (!branchId || !planId || !editableItems.length) return
    const qtySrc = overrideQty ?? qtyById
    const priceSrc = overridePrice ?? priceById
    setIsSaving(true)
    setSaveMsg(null)

    try {
      const cells = []
      const usedPids = new Set()
      for (const it of editableItems) {
        const pid = Number(it.product_id || 0)
        if (pid <= 0) continue
        for (const m of MONTHS) {
          for (const u of unitCols) {
            const uid = Number(u.id)
            const v = qtySrc?.[it.id]?.[m.key]?.[String(uid)] ?? ""
            const n = toNumber(v)
            cells.push({ unit_id: uid, product_id: pid, month: Number(m.month), amount: n, buy_price: 0 })
            if (n > 0) usedPids.add(pid)
          }
        }
      }

      const needPrice = editableItems
        .filter((it) => usedPids.has(Number(it.product_id)) && !it.unitprice_id)
        .map((it) => {
          const sellRaw = priceSrc?.[it.id] ?? it.unitPrice ?? 0
          return {
            product_id: Number(it.product_id),
            sell_price: sellRaw ?? 0,
            buy_price: 0,
            comment: "",
          }
        })
      if (needPrice.length) {
        await ensureUnitPricesForProducts(yearBE, needPrice)
      }

      await apiAuth(`/revenue/sale-goals/bulk`, {
        method: "PUT",
        body: { plan_id: Number(planId), branch_id: Number(branchId), cells }
      })

      setSaveMsg({ ok: true, title: "บันทึกสำเร็จ", detail: `สาขา ${branchName || ""} • ปี ${yearBE}` })

      await loadSavedFromBE()
      await loadUnitPricesForYear()
      await loadProducts()

    } catch (e) {
      setSaveMsg({ ok: false, title: "บันทึกไม่สำเร็จ", detail: e?.message || String(e) })
    } finally {
      setIsSaving(false)
    }
  }, [branchId, planId, yearBE, editableItems, priceById, qtyById, unitCols, branchName, loadSavedFromBE, loadUnitPricesForYear, loadProducts])

  /** ================== ✅ Arrow navigation ================== */
  const inputRefs = useRef(new Map())
  const sidebarOpen = useSidebarOpen()
  const tableWrapRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)
  useEffect(() => {
    const recalc = () => {
      const el = tableWrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setTableCardHeight(Math.max(400, Math.floor(window.innerHeight - rect.top - 100)))
    }
    recalc()
    window.addEventListener("resize", recalc)
    return () => window.removeEventListener("resize", recalc)
  }, [])

  const registerInput = useCallback((rIdx, cIdx) => (el) => {
    const key = `${rIdx}|${cIdx}`
    if (!el) inputRefs.current.delete(key)
    else inputRefs.current.set(key, el)
  }, [])

  const ensureInView = useCallback((el) => {
    const container = tableWrapRef.current
    if (!container || !el) return
    const pad = 20
    const frozenLeft = LEFT_W
    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()

    const visibleLeft = crect.left + frozenLeft + pad
    const visibleRight = crect.right - pad

    if (erect.left < visibleLeft) container.scrollLeft -= (visibleLeft - erect.left)
    else if (erect.right > visibleRight) container.scrollLeft += (erect.right - visibleRight)

    if (erect.top < crect.top + pad) container.scrollTop -= (crect.top + pad - erect.top)
    else if (erect.bottom > crect.bottom - pad) container.scrollTop += (erect.bottom - (crect.bottom - pad))
  }, [])

  const handleArrowNav = useCallback((e) => {
    const k = e.key
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(k)) return

    const rIdx = Number(e.currentTarget.dataset.row ?? 0)
    const cIdx = Number(e.currentTarget.dataset.col ?? 0)

    // คำนวณจำนวนคอลัมน์ทั้งหมด (1 ราคาต่อหน่วย + [จำนวนเดือน * จำนวนหน่วย])
    const totalCols = 1 + (MONTHS.length * unitCols.length)

    let nextR = rIdx, nextC = cIdx

    if (k === "ArrowLeft") {
      if (cIdx === 0) {
        // ถ้าอยู่เซลล์ซ้ายสุด (ราคา) ให้ขึ้นไปแถวบน คอลัมน์ขวาสุด
        if (rIdx > 0) {
          nextR = rIdx - 1
          nextC = totalCols - 1
        }
      } else {
        nextC = cIdx - 1
      }
    }

    if (k === "ArrowRight" || k === "Enter") {
      if (cIdx === totalCols - 1) {
        // ถ้าอยู่เซลล์ขวาสุด ให้ลงไปแถวถัดไป คอลัมน์แรก (ราคา)
        if (rIdx < editableItems.length - 1) {
          nextR = rIdx + 1
          nextC = 0
        }
      } else {
        nextC = cIdx + 1
      }
    }

    if (k === "ArrowUp") nextR = Math.max(0, rIdx - 1)
    if (k === "ArrowDown") nextR = Math.min(editableItems.length - 1, rIdx + 1)

    const target = inputRefs.current.get(`${nextR}|${nextC}`)
    if (target) {
      e.preventDefault()
      target.focus()
      try { target.select() } catch { }
      requestAnimationFrame(() => ensureInView(target))
    }
  }, [editableItems.length, unitCols.length, ensureInView])

  /** ===================================================================== */

  const setQtyCell = (itemId, monthKey, unitId, nextValue) => {
    setQtyById((prev) => {
      const copy = { ...prev }
      if (!copy[itemId]) copy[itemId] = {}
      if (!copy[itemId][monthKey]) copy[itemId][monthKey] = {}
      copy[itemId][monthKey] = { ...copy[itemId][monthKey], [String(unitId)]: nextValue }
      return copy
    })
  }

  const setUnitPrice = (itemId, nextValue) => {
    setPriceById((prev) => ({ ...prev, [itemId]: nextValue }))
  }

  const computed = useMemo(() => {
    const perMonth = {}
    const perItem = {}
    const grandUnitTotals = {}
    const perItemBranch = {}
    const perMonthBranch = {}
    const grandBranchTotal = { qty: 0, baht: 0 }

    for (const m of MONTHS) {
      perMonth[m.key] = {}
      perMonthBranch[m.key] = { qty: 0, baht: 0 }
      for (const u of unitCols) perMonth[m.key][String(u.id)] = { qty: 0, baht: 0 }
    }
    for (const it of editableItems) {
      perItem[it.id] = {}
      perItemBranch[it.id] = { qty: 0, baht: 0 }
      for (const u of unitCols) perItem[it.id][String(u.id)] = { qty: 0, baht: 0 }
    }
    for (const u of unitCols) grandUnitTotals[String(u.id)] = { qty: 0, baht: 0 }

    let grandValue = 0

    for (const it of editableItems) {
      const price = toNumber(priceById[it.id])

      for (const m of MONTHS) {
        for (const u of unitCols) {
          const uid = String(u.id)
          const q = toNumber(qtyById?.[it.id]?.[m.key]?.[uid])
          const amt = q * price

          perMonth[m.key][uid].qty += q
          perMonth[m.key][uid].baht += amt

          perItem[it.id][uid].qty += q
          perItem[it.id][uid].baht += amt

          grandUnitTotals[uid].qty += q
          grandUnitTotals[uid].baht += amt

          perItemBranch[it.id].qty += q
          perItemBranch[it.id].baht += amt
          perMonthBranch[m.key].qty += q
          perMonthBranch[m.key].baht += amt
          grandBranchTotal.qty += q
          grandBranchTotal.baht += amt

          grandValue += amt
        }
      }
    }
    return { perMonth, perItem, grandUnitTotals, grandValue, perItemBranch, perMonthBranch, grandBranchTotal }
  }, [qtyById, priceById, editableItems, unitCols])

  const resetAll = async () => {
    if (!confirm("รีเซ็ตข้อมูลทั้งหมดในตารางและบันทึกค่าว่าง (0) ลงระบบ?")) return
    const emptyQty = buildInitialQty(editableItems, unitCols)
    const emptyPrice = buildInitialPrice(editableItems)
    setPriceById(emptyPrice)
    setQtyById(emptyQty)
    if (canEdit) {
      await saveAll(emptyQty, emptyPrice)
    }
  }

  const payload = useMemo(() => {
    return {
      table_code: "AGRI_COLLECTION_PLAN_DETAIL",
      table_name: "รายละเอียดแผนการรวบรวมผลผลิตการเกษตร",
      year_be: yearBE,
      plan_id: planId,
      branch_id: branchId ? Number(branchId) : null,
      branch_name: branchName || null,
      months: MONTHS.map((m) => ({ key: m.key, label: m.label })),
      units: unitCols.map((u) => ({ id: u.id, name: u.name })),
      items: editableItems.map((it) => ({
        id: it.id,
        product_id: it.product_id ?? null,
        name: it.name,
        unit: it.unitName,
        unit_price: toNumber(priceById[it.id]),
        values: MONTHS.reduce((acc, m) => {
          acc[m.key] = unitCols.reduce((uAcc, u) => {
            uAcc[u.id] = toNumber(qtyById?.[it.id]?.[m.key]?.[String(u.id)])
            return uAcc
          }, {})
          return acc
        }, {}),
      })),
      totals: {
        month: computed.perMonth,
        grand: computed.grandUnitTotals,
        grand_baht_all: computed.grandValue
      },
    }
  }, [yearBE, planId, branchId, branchName, qtyById, priceById, computed, editableItems, unitCols])

  const RIGHT_W = useMemo(() => {
    const monthColsW = MONTHS.length * unitCols.length * COL_W.cell
    const totalColsW = unitCols.length * (COL_W.cell + COL_W.price) + COL_W.cell + COL_W.price
    return monthColsW + totalColsW
  }, [unitCols.length])

  const TOTAL_W = useMemo(() => LEFT_W + RIGHT_W, [RIGHT_W])

  // จำนวนคอลัมน์รวมของแถวในตาราง (ใช้ทำ colSpan ให้ skeleton/empty/error)
  const BODY_COLS = useMemo(
    () => 3 + MONTHS.length * unitCols.length + unitCols.length * 2 + 2,
    [unitCols.length],
  )
  const showSkeleton = isLoadingProducts && !editableItems.length

  const stickyShadow = "shadow-[0_0_0_1px_rgba(148,163,184,0.6)] dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]"
  const headCell = "px-1.5 py-1.5 text-[12px] font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-600"
  const leftHeadCell = cx(headCell, "sticky left-0 z-20", stickyShadow)
  const leftCell = "px-1.5 py-1.5 text-[12px] text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700"
  const leftCellSticky = cx(leftCell, "sticky left-0 z-10", stickyShadow)
  const cellClass = "px-1 py-1 text-[12px] border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 tabular-nums"
  const rowDivider = "border-b-[2px] border-b-slate-300 dark:border-b-slate-600"
  const footerBorder = "border-t-[2px] border-t-emerald-500 dark:border-t-emerald-600"

  return (
    <>
      <div className="w-full">
        {/* Table Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700" ref={tableWrapRef} style={{ maxHeight: tableCardHeight }}>
            <table className="min-w-full border-collapse" style={{ width: TOTAL_W }}>
              <colgroup>
                <col style={{ width: COL_W.product }} />
                <col style={{ width: COL_W.unit }} />
                <col style={{ width: COL_W.price }} />
                {MONTHS.map((m) => unitCols.map((u) => <col key={`${m.key}-${u.id}`} style={{ width: COL_W.cell }} />))}
                {unitCols.map((u) => (
                  <Fragment key={`totcol-${u.id}`}>
                    <col style={{ width: COL_W.cell }} />
                    <col style={{ width: COL_W.price }} />
                  </Fragment>
                ))}
                <col style={{ width: COL_W.cell }} />
                <col style={{ width: COL_W.price }} />
              </colgroup>

              <thead className="sticky top-0 z-30">
                {/* Header Row 1 */}
                <tr>
                  <th className={cx(leftHeadCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>
                    ประเภทสินค้า
                  </th>
                  <th className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>
                    หน่วยนับ
                  </th>
                  <th className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} rowSpan={3}>
                    ราคาต่อหน่วย<br />(บาท)
                  </th>
                  <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")} colSpan={MONTHS.length * unitCols.length}>
                    ผลผลิตสินค้าที่รวบรวมในแต่ละเดือน (หน่วยนับ)
                  </th>
                  {unitCols.map((u, i) => (
                    <th key={`superh-tot-${u.id}`} className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} colSpan={2} rowSpan={2}>
                      รวมทั้งหมด {unitCols.length > 1 ? `(${u.name})` : ''}
                    </th>
                  ))}
                  <th className={cx(headCell, STRIPE.headEven, "align-middle border-b border-b-slate-300 dark:border-b-slate-600")} colSpan={2} rowSpan={2}>
                    รวมทั้งหมด (สาขา)
                  </th>
                </tr>
                {/* Header Row 2: เดือน */}
                <tr>
                  {MONTHS.map((m, mi) => (
                    <th key={`h2-${m.key}`} className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 text-center")} colSpan={unitCols.length}>
                      {m.label}
                    </th>
                  ))}
                </tr>
                {/* Header Row 3: หน่วยย่อยของสาขา */}
                <tr>
                  {MONTHS.map((m, mi) => (
                    <Fragment key={`h3-${m.key}`}>
                      {unitCols.map((u) => (
                        <th key={`h3-${m.key}-${u.id}`} className={cx(headCell, monthStripeHead(mi), "border-b border-b-slate-300 dark:border-b-slate-600 font-medium text-slate-700 dark:text-slate-200")}>
                          {u.name}
                        </th>
                      ))}
                    </Fragment>
                  ))}
                  {unitCols.map((u) => (
                    <Fragment key={`sumh-${u.id}`}>
                      <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>จำนวนหน่วย</th>
                      <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>จำนวนเงิน (พันบาท)</th>
                    </Fragment>
                  ))}
                  <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>จำนวนหน่วย</th>
                  <th className={cx(headCell, STRIPE.headEven, "border-b border-b-slate-300 dark:border-b-slate-600")}>จำนวนเงิน (พันบาท)</th>
                </tr>
              </thead>

              <tbody>
                {showSkeleton ? (
                  <SkeletonTableRows rows={8} cols={BODY_COLS} />
                ) : null}
                {!showSkeleton && loadError ? (
                  <tr>
                    <td colSpan={BODY_COLS} className="p-3">
                      <ErrorState message={loadError} onRetry={loadProducts} />
                    </td>
                  </tr>
                ) : null}
                {!showSkeleton && !loadError && !editableItems.length ? (
                  <tr>
                    <td colSpan={BODY_COLS}>
                      <EmptyState
                        title="ยังไม่มีรายการสินค้า"
                        description={planId > 0 ? "ยังไม่พบสินค้าในกลุ่มนี้สำหรับปีงบประมาณที่เลือก" : "เลือกปีงบประมาณเพื่อเริ่มวางแผน"}
                      />
                    </td>
                  </tr>
                ) : null}
                {!showSkeleton && editableItems.map((it, rowIdx) => {
                  const stripeCls = rowIdx % 2 === 0 ? STRIPE.cellEven : STRIPE.cellOdd
                  const price = toNumber(priceById[it.id])

                  return (
                    <Fragment key={it.id}>
                      {/* แถวจำนวนหน่วย (Inputs) */}
                      <tr className="group">
                        <td rowSpan={2} className={cx(leftCellSticky, stripeCls, rowDivider, "align-middle")}>
                          <div className="font-semibold">{it.name}</div>
                          {Number(it.product_id || 0) > 0 && (
                            <div className="text-[10px] text-slate-500">id: {it.product_id}</div>
                          )}
                        </td>
                        <td className={cx(cellClass, stripeCls)}>
                          <div className="font-semibold text-center">{it.unitName}</div>
                        </td>
                        <td rowSpan={2} className={cx(cellClass, stripeCls, rowDivider, "align-middle")}>
                          <input
                            ref={registerInput(rowIdx, 0)}
                            data-row={rowIdx} data-col={0}
                            onKeyDown={handleArrowNav}
                            className={cellInput}
                            value={priceById[it.id] ?? ""}
                            disabled={!canEdit}
                            inputMode="decimal"
                            placeholder="0"
                            onChange={(e) => setUnitPrice(it.id, sanitizeNumberInput(e.target.value))}
                          />
                        </td>

                        {MONTHS.map((m, mi) => (
                          <Fragment key={`${it.id}-q-${m.key}`}>
                            {unitCols.map((u, ui) => {
                              const uid = String(u.id)
                              const v = qtyById?.[it.id]?.[m.key]?.[uid] ?? ""
                              const colIdx = 1 + (mi * unitCols.length) + ui
                              return (
                                <td key={`${it.id}-q-${m.key}-${uid}`} className={cx(cellClass, monthStripeCell(mi))}>
                                  <input
                                    ref={registerInput(rowIdx, colIdx)}
                                    data-row={rowIdx} data-col={colIdx}
                                    onKeyDown={handleArrowNav}
                                    className={cellInput}
                                    value={String(v)}
                                    disabled={!canEdit}
                                    inputMode="decimal"
                                    placeholder="0"
                                    onChange={(e) => setQtyCell(it.id, m.key, uid, sanitizeNumberInput(e.target.value))}
                                  />
                                </td>
                              )
                            })}
                          </Fragment>
                        ))}

                        {/* ผลรวมสินค้านั้น */}
                        {unitCols.map((u) => (
                          <Fragment key={`${it.id}-sum-${u.id}`}>
                            <td className={cx(cellClass, STRIPE.footEven)}>
                              <div className="text-right font-semibold text-slate-800 dark:text-slate-200">
                                {fmtQty(computed.perItem[it.id]?.[String(u.id)]?.qty || 0)}
                              </div>
                            </td>
                            <td rowSpan={2} className={cx(cellClass, STRIPE.footEven, rowDivider, "align-middle")}>
                              <div className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                                {fmtMoney(computed.perItem[it.id]?.[String(u.id)]?.baht || 0)}
                              </div>
                            </td>
                          </Fragment>
                        ))}
                        <td className={cx(cellClass, STRIPE.footEven)}>
                          <div className="text-right font-semibold text-slate-800 dark:text-slate-200">
                            {fmtQty(computed.perItemBranch[it.id]?.qty || 0)}
                          </div>
                        </td>
                        <td rowSpan={2} className={cx(cellClass, STRIPE.footEven, rowDivider, "align-middle")}>
                          <div className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                            {fmtMoney(computed.perItemBranch[it.id]?.baht || 0)}
                          </div>
                        </td>
                      </tr>

                      {/* แถวจำนวนเงิน/บาท (Calculated) */}
                      <tr className="group">
                        <td className={cx(cellClass, stripeCls, rowDivider)}>
                          <div className="text-[11px] text-center text-slate-500 dark:text-slate-400">บาท</div>
                        </td>
                        {MONTHS.map((m, mi) => (
                          <Fragment key={`${it.id}-b-${m.key}`}>
                            {unitCols.map((u) => {
                              const uid = String(u.id)
                              const n = toNumber(qtyById?.[it.id]?.[m.key]?.[uid] ?? "")
                              const b = n * price
                              return (
                                <td key={`${it.id}-b-${m.key}-${uid}`} className={cx(cellClass, monthStripeCell(mi), rowDivider)}>
                                  <div className="px-1.5 text-right text-slate-600 dark:text-slate-300">
                                    {b > 0 ? fmtMoney(b) : "-"}
                                  </div>
                                </td>
                              )
                            })}
                          </Fragment>
                        ))}
                        {unitCols.map((u) => (
                          <td key={`${it.id}-sum-pad-${u.id}`} className={cx(cellClass, STRIPE.footEven, rowDivider)} />
                        ))}
                        <td className={cx(cellClass, STRIPE.footEven, rowDivider)} />
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot className="sticky bottom-[28px] z-20">
                {/* ----- FOOTER: สรุปยอดรวมทั้งหมด ด้านล่าง ----- */}
                <tr>
                  <td rowSpan={2} className={cx(leftCellSticky, STRIPE.footOdd, footerBorder, "align-middle")}>
                    <div className="font-bold text-center text-[13px]">รวม</div>
                  </td>
                  <td className={cx(cellClass, STRIPE.footOdd, footerBorder)}>
                    <div className="font-semibold text-center">หน่วย</div>
                  </td>
                  <td rowSpan={2} className={cx(cellClass, STRIPE.footOdd, footerBorder, "align-middle")} />

                  {MONTHS.map((m, mi) => (
                    <Fragment key={`ft-q-${m.key}`}>
                      {unitCols.map((u) => (
                        <td key={`ft-q-${m.key}-${u.id}`} className={cx(cellClass, monthStripeHead(mi), footerBorder)}>
                          <div className="px-1.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                            {fmtQty(computed.perMonth[m.key][String(u.id)].qty)}
                          </div>
                        </td>
                      ))}
                    </Fragment>
                  ))}

                  {unitCols.map((u) => (
                    <Fragment key={`ft-sum-${u.id}`}>
                      <td className={cx(cellClass, STRIPE.footOdd, footerBorder)}>
                        <div className="text-right font-bold text-[13px] text-slate-900 dark:text-slate-100">
                          {fmtQty(computed.grandUnitTotals[String(u.id)].qty)}
                        </div>
                      </td>
                      <td rowSpan={2} className={cx(cellClass, STRIPE.footOdd, footerBorder, "align-middle")}>
                        <div className="text-right font-bold text-[14px] text-slate-900 dark:text-slate-100">
                          {fmtMoney(computed.grandUnitTotals[String(u.id)].baht)}
                        </div>
                      </td>
                    </Fragment>
                  ))}
                  <td className={cx(cellClass, STRIPE.footOdd, footerBorder)}>
                    <div className="text-right font-bold text-[13px] text-slate-900 dark:text-slate-100">
                      {fmtQty(computed.grandBranchTotal.qty)}
                    </div>
                  </td>
                  <td rowSpan={2} className={cx(cellClass, STRIPE.footOdd, footerBorder, "align-middle")}>
                    <div className="text-right font-bold text-[14px] text-slate-900 dark:text-slate-100">
                      {fmtMoney(computed.grandBranchTotal.baht)}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td className={cx(cellClass, STRIPE.footOdd)}>
                    <div className="text-[11px] font-semibold text-center text-slate-600 dark:text-slate-300">บาท</div>
                  </td>
                  {MONTHS.map((m, mi) => (
                    <Fragment key={`ft-b-${m.key}`}>
                      {unitCols.map((u) => (
                        <td key={`ft-b-${m.key}-${u.id}`} className={cx(cellClass, monthStripeHead(mi))}>
                          <div className="px-1.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                            {fmtMoney(computed.perMonth[m.key][String(u.id)].baht)}
                          </div>
                        </td>
                      ))}
                    </Fragment>
                  ))}
                  {unitCols.map((u) => (
                    <td key={`ft-pad-${u.id}`} className={cx(cellClass, STRIPE.footOdd)} />
                  ))}
                  <td className={cx(cellClass, STRIPE.footOdd)} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action Buttons (UI ด้านล่าง และปุ่มบันทึก) */}
          <div className="shrink-0 pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
            {/* กล่องข้อความแจ้งเตือนหลังกดบันทึก */}
            {saveMsg && (
              <div className={cx("mb-3 rounded-xl border p-3 text-[13px]", saveMsg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200")}>
                <div className="font-bold">{saveMsg.title}</div>
                <div className="opacity-90 mt-0.5">{saveMsg.detail}</div>
              </div>
            )}

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
              <button
                type="button"
                onClick={resetAll}
                disabled={isSaving || !canEdit}
                className={cx(
                  "inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold transition",
                  (isSaving || !canEdit)
                    ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100 cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
                )}
              >
                รีเซ็ต
              </button>

              {/* ปุ่มบันทึกลงระบบใหม่ */}
              <button
                type="button"
                onClick={() => saveAll()}
                disabled={isSaving || !canEdit}
                className={cx(
                  "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white transition",
                  (isSaving || !canEdit)
                    ? "bg-slate-300 text-slate-700 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:scale-[1.03] active:scale-[.98] cursor-pointer"
                )}
              >
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>

        </div>
      </div>
      <StickyTableScrollbar tableRef={tableWrapRef} sidebarOpen={sidebarOpen} />
    </>
  )
}

export default AgriCollectionPlanTable