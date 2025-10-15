// src/pages/StockBringIn.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { get, post } from "../lib/api"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/[^\d]/g, "")
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

/** ---------- ComboBox (generic) ---------- */
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
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
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

/** ---------- Main Page: Carry Over (ยอดยกมาเข้าคลัง) ---------- */
function StockBringIn() {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})

  // lookups (มาตรฐาน id/label เสมอ)
  const [productOptions, setProductOptions] = useState([])
  const [speciesOptions, setSpeciesOptions] = useState([])
  const [variantOptions, setVariantOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldTypeOptions, setFieldTypeOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  // ฟอร์ม (ค่าเลือกเก็บเป็น string id)
  const [form, setForm] = useState({
    // ProductSpecIn
    product_id: "",
    species_id: "",
    variant_id: "",
    product_year: "",
    condition_id: "",
    field_type: "",
    program: "",
    business_type: "",

    // CarryOver
    co_klang: "",
    price1: "",
    price2: "", // optional
    co_available: "",
    comment: "",
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  /** ---------- helpers: ดึง JSON แรกที่ ok ---------- */
  const fetchFirstOkJson = async (paths = []) => {
    for (const p of paths) {
      try {
        const data = await get(p)
        if (Array.isArray(data)) return data
        if (data && typeof data === "object") return data
      } catch (_) {}
    }
    return Array.isArray(paths) ? [] : {}
  }

  /** ---------- Load lookups (รอบแรก) ---------- */
  useEffect(() => {
    let alive = true
    async function loadInitial() {
      try {
        // ตามกติกาโปรเจกต์
        const [products, conditions, fields, years, programs, businesses, klangs] = await Promise.all([
          fetchFirstOkJson(["/order/product/search"]),
          fetchFirstOkJson(["/order/condition/search"]),
          fetchFirstOkJson(["/order/field/search", "/order/field_type/list", "/order/field-type/list"]),
          fetchFirstOkJson(["/order/year/search"]),
          fetchFirstOkJson(["/order/program/search"]),
          fetchFirstOkJson(["/order/business/search"]),
          fetchFirstOkJson(["/order/klang/search"]), // ถ้าอยากจำกัดตามสาขา ให้เปลี่ยน qs เป็น branch_id/name
        ])

        if (!alive) return

        setProductOptions(
          (products || [])
            .map((x) => ({
              id: String(x.id ?? x.product_id ?? x.value ?? ""),
              label: String(x.product_type ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        setConditionOptions(
            (conditions || [])
              .map((x, i) => ({
                id: String(x.id ?? x.value ?? i),
                label: String(x.condition ?? x.name ?? x.label ?? "").trim(),
              }))
              .filter((o) => o.id && o.label)
        )

        setFieldTypeOptions(
          (fields || [])
            .map((x, i) => ({
              id: String(x.id ?? x.value ?? i),
              label: String(x.field ?? x.field_type ?? x.name ?? x.label ?? (typeof x === "string" ? x : "")).trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        setYearOptions(
          (years || [])
            .map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.year ?? x.name ?? x.label ?? "").trim() }))
            .filter((o) => o.id && o.label)
        )

        setProgramOptions(
          (programs || [])
            .map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.program ?? x.name ?? x.label ?? "").trim() }))
            .filter((o) => o.id && o.label)
        )

        setBusinessOptions(
          (businesses || [])
            .map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.business ?? x.name ?? x.label ?? "").trim() }))
            .filter((o) => o.id && o.label)
        )

        setKlangOptions(
          (klangs || []).map((k) => ({
            id: String(k.id ?? k.klang_id ?? ""),
            label: String(k.klang_name ?? k.name ?? `คลัง #${k.id ?? k.klang_id}`),
          }))
        )
      } catch (e) {
        if (!alive) return
        setProductOptions([]); setConditionOptions([]); setFieldTypeOptions([])
        setYearOptions([]); setProgramOptions([]); setBusinessOptions([]); setKlangOptions([])
      }
    }
    loadInitial()
    return () => { alive = false }
  }, [])

  /** ---------- Cascades: product → species ---------- */
  useEffect(() => {
    const pid = form.product_id
    if (!pid) {
      setSpeciesOptions([])
      setVariantOptions([])
      setForm((p) => ({ ...p, species_id: "", variant_id: "" }))
      return
    }
    let alive = true
    const loadSpecies = async () => {
      try {
        const arr = (await get(`/order/species/search?product_id=${encodeURIComponent(pid)}`)) || []
        const mapped = arr
          .map((x) => ({ id: String(x.id ?? x.species_id ?? x.value ?? ""), label: String(x.species ?? x.name ?? x.label ?? "").trim() }))
          .filter((o) => o.id && o.label)
        if (!alive) return
        setSpeciesOptions(mapped)
        // reset variant เมื่อ species list เปลี่ยน
        setVariantOptions([])
        setForm((p) => ({ ...p, species_id: "", variant_id: "" }))
      } catch (e) {
        if (!alive) return
        setSpeciesOptions([]); setVariantOptions([])
        setForm((p) => ({ ...p, species_id: "", variant_id: "" }))
      }
    }
    loadSpecies()
    return () => { alive = false }
  }, [form.product_id])

  /** ---------- Cascades: species → variant ---------- */
  useEffect(() => {
    const sid = form.species_id
    if (!sid) {
      setVariantOptions([])
      setForm((p) => ({ ...p, variant_id: "" }))
      return
    }
    let alive = true
    const loadVariant = async () => {
      try {
        const arr = (await get(`/order/variant/search?species_id=${encodeURIComponent(sid)}`)) || []
        const mapped = arr
          .map((x) => ({ id: String(x.id ?? x.variant_id ?? x.value ?? ""), label: String(x.variant ?? x.name ?? x.label ?? "").trim() }))
          .filter((o) => o.id && o.label)
        if (!alive) return
        setVariantOptions(mapped)
        setForm((p) => ({ ...p, variant_id: "" }))
      } catch (e) {
        if (!alive) return
        setVariantOptions([])
        setForm((p) => ({ ...p, variant_id: "" }))
      }
    }
    loadVariant()
    return () => { alive = false }
  }, [form.species_id])

  /** ---------- Derived ---------- */
  const pricesArr = useMemo(() => {
    const a = []
    const p1 = toNumber(form.price1)
    const p2 = toNumber(form.price2)
    if (form.price1 !== "" && p1 > 0) a.push(p1)
    if (form.price2 !== "" && p2 > 0) a.push(p2)
    return a
  }, [form.price1, form.price2])

  const totalValuation = useMemo(() => {
    const qty = toNumber(form.co_available)
    const price = pricesArr[0] ?? 0
    return qty > 0 && price > 0 ? qty * price : 0
  }, [pricesArr, form.co_available])

  const redFieldCls = (key) =>
    errors[key] || missingHints[key] ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : ""
  const redHintCls = (key) =>
    missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : ""
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.product_id) m.product_id = true
    if (!form.species_id) m.species_id = true
    if (!form.variant_id) m.variant_id = true
    if (!form.co_klang) m.co_klang = true
    if (pricesArr.length === 0) m.prices = true
    if (form.co_available === "" || toNumber(form.co_available) < 0) m.co_available = true
    return m
  }

  const validate = () => {
    const e = {}
    if (!form.product_id) e.product_id = "กรุณาเลือกประเภทสินค้า"
    if (!form.species_id) e.species_id = "กรุณาเลือกชนิดข้าว"
    if (!form.variant_id) e.variant_id = "กรุณาเลือกชั้นย่อย/สายพันธุ์"
    if (!form.co_klang) e.co_klang = "กรุณาเลือกคลังปลายทาง"
    if (pricesArr.length === 0) e.prices = "ต้องมีราคาอย่างน้อย 1 ช่อง และมากกว่า 0"
    if (form.co_available === "") e.co_available = "กรุณากรอกปริมาณยกมา"
    else if (toNumber(form.co_available) < 0) e.co_available = "ปริมาณต้องไม่น้อยกว่า 0"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()
    const hints = computeMissingHints()
    setMissingHints(hints)
    if (!validate()) return

    const payload = {
      spec: {
        product_id: Number(form.product_id),
        species_id: Number(form.species_id),
        variant_id: Number(form.variant_id),
        product_year: form.product_year === "" ? null : Number(form.product_year),
        condition_id: form.condition_id === "" ? null : Number(form.condition_id),
        field_type: form.field_type === "" ? null : Number(form.field_type),
        program: form.program === "" ? null : Number(form.program),
        business_type: form.business_type === "" ? null : Number(form.business_type),
      },
      co_klang: Number(form.co_klang),
      prices: pricesArr, // 1-2 รายการ, > 0 ตาม BE
      co_available: form.co_available === "" ? 0 : Number(form.co_available),
      comment: form.comment?.trim() || null,
    }

    setLoading(true)
    try {
      await post("/carryover/create", payload)
      alert("บันทึกยอดยกมาสำเร็จ ✅")

      // reset เฉพาะค่าที่ควรล้าง
      setForm((f) => ({
        ...f,
        price1: "",
        price2: "",
        co_available: "",
        comment: "",
      }))
      setErrors({})
      setMissingHints({})
    } catch (err) {
      console.error(err)
      const detail = err?.data?.detail ? `\n\nรายละเอียด:\n${JSON.stringify(err.data.detail, null, 2)}` : ""
      alert((err?.message || "บันทึกยอดยกมาไม่สำเร็จ") + detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">📥 ยอดยกมา (Carry Over)</h1>

        {/* สเปคสินค้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-xl font-semibold">กำหนดสเปคสินค้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>ประเภทสินค้า</label>
              <ComboBox
                options={productOptions}
                value={form.product_id}
                onChange={(v) => {
                  clearError("product_id"); clearHint("product_id")
                  update("product_id", v)
                }}
                error={!!errors.product_id}
                hintRed={!!missingHints.product_id}
                clearHint={() => clearHint("product_id")}
                placeholder="เลือกประเภท"
              />
              {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ชนิดข้าว (Species)</label>
              <ComboBox
                options={speciesOptions}
                value={form.species_id}
                onChange={(v) => { clearError("species_id"); clearHint("species_id"); update("species_id", v) }}
                error={!!errors.species_id}
                hintRed={!!missingHints.species_id}
                clearHint={() => clearHint("species_id")}
                placeholder="เลือกชนิดข้าว"
              />
              {errors.species_id && <p className={errorTextCls}>{errors.species_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ชั้นย่อย/สายพันธุ์ (Variant)</label>
              <ComboBox
                options={variantOptions}
                value={form.variant_id}
                onChange={(v) => { clearError("variant_id"); clearHint("variant_id"); update("variant_id", v) }}
                error={!!errors.variant_id}
                hintRed={!!missingHints.variant_id}
                clearHint={() => clearHint("variant_id")}
                placeholder="เลือกชั้นย่อย"
              />
              {errors.variant_id && <p className={errorTextCls}>{errors.variant_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ปีสินค้า/ฤดูกาล</label>
              <ComboBox
                options={yearOptions}
                value={form.product_year}
                onChange={(v) => update("product_year", v)}
                placeholder="(เว้นว่างได้)"
              />
              <p className={helpTextCls}>ไม่ระบุก็ได้</p>
            </div>

            <div>
              <label className={labelCls}>สภาพ/เงื่อนไข</label>
              <ComboBox
                options={conditionOptions}
                value={form.condition_id}
                onChange={(v) => update("condition_id", v)}
                placeholder="(เว้นว่างได้)"
              />
            </div>

            <div>
              <label className={labelCls}>ประเภทนา</label>
              <ComboBox
                options={fieldTypeOptions}
                value={form.field_type}
                onChange={(v) => update("field_type", v)}
                placeholder="(เว้นว่างได้)"
              />
            </div>

            <div>
              <label className={labelCls}>โปรแกรม</label>
              <ComboBox
                options={programOptions}
                value={form.program}
                onChange={(v) => update("program", v)}
                placeholder="(เว้นว่างได้)"
              />
            </div>

            <div>
              <label className={labelCls}>ประเภทธุรกิจ</label>
              <ComboBox
                options={businessOptions}
                value={form.business_type}
                onChange={(v) => update("business_type", v)}
                placeholder="(เว้นว่างได้)"
              />
            </div>
          </div>
        </div>

        {/* คลังปลายทาง & ปริมาณ */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-xl font-semibold">คลังปลายทางและปริมาณยกเข้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>เลือกคลังปลายทาง</label>
              <ComboBox
                options={klangOptions}
                value={form.co_klang}
                onChange={(v) => { clearError("co_klang"); clearHint("co_klang"); update("co_klang", v) }}
                error={!!errors.co_klang}
                hintRed={!!missingHints.co_klang}
                clearHint={() => clearHint("co_klang")}
                placeholder="เลือกคลัง"
              />
              {errors.co_klang && <p className={errorTextCls}>{errors.co_klang}</p>}
            </div>

            <div>
              <label className={labelCls}>ปริมาณยกมา (กก.)</label>
              <input
                inputMode="decimal"
                className={cx(baseField, redFieldCls("co_available"))}
                value={form.co_available}
                onChange={(e) => update("co_available", onlyDigits(e.target.value))}
                onFocus={() => { clearError("co_available"); clearHint("co_available") }}
                placeholder="เช่น 12000"
                aria-invalid={errors.co_available ? true : undefined}
              />
              {errors.co_available && <p className={errorTextCls}>{errors.co_available}</p>}
              <p className={helpTextCls}>ระบุได้ 0 หรือมากกว่า</p>
            </div>

            <div className="md:col-span-1">
              <label className={labelCls}>หมายเหตุ (ถ้ามี)</label>
              <input
                className={baseField}
                value={form.comment}
                onChange={(e) => update("comment", e.target.value)}
                placeholder="เช่น ยกเข้าต้นปี, เปิดงบประมาณฯ"
              />
            </div>
          </div>
        </div>

        {/* ราคายกเข้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-xl font-semibold">ราคายกเข้า</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className={labelCls}>ราคา 1 (บาท/กก.)</label>
              <input
                inputMode="decimal"
                className={cx(baseField, errors.prices && "border-red-400 ring-2 ring-red-300/70")}
                value={form.price1}
                onChange={(e) => update("price1", e.target.value.replace(/[^\d.]/g, ""))}
                onFocus={() => clearError("prices")}
                placeholder="เช่น 9.50"
              />
              <p className={helpTextCls}>ต้องกรอกอย่างน้อย 1 ช่อง</p>
            </div>

            <div>
              <label className={labelCls}>ราคา 2 (บาท/กก.)</label>
              <input
                inputMode="decimal"
                className={baseField}
                value={form.price2}
                onChange={(e) => update("price2", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="(เว้นว่างได้)"
              />
            </div>

            <div>
              <label className={labelCls}>มูลค่าประเมินรวม</label>
              <input disabled className={cx(baseField, fieldDisabled)} value={thb(totalValuation)} />
              <p className={helpTextCls}>คำนวณจาก ราคา 1 × ปริมาณ</p>
            </div>
          </div>
          {errors.prices && <p className={errorTextCls}>{errors.prices}</p>}
        </div>

        {/* ปุ่ม */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-2xl 
              bg-emerald-600 px-6 py-3 text-base font-semibold text-white
              shadow-[0_6px_16px_rgba(16,185,129,0.35)]
              transition-all duration-300 ease-out
              hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
              hover:scale-[1.05] active:scale-[.97]
              disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            aria-busy={loading ? "true" : "false"}
          >
            {loading ? "กำลังบันทึก..." : "บันทึกยอดยกเข้า"}
          </button>

          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                price1: "",
                price2: "",
                co_available: "",
                comment: "",
              }))
            }
            className="inline-flex items-center justify-center rounded-2xl 
              border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
              shadow-sm transition-all duration-300 ease-out
              hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
              active:scale-[.97]
              dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
              dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
          >
            ล้างเฉพาะราคากับปริมาณ
          </button>
        </div>
      </div>
    </div>
  )
}

export default StockBringIn
