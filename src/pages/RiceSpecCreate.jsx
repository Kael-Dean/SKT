// src/pages/RiceSpecCreate.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../lib/api"

/** ---------- Utils ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toInt = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : NaN
}

/** ---------- Theme (ให้เหมือนหน้า Sales) ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
const fieldDisabled =
  "bg-slate-100 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"
const labelCls =
  "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- Section Card ---------- */
function SectionCard({ title, subtitle, children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm",
        "dark:border-slate-700 dark:bg-slate-800 dark:text-white",
        className
      )}
    >
      {title && <h2 className="mb-1 text-xl font-semibold">{title}</h2>}
      {subtitle && (
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
      )}
      {children}
    </div>
  )
}

/** ---------- ComboBox (คัดสไตล์จากหน้า Sales) ---------- */
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
      listEl.scrollTop -= listRect.top + buffer - itemRect.top
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
          "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700/80"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
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
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  <div>{label}</div>
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

/** ---------- Field wrapper (label + error) ---------- */
function ComboField({
  label,
  required = false,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  loading = false,
  errorText,
  buttonRef,
  onEnterNext,
}) {
  const finalPlaceholder = loading ? "กำลังโหลด..." : placeholder

  return (
    <div>
      <label className={labelCls}>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>

      <ComboBox
        options={options}
        value={value}
        onChange={(v) => onChange?.(v)}
        placeholder={finalPlaceholder}
        disabled={disabled || loading}
        error={!!errorText}
        buttonRef={buttonRef}
        onEnterNext={onEnterNext}
      />

      {errorText && <p className={errorTextCls}>{errorText}</p>}
    </div>
  )
}

/** ---------- หน้าเพิ่ม “รหัสข้าว” (ProductSpec) ---------- */
function RiceSpecCreate() {
  /**
   * ✅ ปรับ endpoint ให้ตรงกับ BE (ชุดเดียวกับหน้า Sales)
   * - Master data: /order/...
   * - Create spec:  /spec/
   */
  const API = useMemo(
    () => ({
      createSpec: "/spec/",

      products: "/order/product/search",
      species: "/order/species/search", // ?product_id=
      variants: "/order/variant/search", // ?species_id=
      years: "/order/year/search",
      conditions: "/order/condition/search",
      fieldTypes: "/order/field/search",
      programs: "/order/program/search",
      businessTypes: "/order/business/search",
    }),
    []
  )

  /** --- options --- */
  const [opts, setOpts] = useState({
    products: [],
    species: [],
    variants: [],
    years: [],
    conditions: [],
    fieldTypes: [],
    programs: [],
    businessTypes: [],
  })

  const [loading, setLoading] = useState({
    static: false,
    species: false,
    variants: false,
  })

  const [loadErr, setLoadErr] = useState({}) // per list error message

  const mapIdLabel = (arr, labelKey) => {
    const safe = Array.isArray(arr) ? arr : []
    return safe
      .map((x) => ({
        id: String(x?.id ?? ""),
        label: String(x?.[labelKey] ?? "").trim(),
      }))
      .filter((x) => x.id && x.label)
  }

  const safeFetch = async ({ key, url, labelKey }) => {
    try {
      const data = await apiAuth(url)
      const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      const mapped = mapIdLabel(arr, labelKey)
      setLoadErr((p) => ({ ...p, [key]: undefined }))
      return mapped
    } catch (e) {
      console.error("load", key, "failed:", e)
      setLoadErr((p) => ({
        ...p,
        [key]: "โหลดรายการไม่สำเร็จ (ตรวจสอบ endpoint/สิทธิ์การเข้าถึง)",
      }))
      return []
    }
  }

  const loadStaticMasters = async () => {
    setLoading((p) => ({ ...p, static: true }))
    try {
      const [products, years, conditions, fieldTypes, programs, businessTypes] =
        await Promise.all([
          safeFetch({ key: "products", url: API.products, labelKey: "product_type" }),
          safeFetch({ key: "years", url: API.years, labelKey: "year" }),
          safeFetch({ key: "conditions", url: API.conditions, labelKey: "condition" }),
          safeFetch({ key: "fieldTypes", url: API.fieldTypes, labelKey: "field" }),
          safeFetch({ key: "programs", url: API.programs, labelKey: "program" }),
          safeFetch({ key: "businessTypes", url: API.businessTypes, labelKey: "business" }),
        ])

      setOpts((p) => ({
        ...p,
        products,
        years,
        conditions,
        fieldTypes,
        programs,
        businessTypes,
      }))
    } finally {
      setLoading((p) => ({ ...p, static: false }))
    }
  }

  const loadSpecies = async (productIdStr) => {
    const pid = toInt(productIdStr)
    if (!Number.isFinite(pid)) {
      setOpts((p) => ({ ...p, species: [], variants: [] }))
      return
    }

    setLoading((p) => ({ ...p, species: true }))
    try {
      const url = `${API.species}?product_id=${encodeURIComponent(String(pid))}`
      const list = await safeFetch({ key: "species", url, labelKey: "species" })
      setOpts((p) => ({ ...p, species: list }))
    } finally {
      setLoading((p) => ({ ...p, species: false }))
    }
  }

  const loadVariants = async (speciesIdStr) => {
    const sid = toInt(speciesIdStr)
    if (!Number.isFinite(sid)) {
      setOpts((p) => ({ ...p, variants: [] }))
      return
    }

    setLoading((p) => ({ ...p, variants: true }))
    try {
      const url = `${API.variants}?species_id=${encodeURIComponent(String(sid))}`
      const list = await safeFetch({ key: "variants", url, labelKey: "variant" })
      setOpts((p) => ({ ...p, variants: list }))
    } finally {
      setLoading((p) => ({ ...p, variants: false }))
    }
  }

  /** --- form --- */
  const [form, setForm] = useState({
    product_id: "",
    species_id: "",
    variant_id: "",
    product_year: "",
    condition_id: "",
    field_type: "",
    program: "",
    business_type: "",
  })

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [submitError, setSubmitError] = useState("")

  // refs + focus order
  const productRef = useRef(null)
  const speciesRef = useRef(null)
  const variantRef = useRef(null)
  const yearRef = useRef(null)
  const conditionRef = useRef(null)
  const fieldTypeRef = useRef(null)
  const programRef = useRef(null)
  const businessRef = useRef(null)
  const submitRef = useRef(null)

  const focusOrder = [
    productRef,
    speciesRef,
    variantRef,
    yearRef,
    conditionRef,
    fieldTypeRef,
    programRef,
    businessRef,
    submitRef,
  ]

  const focusNextFromEl = (el) => {
    const i = focusOrder.findIndex((r) => r?.current === el)
    const next = focusOrder[Math.min(i + 1, focusOrder.length - 1)]
    try {
      next?.current?.focus?.()
    } catch {}
  }

  /** --- initial load --- */
  useEffect(() => {
    loadStaticMasters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** --- dependent loads --- */
  useEffect(() => {
    // product changed -> reload species
    const pid = form.product_id
    setForm((p) => ({ ...p, species_id: "", variant_id: "" }))
    setOpts((p) => ({ ...p, species: [], variants: [] }))
    if (pid) loadSpecies(pid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_id])

  useEffect(() => {
    // species changed -> reload variants
    const sid = form.species_id
    setForm((p) => ({ ...p, variant_id: "" }))
    setOpts((p) => ({ ...p, variants: [] }))
    if (sid) loadVariants(sid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.species_id])

  const reloadAll = async () => {
    await loadStaticMasters()
    if (form.product_id) await loadSpecies(form.product_id)
    if (form.species_id) await loadVariants(form.species_id)
  }

  const validate = () => {
    const e = {}

    if (!form.product_id) e.product_id = "เลือกประเภทสินค้า (product)"
    if (!form.species_id) e.species_id = "เลือกชนิด/สายพันธุ์ (species)"
    if (!form.variant_id) e.variant_id = "เลือกพันธุ์/รูปแบบ (variant)"

    // กันกรณีได้ค่าที่ไม่ใช่ตัวเลข
    ;[
      "product_id",
      "species_id",
      "variant_id",
      "product_year",
      "condition_id",
      "field_type",
      "program",
      "business_type",
    ].forEach((k) => {
      if (!form[k]) return
      if (!Number.isFinite(toInt(form[k]))) e[k] = "รูปแบบรหัสไม่ถูกต้อง"
    })

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const buildPayload = () => {
    const payload = {
      product_id: toInt(form.product_id),
      species_id: toInt(form.species_id),
      variant_id: toInt(form.variant_id),
    }

    if (form.product_year) payload.product_year = toInt(form.product_year)
    if (form.condition_id) payload.condition_id = toInt(form.condition_id)
    if (form.field_type) payload.field_type = toInt(form.field_type)
    if (form.program) payload.program = toInt(form.program)
    if (form.business_type) payload.business_type = toInt(form.business_type)

    return payload
  }

  const reset = () => {
    setForm({
      product_id: "",
      species_id: "",
      variant_id: "",
      product_year: "",
      condition_id: "",
      field_type: "",
      program: "",
      business_type: "",
    })
    setErrors({})
    setResult(null)
    setSubmitError("")
    setOpts((p) => ({ ...p, species: [], variants: [] }))
    productRef.current?.focus?.()
  }

  const submit = async () => {
    setSubmitError("")
    if (!validate()) return

    const payload = buildPayload()

    try {
      setSubmitting(true)
      const res = await apiAuth(API.createSpec, {
        method: "POST",
        body: payload,
      })
      setResult(res)
      setErrors({})
    } catch (err) {
      console.error(err)
      const msg = err?.message || "บันทึกล้มเหลว"
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // preview (ประกอบจาก label ที่เลือกได้ เพื่อช่วยตรวจทานก่อนบันทึก)
  const previewName = useMemo(() => {
    const findLabel = (arr, v) => arr.find((x) => String(x.id) === String(v))?.label

    const parts = [
      findLabel(opts.products, form.product_id),
      findLabel(opts.species, form.species_id),
      findLabel(opts.variants, form.variant_id),
    ]

    const yearLabel = findLabel(opts.years, form.product_year)
    if (yearLabel) parts.push(`ปี ${yearLabel}`)

    const conditionLabel = findLabel(opts.conditions, form.condition_id)
    if (conditionLabel) parts.push(conditionLabel)

    const fieldLabel = findLabel(opts.fieldTypes, form.field_type)
    if (fieldLabel) parts.push(fieldLabel)

    const programLabel = findLabel(opts.programs, form.program)
    if (programLabel) parts.push(programLabel)

    const businessLabel = findLabel(opts.businessTypes, form.business_type)
    if (businessLabel) parts.push(businessLabel)

    return parts.filter(Boolean).join(" / ")
  }, [form, opts])

  const anyLoading = loading.static || loading.species || loading.variants

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-5xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-1 text-3xl font-bold">➕ เพิ่มรหัสข้าว</h1>
        <p className="mb-5 text-slate-600 dark:text-slate-300">
          เลือกข้อมูลให้ครบ (อย่างน้อย 3 ช่องแรก) แล้วกดบันทึก ระบบหลังบ้านจะสร้าง{" "}
          <span className="font-semibold">prod_name</span> ให้อัตโนมัติ
        </p>

        <SectionCard
          title="ข้อมูลรหัสข้าว (Spec)"
          subtitle="ช่องที่มี * เป็นช่องบังคับ"
          className="mb-6"
        >
          {/* hint สิทธิ์ */}
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200">
            <div className="font-semibold">หมายเหตุ</div>
            <div className="text-sm leading-relaxed">
              API ฝั่ง BE อนุญาตให้สร้างได้เฉพาะบทบาท{" "}
              <span className="font-semibold">HA / ADMIN</span> เท่านั้น
            </div>
          </div>

          {/* โหลด master */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {anyLoading ? "กำลังโหลดรายการ..." : "รายการตัวเลือกถูกโหลดจากระบบ"}
            </div>
            <button
              type="button"
              onClick={reloadAll}
              disabled={anyLoading}
              className="inline-flex items-center justify-center rounded-2xl 
                        border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 
                        shadow-sm transition-all duration-300 ease-out
                        hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                        active:scale-[.97]
                        disabled:opacity-60 disabled:cursor-not-allowed
                        dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
                        dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
            >
              โหลดรายการใหม่
            </button>
          </div>

          {/* แถวตัวเลือก */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ComboField
              label="ประเภทสินค้า (Product)"
              required
              buttonRef={productRef}
              value={form.product_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, product_id: v }))
                setErrors((p) => ({ ...p, product_id: undefined }))
              }}
              options={opts.products}
              loading={loading.static}
              errorText={errors.product_id || loadErr.products}
              onEnterNext={() => focusNextFromEl(productRef.current)}
            />

            <ComboField
              label="ชนิด/สายพันธุ์ (Species)"
              required
              buttonRef={speciesRef}
              value={form.species_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, species_id: v }))
                setErrors((p) => ({ ...p, species_id: undefined }))
              }}
              options={opts.species}
              disabled={!form.product_id}
              loading={loading.species}
              placeholder={form.product_id ? "— เลือก —" : "— เลือกประเภทสินค้าก่อน —"}
              errorText={errors.species_id || loadErr.species}
              onEnterNext={() => focusNextFromEl(speciesRef.current)}
            />

            <ComboField
              label="พันธุ์/รูปแบบ (Variant)"
              required
              buttonRef={variantRef}
              value={form.variant_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, variant_id: v }))
                setErrors((p) => ({ ...p, variant_id: undefined }))
              }}
              options={opts.variants}
              disabled={!form.species_id}
              loading={loading.variants}
              placeholder={form.species_id ? "— เลือก —" : "— เลือกสายพันธุ์ก่อน —"}
              errorText={errors.variant_id || loadErr.variants}
              onEnterNext={() => focusNextFromEl(variantRef.current)}
            />

            <ComboField
              label="ปีผลผลิต (Year)"
              buttonRef={yearRef}
              value={form.product_year}
              onChange={(v) => {
                setForm((p) => ({ ...p, product_year: v }))
                setErrors((p) => ({ ...p, product_year: undefined }))
              }}
              options={opts.years}
              loading={loading.static}
              placeholder="— ไม่ระบุ —"
              errorText={errors.product_year || loadErr.years}
              onEnterNext={() => focusNextFromEl(yearRef.current)}
            />

            <ComboField
              label="สภาพ/เงื่อนไข (Condition)"
              buttonRef={conditionRef}
              value={form.condition_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, condition_id: v }))
                setErrors((p) => ({ ...p, condition_id: undefined }))
              }}
              options={opts.conditions}
              loading={loading.static}
              placeholder="— ไม่ระบุ —"
              errorText={errors.condition_id || loadErr.conditions}
              onEnterNext={() => focusNextFromEl(conditionRef.current)}
            />

            <ComboField
              label="ประเภทแปลง (Field Type)"
              buttonRef={fieldTypeRef}
              value={form.field_type}
              onChange={(v) => {
                setForm((p) => ({ ...p, field_type: v }))
                setErrors((p) => ({ ...p, field_type: undefined }))
              }}
              options={opts.fieldTypes}
              loading={loading.static}
              placeholder="— ไม่ระบุ —"
              errorText={errors.field_type || loadErr.fieldTypes}
              onEnterNext={() => focusNextFromEl(fieldTypeRef.current)}
            />

            <ComboField
              label="โครงการ (Program)"
              buttonRef={programRef}
              value={form.program}
              onChange={(v) => {
                setForm((p) => ({ ...p, program: v }))
                setErrors((p) => ({ ...p, program: undefined }))
              }}
              options={opts.programs}
              loading={loading.static}
              placeholder="— ไม่ระบุ —"
              errorText={errors.program || loadErr.programs}
              onEnterNext={() => focusNextFromEl(programRef.current)}
            />

            <ComboField
              label="ประเภทธุรกิจ (Business Type)"
              buttonRef={businessRef}
              value={form.business_type}
              onChange={(v) => {
                setForm((p) => ({ ...p, business_type: v }))
                setErrors((p) => ({ ...p, business_type: undefined }))
              }}
              options={opts.businessTypes}
              loading={loading.static}
              placeholder="— ไม่ระบุ —"
              errorText={errors.business_type || loadErr.businessTypes}
              onEnterNext={() => focusNextFromEl(businessRef.current)}
            />
          </div>

          {/* preview */}
          <div className="mt-5">
            <div className="text-sm text-slate-600 dark:text-slate-300">ตัวอย่างชื่อ (Preview)</div>
            <div
              className={cx(
                "mt-2 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-base md:text-lg leading-relaxed",
                "ring-1",
                previewName
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60"
                  : "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-700/60"
              )}
              aria-live="polite"
            >
              {previewName || "— เลือกข้อมูลเพื่อแสดงตัวอย่าง —"}
            </div>
            <p className={helpTextCls}>
              * ชื่อจริงที่บันทึกจะถูกสร้างจากฝั่ง BE (prod_name) อาจต่างจาก preview
              หาก master data ไม่ตรงกัน
            </p>
          </div>

          {/* submit error */}
          {submitError && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-200">
              <div className="font-semibold">บันทึกล้มเหลว</div>
              <div className="text-sm leading-relaxed">{submitError}</div>
              <div className="mt-2 text-xs opacity-80">
                ถ้าเป็นเคสซ้ำ ระบบหลังบ้านจะตอบ 409 (Spec ซ้ำ)
              </div>
            </div>
          )}
        </SectionCard>

        {/* ปุ่ม */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            ref={submitRef}
            disabled={submitting}
            onClick={submit}
            className="inline-flex items-center justify-center rounded-2xl 
                      bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                      shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                      transition-all duration-300 ease-out
                      hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                      hover:scale-[1.05] active:scale-[.97]
                      disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            aria-busy={submitting ? "true" : "false"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                submit()
              }
            }}
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกรหัสข้าว"}
          </button>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-2xl 
                      border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
                      shadow-sm transition-all duration-300 ease-out
                      hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                      active:scale-[.97]
                      dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
                      dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
          >
            ล้างค่า
          </button>
        </div>

        {/* ผลลัพธ์ */}
        {result && (
          <SectionCard title="สร้างรหัสข้าวสำเร็จ" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[15px] md:text-base">
              <div>
                <div className="text-slate-500 dark:text-slate-300">Spec ID</div>
                <div className="font-semibold">{result.id ?? "—"}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-slate-500 dark:text-slate-300">ชื่อที่ระบบสร้าง (prod_name)</div>
                <div className="font-semibold">{result.prod_name ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">product_id</div>
                <div className="font-semibold">{String(result.product_id ?? "—")}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">species_id</div>
                <div className="font-semibold">{String(result.species_id ?? "—")}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">variant_id</div>
                <div className="font-semibold">{String(result.variant_id ?? "—")}</div>
              </div>

              <div>
                <div className="text-slate-500 dark:text-slate-300">product_year</div>
                <div className="font-semibold">{String(result.product_year ?? "—")}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">condition_id</div>
                <div className="font-semibold">{String(result.condition_id ?? "—")}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">field_type</div>
                <div className="font-semibold">{String(result.field_type ?? "—")}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">program</div>
                <div className="font-semibold">{String(result.program ?? "—")}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">business_type</div>
                <div className="font-semibold">{String(result.business_type ?? "—")}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm text-slate-600 dark:text-slate-300">Raw response (เผื่อดีบั๊ก)</div>
              <pre className="mt-2 overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </SectionCard>
        )}

        {/* tiny note for disabled input style (คงไว้เผื่อใช้) */}
        <div className="hidden">
          <input className={cx(baseField, fieldDisabled)} readOnly value="" />
        </div>
      </div>
    </div>
  )
}

export default RiceSpecCreate
