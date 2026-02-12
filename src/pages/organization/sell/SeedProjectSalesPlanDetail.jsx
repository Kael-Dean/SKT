import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"

/* รายละเอียดแผนโครงการผลิตเมล็ดพันธุ์ — ยอดขาย (ใช้ลิสธุรกิจเมล็ด + save แบบ /revenue/sale-goals/bulk) */

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
const fmtPrice = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(toNumber(n))
const fmtMoney = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

/** ---------------- API (no lib import) ---------------- */
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

// business_group ของ “เมล็ดพันธุ์”
const SEED_GROUP_ID = 5

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

const cellTextInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-left text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const COL_W = { product: 320, unit: 80, price: 130, month: 86, totalQty: 120, totalAmt: 150 }
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
const gridCell = "border border-slate-300 border-dotted dark:border-slate-600"

const dashIfAny = (any, formatted) => (any ? formatted : "-")

/** ---------------- helpers ---------------- */
function buildInitialQty(rows) {
  const out = {}
  rows.forEach((r) => {
    out[r.id] = {}
    MONTHS.forEach((m) => (out[r.id][m.key] = ""))
  })
  return out
}

/** =======================================================================
 * SeedProjectSalesPlanDetail
 * ======================================================================= */
const SeedProjectSalesPlanDetail = ({ branchId, branchName, yearBE, onYearBEChange }) => {
  // plan_id: 2569 => 1
  const planId = useMemo(() => {
    const y = Number(yearBE || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [yearBE])

  const periodLabel = "เม.ย.–มี.ค."

  /** ---------------- Units by branch (ต้องมี unit_id เพื่อยิง sale-goals/bulk) ---------------- */
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
      console.error("[seed] load units failed:", e)
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

  /** ---------------- Products list (ธุรกิจเมล็ด) ---------------- */
  const [rows, setRows] = useState([])
  const [isLoadingRows, setIsLoadingRows] = useState(false)

  // map price by product_id (sell/buy/comment) — ใช้ state ล่าสุดเวลาบันทึก
  const [priceByPid, setPriceByPid] = useState({})
  // qty grid: qtyById[rowId][monthKey]
  const [qtyById, setQtyById] = useState({})
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [showPayload, setShowPayload] = useState(false)

  const canEdit = !!branchId && !!defaultUnitId && !!planId && planId > 0

  const loadSeedRows = useCallback(async () => {
    if (!planId || planId <= 0) {
      setRows([])
      setPriceByPid({})
      setQtyById({})
      return
    }

    setIsLoadingRows(true)
    try {
      const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${Number(planId)}`)
      const group = data?.[String(SEED_GROUP_ID)] || data?.[SEED_GROUP_ID]
      const items = Array.isArray(group?.items) ? group.items : []

      const normalized = items
        .filter((x) => Number(x.business_group || 0) === SEED_GROUP_ID)
        .map((x, idx) => {
          const pid = Number(x.product_id || 0)
          return {
            id: `p_${pid || idx}`,
            product_id: pid || null,
            name: String(x.product_type || x.name || "").trim(),
            unit: String(x.unit || "ตัน").trim() || "ตัน",
            sell_price: x.sell_price ?? "",
            buy_price: x.buy_price ?? "",
            comment: x.comment ?? "",
          }
        })
        .filter((x) => x.product_id)

      setRows(normalized)

      // init priceByPid
      const pmap = {}
      for (const r of normalized) {
        pmap[String(r.product_id)] = {
          sell_price: String(r.sell_price ?? ""),
          buy_price: String(r.buy_price ?? ""),
          comment: String(r.comment ?? ""),
        }
      }
      setPriceByPid(pmap)

      // init qtyById
      setQtyById((prev) => {
        const next = {}
        for (const r of normalized) {
          next[r.id] = {}
          for (const m of MONTHS) next[r.id][m.key] = prev?.[r.id]?.[m.key] ?? ""
        }
        return next
      })
    } catch (e) {
      console.error("[seed] load products-by-group-latest failed:", e)
      setRows([])
      setPriceByPid({})
      setQtyById({})
    } finally {
      setIsLoadingRows(false)
    }
  }, [planId])

  useEffect(() => {
    loadSeedRows()
  }, [loadSeedRows])

  /** ---------------- Load saved sale-goals ----------------
   * ตาราง seed ไม่มีคอลัมน์แยกหน่วย -> เราอ่านค่าที่ unit_id = defaultUnitId
   * (ถ้าจะ “รวมทุกหน่วย” ให้เปลี่ยน logic เป็น sum ได้)
   */
  const loadSaved = useCallback(async () => {
    if (!branchId || !planId || planId <= 0) return
    if (!rows.length) return
    if (!defaultUnitId) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/revenue/sale-goals?plan_id=${Number(planId)}&branch_id=${Number(branchId)}`)
      const cells = Array.isArray(data?.cells) ? data.cells : []

      // map product_id -> rowId
      const pidToRowId = {}
      for (const r of rows) pidToRowId[String(r.product_id)] = r.id

      const next = buildInitialQty(rows)
      for (const c of cells) {
        const pid = Number(c.product_id || 0)
        const uid = Number(c.unit_id || 0)
        if (!pid || !uid) continue
        if (uid !== Number(defaultUnitId)) continue // เก็บ/อ่านที่ unit หลักของสาขา
        const rowId = pidToRowId[String(pid)]
        if (!rowId) continue
        const mo = Number(c.month || 0)
        const mObj = MONTHS.find((m) => m.month === mo)
        if (!mObj) continue
        next[rowId][mObj.key] = String(Number(c.amount ?? c.value ?? 0))
      }
      setQtyById(next)
    } catch (e) {
      console.warn("[seed] load saved sale-goals failed:", e)
    } finally {
      setIsLoadingSaved(false)
    }
  }, [branchId, planId, rows, defaultUnitId])

  useEffect(() => {
    loadSaved()
  }, [loadSaved])

  /** ---------------- Inputs ---------------- */
  const setRowName = (rowId, v) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, name: v } : r)))
  }
  const setUnitPrice = (productId, field, v) => {
    setPriceByPid((prev) => ({
      ...prev,
      [String(productId)]: { ...(prev[String(productId)] || { sell_price: "", buy_price: "", comment: "" }), [field]: v },
    }))
  }
  const setQtyCell = (rowId, monthKey, v) => {
    setQtyById((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [monthKey]: v },
    }))
  }

  /** ---------------- Computed ---------------- */
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

    for (const r of rows) {
      const pid = Number(r.product_id || 0)
      const pr = priceByPid[String(pid)] || {}
      const sell = toNumber(pr.sell_price)

      let rowQty = 0
      let rowAmt = 0
      let rowAny = false

      for (const m of MONTHS) {
        const raw = qtyById?.[r.id]?.[m.key] ?? ""
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
      rowTotals[r.id] = { qty: rowQty, amt: rowAmt, any: rowAny }
    }

    return { rowTotals, monthTotals, monthAny, anyAll, grandQty, grandAmt }
  }, [rows, qtyById, priceByPid])

  /** ---------------- Save ---------------- */
  const payload = useMemo(() => {
    return {
      plan_id: Number(planId || 0),
      branch_id: branchId ? Number(branchId) : null,
      default_unit_id: defaultUnitId,
      prices: rows.map((r) => {
        const pid = Number(r.product_id || 0)
        const pr = priceByPid[String(pid)] || {}
        return {
          product_id: pid,
          sell_price: toNumber(pr.sell_price),
          buy_price: toNumber(pr.buy_price),
          comment: String(pr.comment ?? ""),
        }
      }),
      cells: rows.flatMap((r) => {
        const pid = Number(r.product_id || 0)
        return MONTHS.map((m) => ({
          unit_id: Number(defaultUnitId || 0),
          product_id: pid,
          month: Number(m.month),
          amount: toNumber(qtyById?.[r.id]?.[m.key] ?? 0),
        })).filter((x) => x.amount !== 0)
      }),
    }
  }, [planId, branchId, defaultUnitId, rows, priceByPid, qtyById])

  const saveAll = useCallback(async () => {
    if (!canEdit) {
      setSaveMsg({ ok: false, title: "บันทึกไม่ได้", detail: "ยังไม่มีสาขา/หน่วยของสาขา/plan_id" })
      return
    }

    setIsSaving(true)
    setSaveMsg(null)

    try {
      // 1) Save prices (unit-prices/bulk) — รองรับทั้งแบบ plan_id หรือ year (fallback)
      const priceItems = payload.prices

      let okPrice = false
      try {
        // try plan-based (ถ้า BE รองรับ)
        await apiAuth(`/unit-prices/bulk`, {
          method: "PUT",
          body: { plan_id: Number(planId), items: priceItems },
        })
        okPrice = true
      } catch (e1) {
        try {
          // fallback year-based (บางระบบใช้ปี)
          await apiAuth(`/unit-prices/bulk`, {
            method: "PUT",
            body: { year: Number(yearBE), items: priceItems },
          })
          okPrice = true
        } catch (e2) {
          // last fallback: ยิงทีละรายการ (กัน endpoint ต่างกัน)
          for (const it of priceItems) {
            try {
              await apiAuth(`/unit-prices`, {
                method: "PUT",
                body: { plan_id: Number(planId), ...it },
              })
              okPrice = true
            } catch {
              await apiAuth(`/unit-prices`, {
                method: "PUT",
                body: { year: Number(yearBE), ...it },
              })
              okPrice = true
            }
          }
        }
      }
      if (!okPrice) throw new Error("บันทึกราคาไม่สำเร็จ")

      // 2) Save sale goals bulk
      await apiAuth(`/revenue/sale-goals/bulk`, {
        method: "PUT",
        body: {
          plan_id: Number(planId),
          branch_id: Number(branchId),
          cells: payload.cells,
        },
      })

      setSaveMsg({
        ok: true,
        title: "บันทึกสำเร็จ",
        detail: `ธุรกิจเมล็ด • ปี ${yearBE} (plan_id=${planId}) • สาขา ${branchName || branchId} • unit_id=${defaultUnitId}`,
      })

      await loadSaved()
      await loadSeedRows()
      await loadUnits()
    } catch (e) {
      setSaveMsg({
        ok: false,
        title: "บันทึกไม่สำเร็จ",
        detail: e?.message || String(e),
      })
    } finally {
      setIsSaving(false)
    }
  }, [canEdit, payload, planId, yearBE, branchId, branchName, defaultUnitId, loadSaved, loadSeedRows, loadUnits])

  /** ---------------- Layout helpers ---------------- */
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
    setQtyById(buildInitialQty(rows))
    // ไม่ล้างราคา เพราะอยากคงราคาล่าสุด
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold">ยอดขายธุรกิจเมล็ด</div>
              <div className="text-xl md:text-2xl font-extrabold">รายละเอียดแผนโครงการผลิตเมล็ดพันธุ์</div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ปี (พ.ศ.)</label>
                <input
                  className={baseField}
                  value={yearBE || ""}
                  onChange={(e) => onYearBEChange?.(e.target.value)}
                  placeholder="เช่น 2569"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขาที่เลือก</label>
                <div className={cx(baseField, "flex items-center justify-between", !canEdit && "opacity-70")}>
                  <span className="font-semibold">{branchName ? branchName : "— ยังไม่เลือกสาขา —"}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-300">
                    plan_id: {planId || "—"} • branch_id: {branchId || "—"} • unit_id: {defaultUnitId || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              ({periodLabel}) • โหลดหน่วย: {isLoadingUnits ? "กำลังโหลด..." : (units || []).length} • โหลดลิสสินค้า:{" "}
              {isLoadingRows ? "กำลังโหลด..." : rows.length} • โหลดค่าที่บันทึก: {isLoadingSaved ? "กำลังโหลด..." : "พร้อม"}
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

      {/* Table Card */}
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
                <th className={cx("px-3 py-3 text-left text-sm font-bold", STRIPE.headEven, gridCell)} rowSpan={2}>
                  ประเภทสินค้า
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven, gridCell)} rowSpan={2}>
                  หน่วย
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven, gridCell)} rowSpan={2}>
                  ราคา/หน่วย
                </th>
                <th className={cx("px-2 py-2 text-center text-sm font-bold", STRIPE.headEven, gridCell)} colSpan={MONTHS.length}>
                  เดือน
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven, gridCell)} rowSpan={2}>
                  รวม (ตัน)
                </th>
                <th className={cx("px-2 py-3 text-center text-sm font-bold", STRIPE.headEven, gridCell)} rowSpan={2}>
                  รวม (บาท)
                </th>
              </tr>
              <tr>
                {MONTHS.map((m, idx) => (
                  <th key={`h-${m.key}`} className={cx("px-2 py-2 text-center text-sm font-semibold", monthStripeHead(idx), gridCell)}>
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => {
                const pid = Number(r.product_id || 0)
                const pr = priceByPid[String(pid)] || {}
                const sell = pr.sell_price ?? ""
                const t = computed.rowTotals[r.id] || { qty: 0, amt: 0, any: false }

                return (
                  <tr key={r.id}>
                    <td className={cx("px-3 py-2", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven, gridCell)}>
                      <input
                        className={cellTextInput}
                        value={r.name}
                        disabled={!canEdit}
                        onChange={(e) => setRowName(r.id, e.target.value)}
                      />
                      <div className="text-xs text-slate-500">product_id: {pid}</div>
                    </td>

                    <td className={cx("px-2 py-2 text-center font-semibold", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven, gridCell)}>
                      {r.unit || "ตัน"}
                    </td>

                    <td className={cx("px-2 py-2", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven, gridCell)}>
                      <input
                        className={cellInput}
                        value={sell}
                        disabled={!canEdit}
                        onChange={(e) => setUnitPrice(pid, "sell_price", sanitizeNumberInput(e.target.value))}
                      />
                    </td>

                    {MONTHS.map((m, mi) => {
                      const raw = qtyById?.[r.id]?.[m.key] ?? ""
                      return (
                        <td key={`${r.id}-${m.key}`} className={cx("px-1 py-1", monthStripeCell(mi), gridCell)}>
                          <input
                            className={cellInput}
                            value={raw}
                            disabled={!canEdit}
                            onChange={(e) => setQtyCell(r.id, m.key, sanitizeNumberInput(e.target.value))}
                          />
                        </td>
                      )
                    })}

                    <td className={cx("px-2 py-2 text-right font-semibold", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven, gridCell)}>
                      {dashIfAny(t.any, fmtQty(t.qty))}
                    </td>
                    <td className={cx("px-2 py-2 text-right font-semibold", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven, gridCell)}>
                      {dashIfAny(t.any, fmtMoney(t.amt))}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr>
                <td className={cx("px-3 py-3 font-extrabold", STRIPE.footEven, gridCell)} colSpan={3}>
                  รวมทั้งสิ้น
                </td>

                {MONTHS.map((m, idx) => (
                  <td key={`f-${m.key}`} className={cx("px-2 py-3 text-right font-bold", monthStripeFoot(idx), gridCell)}>
                    {dashIfAny(computed.monthAny[m.key], fmtQty(computed.monthTotals[m.key].qty))}
                  </td>
                ))}

                <td className={cx("px-2 py-3 text-right font-extrabold", STRIPE.footEven, gridCell)}>
                  {dashIfAny(computed.anyAll, fmtQty(computed.grandQty))}
                </td>
                <td className={cx("px-2 py-3 text-right font-extrabold", STRIPE.footEven, gridCell)}>
                  {dashIfAny(computed.anyAll, fmtMoney(computed.grandAmt))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ✅ แถบบันทึกตำแหน่งเดียวกับหน้าค่าใช้จ่ายจัดหา */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-300">
            บันทึก: PUT /unit-prices/bulk + PUT /revenue/sale-goals/bulk • ปี={yearBE} • plan_id={planId} • สาขา={branchName || "-"} • unit_id={defaultUnitId || "-"}
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

export default SeedProjectSalesPlanDetail
