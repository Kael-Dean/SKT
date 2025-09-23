// src/pages/StockTransferMill.jsx
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

/** ---------- ComboBox (เหมือนหน้ายกเข้า) ---------- */
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

/** ---------- DateInput (เหมือนหน้ายกเข้า) ---------- */
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

/** ---------- Page: ส่งสี (ตัดสต็อก) ---------- */
function StockTransferMill() {
  const [submitting, setSubmitting] = useState(false)

  /** ---------- Dropdown options ---------- */
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])
  const [subriceOptions, setSubriceOptions] = useState([])

  // เมตาดาต้า (ตรงกับหน้ายกเข้า)
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldOptions, setFieldOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    transfer_date: new Date().toISOString().slice(0, 10),

    branch_id: null,
    branch_name: "",
    klang_id: null,
    klang_name: "",

    product_id: "",
    product_name: "",
    rice_id: "",
    rice_type: "",
    subrice_id: "",
    subrice_name: "",

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
    milling_fee: "", // บาท/กก. (อาจไม่บังคับ)
    note: "",
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  /** ---------- Derived ---------- */
  const weightOut = useMemo(() => toNumber(form.weight_out), [form.weight_out])
  const feePerKg = useMemo(() => toNumber(form.milling_fee), [form.milling_fee])
  const totalFee = useMemo(() => weightOut * feePerKg, [weightOut, feePerKg])

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

  /** ---------- Load dropdowns (เหมือนยกเข้า) ---------- */
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

        setConditionOptions((conditions || []).map((c) => ({ id: c.id, label: c.condition })))

        setFieldOptions(
          (fields || [])
            .map((f) => ({ id: f.id, label: f.field ?? f.field_type ?? "" }))
            .filter((o) => o.id && o.label)
        )

        setYearOptions((years || []).map((y) => ({ id: y.id, label: y.year })))
        setProgramOptions((programs || []).map((p) => ({ id: p.id, label: p.program })))
        setBusinessOptions((businesses || []).map((b) => ({ id: b.id, label: b.business })))
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

  // product -> rice
  useEffect(() => {
    const pid = form.product_id
    if (!pid) {
      setRiceOptions([])
      update("rice_id", "")
      update("rice_type", "")
      update("subrice_id", "")
      update("subrice_name", "")
      return
    }
    const loadRice = async () => {
      try {
        const arr = await get(`/order/rice/search?product_id=${encodeURIComponent(pid)}`)
        const mapped = (arr || [])
          .map((x) => ({
            id: String(x.id ?? x.rice_id ?? x.value ?? ""),
            label: String(x.rice_type ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setRiceOptions(mapped)
      } catch (e) {
        console.error("load rice error:", e)
        setRiceOptions([])
      }
    }
    loadRice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_id])

  // rice -> subrice
  useEffect(() => {
    const rid = form.rice_id
    if (!rid) {
      setSubriceOptions([])
      update("subrice_id", "")
      update("subrice_name", "")
      return
    }
    const loadSub = async () => {
      try {
        const arr = await get(`/order/sub-rice/search?rice_id=${encodeURIComponent(rid)}`)
        const mapped = (arr || [])
          .map((x) => ({
            id: String(x.id ?? x.subrice_id ?? x.value ?? ""),
            label: String(x.sub_class ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setSubriceOptions(mapped)
      } catch (e) {
        console.error("load subrice error:", e)
        setSubriceOptions([])
      }
    }
    loadSub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.rice_id])

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.transfer_date) m.transfer_date = true

    if (!form.branch_id) m.branch_id = true
    if (!form.klang_id) m.klang_id = true

    if (!form.product_id) m.product_id = true
    if (!form.rice_id) m.rice_id = true
    if (!form.subrice_id) m.subrice_id = true

    if (!form.weight_out || Number(form.weight_out) <= 0) m.weight_out = true
    // milling_fee ไม่บังคับ แต่ถ้าใส่ต้องไม่ติดลบ
    if (form.milling_fee !== "" && Number(form.milling_fee) < 0) m.milling_fee = true

    return m
  }

  const validate = () => {
    const e = {}
    if (!form.transfer_date) e.transfer_date = "กรุณาเลือกวันที่ส่งสี"

    if (!form.branch_id) e.branch_id = "กรุณาเลือกสาขา"
    if (!form.klang_id) e.klang_id = "กรุณาเลือกคลัง"

    if (!form.product_id) e.product_id = "กรุณาเลือกประเภทสินค้า"
    if (!form.rice_id) e.rice_id = "กรุณาเลือกชนิดข้าว"
    if (!form.subrice_id) e.subrice_id = "กรุณาเลือกชั้นย่อย"

    if (toNumber(form.weight_out) <= 0) e.weight_out = "น้ำหนักต้องมากกว่า 0"
    if (form.milling_fee !== "" && toNumber(form.milling_fee) < 0) e.milling_fee = "ค่าบริการต้องไม่ติดลบ"

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
      const payload = {
        transfer_date: form.transfer_date,
        branch_id: form.branch_id ?? null,
        klang_id: form.klang_id ?? null,

        product_id: /^\d+$/.test(form.product_id) ? Number(form.product_id) : form.product_id,
        rice_id: /^\d+$/.test(form.rice_id) ? Number(form.rice_id) : form.rice_id,
        subrice_id: /^\d+$/.test(form.subrice_id) ? Number(form.subrice_id) : form.subrice_id,

        // ข้อมูลตัดสต็อกออก
        weight_out: toNumber(form.weight_out),

        // ค่าบริการสี (optional)
        milling_fee: form.milling_fee === "" ? null : toNumber(form.milling_fee),
        total_fee: form.milling_fee === "" ? null : toNumber(totalFee),

        // เมตาดาต้า (ถ้า backend รองรับค่อยเปิดใช้)
        // condition_id: form.condition_id ? Number(form.condition_id) : null,
        // field_type_id: form.field_type_id ? Number(form.field_type_id) : null,
        // rice_year_id: form.rice_year_id ? Number(form.rice_year_id) : null,
        // program_id: form.program_id ? Number(form.program_id) : null,
        // business_type_id: form.business_type_id ? Number(form.business_type_id) : null,

        note: form.note?.trim() || null,
      }

      await post("/api/stock/transfer/mill", payload)

      alert("บันทึกส่งสี (ตัดสต็อก) สำเร็จ ✅")
      setForm((f) => ({
        ...f,
        // คงสาขา/คลังไว้ เผื่อส่งสีต่อเนื่อง
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
        weight_out: "",
        milling_fee: "",
        note: "",
      }))
    } catch (err) {
      console.error(err)
      alert(err?.message || "เกิดข้อผิดพลาดระหว่างบันทึก")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🏭 ส่งสี (ตัดสต็อกออก)</h1>

        <form onSubmit={handleSubmit}>
          {/* กรอบที่ 1: ที่ตั้ง (สาขา/คลัง) & วันที่ */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ข้อมูลส่งสี</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>วันที่ส่งสี</label>
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

              <div>
                <label className={labelCls}>ชนิดข้าว</label>
                <ComboBox
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
                />
                {errors.rice_id && <p className={errorTextCls}>{errors.rice_id}</p>}
              </div>

              <div>
                <label className={labelCls}>ชั้นย่อย (Sub-class)</label>
                <ComboBox
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
                />
                {errors.subrice_id && <p className={errorTextCls}>{errors.subrice_id}</p>}
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

          {/* กรอบที่ 3: น้ำหนักและค่าบริการสี */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">น้ำหนักและค่าบริการสี</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={labelCls}>น้ำหนักที่ส่งสี (กก.)</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("weight_out"))}
                  value={form.weight_out}
                  onChange={(e) => update("weight_out", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearError("weight_out")
                    clearHint("weight_out")
                  }}
                  placeholder="เช่น 5000"
                  aria-invalid={errors.weight_out ? true : undefined}
                />
                {errors.weight_out && <p className={errorTextCls}>{errors.weight_out}</p>}
              </div>

              <div>
                <label className={labelCls}>ค่าบริการสี (บาท/กก.)</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("milling_fee"))}
                  value={form.milling_fee}
                  onChange={(e) => update("milling_fee", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearError("milling_fee")
                    clearHint("milling_fee")
                  }}
                  placeholder="เช่น 2.00"
                  aria-invalid={errors.milling_fee ? true : undefined}
                />
                <p className={helpTextCls}>ว่างได้ ถ้าไม่ทราบ — ระบบจะคิดรวมอัตโนมัติถ้ากรอก</p>
                {errors.milling_fee && <p className={errorTextCls}>{errors.milling_fee}</p>}
              </div>

              <div>
                <label className={labelCls}>ค่าบริการรวม (บาท)</label>
                <input disabled className={cx(baseField, fieldDisabled)} value={form.milling_fee === "" ? "—" : thb(totalFee)} />
                <p className={helpTextCls}>คำนวณ = น้ำหนัก × ค่าบริการ/กก.</p>
              </div>

              <div className="md:col-span-4">
                <label className={labelCls}>บันทึกเพิ่มเติม</label>
                <textarea
                  className={baseField}
                  rows={3}
                  value={form.note}
                  onChange={(e) => update("note", e.target.value)}
                  placeholder="เช่น ส่งสีที่โรงสี A"
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
                bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                transition-all duration-300 ease-out
                hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                hover:scale-[1.05] active:scale-[.97]
                disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              aria-busy={submitting ? "true" : "false"}
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกส่งสี (ตัดสต็อก)"}
            </button>

            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  // เคลียร์เฉพาะข้อมูลสินค้า/น้ำหนัก/ราคา
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
                  weight_out: "",
                  milling_fee: "",
                  note: "",
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
              ล้างฟอร์มสินค้า/บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StockTransferMill
