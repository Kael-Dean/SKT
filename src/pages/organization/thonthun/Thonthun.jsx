import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/** ---------------- Utils ---------------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => {
  if (v === "" || v === null || v === undefined) return 0
  const n = Number(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}
const round3 = (v) => Math.round(toNumber(v) * 1000) / 1000
const sanitizeNumberInput = (s, { maxDecimals = 3 } = {}) => {
  const cleaned = String(s ?? "").replace(/[\D.]/g, "")
  if (!cleaned) return ""
  const parts = cleaned.split(".")
  const intPart = parts[0] ?? ""
  if (parts.length <= 1) return intPart
  const decRaw = parts.slice(1).join("")
  const dec = decRaw.slice(0, Math.max(0, maxDecimals))
  if (maxDecimals <= 0) return intPart
  return `${intPart}.${dec}`
}
const fmtMoney0 = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

/** ---------------- API (token/session) ---------------- */
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

// ให้เหมือนทุกหน้าที่ทำงานอยู่แล้ว (หน้าอื่นใช้ localStorage.token ตรงๆ)
const getToken = () => (typeof localStorage !== "undefined" ? localStorage.getItem("token") : "") || ""

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
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
      // ✅ ตัด cookie ออก เพื่อบังคับใช้ Bearer token (แก้เคส cookie เป็น user อื่นแล้วโดน 403)
      credentials: "omit",
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

/** ---------------- UI styles ---------------- */
const readonlyField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black shadow-none dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-1.5 py-1 " +
  "text-right text-[12px] md:text-[13px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

const trunc = "whitespace-nowrap overflow-hidden text-ellipsis"

/** ---------------- Table sizing ---------------- */
const COL_W = { id: 92, item: 360, buy: 180, sell: 180 }
const LEFT_W = COL_W.id + COL_W.item
const TOTAL_W = LEFT_W + COL_W.buy + COL_W.sell

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

/**
 * Thonthun (ต้นทุนสินค้า)
 * - ลิสรายการจาก BE: /lists/product/search
 * - โหลดค่าที่เคยบันทึก: GET /unit-prices/{year}
 * - บันทึก: PUT /unit-prices/bulk (Admin)
 *
 * Props from OperationPlan:
 * - branchId, branchName, yearBE, planId
 */
const Thonthun = ({ branchId, branchName, yearBE, planId }) => {
  // ✅ ต้นทุนสินค้าใช้ปี + plan_id เหมือนหน้าค่าใช้จ่าย (ไม่เดาเอง)
  const effectiveYear = useMemo(() => {
    const y = Number(yearBE || 0)
    return Number.isFinite(y) && y >= 2500 ? y : 2569
  }, [yearBE])

  const effectivePlanId = useMemo(() => {
    const p = Number(planId || 0)
    return Number.isFinite(p) && p > 0 ? p : 0
  }, [planId])

  const effectiveBranchId = useMemo(() => Number(branchId || 0) || 0, [branchId])
  const effectiveBranchName = useMemo(() => {
    const bn = String(branchName || "").trim()
    if (!bn || bn === "-" || bn === "—") return "ทุกสาขา"
    return bn
  }, [branchName])

  const periodLabel = useMemo(() => {
    const yy = String(effectiveYear).slice(-2)
    const yyNext = String(effectiveYear + 1).slice(-2)
    return `1 เม.ย.${yy}-31 มี.ค.${yyNext}`
  }, [effectiveYear])

  /** ---------------- Load items list (rows) ---------------- */
  const [items, setItems] = useState([]) // {id,name,raw}
  const [itemsSource, setItemsSource] = useState("")
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  const normalizeItems = (data) => {
    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.results)
      ? data.results
      : []

    return arr
      .map((r) => {
        const id = Number(r?.id ?? r?.product_id ?? r?.product ?? r?.value ?? 0)
        const name =
          // ✅ ตาม BE (/lists/product/search)
          r?.product_name ||
          r?.product_type ||
          // fallback
          r?.name ||
          r?.label ||
          r?.title ||
          (id ? `รายการ ${id}` : "")

        return { id, name: String(name || "").trim(), raw: r }
      })
      .filter((x) => x.id > 0 && x.name)
      .sort((a, b) => a.id - b.id)
  }

  const loadItems = useCallback(async () => {
    const primary = "/lists/product/search"

    try {
      const data = await apiAuth(primary)
      const normalized = normalizeItems(data)
      if (normalized.length) {
        setItems(normalized)
        setItemsSource(primary)
        return
      }
    } catch {
      // fallback below
    }

    const fallbacks = ["/order/product/search", "/lists/products/search", "/list/product/search"]
    for (const path of fallbacks) {
      try {
        const data = await apiAuth(path)
        const normalized = normalizeItems(data)
        if (normalized.length) {
          setItems(normalized)
          setItemsSource(path)
          return
        }
      } catch {
        // keep trying
      }
    }

    setItems([])
    setItemsSource("")
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setIsLoadingItems(true)
      try {
        await loadItems()
      } finally {
        if (alive) setIsLoadingItems(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [loadItems])

  /** ---------------- Plan info (optional) ---------------- */
  const [planInfo, setPlanInfo] = useState(null) // {id,fiscal_year,start_end,...}
  const [isLoadingPlan, setIsLoadingPlan] = useState(false)

  const loadPlanInfo = useCallback(async () => {
    if (!effectiveYear) return
    setIsLoadingPlan(true)
    try {
      const data = await apiAuth(`/unit-prices/${effectiveYear}/plan`)
      if (data?.exists && data?.plan) setPlanInfo(data.plan)
      else setPlanInfo(null)
    } catch {
      setPlanInfo(null)
    } finally {
      setIsLoadingPlan(false)
    }
  }, [effectiveYear])

  useEffect(() => {
    loadPlanInfo()
  }, [loadPlanInfo])

  /** ---------------- Values ---------------- */
  const [valuesById, setValuesById] = useState({}) // { [productId]: {buy,sell} }
  const [savedById, setSavedById] = useState({}) // baseline ล่าสุดจาก BE (เพื่อ diff ตอนบันทึก)
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [lastLoadedAt, setLastLoadedAt] = useState(null)
  const [lastSavedAt, setLastSavedAt] = useState(null)

  const normalizeGrid = useCallback(
    (seed = {}) => {
      const next = {}
      for (const it of items) {
        const s = seed[it.id] || {}
        next[it.id] = {
          buy: s.buy ?? s.buy_price ?? "",
          sell: s.sell ?? s.sell_price ?? "",
        }
      }
      return next
    },
    [items]
  )

  useEffect(() => {
    setValuesById((prev) => normalizeGrid(prev))
    setSavedById((prev) => normalizeGrid(prev))
  }, [items, normalizeGrid])

  const loadSavedFromBE = useCallback(async () => {
    if (!effectiveYear) return
    if (!items.length) return

    setIsLoadingSaved(true)
    try {
      const data = await apiAuth(`/unit-prices/${effectiveYear}`)
      const rows = Array.isArray(data) ? data : []
      const seed = {}
      for (const r of rows) {
        const pid = Number(r?.product_id ?? r?.product ?? 0)
        if (!pid) continue
        seed[pid] = {
          buy: r?.buy_price != null ? String(r.buy_price) : "",
          sell: r?.sell_price != null ? String(r.sell_price) : "",
        }
      }
      const normalized = normalizeGrid(seed)
      setValuesById(normalized)
      setSavedById(normalized)
      setLastLoadedAt(new Date())
    } catch (e) {
      console.error("[Thonthun] load saved failed:", e)
      const empty = normalizeGrid({})
      setValuesById(empty)
      setSavedById(empty)
    } finally {
      setIsLoadingSaved(false)
    }
  }, [effectiveYear, items.length, normalizeGrid])

  useEffect(() => {
    loadSavedFromBE()
  }, [loadSavedFromBE])

  const setCell = (productId, field, nextValue) => {
    setValuesById((prev) => {
      const next = { ...prev }
      const row = { ...(next[productId] || { buy: "", sell: "" }) }
      row[field] = nextValue
      next[productId] = row
      return next
    })
  }

  /** ---------------- Computed ---------------- */
  const computed = useMemo(() => {
    let filled = 0
    let sumBuy = 0
    let sumSell = 0
    for (const it of items) {
      const row = valuesById[it.id] || {}
      const buy = toNumber(row.buy)
      const sell = toNumber(row.sell)
      if (buy !== 0 || sell !== 0) filled += 1
      sumBuy += buy
      sumSell += sell
    }
    return { filled, sumBuy, sumSell }
  }, [items, valuesById])

  /** ---------------- Height + Scroll + Arrow nav ---------------- */
  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(860)
  const recalcTableCardHeight = useCallback(() => {
    const el = tableCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 900
    const bottomPadding = 6
    setTableCardHeight(Math.max(760, Math.floor(vh - rect.top - bottomPadding)))
  }, [])
  useEffect(() => {
    recalcTableCardHeight()
    window.addEventListener("resize", recalcTableCardHeight)
    return () => window.removeEventListener("resize", recalcTableCardHeight)
  }, [recalcTableCardHeight])

  const bodyScrollRef = useRef(null)
  const rafRef = useRef(0)
  const onBodyScroll = () => {
    const b = bodyScrollRef.current
    if (!b) return
    const x = b.scrollLeft || 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      void x
    })
  }
  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), [])

  const inputRefs = useRef(new Map())
  const totalCols = 2

  const ensureInView = useCallback((el) => {
    const container = bodyScrollRef.current
    if (!container || !el) return
    const pad = 10
    const frozenLeft = LEFT_W
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
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(k)) return
      const row = Number(e.currentTarget.dataset.row ?? 0)
      const col = Number(e.currentTarget.dataset.col ?? 0)

      let nextRow = row
      let nextCol = col

      if (k === "Enter") {
        nextCol = col + 1
        if (nextCol > totalCols - 1) {
          nextCol = 0
          nextRow = row + 1
        }
      }
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
      } catch {
        // ignore
      }
      requestAnimationFrame(() => ensureInView(target))
    },
    [ensureInView, items.length]
  )

  /** ---------------- Save ---------------- */
  const [saveNotice, setSaveNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const buildPayloadForBE = () => {
    if (!effectiveYear) throw new Error("FE: ปีไม่ถูกต้อง")
    if (!items.length) throw new Error("FE: ยังไม่พบรายการ (โหลด list ไม่สำเร็จ)")

    const changed = []
    for (const it of items) {
      const cur = valuesById[it.id] || {}
      const prev = savedById[it.id] || {}

      const curBuy = round3(cur.buy)
      const curSell = round3(cur.sell)
      const prevBuy = round3(prev.buy)
      const prevSell = round3(prev.sell)

      if (curBuy !== prevBuy || curSell !== prevSell) {
        changed.push({
          product_id: it.id,
          sell_price: curSell,
          buy_price: curBuy,
          comment: periodLabel,
        })
      }
    }

    return { year: effectiveYear, items: changed }
  }

  const NoticeBox = ({ notice }) => {
    if (!notice) return null
    const isErr = notice.type === "error"
    const isOk = notice.type === "success"
    const cls = isErr
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200"
      : isOk
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
      : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"

    return (
      <div className={cx("mb-3 rounded-2xl border p-3 text-sm", cls)}>
        <div className="font-extrabold">{notice.title}</div>
        {notice.detail && <div className="mt-1 text-[13px] opacity-95">{notice.detail}</div>}
      </div>
    )
  }

  const saveToBE = async () => {
    let payload = null
    try {
      setSaveNotice(null)
      payload = buildPayloadForBE()

      if (!payload.items.length) {
        setSaveNotice({
          type: "info",
          title: "ไม่มีข้อมูลที่เปลี่ยน",
          detail: "ยังไม่มีรายการไหนถูกแก้ไข (เลยไม่ส่งไปบันทึก)",
        })
        return
      }

      setIsSaving(true)
      const res = await apiAuth(`/unit-prices/bulk`, {
        method: "PUT",
        body: payload,
      })

      setLastSavedAt(new Date())
      setSaveNotice({
        type: "success",
        title: "บันทึกสำเร็จ ✅",
        detail: `ปี ${effectiveYear} • ส่ง ${payload.items.length} รายการ • inserted: ${res?.inserted ?? "-"} • updated: ${res?.updated ?? "-"}`,
      })

      // ✅ โหลดใหม่ทันที เพื่อให้เห็นค่าปัจจุบันที่อยู่ในระบบ
      await loadSavedFromBE()
      await loadPlanInfo()
    } catch (e) {
      const status = e?.status || 0
      const beMsg = e?.message ? ` (${e.message})` : ""

      let title = "บันทึกไม่สำเร็จ ❌"
      let detail = e?.message || String(e)

      if (status === 401) {
        title = "401 Unauthorized"
        detail = "Token ไม่ผ่าน/หมดอายุ → Logout/Login ใหม่"
      } else if (status === 403) {
        title = "403 Forbidden"
        detail = `สิทธิ์ไม่พอ (ต้องเป็น Admin)${beMsg}`
      } else if (status === 404) {
        title = "404 Not Found"
        detail = "ไม่พบ route /unit-prices/bulk หรือ API_BASE ไม่ตรง"
      } else if (status === 422) {
        title = "422 Validation Error"
        detail = "รูปแบบข้อมูลไม่ผ่าน schema ของ BE (ดู console)"
      }

      setSaveNotice({ type: "error", title, detail })

      console.groupCollapsed("%c[Thonthun] Save failed ❌", "color:#ef4444;font-weight:800;")
      console.error("status:", status, "title:", title, "detail:", detail)
      console.error("year:", effectiveYear, "plan_id:", effectivePlanId)
      console.error("branch_id:", effectiveBranchId, "branch:", effectiveBranchName)
      console.error("token_found:", !!getToken())
      if (payload) console.error("payload preview:", payload.items?.slice(0, 5))
      console.error("raw error:", e)
      console.groupEnd()
    } finally {
      setIsSaving(false)
    }
  }

  const copyPayload = async () => {
    try {
      const payload = buildPayloadForBE()
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setSaveNotice({
        type: "success",
        title: "คัดลอกแล้ว ✅",
        detail: `คัดลอก payload สำหรับ BE แล้ว (items: ${payload.items?.length ?? 0})`,
      })
    } catch (e) {
      setSaveNotice({ type: "error", title: "คัดลอกไม่สำเร็จ", detail: e?.message || String(e) })
    }
  }

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    const empty = {}
    for (const it of items) empty[it.id] = { buy: "", sell: "" }
    setValuesById(empty)
    setSaveNotice({ type: "info", title: "ล้างข้อมูลแล้ว", detail: "รีเซ็ตค่าที่กรอกเป็นว่าง (ยังไม่บันทึก)" })
  }

  const reloadItems = async () => {
    setSaveNotice(null)
    setIsLoadingItems(true)
    try {
      await loadItems()
    } finally {
      setIsLoadingItems(false)
    }
  }

  /** ---------------- Sticky helpers ---------------- */
  const stickyCodeHeader =
    "sticky left-0 z-[95] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyLeftHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyCodeCell = "sticky left-0 z-[70] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  const formatTime = (d) => {
    if (!d) return "—"
    try {
      return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d)
    } catch {
      return String(d)
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-bold">ประมาณการต้นทุนสินค้า (ต้นทุนซื้อ/ต้นทุนการขาย)</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              ({periodLabel}) • ปี {effectiveYear} • plan_id {effectivePlanId || "-"} • สาขา {effectiveBranchName}
              {isLoadingItems ? " • โหลดรายการ..." : items.length ? ` • รายการ ${items.length}` : " • ไม่มีรายการ"}
              {isLoadingSaved ? " • โหลดค่าที่บันทึกไว้..." : ""}
              {isLoadingPlan ? " • ตรวจสอบแผน..." : ""}
            </div>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              กรอกแล้ว: <span className="font-extrabold">{computed.filled}</span> รายการ • รวมต้นทุนซื้อ:
              <span className="font-extrabold"> {fmtMoney0(computed.sumBuy)}</span> • รวมต้นทุนการขาย:
              <span className="font-extrabold"> {fmtMoney0(computed.sumSell)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={copyPayload}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              คัดลอก payload
            </button>

            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              ล้างข้อมูล
            </button>

            <button
              type="button"
              onClick={() => loadSavedFromBE()}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              โหลดค่าล่าสุด
            </button>

            <button
              type="button"
              onClick={reloadItems}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              รีโหลดรายการ
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">สาขา</div>
            <div className={readonlyField}>{effectiveBranchName}</div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">แหล่งรายการ (จาก BE)</div>
            <div className={readonlyField}>{itemsSource || (isLoadingItems ? "กำลังค้นหา..." : "—")}</div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">plan ในระบบ (จาก BE)</div>
            <div className={readonlyField}>
              {planInfo?.id ? `id: ${planInfo.id}` : isLoadingPlan ? "กำลังตรวจสอบ..." : "—"}
              {planInfo?.start_end ? ` • ${planInfo.start_end}` : ""}
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">เวลาโหลด/บันทึกล่าสุด</div>
            <div className={readonlyField}>
              โหลด: {formatTime(lastLoadedAt)} • บันทึก: {formatTime(lastSavedAt)}
            </div>
          </div>
        </div>

        {!items.length && !isLoadingItems && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
            <div className="font-extrabold">⚠️ ยังโหลดรายการไม่สำเร็จ</div>
            <div className="mt-1 text-[13px] opacity-95">
              ระบบพยายามเรียก <span className="font-mono">/lists/product/search</span> และ fallback อื่นๆ แล้ว แต่ไม่ได้ list กลับมา → เช็กว่า BE เปิด route และสิทธิ์ถูกต้อง
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div ref={bodyScrollRef} onScroll={onBodyScroll} className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700">
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.id }} />
              <col style={{ width: COL_W.item }} />
              <col style={{ width: COL_W.buy }} />
              <col style={{ width: COL_W.sell }} />
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                <th
                  rowSpan={2}
                  className={cx(
                    "border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600",
                    stickyCodeHeader
                  )}
                >
                  รหัส
                </th>
                <th
                  rowSpan={2}
                  className={cx(
                    "border border-slate-300 px-2 py-2 text-left font-bold text-xs dark:border-slate-600",
                    stickyLeftHeader,
                    trunc
                  )}
                  style={{ left: COL_W.id }}
                  title="รายการ"
                >
                  รายการ
                </th>
                <th
                  colSpan={2}
                  className="border border-slate-300 px-2 py-2 text-center font-extrabold text-xs dark:border-slate-600"
                >
                  ต้นทุน (บาท)
                </th>
              </tr>

              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                <th className="border border-slate-300 px-1 py-2 text-center text-[11px] md:text-xs dark:border-slate-600">ต้นทุนซื้อ</th>
                <th className="border border-slate-300 px-1 py-2 text-center text-[11px] md:text-xs dark:border-slate-600">ต้นทุนการขาย</th>
              </tr>
            </thead>

            <tbody>
              {items.length ? (
                items.map((it, idx) => {
                  const rowBg = idx % 2 === 1 ? STRIPE.alt : STRIPE.cell
                  const row = valuesById[it.id] || {}

                  return (
                    <tr key={it.id} className={rowBg}>
                      <td
                        className={cx(
                          "border border-slate-300 px-1 py-2 text-center text-xs dark:border-slate-600",
                          stickyCodeCell,
                          rowBg
                        )}
                      >
                        {it.id}
                      </td>

                      <td
                        className={cx(
                          "border border-slate-300 px-2 py-2 text-left font-semibold text-xs dark:border-slate-600",
                          "sticky z-[50]",
                          rowBg,
                          trunc
                        )}
                        style={{ left: COL_W.id }}
                        title={it.name}
                      >
                        {it.name}
                      </td>

                      {/* Buy */}
                      <td className="border border-slate-300 px-1 py-2 dark:border-slate-600">
                        <input
                          ref={(el) => {
                            const key = `${idx}|0`
                            if (!el) inputRefs.current.delete(key)
                            else inputRefs.current.set(key, el)
                          }}
                          data-row={idx}
                          data-col={0}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={row.buy ?? ""}
                          inputMode="numeric"
                          placeholder="0"
                          onChange={(e) => setCell(it.id, "buy", sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))}
                        />
                      </td>

                      {/* Sell */}
                      <td className="border border-slate-300 px-1 py-2 dark:border-slate-600">
                        <input
                          ref={(el) => {
                            const key = `${idx}|1`
                            if (!el) inputRefs.current.delete(key)
                            else inputRefs.current.set(key, el)
                          }}
                          data-row={idx}
                          data-col={1}
                          onKeyDown={handleArrowNav}
                          className={cellInput}
                          value={row.sell ?? ""}
                          inputMode="numeric"
                          placeholder="0"
                          onChange={(e) => setCell(it.id, "sell", sanitizeNumberInput(e.target.value, { maxDecimals: 3 }))}
                        />
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={4} className="border border-slate-300 px-3 py-6 text-center text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300">
                    {isLoadingItems ? "กำลังโหลดรายการ..." : "— ไม่มีรายการ —"}
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot className="sticky bottom-0 z-[75]">
              <tr className={cx("text-slate-900 dark:text-slate-100", STRIPE.foot)}>
                <td
                  className={cx(
                    "border border-slate-300 px-1 py-2 text-center font-bold text-xs dark:border-slate-600",
                    stickyCodeCell,
                    STRIPE.foot
                  )}
                >
                  รวม
                </td>
                <td
                  className={cx(
                    "border border-slate-300 px-2 py-2 text-left font-extrabold text-xs dark:border-slate-600",
                    "sticky z-[60]",
                    STRIPE.foot,
                    trunc
                  )}
                  style={{ left: COL_W.id }}
                >
                  รวมทั้งสิ้น
                </td>
                <td className="border border-slate-300 px-1 py-2 text-right font-bold text-xs dark:border-slate-600">
                  {fmtMoney0(computed.sumBuy)}
                </td>
                <td className="border border-slate-300 px-1 py-2 text-right font-bold text-xs dark:border-slate-600">
                  {fmtMoney0(computed.sumSell)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Action bar */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4">
          <NoticeBox notice={saveNotice} />

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              โหลด: <span className="font-mono">GET /unit-prices/{{year}}</span> • บันทึก: <span className="font-mono">PUT /unit-prices/bulk</span> • ปี={effectiveYear}
            </div>

            <button
              type="button"
              disabled={isSaving || !items.length}
              onClick={saveToBE}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white",
                "shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 hover:scale-[1.03] active:scale-[.98] transition",
                (isSaving || !items.length) && "opacity-60 hover:scale-100 cursor-not-allowed"
              )}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึกลงระบบ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Thonthun
