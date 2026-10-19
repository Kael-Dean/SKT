// src/pages/Order.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { apiAuth } from "../../lib/api"  // ✅ helper รวม token/BASE URL
import { cx, baseField, primaryBtnCls, neutralBtnCls, focusRingCls, helpTextCls } from "../../lib/styles"
import { EmptyState, ErrorState, SkeletonTableRows, DataList, Badge } from "../../components/ui"
import ComboBox from "../../components/ComboBox"
import { useIsPhone } from "../../hooks/useMediaQuery"
import useBranchLock, { scopedBranchId } from "../../hooks/useBranchLock"
import BranchLockNote from "../../components/BranchLockNote"
import DateInput from "../../components/ThaiDateField"
import PageTitle from "../../components/PageTitle"

/** ----------- Utils ----------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
const baht = (n) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** ---------- class helpers ---------- */

/** ---------- DateInput (รองรับ error) ---------- */
// ช่องวันที่ไทย (วัน เดือน พ.ศ.) ตัวกลาง — API เหมือน input เดิม (handoff F25)

/** ---------- Row derivations (shared by the desktop table and the phone cards) ---------- */
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("th-TH") : "—")
const deriveBuy = (r) => {
  const entry = toNumber(r.entry_weight ?? r.entryWeight ?? r.entry ?? 0)
  const exit = toNumber(r.exit_weight ?? r.exitWeight ?? r.exit ?? 0)
  const net = toNumber(r.weight) || Math.max(0, Math.abs(exit - entry))
  const deduct = Math.max(0, entry - exit - net)
  const price = toNumber(r.price ?? r.amountTHB ?? 0)
  const pricePerKgRaw = toNumber(r.price_per_kilo ?? r.pricePerKilo ?? r.unit_price ?? 0)
  const pricePerKg = pricePerKgRaw || (net > 0 ? price / net : 0)
  return {
    entry, exit, net, deduct, price, pricePerKg,
    date: fmtDate(r.date),
    serial: r.order_serial || r.paymentRefNo || "—",
    customer: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.customer_name || "—",
    species: r.species || r.rice_type || r.riceType || "—",
    branch: r.branch_name || r.branchName || "—",
    klang: r.klang_name || r.klangName || "—",
  }
}
const deriveSell = (r) => {
  const net = toNumber(r.weight ?? 0)
  const price = toNumber(r.price ?? 0)
  const pricePerKgRaw = toNumber(r.price_per_kilo ?? 0)
  const pricePerKg = pricePerKgRaw || (net > 0 ? price / net : 0)
  return {
    net, price, pricePerKg,
    date: fmtDate(r.date),
    saleId: r.sale_id || "—",
    serial: r.order_serial || "—",
    customer: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—",
    species: r.species || "—",
    branch: r.branch_name || "—",
    klang: r.klang_name || "—",
    sub: r.sub_order,
  }
}
const buyKey = (r) => r.id ?? `${r.order_serial}-${r.date}-${r.first_name ?? ""}-${r.last_name ?? ""}`
const sellKey = (r) => `${r.id ?? r.sale_id}-${r.sub_order ?? 0}`

/** ---------- Page: Order ---------- */
const PAGE_SIZE = 100
const PAGE_BTN_ACTIVE = "bg-emerald-600 text-white"
const MODE_BTN_ACTIVE = "bg-emerald-600 text-white shadow"
const MODE_BTN_IDLE = "text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700"
const PAGE_BTN_IDLE = "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"

const Order = () => {
  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const isPhone = useIsPhone()

  /** ---------- State ---------- */
  // เปิดโหมดจากลิงก์ได้ เช่น #/order?mode=sell (ปุ่ม "ดูออเดอร์" หลังขายข้าว)
  const [mode, setMode] = useState(() =>
    /[?&]mode=sell\b/.test(typeof window !== "undefined" ? window.location.hash : "") ? "sell" : "buy"
  ) // 'buy' | 'sell'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  // Phone only: show ErrorState instead of a silent empty list when the fetch fails.
  const [loadError, setLoadError] = useState("")

  // ⭐ Request guard — ทำให้ผลคำขอเก่าถูกเมินเมื่อมีคำขอใหม่กว่า
  const listReqId = useRef(0)

  // pagination
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState("1")
  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), [rows.length])
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, page])

  // options
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])
  const [specOptions, setSpecOptions] = useState([])
  const [loadingSpecs, setLoadingSpecs] = useState(false)

  // เก็บ label ของ variant ไว้ดูชื่อชั้นย่อย
  const [variantLookup, setVariantLookup] = useState({})

  // สาขา: scope "own_branch" → ล็อกที่สาขาที่ใช้งานอยู่
  const branchLock = useBranchLock()

  // filters
  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,

    branchId: branchLock.activeKey, branchName: "",
    klangId: "", klangName: "",

    specId: "", specLabel: "",
    q: "",
  })
  const [errors, setErrors] = useState({ startDate: "", endDate: "" })
  const debouncedQ = useDebounce(filters.q, 500)

  /** ---------- Validation ---------- */
  const validateDates = (s, e) => {
    const out = { startDate: "", endDate: "" }
    if (!s) out.startDate = "กรุณาเลือกวันที่เริ่ม"
    if (!e) out.endDate = "กรุณาเลือกวันที่สิ้นสุด"
    if (s && e) {
      const sd = new Date(s)
      const ed = new Date(e)
      if (ed < sd) out.endDate = "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น"
    }
    setErrors(out)
    return !out.startDate && !out.endDate
  }
  useEffect(() => {
    validateDates(filters.startDate, filters.endDate)
  }, [filters.startDate, filters.endDate])

  /** ---------- Load initial (branch + spec) ---------- */
  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoadingSpecs(true)
        const [branches, specs] = await Promise.all([
          apiAuth(`/order/branch/search`),
          apiAuth(`/order/form/search`), // รายการสำเร็จรูป (ProductSpec.prod_name)
        ])
        setBranchOptions((Array.isArray(branches) ? branches : []).map(x => ({ id: String(x.id), label: x.branch_name })))

        const opts = (Array.isArray(specs) ? specs : [])
          .map(r => ({
            id: String(r.id),
            label: String(r.prod_name || r.name || r.spec_name || "").trim(),
            spec: {
              species_id: r.species_id ?? null,
              variant_id: r.variant_id ?? null,
              product_id: r.product_id ?? null,
              product_year: r.product_year ?? null,
              condition_id: r.condition_id ?? null,
              field_type: r.field_type ?? null,
              program: r.program ?? null,
              business_type: r.business_type ?? null,
            },
          }))
          .filter(o => o.id && o.label)
        setSpecOptions(opts)
      } catch (e) {
        console.error("load initial options failed:", e)
        setBranchOptions([]); setSpecOptions([])
      } finally {
        setLoadingSpecs(false)
      }
    }
    loadInitial()
  }, [])

  /** ---------- โหลดชื่อ variant ของ species ที่ปรากฏใน specOptions ---------- */
  useEffect(() => {
    const speciesIds = Array.from(
      new Set(
        (specOptions || [])
          .map((t) => t?.spec?.species_id)
          .filter(Boolean)
          .map(String)
      )
    )
    if (speciesIds.length === 0) return

    const fetchAll = async () => {
      try {
        const list = await Promise.all(
          speciesIds.map(async (sid) => {
            const arr = (await apiAuth(`/order/variant/search?species_id=${encodeURIComponent(sid)}`)) || []
            return arr.map((x) => ({
              id: String(x.id ?? x.variant_id ?? x.value ?? ""),
              label: String(x.variant ?? x.name ?? x.label ?? "").trim(),
            }))
          })
        )
        const map = {}
        list.flat().forEach(({ id, label }) => {
          if (id && label) map[id] = label
        })
        setVariantLookup(map)
      } catch (e) {
        console.error("load variants for specs error:", e)
      }
    }
    fetchAll()
  }, [specOptions])

  /** ---------- คืน subLabel ใต้ label: “ชั้นย่อย: …” ---------- */
  const templateSubLabel = (opt) => {
    const vid = String(opt?.spec?.variant_id ?? "")
    const vLabel = vid ? (variantLookup[vid] || "") : ""
    return vLabel ? `ชั้นย่อย: ${vLabel}` : ""
  }

  // ล็อกสาขา (โหลดสิทธิ์เสร็จทีหลัง) → บังคับให้ filter เป็นสาขาที่ใช้งานอยู่
  useEffect(() => {
    if (!branchLock.locked) return
    setFilters((p) => (p.branchId === branchLock.activeKey ? p : { ...p, branchId: branchLock.activeKey, branchName: "", klangId: "", klangName: "" }))
  }, [branchLock.locked, branchLock.activeKey])

  /** ---------- branch → klang ---------- */
  useEffect(() => {
    const loadKlang = async () => {
      if (!filters.branchId) {
        setKlangOptions([])
        setFilters((p) => ({ ...p, klangId: "", klangName: "" }))
        return
      }
      try {
        const data = await apiAuth(`/order/klang/search?branch_id=${filters.branchId}`)
        setKlangOptions((Array.isArray(data) ? data : []).map(x => ({ id: String(x.id), label: x.klang_name })))
      } catch (e) {
        console.error("load klang failed:", e)
        setKlangOptions([])
      }
    }
    loadKlang()
  }, [filters.branchId])

  /** ---------- Fetch orders (BUY or SELL) + Request Guard ---------- */
  const fetchOrders = async () => {
    if (!validateDates(filters.startDate, filters.endDate)) return

    const myReq = ++listReqId.current  // ทำให้คำขอเก่ากลายเป็นของเดิม
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("start_date", filters.startDate)
      params.set("end_date", filters.endDate)
      const branchId = scopedBranchId(filters.branchId)
      if (branchId) params.set("branch_id", branchId)
      if (filters.klangId) params.set("klang_id", filters.klangId)
      if (filters.q?.trim()) params.set("q", filters.q.trim())
      // สินค้า: เลือกได้ 1 รายการ · ไม่เลือก = ทุกสินค้า (api-handoff §7)
      if (filters.specId) params.set("spec_id", filters.specId)

      const endpoint = mode === "buy" ? `/order/orders/buy-report` : `/order/orders/sell-report`
      const data = await apiAuth(`${endpoint}?${params.toString()}`)

      if (listReqId.current !== myReq) return  // ถ้าไม่ใช่คำขอล่าสุดให้เมินผลนี้
      setRows(Array.isArray(data) ? data : [])
      setPage(1); setPageInput("1")
      setLoadError("")
    } catch (e) {
      console.error(e)
      if (listReqId.current !== myReq) return
      setRows([]); setPage(1); setPageInput("1")
      setLoadError("โหลดข้อมูลไม่สำเร็จ")
    } finally {
      if (listReqId.current === myReq) {
        setLoading(false)
      }
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOrders() }, []) // init load

  // ⭐ สลับโหมด: เคลียร์จอ + ขึ้นโหลดทันที + ทำให้คำขอเก่าหมดอายุ
  const switchMode = (next) => {
    if (next === mode) return
    listReqId.current += 1        // invalidate คำขอที่ค้างอยู่ทั้งหมด
    setLoading(true)               // ให้ UI แสดงกำลังโหลดทันที
    setRows([])                    // กันข้อมูลโหมดเดิมค้างจอ
    setPage(1); setPageInput("1")
    setMode(next)                  // useEffect ด้านล่างจะ fetch ใหม่
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOrders() }, [mode]) // โหลดใหม่เมื่อเปลี่ยนโหมด

  /** ---------- Auto refresh on debounced search ---------- */
  useEffect(() => {
    if (filters.q.length >= 2 || filters.q.length === 0) fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ])

  /** ---------- Totals ---------- */
  const totals = useMemo(() => {
    let weight = 0
    let revenue = 0
    let deduct = 0

    let unitCount = 0

    rows.forEach((x) => {
      const entry = toNumber(x.entry_weight ?? x.entryWeight ?? x.entry ?? 0)
      const exit = toNumber(x.exit_weight ?? x.exitWeight ?? x.exit ?? 0)
      const net = toNumber(x.weight ?? 0)

      weight += net
      revenue += toNumber(x.price ?? 0)

      const d = Math.max(0, entry - exit - net)
      deduct += d
      if (net > 0) unitCount += 1
    })

    // ราคาเฉลี่ยต่อกก. = มูลค่ารวม ÷ น้ำหนักรวม (ถ่วงน้ำหนัก — handoff F15)
    const avgUnitPrice = weight > 0 ? revenue / weight : 0
    return { weight, revenue, deduct, avgUnitPrice, unitCount }
  }, [rows])

  /** ---------- Pagination helpers ---------- */
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages))
    setPageInput((v) => String(Math.min(Math.max(1, toNumber(onlyDigits(v)) || 1), totalPages)))
  }, [totalPages])

  const goToPage = (p) => {
    const n = Math.min(Math.max(1, toNumber(p)), totalPages)
    setPage(n); setPageInput(String(n))
    try {
      // The body is the document scroller now (plan §A7); keep the old <main>
      // call for safety — it is a no-op when <main> does not scroll.
      const main = document.querySelector("main")
      if (main && typeof main.scrollTo === "function") main.scrollTo({ top: 0, behavior: "smooth" })
      window?.scrollTo?.({ top: 0, behavior: "smooth" })
    } catch { /* no-op */ }
  }
  const nextPage = () => goToPage(page + 1)
  const prevPage = () => goToPage(page - 1)
  const onCommitPageInput = () => {
    const n = toNumber(onlyDigits(pageInput))
    if (!n) { setPageInput(String(page)); return }
    goToPage(n)
  }
  const pageItems = useMemo(() => {
    const items = []
    const delta = 2
    const left = Math.max(1, page - delta)
    const right = Math.min(totalPages, page + delta)
    if (left > 1) items.push(1)
    if (left > 2) items.push("...")
    for (let i = left; i <= right; i++) items.push(i)
    if (right < totalPages - 1) items.push("...")
    if (right < totalPages) items.push(totalPages)
    return items
  }, [page, totalPages])

  /** ---------- Reset ---------- */
  const resetFilters = () => {
    setFilters({
      startDate: firstDayThisMonth,
      endDate: today,

      branchId: branchLock.activeKey, branchName: "",
      klangId: "", klangName: "",

      specId: "", specLabel: "",
      q: "",
    })
    if (!branchLock.locked) setKlangOptions([])
    setPage(1); setPageInput("1")
    setErrors({ startDate: "", endDate: "" })
  }

  /** ----------- UI ----------- */
  const startIndex = (page - 1) * PAGE_SIZE + 1
  const endIndex = Math.min(rows.length, page * PAGE_SIZE)
  // จำนวนคอลัมน์จริงต่อโหมด — ใช้กับ skeleton/empty ให้ตรง layout
  const colCount = mode === "buy" ? 12 : 11
  const dateError = !!errors.startDate || !!errors.endDate

  // Active filters (badge on the phone disclosure). Dates count only when changed from the default range.
  const activeFilterCount =
    (filters.startDate !== firstDayThisMonth ? 1 : 0) +
    (filters.endDate !== today ? 1 : 0) +
    (filters.branchId && !branchLock.locked ? 1 : 0) +
    (filters.klangId ? 1 : 0) +
    (filters.specId ? 1 : 0) +
    (filters.q.trim() ? 1 : 0)

  const labelCls = "mb-1 block text-sm text-slate-700 dark:text-slate-300"

  // Filter fields — the SAME nodes on desktop (card grid) and phone (<details>).
  const filterFields = (
    <>
      {/* วันที่เริ่ม */}
      <div>
        <label className={labelCls} htmlFor="order-start">วันที่เริ่ม</label>
        <DateInput
          id="order-start"
          aria-invalid={errors.startDate ? true : undefined}
          aria-describedby={errors.startDate ? "order-start-err" : undefined}
          value={filters.startDate}
          onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
          error={!!errors.startDate}
        />
        {errors.startDate && <div id="order-start-err" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startDate}</div>}
      </div>

      {/* วันที่สิ้นสุด */}
      <div>
        <label className={labelCls} htmlFor="order-end">วันที่สิ้นสุด</label>
        <DateInput
          id="order-end"
          aria-invalid={errors.endDate ? true : undefined}
          aria-describedby={errors.endDate ? "order-end-err" : undefined}
          value={filters.endDate}
          onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
          error={!!errors.endDate}
        />
        {errors.endDate && <div id="order-end-err" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.endDate}</div>}
      </div>

      {/* สาขา */}
      <div>
        <label className={labelCls}>สาขา</label>
        <ComboBox
          options={branchOptions}
          value={filters.branchId}
          getValue={(o) => o.id}
          onChange={(id, found) =>
            setFilters((p) => ({ ...p, branchId: id || "", branchName: found?.label ?? "", klangId: "", klangName: "" }))}
          placeholder="— เลือกสาขา —"
          title="สาขา"
          ariaLabel="สาขา"
          disabled={branchLock.locked}
        />
        {branchLock.locked && <BranchLockNote />}
      </div>

      {/* คลัง */}
      <div>
        <label className={labelCls}>คลัง</label>
        <ComboBox
          options={klangOptions}
          value={filters.klangId}
          getValue={(o) => o.id}
          onChange={(id, found) =>
            setFilters((p) => ({ ...p, klangId: id || "", klangName: found?.label ?? "" }))}
          placeholder="— เลือกคลัง —"
          disabled={!filters.branchId}
          title="คลัง"
          ariaLabel="คลัง"
        />
      </div>

      {/* รายการสินค้า (spec) — โชว์ชั้นย่อยแบบหน้า Buy · ส่ง spec_id เดียว, ไม่เลือก = ทุกสินค้า */}
      <div className="md:col-span-2">
        <label className={labelCls}>รายการสินค้า (ไม่บังคับ)</label>
        <ComboBox
          options={specOptions.length ? [{ id: "", label: "— ทุกสินค้า —" }, ...specOptions] : specOptions}
          value={filters.specId}
          getValue={(o) => o.id}
          getSubLabel={(o) => templateSubLabel(o)}
          onChange={(id, found) =>
            setFilters((p) => ({ ...p, specId: id || "", specLabel: found?.label ?? "" }))}
          placeholder={loadingSpecs ? "— กำลังโหลด… —" : "— ทุกสินค้า —"}
          disabled={loadingSpecs || specOptions.length === 0}
          searchable
          title="รายการสินค้า"
          ariaLabel="รายการสินค้า"
        />
        <p className={helpTextCls}>ไม่เลือก = ทุกสินค้า</p>
      </div>

      {/* Search box */}
      <div className="md:col-span-2">
        <label className={labelCls} htmlFor="order-q">
          {mode === "buy"
            ? "ค้นหา (ชื่อ / ปชช. / เลขที่ใบสำคัญ)"
            : "ค้นหา (ชื่อ / ปชช. / ใบรับเงินขายสินค้า / เลขที่ใบชั่ง)"}
        </label>
        <input
          id="order-q"
          className={baseField}
          value={filters.q}
          onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
          placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร แล้วระบบจะค้นหาอัตโนมัติ"
        />
      </div>
    </>
  )

  // ---------- phone list ----------
  const emptyPhone = (
    <EmptyState
      title="ไม่พบออเดอร์"
      description={`ไม่มีรายการ${mode === "buy" ? "ฝั่งซื้อ" : "ฝั่งขาย"}ในช่วงวันที่และตัวกรองนี้`}
      action={activeFilterCount > 0 ? (
        <button type="button" onClick={resetFilters} className={neutralBtnCls}>ล้างตัวกรอง</button>
      ) : null}
    />
  )
  const phoneList = loadError && !loading ? (
    <ErrorState message={loadError} onRetry={fetchOrders} />
  ) : mode === "buy" ? (
    <DataList
      items={pagedRows}
      keyOf={buyKey}
      loading={loading}
      skeletonRows={6}
      emptyState={emptyPhone}
      title={(r) => deriveBuy(r).customer}
      subtitle={(r) => {
        const d = deriveBuy(r)
        return [d.date, d.serial, d.klang !== "—" ? d.klang : null].filter(Boolean).join(" · ")
      }}
      badge={(r) => <Badge tone="neutral">{deriveBuy(r).branch}</Badge>}
      fields={[
        { label: "ชนิดข้าว", value: (r) => deriveBuy(r).species, span: 2 },
        { label: "นน.สุทธิ (กก.)", value: (r) => deriveBuy(r).net.toLocaleString(), align: "right" },
        { label: "หัก นน. (กก.)", value: (r) => { const d = deriveBuy(r).deduct; return d > 0 ? d.toLocaleString() : "—" }, align: "right" },
        { label: "ราคา/กก. (บาท)", value: (r) => baht(deriveBuy(r).pricePerKg), align: "right" },
        { label: "เป็นเงิน", value: (r) => thb(deriveBuy(r).price), align: "right", emphasis: true },
      ]}
    />
  ) : (
    <DataList
      items={pagedRows}
      keyOf={sellKey}
      loading={loading}
      skeletonRows={6}
      emptyState={emptyPhone}
      title={(r) => deriveSell(r).customer}
      subtitle={(r) => {
        const d = deriveSell(r)
        return <span className="line-clamp-2">{`${d.date} · ใบรับเงิน ${d.saleId} · ใบชั่ง ${d.serial}`}</span>
      }}
      badge={(r) => {
        const d = deriveSell(r)
        return (
          <span className="flex flex-col items-end gap-1">
            <Badge tone="neutral">{d.branch}</Badge>
            {toNumber(d.sub) > 1 && <Badge tone="info">พ่วง {d.sub}</Badge>}
          </span>
        )
      }}
      fields={[
        { label: "ชนิดข้าว", value: (r) => deriveSell(r).species, span: 2 },
        { label: "น้ำหนัก (กก.)", value: (r) => deriveSell(r).net.toLocaleString(), align: "right" },
        { label: "ราคา/กก. (บาท)", value: (r) => baht(deriveSell(r).pricePerKg), align: "right" },
        { label: "เป็นเงิน", value: (r) => thb(deriveSell(r).price), align: "right", emphasis: true, span: 2 },
      ]}
    />
  )

  const phonePager = rows.length > 0 && !loading && (
    <nav aria-label="เลขหน้า" className="mt-4">
      <div className="flex items-center justify-between gap-1.5">
        <button type="button" onClick={prevPage} disabled={page <= 1} aria-label="หน้าก่อนหน้า" className={cx(neutralBtnCls, "shrink-0 gap-1 whitespace-nowrap px-2.5")}>
          <ChevronLeft aria-hidden="true" className="size-4" /> ก่อนหน้า
        </button>
        <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
          <span className="hidden min-[380px]:inline">หน้า</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="ไปหน้า"
            value={pageInput}
            onChange={(e) => setPageInput(onlyDigits(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && onCommitPageInput()}
            onBlur={onCommitPageInput}
            className="h-11 w-14 shrink-0 rounded-xl border border-slate-300 bg-slate-100 px-1 text-center text-base tabular-nums text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <span className="tabular-nums">/ {totalPages.toLocaleString()}</span>
        </div>
        <button type="button" onClick={nextPage} disabled={page >= totalPages} aria-label="หน้าถัดไป" className={cx(neutralBtnCls, "shrink-0 gap-1 whitespace-nowrap px-2.5")}>
          ถัดไป <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <p className="mt-2 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {startIndex.toLocaleString()}–{endIndex.toLocaleString()} จาก {rows.length.toLocaleString()}
      </p>
    </nav>
  )

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-[1800px] p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <PageTitle title={mode === "buy" ? "รายการออเดอร์ซื้อข้าวเปลือก" : "รายการออเดอร์ขายข้าวเปลือก"} />

          {/* Toggle Buy/Sell — stays outside the filter disclosure on phones */}
          <div role="radiogroup" aria-label="โหมด" className="inline-flex items-center rounded-2xl border border-slate-300 p-1 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-600">
            {[["buy", "โหมดซื้อ"], ["sell", "โหมดขาย"]].map(([m, l]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => switchMode(m)}
                className={cx(
                  "min-h-touch flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer md:min-h-0 md:flex-none",
                  mode === m ? MODE_BTN_ACTIVE : MODE_BTN_IDLE
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        {isPhone ? (
          <details className="group mb-4 rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <summary className={cx("flex min-h-touch cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-2 text-base font-semibold text-gray-700 dark:text-gray-200 [&::-webkit-details-marker]:hidden", focusRingCls)}>
              ตัวกรอง
              {activeFilterCount > 0 && <Badge tone="info">{activeFilterCount} ตัวกรอง</Badge>}
              <ChevronDown aria-hidden="true" className="ml-auto size-5 text-gray-400 transition-transform duration-150 group-open:rotate-180 dark:text-gray-500" />
            </summary>
            <div className="grid gap-3 border-t border-slate-100 p-4 dark:border-slate-700">
              {filterFields}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button type="button" onClick={resetFilters} className={neutralBtnCls}>ล้างตัวกรอง</button>
                <button type="button" onClick={fetchOrders} disabled={dateError} className={primaryBtnCls}>ค้นหา</button>
              </div>
            </div>
          </details>
        ) : (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <div className="grid gap-3 md:grid-cols-6">
              {filterFields}

              <div className="flex items-end gap-2 md:col-span-6">
                <button
                  onClick={fetchOrders}
                  type="button"
                  disabled={dateError}
                  className={cx(
                    "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold text-white transition-all duration-300 ease-out cursor-pointer",
                    dateError
                      ? "bg-emerald-400/60 pointer-events-none"
                      : "bg-emerald-600 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)] hover:scale-[1.05] active:scale-[.97]"
                  )}
                >
                  ค้นหา
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center rounded-2xl
                             border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700
                             shadow-sm transition-all duration-300 ease-out
                             hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                             active:scale-[.97]
                             dark:border-slate-600 dark:bg-slate-700/60 dark:text-white
                             dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
                >
                  รีเซ็ต
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary — 2 columns on phones */}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {/* จำนวนรายการ */}
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200
                        dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-sm md:text-base text-slate-500 dark:text-slate-400">จำนวนรายการ</div>
            <div className="text-xl md:text-2xl font-semibold tabular-nums">
              {rows.length.toLocaleString()}
            </div>
          </div>

          {/* น้ำหนักรวม */}
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200
                        dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-sm md:text-base text-slate-500 dark:text-slate-400">น้ำหนักสุทธิรวม (กก.)</div>
            <div className="text-xl md:text-2xl font-semibold tabular-nums">
              {(Math.round(toNumber(totals.weight) * 100) / 100).toLocaleString()}
            </div>
          </div>

          {/* หัก นน.รวม */}
          <div className="rounded-2xl bg-amber-50 p-4 text-amber-950 shadow-sm ring-1 ring-amber-300
                        dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-700">
            <div className="text-sm md:text-base text-amber-700 dark:text-amber-300">หัก นน.รวม (กก.)</div>
            <div className="text-xl md:text-2xl font-semibold tabular-nums">
              {totals.deduct.toLocaleString()}
            </div>
          </div>

          {/* ราคาเฉลี่ย — phone tile (desktop shows it inside the value block) */}
          {isPhone && (
            <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
              <div className="text-sm text-slate-500 dark:text-slate-400">ราคาเฉลี่ย (บาท/กก.)</div>
              <div className="text-xl font-semibold tabular-nums">{baht(toNumber(totals.avgUnitPrice))}</div>
            </div>
          )}

          {/* 👉 แถวล่าง : มูลค่ารวม (สีเขียว) */}
          <div className="col-span-2 md:col-span-3 rounded-2xl bg-emerald-50 p-4 md:p-6 text-emerald-950 shadow-sm
                ring-1 ring-emerald-300
                flex flex-col items-center justify-center text-center
                dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700">

            <div className="text-emerald-700 dark:text-emerald-300">มูลค่ารวม</div>
            <div className="text-2xl font-semibold tabular-nums">
              {thb(toNumber(totals.revenue))}
            </div>

            {/* ✅ ราคาเฉลี่ยของ “ราคาต่อกก.” ของออเดอร์ทั้งหมดตามฟิลเตอร์ ณ ตอนนั้น (ทำให้เด่น + มีกล่อง) */}
            {!isPhone && (
              <div
                className="mt-4 inline-flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1
                           rounded-2xl border-2 border-emerald-600/60 bg-white/70 px-5 py-3
                           shadow-sm ring-1 ring-emerald-600/10
                           dark:border-emerald-400/60 dark:bg-slate-900/30 dark:ring-emerald-400/10"
              >
                <span className="text-sm md:text-base font-semibold text-emerald-800 dark:text-emerald-200">
                  ราคาเฉลี่ยต่อกก.
                </span>

                <span className="text-xl md:text-2xl font-extrabold text-emerald-900 dark:text-emerald-100">
                  {baht(toNumber(totals.avgUnitPrice))}
                </span>

                <span className="text-sm md:text-base font-semibold text-emerald-800/90 dark:text-emerald-200/90">
                  บาท/กก.
                </span>

                {totals.unitCount ? (
                  <span className="text-sm md:text-base text-emerald-800/80 dark:text-emerald-200/80">
                    ({totals.unitCount.toLocaleString()} รายการ)
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* List: cards on phones (conditional render — not CSS hide), table from md */}
        {isPhone ? (
          <div aria-busy={loading ? "true" : "false"}>
            {phoneList}
            {phonePager}
          </div>
        ) : (
        <div
          className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          aria-busy={loading ? "true" : "false"}
        >
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {mode === "buy" ? (
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">วันที่</th>
                  <th className="px-3 py-2 whitespace-nowrap">เลขที่ใบสำคัญ</th>
                  <th className="px-3 py-2">ลูกค้า</th>
                  <th className="px-3 py-2">ชนิดข้าว</th>
                  <th className="px-3 py-2 whitespace-nowrap">สาขา</th>
                  <th className="px-3 py-2 whitespace-nowrap">คลัง</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">นน.ขาเข้า</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">นน.ขาออก</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">หัก นน.</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">นน.สุทธิ</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">ราคาต่อกก. (บาท)</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">เป็นเงิน</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">วันที่</th>
                  <th className="px-3 py-2 whitespace-nowrap">ใบรับเงินขายสินค้า</th>
                  <th className="px-3 py-2 whitespace-nowrap">เลขที่ใบชั่ง</th>
                  <th className="px-3 py-2">ลูกค้า</th>
                  <th className="px-3 py-2">ชนิดข้าว</th>
                  <th className="px-3 py-2 whitespace-nowrap">สาขา</th>
                  <th className="px-3 py-2 whitespace-nowrap">คลัง</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">น้ำหนัก (กก.)</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">ราคาต่อกก. (บาท)</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">เป็นเงิน</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">ลำดับพ่วง</th>
                </tr>
              )}
            </thead>

            <tbody>
              {loading ? (
                <SkeletonTableRows rows={10} cols={colCount} />
              ) : rows.length === 0 ? (
                <tr>
                  <td className="p-0" colSpan={colCount}>
                    <EmptyState
                      title="ไม่พบข้อมูลออเดอร์"
                      description={`ไม่มีรายการ${mode === "buy" ? "ฝั่งซื้อ" : "ฝั่งขาย"}ตามช่วงวันที่และตัวกรองที่เลือก ลองปรับช่วงวันที่หรือล้างตัวกรองด้านบน`}
                    />
                  </td>
                </tr>
              ) : mode === "buy" ? (
                pagedRows.map((r) => {
                  const d = deriveBuy(r)
                  return (
                    <tr
                      key={buyKey(r)}
                      className="odd:bg-white even:bg-slate-50/70 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700/40 dark:hover:bg-slate-700/70 transition-colors duration-150"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">{d.date}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.serial}</td>
                      <td className="px-3 py-2">{d.customer}</td>
                      <td className="px-3 py-2">{d.species}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.branch}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.klang}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{d.entry.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{d.exit.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-amber-700 dark:text-amber-400">
                        {d.deduct > 0 ? d.deduct.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{d.net.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{baht(d.pricePerKg)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{thb(d.price)}</td>
                    </tr>
                  )
                })
              ) : (
                pagedRows.map((r) => {
                  const d = deriveSell(r)
                  return (
                    <tr
                      key={sellKey(r)}
                      className="odd:bg-white even:bg-slate-50/70 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700/40 dark:hover:bg-slate-700/70 transition-colors duration-150"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">{d.date}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.saleId}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.serial}</td>
                      <td className="px-3 py-2">{d.customer}</td>
                      <td className="px-3 py-2">{d.species}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.branch}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.klang}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{d.net.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{baht(d.pricePerKg)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{thb(d.price)}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">{d.sub ?? "-"}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* Pagination Bar */}
          <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              แสดง <b>{rows.length ? startIndex.toLocaleString() : 0}</b>
              –<b>{rows.length ? endIndex.toLocaleString() : 0}</b> จาก <b>{rows.length.toLocaleString()}</b> รายการ
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={prevPage}
                disabled={page <= 1}
                className={cx(
                  "h-10 rounded-xl px-4 text-sm font-medium",
                  page <= 1
                    ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600",
                  "border border-slate-300 dark:border-slate-600"
                )}
              >
                ก่อนหน้า
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {pageItems.map((it, idx) =>
                  it === "..." ? (
                    <span key={`dots-${idx}`} className="px-2 text-slate-500 dark:text-slate-300">…</span>
                  ) : (
                    <button
                      key={`p-${it}`}
                      type="button"
                      onClick={() => goToPage(it)}
                      aria-current={it === page ? "page" : undefined}
                      className={cx(
                        "h-10 min-w-[40px] rounded-xl px-3 text-sm font-semibold transition",
                        it === page ? PAGE_BTN_ACTIVE : PAGE_BTN_IDLE,
                        "border border-slate-300 dark:border-slate-600"
                      )}
                    >
                      {it}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={nextPage}
                disabled={page >= totalPages}
                className={cx(
                  "h-10 rounded-xl px-4 text-sm font-medium",
                  page >= totalPages
                    ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600",
                  "border border-slate-300 dark:border-slate-600"
                )}
              >
                ถัดไป
              </button>

              {/* Jump to page */}
              <div className="ml-2 flex items-center gap-2">
                <label className="text-sm text-slate-600 dark:text-slate-300" htmlFor="order-jump">ไปหน้า</label>
                <input
                  id="order-jump"
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(onlyDigits(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && onCommitPageInput()}
                  onBlur={onCommitPageInput}
                  className="h-10 w-20 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none
                             focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30
                             dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">/ {totalPages.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

export default Order
