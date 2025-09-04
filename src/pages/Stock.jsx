import { useEffect, useMemo, useRef, useState } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const kg = (n) => (isFinite(n) ? Number(n) : 0)
const fmtKg = (n) => (kg(n).toLocaleString(undefined, { maximumFractionDigits: 2 }))

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

/** ---------- Reusable ComboBox ---------- */
function ComboBox({
  options = [],
  value,
  onChange, // (newValue, optionObj) => void
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

  const selectedLabel = (() => {
    const found = options.find((o) => String(getValue(o)) === String(value))
    return found ? getLabel(found) : ""
  })()

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
            const val = String(getValue(opt))
            const isActive = idx === highlight
            const isChosen = String(value) === val
            return (
              <button
                key={val || label || idx}
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

/** ---------- Stock Page ---------- */
const Stock = () => {
  /** ---------- Options ---------- */
  const [branchOptions, setBranchOptions] = useState([])    // [{id,label}]
  const [klangOptions, setKlangOptions] = useState([])      // [{id,label}]
  const [productOptions, setProductOptions] = useState([])  // [{id,label}]
  const [riceOptions, setRiceOptions] = useState([])        // [{id,label}]
  const [subriceOptions, setSubriceOptions] = useState([])  // [{id,label}]
  const [yearOptions, setYearOptions] = useState([])        // [{id,label}]
  const [condOptions, setCondOptions] = useState([])        // [{id,label}]

  /** ---------- Filters ---------- */
  const [filters, setFilters] = useState({
    productId: "",
    branchId: "",
    klangId: "",
    riceId: "",
    subriceId: "",
    yearId: "",
    conditionId: "",
    detail: "rice_subrice_year_condition", // "rice_subrice" | "rice_subrice_year" | "rice_subrice_year_condition"
  })

  /** ---------- Data ---------- */
  const [loading, setLoading] = useState(false)
  const [tree, setTree] = useState([]) // [{ rice_id, rice_type, total, items: [...] }]

  /** ---------- Load static options ---------- */
  useEffect(() => {
    const loadOpts = async () => {
      try {
        const [b, p, y, c] = await Promise.all([
          fetch(`${API_BASE}/order/branch/search`, { headers: authHeader() }),
          fetch(`${API_BASE}/order/product/search`, { headers: authHeader() }),
          fetch(`${API_BASE}/order/year/search`, { headers: authHeader() }),
          fetch(`${API_BASE}/order/condition/search`, { headers: authHeader() }),
        ])
        const branches = (b.ok ? await b.json() : []).map((x) => ({ id: String(x.id), label: x.branch_name }))
        const products = (p.ok ? await p.json() : []).map((x) => ({ id: String(x.id), label: x.product_type }))
        const years    = (y.ok ? await y.json() : []).map((x) => ({ id: String(x.id), label: String(x.year) }))
        const conds    = (c.ok ? await c.json() : []).map((x) => ({ id: String(x.id), label: String(x.year ?? x.condition) }))

        setBranchOptions(branches)
        setProductOptions(products)
        setYearOptions(years)
        setCondOptions(conds)
      } catch (err) {
        console.error("load options failed:", err)
      }
    }
    loadOpts()
  }, [])

  /** ---------- Dependent options ---------- */
  // Klang by branch
  useEffect(() => {
    const run = async () => {
      setKlangOptions([])
      setFilters((p) => ({ ...p, klangId: "" }))
      if (!filters.branchId) return
      try {
        const r = await fetch(`${API_BASE}/order/klang/search?branch_id=${filters.branchId}`, { headers: authHeader() })
        const data = r.ok ? await r.json() : []
        setKlangOptions((Array.isArray(data) ? data : []).map((x) => ({ id: String(x.id), label: x.klang_name })))
      } catch (e) {
        console.error("load klang failed:", e)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.branchId])

  // Rice by product
  useEffect(() => {
    const run = async () => {
      setRiceOptions([])
      setSubriceOptions([])
      setFilters((p) => ({ ...p, riceId: "", subriceId: "" }))
      if (!filters.productId) return
      try {
        const r = await fetch(`${API_BASE}/order/rice/search?product_id=${filters.productId}`, { headers: authHeader() })
        const data = r.ok ? await r.json() : []
        const mapped = (Array.isArray(data) ? data : []).map((x) => ({
          id: String(x.id),
          label: String(x.rice_type ?? "").trim(),
        })).filter((o) => o.id && o.label)
        setRiceOptions(mapped)
      } catch (e) {
        console.error("load rice failed:", e)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.productId])

  // Sub-rice by rice
  useEffect(() => {
    const run = async () => {
      setSubriceOptions([])
      setFilters((p) => ({ ...p, subriceId: "" }))
      if (!filters.riceId) return
      try {
        const r = await fetch(`${API_BASE}/order/sub-rice/search?rice_id=${filters.riceId}`, { headers: authHeader() })
        const data = r.ok ? await r.json() : []
        const mapped = (Array.isArray(data) ? data : []).map((x) => ({
          id: String(x.id),
          label: String(x.sub_class ?? "").trim(),
        })).filter((o) => o.id && o.label)
        setSubriceOptions(mapped)
      } catch (e) {
        console.error("load subrice failed:", e)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.riceId])

  /** ---------- Fetch tree ---------- */
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
      params.set("detail", filters.detail)

      if (filters.klangId)     params.set("klang_id", filters.klangId)
      if (filters.riceId)      params.set("rice_id", filters.riceId)
      if (filters.subriceId)   params.set("subrice_id", filters.subriceId)
      if (filters.yearId)      params.set("year_id", filters.yearId)
      if (filters.conditionId) params.set("condition_id", filters.conditionId)

      const r = await fetch(`${API_BASE}/order/stock/tree?${params.toString()}`, { headers: authHeader() })
      const data = r.ok ? await r.json() : []
      setTree(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("fetch tree failed:", e)
      setTree([])
    } finally {
      setLoading(false)
    }
  }

  /** ---------- Totals ---------- */
  const grandTotal = useMemo(() => {
    return tree.reduce((acc, r) => acc + kg(r.total ?? 0), 0)
  }, [tree])

  /** ---------- Expand/Collapse ---------- */
  const [openKeys, setOpenKeys] = useState(() => new Set())
  const keyOf = (...parts) => parts.map((p) => (p ?? "null")).join("|")

  const toggleKey = (k) => {
    setOpenKeys((s) => {
      const next = new Set(s)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const expandAll = () => {
    const allKeys = new Set()
    tree.forEach((rice) => {
      const rKey = keyOf("r", rice.rice_id)
      allKeys.add(rKey)
      rice.items?.forEach((sub) => {
        const sKey = keyOf("s", rice.rice_id, sub.subrice_id)
        allKeys.add(sKey)
        sub.items?.forEach((yr) => {
          const yKey = keyOf("y", rice.rice_id, sub.subrice_id, yr.year_id)
          allKeys.add(yKey)
        })
      })
    })
    setOpenKeys(allKeys)
  }

  const collapseAll = () => setOpenKeys(new Set())

  /** ---------- Reset ---------- */
  const resetFilters = () => {
    setFilters({
      productId: "",
      branchId: "",
      klangId: "",
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
    setOpenKeys(new Set())
  }

  /** ---------- Auto-fetch when product & branch chosen ---------- */
  useEffect(() => {
    if (filters.productId && filters.branchId) {
      fetchTree()
    } else {
      setTree([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.productId, filters.branchId, filters.detail])

  /** ---------- UI helpers ---------- */
  const Label = ({ text }) => (
    <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-100">
      {text || "—"}
    </span>
  )

  /** ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          🏷️ คลังสินค้า (Stock)
        </h1>

        {/* Filters */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="grid gap-3 md:grid-cols-6">
            {/* Branch */}
            <div>
              <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">สาขา (จำเป็น)</div>
              <ComboBox
                options={branchOptions}
                value={filters.branchId}
                getValue={(o) => o.id}
                onChange={(id) => setFilters((p) => ({ ...p, branchId: id || "", klangId: "" }))}
                placeholder="— เลือกสาขา —"
              />
            </div>
            {/* Klang */}
            <div>
              <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">คลัง (ถ้ามี)</div>
              <ComboBox
                options={klangOptions}
                value={filters.klangId}
                getValue={(o) => o.id}
                onChange={(id) => setFilters((p) => ({ ...p, klangId: id || "" }))}
                placeholder="— เลือกคลัง —"
                disabled={!filters.branchId}
              />
            </div>
            {/* Product */}
            <div>
              <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">สินค้า (จำเป็น)</div>
              <ComboBox
                options={productOptions}
                value={filters.productId}
                getValue={(o) => o.id}
                onChange={(id) => setFilters((p) => ({ ...p, productId: id || "", riceId: "", subriceId: "" }))}
                placeholder="— เลือกสินค้า —"
              />
            </div>
            {/* Rice */}
            <div>
              <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">ประเภทข้าว</div>
              <ComboBox
                options={riceOptions}
                value={filters.riceId}
                getValue={(o) => o.id}
                onChange={(id) => setFilters((p) => ({ ...p, riceId: id || "", subriceId: "" }))}
                placeholder="— เลือกประเภทข้าว —"
                disabled={!filters.productId}
              />
            </div>
            {/* Subrice */}
            <div>
              <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">ชนิดย่อย</div>
              <ComboBox
                options={subriceOptions}
                value={filters.subriceId}
                getValue={(o) => o.id}
                onChange={(id) => setFilters((p) => ({ ...p, subriceId: id || "" }))}
                placeholder="— เลือกชนิดย่อย —"
                disabled={!filters.riceId}
              />
            </div>
            {/* Year */}
            <div>
              <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">ฤดูกาล/ปี</div>
              <ComboBox
                options={yearOptions}
                value={filters.yearId}
                getValue={(o) => o.id}
                onChange={(id) => setFilters((p) => ({ ...p, yearId: id || "" }))}
                placeholder="— เลือกปี —"
              />
            </div>
            {/* Condition */}
            <div>
              <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">สภาพ</div>
              <ComboBox
                options={condOptions}
                value={filters.conditionId}
                getValue={(o) => o.id}
                onChange={(id) => setFilters((p) => ({ ...p, conditionId: id || "" }))}
                placeholder="— เลือกสภาพ —"
              />
            </div>
            {/* Detail level */}
            <div>
              <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">ระดับรายละเอียด</div>
              <ComboBox
                options={[
                  { id: "rice_subrice", label: "ข้าว → ชนิดย่อย" },
                  { id: "rice_subrice_year", label: "ข้าว → ชนิดย่อย → ปี" },
                  { id: "rice_subrice_year_condition", label: "ข้าว → ชนิดย่อย → ปี → สภาพ" },
                ]}
                value={filters.detail}
                getValue={(o) => o.id}
                onChange={(id) => setFilters((p) => ({ ...p, detail: id || "rice_subrice_year_condition" }))}
              />
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2 md:col-span-6">
              <button
                onClick={fetchTree}
                type="button"
                className="inline-flex items-center justify-center rounded-2xl 
                           bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                           shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                           transition-all duration-300 ease-out
                           hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                           hover:scale-[1.05] active:scale-[.97] cursor-pointer disabled:opacity-60"
                disabled={!filters.productId || !filters.branchId}
                aria-busy={loading ? "true" : "false"}
              >
                {loading ? "กำลังดึงข้อมูล..." : "ค้นหา"}
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center rounded-2xl 
                           border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
                           shadow-sm
                           transition-all duration-300 ease-out
                           hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                           active:scale-[.97]
                           dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
                           dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
              >
                รีเซ็ต
              </button>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700/60"
                >
                  กางทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700/60"
                >
                  พับทั้งหมด
                </button>
              </div>
            </div>
          </div>

          {/* Hints */}
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            ต้องเลือก <b>สาขา</b> และ <b>สินค้า</b> อย่างน้อย จากนั้นเลือกตัวกรองอื่น ๆ ได้ตามต้องการ
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">จำนวนประเภทข้าว (ระดับบนสุด)</div>
            <div className="text-2xl font-semibold">{tree.length.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">น้ำหนักรวม (กก.)</div>
            <div className="text-2xl font-semibold">{fmtKg(grandTotal)}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">ระดับรายละเอียด</div>
            <div className="text-2xl font-semibold">
              {filters.detail === "rice_subrice"
                ? "ข้าว → ชนิดย่อย"
                : filters.detail === "rice_subrice_year"
                ? "ข้าว → ชนิดย่อย → ปี"
                : "ข้าว → ชนิดย่อย → ปี → สภาพ"}
            </div>
          </div>
        </div>

        {/* Tree table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              <tr>
                <th className="px-3 py-2 w-[44px]"></th>
                <th className="px-3 py-2">ระดับ</th>
                <th className="px-3 py-2">ชื่อ</th>
                <th className="px-3 py-2 text-right">คงเหลือ (กก.)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-3" colSpan={4}>กำลังโหลด...</td></tr>
              ) : !filters.productId || !filters.branchId ? (
                <tr><td className="px-3 py-3" colSpan={4}>โปรดเลือก <b>สินค้า</b> และ <b>สาขา</b> ก่อน</td></tr>
              ) : tree.length === 0 ? (
                <tr><td className="px-3 py-3" colSpan={4}>ไม่พบบันทึกคลังตามเงื่อนไข</td></tr>
              ) : (
                tree.map((r) => {
                  const rKey = keyOf("r", r.rice_id)
                  const rOpen = openKeys.has(rKey)
                  return (
                    <>
                      <tr key={rKey} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-800 dark:even:bg-slate-700">
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                            onClick={() => toggleKey(rKey)}
                            aria-label={rOpen ? "ยุบ" : "ขยาย"}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              {rOpen ? (
                                <path d="M7 14l5-5 5 5H7z" />
                              ) : (
                                <path d="M7 10l5 5 5-5H7z" />
                              )}
                            </svg>
                          </button>
                        </td>
                        <td className="px-3 py-2"><Label text="ข้าว" /></td>
                        <td className="px-3 py-2 font-medium">{r.rice_type || "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmtKg(r.total)}</td>
                      </tr>

                      {/* Subrice level */}
                      {rOpen && (r.items || []).map((s) => {
                        const sKey = keyOf("s", r.rice_id, s.subrice_id)
                        const sOpen = openKeys.has(sKey)
                        return (
                          <>
                            <tr key={sKey} className="bg-white/70 dark:bg-slate-800/70">
                              <td className="px-3 py-2 pl-8">
                                {filters.detail !== "rice_subrice" && (
                                  <button
                                    type="button"
                                    className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() => toggleKey(sKey)}
                                    aria-label={sOpen ? "ยุบ" : "ขยาย"}
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                      {sOpen ? (
                                        <path d="M7 14l5-5 5 5H7z" />
                                      ) : (
                                        <path d="M7 10l5 5 5-5H7z" />
                                      )}
                                    </svg>
                                  </button>
                                )}
                              </td>
                              <td className="px-3 py-2"><Label text="ชนิดย่อย" /></td>
                              <td className="px-3 py-2">{s.sub_class || "—"}</td>
                              <td className="px-3 py-2 text-right">{fmtKg(s.total)}</td>
                            </tr>

                            {/* Year level */}
                            {sOpen && filters.detail !== "rice_subrice" && (s.items || []).map((y) => {
                              const yKey = keyOf("y", r.rice_id, s.subrice_id, y.year_id)
                              const yOpen = openKeys.has(yKey)
                              const yTotal = (filters.detail === "rice_subrice_year") ? y.available : y.total
                              return (
                                <>
                                  <tr key={yKey} className="bg-white/50 dark:bg-slate-800/50">
                                    <td className="px-3 py-2 pl-12">
                                      {filters.detail === "rice_subrice_year_condition" && (
                                        <button
                                          type="button"
                                          className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                                          onClick={() => toggleKey(yKey)}
                                          aria-label={yOpen ? "ยุบ" : "ขยาย"}
                                        >
                                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            {yOpen ? (
                                              <path d="M7 14l5-5 5 5H7z" />
                                            ) : (
                                              <path d="M7 10l5 5 5-5H7z" />
                                            )}
                                          </svg>
                                        </button>
                                      )}
                                    </td>
                                    <td className="px-3 py-2"><Label text="ปี" /></td>
                                    <td className="px-3 py-2">{y.year ?? "—"}</td>
                                    <td className="px-3 py-2 text-right">{fmtKg(yTotal)}</td>
                                  </tr>

                                  {/* Condition level */}
                                  {yOpen && filters.detail === "rice_subrice_year_condition" && (y.items || []).map((c) => {
                                    const cKey = keyOf("c", r.rice_id, s.subrice_id, y.year_id, c.condition_id)
                                    return (
                                      <tr key={cKey} className="bg-white/30 dark:bg-slate-800/30">
                                        <td className="px-3 py-2 pl-16"></td>
                                        <td className="px-3 py-2"><Label text="สภาพ" /></td>
                                        <td className="px-3 py-2">{c.condition ?? "—"}</td>
                                        <td className="px-3 py-2 text-right">{fmtKg(c.available)}</td>
                                      </tr>
                                    )
                                  })}
                                </>
                              )
                            })}
                          </>
                        )
                      })}
                    </>
                  )
                })
              )}
            </tbody>
            {/* Grand total footer */}
            {!loading && tree.length > 0 && (
              <tfoot className="bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                <tr>
                  <td className="px-3 py-2" colSpan={3}><b>รวมทั้งหมด</b></td>
                  <td className="px-3 py-2 text-right font-bold">{fmtKg(grandTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

export default Stock
