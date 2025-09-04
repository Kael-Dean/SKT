import { useEffect, useMemo, useRef, useState } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const kg = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? n : 0)

/** ---------- Auth header ---------- */
const authHeader = () => {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/** ---------- Base field style ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

/** ---------- Reusable ComboBox (เหมือนหน้าอื่น ๆ) ---------- */
function ComboBox({
  options = [],
  value,
  onChange, // (id, optionObj) => void
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.id ?? o?.value ?? "",
  disabled = false,
  error = false,
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const btnRef = useRef(null)

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => String(getValue(o)) === String(value))
    return found ? getLabel(found) : ""
  }, [options, value, getLabel, getValue])

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) {
        setOpen(false)
        setHighlight(-1)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const commit = (opt) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    requestAnimationFrame(() => btnRef.current?.focus())
  }

  const scrollHighlightedIntoView = (index) => {
    const listEl = listRef.current
    const itemEl = listEl?.children?.[index]
    if (!listEl || !itemEl) return
    const itemRect = itemEl.getBoundingClientRect()
    const listRect = listEl.getBoundingClientRect()
    const buffer = 6
    if (itemRect.top < listRect.top + buffer) {
      listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
    } else if (itemRect.bottom > listRect.bottom - buffer) {
      listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
    }
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => (h >= 0 ? h : 0))
      return
    }
    if (!open) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => {
        const next = h < options.length - 1 ? h + 1 : 0
        requestAnimationFrame(() => scrollHighlightedIntoView(next))
        return next
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => {
        const prev = h > 0 ? h - 1 : options.length - 1
        requestAnimationFrame(() => scrollHighlightedIntoView(prev))
        return prev
      })
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlight >= 0 && highlight < options.length) commit(options[highlight])
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setHighlight(-1)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        ref={btnRef}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={[
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error
            ? "border-red-400 ring-2 ring-red-300/70"
            : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "text-black placeholder:text-slate-500",
          "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:hover:bg-slate-700/70 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedLabel || <span className="text-slate-500 dark:text-white/70">{placeholder}</span>}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>
          )}
          {options.map((opt, idx) => {
            const label = getLabel(opt)
            const isActive = idx === highlight
            const isChosen = String(getValue(opt)) === String(value)
            return (
              <button
                key={String(getValue(opt)) || label || idx}
                type="button"
                role="option"
                aria-selected={isChosen}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(opt)}
                className={[
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30",
                ].join(" ")}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                )}
                <span className="flex-1">{label}</span>
                {isChosen && <span className="text-emerald-600 dark:text-emerald-300">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** ---------- Collapsible item ---------- */
function Collapse({ title, right, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between bg-slate-50 px-3 py-2 text-left hover:bg-emerald-50/60 dark:bg-slate-800 dark:hover:bg-slate-700/60"
      >
        <div className="flex items-center gap-2">
          <span
            className={[
              "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs",
              "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:bg-emerald-900/30",
            ].join(" ")}
          >
            {open ? "−" : "+"}
          </span>
          <span className="font-medium">{title}</span>
        </div>
        {right}
      </button>
      {open && <div className="bg-white dark:bg-slate-900/40">{children}</div>}
    </div>
  )
}

/** ---------- Stock Page ---------- */
const Stock = () => {
  // options
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])
  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])
  const [subriceOptions, setSubriceOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [conditionOptions, setConditionOptions] = useState([])

  // filters
  const [filters, setFilters] = useState({
    branchId: "",
    klangId: "",
    productId: "",

    riceId: "",
    subriceId: "",
    yearId: "",
    conditionId: "",

    detail: "rice_subrice_year_condition", // default ให้ลึกสุด
  })

  // data
  const [tree, setTree] = useState([]) // payload from /stock/tree
  const [loading, setLoading] = useState(false)

  /** ---------- Load static dropdowns ---------- */
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [b, p, y, c] = await Promise.all([
          fetch(`${API_BASE}/order/branch/search`, { headers: authHeader() }),
          fetch(`${API_BASE}/order/product/search`, { headers: authHeader() }),
          fetch(`${API_BASE}/order/year/search`, { headers: authHeader() }),
          fetch(`${API_BASE}/order/condition/search`, { headers: authHeader() }),
        ])

        const branches = (b.ok ? await b.json() : []).map((x) => ({ id: String(x.id), label: x.branch_name }))
        const products = (p.ok ? await p.json() : []).map((x) => ({ id: String(x.id), label: x.product_type }))
        const years = (y.ok ? await y.json() : []).map((x) => ({ id: String(x.id), label: String(x.year) }))
        const conds = (c.ok ? await c.json() : []).map((x) => ({
          id: String(x.id),
          label: String(x.condition ?? x.label ?? ""),
        }))

        setBranchOptions(branches)
        setProductOptions(products)
        setYearOptions(years)
        setConditionOptions(conds)
      } catch (e) {
        console.error("load initial options failed:", e)
      }
    }
    loadInitial()
  }, [])

  /** ---------- Load Klang by branch ---------- */
  useEffect(() => {
    const loadKlang = async () => {
      if (!filters.branchId) {
        setKlangOptions([])
        setFilters((p) => ({ ...p, klangId: "" }))
        return
      }
      try {
        const r = await fetch(`${API_BASE}/order/klang/search?branch_id=${filters.branchId}`, {
          headers: authHeader(),
        })
        const data = r.ok ? await r.json() : []
        setKlangOptions((Array.isArray(data) ? data : []).map((x) => ({ id: String(x.id), label: x.klang_name })))
      } catch (e) {
        console.error("load klang failed:", e)
        setKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.branchId])

  /** ---------- Load Rice by product ---------- */
  useEffect(() => {
    const loadRice = async () => {
      if (!filters.productId) {
        setRiceOptions([])
        setFilters((p) => ({ ...p, riceId: "", subriceId: "" }))
        return
      }
      try {
        const r = await fetch(`${API_BASE}/order/rice/search?product_id=${filters.productId}`, { headers: authHeader() })
        const data = r.ok ? await r.json() : []
        const mapped = (Array.isArray(data) ? data : [])
          .map((x) => ({ id: String(x.id), label: String(x.rice_type ?? "").trim() }))
          .filter((o) => o.id && o.label)
        setRiceOptions(mapped)
      } catch (e) {
        console.error("load rice failed:", e)
        setRiceOptions([])
      }
    }
    loadRice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.productId])

  /** ---------- Load Subrice by rice ---------- */
  useEffect(() => {
    const loadSubrice = async () => {
      if (!filters.riceId) {
        setSubriceOptions([])
        setFilters((p) => ({ ...p, subriceId: "" }))
        return
      }
      try {
        const r = await fetch(`${API_BASE}/order/sub-rice/search?rice_id=${filters.riceId}`, { headers: authHeader() })
        const data = r.ok ? await r.json() : []
        const mapped = (Array.isArray(data) ? data : [])
          .map((x) => ({ id: String(x.id), label: String(x.sub_class ?? "").trim() }))
          .filter((o) => o.id && o.label)
        setSubriceOptions(mapped)
      } catch (e) {
        console.error("load subrice failed:", e)
        setSubriceOptions([])
      }
    }
    loadSubrice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.riceId])

  /** ---------- Fetch stock tree ---------- */
  const fetchTree = async () => {
    if (!filters.productId || !filters.branchId) {
      setTree([])
      return
    }
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("product_id", filters.productId)
      params.set("branch_id", filters.branchId)
      if (filters.klangId) params.set("klang_id", filters.klangId)
      if (filters.riceId) params.set("rice_id", filters.riceId)
      if (filters.subriceId) params.set("subrice_id", filters.subriceId)
      if (filters.yearId) params.set("year_id", filters.yearId)
      if (filters.conditionId) params.set("condition_id", filters.conditionId)
      if (filters.detail) params.set("detail", filters.detail)

      const r = await fetch(`${API_BASE}/stock/tree?${params.toString()}`, { headers: authHeader() })
      const data = r.ok ? await r.json() : []
      setTree(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setTree([])
    } finally {
      setLoading(false)
    }
  }

  // auto fetch when required fields change
  useEffect(() => {
    fetchTree()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.productId, filters.branchId, filters.klangId, filters.riceId, filters.subriceId, filters.yearId, filters.conditionId, filters.detail])

  /** ---------- Totals ---------- */
  const grandTotalKg = useMemo(() => {
    // รองรับทั้งโครงสร้าง 3 แบบ โดย sum ที่ "total" ถ้าไม่มีให้ sum ที่ "available"
    const sumNode = (node) => {
      if (!node) return 0
      if (typeof node.total === "number") return toNumber(node.total)
      if (typeof node.available === "number") return toNumber(node.available)
      return 0
    }
    let total = 0
    tree.forEach((rice) => {
      total += sumNode(rice)
    })
    return total
  }, [tree])

  const disabledFetch = !filters.productId || !filters.branchId

  /** ----------- UI ----------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">🏷️ คลังสินค้า</h1>

        {/* Filters */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="grid gap-3 md:grid-cols-6">
            {/* Branch */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขา</label>
              <ComboBox
                options={branchOptions}
                value={filters.branchId}
                onChange={(id) =>
                  setFilters((p) => ({ ...p, branchId: id || "", klangId: "" }))
                }
                placeholder="— เลือกสาขา —"
              />
            </div>
            {/* Klang */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">คลัง</label>
              <ComboBox
                options={klangOptions}
                value={filters.klangId}
                onChange={(id) => setFilters((p) => ({ ...p, klangId: id || "" }))}
                placeholder="— เลือกคลัง —"
                disabled={!filters.branchId}
              />
            </div>
            {/* Product */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สินค้า (Product)</label>
              <ComboBox
                options={productOptions}
                value={filters.productId}
                onChange={(id) => setFilters((p) => ({ ...p, productId: id || "", riceId: "", subriceId: "" }))}
                placeholder="— เลือกสินค้า —"
              />
            </div>
            {/* Rice */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ประเภทข้าว</label>
              <ComboBox
                options={riceOptions}
                value={filters.riceId}
                onChange={(id) => setFilters((p) => ({ ...p, riceId: id || "", subriceId: "" }))}
                placeholder="— เลือกประเภทข้าว —"
                disabled={!filters.productId}
              />
            </div>
            {/* Subrice */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ชนิดย่อย</label>
              <ComboBox
                options={subriceOptions}
                value={filters.subriceId}
                onChange={(id) => setFilters((p) => ({ ...p, subriceId: id || "" }))}
                placeholder="— เลือกชนิดย่อย —"
                disabled={!filters.riceId}
              />
            </div>
            {/* Year */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ฤดูกาล/ปี</label>
              <ComboBox
                options={yearOptions}
                value={filters.yearId}
                onChange={(id) => setFilters((p) => ({ ...p, yearId: id || "" }))}
                placeholder="— เลือกปี —"
              />
            </div>
            {/* Condition */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สภาพ (Condition)</label>
              <ComboBox
                options={conditionOptions}
                value={filters.conditionId}
                onChange={(id) => setFilters((p) => ({ ...p, conditionId: id || "" }))}
                placeholder="— เลือกสภาพ —"
              />
            </div>
            {/* Detail */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ระดับรายละเอียด</label>
              <select
                className={baseField}
                value={filters.detail}
                onChange={(e) => setFilters((p) => ({ ...p, detail: e.target.value }))}
              >
                <option value="rice_subrice">ข้าว ➜ ชนิดย่อย</option>
                <option value="rice_subrice_year">ข้าว ➜ ชนิดย่อย ➜ ปี</option>
                <option value="rice_subrice_year_condition">ข้าว ➜ ชนิดย่อย ➜ ปี ➜ สภาพ</option>
              </select>
            </div>

            <div className="flex items-end gap-2 md:col-span-2">
              <button
                onClick={fetchTree}
                type="button"
                disabled={disabledFetch}
                className={[
                  "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold text-white shadow-[0_6px_16px_rgba(16,185,129,0.35)] transition-all duration-300",
                  disabledFetch
                    ? "bg-emerald-400/60 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)] hover:scale-[1.03] active:scale-[.98]",
                ].join(" ")}
              >
                แสดงสต๊อก
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters({
                    branchId: "",
                    klangId: "",
                    productId: "",
                    riceId: "",
                    subriceId: "",
                    yearId: "",
                    conditionId: "",
                    detail: "rice_subrice_year_condition",
                  })
                  setKlangOptions([])
                  setRiceOptions([])
                  setSubriceOptions([])
                  setTree([])
                }}
                className="inline-flex items-center justify-center rounded-2xl 
                           border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
                           shadow-sm hover:bg-slate-100 hover:shadow-md hover:scale-[1.02] active:scale-[.98]
                           dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/50"
              >
                รีเซ็ต
              </button>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">จำนวนกลุ่มข้าว (ระดับบนสุด)</div>
            <div className="text-2xl font-semibold">{tree.length.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">น้ำหนักคงเหลือรวม (กก.)</div>
            <div className="text-2xl font-semibold">{kg(toNumber(grandTotalKg))}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">ระดับรายละเอียด</div>
            <div className="text-2xl font-semibold">
              {filters.detail === "rice_subrice"
                ? "ข้าว > ชนิดย่อย"
                : filters.detail === "rice_subrice_year"
                ? "ข้าว > ชนิดย่อย > ปี"
                : "ข้าว > ชนิดย่อย > ปี > สภาพ"}
            </div>
          </div>
        </div>

        {/* Tree */}
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 p-6 dark:border-slate-700">
              กำลังโหลดสต๊อก...
            </div>
          ) : tree.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 p-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              {!filters.productId || !filters.branchId
                ? "กรุณาเลือกสินค้าและสาขา เพื่อแสดงสต๊อก"
                : "ไม่พบข้อมูลสต๊อกตามตัวกรองที่เลือก"}
            </div>
          ) : (
            tree.map((rice) => {
              const riceTitle = `${rice.rice_type ?? "ไม่ระบุ"} • รวม ${kg(toNumber(rice.total ?? rice.available))} กก.`
              return (
                <Collapse
                  key={`rice-${rice.rice_id}`}
                  title={riceTitle}
                  right={<span className="text-sm text-slate-500 dark:text-slate-400 pr-2">rice_id: {rice.rice_id ?? "-"}</span>}
                  defaultOpen={true}
                >
                  {/* Subrice level */}
                  <div className="p-2 md:p-3 space-y-2">
                    {(rice.items ?? []).map((sub) => {
                      const subTitle = `${sub.sub_class ?? "—"} • รวม ${kg(toNumber(sub.total ?? sub.available))} กก.`
                      return (
                        <Collapse
                          key={`sub-${rice.rice_id}-${sub.subrice_id}`}
                          title={subTitle}
                          right={
                            <span className="text-sm text-slate-500 dark:text-slate-400 pr-2">
                              subrice_id: {sub.subrice_id ?? "-"}
                            </span>
                          }
                          defaultOpen={false}
                        >
                          {/* Next levels depend on detail */}
                          <div className="p-2 md:p-3 space-y-2">
                            {filters.detail === "rice_subrice" ? (
                              <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                                ไม่มีระดับถัดไป (หยุดที่ชนิดย่อย)
                              </div>
                            ) : (
                              (sub.items ?? []).map((year) => {
                                const yTitle =
                                  filters.detail === "rice_subrice_year"
                                    ? `ปี ${year.year ?? "—"} • เหลือ ${kg(toNumber(year.available))} กก.`
                                    : `ปี ${year.year ?? "—"} • รวม ${kg(toNumber(year.total ?? year.available))} กก.`
                                return (
                                  <Collapse
                                    key={`year-${rice.rice_id}-${sub.subrice_id}-${year.year_id}`}
                                    title={yTitle}
                                    right={
                                      <span className="text-sm text-slate-500 dark:text-slate-400 pr-2">
                                        year_id: {year.year_id ?? "-"}
                                      </span>
                                    }
                                    defaultOpen={false}
                                  >
                                    {filters.detail === "rice_subrice_year" ? (
                                      <div className="p-3 text-sm text-slate-600 dark:text-slate-300">
                                        ไม่แยกสภาพ (condition) ในระดับนี้
                                      </div>
                                    ) : (
                                      <div className="p-2 md:p-3">
                                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                          <table className="min-w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800">
                                              <tr>
                                                <th className="px-3 py-2 text-left">สภาพ</th>
                                                <th className="px-3 py-2 text-right">คงเหลือ (กก.)</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(year.items ?? []).map((cond) => (
                                                <tr
                                                  key={`cond-${cond.condition_id}`}
                                                  className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/70"
                                                >
                                                  <td className="px-3 py-2">{cond.condition ?? "—"}</td>
                                                  <td className="px-3 py-2 text-right">
                                                    {kg(toNumber(cond.available))}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </Collapse>
                                )
                              })
                            )}
                          </div>
                        </Collapse>
                      )
                    })}
                  </div>
                </Collapse>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default Stock
