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

// base fields
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const fieldDisabled =
  "bg-slate-100 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- ComboBox (แก้ Enter ➜ ไปช่องถัดไป + กันคลิกอัตโนมัติ) ---------- */
const ComboBox = forwardRef(function ComboBox(
  {
    options = [],
    value,
    onChange,
    placeholder = "— เลือก —",
    getLabel = (o) => o?.label ?? "",
    getValue = (o) => o?.id ?? o?.value ?? "",
    disabled = false,
    error = false,
    hintRed = false,
    clearHint = () => {},
    onMoveNext, // เมื่อกด Enter (หรือเลือกค่า) ให้เลื่อนไปช่องถัดไป
  },
  ref
) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const buttonRef = useRef(null)
  const suppressNextClickRef = useRef(false) // ← ป้องกัน "click" อัตโนมัติจากการกด Enter

  useImperativeHandle(ref, () => ({
    focus: () => buttonRef.current?.focus(),
    open: () => {
      if (!disabled) {
        setOpen(true)
        setHighlight((h) => (h >= 0 ? h : 0))
      }
    },
    close: () => setOpen(false),
  }))

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
    clearHint?.()
    requestAnimationFrame(() => {
      buttonRef.current?.focus()
      onMoveNext?.()
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

    if (e.key === "Enter") {
      e.preventDefault()
      suppressNextClickRef.current = true

      const hasValue = !(value === null || value === undefined || String(value) === "")

      if (open && highlight >= 0 && highlight < options.length) {
        commit(options[highlight])
      } else if (hasValue) {
        onMoveNext?.()
      } else {
        setOpen(true)
        setHighlight((h) => (h >= 0 ? h : 0))
        clearHint?.()
      }
      return
    }

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
        ref={buttonRef}
        disabled={disabled}
        onClick={() => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false
            return
          }
          if (!disabled) {
            setOpen((o) => !o)
            clearHint?.()
          }
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (e.key === "Enter") suppressNextClickRef.current = false
        }}
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
})

/** ---------- DateInput ---------- */
const DateInput = forwardRef(function DateInput({ error = false, className = "", ...props }, ref) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
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
  const [riceOptions, setRiceOptions] = useState([])
  const [subriceOptions, setSubriceOptions] = useState([])

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

    // ข้อมูลผู้ขนส่ง (เข้าร่วม flow แล้ว)
    driver_name: "",
    plate_number: "",

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
    weight_in: "",
    weight_out: "",
    cost_per_kg: "",
    quality_note: "",
    impurity_percent: "",
  })

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  /** ---------- Derived ---------- */
  const weightIn = useMemo(() => toInt(form.weight_in), [form.weight_in])
  const weightOut = useMemo(() => toInt(form.weight_out), [form.weight_out])
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

    const transferQty = netWeightInt
    if (!(transferQty > 0)) {
      setErrors((prev) => ({ ...prev, net_weight: "น้ำหนักสุทธิไม่ถูกต้อง" }))
      return
    }

    setSubmitting(true)
    try {
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

        entry_weight: toInt(form.weight_in),
        exit_weight: toInt(form.weight_out),

        weight: transferQty,
        impurity: form.impurity_percent === "" ? 0 : Number(form.impurity_percent),

        price_per_kilo: Number(form.cost_per_kg) || 0,
        price: (Number(form.cost_per_kg) || 0) * transferQty,

        quality: 0,
        transfer_qty: transferQty,
        sender_note: form.quality_note?.trim() || null,
      }

      await post("/transfer/request", payload)

      alert("✅✅✅ บันทึกออเดอร์เรียบร้อย")
      setForm((f) => ({
        ...f,
        weight_in: "",
        weight_out: "",
        cost_per_kg: "",
        impurity_percent: "",
      }))
    } catch (err) {
      console.error(err)
      alert(err?.message || "เกิดข้อผิดพลาดระหว่างบันทึก")
    } finally {
      setSubmitting(false)
    }
  }

  /** ---------- Keyboard flow ---------- */
  const driverRef = useRef(null)
  const plateRef = useRef(null)
  const fromBranchRef = useRef(null)
  const fromKlangRef = useRef(null)
  const toBranchRef = useRef(null)
  const toKlangRef = useRef(null)
  const productRef = useRef(null)
  const riceRef = useRef(null)
  const subriceRef = useRef(null)
  const conditionRef = useRef(null)
  const fieldRef = useRef(null)
  const yearRef = useRef(null)
  const programRef = useRef(null)
  const businessRef = useRef(null)
  const weightInRef = useRef(null)
  const weightOutRef = useRef(null)
  const costRef = useRef(null)
  const impurityRef = useRef(null)
  const saveBtnRef = useRef(null)

  // helper: เลื่อนจอไปยัง element โฟกัสปัจจุบัน (แนวตั้ง+แนวนอน)
  const scrollActiveIntoView = () => {
    try {
      const el = document.activeElement
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
      }
    } catch {}
  }

  // 👉 helper ใหม่: โฟกัส-เปิดคอมโบถัดไปแบบกำหนดตรง ๆ (ใช้สำหรับ 4 ช่องที่สั่ง)
  const focusComboRef = (nextRef) => {
    const target = nextRef?.current
    if (!target) return
    target.focus?.()
    requestAnimationFrame(() => {
      target.open?.()
      scrollActiveIntoView()
    })
  }

  // เดิมยังคงมี flow ใหญ่สำหรับช่องอื่น ๆ
  const getFlow = () => {
    return [
      { ref: driverRef, type: "input", disabled: false },
      { ref: plateRef, type: "input", disabled: false },
      // 4 ช่องนี้เรา “ผูกแบบกำหนดตรง ๆ” ด้วย focusComboRef แล้ว ไม่พึ่งลิสต์นี้
      { ref: productRef, type: "combo", disabled: false },
      { ref: riceRef, type: "combo", disabled: !form.product_id },
      { ref: subriceRef, type: "combo", disabled: !form.rice_id },
      { ref: fieldRef, type: "combo", disabled: false },
      { ref: yearRef, type: "combo", disabled: false },
      { ref: programRef, type: "combo", disabled: false },
      { ref: weightInRef, type: "input", disabled: false },
      { ref: weightOutRef, type: "input", disabled: false },
      { ref: costRef, type: "input", disabled: false },
      { ref: impurityRef, type: "input", disabled: false },
      { ref: saveBtnRef, type: "button", disabled: false },
    ].filter((i) => !i.disabled)
  }

  const focusNextFromRef = (currentRef) => {
    const arr = getFlow()
    const idx = arr.findIndex((i) => i.ref === currentRef)
    const next = idx >= 0 ? arr[idx + 1] : null
    if (!next) return
    const target = next.ref.current
    if (!target) return

    if (next.type === "combo") {
      target.focus?.()
      requestAnimationFrame(() => {
        target.open?.()
        scrollActiveIntoView()
      })
    } else {
      target.focus?.()
      requestAnimationFrame(scrollActiveIntoView)
    }
  }

  const enterToNext = (refObj) => (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      focusNextFromRef(refObj)
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
                  value={form.transfer_date}
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

              {/* ชื่อผู้ขนส่ง */}
              <div>
                <label className={labelCls}>ชื่อผู้ขนส่ง</label>
                <input
                  ref={driverRef}
                  className={cx(baseField, redFieldCls("driver_name"))}
                  value={form.driver_name}
                  onChange={(e) => update("driver_name", e.target.value)}
                  onFocus={() => {
                    clearError("driver_name")
                    clearHint("driver_name")
                  }}
                  onKeyDown={enterToNext(driverRef)}
                  placeholder="เช่น นายสมชาย ขยันงาน"
                  aria-invalid={errors.driver_name ? true : undefined}
                />
                {errors.driver_name && <p className={errorTextCls}>{errors.driver_name}</p>}
              </div >

              {/* ทะเบียนรถ */}
              <div>
                <label className={labelCls}>ทะเบียนรถขนส่ง</label>
                <input
                  ref={plateRef}
                  className={cx(baseField, redFieldCls("plate_number"))}
                  value={form.plate_number}
                  onChange={(e) => update("plate_number", e.target.value)}
                  onFocus={() => {
                    clearError("plate_number")
                    clearHint("plate_number")
                  }}
                  // ⬇️ แก้ตามสั่ง: Enter ที่ทะเบียนรถ ➜ โฟกัส "สาขาต้นทาง"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusComboRef(fromBranchRef)
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
                  ref={fromBranchRef}
                  options={fromBranchOptions}
                  value={form.from_branch_id}
                  getValue={(o) => o.id}
                  // ⬇️ ลำดับ: Enter ที่สาขาต้นทาง → คลังต้นทาง
                  onMoveNext={() => focusComboRef(fromKlangRef)}
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
                />
                {errors.from_branch_id && <p className={errorTextCls}>{errors.from_branch_id}</p>}
              </div>

              <div>
                <label className={labelCls}>คลังต้นทาง</label>
                <ComboBox
                  ref={fromKlangRef}
                  options={fromKlangOptions}
                  value={form.from_klang_id}
                  getValue={(o) => o.id}
                  // ⬇️ ลำดับ: Enter ที่คลังต้นทาง → สาขาปลายทาง
                  onMoveNext={() => focusComboRef(toBranchRef)}
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
                />
                {errors.from_klang_id && <p className={errorTextCls}>{errors.from_klang_id}</p>}
              </div>

              <div className="hidden md:block" />

              {/* ปลายทาง */}
              <div>
                <label className={labelCls}>สาขาปลายทาง</label>
                <ComboBox
                  ref={toBranchRef}
                  options={toBranchOptions}
                  value={form.to_branch_id}
                  getValue={(o) => o.id}
                  // ⬇️ ลำดับ: Enter ที่สาขาปลายทาง → คลังปลายทาง
                  onMoveNext={() => focusComboRef(toKlangRef)}
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
                />
                {errors.to_branch_id && <p className={errorTextCls}>{errors.to_branch_id}</p>}
              </div>

              <div>
                <label className={labelCls}>คลังปลายทาง</label>
                <ComboBox
                  ref={toKlangRef}
                  options={toKlangOptions}
                  value={form.to_klang_id}
                  getValue={(o) => o.id}
                  // ⬇️ แก้ตามสั่ง: Enter ที่คลังปลายทาง ➜ ไป "ประเภทสินค้า"
                  onMoveNext={() => focusComboRef(productRef)}
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
                  ref={productRef}
                  options={productOptions}
                  value={form.product_id}
                  // ⬇️ แก้ตามสั่ง: Enter ที่ "ประเภทสินค้า" → โฟกัส/เปิด "ชนิดข้าว"
                  onMoveNext={() => focusComboRef(riceRef)}
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
                />
                {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
              </div>

              {/* ชนิดข้าว */}
              <div>
                <label className={labelCls}>ชนิดข้าว</label>
                <ComboBox
                  ref={riceRef}
                  options={riceOptions}
                  value={form.rice_id}
                  // ⬇️ แก้ตามสั่ง: Enter ที่ "ชนิดข้าว" → โฟกัส/เปิด "ชั้นย่อย"
                  onMoveNext={() => focusComboRef(subriceRef)}
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
                />
                {errors.rice_id && <p className={errorTextCls}>{errors.rice_id}</p>}
              </div>

              {/* ชั้นย่อย */}
              <div>
                <label className={labelCls}>ชั้นย่อย (Sub-class)</label>
                <ComboBox
                  ref={subriceRef}
                  options={subriceOptions}
                  value={form.subrice_id}
                  // ⬇️ แก้ตามสั่ง: Enter ที่ "ชั้นย่อย" → โฟกัส/เปิด "ประเภทนา"
                  onMoveNext={() => focusComboRef(fieldRef)}
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
                />
                {errors.subrice_id && <p className={errorTextCls}>{errors.subrice_id}</p>}
              </div>

              {/* สภาพ/เงื่อนไข (ล็อกเป็น “แห้ง”) */}
              <div>
                <label className={labelCls}>สภาพ/เงื่อนไข</label>
                <ComboBox
                  ref={conditionRef}
                  options={conditionOptions}
                  value={form.condition_id}
                  onMoveNext={() => {/* ไม่อยู่ใน flow */}}
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
                  ref={fieldRef}
                  options={fieldOptions}
                  value={form.field_type_id}
                  onMoveNext={() => focusNextFromRef(fieldRef)}
                  onChange={(id, found) => {
                    clearError("field_type_id")
                    clearHint("field_type_id")
                    update("field_type_id", id)
                    update("field_type_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกประเภทนา —"
                  error={!!errors.field_type_id}
                  hintRed={!!missingHints.field_type_id}
                />
                {errors.field_type_id && <p className={errorTextCls}>{errors.field_type_id}</p>}
              </div>

              {/* ปี/ฤดูกาล */}
              <div>
                <label className={labelCls}>ปี/ฤดูกาล</label>
                <ComboBox
                  ref={yearRef}
                  options={yearOptions}
                  value={form.rice_year_id}
                  onMoveNext={() => focusNextFromRef(yearRef)}
                  onChange={(id, found) => {
                    update("rice_year_id", id)
                    update("rice_year_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกปี/ฤดูกาล —"
                />
              </div>

              {/* โปรแกรม */}
              <div>
                <label className={labelCls}>โปรแกรม (ไม่บังคับ)</label>
                <ComboBox
                  ref={programRef}
                  options={programOptions}
                  value={form.program_id}
                  onMoveNext={() => focusNextFromRef(programRef)}
                  onChange={(id, found) => {
                    update("program_id", id)
                    update("program_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกโปรแกรม —"
                />
              </div>

              {/* ประเภทธุรกิจ (ล็อกเป็น “ซื้อมาขายไป”) */}
              <div>
                <label className={labelCls}>ประเภทธุรกิจ</label>
                <ComboBox
                  ref={businessRef}
                  options={businessOptions}
                  value={form.business_type_id}
                  onMoveNext={() => {/* ไม่อยู่ใน flow */}}
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
                  onKeyDown={enterToNext(weightInRef)}
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
                  onKeyDown={enterToNext(weightOutRef)}
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
                  ref={costRef}
                  inputMode="decimal"
                  className={cx(baseField, errors.cost_per_kg && "border-red-400")}
                  value={form.cost_per_kg}
                  onChange={(e) => update("cost_per_kg", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => clearError("cost_per_kg")}
                  onKeyDown={enterToNext(costRef)}
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

              <div>
                <label className={labelCls}>สิ่งเจือปน (%)</label>
                <input
                  ref={impurityRef}
                  inputMode="decimal"
                  className={cx(baseField, errors.impurity_percent && "border-red-400")}
                  value={form.impurity_percent}
                  onChange={(e) => update("impurity_percent", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => clearError("impurity_percent")}
                  onKeyDown={enterToNext(impurityRef)}
                  placeholder="เช่น 2.5"
                  aria-invalid={errors.impurity_percent ? true : undefined}
                />
                {errors.impurity_percent && <p className={errorTextCls}>{errors.impurity_percent}</p>}
                <p className={helpTextCls}>กรอกเป็นตัวเลข 0–100 (เว้นว่างได้)</p>
              </div>
            </div>
          </div>

          {/* ฟอร์มการ์ดสรุปก่อนบันทึก */}
          <div className="mb-6">
            <h2 className="mb-3 text-xl font-semibold">สรุปก่อนบันทึก</h2>
            <div className="grid gap-4 md:grid-cols-5">
              {[
                { label: "วันที่โอน", value: form.transfer_date || "—" },
                { label: "จาก (สาขา/คลัง)", value: `${form.from_branch_name || "—"}${form.from_klang_name ? `\n${form.from_klang_name}` : ""}` },
                { label: "ไป (สาขา/คลัง)", value: `${form.to_branch_name || "—"}${form.to_klang_name ? `\n${form.to_klang_name}` : ""}` },
                { label: "สินค้า", value: form.product_name || "—" },
                { label: "ชนิดข้าว", value: form.rice_type || "—" },
                { label: "ชั้นย่อย", value: form.subrice_name || "—" },
                { label: "ประเภทนา", value: form.field_type_label || "—" },
                { label: "ปี/ฤดูกาล", value: form.rice_year_label || "—" },
                { label: "โปรแกรม", value: form.program_label || "—" },
                { label: "ประเภทธุรกิจ", value: form.business_type_label || "—" },
                { label: "น้ำหนักขาเข้า", value: `${toInt(form.weight_in).toLocaleString()} กก.` },
                { label: "น้ำหนักขาออก", value: `${toInt(form.weight_out).toLocaleString()} กก.` },
                { label: "น้ำหนักสุทธิ", value: `${netWeightInt.toLocaleString()} กก.` },
                { label: "ราคาต้นทุน/กก.", value: form.cost_per_kg ? `${Number(form.cost_per_kg).toFixed(2)} บาท/กก.` : "—" },
                { label: "ราคารวม", value: thb(totalCost) },
                { label: "สิ่งเจือปน", value: form.impurity_percent !== "" ? `${Number(form.impurity_percent)} %` : "—" },
                { label: "ผู้ขนส่ง", value: form.driver_name || "—" },
                { label: "ทะเบียนรถ", value: form.plate_number || "—" },
                { label: "บันทึกเพิ่มเติม", value: form.quality_note || "—" },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
                >
                  <div className="text-slate-600 dark:text-slate-300">{c.label}</div>
                  {typeof c.value === "string" ? (
                    <div className="text-lg md:text-xl font-semibold whitespace-pre-line">{c.value}</div>
                  ) : (
                    <div className="text-lg md:text-xl font-semibold">{c.value}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ปุ่ม */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              ref={saveBtnRef}
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
