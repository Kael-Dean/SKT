// src/pages/OrderCorrection.jsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react"
import { apiAuth } from "../lib/api"

// -------- Utils --------
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) =>
  v === "" || v === null || v === undefined ? 0 : Number(v)
const thb = (n) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0)
const baht = (n) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0)

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const cx = (...a) => a.filter(Boolean).join(" ")

const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

// -------- ComboBox (แบบเดียวกับหน้า Order) --------
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false,
  error = false,
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const btnRef = useRef(null)
  const listRef = useRef(null)

  const selectedObj = useMemo(
    () => options.find((o) => String(getValue(o)) === String(value)),
    [options, value, getValue]
  )
  const selectedLabel = selectedObj ? getLabel(selectedObj) : ""

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

  const commit = (opt) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    requestAnimationFrame(() => btnRef.current?.focus())
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
    <div ref={boxRef} className="relative">
      <button
        type="button"
        ref={btnRef}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled
            ? "bg-slate-100 cursor-not-allowed"
            : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error
            ? "border-red-400 ring-2 ring-red-300/70"
            : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700/80"
        )}
      >
        {selectedLabel || (
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
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
              ไม่มีตัวเลือก
            </div>
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
                className={cx(
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-emerald-600 dark:bg-emerald-400/70" />
                )}
                <span className="flex-1">{label}</span>
                {isChosen && (
                  <span className="text-emerald-600 dark:text-emerald-300">✓</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// -------- DateInput --------
const DateInput = forwardRef(function DateInput(
  { error = false, className = "", ...props },
  ref
) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator{opacity:0}`}</style>
      <input
        type="date"
        ref={inputRef}
        className={cx(
          baseField,
          "pr-12 cursor-pointer",
          error && "border-red-400 ring-2 ring-red-300/70",
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          const el = inputRef.current
          if (!el) return
          if (typeof el.showPicker === "function") el.showPicker()
          else {
            el.focus()
            el.click?.()
          }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-transparent
                   cursor-pointer transition-transform hover:scale-110 active:scale-95 focus:outline-none"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="currentColor"
          className="text-slate-600 dark:text-slate-200"
        >
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

const PAGE_SIZE = 100

const OrderCorrection = () => {
  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10)

  // mode ซื้อ/ขาย
  const [mode, setMode] = useState("buy") // 'buy' | 'sell'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  // pagination
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState("1")
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
    [rows.length]
  )
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, page])

  // filters
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,
    branchId: "",
    klangId: "",
    q: "",
  })
  const [errors, setErrors] = useState({ startDate: "", endDate: "" })
  const debouncedQ = useDebounce(filters.q, 500)

  // edit state
  const [editing, setEditing] = useState(null) // {mode, row, sub_order?}
  const [editForm, setEditForm] = useState({})
  const [editMeta, setEditMeta] = useState({ editedBy: "", reason: "" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ----- validation date -----
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

  // ----- load branches -----
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const branches = await apiAuth(`/order/branch/search`)
        setBranchOptions(
          (Array.isArray(branches) ? branches : []).map((b) => ({
            id: String(b.id),
            label: b.branch_name,
          }))
        )
      } catch (e) {
        console.error(e)
        setBranchOptions([])
      }
    }
    loadInitial()
  }, [])

  // ----- branch -> klang -----
  useEffect(() => {
    const loadKlang = async () => {
      if (!filters.branchId) {
        setKlangOptions([])
        setFilters((p) => ({ ...p, klangId: "" }))
        return
      }
      try {
        const data = await apiAuth(
          `/order/klang/search?branch_id=${filters.branchId}`
        )
        setKlangOptions(
          (Array.isArray(data) ? data : []).map((k) => ({
            id: String(k.id),
            label: k.klang_name,
          }))
        )
      } catch (e) {
        console.error(e)
        setKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.branchId])

  // ----- fetch orders (ตาม mode) -----
  const fetchOrders = async () => {
    if (!validateDates(filters.startDate, filters.endDate)) return
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("start_date", filters.startDate)
      params.set("end_date", filters.endDate)
      if (filters.branchId) params.set("branch_id", filters.branchId)
      if (filters.klangId) params.set("klang_id", filters.klangId)
      if (filters.q?.trim()) params.set("q", filters.q.trim())

      const endpoint =
        mode === "buy" ? "/order/orders/buy-report" : "/order/orders/sell-report"

      const data = await apiAuth(`${endpoint}?${params.toString()}`)
      setRows(Array.isArray(data) ? data : [])
      setPage(1)
      setPageInput("1")
      setEditing(null)
      setEditForm({})
    } catch (e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // init + on mode change
  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // auto search on q
  useEffect(() => {
    if (filters.q.length >= 2 || filters.q.length === 0) fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ])

  // totals
  const totals = useMemo(() => {
    let weight = 0
    let revenue = 0
    rows.forEach((r) => {
      weight += toNumber(r.weight)
      revenue += toNumber(r.price)
    })
    return { weight, revenue }
  }, [rows])

  // pagination helpers
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages))
    setPageInput((v) =>
      String(Math.min(Math.max(1, toNumber(onlyDigits(v)) || 1), totalPages))
    )
  }, [totalPages])

  const goToPage = (p) => {
    const n = Math.min(Math.max(1, toNumber(p)), totalPages)
    setPage(n)
    setPageInput(String(n))
    try {
      const main = document.querySelector("main")
      if (main && typeof main.scrollTo === "function") {
        main.scrollTo({ top: 0, behavior: "smooth" })
      } else {
        window?.scrollTo?.({ top: 0, behavior: "smooth" })
      }
    } catch {
      /* noop */
    }
  }
  const nextPage = () => goToPage(page + 1)
  const prevPage = () => goToPage(page - 1)
  const onCommitPageInput = () => {
    const n = toNumber(onlyDigits(pageInput))
    if (!n) {
      setPageInput(String(page))
      return
    }
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

  const resetFilters = () => {
    setFilters({
      startDate: firstDayThisMonth,
      endDate: today,
      branchId: "",
      klangId: "",
      q: "",
    })
    setKlangOptions([])
    setPage(1)
    setPageInput("1")
    setErrors({ startDate: "", endDate: "" })
    setEditing(null)
    setEditForm({})
  }

  // ----- when click edit row -----
  const onEditRow = (row) => {
    setEditing({ mode, row })
    setEditMeta((m) => ({ ...m, reason: "" }))

    if (mode === "buy") {
      setEditForm({
        date: row.date ? row.date.slice(0, 10) : today,
        entry_weight: row.entry_weight ?? 0,
        exit_weight: row.exit_weight ?? 0,
        price_per_kilo: row.price_per_kilo ?? 0,
      })
    } else {
      // sell: ต้องรวม row คู่ที่มี id เดียวกัน (sub_order 1 & 2)
      const siblings = rows.filter((r) => r.id === row.id)
      const r1 = siblings.find((x) => x.sub_order === 1) || {}
      const r2 = siblings.find((x) => x.sub_order === 2) || {}
      setEditForm({
        date: row.date ? row.date.slice(0, 10) : today,
        target_sub: row.sub_order, // 1 หรือ 2
        weight_1: r1.weight ?? 0,
        weight_2: r2.weight ?? 0,
        price_1: r1.price ?? 0,
        price_2: r2.price ?? 0,
      })
    }
  }

  // ----- delete order -----
  const onDeleteRow = async (row) => {
    if (
      !window.confirm(
        `ต้องการลบออเดอร์หมายเลข ${mode === "buy" ? row.order_serial : row.sale_id || row.order_serial
        } ใช่หรือไม่?`
      )
    )
      return
    try {
      setDeleting(true)
      const force = mode === "buy" ? "buy" : "sell"
      await apiAuth(`/order/orders/${row.id}?force_type=${force}`, {
        method: "DELETE",
      })
      await fetchOrders()
      setEditing(null)
    } catch (e) {
      console.error(e)
      alert("ลบออเดอร์ไม่สำเร็จ")
    } finally {
      setDeleting(false)
    }
  }

  // ----- save edit -----
  const onSaveEdit = async () => {
    if (!editing) return
    if (!editMeta.editedBy || !onlyDigits(editMeta.editedBy)) {
      alert("กรุณากรอกรหัสผู้แก้ไข (ตัวเลข)")
      return
    }
    const edited_by = Number(onlyDigits(editMeta.editedBy))

    try {
      setSaving(true)
      if (editing.mode === "buy") {
        const { date, entry_weight, exit_weight, price_per_kilo } = editForm
        const payload = {
          meta: {
            edited_by,
            reason: editMeta.reason || null,
          },
          changes: {
            date: date ? new Date(date).toISOString() : undefined,
            entry_weight: entry_weight !== "" ? Number(entry_weight) : undefined,
            exit_weight: exit_weight !== "" ? Number(exit_weight) : undefined,
            price_per_kilo:
              price_per_kilo !== "" ? Number(price_per_kilo) : undefined,
          },
          dept: null,
        }
        await apiAuth(`/order/orders/buy/${editing.row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        const { date, target_sub, weight_1, weight_2, price_1, price_2 } =
          editForm
        const w1 = Number(weight_1 || 0)
        const w2 = Number(weight_2 || 0)
        const p1 = Number(price_1 || 0)
        const p2 = Number(price_2 || 0)

        const payload = {
          meta: {
            edited_by,
            reason: editMeta.reason || null,
          },
          changes: {
            date: date ? new Date(date).toISOString() : undefined,
            weight_1: w1,
            weight_2: w2,
            price_1: p1,
            price_2: p2,
            // ไม่ส่ง price_per_kilo ให้ backend คำนวณเองจากยอดรวม
          },
          dept: null,
        }
        await apiAuth(`/order/orders/sell/${editing.row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      await fetchOrders()
      setEditing(null)
      setEditForm({})
    } catch (e) {
      console.error(e)
      alert("บันทึกการแก้ไขไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const startIndex = (page - 1) * PAGE_SIZE + 1
  const endIndex = Math.min(rows.length, page * PAGE_SIZE)

  const isBuyMode = mode === "buy"

  // --- UI ---
  return (
    <div className="min-h-screen rounded-2xl bg-white text-black dark:bg-slate-900 dark:text-white">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🛠️ แก้ไขออเดอร์
          </h1>

          {/* toggle buy/sell */}
          <div className="inline-flex items-center rounded-2xl border border-slate-300 bg-white p-1 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMode("buy")}
              className={cx(
                "px-4 py-2 text-sm font-semibold rounded-xl transition",
                isBuyMode
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700"
              )}
            >
              โหมดซื้อ
            </button>
            <button
              type="button"
              onClick={() => setMode("sell")}
              className={cx(
                "px-4 py-2 text-sm font-semibold rounded-xl transition",
                !isBuyMode
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700"
              )}
            >
              โหมดขาย
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="grid gap-3 md:grid-cols-6">
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                วันที่เริ่ม
              </label>
              <DateInput
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, startDate: e.target.value }))
                }
                error={!!errors.startDate}
              />
              {errors.startDate && (
                <div className="mt-1 text-sm text-red-500">
                  {errors.startDate}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                วันที่สิ้นสุด
              </label>
              <DateInput
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, endDate: e.target.value }))
                }
                error={!!errors.endDate}
              />
              {errors.endDate && (
                <div className="mt-1 text-sm text-red-500">
                  {errors.endDate}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                สาขา
              </label>
              <ComboBox
                options={branchOptions}
                value={filters.branchId}
                getValue={(o) => o.id}
                onChange={(id) =>
                  setFilters((p) => ({
                    ...p,
                    branchId: id || "",
                    klangId: "",
                  }))
                }
                placeholder="— เลือกสาขา —"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                คลัง
              </label>
              <ComboBox
                options={klangOptions}
                value={filters.klangId}
                getValue={(o) => o.id}
                onChange={(id) =>
                  setFilters((p) => ({ ...p, klangId: id || "" }))
                }
                placeholder="— เลือกคลัง —"
                disabled={!filters.branchId}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                ค้นหา (ชื่อ / ปชช. / เลขที่ใบสำคัญ
                {isBuyMode ? "" : " / เลขที่ขาย"})
              </label>
              <input
                className={baseField}
                value={filters.q}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, q: e.target.value }))
                }
                placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร แล้วระบบจะค้นหาอัตโนมัติ"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-6">
              <button
                type="button"
                onClick={fetchOrders}
                disabled={!!errors.startDate || !!errors.endDate}
                className={cx(
                  "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold text-white transition-all duration-300 ease-out cursor-pointer",
                  !!errors.startDate || !!errors.endDate
                    ? "bg-emerald-400/60 pointer-events-none"
                    : "bg-emerald-600 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)] hover:scale-[1.05] active:scale-[.97]"
                )}
              >
                ค้นหา
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 shadow-sm transition-all duration-300 ease-out hover:bg-slate-100 hover:shadow-md hover:scale-[1.03] active:scale-[.97] dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
              >
                รีเซ็ต
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">
              จำนวนรายการ
            </div>
            <div className="text-2xl font-semibold">
              {rows.length.toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">
              น้ำหนักรวม (กก.)
            </div>
            <div className="text-2xl font-semibold">
              {Math.round(toNumber(totals.weight) * 100) / 100}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">มูลค่ารวม</div>
            <div className="text-2xl font-semibold">
              {thb(toNumber(totals.revenue))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {isBuyMode ? (
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
                  <th className="px-3 py-2 text-right">ราคาต่อกก.</th>
                  <th className="px-3 py-2 text-right">เป็นเงิน</th>
                  <th className="px-3 py-2 text-center">การกระทำ</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-3 py-2">วันที่</th>
                  <th className="px-3 py-2">เลขที่ขาย</th>
                  <th className="px-3 py-2">เลขที่ใบสำคัญ</th>
                  <th className="px-3 py-2">ลูกค้า</th>
                  <th className="px-3 py-2">ชนิดข้าว</th>
                  <th className="px-3 py-2">สาขา</th>
                  <th className="px-3 py-2">คลัง</th>
                  <th className="px-3 py-2 text-right">น้ำหนัก (กก.)</th>
                  <th className="px-3 py-2 text-right">ราคาต่อกก.</th>
                  <th className="px-3 py-2 text-right">เป็นเงิน</th>
                  <th className="px-3 py-2 text-center">#ย่อย</th>
                  <th className="px-3 py-2 text-center">การกระทำ</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3" colSpan={12}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={12}>
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : isBuyMode ? (
                pagedRows.map((r) => {
                  const entry = toNumber(r.entry_weight ?? 0)
                  const exit = toNumber(r.exit_weight ?? 0)
                  const net = toNumber(r.weight ?? 0) || Math.max(0, entry - exit)
                  const price = toNumber(r.price ?? 0)
                  const ppk =
                    toNumber(r.price_per_kilo ?? 0) ||
                    (net > 0 ? price / net : 0)
                  return (
                    <tr
                      key={r.id}
                      className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700 dark:hover:bg-slate-700/70"
                    >
                      <td className="px-3 py-2">
                        {r.date
                          ? new Date(r.date).toLocaleDateString("th-TH")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.order_serial || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() ||
                          "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.species || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.branch_name || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.klang_name || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {entry.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {exit.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {net.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {baht(ppk)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {thb(price)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => onEditRow(r)}
                            className="rounded-2xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRow(r)}
                            className="rounded-2xl bg-red-500 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-red-600"
                            disabled={deleting}
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                pagedRows.map((r) => {
                  const net = toNumber(r.weight ?? 0)
                  const price = toNumber(r.price ?? 0)
                  const ppk =
                    toNumber(r.price_per_kilo ?? 0) ||
                    (net > 0 ? price / net : 0)
                  return (
                    <tr
                      key={`${r.id}-${r.sub_order}`}
                      className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700 dark:hover:bg-slate-700/70"
                    >
                      <td className="px-3 py-2">
                        {r.date
                          ? new Date(r.date).toLocaleDateString("th-TH")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{r.sale_id || "—"}</td>
                      <td className="px-3 py-2">{r.order_serial || "—"}</td>
                      <td className="px-3 py-2">
                        {`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() ||
                          "—"}
                      </td>
                      <td className="px-3 py-2">{r.species || "—"}</td>
                      <td className="px-3 py-2">
                        {r.branch_name || "—"}
                      </td>
                      <td className="px-3 py-2">{r.klang_name || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {net.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {baht(ppk)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {thb(price)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.sub_order ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => onEditRow(r)}
                            className="rounded-2xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRow(r)}
                            className="rounded-2xl bg-red-500 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-red-600"
                            disabled={deleting}
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* pagination */}
          <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              แสดง{" "}
              <b>{rows.length ? startIndex.toLocaleString() : 0}</b>–
              <b>{rows.length ? endIndex.toLocaleString() : 0}</b> จาก{" "}
              <b>{rows.length.toLocaleString()}</b> รายการ
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={prevPage}
                disabled={page <= 1}
                className={cx(
                  "h-10 rounded-xl px-4 text-sm font-medium border border-slate-300 dark:border-slate-600",
                  page <= 1
                    ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                )}
              >
                ก่อนหน้า
              </button>

              <div className="flex items-center gap-1">
                {pageItems.map((it, idx) =>
                  it === "..." ? (
                    <span
                      key={`dots-${idx}`}
                      className="px-2 text-slate-500 dark:text-slate-300"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={`p-${it}`}
                      type="button"
                      onClick={() => goToPage(it)}
                      className={cx(
                        "h-10 min-w-[40px] rounded-xl px-3 text-sm font-semibold transition border border-slate-300 dark:border-slate-600",
                        it === page
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
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
                  "h-10 rounded-xl px-4 text-sm font-medium border border-slate-300 dark:border-slate-600",
                  page >= totalPages
                    ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                )}
              >
                ถัดไป
              </button>

              <div className="ml-2 flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  ไปหน้า
                </span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(onlyDigits(e.target.value))}
                  onKeyDown={(e) =>
                    e.key === "Enter" && onCommitPageInput()
                  }
                  onBlur={onCommitPageInput}
                  className="h-10 w-20 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  / {totalPages.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit panel */}
        {editing && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-black shadow-sm dark:border-amber-500/60 dark:bg-amber-900/40 dark:text-white">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {isBuyMode
                  ? `แก้ไขออเดอร์ซื้อ #${editing.row.order_serial || editing.row.id
                    }`
                  : `แก้ไขออเดอร์ขาย #${editing.row.sale_id || editing.row.id
                    } (ย่อย ${editForm.target_sub || editing.row.sub_order || "-"
                    })`}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setEditForm({})
                }}
                className="text-sm text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
              >
                ปิดฟอร์ม
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                  รหัสผู้แก้ไข (edited_by)
                </label>
                <input
                  className={baseField}
                  value={editMeta.editedBy}
                  onChange={(e) =>
                    setEditMeta((m) => ({ ...m, editedBy: e.target.value }))
                  }
                  placeholder="กรอกรหัสพนักงานผู้แก้ไข"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                  เหตุผลการแก้ไข (optional)
                </label>
                <input
                  className={baseField}
                  value={editMeta.reason}
                  onChange={(e) =>
                    setEditMeta((m) => ({ ...m, reason: e.target.value }))
                  }
                  placeholder="ระบุคำอธิบายสั้น ๆ"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                  วันที่เอกสาร
                </label>
                <DateInput
                  value={editForm.date || today}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
              </div>

              {isBuyMode ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                      น้ำหนักขาเข้า (กก.)
                    </label>
                    <input
                      className={baseField}
                      type="number"
                      value={editForm.entry_weight ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          entry_weight: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                      น้ำหนักขาออก (กก.)
                    </label>
                    <input
                      className={baseField}
                      type="number"
                      value={editForm.exit_weight ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          exit_weight: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                      ราคาต่อกก. (บาท)
                    </label>
                    <input
                      className={baseField}
                      type="number"
                      value={editForm.price_per_kilo ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          price_per_kilo: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                      น้ำหนักสุทธิ (แสดงจากเข้า-ออก)
                    </label>
                    <input
                      readOnly
                      className={cx(
                        baseField,
                        "bg-slate-100/80 dark:bg-slate-700/80"
                      )}
                      value={(() => {
                        const e = toNumber(editForm.entry_weight ?? 0)
                        const x = toNumber(editForm.exit_weight ?? 0)
                        return (e - x).toLocaleString()
                      })()}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                      เป็นเงิน (คำนวณ)
                    </label>
                    <input
                      readOnly
                      className={cx(
                        baseField,
                        "bg-slate-100/80 dark:bg-slate-700/80"
                      )}
                      value={(() => {
                        const e = toNumber(editForm.entry_weight ?? 0)
                        const x = toNumber(editForm.exit_weight ?? 0)
                        const w = Math.max(0, e - x)
                        const ppk = toNumber(editForm.price_per_kilo ?? 0)
                        return thb(w * ppk)
                      })()}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                      น้ำหนักย่อย 1 (กก.)
                    </label>
                    <input
                      className={baseField}
                      type="number"
                      value={editForm.weight_1 ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          weight_1: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                      น้ำหนักย่อย 2 (กก.)
                    </label>
                    <input
                      className={baseField}
                      type="number"
                      value={editForm.weight_2 ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          weight_2: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                      ราคาย่อย 1 (บาท)
                    </label>
                    <input
                      className={baseField}
                      type="number"
                      value={editForm.price_1 ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          price_1: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                      ราคาย่อย 2 (บาท)
                    </label>
                    <input
                      className={baseField}
                      type="number"
                      value={editForm.price_2 ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          price_2: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
                      รวมเป็นเงิน (แสดง)
                    </label>
                    <input
                      readOnly
                      className={cx(
                        baseField,
                        "bg-slate-100/80 dark:bg-slate-700/80"
                      )}
                      value={thb(
                        toNumber(editForm.price_1 ?? 0) +
                          toNumber(editForm.price_2 ?? 0)
                      )}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSaveEdit}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
              >
                บันทึกการแก้ไข
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setEditForm({})
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700/70 dark:text-white"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderCorrection
