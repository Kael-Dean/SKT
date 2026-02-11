// src/pages/operation-plan/sell/AgriProcessingPlanDetail.jsx
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

/** ใช้ลิสประเภทสินค้าจาก BE ของ “แปรรูป” */
const PROCESSING_GROUP_ID = 4

/** fallback เผื่อ BE ยังไม่พร้อม */
const FALLBACK_ITEMS = [
  { type: "group", label: "ข้าวสารและผลิตภัณฑ์ (ผลั่วทั่วไป)" },
  { type: "item", id: "rice_general", product_id: null, name: "ทั่วไป", unit: "ตัน", sell_price: "", buy_price: "" },
  { type: "item", id: "rice_organic", product_id: null, name: "อินทรีย์", unit: "ตัน", sell_price: "", buy_price: "" },
  { type: "group", label: "ผลพลอยได้" },
  { type: "item", id: "byproduct", product_id: null, name: "ผลพลอยได้", unit: "ตัน", sell_price: "", buy_price: "" },
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
  ;(editableItems || []).forEach((it) => {
    out[it.id] = {
      sell_price: String(it.sell_price ?? ""),
      buy_price: String(it.buy_price ?? ""),
      comment: String(it.comment ?? ""),
    }
  })
  return out
}

// widths
const COL_W = {
  product: 280,
  unit: 70,
  sell: 110,
  buy: 110,
  month: 86,
  totalQty: 95,
  totalAmt: 120,
}
const LEFT_W = COL_W.product + COL_W.unit + COL_W.sell + COL_W.buy
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

const dashIfAny = (any, formatted) => (any ? formatted : "-")

const AgriProcessingPlanDetail = ({ branchId, branchName, yearBE, planId }) => {
  /** items from BE (fallback ได้) */
  const [items, setItems] = useState(FALLBACK_ITEMS)
  const editableItems = useMemo(() => (Array.isArray(items) ? items.filter((x) => x.type === "item") : []), [items])

  /** plan_id: 2569 => 1 (รองรับ prop planId จาก OperationPlan) */
  const effectivePlanId = useMemo(() => {
    const p = Number(planId || 0)
    if (Number.isFinite(p) && p > 0) return p
    const y = Number(yearBE || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [planId, yearBE])

  const effectiveYearBE = useMemo(() => {
    const y = Number(yearBE || 0)
    if (Number.isFinite(y) && y >= 2569) return y
    const p = Number(planId || 0)
    return Number.isFinite(p) && p > 0 ? 2568 + p : 2569
  }, [yearBE, planId])

  /** unit ของสาขา */
  const [units, setUnits] = useState([])
  const defaultUnitId = useMemo(() => {
    const u = (units || []).find((x) => Number(x?.id) > 0)
    return u ? Number(u.id) : null
  }, [units])

  const canEdit = !!branchId && !!defaultUnitId

  /** map ต้นทุนการขายจาก /unit-prices/{year} */
  const [unitPriceMap, setUnitPriceMap] = useState({})
  const [isLoadingUnitPrices, setIsLoadingUnitPrices] = useState(false)

  const loadUnitPricesForYear = useCallback(async () => {
    const y = Number(effectiveYearBE || 0)
    if (!Number.isFinite(y) || y <= 0) {
      setUnitPriceMap({})
      return
    }
    setIsLoadingUnitPrices(true)
    try {
      const data = await apiAuth(`/unit-prices/${y}`)
      const list = Array.isArray(data?.items) ? data.items : []
      const map = {}
      for (const it of list) {
        const pid = Number(it.product_id || it.product || 0)
        if (!pid) continue
        map[String(pid)] = {
          sell_price: String(it.sell_price ?? ""),
          buy_price: String(it.buy_price ?? ""),
          comment: String(it.comment ?? ""),
        }
      }
      setUnitPriceMap(map)
    } catch (e) {
      console.warn("[AgriProcessing] load unit-prices failed:", e)
      setUnitPriceMap({})
    } finally {
      setIsLoadingUnitPrices(false)
    }
  }, [effectiveYearBE])

  useEffect(() => {
    loadUnitPricesForYear()
  }, [loadUnitPricesForYear])

  /** load units of branch */
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)
  useEffect(() => {
    if (!branchId) {
      setUnits([])
      return
    }
    let alive = true
    ;(async () => {
      try {
        setIsLoadingUnits(true)
        const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
        const rows = Array.isArray(data) ? data : []
        const normalized = rows
          .map((r) => ({
            id: Number(r.id || 0),
            name: String(r.unit_name || r.unit || r.name || "").trim(),
          }))
          .filter((x) => x.id > 0)
        if (!alive) return
        setUnits(normalized)
      } catch (e) {
        console.warn("[AgriProcessing] load units failed:", e)
        if (!alive) return
        setUnits([])
      } finally {
        if (alive) setIsLoadingUnits(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [branchId])

  /** state grid */
  const [priceById, setPriceById] = useState(() =>
    buildInitialPrice(FALLBACK_ITEMS.filter((x) => x.type === "item"))
  )
  const [qtyById, setQtyById] = useState(() => buildInitialQty(FALLBACK_ITEMS.filter((x) => x.type === "item")))
  const [showPayload, setShowPayload] = useState(false)

  /** โหลดลิสประเภทสินค้า “แปรรูป” จาก BE + merge sell/buy จาก unitPriceMap */
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!effectivePlanId || effectivePlanId <= 0) return

        setIsLoadingProducts(true)
        const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${Number(effectivePlanId)}`)
        const group = data?.[String(PROCESSING_GROUP_ID)] || data?.[PROCESSING_GROUP_ID]
        const list = Array.isArray(group?.items) ? group.items : []

        const normalizedItems = list
          .filter((x) => Number(x.business_group || 0) === PROCESSING_GROUP_ID)
          .map((x) => {
            const pid = Number(x.product_id || x.id || 0) || null
            const fallback = pid ? unitPriceMap[String(pid)] : null

            const sellFromList = x.sell_price ?? ""
            const buyFromList = x.buy_price ?? ""

            const sellMerged =
              (sellFromList === null || sellFromList === undefined || Number(sellFromList) === 0) && fallback
                ? fallback.sell_price
                : sellFromList
            const buyMerged =
              (buyFromList === null || buyFromList === undefined || Number(buyFromList) === 0) && fallback
                ? fallback.buy_price
                : buyFromList

            return {
              type: "item",
              id: String(pid || "").trim() || String(x.id || "").trim(),
              product_id: pid,
              name: String(x.product_type || x.name || "").trim(),
              unit: String(x.unit || "ตัน").trim(),
              sell_price: sellMerged ?? "",
              buy_price: buyMerged ?? "",
              comment: String((fallback?.comment ?? x.comment ?? "") || ""),
            }
          })
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
      } finally {
        if (alive) setIsLoadingProducts(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [effectivePlanId, unitPriceMap])

  /** sync state ตาม items */
  useEffect(() => {
    setPriceById((prev) => {
      const next = buildInitialPrice(editableItems.length ? editableItems : FALLBACK_ITEMS.filter((x) => x.type === "item"))
      for (const k of Object.keys(prev || {})) {
        if (next[k] !== undefined) next[k] = { ...next[k], ...prev[k] }
      }
      return next
    })

    setQtyById((prev) => {
      const next = buildInitialQty(editableItems.length ? editableItems : FALLBACK_ITEMS.filter((x) => x.type === "item"))
      for (const id of Object.keys(next)) {
        if (!prev?.[id]) continue
        for (const m of MONTHS) {
          if (prev[id][m.key] !== undefined) next[id][m.key] = prev[id][m.key]
        }
      }
      return next
    })
  }, [editableItems])

  /** โหลดค่าที่เคยบันทึกไว้จาก BE (แสดงล่าสุดเหมือนหน้าเดิม) */
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const loadSavedFromBE = useCallback(async () => {
    if (!branchId) return
    if (!effectivePlanId || effectivePlanId <= 0) return
    if (!defaultUnitId) return
    if (!editableItems.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/revenue/sale-goals?plan_id=${Number(effectivePlanId)}&branch_id=${Number(branchId)}`)
      const cells = Array.isArray(data?.cells) ? data.cells : []

      const pSet = new Set(editableItems.map((x) => Number(x.product_id || 0)).filter(Boolean))
      const empty = buildInitialQty(editableItems)

      for (const c of cells) {
        const pid = Number(c.product_id || 0)
        const uid = Number(c.unit_id || 0)
        const mo = Number(c.month || 0)
        const amt = c.amount ?? 0

        if (!pSet.has(pid)) continue
        if (uid !== Number(defaultUnitId)) continue

        const monthObj = MONTHS.find((m) => Number(m.month) === mo)
        if (!monthObj) continue

        const rowId = String(pid)
        if (!empty[rowId]) continue
        empty[rowId][monthObj.key] = String(Number(amt || 0))
      }

      setQtyById(empty)
    } catch (e) {
      console.warn("[AgriProcessing] load saved sale-goals failed:", e)
    } finally {
      setIsLoadingSaved(false)
    }
  }, [branchId, effectivePlanId, defaultUnitId, editableItems])

  useEffect(() => {
    loadSavedFromBE()
  }, [loadSavedFromBE])

  /** table height */
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

  /** scroll sync */
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

  /** arrow nav */
  const inputRefs = useRef(new Map())
  const totalCols = 2 + MONTHS.length // col0 sell, col1 buy, col2.. = qty

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

  const getQtyColIndex = (monthIdx) => 2 + monthIdx

  const setQtyCell = (itemId, monthKey, nextValue) => {
    setQtyById((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [monthKey]: nextValue },
    }))
  }

  const setPriceField = (itemId, field, nextValue) => {
    setPriceById((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { sell_price: "", buy_price: "", comment: "" }), [field]: nextValue },
    }))
  }

  /** computed */
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
      const pr = priceById[it.id] || {}
      const sell = toNumber(pr.sell_price)
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
        const amt = q * sell
        rowQty += q
        rowAmt += amt
        monthQtyTotals[m.key] += q
        monthAmtTotals[m.key] += amt
      })

      grandQty += rowQty
      grandAmt += rowAmt
      itemTotals[it.id] = { qty: rowQty, amt: rowAmt, any: rowAny }
    })

    return { itemTotals, monthQtyTotals, monthAmtTotals, monthAny, anyAll, grandQty, grandAmt }
  }, [qtyById, priceById, editableItems])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setPriceById(buildInitialPrice(editableItems))
    setQtyById(buildInitialQty(editableItems))
  }

  /** payload (ไว้ debug) */
  const payload = useMemo(() => {
    return {
      table_code: "AGRI_PROCESSING_PLAN_DETAIL",
      table_name: "รายละเอียดแผนการแปรรูปผลผลิตการเกษตร",
      year_be: effectiveYearBE,
      plan_id: effectivePlanId,
      branch_id: branchId ? Number(branchId) : null,
      branch_name: branchName || null,
      unit_id_for_save: defaultUnitId,
      months: MONTHS.map((m) => ({ key: m.key, label: m.label, month: m.month })),
      items: editableItems.map((it) => ({
        id: it.id,
        product_id: it.product_id ?? null,
        name: it.name,
        unit: it.unit,
        sell_price: toNumber(priceById[it.id]?.sell_price),
        buy_price: toNumber(priceById[it.id]?.buy_price),
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
  }, [effectiveYearBE, effectivePlanId, branchId, branchName, defaultUnitId, qtyById, priceById, computed, editableItems])

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      alert("คัดลอก JSON payload แล้ว ✅")
    } catch (e) {
      console.error(e)
      alert("คัดลอกไม่สำเร็จ — เปิด payload แล้ว copy เองได้ครับ")
    }
  }

  /** SAVE */
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const saveAll = useCallback(async () => {
    if (!branchId) throw new Error("FE: ยังไม่มี branch_id")
    if (!defaultUnitId) throw new Error("FE: ไม่พบ unit ของสาขา (unit_id)")
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (${effectivePlanId})`)
    if (!editableItems.length) throw new Error("FE: ไม่มีรายการให้บันทึก")

    setIsSaving(true)
    setSaveMsg(null)

    try {
      // 1) Save unit prices (sell/buy) — ถ้า BE บล็อกสิทธิ์ก็ไม่ทำให้ล้ม
      const priceItems = editableItems
        .filter((x) => Number(x.product_id || 0) > 0)
        .map((x) => {
          const pid = Number(x.product_id)
          const pr = priceById[String(pid)] || priceById[x.id] || {}
          return {
            product_id: pid,
            sell_price: toNumber(pr.sell_price),
            buy_price: toNumber(pr.buy_price),
            comment: String(pr.comment ?? ""),
          }
        })

      try {
        await apiAuth(`/unit-prices/bulk`, { method: "PUT", body: { year: Number(effectiveYearBE), items: priceItems } })
      } catch (e) {
        try {
          for (const it of priceItems) {
            await apiAuth(`/unit-prices`, {
              method: "PUT",
              body: {
                year: Number(effectiveYearBE),
                product_id: it.product_id,
                sell_price: it.sell_price,
                buy_price: it.buy_price,
                comment: it.comment,
              },
            })
          }
        } catch (e2) {
          console.warn("[AgriProcessing] save unit-prices fallback failed:", e2)
        }
      }

      // 2) Save sale goals (qty)
      const cells = []
      for (const it of editableItems) {
        const pid = Number(it.product_id || 0)
        if (!pid) continue
        for (const m of MONTHS) {
          const raw = qtyById?.[String(pid)]?.[m.key] ?? qtyById?.[it.id]?.[m.key] ?? ""
          const n = toNumber(raw)
          if (!n) continue
          cells.push({
            unit_id: Number(defaultUnitId),
            product_id: pid,
            month: Number(m.month),
            amount: n,
          })
        }
      }

      await apiAuth(`/revenue/sale-goals/bulk`, {
        method: "PUT",
        body: { plan_id: Number(effectivePlanId), branch_id: Number(branchId), cells },
      })

      setSaveMsg({
        ok: true,
        title: "บันทึกสำเร็จ",
        detail: `สาขา ${branchName || branchId} • ปี ${effectiveYearBE} (plan_id=${effectivePlanId})`,
      })

      // reload latest values
      await loadUnitPricesForYear()
      await loadSavedFromBE()
    } catch (e) {
      console.error("[AgriProcessing] save failed:", e)
      setSaveMsg({ ok: false, title: "บันทึกไม่สำเร็จ", detail: e?.message || String(e) })
    } finally {
      setIsSaving(false)
    }
  }, [
    branchId,
    branchName,
    defaultUnitId,
    effectivePlanId,
    effectiveYearBE,
    editableItems,
    qtyById,
    priceById,
    loadUnitPricesForYear,
    loadSavedFromBE,
  ])

  // sticky styles
  const stickyProductHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyProductCellBase = "sticky left-0 z-[60] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  const colCount = 4 + MONTHS.length + 2 // product+unit+sell+buy + months + totals

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
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                หน่วย : พันบาท
                {isLoadingUnitPrices ? " • โหลดต้นทุนการขาย..." : ""}
                {isLoadingSaved ? " • โหลดค่าที่เคยบันทึก..." : ""}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ปี (พ.ศ.)</label>
                <div className={cx(baseField, "flex items-center justify-between")}>
                  <span className="font-semibold">{effectiveYearBE}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-300">plan_id: {effectivePlanId || "—"}</span>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</label>
                <div className={cx(baseField, "flex items-center justify-between", !canEdit && "opacity-70")}>
                  <span className="font-semibold">{branchName ? branchName : "— ยังไม่เลือกสาขา —"}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-300">
                    id: {branchId || "—"} • unit_id: {defaultUnitId || "—"}
                  </span>
                </div>
                {!canEdit && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    * ต้องเลือกสาขา และต้องมี “หน่วยของสาขา” ก่อนถึงจะบันทึกได้
                  </div>
                )}
              </div>
            </div>

            {saveMsg && (
              <div
                className={cx(
                  "mt-3 rounded-2xl border p-3 text-sm",
                  saveMsg.ok
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200"
                    : "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200"
                )}
              >
                <div className="font-bold">{saveMsg.title}</div>
                <div className="mt-1">{saveMsg.detail}</div>
              </div>
            )}
          </div>

          {/* ✅ เอาปุ่มบันทึกออกจากด้านบน (ตามที่ขอ) */}
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={copyPayload}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              คัดลอก JSON
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
              <col style={{ width: COL_W.sell }} />
              <col style={{ width: COL_W.buy }} />
              {MONTHS.map((m) => (
                <col key={`c-${m.key}`} style={{ width: COL_W.month }} />
              ))}
              <col style={{ width: COL_W.totalQty }} />
              <col style={{ width: COL_W.totalAmt }} />
            </colgroup>

            <thead>
              <tr>
                <th className={cx("px-3 py-3 text-left text-sm font-bold", stickyProductHeader)} rowSpan={2}>
                  ประเภทสินค้า
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  หน่วย
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  ราคา/หน่วย
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  ต้นทุน/หน่วย
                </th>
                <th className={cx("px-2 py-2 text-center text-sm font-bold", STRIPE.headEven)} colSpan={MONTHS.length}>
                  เดือน
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  รวม (ตัน)
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  รวม (บาท)
                </th>
              </tr>
              <tr>
                {MONTHS.map((m, idx) => (
                  <th key={`h-${m.key}`} className={cx("px-2 py-2 text-center text-sm font-semibold", monthStripeHead(idx))}>
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {items.map((row, idx) => {
                if (row.type === "group") {
                  return (
                    <tr key={`g-${idx}`}>
                      <td colSpan={colCount} className="px-3 py-2 font-bold text-slate-900 bg-slate-100 dark:bg-slate-700 dark:text-slate-100">
                        {row.label}
                      </td>
                    </tr>
                  )
                }

                const it = row
                const pr = priceById[it.id] || { sell_price: "", buy_price: "" }
                const sell = pr.sell_price ?? ""
                const buy = pr.buy_price ?? ""
                const t = computed.itemTotals[it.id] || { qty: 0, amt: 0, any: false }

                return (
                  <tr key={`r-${it.id}`}>
                    <td className={cx("px-3 py-2", stickyProductCellBase, idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      <div className="font-semibold">{it.name}</div>
                      {it.product_id ? <div className="text-xs text-slate-500">product_id: {it.product_id}</div> : null}
                    </td>

                    <td className={cx("px-2 py-2 text-center", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>{it.unit}</td>

                    <td className={cx("px-2 py-2", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      <input
                        className={cellInput}
                        value={sell}
                        disabled={!canEdit}
                        data-row={editableItems.findIndex((x) => x.id === it.id)}
                        data-col={0}
                        onKeyDown={handleArrowNav}
                        onChange={(e) => setPriceField(it.id, "sell_price", sanitizeNumberInput(e.target.value))}
                      />
                    </td>

                    <td className={cx("px-2 py-2", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      <input
                        className={cellInput}
                        value={buy}
                        disabled={!canEdit}
                        data-row={editableItems.findIndex((x) => x.id === it.id)}
                        data-col={1}
                        onKeyDown={handleArrowNav}
                        onChange={(e) => setPriceField(it.id, "buy_price", sanitizeNumberInput(e.target.value))}
                      />
                    </td>

                    {MONTHS.map((m, mi) => {
                      const raw = qtyById?.[it.id]?.[m.key] ?? ""
                      return (
                        <td key={`c-${it.id}-${m.key}`} className={cx("px-1 py-1", monthStripeCell(mi))}>
                          <input
                            className={cellInput}
                            value={raw}
                            disabled={!canEdit}
                            data-row={editableItems.findIndex((x) => x.id === it.id)}
                            data-col={2 + mi}
                            onKeyDown={handleArrowNav}
                            onChange={(e) => setQtyCell(it.id, m.key, sanitizeNumberInput(e.target.value))}
                          />
                        </td>
                      )
                    })}

                    <td className={cx("px-2 py-2 text-right font-semibold", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      {dashIfAny(t.any, fmtQty(t.qty))}
                    </td>
                    <td className={cx("px-2 py-2 text-right font-semibold", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      {dashIfAny(t.any, fmtMoney(t.amt))}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr>
                <td className={cx("px-3 py-3 font-extrabold", stickyProductHeader)}>รวมทั้งหมด</td>
                <td className={cx("px-2 py-3 text-center font-bold", STRIPE.footEven)}>-</td>
                <td className={cx("px-2 py-3 text-center font-bold", STRIPE.footEven)}>-</td>
                <td className={cx("px-2 py-3 text-center font-bold", STRIPE.footEven)}>-</td>

                {MONTHS.map((m, idx) => (
                  <td key={`f-${m.key}`} className={cx("px-2 py-3 text-right font-bold", monthStripeFoot(idx))}>
                    {dashIfAny(computed.monthAny[m.key], fmtQty(computed.monthQtyTotals[m.key]))}
                  </td>
                ))}

                <td className={cx("px-2 py-3 text-right font-extrabold", STRIPE.footEven)}>
                  {dashIfAny(computed.anyAll, fmtQty(computed.grandQty))}
                </td>
                <td className={cx("px-2 py-3 text-right font-extrabold", STRIPE.footEven)}>
                  {dashIfAny(computed.anyAll, fmtMoney(computed.grandAmt))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ✅ ปุ่มบันทึกย้ายมาอยู่ “ข้างล่างขวา” */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-3 flex items-center justify-end bg-white/80 dark:bg-slate-800/80 backdrop-blur">
          <button
            type="button"
            onClick={() => saveAll()}
            disabled={isSaving || !canEdit}
            className={cx(
              "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold shadow-sm transition",
              isSaving || !canEdit
                ? "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300 cursor-not-allowed"
                : "bg-emerald-600 text-white shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 hover:scale-[1.03] active:scale-[.98] cursor-pointer"
            )}
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>

        {/* Footer scroll indicator */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-300">
          scrollLeft: {Math.round(scrollLeft)} px
        </div>
      </div>
    </div>
  )
}

export default AgriProcessingPlanDetail
