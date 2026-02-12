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
const fmtQty = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(toNumber(n))
const fmtMoney = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(toNumber(n))

/** ---------------- API (no lib) ---------------- */
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

/** ---------------- Constants ---------------- */
// แผนปีบัญชี เม.ย.–มี.ค.
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

// ✅ ธุรกิจบริการ (ถ้าของคุณเป็น 6=ฝึกอบรม ให้เปลี่ยนเลขตรงนี้)
const SERVICE_GROUP_ID = 7
const SERVICE_TITLE = "ยอดขายธุรกิจบริการ"

const COL_W = {
  product: 320,
  unit: 80,
  price: 130,
  month: 86,
  totalQty: 110,
  totalAmt: 150,
}
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
const dashIfAny = (any, formatted) => (any ? formatted : "-")

/** ---------------- Styles ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

/** ---------------- helpers ---------------- */
function buildInitialQty(items) {
  const out = {}
  ;(items || []).forEach((it) => {
    out[it.id] = {}
    MONTHS.forEach((m) => (out[it.id][m.key] = ""))
  })
  return out
}

function buildInitialPrice(items) {
  const out = {}
  ;(items || []).forEach((it) => {
    out[it.id] = {
      sell_price: String(it.sell_price ?? ""),
      buy_price: String(it.buy_price ?? ""),
      comment: String(it.comment ?? ""),
    }
  })
  return out
}

const ServiceBusinessPlanDetail = ({ branchId, branchName, yearBE, planId }) => {
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

  // ✅ กันจอขาว: ใช้ใน footer/info bar
  const periodLabel = useMemo(() => {
    const endY = Number(effectiveYearBE || 0)
    const startY = endY ? endY - 1 : "-"
    return `เม.ย. ${startY} – มี.ค. ${endY || "-"}`
  }, [effectiveYearBE])

  /** -------- Units by branch -------- */
  const [units, setUnits] = useState([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  const loadUnits = useCallback(async () => {
    if (!branchId) {
      setUnits([])
      return
    }
    setIsLoadingUnits(true)
    try {
      const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchId)}`)
      const rows = Array.isArray(data) ? data : []
      const normalized = rows
        .map((r) => ({
          id: Number(r.id || 0),
          name: String(r.klang_name || r.unit_name || r.unit || r.name || "").trim(),
        }))
        .filter((x) => x.id > 0)
      setUnits(normalized)
    } catch (e) {
      console.error("[service] load units failed:", e)
      setUnits([])
    } finally {
      setIsLoadingUnits(false)
    }
  }, [branchId])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  const defaultUnitId = useMemo(() => {
    const u = (units || []).find((x) => Number(x?.id) > 0)
    return u ? Number(u.id) : null
  }, [units])

  /** -------- Load products list (business service) -------- */
  const [items, setItems] = useState([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  const [priceById, setPriceById] = useState({})
  const [qtyById, setQtyById] = useState({})
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [showPayload, setShowPayload] = useState(false)

  const canEdit = !!branchId && !!defaultUnitId && !!effectivePlanId && effectivePlanId > 0

  const loadItems = useCallback(async () => {
    if (!effectivePlanId || effectivePlanId <= 0) {
      setItems([])
      setPriceById({})
      setQtyById({})
      return
    }

    setIsLoadingItems(true)
    try {
      // โหลดลิสสินค้า/รายการตาม business_group
      const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${Number(effectivePlanId)}`)
      const group = data?.[String(SERVICE_GROUP_ID)] || data?.[SERVICE_GROUP_ID]
      const rows = Array.isArray(group?.items) ? group.items : []

      const normalized = rows
        .filter((x) => Number(x.business_group || 0) === SERVICE_GROUP_ID)
        .map((x, idx) => {
          const pid = Number(x.product_id || x.id || 0) || null
          return {
            type: "item",
            id: String(pid || `svc_${idx}`),
            product_id: pid,
            name: String(x.product_type || x.name || x.product || "").trim(),
            unit: String(x.unit || "หน่วย").trim(),
            sell_price: x.sell_price ?? "",
            buy_price: x.buy_price ?? "",
            comment: x.comment ?? "",
          }
        })
        .filter((x) => x.product_id)

      setItems(normalized)
      setPriceById(buildInitialPrice(normalized))
      setQtyById((prev) => {
        const next = buildInitialQty(normalized)
        // merge เดิมถ้ามี
        for (const id of Object.keys(next)) {
          if (!prev?.[id]) continue
          for (const m of MONTHS) {
            if (prev[id][m.key] !== undefined) next[id][m.key] = prev[id][m.key]
          }
        }
        return next
      })
    } catch (e) {
      console.error("[service] load items failed:", e)
      setItems([])
      setPriceById({})
      setQtyById({})
    } finally {
      setIsLoadingItems(false)
    }
  }, [effectivePlanId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  /** -------- Load saved sale-goals (อ่านที่ default unit ของสาขา) -------- */
  const loadSaved = useCallback(async () => {
    if (!branchId || !effectivePlanId || effectivePlanId <= 0) return
    if (!items.length) return
    if (!defaultUnitId) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(
        `/revenue/sale-goals?plan_id=${Number(effectivePlanId)}&branch_id=${Number(branchId)}`
      )
      const cells = Array.isArray(data?.cells) ? data.cells : []

      const pidToRowId = {}
      for (const it of items) pidToRowId[String(it.product_id)] = it.id

      const next = buildInitialQty(items)
      for (const c of cells) {
        const pid = Number(c.product_id || 0)
        const uid = Number(c.unit_id || 0)
        if (!pid || !uid) continue
        if (uid !== Number(defaultUnitId)) continue
        const rowId = pidToRowId[String(pid)]
        if (!rowId) continue
        const mo = Number(c.month || 0)
        const mObj = MONTHS.find((m) => m.month === mo)
        if (!mObj) continue
        next[rowId][mObj.key] = String(Number(c.amount ?? c.value ?? 0))
      }

      setQtyById(next)
    } catch (e) {
      console.warn("[service] load saved failed:", e)
    } finally {
      setIsLoadingSaved(false)
    }
  }, [branchId, effectivePlanId, items, defaultUnitId])

  useEffect(() => {
    loadSaved()
  }, [loadSaved])

  /** -------- Setters -------- */
  const setPriceField = (rowId, field, v) => {
    setPriceById((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || { sell_price: "", buy_price: "", comment: "" }), [field]: v },
    }))
  }
  const setQtyCell = (rowId, monthKey, v) => {
    setQtyById((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [monthKey]: v },
    }))
  }

  /** -------- Computed -------- */
  const computed = useMemo(() => {
    const rowTotals = {}
    const monthTotals = {}
    const monthAny = {}
    let anyAll = false
    let grandQty = 0
    let grandAmt = 0

    MONTHS.forEach((m) => {
      monthTotals[m.key] = { qty: 0, amt: 0 }
      monthAny[m.key] = false
    })

    for (const it of items) {
      const pr = priceById[it.id] || {}
      const sell = toNumber(pr.sell_price ?? it.sell_price ?? 0)
      let rowQty = 0
      let rowAmt = 0
      let rowAny = false

      for (const m of MONTHS) {
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
        monthTotals[m.key].qty += q
        monthTotals[m.key].amt += amt
      }

      grandQty += rowQty
      grandAmt += rowAmt
      rowTotals[it.id] = { qty: rowQty, amt: rowAmt, any: rowAny }
    }

    return { rowTotals, monthTotals, monthAny, anyAll, grandQty, grandAmt }
  }, [items, qtyById, priceById])

  /** -------- Save -------- */
  const payload = useMemo(() => {
    return {
      plan_id: Number(effectivePlanId || 0),
      branch_id: branchId ? Number(branchId) : null,
      default_unit_id: defaultUnitId,
      prices: items.map((it) => {
        const pr = priceById[it.id] || {}
        return {
          product_id: Number(it.product_id || 0),
          sell_price: toNumber(pr.sell_price),
          buy_price: toNumber(pr.buy_price),
          comment: String(pr.comment ?? ""),
        }
      }),
      cells: items
        .flatMap((it) =>
          MONTHS.map((m) => ({
            unit_id: Number(defaultUnitId || 0),
            product_id: Number(it.product_id || 0),
            month: Number(m.month),
            amount: toNumber(qtyById?.[it.id]?.[m.key] ?? 0),
          }))
        )
        .filter((x) => x.amount !== 0),
    }
  }, [effectivePlanId, branchId, defaultUnitId, items, priceById, qtyById])

  const saveAll = useCallback(async () => {
    if (!canEdit) {
      setSaveMsg({ ok: false, title: "บันทึกไม่ได้", detail: "ยังไม่มีสาขา/หน่วยของสาขา/plan_id" })
      return
    }

    setIsSaving(true)
    setSaveMsg(null)
    try {
      // 1) prices
      try {
        await apiAuth(`/unit-prices/bulk`, {
          method: "PUT",
          body: { plan_id: Number(effectivePlanId), items: payload.prices },
        })
      } catch {
        await apiAuth(`/unit-prices/bulk`, {
          method: "PUT",
          body: { year: Number(effectiveYearBE), items: payload.prices },
        })
      }

      // 2) goals
      await apiAuth(`/revenue/sale-goals/bulk`, {
        method: "PUT",
        body: {
          plan_id: Number(effectivePlanId),
          branch_id: Number(branchId),
          cells: payload.cells,
        },
      })

      setSaveMsg({
        ok: true,
        title: "บันทึกสำเร็จ",
        detail: `ธุรกิจบริการ • ปี ${effectiveYearBE} (plan_id=${effectivePlanId}) • สาขา ${branchName || branchId} • unit_id=${defaultUnitId}`,
      })

      await loadSaved()
      await loadItems()
      await loadUnits()
    } catch (e) {
      setSaveMsg({ ok: false, title: "บันทึกไม่สำเร็จ", detail: e?.message || String(e) })
    } finally {
      setIsSaving(false)
    }
  }, [canEdit, effectivePlanId, effectiveYearBE, branchId, branchName, defaultUnitId, payload, loadSaved, loadItems, loadUnits])

  /** -------- table height -------- */
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

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setQtyById(buildInitialQty(items))
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold">{SERVICE_TITLE}</div>
              <div className="text-xl md:text-2xl font-extrabold">รายละเอียดแผนธุรกิจบริการ</div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ปี (พ.ศ.)</label>
                <div className={cx(baseField, "flex items-center justify-between")}>
                  <span className="font-semibold">{effectiveYearBE}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-300">
                    plan_id: {effectivePlanId || "—"}
                  </span>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</label>
                <div className={cx(baseField, "flex items-center justify-between", !canEdit && "opacity-70")}>
                  <span className="font-semibold">{branchName ? branchName : "— ยังไม่เลือกสาขา —"}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-300">
                    branch_id: {branchId || "—"} • unit_id: {defaultUnitId || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              ({periodLabel}) • หน่วย: {isLoadingUnits ? "กำลังโหลด..." : (units || []).length} • รายการ:{" "}
              {isLoadingItems ? "กำลังโหลด..." : items.length} • โหลดค่าที่บันทึก: {isLoadingSaved ? "กำลังโหลด..." : "พร้อม"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
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

        {saveMsg && (
          <div
            className={cx(
              "mt-4 rounded-2xl border p-4 text-sm",
              saveMsg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
                : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100"
            )}
          >
            <div className="font-semibold">{saveMsg.title}</div>
            <div className="opacity-90">{saveMsg.detail}</div>
          </div>
        )}
      </div>

      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700">
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

            <thead>
              <tr>
                <th className={cx("px-3 py-3 text-left text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  รายการ/บริการ
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  หน่วย
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  ราคา/หน่วย
                </th>
                <th className={cx("px-2 py-2 text-center text-sm font-bold", STRIPE.headEven)} colSpan={MONTHS.length}>
                  เดือน
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven)} rowSpan={2}>
                  รวม
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
              {items.map((it, idx) => {
                const pr = priceById[it.id] || {}
                const sell = pr.sell_price ?? ""
                const t = computed.rowTotals[it.id] || { qty: 0, amt: 0, any: false }

                return (
                  <tr key={it.id}>
                    <td className={cx("px-3 py-2", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      <div className="font-semibold">{it.name || "-"}</div>
                      <div className="text-xs text-slate-500">product_id: {it.product_id}</div>
                    </td>

                    <td className={cx("px-2 py-2 text-center font-semibold", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      {it.unit || "-"}
                    </td>

                    <td className={cx("px-2 py-2", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      <input
                        className={cellInput}
                        value={sell}
                        disabled={!canEdit}
                        onChange={(e) => setPriceField(it.id, "sell_price", sanitizeNumberInput(e.target.value))}
                      />
                    </td>

                    {MONTHS.map((m, mi) => {
                      const raw = qtyById?.[it.id]?.[m.key] ?? ""
                      return (
                        <td key={`${it.id}-${m.key}`} className={cx("px-1 py-1", monthStripeCell(mi))}>
                          <input
                            className={cellInput}
                            value={raw}
                            disabled={!canEdit}
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
                <td className={cx("px-3 py-3 font-extrabold", STRIPE.footEven)} colSpan={3}>
                  รวมทั้งสิ้น
                </td>

                {MONTHS.map((m, idx) => (
                  <td key={`f-${m.key}`} className={cx("px-2 py-3 text-right font-bold", monthStripeFoot(idx))}>
                    {dashIfAny(computed.monthAny[m.key], fmtQty(computed.monthTotals[m.key].qty))}
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

        {/* ✅ แถบบันทึกตำแหน่งเดียวกับหน้าค่าใช้จ่ายจัดหา */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-300">
            บันทึก: PUT /unit-prices/bulk + PUT /revenue/sale-goals/bulk • ปี={effectiveYearBE} • plan_id={effectivePlanId} • สาขา={branchName || "-"} • unit_id={defaultUnitId || "-"}
          </div>

          <button
            type="button"
            className={cx(
              "rounded-2xl px-6 py-3 font-semibold shadow-lg transition",
              isSaving || !canEdit
                ? "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            )}
            disabled={isSaving || !canEdit}
            onClick={saveAll}
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึกลงระบบ"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ServiceBusinessPlanDetail
