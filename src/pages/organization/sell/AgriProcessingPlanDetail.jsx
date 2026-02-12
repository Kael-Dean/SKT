import { Fragment, useCallback, useEffect, useMemo, useState } from "react"

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

/** ---------------- API ---------------- */
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

// ✅ สำคัญ: ถ้ายังโหลดหน่วยไม่ได้ ต้องมี 1 คอลัมน์ไว้ก่อน ไม่งั้น sub header “หน่วย” จะหาย
const PLACEHOLDER_UNITS = [{ id: 0, name: "—", short: "—" }]

const COL_W = {
  product: 260,
  unit: 84,
  price: 130,
  cell: 86,
}
const LEFT_W = COL_W.product + COL_W.unit + COL_W.price

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

/** ✅ business_group ของ “แปรรูป” */
const PROCESSING_GROUP_ID = 4

/** ---------------- helpers ---------------- */
const normalizeUnitName = (s) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")

const shortUnit = (name, idx) => {
  const s = normalizeUnitName(name)
  if (!s) return `หน่วย${idx + 1}`
  return s.length <= 4 ? s : s.slice(0, 4)
}

function buildEmptyQtyGrid(productIds, unitList) {
  const out = {}
  for (const pid of productIds) {
    out[pid] = {}
    for (const m of MONTHS) {
      out[pid][m.key] = {}
      for (const u of unitList) out[pid][m.key][String(u.id)] = ""
    }
  }
  return out
}

/** =======================================================================
 * AgriProcessingPlanDetail
 * ======================================================================= */
function AgriProcessingPlanDetail(props) {
  const {
    branchId,
    branch_id,
    branch,
    selectedBranch,
    selected_branch,
    branchName,
    yearBE,
    planId,
  } = props || {}

  /** Units */
  const [units, setUnits] = useState([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  /** ---------------- Branch resolver (ทำเหมือนหน้าจัดหา) ---------------- */
  const _pickNumber = useCallback((v) => {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
    const digits = String(v).match(/\d+/g)
    if (!digits) return null
    const nd = Number(digits.join(""))
    return Number.isFinite(nd) && nd > 0 ? nd : null
  }, [])

  const [resolvedBranchId, setResolvedBranchId] = useState(null)
  const [resolvedBranchName, setResolvedBranchName] = useState(String(branchName || "").trim())

  const incomingBranchId = useMemo(() => {
    const cands = [
      branchId,
      branch_id,
      branch?.id,
      branch?.branch_id,
      selectedBranch?.id,
      selectedBranch?.branch_id,
      selected_branch?.id,
      selected_branch?.branch_id,
    ]
    for (const c of cands) {
      const n = _pickNumber(c)
      if (n) return n
    }
    const ls = _pickNumber(
      localStorage.getItem("branch_id") ||
        localStorage.getItem("selected_branch_id") ||
        localStorage.getItem("selectedBranchId") ||
        localStorage.getItem("selected_branch") ||
        ""
    )
    return ls || null
  }, [branchId, branch_id, branch, selectedBranch, selected_branch, _pickNumber])

  const branchIdEff = resolvedBranchId || incomingBranchId || null

  useEffect(() => {
    if (branchName) setResolvedBranchName(String(branchName).trim())
  }, [branchName])

  useEffect(() => {
    if (incomingBranchId) {
      setResolvedBranchId(incomingBranchId)
      return
    }

    const name = String(branchName || resolvedBranchName || "").trim()
    if (!name) return

    let alive = true
    ;(async () => {
      try {
        const tryPaths = [
          `/lists/branch/search?branch_name=${encodeURIComponent(name)}`,
          `/lists/branch/search?name=${encodeURIComponent(name)}`,
          `/lists/branches/search?name=${encodeURIComponent(name)}`,
          `/lists/branch/search?q=${encodeURIComponent(name)}`,
        ]

        let rows = null
        for (const path of tryPaths) {
          try {
            const data = await apiAuth(path)
            if (Array.isArray(data)) rows = data
            else if (Array.isArray(data?.items)) rows = data.items
            else if (Array.isArray(data?.rows)) rows = data.rows
            if (rows && rows.length) break
          } catch {}
        }

        if (!alive) return
        if (!rows || !rows.length) return

        const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ")
        const target = norm(name)
        const found =
          rows.find((r) => norm(r.branch_name || r.name).includes(target)) ||
          rows.find((r) => norm(r.branch_name || r.name) === target) ||
          rows[0]

        const id = _pickNumber(found?.id || found?.branch_id)
        if (id) {
          setResolvedBranchId(id)
          setResolvedBranchName(found?.branch_name || found?.name || name)
          try {
            localStorage.setItem("selected_branch_id", String(id))
            localStorage.setItem("branch_id", String(id))
          } catch {}
        }
      } catch (e) {
        console.warn("[Branch resolve] failed:", e)
      }
    })()

    return () => {
      alive = false
    }
  }, [incomingBranchId, branchName, resolvedBranchName, _pickNumber])

  /** ---------------- plan/year ---------------- */
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

  const periodLabel = "เม.ย.–มี.ค."

  /** ---------------- load units by branch ---------------- */
  const loadUnits = useCallback(async () => {
    if (!branchIdEff) {
      setUnits([])
      return
    }
    setIsLoadingUnits(true)
    try {
      const data = await apiAuth(`/lists/unit/search?branch_id=${Number(branchIdEff)}`)
      const rows = Array.isArray(data) ? data : []
      const normalized = rows
        .map((r, idx) => {
          const id = Number(r.id || 0)
          const name = r.unit_name || r.klang_name || r.unit || r.name || `หน่วย ${id || idx + 1}`
          return { id, name: normalizeUnitName(name) }
        })
        .filter((x) => x.id > 0)
      setUnits(normalized)
    } catch (e) {
      console.error("[Units load] failed:", e)
      setUnits([])
    } finally {
      setIsLoadingUnits(false)
    }
  }, [branchIdEff])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  /** savableUnits: หน่วยจริง (id>0) */
  const savableUnits = useMemo(() => (units || []).filter((u) => Number(u.id) > 0), [units])

  /** unitCols (ห้ามว่าง) */
  const unitCols = useMemo(() => {
    const list = (units || []).slice().filter((u) => Number(u?.id) > 0)
    if (!list.length) return PLACEHOLDER_UNITS
    return list.map((u, idx) => {
      const name = normalizeUnitName(u.name || u.unit_name || u.unit || "")
      return { id: Number(u.id), name, short: shortUnit(name, idx) }
    })
  }, [units])

  /** ---------------- load unit prices ---------------- */
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

  /** ---------------- products + grid ---------------- */
  const [items, setItems] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)

  const [priceById, setPriceById] = useState({})
  const [qtyById, setQtyById] = useState({})

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
            const sellMerged =
              (sellFromList === null || sellFromList === undefined || Number(sellFromList) === 0) && fallback
                ? fallback.sell_price
                : sellFromList

            return {
              product_id: pid,
              name: String(x.product_type || x.name || "").trim(),
              unit: String(x.unit || "ตัน").trim(),
              sell_price: sellMerged ?? "",
              comment: String((fallback?.comment ?? x.comment ?? "") || ""),
            }
          })
          .filter((x) => x.product_id)

        if (!alive) return

        setItems(normalizedItems)

        const pmap = {}
        for (const it of normalizedItems) {
          pmap[String(it.product_id)] = {
            sell_price: String(it.sell_price ?? ""),
            comment: String(it.comment ?? ""),
          }
        }
        setPriceById(pmap)

        const uList = savableUnits.length ? savableUnits : []
        const empty = buildEmptyQtyGrid(normalizedItems.map((x) => String(x.product_id)), uList)

        setQtyById((prev) => {
          const next = { ...empty }
          for (const pid of Object.keys(prev || {})) {
            if (!next[pid]) continue
            for (const m of MONTHS) {
              if (!prev?.[pid]?.[m.key]) continue
              next[pid][m.key] = { ...next[pid][m.key], ...prev[pid][m.key] }
            }
          }
          return next
        })
      } catch (e) {
        console.warn("[AgriProcessing] load products failed:", e)
        if (!alive) return
        setItems([])
        setPriceById({})
        setQtyById({})
      } finally {
        if (alive) setIsLoadingProducts(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [effectivePlanId, unitPriceMap, savableUnits])

  /** ---------------- load saved ---------------- */
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  const loadSavedFromBE = useCallback(async () => {
    if (!branchIdEff) return
    if (!effectivePlanId || effectivePlanId <= 0) return
    if (!items.length) return
    if (!savableUnits.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(
        `/revenue/sale-goals?plan_id=${Number(effectivePlanId)}&branch_id=${Number(branchIdEff)}`
      )
      const cells = Array.isArray(data?.cells) ? data.cells : []

      const uSet = new Set(savableUnits.map((u) => Number(u.id)))
      const pSet = new Set(items.map((p) => Number(p.product_id)))

      const empty = buildEmptyQtyGrid(items.map((p) => String(p.product_id)), savableUnits)

      for (const c of cells) {
        const pid = Number(c.product_id || 0)
        const uid = Number(c.unit_id || 0)
        const mo = Number(c.month || 0)
        const amt = c.amount ?? c.value ?? 0

        if (!pSet.has(pid)) continue
        if (!uSet.has(uid)) continue
        const monthObj = MONTHS.find((m) => Number(m.month) === mo)
        if (!monthObj) continue

        empty[String(pid)][monthObj.key][String(uid)] = String(Number(amt || 0))
      }

      setQtyById(empty)
    } catch (e) {
      console.warn("[AgriProcessing] load saved failed:", e)
    } finally {
      setIsLoadingSaved(false)
    }
  }, [branchIdEff, effectivePlanId, items, savableUnits])

  useEffect(() => {
    loadSavedFromBE()
  }, [loadSavedFromBE])

  /** setters */
  const setPriceField = useCallback((productId, field, nextValue) => {
    setPriceById((prev) => ({
      ...prev,
      [String(productId)]: { ...(prev[String(productId)] || { sell_price: "", comment: "" }), [field]: nextValue },
    }))
  }, [])

  const setQtyField = useCallback((productId, monthKey, unitId, nextValue) => {
    setQtyById((prev) => {
      const pid = String(productId)
      const uid = String(unitId)
      return {
        ...prev,
        [pid]: {
          ...(prev[pid] || {}),
          [monthKey]: { ...(prev?.[pid]?.[monthKey] || {}), [uid]: nextValue },
        },
      }
    })
  }, [])

  /** sums */
  const sums = useMemo(() => {
    const perUnit = {}
    for (const u of unitCols) perUnit[String(u.id)] = 0
    let grandValue = 0

    for (const p of items) {
      const pid = String(p.product_id)
      const prices = priceById[pid] || {}
      const sell = toNumber(prices.sell_price ?? p.sell_price ?? 0)

      for (const m of MONTHS) {
        for (const u of unitCols) {
          const uid = String(u.id)
          const v = qtyById?.[pid]?.[m.key]?.[uid] ?? ""
          const n = toNumber(v)
          perUnit[uid] = (perUnit[uid] || 0) + n
          grandValue += n * sell
        }
      }
    }

    return { perUnit, grandValue }
  }, [items, priceById, qtyById, unitCols])

  /** Save */
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const canEdit = !!branchIdEff && !!savableUnits.length

  const saveAll = useCallback(async () => {
    if (!branchIdEff) throw new Error("FE: ยังไม่มี branch_id")
    if (!effectivePlanId || effectivePlanId <= 0) throw new Error(`FE: plan_id ไม่ถูกต้อง (${effectivePlanId})`)
    if (!items.length) throw new Error("FE: ไม่มีรายการสินค้าให้บันทึก")
    if (!savableUnits.length) throw new Error("FE: ยังไม่มีหน่วยของสาขาให้บันทึก")

    setIsSaving(true)
    setSaveMsg(null)

    try {
      const priceItems = items.map((p) => {
        const pid = Number(p.product_id)
        const cur = priceById[String(pid)] || {}
        return {
          product_id: pid,
          sell_price: toNumber(cur.sell_price ?? p.sell_price ?? 0),
          buy_price: 0,
          comment: String(cur.comment ?? p.comment ?? ""),
        }
      })

      try {
        await apiAuth(`/unit-prices/bulk`, {
          method: "PUT",
          body: { year: Number(effectiveYearBE), items: priceItems },
        })
      } catch {
        for (const it of priceItems) {
          await apiAuth(`/unit-prices`, {
            method: "PUT",
            body: {
              year: Number(effectiveYearBE),
              product_id: it.product_id,
              sell_price: it.sell_price,
              buy_price: 0,
              comment: it.comment,
            },
          })
        }
      }

      const cells = []
      for (const p of items) {
        const pid = Number(p.product_id)
        for (const m of MONTHS) {
          for (const u of savableUnits) {
            const uid = Number(u.id)
            const v = qtyById?.[String(pid)]?.[m.key]?.[String(uid)] ?? ""
            const n = toNumber(v)
            if (!n) continue
            cells.push({ unit_id: uid, product_id: pid, month: Number(m.month), amount: n })
          }
        }
      }

      await apiAuth(`/revenue/sale-goals/bulk`, {
        method: "PUT",
        body: { plan_id: Number(effectivePlanId), branch_id: Number(branchIdEff), cells },
      })

      setSaveMsg({
        ok: true,
        title: "บันทึกสำเร็จ",
        detail: `สาขา ${resolvedBranchName || branchIdEff} • ปี ${effectiveYearBE} (plan_id=${effectivePlanId})`,
      })

      await loadSavedFromBE()
      await loadUnits()
      await loadUnitPricesForYear()
    } catch (e) {
      setSaveMsg({ ok: false, title: "บันทึกไม่สำเร็จ", detail: e?.message || String(e) })
    } finally {
      setIsSaving(false)
    }
  }, [
    branchIdEff,
    effectivePlanId,
    effectiveYearBE,
    items,
    priceById,
    qtyById,
    savableUnits,
    resolvedBranchName,
    loadSavedFromBE,
    loadUnits,
    loadUnitPricesForYear,
  ])

  /** styles */
  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-2 py-1 text-right text-[13px] outline-none " +
    "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
    "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

  const TOTAL_W = useMemo(() => {
    const monthCells = MONTHS.length * unitCols.length * COL_W.cell
    const sumCells = unitCols.length * COL_W.cell
    return LEFT_W + monthCells + sumCells
  }, [unitCols])

  return (
    <div className="w-full">
      <div className="mb-3">
        <div className="text-[18px] font-bold text-slate-900 dark:text-slate-100">ยอดขายธุรกิจแปรรูป</div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          ({periodLabel}) • ปี {effectiveYearBE} • plan_id {effectivePlanId} • สาขา {resolvedBranchName || "-"} • branch_id{" "}
          {branchIdEff || "—"}
          {isLoadingUnits ? " • โหลดหน่วย..." : ""}
          {isLoadingProducts ? " • โหลดสินค้า..." : ""}
          {isLoadingUnitPrices ? " • โหลดต้นทุน..." : ""}
          {isLoadingSaved ? " • โหลดค่าที่บันทึก..." : ""}
        </div>
      </div>

      {saveMsg && (
        <div
          className={cx(
            "mb-4 rounded-2xl border p-4 text-sm",
            saveMsg.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100"
          )}
        >
          <div className="font-semibold">{saveMsg.title}</div>
          <div className="opacity-90">{saveMsg.detail}</div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="border-collapse" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.product }} />
              <col style={{ width: COL_W.unit }} />
              <col style={{ width: COL_W.price }} />
              {MONTHS.map((m) => unitCols.map((u) => <col key={`${m.key}-${u.id}`} style={{ width: COL_W.cell }} />))}
              {unitCols.map((u) => <col key={`sum-${u.id}`} style={{ width: COL_W.cell }} />)}
            </colgroup>

            <thead>
              <tr>
                <th className={cx("px-2 py-2 text-sm font-semibold", STRIPE.headEven)}>ประเภทสินค้า</th>
                <th className={cx("px-2 py-2 text-sm font-semibold", STRIPE.headEven)}>หน่วย</th>
                <th className={cx("px-2 py-2 text-sm font-semibold", STRIPE.headEven)}>ราคา/หน่วย</th>

                {MONTHS.map((m, mi) => (
                  <th
                    key={m.key}
                    className={cx("px-2 py-2 text-sm font-semibold", monthStripeHead(mi))}
                    colSpan={unitCols.length}
                  >
                    {m.label}
                  </th>
                ))}

                <th className={cx("px-2 py-2 text-sm font-semibold", STRIPE.headEven)} colSpan={unitCols.length}>
                  รวม
                </th>
              </tr>

              <tr>
                <th className={cx("px-2 py-2", STRIPE.headEven)} />
                <th className={cx("px-2 py-2", STRIPE.headEven)} />
                <th className={cx("px-2 py-2", STRIPE.headEven)} />

                {MONTHS.map((m, mi) => (
                  <Fragment key={`sub-${m.key}`}>
                    {unitCols.map((u) => (
                      <th
                        key={`${m.key}-${u.id}-sub`}
                        className={cx(
                          "px-2 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100",
                          monthStripeCell(mi)
                        )}
                      >
                        {u.short}
                      </th>
                    ))}
                  </Fragment>
                ))}

                {unitCols.map((u) => (
                  <th key={`sum-h-${u.id}`} className={cx("px-2 py-2 text-sm font-semibold", STRIPE.headEven)}>
                    {u.short}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {items.map((p, idx) => {
                const pid = String(p.product_id)
                const prices = priceById[pid] || {}
                const sellPrice = prices.sell_price ?? ""

                return (
                  <tr key={`row-${pid}`}>
                    <td className={cx("px-2 py-2", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      <div className="font-semibold">{p.name || "-"}</div>
                      <div className="text-xs text-slate-500">product_id: {p.product_id}</div>
                    </td>

                    <td className={cx("px-2 py-2 text-center font-semibold", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      {p.unit || "-"}
                    </td>

                    <td className={cx("px-2 py-2", idx % 2 ? STRIPE.cellOdd : STRIPE.cellEven)}>
                      <input
                        className={inputClass}
                        value={String(sellPrice)}
                        disabled={!canEdit}
                        onChange={(e) => setPriceField(pid, "sell_price", sanitizeNumberInput(e.target.value))}
                      />
                    </td>

                    {MONTHS.map((m, mi) => (
                      <Fragment key={`${pid}-${m.key}`}>
                        {unitCols.map((u) => {
                          const uid = String(u.id)
                          const v = qtyById?.[pid]?.[m.key]?.[uid] ?? ""
                          return (
                            <td key={`${pid}-${m.key}-${uid}`} className={cx("px-1 py-1", monthStripeCell(mi))}>
                              <input
                                className={inputClass}
                                value={String(v)}
                                disabled={!canEdit || Number(u.id) <= 0}
                                onChange={(e) => setQtyField(pid, m.key, uid, sanitizeNumberInput(e.target.value))}
                              />
                            </td>
                          )
                        })}
                      </Fragment>
                    ))}

                    {unitCols.map((u) => {
                      const uid = String(u.id)
                      let sumU = 0
                      for (const m of MONTHS) sumU += toNumber(qtyById?.[pid]?.[m.key]?.[uid] ?? 0)
                      return (
                        <td key={`${pid}-sum-${uid}`} className={cx("px-2 py-2 text-right font-semibold", STRIPE.footEven)}>
                          {fmtQty(sumU)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              <tr>
                <td className={cx("px-2 py-2 font-bold", STRIPE.footOdd)}>รวมทั้งสิ้น</td>
                <td className={cx("px-2 py-2", STRIPE.footOdd)} />
                <td className={cx("px-2 py-2 text-right font-bold", STRIPE.footOdd)}>{fmtMoney(sums.grandValue)}</td>

                {MONTHS.map((m) => (
                  <Fragment key={`t-${m.key}`}>
                    {unitCols.map((u) => (
                      <td key={`t-${m.key}-${u.id}`} className={cx("px-2 py-2", STRIPE.footOdd)} />
                    ))}
                  </Fragment>
                ))}

                {unitCols.map((u) => (
                  <td key={`g-sum-${u.id}`} className={cx("px-2 py-2 text-right font-bold", STRIPE.footOdd)}>
                    {fmtQty(sums.perUnit[String(u.id)] || 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {!canEdit && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            ยังไม่พบสาขา/branch_id หรือยังไม่มีหน่วยของสาขา — กรุณาเลือกสาขาก่อน ถึงจะบันทึกได้
          </div>
        )}

        {/* ✅ แถบบันทึก: ตำแหน่งเดียวกับ “ค่าใช้จ่ายจัดหา” (อยู่ในกรอบการ์ด ล่างสุด ขวา) */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-300">
            บันทึก: PUT /unit-prices/bulk + PUT /revenue/sale-goals/bulk • ปี={effectiveYearBE} • สาขา={resolvedBranchName || "-"}
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

export default AgriProcessingPlanDetail
