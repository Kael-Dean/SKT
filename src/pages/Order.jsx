// src/pages/Order.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth } from "../lib/api"  // ✅ helper รวม token/BASE URL

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
const cx = (...a) => a.filter(Boolean).join(" ")

/// ---------- Base field style ----------
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

/** ---------- Reusable ComboBox (เหมือนหน้า Buy: รองรับ subLabel) ---------- */
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  getSubLabel = (o) => o?.subLabel ?? "",
  disabled = false,
  error = false,
  buttonRef = null,
  hintRed = false,
  clearHint = () => {},
  onEnterNext,
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const internalBtnRef = useRef(null)
  const controlRef = buttonRef || internalBtnRef

  const selectedObj = useMemo(
    () => options.find((o) => String(getValue(o)) === String(value)),
    [options, value, getValue]
  )
  const selectedLabel = selectedObj ? getLabel(selectedObj) : ""
  const selectedSubLabel = selectedObj ? (getSubLabel(selectedObj) || "") : ""

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
    clearHint?.()
    requestAnimationFrame(() => {
      controlRef.current?.focus()
      onEnterNext?.()
    })
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
      clearHint?.()
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
        ref={controlRef}
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen((o) => !o); clearHint?.() } }}
        onKeyDown={onKeyDown}
        onFocus={() => clearHint?.() }
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error
            ? "border-red-400 ring-2 ring-red-300/70"
            : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700/80",
          hintRed && "ring-2 ring-red-300 animate-pulse"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error || hintRed ? true : undefined}
      >
        {selectedLabel ? (
          <div className="flex flex-col">
            <span>{selectedLabel}</span>
            {selectedSubLabel && (
              <span className="text-[13px] text-slate-600 dark:text-slate-300">{selectedSubLabel}</span>
            )}
          </div>
        ) : (
          <span className="text-slate-500 dark:text-white/70">{placeholder}</span>
        )}
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
            const sub = getSubLabel(opt) || ""
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
                className={cx(
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                )}
                <span className="flex-1">
                  <div className="">{label}</div>
                  {sub && <div className="text-sm text-slate-600 dark:text-slate-300">{sub}</div>}
                </span>
                {isChosen && <span className="text-emerald-600 dark:text-emerald-300">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** ---------- DateInput (รองรับ error) ---------- */
const DateInput = forwardRef(function DateInput({ error = false, className = "", ...props }, ref) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input
        type="date"
        ref={inputRef}
        className={cx(baseField, "pr-12 cursor-pointer", error && "border-red-400 ring-2 ring-red-300/70", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          const el = inputRef.current
          if (!el) return
          if (typeof el.showPicker === "function") el.showPicker()
          else { el.focus(); el.click?.() }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
                   transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- Page: Order ---------- */
const PAGE_SIZE = 100

const Order = () => {
  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  /** ---------- State ---------- */
  const [mode, setMode] = useState("buy") // 'buy' | 'sell'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

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

  // filters
  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,

    branchId: "", branchName: "",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            label: String(r.prod_name || r.name || r.spec_name || `spec #${r.id}`).trim(),
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
    const vLabel = vid ? (variantLookup[vid] || `#${vid}`) : ""
    return vLabel ? `ชั้นย่อย: ${vLabel}` : ""
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (filters.branchId) params.set("branch_id", filters.branchId)
      if (filters.klangId) params.set("klang_id", filters.klangId)
      if (filters.q?.trim()) params.set("q", filters.q.trim())
      if (filters.specId) params.append("spec_id", filters.specId) // เผื่อ BE รองรับในอนาคต

      const endpoint = mode === "buy" ? `/order/orders/buy-report` : `/order/orders/sell-report`
      const data = await apiAuth(`${endpoint}?${params.toString()}`)

      if (listReqId.current !== myReq) return  // ถ้าไม่ใช่คำขอล่าสุดให้เมินผลนี้
      setRows(Array.isArray(data) ? data : [])
      setPage(1); setPageInput("1")
    } catch (e) {
      console.error(e)
      if (listReqId.current !== myReq) return
      setRows([]); setPage(1); setPageInput("1")
    } finally {
      if (listReqId.current === myReq) {
        setLoading(false)
      }
    }
  }

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
  useEffect(() => { fetchOrders() }, [mode]) // โหลดใหม่เมื่อเปลี่ยนโหมด

  /** ---------- Auto refresh on debounced search ---------- */
  useEffect(() => {
    if (filters.q.length >= 2 || filters.q.length === 0) fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ])

  /** ---------- Totals ---------- */
  const totals = useMemo(() => {
    let weight = 0, revenue = 0
    rows.forEach((x) => { weight += toNumber(x.weight); revenue += toNumber(x.price) })
    return { weight, revenue }
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
      const main = document.querySelector('main')
      if (main && typeof main.scrollTo === 'function') {
        main.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        window?.scrollTo?.({ top: 0, behavior: 'smooth' })
      }
    } catch (_) { /* no-op */ }
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

      branchId: "", branchName: "",
      klangId: "", klangName: "",

      specId: "", specLabel: "",
      q: "",
    })
    setKlangOptions([])
    setPage(1); setPageInput("1")
    setErrors({ startDate: "", endDate: "" })
  }

  /** ----------- UI ----------- */
  const startIndex = (page - 1) * PAGE_SIZE + 1
  const endIndex = Math.min(rows.length, page * PAGE_SIZE)

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {mode === "buy" ? "📦 รายการออเดอร์ซื้อข้าวเปลือก" : "🧾 รายการออเดอร์ขายข้าวเปลือก"}
          </h1>

          {/* Toggle Buy/Sell */}
          <div className="inline-flex items-center rounded-2xl border border-slate-300 p-1 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-600">
            <button
              type="button"
              onClick={() => switchMode("buy")}
              className={cx(
                "px-4 py-2 rounded-xl text-sm font-semibold transition",
                mode === "buy" ? "bg-emerald-600 text-white shadow" : "text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700"
              )}
            >
              โหมดซื้อ
            </button>
            <button
              type="button"
              onClick={() => switchMode("sell")}
              className={cx(
                "px-4 py-2 rounded-xl text-sm font-semibold transition",
                mode === "sell" ? "bg-emerald-600 text-white shadow" : "text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700"
              )}
            >
              โหมดขาย
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="grid gap-3 md:grid-cols-6">
            {/* วันที่เริ่ม */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วันที่เริ่ม</label>
              <DateInput
                value={filters.startDate}
                onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
                error={!!errors.startDate}
              />
              {errors.startDate && <div className="mt-1 text-sm text-red-500">{errors.startDate}</div>}
            </div>

            {/* วันที่สิ้นสุด */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วันที่สิ้นสุด</label>
              <DateInput
                value={filters.endDate}
                onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
                error={!!errors.endDate}
              />
              {errors.endDate && <div className="mt-1 text-sm text-red-500">{errors.endDate}</div>}
            </div>

            {/* สาขา */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขา</label>
              <ComboBox
                options={branchOptions}
                value={filters.branchId}
                getValue={(o) => o.id}
                onChange={(id, found) =>
                  setFilters((p) => ({ ...p, branchId: id || "", branchName: found?.label ?? "", klangId: "", klangName: "" })) }
                placeholder="— เลือกสาขา —"
              />
            </div>

            {/* คลัง */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">คลัง</label>
              <ComboBox
                options={klangOptions}
                value={filters.klangId}
                getValue={(o) => o.id}
                onChange={(id, found) =>
                  setFilters((p) => ({ ...p, klangId: id || "", klangName: found?.label ?? "" })) }
                placeholder="— เลือกคลัง —"
                disabled={!filters.branchId}
              />
            </div>

            {/* รายการสำเร็จรูป (spec) — โชว์ชั้นย่อยแบบหน้า Buy */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">รายการสำเร็จรูป (spec)</label>
              <ComboBox
                options={specOptions}
                value={filters.specId}
                getValue={(o) => o.id}
                getSubLabel={(o) => templateSubLabel(o)}
                onChange={(id, found) =>
                  setFilters((p) => ({ ...p, specId: id || "", specLabel: found?.label ?? "" })) }
                placeholder={loadingSpecs ? "— กำลังโหลด… —" : "— เลือก —"}
                disabled={loadingSpecs || specOptions.length === 0}
              />
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                ตัวเลือกนี้มาจาก <code>/order/form/search</code> • บรรทัดย่อยจะแสดงชื่อ “ชั้นย่อย” จาก <code>/order/variant/search</code>
              </div>
            </div>

            {/* Search box */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                {mode === "buy"
                  ? "ค้นหา (ชื่อ / ปชช. / เลขที่ใบสำคัญ)"
                  : "ค้นหา (ชื่อ / ปชช. / ใบรับเงินขายสินค้า / เลขที่ใบชั่ง)"}
              </label>
              <input
                className={baseField}
                value={filters.q}
                onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร แล้วระบบจะค้นหาอัตโนมัติ"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-6">
              <button
                onClick={fetchOrders}
                type="button"
                disabled={!!errors.startDate || !!errors.endDate}
                className={cx(
                  "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold text-white transition-all duration-300 ease-out cursor-pointer",
                  (!!errors.startDate || !!errors.endDate)
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

        {/* Summary */}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">จำนวนรายการ</div>
            <div className="text-2xl font-semibold">{rows.length.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">น้ำหนักรวม (กก.)</div>
            <div className="text-2xl font-semibold">{(Math.round(toNumber(totals.weight) * 100) / 100).toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">มูลค่ารวม</div>
            <div className="text-2xl font-semibold">{thb(toNumber(totals.revenue))}</div>
          </div>
        </div>

        {/* Table */}
        <div
          className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          aria-busy={loading ? "true" : "false"}
        >
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {mode === "buy" ? (
                <tr>
                  <th className="px-3 py-2">วันที่</th>
                  <th className="px-3 py-2">เลขที่ใบสำคัญ</th>
                  <th className="px-3 py-2">ลูกค้า</th>
                  <th className="px-3 py-2">ชนิดข้าว</th>
                  <th className="px-3 py-2">สาขา</th>
                  <th className="px-3 py-2">คลัง</th>
                  <th className="px-3 py-2 text-right">น้ำหนักขาเข้า</th>
                  <th className="px-3 py-2 text-right">น้ำหนักขาออก</th>
                  <th className="px-3 py-2 text-right">น้ำหนักสุทธิ</th>
                  <th className="px-3 py-2 text-right">ราคาต่อกก. (บาท)</th>
                  <th className="px-3 py-2 text-right">เป็นเงิน</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-3 py-2">วันที่</th>
                  <th className="px-3 py-2">ใบรับเงินขายสินค้า</th>
                  <th className="px-3 py-2">เลขที่ใบชั่ง</th>
                  <th className="px-3 py-2">ลูกค้า</th>
                  <th className="px-3 py-2">ชนิดข้าว</th>
                  <th className="px-3 py-2">สาขา</th>
                  <th className="px-3 py-2">คลัง</th>
                  <th className="px-3 py-2 text-right">น้ำหนัก (กก.)</th>
                  <th className="px-3 py-2 text-right">ราคาต่อกก. (บาท)</th>
                  <th className="px-3 py-2 text-right">เป็นเงิน</th>
                  <th className="px-3 py-2 text-center">#ย่อย</th>
                </tr>
              )}
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-6 text-center" colSpan={11}>
                    <span className="inline-flex items-center gap-3 text-slate-600 dark:text-slate-300">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"></path>
                      </svg>
                      กำลังโหลดข้อมูล{mode === "buy" ? "ฝั่งซื้อ" : "ฝั่งขาย"}...
                    </span>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-3 py-3" colSpan={11}>ไม่พบข้อมูล</td></tr>
              ) : mode === "buy" ? (
                pagedRows.map((r) => {
                  const entry = toNumber(r.entry_weight ?? r.entryWeight ?? r.entry ?? 0)
                  const exit  = toNumber(r.exit_weight  ?? r.exitWeight  ?? r.exit  ?? 0)
                  const net   = toNumber(r.weight) || Math.max(0, Math.abs(exit - entry))
                  const price = toNumber(r.price ?? r.amountTHB ?? 0)
                  const pricePerKgRaw = toNumber(r.price_per_kilo ?? r.pricePerKilo ?? r.unit_price ?? 0)
                  const pricePerKg = pricePerKgRaw || (net > 0 ? price / net : 0)

                  return (
                    <tr
                      key={r.id ?? `${r.order_serial}-${r.date}-${r.first_name ?? ""}-${r.last_name ?? ""}`}
                      className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700 dark:hover:bg-slate-700/70"
                    >
                      <td className="px-3 py-2">{r.date ? new Date(r.date).toLocaleDateString("th-TH") : "—"}</td>
                      <td className="px-3 py-2">{r.order_serial || r.paymentRefNo || "—"}</td>
                      <td className="px-3 py-2">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.customer_name || "—"}</td>
                      <td className="px-3 py-2">{r.species || r.rice_type || r.riceType || "—"}</td>
                      <td className="px-3 py-2">{r.branch_name || r.branchName || "—"}</td>
                      <td className="px-3 py-2">{r.klang_name || r.klangName || "—"}</td>
                      <td className="px-3 py-2 text-right">{entry.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{exit.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{net.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{baht(pricePerKg)}</td>
                      <td className="px-3 py-2 text-right">{thb(price)}</td>
                    </tr>
                  )
                })
              ) : (
                pagedRows.map((r) => {
                  const net   = toNumber(r.weight ?? 0)
                  const price = toNumber(r.price ?? 0)
                  const pricePerKgRaw = toNumber(r.price_per_kilo ?? 0)
                  const pricePerKg = pricePerKgRaw || (net > 0 ? price / net : 0)

                  return (
                    <tr
                      key={`${r.id ?? r.sale_id}-${r.sub_order ?? 0}`}
                      className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700 dark:hover:bg-slate-700/70"
                    >
                      <td className="px-3 py-2">{r.date ? new Date(r.date).toLocaleDateString("th-TH") : "—"}</td>
                      <td className="px-3 py-2">{r.sale_id || "—"}</td>
                      <td className="px-3 py-2">{r.order_serial || "—"}</td>
                      <td className="px-3 py-2">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—"}</td>
                      <td className="px-3 py-2">{r.species || "—"}</td>
                      <td className="px-3 py-2">{r.branch_name || "—"}</td>
                      <td className="px-3 py-2">{r.klang_name || "—"}</td>
                      <td className="px-3 py-2 text-right">{net.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{baht(pricePerKg)}</td>
                      <td className="px-3 py-2 text-right">{thb(price)}</td>
                      <td className="px-3 py-2 text-center">{r.sub_order ?? "-"}</td>
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
                      className={cx(
                        "h-10 min-w-[40px] rounded-xl px-3 text-sm font-semibold transition",
                        it === page
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600",
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
                <label className="text-sm text-slate-600 dark:text-slate-300">ไปหน้า</label>
                <input
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
      </div>
    </div>
  )
}

export default Order
