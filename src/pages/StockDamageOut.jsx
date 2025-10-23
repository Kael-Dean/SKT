// src/pages/StockTransferOut.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { get, post } from "../lib/api" // ✅ helper API กลาง

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toInt = (v) => {
  const n = Number(onlyDigits(String(v ?? "")))
  return Number.isFinite(n) ? n : 0
}
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
const cx = (...a) => a.filter(Boolean).join(" ")
const focusSmooth = (el) => {
  if (!el) return
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.focus?.({ preventScroll: true })
    if (typeof el.select === "function" && !el.readOnly && !el.disabled) el.select()
    if (el.tagName?.toLowerCase() === "input" && el.type === "date") el.showPicker?.()
  } catch {
    el.focus?.()
  }
}

/** ---------- Styles ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const fieldDisabled =
  "bg-slate-100 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- ComboBox (รองรับ Enter Navigation) ---------- */
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.id ?? o?.value ?? "",
  disabled = false,
  error = false,
  buttonRef = null,
  hintRed = false,
  clearHint = () => {},
  onAdvance = () => {}, // ✅ เรียกเมื่อกด Enter เพื่อไปช่องถัดไป
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const internalBtnRef = useRef(null)
  const controlRef = buttonRef || internalBtnRef

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

  const commit = (opt, { advance = false } = {}) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    clearHint?.()
    if (advance) {
      requestAnimationFrame(() => onAdvance?.())
    } else {
      requestAnimationFrame(() => controlRef.current?.focus())
    }
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
    // ---- Enter Navigation (ปิดอยู่) ----
    if (!open && e.key === "Enter") {
      e.preventDefault()
      // ถ้ายังไม่ได้เลือกค่า → เปิด dropdown และไฮไลต์ตัวแรก
      if (!value) {
        setOpen(true)
        setHighlight(0)
        clearHint?.()
      } else {
        // ถ้ามีค่าแล้ว → ไปช่องถัดไป
        onAdvance?.()
      }
      return
    }
    // ---- toggle & เปิดด้วย Space/ArrowDown ตามปกติ ----
    if (!open && (e.key === " " || e.key === "ArrowDown")) {
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
      if (highlight >= 0 && highlight < options.length) {
        // เลือกแล้วไปต่อเลย
        commit(options[highlight], { advance: true })
      }
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
        onClick={() => {
          if (!disabled) {
            setOpen((o) => !o)
            clearHint?.()
          }
        }}
        onKeyDown={onKeyDown}
        onFocus={() => clearHint?.()}
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
        {selectedLabel || <span className="text-slate-500 dark:text-white/70">{placeholder}</span>}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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

/** ---------- DateInput (รองรับ Enter Navigation) ---------- */
const DateInput = forwardRef(function DateInput({ error = false, className = "", onEnter = () => {}, ...props }, ref) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input
        type="date"
        ref={inputRef}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            onEnter?.()
          }
        }}
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

/** ---------- Page ---------- */
function StockTransferOut() {
  const [submitting, setSubmitting] = useState(false)

  /** ---------- Dropdown states ---------- */
  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])      // species
  const [subriceOptions, setSubriceOptions] = useState([]) // variant

  const [fromBranchOptions, setFromBranchOptions] = useState([])
  const [toBranchOptions, setToBranchOptions] = useState([])
  const [fromKlangOptions, setFromKlangOptions] = useState([])
  const [toKlangOptions, setToKlangOptions] = useState([])

  // ✅ เมตาดาต้า
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldOptions, setFieldOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    transfer_date: new Date().toISOString().slice(0, 10),

    from_branch_id: null,
    from_branch_name: "",
    from_klang_id: null,
    from_klang_name: "",

    to_branch_id: null,
    to_branch_name: "",
    to_klang_id: null,
    to_klang_name: "",

    // ✅ ใหม่
    driver_name: "",     // ชื่อผู้ขนส่ง
    plate_number: "",    // ทะเบียนรถ

    product_id: "",
    product_name: "",
    rice_id: "",
    rice_type: "",
    subrice_id: "",
    subrice_name: "",

    condition_id: "",
    condition_label: "",
    field_type_id: "",
    field_type_label: "",
    rice_year_id: "",
    rice_year_label: "",
    program_id: "",
    program_label: "",
    business_type_id: "",
    business_type_label: "",

    // ชั่งรถ
    weight_in: "",   // รถเปล่า (ขาเข้าโรงชั่ง)
    weight_out: "",  // รถ + ข้าว (ขาออก)
    cost_per_kg: "",
    quality_note: "",

    impurity_percent: "",
  })

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  /** ---------- Derived ---------- */
  const weightIn = useMemo(() => toInt(form.weight_in), [form.weight_in])     // รถเปล่า
  const weightOut = useMemo(() => toInt(form.weight_out), [form.weight_out])  // รถ + ข้าว
  const netWeightInt = useMemo(() => Math.max(weightOut - weightIn, 0), [weightIn, weightOut])

  const costPerKg = useMemo(() => Number(form.cost_per_kg || 0), [form.cost_per_kg])
  const totalCost = useMemo(() => costPerKg * netWeightInt, [costPerKg, netWeightInt])

  /** ---------- Errors / hints ---------- */
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const hasRed = (key) => !!errors[key] || !!missingHints[key]
  const redFieldCls = (key) => (hasRed(key) ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : "")
  const redHintCls = (key) => (missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : "")
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })

  /** ---------- Refs: ใช้กับ Enter Navigation ---------- */
  const transferDateRef = useRef(null)

  const driverNameRef = useRef(null)
  const plateNumberRef = useRef(null)

  const fromBranchBtnRef = useRef(null)
  const fromKlangBtnRef = useRef(null)
  const toBranchBtnRef = useRef(null)
  const toKlangBtnRef = useRef(null)

  const productBtnRef = useRef(null)
  const riceBtnRef = useRef(null)
  const subriceBtnRef = useRef(null)

  const fieldTypeBtnRef = useRef(null)
  const yearBtnRef = useRef(null)
  const programBtnRef = useRef(null)
  const businessBtnRef = useRef(null) // disabled, ใช้สำหรับลำดับ/ข้าม

  const weightInRef = useRef(null)
  const weightOutRef = useRef(null)
  const costPerKgRef = useRef(null)
  const impurityRef = useRef(null)
  const qualityNoteRef = useRef(null)

  const submitBtnRef = useRef(null)

  const refMap = {
    transfer_date: transferDateRef,
    driver_name: driverNameRef,
    plate_number: plateNumberRef,

    from_branch_id: fromBranchBtnRef,
    from_klang_id: fromKlangBtnRef,
    to_branch_id: toBranchBtnRef,
    to_klang_id: toKlangBtnRef,

    product_id: productBtnRef,
    rice_id: riceBtnRef,
    subrice_id: subriceBtnRef,

    field_type_id: fieldTypeBtnRef,
    rice_year_id: yearBtnRef,
    program_id: programBtnRef,
    business_type_id: businessBtnRef,

    weight_in: weightInRef,
    weight_out: weightOutRef,
    cost_per_kg: costPerKgRef,
    impurity_percent: impurityRef,
    quality_note: qualityNoteRef,

    submit: submitBtnRef,
  }

  const isFieldDisabled = (key) => {
    switch (key) {
      case "from_klang_id":
        return !form.from_branch_id
      case "to_klang_id":
        return !form.to_branch_id
      case "rice_id":
        return !form.product_id
      case "subrice_id":
        return !form.rice_id
      case "business_type_id":
        return true
      case "condition_id":
        return true
      case "net_weight":
      case "total_cost":
        return true
      default:
        return !!refMap[key]?.current?.disabled
    }
  }

  const focusField = (key) => {
    if (key == null) return false
    if (key !== "submit" && isFieldDisabled(key)) return false
    const el = refMap[key]?.current
    if (!el) return false
    if (el.disabled) return false
    focusSmooth(el)
    return true
  }

  // ลำดับซ้าย→ขวา บน→ล่าง จบที่ปุ่ม submit
  const navOrder = [
    "transfer_date",
    "driver_name",
    "plate_number",

    "from_branch_id",
    "from_klang_id",
    "to_branch_id",
    "to_klang_id",

    "product_id",
    "rice_id",
    "subrice_id",

    // "condition_id",  // ปิดไว้ ข้าม
    "field_type_id",
    "rice_year_id",
    "program_id",
    // "business_type_id",  // ปิดไว้ ข้าม

    "weight_in",
    "weight_out",
    // "net_weight", // disabled
    "cost_per_kg",
    // "total_cost", // disabled
    "impurity_percent",
    "quality_note",

    "submit",
  ]

  const focusNextFrom = (currentKey) => {
    const idx = navOrder.indexOf(currentKey)
    for (let i = idx + 1; i < navOrder.length; i++) {
      const key = navOrder[i]
      if (focusField(key)) return key
    }
    return null
  }

  /** ---------- Load dropdowns ---------- */
  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [products, branches, conditions, fields, years, programs, businesses] = await Promise.all([
          get("/order/product/search"),
          get("/order/branch/search"),
          get("/order/condition/search"),
          get("/order/field/search"),
          get("/order/year/search"),
          get("/order/program/search"),
          get("/order/business/search"),
        ])

        setProductOptions(
          (products || [])
            .map((x) => ({
              id: String(x.id ?? x.product_id ?? x.value ?? ""),
              label: String(x.product_type ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        const brs = (branches || []).map((b) => ({ id: b.id, label: b.branch_name }))
        setFromBranchOptions(brs)
        setToBranchOptions(brs)

        // 🔒 เงื่อนไข → แห้ง
        const allConds = (conditions || []).map((c) => ({ id: c.id, label: c.condition }))
        const dryCond = allConds.find((c) => c.label === "แห้ง")
        setConditionOptions(dryCond ? [dryCond] : [])
        update("condition_id", dryCond?.id ?? "")
        update("condition_label", dryCond?.label ?? "")

        setFieldOptions(
          (fields || [])
            .map((f) => ({ id: f.id, label: f.field ?? f.field_type ?? "" }))
            .filter((o) => o.id && o.label)
        )

        setYearOptions((years || []).map((y) => ({ id: y.id, label: y.year })))
        setProgramOptions((programs || []).map((p) => ({ id: p.id, label: p.program })))

        // 🔒 ประเภทธุรกิจ → ซื้อมาขายไป
        const allBiz = (businesses || []).map((b) => ({ id: b.id, label: b.business }))
        const buySell = allBiz.find((b) => b.label === "ซื้อมาขายไป")
        setBusinessOptions(buySell ? [buySell] : [])
        update("business_type_id", buySell?.id ?? "")
        update("business_type_label", buySell?.label ?? "")
      } catch (e) {
        console.error("load static error:", e)
        setProductOptions([])
        setFromBranchOptions([])
        setToBranchOptions([])
        setConditionOptions([])
        setFieldOptions([])
        setYearOptions([])
        setProgramOptions([])
        setBusinessOptions([])
      }
    }
    loadStatic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // product -> species
  useEffect(() => {
    const pid = form.product_id
    setRiceOptions([])
    setSubriceOptions([])
    update("rice_id", "")
    update("rice_type", "")
    update("subrice_id", "")
    update("subrice_name", "")
    if (!pid) return

    const loadSpecies = async () => {
      try {
        const arr = await get(`/order/species/search?product_id=${encodeURIComponent(pid)}`)
        const mapped = (arr || [])
          .map((x) => ({
            id: String(x.id ?? x.species_id ?? x.value ?? ""),
            label: String(x.species ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setRiceOptions(mapped)
      } catch (e) {
        console.error("load species error:", e)
        setRiceOptions([])
      }
    }
    loadSpecies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_id])

  // species -> variant
  useEffect(() => {
    const sid = form.rice_id
    setSubriceOptions([])
    update("subrice_id", "")
    update("subrice_name", "")
    if (!sid) return

    const loadVariant = async () => {
      try {
        const arr = await get(`/order/variant/search?species_id=${encodeURIComponent(sid)}`)
        const mapped = (arr || [])
          .map((x) => ({
            id: String(x.id ?? x.variant_id ?? x.value ?? ""),
            label: String(x.variant ?? x.sub_class ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setSubriceOptions(mapped)
      } catch (e) {
        console.error("load variant error:", e)
        setSubriceOptions([])
      }
    }
    loadVariant()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.rice_id])

  // โหลดคลัง (ต้นทาง)
  useEffect(() => {
    const bid = form.from_branch_id
    const bname = form.from_branch_name?.trim()
    if (bid == null && !bname) {
      setFromKlangOptions([])
      update("from_klang_id", null)
      update("from_klang_name", "")
      return
    }
    const loadKlang = async () => {
      try {
        const qs = bid != null ? `branch_id=${bid}` : `branch_name=${encodeURIComponent(bname)}`
        const arr = await get(`/order/klang/search?${qs}`)
        setFromKlangOptions((arr || []).map((k) => ({ id: k.id, label: k.klang_name })))
      } catch (e) {
        console.error("Load from klang error:", e)
        setFromKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.from_branch_id, form.from_branch_name])

  // โหลดคลัง (ปลายทาง)
  useEffect(() => {
    const bid = form.to_branch_id
    const bname = form.to_branch_name?.trim()
    if (bid == null && !bname) {
      setToKlangOptions([])
      update("to_klang_id", null)
      update("to_klang_name", "")
      return
    }
    const loadKlang = async () => {
      try {
        const qs = bid != null ? `branch_id=${bid}` : `branch_name=${encodeURIComponent(bname)}`
        const arr = await get(`/order/klang/search?${qs}`)
        setToKlangOptions((arr || []).map((k) => ({ id: k.id, label: k.klang_name })))
      } catch (e) {
        console.error("Load to klang error:", e)
        setToKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.to_branch_id, form.to_branch_name])

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.transfer_date) m.transfer_date = true

    if (!form.from_branch_id) m.from_branch_id = true
    if (!form.from_klang_id) m.from_klang_id = true
    if (!form.to_branch_id) m.to_branch_id = true
    if (!form.to_klang_id) m.to_klang_id = true
    if (form.from_branch_id && form.to_branch_id && String(form.from_branch_id) === String(form.to_branch_id)) {
      m.to_branch_id = true
    }

    if (!form.driver_name?.trim()) m.driver_name = true
    if (!form.plate_number?.trim()) m.plate_number = true

    if (!form.product_id) m.product_id = true
    if (!form.rice_id) m.rice_id = true
    if (!form.subrice_id) m.subrice_id = true

    if (!form.field_type_id) m.field_type_id = true
    if (!form.business_type_id) m.business_type_id = true

    if (form.weight_in === "" || toInt(form.weight_in) <= 0) m.weight_in = true
    if (form.weight_out === "" || toInt(form.weight_out) <= 0) m.weight_out = true
    if (toInt(form.weight_out) <= toInt(form.weight_in)) m.weight_out = true
    if (netWeightInt <= 0) m.net_weight = true

    if (form.cost_per_kg !== "" && Number(form.cost_per_kg) < 0) m.cost_per_kg = true

    return m
  }

  const validate = () => {
    const e = {}
    if (!form.transfer_date) e.transfer_date = "กรุณาเลือกวันที่โอน"

    if (!form.from_branch_id) e.from_branch_id = "กรุณาเลือกสาขาต้นทาง"
    if (!form.from_klang_id) e.from_klang_id = "กรุณาเลือกคลังต้นทาง"
    if (!form.to_branch_id) e.to_branch_id = "กรุณาเลือกสาขาปลายทาง"
    if (!form.to_klang_id) e.to_klang_id = "กรุณาเลือกคลังปลายทาง"
    if (form.from_branch_id && form.to_branch_id && String(form.from_branch_id) === String(form.to_branch_id)) {
      e.to_branch_id = "สาขาต้นทาง/ปลายทาง ต้องไม่ซ้ำกัน"
    }

    if (!form.driver_name?.trim()) e.driver_name = "กรุณากรอกชื่อผู้ขนส่ง"
    if (!form.plate_number?.trim()) e.plate_number = "กรุณากรอกทะเบียนรถ"

    if (!form.product_id) e.product_id = "กรุณาเลือกประเภทสินค้า"
    if (!form.rice_id) e.rice_id = "กรุณาเลือกชนิดข้าว"
    if (!form.subrice_id) e.subrice_id = "กรุณาเลือกชั้นย่อย"

    if (!form.field_type_id) e.field_type_id = "กรุณาเลือกประเภทนา"
    if (!form.business_type_id) e.business_type_id = "กรุณาเลือกประเภทธุรกิจ"

    const tIn = toInt(form.weight_in)
    const tOut = toInt(form.weight_out)
    if (tIn <= 0) e.weight_in = "น้ำหนักขาเข้า (รถเปล่า) ต้องมากกว่า 0"
    if (tOut <= 0) e.weight_out = "น้ำหนักขาออก (รถ+ข้าว) ต้องมากกว่า 0"
    if (tOut <= tIn) e.weight_out = "น้ำหนักขาออก ต้องมากกว่า น้ำหนักขาเข้า"
    if (netWeightInt <= 0) e.net_weight = "น้ำหนักสุทธิต้องมากกว่า 0 (ขาออก − ขาเข้า)"

    if (form.cost_per_kg !== "" && Number(form.cost_per_kg) < 0) e.cost_per_kg = "ราคาต้นทุนต้องไม่ติดลบ"

    if (form.impurity_percent !== "") {
      const ip = Number(form.impurity_percent)
      if (!isFinite(ip) || ip < 0 || ip > 100) e.impurity_percent = "กรุณากรอก 0–100"
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  /** ---------- Builders ---------- */
  const buildSpec = () => {
    const product_id = /^\d+$/.test(form.product_id) ? Number(form.product_id) : form.product_id
    const species_id = /^\d+$/.test(form.rice_id) ? Number(form.rice_id) : form.rice_id
    const variant_id = /^\d+$/.test(form.subrice_id) ? Number(form.subrice_id) : form.subrice_id

    return {
      product_id,
      species_id,
      variant_id,
      product_year: form.rice_year_id ? Number(form.rice_year_id) : null,
      condition_id: form.condition_id ? Number(form.condition_id) : null,
      field_type: form.field_type_id ? Number(form.field_type_id) : null,
      program: form.program_id ? Number(form.program_id) : null,
      business_type: form.business_type_id ? Number(form.business_type_id) : null,
    }
  }

  const lookupOriginStock = async (transferQty) => {
    try {
      const body = { klang_id: Number(form.from_klang_id), spec: buildSpec() }
      const rows = await post("/transfer/stock/lookup", body)
      if (!rows || rows.length === 0) throw new Error("ไม่พบสต็อกต้นทางของสเปกนี้ในคลังที่เลือก")
      const available = Number(rows[0].available ?? 0)
      if (available < transferQty) {
        throw new Error(`สต็อกคงเหลือต้นทางไม่พอ (คงเหลือ ${available.toLocaleString()} กก.)`)
      }
      return true
    } catch (err) {
      throw err
    }
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()
    const hints = computeMissingHints()
    setMissingHints(hints)
    if (!validate()) return

    const transferQty = netWeightInt // ✅ ต้องเป็นจำนวนเต็มกก.
    if (!(transferQty > 0)) {
      setErrors((prev) => ({ ...prev, net_weight: "น้ำหนักสุทธิไม่ถูกต้อง" }))
      return
    }

    setSubmitting(true)
    try {
      // ✅ Pre-check: สต็อกต้นทาง
      await lookupOriginStock(transferQty)

      const payload = {
        date: form.transfer_date,

        from_branch: form.from_branch_id != null ? Number(form.from_branch_id) : null,
        from_klang: form.from_klang_id != null ? Number(form.from_klang_id) : 0,

        to_branch: form.to_branch_id != null ? Number(form.to_branch_id) : null,
        to_klang: form.to_klang_id != null ? Number(form.to_klang_id) : null,

        driver_name: form.driver_name.trim(),
        plate_number: form.plate_number.trim(),

        spec: buildSpec(),

        // ⚖️ บันทึกค่าชั่ง (รถเปล่า/รถ+ข้าว)
        entry_weight: toInt(form.weight_in),   // รถเปล่า
        exit_weight: toInt(form.weight_out),   // รถ + ข้าว

        // ✅ น้ำหนักสุทธิ = ขาออก − ขาเข้า
        weight: transferQty,
        impurity: form.impurity_percent === "" ? 0 : Number(form.impurity_percent),

        // ราคา (อาจว่างได้)
        price_per_kilo: Number(form.cost_per_kg) || 0,
        price: (Number(form.cost_per_kg) || 0) * transferQty,

        quality: 0,

        // ใช้จำนวนย้ายตาม net เป็นจำนวนเต็ม
        transfer_qty: transferQty,

        // บันทึกเพิ่มเติม/เหตุผล (ผู้โอน)
        sender_note: form.quality_note?.trim() || null,
      }

      await post("/transfer/request", payload)

      alert("บันทึกคำขอโอนออกสำเร็จ ✅")
      setForm((f) => ({
        ...f,
        weight_in: "",
        weight_out: "",
        cost_per_kg: "",
        impurity_percent: "",
        // คงค่า quality_note (บันทึกเพิ่มเติม) ไว้ ไม่ล้าง
      }))
      requestAnimationFrame(() => focusField("weight_in"))
    } catch (err) {
      console.error(err)
      alert(err?.message || "เกิดข้อผิดพลาดระหว่างบันทึก")
    } finally {
      setSubmitting(false)
    }
  }

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🚚 โอนออกข้าวเปลือก</h1>

        <form onSubmit={handleSubmit}>
          {/* กล่องข้อมูลการโอน */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ข้อมูลการโอน</h2>

            <div className="grid gap-4 md:grid-cols-3">
              {/* วันที่ */}
              <div>
                <label className={labelCls}>วันที่โอน</label>
                <DateInput
                  ref={transferDateRef}
                  value={form.transfer_date}
                  onEnter={() => focusNextFrom("transfer_date")}
                  onChange={(e) => {
                    clearError("transfer_date")
                    clearHint("transfer_date")
                    update("transfer_date", e.target.value)
                  }}
                  error={!!errors.transfer_date}
                  className={redHintCls("transfer_date")}
                  aria-invalid={errors.transfer_date ? true : undefined}
                />
                {errors.transfer_date && <p className={errorTextCls}>{errors.transfer_date}</p>}
              </div>

              {/* ✅ ชื่อผู้ขนส่ง */}
              <div>
                <label className={labelCls}>ชื่อผู้ขนส่ง</label>
                <input
                  ref={driverNameRef}
                  className={cx(baseField, redFieldCls("driver_name"))}
                  value={form.driver_name}
                  onChange={(e) => update("driver_name", e.target.value)}
                  onFocus={() => {
                    clearError("driver_name")
                    clearHint("driver_name")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusNextFrom("driver_name")
                    }
                  }}
                  placeholder="เช่น นายสมชาย ขยันงาน"
                  aria-invalid={errors.driver_name ? true : undefined}
                />
                {errors.driver_name && <p className={errorTextCls}>{errors.driver_name}</p>}
              </div>

              {/* ✅ ทะเบียนรถ */}
              <div>
                <label className={labelCls}>ทะเบียนรถขนส่ง</label>
                <input
                  ref={plateNumberRef}
                  className={cx(baseField, redFieldCls("plate_number"))}
                  value={form.plate_number}
                  onChange={(e) => update("plate_number", e.target.value)}
                  onFocus={() => {
                    clearError("plate_number")
                    clearHint("plate_number")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusNextFrom("plate_number")
                    }
                  }}
                  placeholder="เช่น 1ขข-1234 กทม."
                  aria-invalid={errors.plate_number ? true : undefined}
                />
                {errors.plate_number && <p className={errorTextCls}>{errors.plate_number}</p>}
              </div>

              {/* ต้นทาง */}
              <div>
                <label className={labelCls}>สาขาต้นทาง</label>
                <ComboBox
                  buttonRef={fromBranchBtnRef}
                  options={fromBranchOptions}
                  value={form.from_branch_id}
                  getValue={(o) => o.id}
                  onChange={(_val, found) => {
                    clearError("from_branch_id")
                    clearHint("from_branch_id")
                    update("from_branch_id", found?.id ?? null)
                    update("from_branch_name", found?.label ?? "")
                    update("from_klang_id", null)
                    update("from_klang_name", "")
                  }}
                  placeholder="— เลือกสาขาต้นทาง —"
                  error={!!errors.from_branch_id}
                  hintRed={!!missingHints.from_branch_id}
                  onAdvance={() => focusNextFrom("from_branch_id")}
                />
                {errors.from_branch_id && <p className={errorTextCls}>{errors.from_branch_id}</p>}
              </div>

              <div>
                <label className={labelCls}>คลังต้นทาง</label>
                <ComboBox
                  buttonRef={fromKlangBtnRef}
                  options={fromKlangOptions}
                  value={form.from_klang_id}
                  getValue={(o) => o.id}
                  onChange={(_val, found) => {
                    clearError("from_klang_id")
                    clearHint("from_klang_id")
                    update("from_klang_id", found?.id ?? null)
                    update("from_klang_name", found?.label ?? "")
                  }}
                  placeholder="— เลือกคลังต้นทาง —"
                  disabled={!form.from_branch_id}
                  error={!!errors.from_klang_id}
                  hintRed={!!missingHints.from_klang_id}
                  onAdvance={() => focusNextFrom("from_klang_id")}
                />
                {errors.from_klang_id && <p className={errorTextCls}>{errors.from_klang_id}</p>}
              </div>

              <div className="hidden md:block" />

              {/* ปลายทาง */}
              <div>
                <label className={labelCls}>สาขาปลายทาง</label>
                <ComboBox
                  buttonRef={toBranchBtnRef}
                  options={toBranchOptions}
                  value={form.to_branch_id}
                  getValue={(o) => o.id}
                  onChange={(_val, found) => {
                    clearError("to_branch_id")
                    clearHint("to_branch_id")
                    update("to_branch_id", found?.id ?? null)
                    update("to_branch_name", found?.label ?? "")
                    update("to_klang_id", null)
                    update("to_klang_name", "")
                  }}
                  placeholder="— เลือกสาขาปลายทาง —"
                  error={!!errors.to_branch_id}
                  hintRed={!!missingHints.to_branch_id}
                  onAdvance={() => focusNextFrom("to_branch_id")}
                />
                {errors.to_branch_id && <p className={errorTextCls}>{errors.to_branch_id}</p>}
              </div>

              <div>
                <label className={labelCls}>คลังปลายทาง</label>
                <ComboBox
                  buttonRef={toKlangBtnRef}
                  options={toKlangOptions}
                  value={form.to_klang_id}
                  getValue={(o) => o.id}
                  onChange={(_val, found) => {
                    clearError("to_klang_id")
                    clearHint("to_klang_id")
                    update("to_klang_id", found?.id ?? null)
                    update("to_klang_name", found?.label ?? "")
                  }}
                  placeholder="— เลือกคลังปลายทาง —"
                  disabled={!form.to_branch_id}
                  error={!!errors.to_klang_id}
                  hintRed={!!missingHints.to_klang_id}
                  onAdvance={() => focusNextFrom("to_klang_id")}
                />
                {errors.to_klang_id && <p className={errorTextCls}>{errors.to_klang_id}</p>}
              </div>

              <div className="hidden md:block" />
            </div>
          </div>

          {/* สินค้า + เมตาดาต้า */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">สินค้า / คุณสมบัติ (ข้าวเปลือก)</h2>

            <div className="grid gap-4 md:grid-cols-3">
              {/* ประเภทสินค้า */}
              <div>
                <label className={labelCls}>ประเภทสินค้า</label>
                <ComboBox
                  buttonRef={productBtnRef}
                  options={productOptions}
                  value={form.product_id}
                  onChange={(id, found) => {
                    clearError("product_id")
                    clearHint("product_id")
                    update("product_id", id)
                    update("product_name", found?.label ?? "")
                    update("rice_id", "")
                    update("rice_type", "")
                    update("subrice_id", "")
                    update("subrice_name", "")
                  }}
                  placeholder="— เลือกประเภทสินค้า —"
                  error={!!errors.product_id}
                  hintRed={!!missingHints.product_id}
                  onAdvance={() => focusNextFrom("product_id")}
                />
                {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
              </div>

              {/* ชนิดข้าว */}
              <div>
                <label className={labelCls}>ชนิดข้าว</label>
                <ComboBox
                  buttonRef={riceBtnRef}
                  options={riceOptions}
                  value={form.rice_id}
                  onChange={(id, found) => {
                    clearError("rice_id")
                    clearHint("rice_id")
                    update("rice_id", id)
                    update("rice_type", found?.label ?? "")
                    update("subrice_id", "")
                    update("subrice_name", "")
                  }}
                  placeholder="— เลือกชนิดข้าว —"
                  disabled={!form.product_id}
                  error={!!errors.rice_id}
                  hintRed={!!missingHints.rice_id}
                  onAdvance={() => focusNextFrom("rice_id")}
                />
                {errors.rice_id && <p className={errorTextCls}>{errors.rice_id}</p>}
              </div>

              {/* ชั้นย่อย */}
              <div>
                <label className={labelCls}>ชั้นย่อย (Sub-class)</label>
                <ComboBox
                  buttonRef={subriceBtnRef}
                  options={subriceOptions}
                  value={form.subrice_id}
                  onChange={(id, found) => {
                    clearError("subrice_id")
                    clearHint("subrice_id")
                    update("subrice_id", id)
                    update("subrice_name", found?.label ?? "")
                  }}
                  placeholder="— เลือกชั้นย่อย —"
                  disabled={!form.rice_id}
                  error={!!errors.subrice_id}
                  hintRed={!!missingHints.subrice_id}
                  onAdvance={() => focusNextFrom("subrice_id")}
                />
                {errors.subrice_id && <p className={errorTextCls}>{errors.subrice_id}</p>}
              </div>

              {/* สภาพ/เงื่อนไข (locked → แห้ง) */}
              <div>
                <label className={labelCls}>สภาพ/เงื่อนไข</label>
                <ComboBox
                  buttonRef={undefined}
                  options={conditionOptions}
                  value={form.condition_id}
                  onChange={(id, found) => {
                    update("condition_id", id)
                    update("condition_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกสภาพ/เงื่อนไข —"
                  disabled
                />
              </div>

              {/* ประเภทนา */}
              <div>
                <label className={labelCls}>ประเภทนา</label>
                <ComboBox
                  buttonRef={fieldTypeBtnRef}
                  options={fieldOptions}
                  value={form.field_type_id}
                  onChange={(id, found) => {
                    clearError("field_type_id")
                    clearHint("field_type_id")
                    update("field_type_id", id)
                    update("field_type_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกประเภทนา —"
                  error={!!errors.field_type_id}
                  hintRed={!!missingHints.field_type_id}
                  onAdvance={() => focusNextFrom("field_type_id")}
                />
                {errors.field_type_id && <p className={errorTextCls}>{errors.field_type_id}</p>}
              </div>

              {/* ปี/ฤดูกาล */}
              <div>
                <label className={labelCls}>ปี/ฤดูกาล</label>
                <ComboBox
                  buttonRef={yearBtnRef}
                  options={yearOptions}
                  value={form.rice_year_id}
                  onChange={(id, found) => {
                    update("rice_year_id", id)
                    update("rice_year_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกปี/ฤดูกาล —"
                  onAdvance={() => focusNextFrom("rice_year_id")}
                />
              </div>

              {/* โปรแกรม */}
              <div>
                <label className={labelCls}>โปรแกรม (ไม่บังคับ)</label>
                <ComboBox
                  buttonRef={programBtnRef}
                  options={programOptions}
                  value={form.program_id}
                  onChange={(id, found) => {
                    update("program_id", id)
                    update("program_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกโปรแกรม —"
                  onAdvance={() => focusNextFrom("program_id")}
                />
              </div>

              {/* ประเภทธุรกิจ (locked → ซื้อมาขายไป) */}
              <div>
                <label className={labelCls}>ประเภทธุรกิจ</label>
                <ComboBox
                  buttonRef={businessBtnRef}
                  options={businessOptions}
                  value={form.business_type_id}
                  onChange={(id, found) => {
                    clearError("business_type_id")
                    clearHint("business_type_id")
                    update("business_type_id", id)
                    update("business_type_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกประเภทธุรกิจ —"
                  error={!!errors.business_type_id}
                  hintRed={!!missingHints.business_type_id}
                  disabled
                />
                {errors.business_type_id && <p className={errorTextCls}>{errors.business_type_id}</p>}
              </div>
            </div>
          </div>

          {/* ชั่ง/ราคา */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ชั่งน้ำหนักและต้นทุน</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={labelCls}>น้ำหนักขาเข้า (รถเปล่า) กก.</label>
                <input
                  ref={weightInRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, redFieldCls("weight_in"))}
                  value={form.weight_in}
                  onChange={(e) => update("weight_in", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("weight_in")
                    clearHint("weight_in")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusNextFrom("weight_in")
                    }
                  }}
                  placeholder="เช่น 9000"
                  aria-invalid={errors.weight_in ? true : undefined}
                />
                {errors.weight_in && <p className={errorTextCls}>{errors.weight_in}</p>}
                <p className={helpTextCls}>* ต้องเป็นจำนวนเต็มกิโลกรัม</p>
              </div>

              <div>
                <label className={labelCls}>น้ำหนักขาออก (รถ + ข้าว) กก.</label>
                <input
                  ref={weightOutRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, redFieldCls("weight_out"))}
                  value={form.weight_out}
                  onChange={(e) => update("weight_out", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("weight_out")
                    clearHint("weight_out")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusNextFrom("weight_out")
                    }
                  }}
                  placeholder="เช่น 24000"
                  aria-invalid={errors.weight_out ? true : undefined}
                />
                {errors.weight_out && <p className={errorTextCls}>{errors.weight_out}</p>}
                <p className={helpTextCls}>* ต้องเป็นจำนวนเต็มกิโลกรัม และมากกว่า “ขาเข้า”</p>
              </div>

              <div>
                <label className={labelCls}>น้ำหนักสุทธิ (กก.)</label>
                <input disabled className={cx(baseField, fieldDisabled)} value={netWeightInt} />
                {errors.net_weight && <p className={errorTextCls}>{errors.net_weight}</p>}
                <p className={helpTextCls}>คำนวณ = น้ำหนักขาออก − น้ำหนักขาเข้า</p>
              </div>

              <div>
                <label className={labelCls}>ราคาต้นทุน (บาท/กก.)</label>
                <input
                  ref={costPerKgRef}
                  inputMode="decimal"
                  className={cx(baseField, errors.cost_per_kg && "border-red-400")}
                  value={form.cost_per_kg}
                  onChange={(e) => update("cost_per_kg", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => clearError("cost_per_kg")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusNextFrom("cost_per_kg")
                    }
                  }}
                  placeholder="เช่น 8.50"
                  aria-invalid={errors.cost_per_kg ? true : undefined}
                />
                {errors.cost_per_kg && <p className={errorTextCls}>{errors.cost_per_kg}</p>}
              </div>

              <div>
                <label className={labelCls}>ราคาสุทธิ (บาท)</label>
                <input disabled className={cx(baseField, fieldDisabled)} value={thb(totalCost)} />
                <p className={helpTextCls}>คำนวณ = ราคาต้นทุน × น้ำหนักสุทธิ</p>
              </div>

              {/* สิ่งเจือปน (%) */}
              <div>
                <label className={labelCls}>สิ่งเจือปน (%)</label>
                <input
                  ref={impurityRef}
                  inputMode="decimal"
                  className={cx(baseField, errors.impurity_percent && "border-red-400")}
                  value={form.impurity_percent}
                  onChange={(e) => update("impurity_percent", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => clearError("impurity_percent")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusNextFrom("impurity_percent")
                    }
                  }}
                  placeholder="เช่น 2.5"
                  aria-invalid={errors.impurity_percent ? true : undefined}
                />
                {errors.impurity_percent && <p className={errorTextCls}>{errors.impurity_percent}</p>}
                <p className={helpTextCls}>กรอกเป็นตัวเลข 0–100 (เว้นว่างได้)</p>
              </div>
            </div>
          </div>

          {/* บันทึกเพิ่มเติม (ผู้โอน) — เหมือนหน้า 'รับเข้า' */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <label className={labelCls}>บันทึกเพิ่มเติม / เหตุผล (ผู้โอน)</label>
                <input
                  ref={qualityNoteRef}
                  className={baseField}
                  value={form.quality_note}
                  onChange={(e) => update("quality_note", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusNextFrom("quality_note")
                    }
                  }}
                  placeholder="เช่น โอนระบายสต็อกจากสาขา A ไปสาขา B เพื่อเตรียมขายโครงการ X"
                />
              </div>
            </div>
          </div>

          {/* ปุ่ม */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              ref={submitBtnRef}
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-2xl 
                bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                transition-all duration-300 ease-out
                hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                hover:scale-[1.05] active:scale-[.97]
                disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              aria-busy={submitting ? "true" : "false"}
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกการโอนออก"}
            </button>

            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  weight_in: "",
                  weight_out: "",
                  cost_per_kg: "",
                  impurity_percent: "",
                  // ไม่ล้าง quality_note เพื่อเก็บบันทึกเพิ่มเติมของผู้โอน
                }))
              }
              className="inline-flex items-center justify-center rounded-2xl 
                border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
                shadow-sm
                transition-all duration-300 ease-out
                hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                active:scale-[.97]
                dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
                dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
            >
              ล้างเฉพาะค่าชั่ง/ราคา
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StockTransferOut
