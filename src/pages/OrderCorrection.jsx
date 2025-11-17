// src/pages/OrderCorrection.jsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react"
import { apiAuth } from "../lib/api" // ✅ helper รวม token/BASE URL เหมือนหน้า Order

/** ---------- Utils (เทียบหน้า Order.jsx) ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
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

/** ---------- Base field style (ยกมาจากหน้า Order.jsx) ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

/** ---------- Reusable ComboBox (ยกดีไซน์จากหน้า Order.jsx) ---------- */
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
          disabled
            ? "bg-slate-100 cursor-not-allowed"
            : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error
            ? "border-red-400 ring-2 ring-red-300/70"
            : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "text-black placeholder:text-slate-500",
          "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:hover:bg-slate-700/70 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
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

/** ---------- DateInput (รองรับ error) ---------- */
const DateInput = forwardRef(function DateInput(
  { error = false, className = "", ...props },
  ref
) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input
        type="date"
        ref={inputRef}
        className={[
          baseField,
          "pr-12 cursor-pointer",
          error ? "border-red-400 ring-2 ring-red-300/70" : "",
          className,
        ].join(" ")}
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

/** ---------- Page: OrderCorrection ---------- */
const PAGE_SIZE = 100

function asISODateString(v) {
  try {
    if (!v) return ""
    // accept Date or string yyyy-mm-dd
    const d = v instanceof Date ? v : new Date(v)
    return d.toISOString().slice(0, 10)
  } catch {
    return ""
  }
}

const OrderCorrection = () => {
  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10)

  /** ---------- State: list ---------- */
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

  /** ---------- Options ---------- */
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])
  const [specOptions, setSpecOptions] = useState([]) // [{id,label}]
  const [specFullById, setSpecFullById] = useState(new Map()) // id -> full ProductSpec
  const [paymentBuyOptions, setPaymentBuyOptions] = useState([])   // id: 3,4
  const [paymentSellOptions, setPaymentSellOptions] = useState([]) // id: 1,2
  const [loadingSpecs, setLoadingSpecs] = useState(false)

  /** ---------- Filters ---------- */
  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,
    branchId: "",
    branchName: "",
    klangId: "",
    klangName: "",
    specId: "",
    specLabel: "",
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

  /** ---------- Load initial (branch + spec + payment) ---------- */
  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoadingSpecs(true)
        const [branches, specs, pBuy, pSell] = await Promise.all([
          apiAuth(`/order/branch/search`),
          apiAuth(`/order/form/search`),            // รายการสำเร็จรูป (ProductSpec) → ใช้ทำ ProductSpecIn ตอน PATCH
          apiAuth(`/order/payment/search/buy`),     // id 3,4
          apiAuth(`/order/payment/search/sell`),    // id 1,2
        ])
        setBranchOptions(
          (Array.isArray(branches) ? branches : []).map((x) => ({
            id: String(x.id),
            label: x.branch_name,
          }))
        )

        // เก็บทั้ง label และ full เพื่อแปลงไป ProductSpecIn
        const specList = Array.isArray(specs) ? specs : []
        const byId = new Map()
        setSpecOptions(
          specList
            .map((r) => {
              const id = String(r.id)
              const label = String(
                r.prod_name || r.name || r.spec_name || `spec #${r.id}`
              ).trim()
              if (id && label) byId.set(id, r)
              return { id, label }
            })
            .filter((o) => o.id && o.label)
        )
        setSpecFullById(byId)

        setPaymentBuyOptions(
          (Array.isArray(pBuy) ? pBuy : []).map((x) => ({
            id: String(x.id),
            label: x.payment,
          }))
        )
        setPaymentSellOptions(
          (Array.isArray(pSell) ? pSell : []).map((x) => ({
            id: String(x.id),
            label: x.payment,
          }))
        )
      } catch (e) {
        console.error("load initial options failed:", e)
        setBranchOptions([])
        setSpecOptions([])
        setPaymentBuyOptions([])
        setPaymentSellOptions([])
      } finally {
        setLoadingSpecs(false)
      }
    }
    loadInitial()
  }, [])

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
        setKlangOptions(
          (Array.isArray(data) ? data : []).map((x) => ({
            id: String(x.id),
            label: x.klang_name,
          }))
        )
      } catch (e) {
        console.error("load klang failed:", e)
        setKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.branchId])

  /** ---------- Fetch orders ---------- */
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
      // spec filter (อาจไม่รองรับใน BE /orders/report — ข้ามไปก่อน)

      const data = await apiAuth(`/order/orders/report?${params.toString()}`) // รวม buy+sell ตามสคีมา BE
      setRows(Array.isArray(data) ? data : [])
      setPage(1)
      setPageInput("1")
    } catch (e) {
      console.error(e)
      setRows([])
      setPage(1)
      setPageInput("1")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchOrders()
  }, []) // initial

  useEffect(() => {
    if (filters.q.length >= 2 || filters.q.length === 0) fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ])

  /** ---------- Totals ---------- */
  const totals = useMemo(() => {
    let weight = 0,
      revenue = 0
    rows.forEach((x) => {
      weight += toNumber(x.weight)
      revenue += toNumber(x.price)
    })
    return { weight, revenue }
  }, [rows])

  /** ---------- Pagination helpers ---------- */
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
    } catch (_) {}
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

  /** ---------- Reset ---------- */
  const resetFilters = () => {
    setFilters({
      startDate: firstDayThisMonth,
      endDate: today,
      branchId: "",
      branchName: "",
      klangId: "",
      klangName: "",
      specId: "",
      specLabel: "",
      q: "",
    })
    setKlangOptions([])
    setPage(1)
    setPageInput("1")
    setErrors({ startDate: "", endDate: "" })
  }

  /** ---------- Helpers ---------- */
  const findIdByLabel = (opts, label) =>
    String(
      (opts.find((o) => (o.label || "").trim() === (label || "").trim()) || {})
        .id || ""
    )
  const isBuyRow = (r) =>
    toNumber(r.entry_weight) !== 0 || toNumber(r.exit_weight) !== 0

  /** ---------- EDIT drawer ---------- */
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRow, setEditingRow] = useState(null) // raw row
  const [editingType, setEditingType] = useState(null) // 'buy' | 'sell'
  const [editorId, setEditorId] = useState(null) // meta.edited_by
  const [editKlangOpts, setEditKlangOpts] = useState([])

  const [form, setForm] = useState({
    // common
    date: "",
    branchId: "",
    klangId: "",
    specId: "",
    paymentId: "",
    gram: "",
    comment: "",
    reason: "",
    // buy
    order_serial: "",
    entry_weight: "",
    exit_weight: "",
    weight: "",
    price_per_kilo: "",
    price: "",
    humidity: "",
    impurity: "",
    // sell
    license_plate_1: "",
    license_plate_2: "",
    weight_1: "",
    weight_2: "",
    price_1: "",
    price_2: "",
    order_serial_1: "",
    order_serial_2: "",
  })

  // เงื่อนไขแสดงบล็อกเครดิต
  const showDeptForBuy = editingType === "buy" && form.paymentId === "4"
  const showDeptForSell = editingType === "sell" && form.paymentId === "2"
  const [dept, setDept] = useState({
    allowed_period: "",
    postpone: false,
    postpone_period: "",
  })

  // ดึง user id (กันตายหลาย endpoint + localStorage)
  useEffect(() => {
    const loadMyId = async () => {
      const candidates = ["/auth/me", "/users/me", "/user/me", "/me"]
      for (const u of candidates) {
        try {
          const data = await apiAuth(u)
          const idGuess =
            data?.id ??
            data?.user?.id ??
            data?.person?.id ??
            data?.user_id ??
            data?.userdata?.id
          if (idGuess) {
            setEditorId(Number(idGuess))
            return
          }
        } catch (e) {}
      }
      const fallback = Number(localStorage.getItem("userId") || 1)
      setEditorId(fallback)
    }
    loadMyId()
  }, [])

  const openEdit = async (row) => {
    const type = isBuyRow(row) ? "buy" : "sell"
    setEditingType(type)
    setEditingRow(row)

    // map branch/klang name → id ถ้าทำได้
    const branchId = findIdByLabel(branchOptions, row.branch_name)
    let klangList = []
    if (branchId) {
      try {
        const data = await apiAuth(`/order/klang/search?branch_id=${branchId}`)
        klangList = (Array.isArray(data) ? data : []).map((x) => ({
          id: String(x.id),
          label: x.klang_name,
        }))
      } catch (_) {}
    }
    const klangId = findIdByLabel(klangList, row.klang_name)

    setEditKlangOpts(klangList)
    setForm((p) => ({
      ...p,
      // common
      date: asISODateString(row.date),
      branchId: branchId || "",
      klangId: klangId || "",
      specId: "", // เว้นว่าง = ไม่เปลี่ยน spec (ต้องเลือกใหม่ถ้าจะเปลี่ยน)
      paymentId: "", // เว้นว่าง = ไม่เปลี่ยนวิธีชำระ
      gram: "",
      comment: "",
      reason: "",
      // buy
      order_serial: row.order_serial || "",
      entry_weight: row.entry_weight ? String(row.entry_weight) : "",
      exit_weight: row.exit_weight ? String(row.exit_weight) : "",
      weight: row.weight ? String(row.weight) : "",
      price_per_kilo: row.price_per_kilo ? String(row.price_per_kilo) : "",
      price: row.price ? String(row.price) : "",
      humidity: "",
      impurity: "",
      // sell
      license_plate_1: "",
      license_plate_2: "",
      weight_1: "",
      weight_2: "",
      price_1: "",
      price_2: "",
      order_serial_1: "",
      order_serial_2: "",
    }))
    setDept({ allowed_period: "", postpone: false, postpone_period: "" })
    setDrawerOpen(true)
  }

  const closeEdit = () => {
    setDrawerOpen(false)
    setEditingRow(null)
    setEditingType(null)
  }

  const onChangeForm = (key, val) =>
    setForm((p) => ({ ...p, [key]: val }))

  const buildSpecInFromSelected = (specId) => {
    if (!specId) return undefined
    const full = specFullById.get(String(specId))
    if (!full) return undefined
    // map ProductSpec → ProductSpecIn (BE schema)
    return {
      product_id: full.product_id,
      species_id: full.species_id,
      variant_id: full.variant_id,
      product_year: full.product_year ?? null,
      condition_id: full.condition_id ?? null,
      field_type: full.field_type ?? null,
      program: full.program ?? null,
      business_type: full.business_type ?? null,
    }
  }

  const prune = (obj) => {
    const out = {}
    Object.entries(obj).forEach(([k, v]) => {
      const isBlankStr = typeof v === "string" && v.trim() === ""
      const isUndef = v === undefined || v === null
      if (!isBlankStr && !isUndef) out[k] = v
    })
    return out
  }

  const toISO = (d) => (d ? new Date(d).toISOString() : undefined)

  const submitEdit = async () => {
    if (!editingRow || !editingType) return

    const meta = {
      edited_by: Number(editorId || 1),
      reason: form.reason || undefined,
    }

    const common = prune({
      date: form.date ? toISO(form.date) : undefined,
      branch_location: form.branchId ? Number(form.branchId) : undefined,
      klang_location: form.klangId ? Number(form.klangId) : undefined,
      gram: form.gram ? Number(form.gram) : undefined,
      comment: form.comment || undefined,
      price_per_kilo:
        form.price_per_kilo !== "" ? Number(form.price_per_kilo) : undefined,
      // เปลี่ยน spec เมื่อเลือกจริง ๆ เท่านั้น
      spec: buildSpecInFromSelected(form.specId),
      payment_id: form.paymentId ? Number(form.paymentId) : undefined,
    })

    try {
      if (editingType === "buy") {
        const changes = prune({
          ...common,
          order_serial: form.order_serial || undefined,
          entry_weight:
            form.entry_weight !== "" ? Number(form.entry_weight) : undefined,
          exit_weight:
            form.exit_weight !== "" ? Number(form.exit_weight) : undefined,
          weight: form.weight !== "" ? Number(form.weight) : undefined,
          price: form.price !== "" ? Number(form.price) : undefined,
          humidity: form.humidity !== "" ? Number(form.humidity) : undefined,
          impurity: form.impurity !== "" ? Number(form.impurity) : undefined,
        })

        const deptPayload =
          showDeptForBuy
            ? prune({
                allowed_period:
                  dept.allowed_period !== ""
                    ? Number(dept.allowed_period)
                    : undefined,
                postpone: Boolean(dept.postpone),
                postpone_period:
                  dept.postpone_period !== ""
                    ? Number(dept.postpone_period)
                    : undefined,
              })
            : undefined

        const body = { meta, changes, dept: deptPayload }

        await apiAuth(`/order/orders/buy/${editingRow.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else {
        // sell
        const changes = prune({
          ...common,
          license_plate_1: form.license_plate_1 || undefined,
          license_plate_2: form.license_plate_2 || undefined,
          weight_1: form.weight_1 !== "" ? Number(form.weight_1) : undefined,
          weight_2: form.weight_2 !== "" ? Number(form.weight_2) : undefined,
          price_1: form.price_1 !== "" ? Number(form.price_1) : undefined,
          price_2: form.price_2 !== "" ? Number(form.price_2) : undefined,
          order_serial_1: form.order_serial_1 || undefined,
          order_serial_2: form.order_serial_2 || undefined,
        })

        const deptPayload =
          showDeptForSell
            ? prune({
                allowed_period:
                  dept.allowed_period !== ""
                    ? Number(dept.allowed_period)
                    : undefined,
                postpone: Boolean(dept.postpone),
                postpone_period:
                  dept.postpone_period !== ""
                    ? Number(dept.postpone_period)
                    : undefined,
              })
            : undefined

        const body = { meta, changes, dept: deptPayload }

        await apiAuth(`/order/orders/sell/${editingRow.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }

      // สำเร็จ
      closeEdit()
      await fetchOrders()
      alert("บันทึกการแก้ไขเรียบร้อย")
    } catch (e) {
      console.error("edit failed", e)
      alert("ไม่สามารถบันทึกการแก้ไขได้")
    }
  }

  /** ----------- UI ----------- */
  const startIndex = (page - 1) * PAGE_SIZE + 1
  const endIndex = Math.min(rows.length, page * PAGE_SIZE)

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          🛠️ แก้ไขออเดอร์ (Order Correction)
        </h1>

        {/* Filters (ดีไซน์เดียวกับหน้า Order.jsx) */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="grid gap-3 md:grid-cols-6">
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วันที่เริ่ม</label>
              <DateInput
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, startDate: e.target.value }))
                }
                error={!!errors.startDate}
              />
              {errors.startDate && (
                <div className="mt-1 text-sm text-red-500">{errors.startDate}</div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วันที่สิ้นสุด</label>
              <DateInput
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, endDate: e.target.value }))
                }
                error={!!errors.endDate}
              />
              {errors.endDate && (
                <div className="mt-1 text-sm text-red-500">{errors.endDate}</div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขา</label>
              <ComboBox
                options={branchOptions}
                value={filters.branchId}
                getValue={(o) => o.id}
                onChange={(id, found) =>
                  setFilters((p) => ({
                    ...p,
                    branchId: id || "",
                    branchName: found?.label ?? "",
                    klangId: "",
                    klangName: "",
                  }))
                }
                placeholder="— เลือกสาขา —"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">คลัง</label>
              <ComboBox
                options={klangOptions}
                value={filters.klangId}
                getValue={(o) => o.id}
                onChange={(id, found) =>
                  setFilters((p) => ({ ...p, klangId: id || "", klangName: found?.label ?? "" }))
                }
                placeholder="— เลือกคลัง —"
                disabled={!filters.branchId}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                ค้นหา (ชื่อ / ปชช. / เลขที่ใบสำคัญ)
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
                className={[
                  "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold text-white transition-all duration-300 ease-out cursor-pointer",
                  !!errors.startDate || !!errors.endDate
                    ? "bg-emerald-400/60 pointer-events-none"
                    : "bg-emerald-600 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)] hover:scale-[1.05] active:scale-[.97]",
                ].join(" ")}
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
            <div className="text-2xl font-semibold">
              {Math.round(toNumber(totals.weight) * 100) / 100}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">มูลค่ารวม</div>
            <div className="text-2xl font-semibold">{thb(toNumber(totals.revenue))}</div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              <tr>
                <th className="px-3 py-2">วันที่</th>
                <th className="px-3 py-2">เลขที่ใบสำคัญ</th>
                <th className="px-3 py-2">ลูกค้า</th>
                <th className="px-3 py-2">ชนิดข้าว</th>
                <th className="px-3 py-2">สาขา</th>
                <th className="px-3 py-2">คลัง</th>
                <th className="px-3 py-2 text-right">น้ำหนักสุทธิ</th>
                <th className="px-3 py-2 text-right">ราคาต่อกก. (บาท)</th>
                <th className="px-3 py-2 text-right">เป็นเงิน</th>
                <th className="px-3 py-2 text-center">แก้ไข</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3" colSpan={10}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={10}>
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => {
                  const net = toNumber(r.weight)
                  const price = toNumber(r.price)
                  const pricePerKg = toNumber(r.price_per_kilo) || (net > 0 ? price / net : 0)
                  const buyFlag = isBuyRow(r)

                  return (
                    <tr
                      key={r.id}
                      className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700 dark:hover:bg-slate-700/70"
                    >
                      <td className="px-3 py-2">
                        {r.date ? new Date(r.date).toLocaleDateString("th-TH") : "—"}
                      </td>
                      <td className="px-3 py-2">{r.order_serial || "—"}</td>
                      <td className="px-3 py-2">
                        {`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() ||
                          r.customer_name ||
                          "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full"
                                title={buyFlag ? "ซื้อ" : "ขาย"}
                                style={{ background: buyFlag ? "#10b981" : "#6366f1" }} />
                          {r.species || r.rice_type || r.riceType || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r.branch_name || "—"}</td>
                      <td className="px-3 py-2">{r.klang_name || "—"}</td>
                      <td className="px-3 py-2 text-right">{net.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{baht(pricePerKg)}</td>
                      <td className="px-3 py-2 text-right">{thb(price)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 active:scale-[.98] dark:border-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                          title="แก้ไข"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm16.71-10.04a1.004 1.004 0 000-1.42l-1.5-1.5a1.004 1.004 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.99-1.66z"/>
                          </svg>
                          แก้ไข
                        </button>
                      </td>
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
              –<b>{rows.length ? endIndex.toLocaleString() : 0}</b> จาก{" "}
              <b>{rows.length.toLocaleString()}</b> รายการ
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={prevPage}
                disabled={page <= 1}
                className={[
                  "h-10 rounded-xl px-4 text-sm font-medium",
                  page <= 1
                    ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600",
                  "border border-slate-300 dark:border-slate-600",
                ].join(" ")}
              >
                ก่อนหน้า
              </button>

              <div className="flex items-center gap-1">
                {pageItems.map((it, idx) =>
                  it === "..." ? (
                    <span key={`dots-${idx}`} className="px-2 text-slate-500 dark:text-slate-300">
                      …
                    </span>
                  ) : (
                    <button
                      key={`p-${it}`}
                      type="button"
                      onClick={() => goToPage(it)}
                      className={[
                        "h-10 min-w-[40px] rounded-xl px-3 text-sm font-semibold transition",
                        it === page
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600",
                        "border border-slate-300 dark:border-slate-600",
                      ].join(" ")}
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
                className={[
                  "h-10 rounded-xl px-4 text-sm font-medium",
                  page >= totalPages
                    ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600",
                  "border border-slate-300 dark:border-slate-600",
                ].join(" ")}
              >
                ถัดไป
              </button>

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
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  / {totalPages.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* EDIT DRAWER */}
        {drawerOpen && (
          <div className="fixed inset-0 z-30">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={closeEdit}
              aria-hidden="true"
            />
            <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-auto bg-white text-black shadow-xl dark:bg-slate-800 dark:text-white">
              <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
                <div className="flex flex-col">
                  <h2 className="text-lg font-semibold">
                    แก้ไขออเดอร์ #{editingRow?.id} — {editingType === "buy" ? "ซื้อ" : "ขาย"}
                  </h2>
                  <div className="text-xs text-slate-500">
                    วันที่เดิม: {editingRow?.date ? new Date(editingRow.date).toLocaleString("th-TH") : "—"}
                  </div>
                </div>
                <button
                  onClick={closeEdit}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
                >
                  ปิด
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* ผู้แก้ไข */}
                <div>
                  <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                    รหัสผู้แก้ไข (userdata.id)
                  </label>
                  <input
                    className={baseField}
                    value={String(editorId ?? "")}
                    onChange={(e) => setEditorId(Number(e.target.value || 0))}
                    placeholder="กรอกรหัสผู้แก้ไข"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    ระบบจะส่งค่าใน <code>meta.edited_by</code> ตามที่กรอก (ค่าเริ่มต้นพยายามอ่านจาก /auth/me)
                  </div>
                </div>

                {/* วันที่ */}
                <div>
                  <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                    วันที่ (ถ้าเว้นว่าง = ไม่เปลี่ยน)
                  </label>
                  <DateInput
                    value={form.date}
                    onChange={(e) => onChangeForm("date", e.target.value)}
                  />
                </div>

                {/* สาขา/คลัง */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขา</label>
                    <ComboBox
                      options={branchOptions}
                      value={form.branchId}
                      getValue={(o) => o.id}
                      onChange={async (id) => {
                        onChangeForm("branchId", id || "")
                        onChangeForm("klangId", "")
                        try {
                          if (id) {
                            const data = await apiAuth(`/order/klang/search?branch_id=${id}`)
                            const list = (Array.isArray(data) ? data : []).map((x) => ({
                              id: String(x.id),
                              label: x.klang_name,
                            }))
                            setEditKlangOpts(list)
                          } else {
                            setEditKlangOpts([])
                          }
                        } catch {
                          setEditKlangOpts([])
                        }
                      }}
                      placeholder="— เลือกสาขา —"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">คลัง</label>
                    <ComboBox
                      options={editKlangOpts}
                      value={form.klangId}
                      getValue={(o) => o.id}
                      onChange={(id) => onChangeForm("klangId", id || "")}
                      placeholder="— เลือกคลัง —"
                      disabled={!form.branchId}
                    />
                  </div>
                </div>

                {/* Spec */}
                <div>
                  <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                    รายการสำเร็จรูป (เปลี่ยน Spec)
                  </label>
                  <ComboBox
                    options={specOptions}
                    value={form.specId}
                    getValue={(o) => o.id}
                    onChange={(id) => onChangeForm("specId", id || "")}
                    placeholder={loadingSpecs ? "— กำลังโหลด… —" : "— (ไม่เปลี่ยน) —"}
                    disabled={loadingSpecs || specOptions.length === 0}
                  />
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    ตัวเลือกมาจาก <code>/order/form/search</code> (ใช้สร้าง <code>changes.spec</code> เป็น <code>ProductSpecIn</code>)
                  </div>
                </div>

                {/* วิธีชำระ */}
                <div>
                  <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                    วิธีชำระ (ถ้าเว้นว่าง = ไม่เปลี่ยน)
                  </label>
                  <ComboBox
                    options={editingType === "buy" ? paymentBuyOptions : paymentSellOptions}
                    value={form.paymentId}
                    getValue={(o) => o.id}
                    onChange={(id) => onChangeForm("paymentId", id || "")}
                    placeholder="— เลือก —"
                  />
                </div>

                {/* ฟิลด์ตามประเภท */}
                {editingType === "buy" ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                          เลขที่ใบสำคัญ
                        </label>
                        <input
                          className={baseField}
                          value={form.order_serial}
                          onChange={(e) => onChangeForm("order_serial", e.target.value)}
                          placeholder="เว้นว่าง = ไม่เปลี่ยน"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                          ความชื้น (%)
                        </label>
                        <input
                          className={baseField}
                          value={form.humidity}
                          onChange={(e) => onChangeForm("humidity", e.target.value)}
                          placeholder="เช่น 14.5"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm">น้ำหนักขาเข้า</label>
                        <input
                          className={baseField}
                          value={form.entry_weight}
                          onChange={(e) => onChangeForm("entry_weight", e.target.value)}
                          placeholder="กก."
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm">น้ำหนักขาออก</label>
                        <input
                          className={baseField}
                          value={form.exit_weight}
                          onChange={(e) => onChangeForm("exit_weight", e.target.value)}
                          placeholder="กก."
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm">น้ำหนักสุทธิ (ถ้ามี)</label>
                        <input
                          className={baseField}
                          value={form.weight}
                          onChange={(e) => onChangeForm("weight", e.target.value)}
                          placeholder="กก."
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm">ราคาต่อกก.</label>
                        <input
                          className={baseField}
                          value={form.price_per_kilo}
                          onChange={(e) => onChangeForm("price_per_kilo", e.target.value)}
                          placeholder="เช่น 10.50"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm">เป็นเงิน</label>
                        <input
                          className={baseField}
                          value={form.price}
                          onChange={(e) => onChangeForm("price", e.target.value)}
                          placeholder="เช่น 12500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm">Gram</label>
                        <input
                          className={baseField}
                          value={form.gram}
                          onChange={(e) => onChangeForm("gram", e.target.value)}
                          placeholder="เช่น 100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm">สิ่งเจือปน (%)</label>
                      <input
                        className={baseField}
                        value={form.impurity}
                        onChange={(e) => onChangeForm("impurity", e.target.value)}
                        placeholder="เช่น 1.0"
                      />
                    </div>

                    {/* เครดิตสำหรับซื้อ (payment 4) */}
                    {showDeptForBuy && (
                      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500 dark:bg-amber-900/20">
                        <div className="mb-2 font-semibold">เงื่อนไขเครดิต (ซื้อ)</div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-sm">ให้เครดิต (วัน)</label>
                            <input
                              className={baseField}
                              value={dept.allowed_period}
                              onChange={(e) =>
                                setDept((d) => ({ ...d, allowed_period: e.target.value }))
                              }
                              placeholder="เช่น 30"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm">เลื่อนนัดชำระ</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!dept.postpone}
                                onChange={(e) =>
                                  setDept((d) => ({ ...d, postpone: e.target.checked }))
                                }
                              />
                              <span className="text-sm">ใช่</span>
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-sm">ระยะเวลาที่เลื่อน (วัน)</label>
                            <input
                              className={baseField}
                              value={dept.postpone_period}
                              onChange={(e) =>
                                setDept((d) => ({ ...d, postpone_period: e.target.value }))
                              }
                              placeholder="เช่น 7"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // SELL FORM
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm">ป้ายทะเบียน 1</label>
                        <input
                          className={baseField}
                          value={form.license_plate_1}
                          onChange={(e) => onChangeForm("license_plate_1", e.target.value)}
                          placeholder="เว้นว่าง = ไม่เปลี่ยน"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm">ป้ายทะเบียน 2</label>
                        <input
                          className={baseField}
                          value={form.license_plate_2}
                          onChange={(e) => onChangeForm("license_plate_2", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm">น้ำหนัก #1</label>
                        <input
                          className={baseField}
                          value={form.weight_1}
                          onChange={(e) => onChangeForm("weight_1", e.target.value)}
                          placeholder="กก."
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm">น้ำหนัก #2</label>
                        <input
                          className={baseField}
                          value={form.weight_2}
                          onChange={(e) => onChangeForm("weight_2", e.target.value)}
                          placeholder="กก."
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm">ราคาต่อกก.</label>
                        <input
                          className={baseField}
                          value={form.price_per_kilo}
                          onChange={(e) => onChangeForm("price_per_kilo", e.target.value)}
                          placeholder="เช่น 11.25"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm">เป็นเงิน #1</label>
                        <input
                          className={baseField}
                          value={form.price_1}
                          onChange={(e) => onChangeForm("price_1", e.target.value)}
                          placeholder="เช่น 5600"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm">เป็นเงิน #2</label>
                        <input
                          className={baseField}
                          value={form.price_2}
                          onChange={(e) => onChangeForm("price_2", e.target.value)}
                          placeholder="เช่น 3200"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm">เลขที่ใบสำคัญ #1</label>
                        <input
                          className={baseField}
                          value={form.order_serial_1}
                          onChange={(e) => onChangeForm("order_serial_1", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm">เลขที่ใบสำคัญ #2</label>
                        <input
                          className={baseField}
                          value={form.order_serial_2}
                          onChange={(e) => onChangeForm("order_serial_2", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* เครดิตสำหรับขาย (payment 2) */}
                    {showDeptForSell && (
                      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500 dark:bg-amber-900/20">
                        <div className="mb-2 font-semibold">เงื่อนไขเครดิต (ขาย)</div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-sm">ให้เครดิต (วัน)</label>
                            <input
                              className={baseField}
                              value={dept.allowed_period}
                              onChange={(e) =>
                                setDept((d) => ({ ...d, allowed_period: e.target.value }))
                              }
                              placeholder="เช่น 30"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm">เลื่อนนัดชำระ</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!dept.postpone}
                                onChange={(e) =>
                                  setDept((d) => ({ ...d, postpone: e.target.checked }))
                                }
                              />
                              <span className="text-sm">ใช่</span>
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-sm">ระยะเวลาที่เลื่อน (วัน)</label>
                            <input
                              className={baseField}
                              value={dept.postpone_period}
                              onChange={(e) =>
                                setDept((d) => ({ ...d, postpone_period: e.target.value }))
                              }
                              placeholder="เช่น 7"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* หมายเหตุแก้ไข */}
                <div>
                  <label className="mb-1 block text-sm">เหตุผลในการแก้ไข (optional)</label>
                  <textarea
                    className={baseField}
                    value={form.reason}
                    onChange={(e) => onChangeForm("reason", e.target.value)}
                    rows={3}
                    placeholder="บันทึกเหตุผลสำหรับ audit log"
                  />
                </div>

                {/* Comment */}
                <div>
                  <label className="mb-1 block text-sm">หมายเหตุในออเดอร์ (comment)</label>
                  <textarea
                    className={baseField}
                    value={form.comment}
                    onChange={(e) => onChangeForm("comment", e.target.value)}
                    rows={3}
                    placeholder="เว้นว่าง = ไม่เปลี่ยน"
                  />
                </div>
              </div>

              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs text-slate-500">
                  * ถ้าเว้นว่าง ฟิลด์นั้นจะไม่ถูกส่งไปแก้ไข (partial patch)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={closeEdit}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={submitEdit}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[.98]"
                  >
                    บันทึกการแก้ไข
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderCorrection
