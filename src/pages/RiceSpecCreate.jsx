// src/pages/RiceSpecCreate.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../lib/api"

/** ---------- Utils ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toInt = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : NaN
}
const pickId = (row) =>
  row?.id ??
  row?.product_id ??
  row?.species_id ??
  row?.variant_id ??
  row?.year_id ??
  row?.condition_id ??
  row?.field_type_id ??
  row?.program_id ??
  row?.business_type_id ??
  null

/** ---------- Theme (ยกจากธีมหน้า Share) ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
const fieldError =
  "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"
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

/** ---------- SelectField ---------- */
function SelectField({
  label,
  value,
  onChange,
  options = [],
  placeholder = "— เลือก —",
  error,
  loading = false,
  disabled = false,
  help,
  inputRef,
  required = false,
  onEnterNext,
}) {
  return (
    <div>
      <label className={labelCls}>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>

      <select
        ref={inputRef}
        className={cx(baseField, error && fieldError)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        aria-invalid={error ? true : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            onEnterNext?.(e.currentTarget)
          }
        }}
      >
        <option value="">{loading ? "กำลังโหลด..." : placeholder}</option>
        {options.map((o) => (
          <option key={`${o.value}`} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>

      {help && <p className={helpTextCls}>{help}</p>}
      {error && <p className={errorTextCls}>{error}</p>}
    </div>
  )
}

/** ---------- หน้าเพิ่ม “รหัสข้าว” (ProductSpec) ---------- */
function RiceSpecCreate() {
  /**
   * ปรับ endpoint master data ได้ตามฝั่ง BE ของโปรเจค
   * - POST /spec/ : สร้างรหัสข้าว (ตามไฟล์ BE ที่ให้มา)
   * - ส่วน master list ด้านล่าง: ถ้า endpoint ไม่ตรง ให้แก้ค่า URL ให้เข้ากับระบบ
   */
  const API = useMemo(
    () => ({
      createSpec: "/spec/",

      // ✅ ปรับให้ตรงกับ BE ที่มีอยู่จริงในโปรเจคคุณ
      products: "/product/",
      species: "/species/",
      variants: "/variant/",
      years: "/product-year/",
      conditions: "/product-condition/",
      fieldTypes: "/field-type/",
      programs: "/program/",
      businessTypes: "/business-type/",
    }),
    []
  )

  /** --- master data --- */
  const [masters, setMasters] = useState({
    products: [],
    species: [],
    variants: [],
    years: [],
    conditions: [],
    fieldTypes: [],
    programs: [],
    businessTypes: [],
  })
  const [masterLoading, setMasterLoading] = useState(false)
  const [masterErrs, setMasterErrs] = useState({}) // per list error

  const mapList = (arr, labelKey) => {
    if (!Array.isArray(arr)) return []
    return arr
      .map((r) => ({
        value: pickId(r),
        label:
          (r?.[labelKey] ?? r?.name ?? r?.label ?? r?.title ?? "").toString() ||
          `#${pickId(r) ?? "?"}`,
      }))
      .filter((x) => x.value !== null && x.value !== undefined && x.value !== "")
  }

  const safeFetch = async (key, url, labelKey) => {
    try {
      const data = await apiAuth(url)
      // รองรับทั้ง array ตรงๆ หรือห่ออยู่ใน {items: []}
      const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      setMasterErrs((p) => ({ ...p, [key]: undefined }))
      return mapList(arr, labelKey)
    } catch (e) {
      setMasterErrs((p) => ({
        ...p,
        [key]: "โหลดรายการไม่สำเร็จ (ปรับ endpoint ให้ตรงกับ BE)",
      }))
      return []
    }
  }

  const loadMasterData = async () => {
    setMasterLoading(true)
    try {
      const [
        products,
        species,
        variants,
        years,
        conditions,
        fieldTypes,
        programs,
        businessTypes,
      ] = await Promise.all([
        safeFetch("products", API.products, "product_type"),
        safeFetch("species", API.species, "species"),
        safeFetch("variants", API.variants, "variant"),
        safeFetch("years", API.years, "year"),
        safeFetch("conditions", API.conditions, "condition"),
        safeFetch("fieldTypes", API.fieldTypes, "field_type"),
        safeFetch("programs", API.programs, "program"),
        safeFetch("businessTypes", API.businessTypes, "business_type"),
      ])

      setMasters({
        products,
        species,
        variants,
        years,
        conditions,
        fieldTypes,
        programs,
        businessTypes,
      })
    } finally {
      setMasterLoading(false)
    }
  }

  useEffect(() => {
    loadMasterData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Refs + Enter focus
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
      next?.current?.focus()
    } catch {}
  }

  const validate = () => {
    const e = {}
    if (!form.product_id) e.product_id = "เลือกประเภทสินค้า (product)"
    if (!form.species_id) e.species_id = "เลือกชนิด/สายพันธุ์ (species)"
    if (!form.variant_id) e.variant_id = "เลือกพันธุ์/รูปแบบ (variant)"

    // กันกรณี select ได้ค่าไม่เป็นตัวเลข
    ;["product_id", "species_id", "variant_id"].forEach((k) => {
      if (form[k] && !Number.isFinite(toInt(form[k]))) e[k] = "รูปแบบรหัสไม่ถูกต้อง"
    })
    ;["product_year", "condition_id", "field_type", "program", "business_type"].forEach(
      (k) => {
        if (form[k] && !Number.isFinite(toInt(form[k]))) e[k] = "รูปแบบรหัสไม่ถูกต้อง"
      }
    )

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
    productRef.current?.focus()
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
      // apiAuth น่าจะ throw Error ที่มี message แล้ว
      const msg = err?.message || "บันทึกล้มเหลว"
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // preview (ประกอบจาก label ที่เลือกได้ เพื่อช่วยตรวจทานก่อนบันทึก)
  const previewName = useMemo(() => {
    const findLabel = (arr, v) => arr.find((x) => String(x.value) === String(v))?.label
    const parts = [
      findLabel(masters.products, form.product_id),
      findLabel(masters.species, form.species_id),
      findLabel(masters.variants, form.variant_id),
    ]
    const yearLabel = findLabel(masters.years, form.product_year)
    if (yearLabel) parts.push(`ปี ${yearLabel}`)
    const conditionLabel = findLabel(masters.conditions, form.condition_id)
    if (conditionLabel) parts.push(conditionLabel)
    const fieldLabel = findLabel(masters.fieldTypes, form.field_type)
    if (fieldLabel) parts.push(fieldLabel)
    const programLabel = findLabel(masters.programs, form.program)
    if (programLabel) parts.push(programLabel)
    const businessLabel = findLabel(masters.businessTypes, form.business_type)
    if (businessLabel) parts.push(businessLabel)

    return parts.filter(Boolean).join(" / ")
  }, [form, masters])

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-5xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-1 text-3xl font-bold">➕ เพิ่มรหัสข้าว</h1>
        <p className="mb-5 text-slate-600 dark:text-slate-300">
          เลือกข้อมูลให้ครบ (อย่างน้อย 3 ช่องแรก) แล้วกดบันทึก ระบบหลังบ้านจะสร้าง{" "}
          <span className="font-semibold">prod_name</span> ให้อัตโนมัติ
        </p>

        {/* ฟอร์ม */}
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
              {masterLoading ? "กำลังโหลดรายการ..." : "รายการตัวเลือกถูกโหลดจากระบบ"}
            </div>
            <button
              type="button"
              onClick={loadMasterData}
              disabled={masterLoading}
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
            <SelectField
              label="ประเภทสินค้า (Product)"
              required
              inputRef={productRef}
              value={form.product_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, product_id: v }))
                setErrors((p) => ({ ...p, product_id: undefined }))
              }}
              options={masters.products}
              loading={masterLoading}
              error={errors.product_id || masterErrs.products}
              onEnterNext={focusNextFromEl}
            />

            <SelectField
              label="ชนิด/สายพันธุ์ (Species)"
              required
              inputRef={speciesRef}
              value={form.species_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, species_id: v }))
                setErrors((p) => ({ ...p, species_id: undefined }))
              }}
              options={masters.species}
              loading={masterLoading}
              error={errors.species_id || masterErrs.species}
              onEnterNext={focusNextFromEl}
            />

            <SelectField
              label="พันธุ์/รูปแบบ (Variant)"
              required
              inputRef={variantRef}
              value={form.variant_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, variant_id: v }))
                setErrors((p) => ({ ...p, variant_id: undefined }))
              }}
              options={masters.variants}
              loading={masterLoading}
              error={errors.variant_id || masterErrs.variants}
              onEnterNext={focusNextFromEl}
            />

            <SelectField
              label="ปีผลผลิต (Year)"
              inputRef={yearRef}
              value={form.product_year}
              onChange={(v) => {
                setForm((p) => ({ ...p, product_year: v }))
                setErrors((p) => ({ ...p, product_year: undefined }))
              }}
              options={masters.years}
              loading={masterLoading}
              error={errors.product_year || masterErrs.years}
              placeholder="— ไม่ระบุ —"
              onEnterNext={focusNextFromEl}
            />

            <SelectField
              label="สภาพ/เงื่อนไข (Condition)"
              inputRef={conditionRef}
              value={form.condition_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, condition_id: v }))
                setErrors((p) => ({ ...p, condition_id: undefined }))
              }}
              options={masters.conditions}
              loading={masterLoading}
              error={errors.condition_id || masterErrs.conditions}
              placeholder="— ไม่ระบุ —"
              onEnterNext={focusNextFromEl}
            />

            <SelectField
              label="ประเภทแปลง (Field Type)"
              inputRef={fieldTypeRef}
              value={form.field_type}
              onChange={(v) => {
                setForm((p) => ({ ...p, field_type: v }))
                setErrors((p) => ({ ...p, field_type: undefined }))
              }}
              options={masters.fieldTypes}
              loading={masterLoading}
              error={errors.field_type || masterErrs.fieldTypes}
              placeholder="— ไม่ระบุ —"
              onEnterNext={focusNextFromEl}
            />

            <SelectField
              label="โครงการ (Program)"
              inputRef={programRef}
              value={form.program}
              onChange={(v) => {
                setForm((p) => ({ ...p, program: v }))
                setErrors((p) => ({ ...p, program: undefined }))
              }}
              options={masters.programs}
              loading={masterLoading}
              error={errors.program || masterErrs.programs}
              placeholder="— ไม่ระบุ —"
              onEnterNext={focusNextFromEl}
            />

            <SelectField
              label="ประเภทธุรกิจ (Business Type)"
              inputRef={businessRef}
              value={form.business_type}
              onChange={(v) => {
                setForm((p) => ({ ...p, business_type: v }))
                setErrors((p) => ({ ...p, business_type: undefined }))
              }}
              options={masters.businessTypes}
              loading={masterLoading}
              error={errors.business_type || masterErrs.businessTypes}
              placeholder="— ไม่ระบุ —"
              onEnterNext={focusNextFromEl}
            />
          </div>

          {/* preview */}
          <div className="mt-5">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              ตัวอย่างชื่อ (Preview)
            </div>
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
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Raw response (เผื่อดีบั๊ก)
              </div>
              <pre className="mt-2 overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}

export default RiceSpecCreate
