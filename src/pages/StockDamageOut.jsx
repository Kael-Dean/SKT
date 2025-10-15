// src/pages/StockDamageOut.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { get, post } from "../lib/api"

/** ---------- Utils ---------- */
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
const cx = (...a) => a.filter(Boolean).join(" ")

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

/** ---------- ComboBox (มาตรฐานโปรเจกต์) ---------- */
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

  const commit = (opt) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    clearHint?.()
    requestAnimationFrame(() => controlRef.current?.focus())
  }

  const scrollHighlightedIntoView = (index) => {
    const listEl = listRef.current
    const itemEl = listEl?.children?.[index]
    if (!listEl || !itemEl) return
    const itemRect = itemEl.getBoundingClientRect()
    const listRect = listEl.getBoundingClientRect()
    const buffer = 6
    if (itemRect.top < listRect.top + buffer) listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
    else if (itemRect.bottom > listRect.bottom - buffer) listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
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
          {options.length === 0 && <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>}
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
                {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />}
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
        className={cx(baseField, "pr-12 cursor-pointer", error && "border-red-400 ring-2 ring-red-300/70", className)}
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

/** ---------- Page: ตัดเสียหาย (นำออกจากคลัง) ---------- */
const StockDamageOut = () => {
  const [submitting, setSubmitting] = useState(false)

  /** ---------- Dropdown options ---------- */
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const [productOptions, setProductOptions] = useState([])
  const [speciesOptions, setSpeciesOptions] = useState([])   // แทน rice
  const [variantOptions, setVariantOptions] = useState([])   // แทน subrice

  // เมตาดาต้า (เหมือนหน้ายกเข้า)
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldOptions, setFieldOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    damage_date: new Date().toISOString().slice(0, 10),

    branch_id: null,
    branch_name: "",
    klang_id: null,
    klang_name: "",

    product_id: "",
    product_name: "",
    species_id: "",
    species_name: "",
    variant_id: "",
    variant_name: "",

    // เมตาดาต้า (id)
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

    weight_out: "",
    cost_per_kg: "",
    reason: "",
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  /** ---------- Derived ---------- */
  const weightOut = useMemo(() => toNumber(form.weight_out), [form.weight_out])
  const damagePerKg = useMemo(() => toNumber(form.cost_per_kg), [form.cost_per_kg])
  const totalDamage = useMemo(() => weightOut * damagePerKg, [weightOut, damagePerKg])

  /** ---------- Errors / hints ---------- */
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const redFieldCls = (key) =>
    errors[key] || missingHints[key] ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : ""
  const redHintCls = (key) =>
    missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : ""
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
        const [branches, products, conditions, fields, years, programs, businesses] = await Promise.all([
          get("/order/branch/search"),
          get("/order/product/search"),
          get("/order/condition/search"),
          get("/order/field/search"),
          get("/order/year/search"),
          get("/order/program/search"),
          get("/order/business/search"),
        ])

        const brs = (branches || []).map((b) => ({ id: b.id, label: b.branch_name }))
        setBranchOptions(brs)

        setProductOptions(
          (products || [])
            .map((x) => ({
              id: String(x.id ?? x.product_id ?? x.value ?? ""),
              label: String(x.product_type ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        setConditionOptions((conditions || []).map((c) => ({ id: String(c.id), label: c.condition })))

        setFieldOptions(
          (fields || [])
            .map((f) => ({ id: String(f.id), label: String(f.field ?? f.field_type ?? "") }))
            .filter((o) => o.id && o.label)
        )

        setYearOptions((years || []).map((y) => ({ id: String(y.id), label: String(y.year) })))
        setProgramOptions((programs || []).map((p) => ({ id: String(p.id), label: p.program })))
        setBusinessOptions((businesses || []).map((b) => ({ id: String(b.id), label: b.business })))
      } catch (e) {
        console.error("load static error:", e)
        setBranchOptions([])
        setProductOptions([])
        setConditionOptions([])
        setFieldOptions([])
        setYearOptions([])
        setProgramOptions([])
        setBusinessOptions([])
      }
    }
    loadStatic()
  }, [])

  // branch -> klang
  useEffect(() => {
    const bid = form.branch_id
    const bname = form.branch_name?.trim()
    if (bid == null && !bname) {
      setKlangOptions([])
      update("klang_id", null)
      update("klang_name", "")
      return
    }
    const loadKlang = async () => {
      try {
        const qs = bid != null ? `branch_id=${bid}` : `branch_name=${encodeURIComponent(bname)}`
        const arr = await get(`/order/klang/search?${qs}`)
        setKlangOptions((arr || []).map((k) => ({ id: k.id, label: k.klang_name })))
      } catch (e) {
        console.error("Load klang error:", e)
        setKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.branch_id, form.branch_name])

  // product -> species
  useEffect(() => {
    const pid = form.product_id
    if (!pid) {
      setSpeciesOptions([])
      update("species_id", "")
      update("species_name", "")
      update("variant_id", "")
      update("variant_name", "")
      return
    }
    const loadSpecies = async () => {
      try {
        const arr = await get(`/order/species/search?product_id=${encodeURIComponent(pid)}`)
        const mapped = (arr || [])
          .map((x) => ({
            id: String(x.id ?? x.species_id ?? x.value ?? ""),
            label: String(x.species ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setSpeciesOptions(mapped)
      } catch (e) {
        console.error("load species error:", e)
        setSpeciesOptions([])
      }
    }
    loadSpecies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_id])

  // species -> variant
  useEffect(() => {
    const sid = form.species_id
    if (!sid) {
      setVariantOptions([])
      update("variant_id", "")
      update("variant_name", "")
      return
    }
    const loadVariant = async () => {
      try {
        const arr = await get(`/order/variant/search?species_id=${encodeURIComponent(sid)}`)
        const mapped = (arr || [])
          .map((x) => ({
            id: String(x.id ?? x.variant_id ?? x.value ?? ""),
            label: String(x.variant ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setVariantOptions(mapped)
      } catch (e) {
        console.error("load variant error:", e)
        setVariantOptions([])
      }
    }
    loadVariant()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.species_id])

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.damage_date) m.damage_date = true

    if (!form.branch_id) m.branch_id = true
    if (!form.klang_id) m.klang_id = true

    if (!form.product_id) m.product_id = true
    if (!form.species_id) m.species_id = true
    if (!form.variant_id) m.variant_id = true

    if (!form.weight_out || Number(form.weight_out) <= 0) m.weight_out = true
    if (form.cost_per_kg === "" || Number(form.cost_per_kg) < 0) m.cost_per_kg = true

    return m
  }

  const validate = () => {
    const e = {}
    if (!form.damage_date) e.damage_date = "กรุณาเลือกวันที่ตัดเสียหาย"

    if (!form.branch_id) e.branch_id = "กรุณาเลือกสาขา"
    if (!form.klang_id) e.klang_id = "กรุณาเลือกคลัง"

    if (!form.product_id) e.product_id = "กรุณาเลือกประเภทสินค้า"
    if (!form.species_id) e.species_id = "กรุณาเลือกชนิดข้าว (Species)"
    if (!form.variant_id) e.variant_id = "กรุณาเลือกชั้นย่อย (Variant)"

    if (toNumber(form.weight_out) <= 0) e.weight_out = "น้ำหนักต้องมากกว่า 0"
    if (form.cost_per_kg === "" || toNumber(form.cost_per_kg) < 0) e.cost_per_kg = "ค่าเสียหาย/กก. ต้องไม่ติดลบ"

    setErrors(e)
    return Object.keys(e).length === 0
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()
    const hints = computeMissingHints()
    setMissingHints(hints)
    if (!validate()) return

    setSubmitting(true)
    try {
      // ให้ตรง ProductSpecIn
      const spec = {
        product_id: Number(form.product_id),
        species_id: Number(form.species_id),
        variant_id: Number(form.variant_id),
        product_year: form.rice_year_id ? Number(form.rice_year_id) : null,
        condition_id: form.condition_id ? Number(form.condition_id) : null,
        field_type: form.field_type_id ? Number(form.field_type_id) : null,
        program: form.program_id ? Number(form.program_id) : null,
        business_type: form.business_type_id ? Number(form.business_type_id) : null,
      }

      // ส่งคีย์ co_branch / co_klang ตาม BE ที่แจ้งเตือนหา co_klang
      const payload = {
        date: form.damage_date,
        spec,
        co_branch: Number(form.branch_id),
        co_klang: Number(form.klang_id),
        price: toNumber(form.cost_per_kg),
        cl_amount: toNumber(form.weight_out),
        comment: form.reason?.trim() || null,
      }

      await post("/carryover/create", payload)

      alert("บันทึกตัดเสียหาย (Damage Out) สำเร็จ ✅")
      setForm((f) => ({
        ...f,
        // คงสาขา/คลังไว้ เผื่อตัดต่อเนื่อง
        product_id: "",
        product_name: "",
        species_id: "",
        species_name: "",
        variant_id: "",
        variant_name: "",
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
        weight_out: "",
        cost_per_kg: "",
        reason: "",
      }))
    } catch (err) {
      console.error(err)
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "เกิดข้อผิดพลาดระหว่างบันทึก"
      alert(Array.isArray(msg) ? msg.map((d) => d?.msg || d).join("\n") : msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🧯 ตัดเสียหาย (Damage Out)</h1>

        <form onSubmit={handleSubmit}>
          {/* กรอบที่ 1: ที่ตั้ง (สาขา/คลัง) & วันที่ */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ข้อมูลตัดเสียหาย</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>วันที่ตัดเสียหาย</label>
                <DateInput
                  value={form.damage_date}
                  onChange={(e) => {
                    clearError("damage_date")
                    clearHint("damage_date")
                    update("damage_date", e.target.value)
                  }}
                  error={!!errors.damage_date}
                  className={redHintCls("damage_date")}
                  aria-invalid={errors.damage_date ? true : undefined}
                />
                {errors.damage_date && <p className={errorTextCls}>{errors.damage_date}</p>}
              </div>

              <div>
                <label className={labelCls}>สาขา</label>
                <ComboBox
                  options={branchOptions}
                  value={form.branch_id}
                  getValue={(o) => o.id}
                  onChange={(_v, found) => {
                    clearError("branch_id")
                    clearHint("branch_id")
                    update("branch_id", found?.id ?? null)
                    update("branch_name", found?.label ?? "")
                    update("klang_id", null)
                    update("klang_name", "")
                  }}
                  placeholder="— เลือกสาขา —"
                  error={!!errors.branch_id}
                  hintRed={!!missingHints.branch_id}
                />
                {errors.branch_id && <p className={errorTextCls}>{errors.branch_id}</p>}
              </div>

              <div>
                <label className={labelCls}>คลัง</label>
                <ComboBox
                  options={klangOptions}
                  value={form.klang_id}
                  getValue={(o) => o.id}
                  onChange={(_v, found) => {
                    clearError("klang_id")
                    clearHint("klang_id")
                    update("klang_id", found?.id ?? null)
                    update("klang_name", found?.label ?? "")
                  }}
                  placeholder="— เลือกคลัง —"
                  disabled={!form.branch_id}
                  error={!!errors.klang_id}
                  hintRed={!!missingHints.klang_id}
                />
                {errors.klang_id && <p className={errorTextCls}>{errors.klang_id}</p>}
              </div>
            </div>
          </div>

          {/* กรอบที่ 2: สินค้า / คุณสมบัติ */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">สินค้า / คุณสมบัติ (ข้าวเปลือก)</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>ประเภทสินค้า</label>
                <ComboBox
                  options={productOptions}
                  value={form.product_id}
                  onChange={(id, found) => {
                    clearError("product_id")
                    clearHint("product_id")
                    update("product_id", id)
                    update("product_name", found?.label ?? "")
                    update("species_id", "")
                    update("species_name", "")
                    update("variant_id", "")
                    update("variant_name", "")
                  }}
                  placeholder="— เลือกประเภทสินค้า —"
                  error={!!errors.product_id}
                  hintRed={!!missingHints.product_id}
                />
                {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
              </div>

              <div>
                <label className={labelCls}>ชนิดข้าว (Species)</label>
                <ComboBox
                  options={speciesOptions}
                  value={form.species_id}
                  onChange={(id, found) => {
                    clearError("species_id")
                    clearHint("species_id")
                    update("species_id", id)
                    update("species_name", found?.label ?? "")
                    update("variant_id", "")
                    update("variant_name", "")
                  }}
                  placeholder="— เลือกชนิดข้าว —"
                  disabled={!form.product_id}
                  error={!!errors.species_id}
                  hintRed={!!missingHints.species_id}
                />
                {errors.species_id && <p className={errorTextCls}>{errors.species_id}</p>}
              </div>

              <div>
                <label className={labelCls}>ชั้นย่อย (Variant)</label>
                <ComboBox
                  options={variantOptions}
                  value={form.variant_id}
                  onChange={(id, found) => {
                    clearError("variant_id")
                    clearHint("variant_id")
                    update("variant_id", id)
                    update("variant_name", found?.label ?? "")
                  }}
                  placeholder="— เลือกชั้นย่อย —"
                  disabled={!form.species_id}
                  error={!!errors.variant_id}
                  hintRed={!!missingHints.variant_id}
                />
                {errors.variant_id && <p className={errorTextCls}>{errors.variant_id}</p>}
              </div>

              {/* สภาพ/เงื่อนไข */}
              <div>
                <label className={labelCls}>สภาพ/เงื่อนไข</label>
                <ComboBox
                  options={conditionOptions}
                  value={form.condition_id}
                  onChange={(id, found) => {
                    update("condition_id", id)
                    update("condition_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกสภาพ/เงื่อนไข —"
                />
              </div>

              {/* ประเภทนา */}
              <div>
                <label className={labelCls}>ประเภทนา</label>
                <ComboBox
                  options={fieldOptions}
                  value={form.field_type_id}
                  onChange={(id, found) => {
                    update("field_type_id", id)
                    update("field_type_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกประเภทนา —"
                />
              </div>

              {/* ปี/ฤดูกาล */}
              <div>
                <label className={labelCls}>ปี/ฤดูกาล</label>
                <ComboBox
                  options={yearOptions}
                  value={form.rice_year_id}
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
                  options={programOptions}
                  value={form.program_id}
                  onChange={(id, found) => {
                    update("program_id", id)
                    update("program_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกโปรแกรม —"
                />
              </div>

              {/* ประเภทธุรกิจ */}
              <div>
                <label className={labelCls}>ประเภทธุรกิจ</label>
                <ComboBox
                  options={businessOptions}
                  value={form.business_type_id}
                  onChange={(id, found) => {
                    update("business_type_id", id)
                    update("business_type_label", found?.label ?? "")
                  }}
                  placeholder="— เลือกประเภทธุรกิจ —"
                />
              </div>
            </div>
          </div>

          {/* กรอบที่ 3: น้ำหนักและค่าเสียหาย */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">น้ำหนักและค่าเสียหาย</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={labelCls}>น้ำหนักที่ตัดออก (กก.)</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("weight_out"))}
                  value={form.weight_out}
                  onChange={(e) => update("weight_out", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearError("weight_out")
                    clearHint("weight_out")
                  }}
                  placeholder="เช่น 1000"
                  aria-invalid={errors.weight_out ? true : undefined}
                />
                {errors.weight_out && <p className={errorTextCls}>{errors.weight_out}</p>}
              </div>

              <div>
                <label className={labelCls}>ค่าเสียหาย / กก. (บาท)</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("cost_per_kg"))}
                  value={form.cost_per_kg}
                  onChange={(e) => update("cost_per_kg", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearError("cost_per_kg")
                    clearHint("cost_per_kg")
                  }}
                  placeholder="เช่น 2.50"
                  aria-invalid={errors.cost_per_kg ? true : undefined}
                />
                {errors.cost_per_kg && <p className={errorTextCls}>{errors.cost_per_kg}</p>}
              </div>

              <div>
                <label className={labelCls}>มูลค่าเสียหายรวม (บาท)</label>
                <input disabled className={cx(baseField, fieldDisabled)} value={thb(totalDamage)} />
                <p className={helpTextCls}>คำนวณ = น้ำหนัก × ค่าเสียหาย/กก.</p>
              </div>

              <div className="md:col-span-4">
                <label className={labelCls}>เหตุผล / บันทึกเพิ่มเติม</label>
                <textarea
                  className={baseField}
                  rows={3}
                  value={form.reason}
                  onChange={(e) => update("reason", e.target.value)}
                  placeholder="เช่น เสียหายจากความชื้นสูง / ศัตรูพืช / ขนส่ง"
                />
              </div>
            </div>
          </div>

          {/* ปุ่ม */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-2xl 
                bg-rose-600 px-6 py-3 text-base font-semibold text-white
                shadow-[0_6px_16px_rgba(225,29,72,0.35)]
                transition-all duration-300 ease-out
                hover:bg-rose-700 hover:shadow-[0_8px_20px_rgba(225,29,72,0.45)]
                hover:scale-[1.05] active:scale-[.97]
                disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              aria-busy={submitting ? "true" : "false"}
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกตัดเสียหาย"}
            </button>

            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  // เคลียร์เฉพาะข้อมูลสินค้า/น้ำหนัก/ราคา
                  product_id: "",
                  product_name: "",
                  species_id: "",
                  species_name: "",
                  variant_id: "",
                  variant_name: "",
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
                  weight_out: "",
                  cost_per_kg: "",
                  reason: "",
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
              ล้างฟอร์มสินค้า/ราคา
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StockDamageOut
