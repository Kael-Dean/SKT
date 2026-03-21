// src/pages/StockBringInMill.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { get, post } from "../lib/api"
import { cx, baseField, fieldDisabled, labelCls, helpTextCls, errorTextCls } from "../lib/styles"

/** ---------- Auth helpers ---------- */
const ALLOWED_USER_IDS = new Set([17, 18])
const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem("user")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/[^\d]/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
/** ---------- Styles ---------- */

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

/** ---------- Main Page: Bring In to Mill (ยกเข้าโรงสี) ---------- */
function StockBringInMill() {
  const navigate = useNavigate()

  // ❗ Guard ในระดับหน้า (กันคนรู้พาธแล้วเข้ามา)
  useEffect(() => {
    const u = getCurrentUser()
    const uid = Number(u?.id ?? u?.user_id ?? 0)
    if (!ALLOWED_USER_IDS.has(uid)) {
      // ไปหน้าแรกและใส่ state แจ้งเตือนถ้าต้องใช้
      navigate("/home", { replace: true, state: { denied: true } })
    }
  }, [navigate])

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})

  // lookups (id/label)
  const [productOptions, setProductOptions] = useState([])
  const [speciesOptions, setSpeciesOptions] = useState([])
  const [variantOptions, setVariantOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldTypeOptions, setFieldTypeOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

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

    // Mill Bring In
    klang_location: "",
    price1: "",
    price2: "", // optional
    amount_in: "",
    comment: "",
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  /** ---------- helpers ---------- */
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

  /** ---------- Load lookups ---------- */
  useEffect(() => {
    let alive = true
    async function loadInitial() {
      try {
        const [products, conditions, fields, years, programs, businesses, klangs] = await Promise.all([
          fetchFirstOkJson(["/order/product/search"]),
          fetchFirstOkJson(["/order/condition/search"]),
          fetchFirstOkJson(["/order/field/search", "/order/field_type/list", "/order/field-type/list"]),
          fetchFirstOkJson(["/order/year/search"]),
          fetchFirstOkJson(["/order/program/search"]),
          fetchFirstOkJson(["/order/business/search"]),
          fetchFirstOkJson(["/order/klang/search"]),
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
          (conditions || []).map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.condition ?? x.name ?? x.label ?? "").trim() }))
        )
        setFieldTypeOptions(
          (fields || []).map((x, i) => ({
            id: String(x.id ?? x.value ?? i),
            label: String(x.field ?? x.field_type ?? x.name ?? x.label ?? (typeof x === "string" ? x : "")).trim(),
          }))
        )
        setYearOptions((years || []).map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.year ?? x.name ?? x.label ?? "").trim() })))
        setProgramOptions((programs || []).map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.program ?? x.name ?? x.label ?? "").trim() })))
        setBusinessOptions((businesses || []).map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.business ?? x.name ?? x.label ?? "").trim() })))
        setKlangOptions((klangs || []).map((k) => ({ id: String(k.id ?? k.klang_id ?? ""), label: String(k.klang_name ?? k.name ?? `คลัง #${k.id ?? k.klang_id}`) })))
      } catch {
        if (!alive) return
        setProductOptions([]); setConditionOptions([]); setFieldTypeOptions([])
        setYearOptions([]); setProgramOptions([]); setBusinessOptions([]); setKlangOptions([])
      }
    }
    loadInitial()
    return () => { alive = false }
  }, [])

  /** ---------- Cascades ---------- */
  useEffect(() => {
    const pid = form.product_id
    if (!pid) {
      setSpeciesOptions([]); setVariantOptions([])
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
        setVariantOptions([])
        setForm((p) => ({ ...p, species_id: "", variant_id: "" }))
      } catch {
        if (!alive) return
        setSpeciesOptions([]); setVariantOptions([])
        setForm((p) => ({ ...p, species_id: "", variant_id: "" }))
      }
    }
    loadSpecies()
    return () => { alive = false }
  }, [form.product_id])

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
      } catch {
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
    const qty = toNumber(form.amount_in)
    const price = pricesArr[0] ?? 0
    return qty > 0 && price > 0 ? qty * price : 0
  }, [pricesArr, form.amount_in])

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
    if (!form.klang_location) m.klang_location = true
    if (pricesArr.length === 0) m.prices = true
    if (form.amount_in === "" || toNumber(form.amount_in) < 0) m.amount_in = true
    return m
  }

  const validate = () => {
    const e = {}
    if (!form.product_id) e.product_id = "กรุณาเลือกประเภทสินค้า"
    if (!form.species_id) e.species_id = "กรุณาเลือกชนิดข้าว"
    if (!form.variant_id) e.variant_id = "กรุณาเลือกชั้นย่อย/สายพันธุ์"
    if (!form.klang_location) e.klang_location = "กรุณาเลือกคลังโรงสีปลายทาง"
    if (pricesArr.length === 0) e.prices = "ต้องมีราคาอย่างน้อย 1 ช่อง และมากกว่า 0"
    if (form.amount_in === "") e.amount_in = "กรุณากรอกปริมาณยกเข้า"
    else if (toNumber(form.amount_in) < 0) e.amount_in = "ปริมาณต้องไม่น้อยกว่า 0"
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
      klang_location: Number(form.klang_location),
      prices: pricesArr, // 1-2 รายการ, > 0
      amount_in: form.amount_in === "" ? 0 : Number(form.amount_in),
      comment: form.comment?.trim() || null,
    }

    setLoading(true)
    try {
      await post("/mill/bring-in/create", payload)
      alert("บันทึกยกเข้าโรงสีสำเร็จ ✅")
      setForm((f) => ({ ...f, price1: "", price2: "", amount_in: "", comment: "" }))
      setErrors({})
      setMissingHints({})
    } catch (err) {
      console.error(err)
      const detail = err?.data?.detail ? `\n\nรายละเอียด:\n${JSON.stringify(err.data.detail, null, 2)}` : ""
      alert((err?.message || "บันทึกยกเข้าโรงสีไม่สำเร็จ") + detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🏭📥 ยอดยกเข้าโรงสี (Bring In to Mill)</h1>

        {/* สเปคสินค้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-xl font-semibold">กำหนดสเปคสินค้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>ประเภทสินค้า</label>
              <ComboBox
                options={productOptions}
                value={form.product_id}
                onChange={(v) => { clearError("product_id"); clearHint("product_id"); update("product_id", v) }}
                error={!!errors.product_id}
                hintRed={!!missingHints.product_id}
                clearHint={() => clearHint("product_id")}
                placeholder="— เลือกประเภทสินค้า —"
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
                placeholder="— เลือกชนิดข้าว —"
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
                placeholder="— เลือกชั้นย่อย —"
              />
              {errors.variant_id && <p className={errorTextCls}>{errors.variant_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ปีสินค้า/ฤดูกาล</label>
              <ComboBox
                options={yearOptions}
                value={form.product_year}
                onChange={(v) => update("product_year", v)}
                placeholder="— เลือกปี/ฤดูกาล —"
              />
              <p className={helpTextCls}>ไม่ระบุก็ได้</p>
            </div>

            <div>
              <label className={labelCls}>สภาพ/เงื่อนไข</label>
              <ComboBox
                options={conditionOptions}
                value={form.condition_id}
                onChange={(v) => update("condition_id", v)}
                placeholder="— เลือกสภาพ/เงื่อนไข —"
              />
            </div>

            <div>
              <label className={labelCls}>ประเภทนา</label>
              <ComboBox
                options={fieldTypeOptions}
                value={form.field_type}
                onChange={(v) => update("field_type", v)}
                placeholder="— เลือกประเภทนา —"
              />
            </div>

            <div>
              <label className={labelCls}>โปรแกรม</label>
              <ComboBox
                options={programOptions}
                value={form.program}
                onChange={(v) => update("program", v)}
                placeholder="— เลือกโปรแกรม —"
              />
            </div>

            <div>
              <label className={labelCls}>ประเภทธุรกิจ</label>
              <ComboBox
                options={businessOptions}
                value={form.business_type}
                onChange={(v) => update("business_type", v)}
                placeholder="— เลือกประเภทธุรกิจ —"
              />
            </div>
          </div>
        </div>

        {/* คลังโรงสีปลายทาง & ปริมาณ */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-xl font-semibold">คลังโรงสีปลายทางและปริมาณยกเข้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>เลือกคลังโรงสีปลายทาง</label>
              <ComboBox
                options={klangOptions}
                value={form.klang_location}
                onChange={(v) => { clearError("klang_location"); clearHint("klang_location"); update("klang_location", v) }}
                error={!!errors.klang_location}
                hintRed={!!missingHints.klang_location}
                clearHint={() => clearHint("klang_location")}
                placeholder="— เลือกคลัง —"
              />
              {errors.klang_location && <p className={errorTextCls}>{errors.klang_location}</p>}
            </div>

            <div>
              <label className={labelCls}>ปริมาณยกเข้า (กก.)</label>
              <input
                inputMode="decimal"
                className={cx(baseField, (errors.amount_in || missingHints.amount_in) && "border-red-500 ring-2 ring-red-300")}
                value={form.amount_in}
                onChange={(e) => update("amount_in", onlyDigits(e.target.value))}
                onFocus={() => { setErrors((p)=>({ ...p, amount_in: undefined })); clearHint("amount_in") }}
                placeholder="เช่น 12000"
                aria-invalid={errors.amount_in ? true : undefined}
              />
              {errors.amount_in && <p className={errorTextCls}>{errors.amount_in}</p>}
              <p className={helpTextCls}>ระบุได้ 0 หรือมากกว่า</p>
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
                onFocus={() => setErrors((p)=>({ ...p, prices: undefined }))}
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

        {/* บันทึกเพิ่มเติม / เหตุผล (ผู้รับ) */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label className={labelCls}>บันทึกเพิ่มเติม / เหตุผล (ผู้รับ)</label>
              <input
                className={baseField}
                value={form.comment}
                onChange={(e) => update("comment", e.target.value)}
                placeholder="เช่น ความชื้นสูง แกลบเยอะ หรือเหตุผลการที่ปฏิเสธ"
              />
            </div>
          </div>
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
            {loading ? "กำลังบันทึก..." : "บันทึก"}
          </button>

          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                price1: "",
                price2: "",
                amount_in: "",
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
            รีเซ็ต
          </button>
        </div>
      </div>
    </div>
  )
}

export default StockBringInMill
