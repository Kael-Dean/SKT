// src/pages/StockTransferMill.jsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react"
import { get, post } from "../lib/api"
import { cx, baseField, labelCls, helpTextCls, errorTextCls } from "../lib/styles"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => String(s ?? "").replace(/\D+/g, "")
const toInt = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}
/** ---------- Styles ---------- */

/** ---------- Helper: โฟกัสช่องถัดไปที่ใช้งานได้ ---------- */
const focusNextAvailable = (...refs) => {
  for (const r of refs) {
    const el = r?.current
    if (!el) continue
    // ถ้าเป็นปุ่ม/อินพุตที่ disabled ให้ข้าม
    if (typeof el.disabled !== "undefined" && el.disabled) continue
    try {
      el.focus()
      return true
    } catch {}
  }
  return false
}

/** ---------- ComboBox (รองรับ Enter → Next) ---------- */
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
  // เพิ่มฟีเจอร์ Enter chain
  enterToNext = false,
  onEnterNext = null,
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

    // ปิดอยู่ + กด Enter:
    // - ถ้า enterToNext และมีค่าแล้ว → ไปช่องถัดไป
    // - ถ้าไม่มีค่า → เปิดรายการ
    if (!open && e.key === "Enter") {
      e.preventDefault()
      clearHint?.()
      const hasValue = !(value === "" || value === null || value === undefined)
      if (enterToNext && hasValue) {
        onEnterNext?.()
      } else {
        setOpen(true)
        setHighlight((h) => (h >= 0 ? h : 0))
      }
      return
    }

    // ปิดอยู่ + Space/ArrowDown → เปิดรายการ
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
        commit(options[highlight])
        if (enterToNext) setTimeout(() => onEnterNext?.(), 0)
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

/** ---------- Page: ส่งสี ---------- */
function StockTransferMill() {
  const [submitting, setSubmitting] = useState(false)

  /** ---------- Dropdown options ---------- */
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([]) // species
  const [subriceOptions, setSubriceOptions] = useState([]) // variant

  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldTypeOptions, setFieldTypeOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])

  /** ---------- All Klangs (ทุกสาขา) ---------- */
  const [selectAllKlangs, setSelectAllKlangs] = useState(false)
  const [allKlangsCache, setAllKlangsCache] = useState([]) // [{id,label,branch_id,branch_label}]

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    lot_date: new Date().toISOString().slice(0, 10),
    lot_number: "",
    total_weight: "",
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

    condition_id: "",
    field_type_id: "",
    field_type_label: "",
    rice_year_id: "",
    rice_year_label: "",
    program_id: "",
    program_label: "",
    business_type_id: "",
    business_type_label: "",
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  /** ---------- Errors / hints ---------- */
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const redFieldCls = (key) => (errors[key] || missingHints[key] ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : "")
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })

  /** ---------- Eligible TempStock ---------- */
  const [eligible, setEligible] = useState([])
  const [loadingEligible, setLoadingEligible] = useState(false)
  const [eligibleErr, setEligibleErr] = useState("")

  /** ---------- Picks in this lot ---------- */
  const [picks, setPicks] = useState([]) // [{ tempstock_id, stock_id, amount_available, stock_branch, stock_klang, pick_weight }]
  const totalPicked = useMemo(() => picks.reduce((acc, it) => acc + toInt(it.pick_weight), 0), [picks])
  const requiredTotal = useMemo(() => toInt(form.total_weight), [form.total_weight])
  const diff = requiredTotal - totalPicked

  // ยืนยันก่อนล้างรายการเมื่อ "สเปกสินค้า" เปลี่ยน (ไม่ใช่สาขา/คลัง)
  const confirmClearIfNeeded = useCallback(() => {
    if (picks.length === 0) return true
    return window.confirm("มีรายการอยู่ในลอต การเปลี่ยนสเปกสินค้าจะล้างรายการทั้งหมดในลอต ต้องการทำต่อหรือไม่?")
  }, [picks.length])

  // เคลียร์เฉพาะผลค้นหา (เก็บ picks ไว้) เวลาที่ตั้งเปลี่ยน
  const clearEligibleOnly = useCallback(() => {
    setEligible([])
    setEligibleErr("")
  }, [])

  /** ---------- Refs สำหรับ Enter Chain ---------- */
  const lotNumberRef = useRef(null)
  const totalWeightRef = useRef(null)

  const branchBtnRef = useRef(null)
  const klangBtnRef = useRef(null)
  const productBtnRef = useRef(null)
  const speciesBtnRef = useRef(null)
  const variantBtnRef = useRef(null)
  const fieldTypeBtnRef = useRef(null)
  const yearBtnRef = useRef(null)
  const businessBtnRef = useRef(null)
  const programBtnRef = useRef(null)
  const submitBtnRef = useRef(null)

  /** ---------- Scroll/Focus helpers (ให้เหมือนหน้า Sales) ---------- */
  const scrollToPageTop = () => {
    try {
      const root = document.scrollingElement || document.documentElement || document.body
      root.scrollTo({ top: 0, behavior: "smooth" })
    } catch {}
  }

  const errorOrder = [
    "lot_number",
    "total_weight",
    "branch_id",
    "klang_id",
    "product_id",
    "rice_id",
    "subrice_id",
    "picks",
  ]
  const refMap = {
    lot_number: lotNumberRef,
    total_weight: totalWeightRef,
    branch_id: branchBtnRef,
    klang_id: klangBtnRef,
    product_id: productBtnRef,
    rice_id: speciesBtnRef,
    subrice_id: variantBtnRef,
    picks: totalWeightRef,
  }
  const focusByKey = (key) => {
    const r = refMap[key]
    const el = r?.current
    if (!el) return
    try { el.scrollIntoView({ behavior: "smooth", block: "center" }) } catch {}
    try { el.focus?.() } catch {}
  }
  const scrollToFirstError = (eObj) => {
    const firstKey = errorOrder.find((k) => k in eObj)
    if (firstKey) focusByKey(firstKey)
  }
  const scrollToFirstMissing = (hintsObj) => {
    const firstKey = errorOrder.find((k) => hintsObj[k])
    if (firstKey) focusByKey(firstKey)
  }

  /** ---------- Load dropdowns ---------- */
  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [branches, products, conditions, fields, years, programs, businesses] = await Promise.all([
          get("/order/branch/search"),
          get("/order/product/search"),
          get("/order/condition/search"),
          (async () => {
            try { return await get("/order/field/search") } catch {}
            try { return await get("/order/field_type/list") } catch {}
            try { return await get("/order/field-type/list") } catch {}
            return []
          })(),
          get("/order/year/search"),
          get("/order/program/search"),
          get("/order/business/search"),
        ])

        setBranchOptions((branches || []).map((b) => ({ id: b.id, label: b.branch_name })))

        setProductOptions(
          (products || [])
            .map((x) => ({
              id: String(x.id ?? x.product_id ?? x.value ?? ""),
              label: String(x.product_type ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        setConditionOptions(
          (conditions || []).map((c, i) => ({
            id: String(c.id ?? c.value ?? i),
            label: String(c.condition ?? c.name ?? c.label ?? "").trim(),
          }))
        )

        setFieldTypeOptions(
          (fields || []).map((f, i) => ({
            id: String(f.id ?? f.value ?? i),
            label: String(
              f.field ?? f.field_type ?? f.name ?? f.year ?? f.label ?? (typeof f === "string" ? f : "")
            ).trim(),
          }))
        )

        setYearOptions(
          (years || []).map((y, i) => ({
            id: String(y.id ?? y.value ?? i),
            label: String(y.year ?? y.name ?? y.label ?? "").trim(),
          }))
        )

        setProgramOptions(
          (programs || []).map((p, i) => ({
            id: String(p.id ?? p.value ?? i),
            label: String(p.program ?? p.name ?? p.label ?? "").trim(),
          }))
        )

        setBusinessOptions(
          (businesses || []).map((b, i) => ({
            id: String(b.id ?? b.value ?? i),
            label: String(b.business ?? b.name ?? b.label ?? "").trim(),
          }))
        )
      } catch (e) {
        console.error("load static error:", e)
        setBranchOptions([])
        setProductOptions([])
        setConditionOptions([])
        setFieldTypeOptions([])
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
      setRiceOptions([])
      update("rice_id", "")
      update("rice_type", "")
      update("subrice_id", "")
      update("subrice_name", "")
      return
    }
    const loadRice = async () => {
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
    loadRice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_id])

  // species -> variant
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
        const arr = await get(`/order/variant/search?species_id=${encodeURIComponent(rid)}`)
        const mapped = (arr || [])
          .map((x) => ({
            id: String(x.id ?? x.variant_id ?? x.value ?? ""),
            label: String(x.variant ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setSubriceOptions(mapped)
      } catch (e) {
        console.error("load variant error:", e)
        setSubriceOptions([])
      }
    }
    loadSub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.rice_id])

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.lot_number?.trim()) m.lot_number = true
    // klang_id ไม่บังคับ (รองรับ “ทุกคลัง”)
    if (!form.product_id) m.product_id = true
    if (!form.rice_id) m.rice_id = true
    if (!form.subrice_id) m.subrice_id = true
    if (!form.total_weight || toInt(form.total_weight) <= 0) m.total_weight = true
    return m
  }

  const validateBeforeSearch = () => {
    const e = {}
    // ถ้าไม่ได้เลือก “ทุกคลัง” ต้องมี klang_id
    if (!selectAllKlangs && !form.klang_id) e.klang_id = "กรุณาเลือกคลังสำหรับดึงรายการ หรือเปิดโหมด 'ดึงจากทุกคลัง'"
    if (!form.product_id) e.product_id = "กรุณาเลือกประเภทสินค้า"
    if (!form.rice_id) e.rice_id = "กรุณาเลือกชนิดข้าว"
    if (!form.subrice_id) e.subrice_id = "กรุณาเลือกชั้นย่อย"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ⭐ เปลี่ยนให้คืน "e object" เพื่อใช้แจ้งเตือนแบบหน้า Sales
  const validateBeforeSubmit = () => {
    const e = {}
    if (!form.lot_number?.trim()) e.lot_number = "กรุณาใส่เลข LOT"
    // ไม่บังคับ klang_id
    if (!form.product_id) e.product_id = "กรุณาเลือกประเภทสินค้า"
    if (!form.rice_id) e.rice_id = "กรุณาเลือกชนิดข้าว"
    if (!form.subrice_id) e.subrice_id = "กรุณาเลือกชั้นย่อย"

    const tw = toInt(form.total_weight)
    if (tw <= 0) e.total_weight = "น้ำหนักรวมต้องมากกว่า 0 (กก.) และเป็นจำนวนเต็ม"
    if (picks.length === 0) e.picks = "กรุณาเพิ่มคลังอย่างน้อย 1 รายการ"
    const totalPicked = picks.reduce((acc, it) => acc + toInt(it.pick_weight), 0)
    if (totalPicked !== tw)
      e.picks = `น้ำหนักที่เลือก (${totalPicked.toLocaleString()} กก.) ต้องเท่ากับน้ำหนักรวม (${tw.toLocaleString()} กก.)`

    setErrors(e)
    return e
  }

  /** ---------- Payload helpers ---------- */
  const buildSpecPayload = (includeKlang = true, klangIdOverride = null) => {
    const toIntOrNull = (v) => (v === "" || v == null ? null : Number(v))
    const yearVal =
      form.rice_year_label && /^\d{3,4}$/.test(form.rice_year_label)
        ? Number(form.rice_year_label)
        : toIntOrNull(form.rice_year_id)

    const baseSpec = {
      product_id: Number(form.product_id),
      species_id: Number(form.rice_id),
      variant_id: Number(form.subrice_id),
      product_year: yearVal,
      condition_id: toIntOrNull(form.condition_id),
      field_type: toIntOrNull(form.field_type_id),
      program: toIntOrNull(form.program_id),
      business_type: toIntOrNull(form.business_type_id),
    }

    const specWrapper = { spec: baseSpec }
    if (!includeKlang) return { spec: specWrapper } // สำหรับ submit (รองรับหลายคลัง)

    const klangLoc = klangIdOverride != null ? klangIdOverride : form.klang_id ?? null
    return { spec: { ...specWrapper, klang_location: klangLoc } }
  }

  /** ---------- All Klangs helper (ทุกสาขา) ---------- */
  const ensureAllKlangs = useCallback(async () => {
    if (allKlangsCache.length > 0) return allKlangsCache
    // ดึงคลังของทุกสาขา
    const branchMap = new Map(branchOptions.map((b) => [String(b.id), b.label]))
    const results = await Promise.allSettled(
      branchOptions.map((b) => get(`/order/klang/search?branch_id=${b.id}`))
    )
    const merged = []
    results.forEach((res, idx) => {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        const b = branchOptions[idx]
        res.value.forEach((k) => {
          merged.push({
            id: k.id,
            label: k.klang_name,
            branch_id: b.id,
            branch_label: branchMap.get(String(b.id)) || "",
          })
        })
      }
    })
    setAllKlangsCache(merged)
    return merged
  }, [allKlangsCache.length, branchOptions])

  /** ---------- Eligible fetch ---------- */
  const fetchEligible = async () => {
    setEligibleErr("")
    if (!validateBeforeSearch()) return
    setLoadingEligible(true)
    try {
      if (selectAllKlangs) {
        // ดึงจากทุกคลัง ทุกสาขา → รวมผล และ dedupe ตาม tempstock_id
        const allKlangs = await ensureAllKlangs()
        if (allKlangs.length === 0) {
          setEligible([])
          setEligibleErr("ไม่พบบัญชีคลังใด ๆ ในระบบ")
          setLoadingEligible(false)
          return
        }

        const payloads = allKlangs.map((k) => buildSpecPayload(true, k.id))
        const calls = await Promise.allSettled(payloads.map((pl) => post("/mill/eligible", pl)))

        const map = new Map() // tempstock_id -> row
        let totalFound = 0
        calls.forEach((c) => {
          if (c.status === "fulfilled" && Array.isArray(c.value)) {
            c.value.forEach((row) => {
              totalFound += 1
              // dedupe by tempstock_id (ล่าสุดทับเดิมไม่เป็นไร — ข้อมูลเหมือนกัน)
              map.set(row.tempstock_id, row)
            })
          }
        })
        const merged = Array.from(map.values())
        setEligible(merged)
        if (merged.length === 0) {
          setEligibleErr("ไม่พบบัญชี TempStock ที่เข้าเกณฑ์จากทุกคลัง")
        }
      } else {
        const payload = buildSpecPayload(true) // รวม klang เฉพาะที่เลือก
        const rows = await post("/mill/eligible", payload)
        setEligible(Array.isArray(rows) ? rows : [])
        if (!rows || rows.length === 0) setEligibleErr("ไม่พบบัญชี TempStock ที่เข้าเกณฑ์")
      }
    } catch (err) {
      console.error(err)
      setEligible([])
      setEligibleErr(err?.message || "ดึงคลังเข้าเกณฑ์ไม่สำเร็จ")
    } finally {
      setLoadingEligible(false)
    }
  }

  /** ---------- Pick handlers ---------- */
  const upsertPick = (row, weightStr) => {
    const pickInt = toInt(weightStr)
    if (pickInt <= 0) {
      alert("น้ำหนักต้องเป็นจำนวนเต็มกิโล (> 0)")
      return
    }
    if (pickInt > row.amount_available) {
      alert(`เกินคงเหลือในคลังนี้ (คงเหลือ ${row.amount_available.toLocaleString()} กก.)`)
      return
    }
    setPicks((prev) => {
      const idx = prev.findIndex((p) => p.tempstock_id === row.tempstock_id)
      const rec = {
        tempstock_id: row.tempstock_id,
        stock_id: row.stock_id,
        amount_available: row.amount_available,
        stock_branch: row.stock_branch ?? null,
        stock_klang: row.stock_klang,
        pick_weight: pickInt,
      }
      if (idx === -1) return [...prev, rec]
      const clone = prev.slice()
      clone[idx] = rec
      return clone
    })
  }

  const removePick = (tempstock_id) => setPicks((prev) => prev.filter((p) => p.tempstock_id !== tempstock_id))

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()
    // เหมือนหน้า Sales: เลื่อนขึ้นบนสุดก่อน validate
    scrollToPageTop()

    const hints = computeMissingHints()
    setMissingHints(hints)
    const eObj = validateBeforeSubmit()

    // ❌ แจ้งเตือนแบบ Sales เมื่อฟอร์มไม่ผ่าน
    if (Object.keys(eObj).length > 0) {
      alert("❌❌❌❌❌❌❌❌❌ บันทึกไม่สำเร็จ ❌❌❌❌❌❌❌❌❌\n\n                   รบกวนกรอกข้อมูลที่จำเป็นให้ครบในช่องที่มีกรอบสีแดง")
      scrollToFirstError(eObj)
      return
    }
    if (Object.values(hints).some(Boolean)) {
      alert("❌❌❌❌❌❌❌❌❌ บันทึกไม่สำเร็จ ❌❌❌❌❌❌❌❌❌\n\n                   รบกวนกรอกข้อมูลที่จำเป็นให้ครบในช่องที่มีกรอบสีแดง")
      scrollToFirstMissing(hints)
      return
    }

    setSubmitting(true)
    try {
      const specForSubmit = buildSpecPayload(false).spec // ไม่มี klang_location
      const payload = {
        lot_number: form.lot_number.trim(),
        spec: specForSubmit,
        total_weight: toInt(form.total_weight),
        items: picks.map((p) => ({
          tempstock_id: p.tempstock_id,
          pick_weight: toInt(p.pick_weight),
        })),
      }

      const created = await post("/mill/records", payload)

      // ✅ แจ้งเตือนสำเร็จ: รูปแบบเดียวกับหน้า Sales
      alert("✅✅✅✅✅✅✅✅ บันทึกออเดอร์เรียบร้อย ✅✅✅✅✅✅✅✅")

      // Reset เฉพาะส่วนสินค้า (คง branch/klang/โหมดทุกคลัง เผื่อดึงต่อ)
      setPicks([])
      clearEligibleOnly()
      setForm((f) => ({
        ...f,
        lot_number: "",
        total_weight: "",
        product_id: "",
        product_name: "",
        rice_id: "",
        rice_type: "",
        subrice_id: "",
        subrice_name: "",
        condition_id: "",
        field_type_id: "",
        field_type_label: "",
        rice_year_id: "",
        rice_year_label: "",
        program_id: "",
        program_label: "",
        business_type_id: "",
        business_type_label: "",
      }))

      requestAnimationFrame(() => scrollToPageTop())
      try { submitBtnRef.current?.blur?.() } catch {}
    } catch (err) {
      console.error(err)
      // ❌ แจ้งล้มเหลว: ข้อความแบบเดียวกับหน้า Sales พร้อมรายละเอียดจาก API ถ้ามี
      const baseMsg = err?.message || "เกิดข้อผิดพลาดระหว่างบันทึก"
      const detail = err?.data?.detail
      const summary = detail ? `\n\nรายละเอียด: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""
      alert(`❌❌❌❌❌❌❌❌❌ บันทึกไม่สำเร็จ ❌❌❌❌❌❌❌❌❌

${baseMsg}${summary}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🏭 ส่งสี / สร้างล็อตสี (ตัดสต็อก TempStock)</h1>

        <form onSubmit={handleSubmit}>
          {/* กรอบที่ 1: ข้อมูล LOT */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ข้อมูล LOT</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>เลข LOT</label>
                <input
                  ref={lotNumberRef}
                  className={cx(baseField, redFieldCls("lot_number"))}
                  value={form.lot_number}
                  onChange={(e) => update("lot_number", e.target.value)}
                  onFocus={() => {
                    clearError("lot_number")
                    clearHint("lot_number")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusNextAvailable(totalWeightRef)
                    }
                  }}
                  placeholder="เช่น MILL-2025-001"
                  aria-invalid={errors.lot_number ? true : undefined}
                />
                {errors.lot_number && <p className={errorTextCls}>{errors.lot_number}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักรวม LOT (กก.)</label>
                <input
                  ref={totalWeightRef}
                  inputMode="numeric"
                  className={cx(baseField, redFieldCls("total_weight"))}
                  value={form.total_weight}
                  onChange={(e) => update("total_weight", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("total_weight")
                    clearHint("total_weight")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      // ถ้าเปิดโหมดทุกคลัง → ข้ามสาขา/คลัง ไป "ประเภทสินค้า"
                      if (selectAllKlangs) {
                        focusNextAvailable(productBtnRef)
                      } else {
                        // ถ้า branch ถูก disable (ไม่มี) → ข้ามไปคลัง/ประเภทสินค้า
                        if (!focusNextAvailable(branchBtnRef)) {
                          if (!focusNextAvailable(klangBtnRef)) {
                            focusNextAvailable(productBtnRef)
                          }
                        }
                      }
                    }
                  }}
                  placeholder="เช่น 5000"
                  aria-invalid={errors.total_weight ? true : undefined}
                />
                <p className={helpTextCls}>ต้องเป็นจำนวนเต็ม เพื่อให้ตรงกับสคีมาของ TempStock (Integer)</p>
                {errors.total_weight && <p className={errorTextCls}>{errors.total_weight}</p>}
              </div>

              <div>
                <label className={labelCls}>วันที่ล็อต (ไม่บังคับ)</label>
                <DateInput
                  value={form.lot_date}
                  onChange={(e) => update("lot_date", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* กรอบที่ 2: ที่ตั้ง & สเปคข้าว */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ที่ตั้ง & สเปคข้าว</h2>

            {/* แถบสวิตช์ “ดึงจากทุกคลัง (ทุกสาขา)” */}
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700/60">
              <input
                id="allKlangs"
                type="checkbox"
                className="h-5 w-5 accent-emerald-600 cursor-pointer"
                checked={selectAllKlangs}
                onChange={(e) => {
                  const on = e.target.checked
                  setSelectAllKlangs(on)
                  // เปิดโหมดทุกคลัง → ปิดการเลือกคลังเดี่ยว / ล้างผลค้นหา
                  if (on) {
                    update("klang_id", null)
                    update("klang_name", "")
                  }
                  clearEligibleOnly()
                  clearError("klang_id")
                  clearHint("klang_id")
                }}
              />
              <label htmlFor="allKlangs" className="cursor-pointer select-none">
                ดึงจาก <b>ทุกคลัง</b> ที่มีข้าวตามสเปค (ทุกสาขา)
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* สาขา */}
              <div>
                <label className={labelCls}>สาขา</label>
                <ComboBox
                  options={branchOptions}
                  value={form.branch_id}
                  getValue={(o) => o.id}
                  onChange={(_v, found) => {
                    clearError("branch_id")
                    update("branch_id", found?.id ?? null)
                    update("branch_name", found?.label ?? "")
                    // เปลี่ยนสาขา: เคลียร์คลังที่เลือก & เคลียร์ผลค้นหา (เก็บ picks ไว้)
                    update("klang_id", null)
                    update("klang_name", "")
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกสาขา —"
                  disabled={selectAllKlangs} // โหมดทุกคลัง: ไม่ต้องเลือกสาขา
                  buttonRef={branchBtnRef}
                  enterToNext
                  onEnterNext={() => {
                    // ถ้า "คลัง" ใช้ไม่ได้ (disabled) ให้ข้ามไป "ประเภทสินค้า"
                    if (!focusNextAvailable(klangBtnRef)) focusNextAvailable(productBtnRef)
                  }}
                />
                {selectAllKlangs && (
                  <p className={helpTextCls}>โหมด “ทุกคลัง” จะค้นหาทุกสาขาให้อัตโนมัติ</p>
                )}
              </div>

              {/* คลัง */}
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
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกคลัง —"
                  disabled={!form.branch_id || selectAllKlangs}
                  error={!selectAllKlangs && !!errors.klang_id}
                  hintRed={!selectAllKlangs && !!missingHints.klang_id}
                  buttonRef={klangBtnRef}
                  enterToNext
                  onEnterNext={() => focusNextAvailable(productBtnRef)}
                />
                <p className={helpTextCls}>
                  {selectAllKlangs
                    ? "กำลังใช้โหมดดึงจากทุกคลัง (ปิดการเลือกคลังเดี่ยว)"
                    : "เลือกคลัง → ดึงรายการ → เพิ่มเข้า “ลอต” ได้หลายคลัง"}
                </p>
                {!selectAllKlangs && errors.klang_id && <p className={errorTextCls}>{errors.klang_id}</p>}
              </div>

              {/* ประเภทสินค้า */}
              <div>
                <label className={labelCls}>ประเภทสินค้า</label>
                <ComboBox
                  options={productOptions}
                  value={form.product_id}
                  onChange={(id, found) => {
                    if (!confirmClearIfNeeded()) return
                    clearError("product_id")
                    clearHint("product_id")
                    update("product_id", id)
                    update("product_name", found?.label ?? "")
                    update("rice_id", "")
                    update("rice_type", "")
                    update("subrice_id", "")
                    update("subrice_name", "")
                    setPicks([])
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกประเภทสินค้า —"
                  error={!!errors.product_id}
                  buttonRef={productBtnRef}
                  enterToNext
                  onEnterNext={() => focusNextAvailable(speciesBtnRef)}
                />
                {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
              </div>

              {/* ชนิดข้าว */}
              <div>
                <label className={labelCls}>ชนิดข้าว (Species)</label>
                <ComboBox
                  options={riceOptions}
                  value={form.rice_id}
                  onChange={(id, found) => {
                    if (!confirmClearIfNeeded()) return
                    clearError("rice_id")
                    clearHint("rice_id")
                    update("rice_id", id)
                    update("rice_type", found?.label ?? "")
                    update("subrice_id", "")
                    update("subrice_name", "")
                    setPicks([])
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกชนิดข้าว —"
                  disabled={!form.product_id}
                  error={!!errors.rice_id}
                  buttonRef={speciesBtnRef}
                  enterToNext
                  onEnterNext={() => focusNextAvailable(variantBtnRef)}
                />
                {errors.rice_id && <p className={errorTextCls}>{errors.rice_id}</p>}
              </div>

              {/* ชั้นย่อย */}
              <div>
                <label className={labelCls}>ชั้นย่อย (Variant)</label>
                <ComboBox
                  options={subriceOptions}
                  value={form.subrice_id}
                  onChange={(id, found) => {
                    if (!confirmClearIfNeeded()) return
                    clearError("subrice_id")
                    clearHint("subrice_id")
                    update("subrice_id", id)
                    update("subrice_name", found?.label ?? "")
                    setPicks([])
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกชั้นย่อย —"
                  disabled={!form.rice_id}
                  error={!!errors.subrice_id}
                  buttonRef={variantBtnRef}
                  enterToNext
                  // ตามคำสั่ง: จาก Variant → ประเภทนา (ข้าม "สภาพ/เงื่อนไข")
                  onEnterNext={() => focusNextAvailable(fieldTypeBtnRef)}
                />
                {errors.subrice_id && <p className={errorTextCls}>{errors.subrice_id}</p>}
              </div>

              {/* สภาพ/เงื่อนไข (ไม่บังคับ) — ไม่อยู่ในลำดับ Enter ที่ร้องขอ */}
              <div>
                <label className={labelCls}>สภาพ/เงื่อนไข (ไม่บังคับ)</label>
                <ComboBox
                  options={conditionOptions}
                  value={form.condition_id}
                  onChange={(id, found) => {
                    update("condition_id", found?.id ?? id)
                    setPicks([])
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกสภาพ/เงื่อนไข —"
                />
              </div>

              {/* ประเภทนา (ไม่บังคับ) */}
              <div>
                <label className={labelCls}>ประเภทนา (ไม่บังคับ)</label>
                <ComboBox
                  options={fieldTypeOptions}
                  value={form.field_type_id}
                  onChange={(id, found) => {
                    update("field_type_id", found?.id ?? id)
                    update("field_type_label", found?.label ?? "")
                    setPicks([])
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกประเภทนา —"
                  buttonRef={fieldTypeBtnRef}
                  enterToNext
                  onEnterNext={() => focusNextAvailable(yearBtnRef)}
                />
              </div>

              {/* ปี/ฤดูกาล (ไม่บังคับ) */}
              <div>
                <label className={labelCls}>ปี/ฤดูกาล (ไม่บังคับ)</label>
                <ComboBox
                  options={yearOptions}
                  value={form.rice_year_id}
                  onChange={(id, found) => {
                    update("rice_year_id", found?.id ?? id)
                    update("rice_year_label", found?.label ?? "")
                    setPicks([])
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกปี/ฤดูกาล —"
                  buttonRef={yearBtnRef}
                  enterToNext
                  onEnterNext={() => focusNextAvailable(businessBtnRef)}
                />
              </div>

              {/* ประเภทธุรกิจ (ไม่บังคับ) */}
              <div>
                <label className={labelCls}>ประเภทธุรกิจ (ไม่บังคับ)</label>
                <ComboBox
                  options={businessOptions}
                  value={form.business_type_id}
                  onChange={(id, found) => {
                    update("business_type_id", found?.id ?? id)
                    update("business_type_label", found?.label ?? "")
                    setPicks([])
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกประเภทธุรกิจ —"
                  buttonRef={businessBtnRef}
                  enterToNext
                  onEnterNext={() => focusNextAvailable(programBtnRef)}
                />
              </div>

              {/* โปรแกรม (ไม่บังคับ) */}
              <div>
                <label className={labelCls}>โปรแกรม (ไม่บังคับ)</label>
                <ComboBox
                  options={programOptions}
                  value={form.program_id}
                  onChange={(id, found) => {
                    update("program_id", found?.id ?? id)
                    update("program_label", found?.label ?? "")
                    setPicks([])
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกโปรแกรม —"
                  buttonRef={programBtnRef}
                  enterToNext
                  onEnterNext={() => {
                    // จุดสิ้นสุดลำดับ — ยังไม่โฟกัสต่อ (ถ้าต้องการให้ไปปุ่ม "ดึงคลังที่เข้าเกณฑ์" แจ้งได้)
                  }}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={fetchEligible}
                className="inline-flex items-center justify-center rounded-2xl 
                  bg-indigo-600 px-6 py-3 text-base font-semibold text-white
                  shadow-[0_6px_16px_rgba(79,70,229,0.35)]
                  transition-all duration-300 ease-out
                  hover:bg-indigo-700 hover:shadow-[0_8px_20px_rgba(79,70,229,0.45)]
                  hover:scale-[1.05] active:scale-[.97]
                  disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                aria-busy={loadingEligible ? "true" : "false"}
                disabled={loadingEligible}
              >
                {loadingEligible ? (selectAllKlangs ? "กำลังดึงจากทุกคลัง..." : "กำลังดึงคลังที่เข้าเกณฑ์...") : (selectAllKlangs ? "ดึงจากทุกคลัง (ทุกสาขา)" : "ดึงคลังที่เข้าเกณฑ์")}
              </button>

              <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center">
                {eligible.length > 0 && `พบ ${eligible.length} รายการที่เข้าเกณฑ์`}
                {eligibleErr && <span className="text-red-500">{eligibleErr}</span>}
              </div>
            </div>
          </div>

          {/* กรอบที่ 3: รายการคลังที่เข้าเกณฑ์ + เพิ่มเข้าลอต */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">เลือกคลังเข้าลอต</h2>

            <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/40">
                  <tr>
                    <th className="px-3 py-2">TempStock ID</th>
                    <th className="px-3 py-2">Stock ID</th>
                    <th className="px-3 py-2">สาขา</th>
                    <th className="px-3 py-2">คลัง</th>
                    <th className="px-3 py-2">คงเหลือ (กก.)</th>
                    <th className="px-3 py-2 w-48">ใส่กก.ที่จะใช้</th>
                    <th className="px-3 py-2 w-32">เพิ่ม/อัปเดต</th>
                  </tr>
                </thead>
                <tbody>
                  {eligible.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                        — ไม่มีข้อมูล — กด “{selectAllKlangs ? "ดึงจากทุกคลัง" : "ดึงคลังที่เข้าเกณฑ์"}” หลังเลือกสเปคข้าว —
                      </td>
                    </tr>
                  )}
                  {eligible.map((row) => (
                    <RowEligible
                      key={row.tempstock_id}
                      row={row}
                      defaultWeight={picks.find((p) => p.tempstock_id === row.tempstock_id)?.pick_weight ?? ""}
                      onAdd={(w) => upsertPick(row, w)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* กรอบที่ 4: สรุปรายการในลอต */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">รายการในลอต</h2>

            <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/40">
                  <tr>
                    <th className="px-3 py-2">TempStock ID</th>
                    <th className="px-3 py-2">คลัง</th>
                    <th className="px-3 py-2">คงเหลือ</th>
                    <th className="px-3 py-2 w-40">กก. ที่ใช้</th>
                    <th className="px-3 py-2 w-24">ลบ</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-slate-500">— ยังไม่มีรายการ —</td>
                    </tr>
                  )}
                  {picks.map((p) => (
                    <tr key={p.tempstock_id} className="border-t border-slate-100 dark:border-slate-700/60">
                      <td className="px-3 py-2">{p.tempstock_id}</td>
                      <td className="px-3 py-2">{p.stock_klang}</td>
                      <td className="px-3 py-2">{p.amount_available.toLocaleString()} กก.</td>
                      <td className="px-3 py-2">
                        <input
                          inputMode="numeric"
                          className={baseField}
                          value={p.pick_weight}
                          onChange={(e) => {
                            const v = onlyDigits(e.target.value)
                            const next = toInt(v)
                            setPicks((prev) =>
                              prev.map((x) =>
                                x.tempstock_id === p.tempstock_id
                                  ? { ...x, pick_weight: next > x.amount_available ? x.amount_available : next }
                                  : x
                              )
                            )
                          }}
                          onBlur={() => {
                            setPicks((prev) =>
                              prev.map((x) =>
                                x.tempstock_id === p.tempstock_id
                                  ? { ...x, pick_weight: Math.max(1, toInt(x.pick_weight)) }
                                  : x
                              )
                            )
                          }}
                          placeholder="เช่น 1200"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removePick(p.tempstock_id)}
                          className="rounded-xl border border-slate-300 px-3 py-2 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700/60"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Progress */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-600 dark:text-slate-300">
                  รวมที่เลือก: <b>{totalPicked.toLocaleString()}</b> / ต้องการ <b>{requiredTotal.toLocaleString()}</b> กก.
                </div>
                <div
                  className={cx(
                    "font-semibold",
                    diff === 0 ? "text-emerald-600" : diff > 0 ? "text-amber-600" : "text-red-600"
                  )}
                >
                  {diff === 0
                    ? "ครบตามน้ำหนักรวม"
                    : diff > 0
                    ? `ขาดอีก ${diff.toLocaleString()} กก.`
                    : `เกิน ${Math.abs(diff).toLocaleString()} กก.`}
                </div>
              </div>
              <div className="mt-2 h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={cx("h-3 rounded-full transition-all", diff === 0 ? "bg-emerald-500" : "bg-amber-500")}
                  style={{ width: `${requiredTotal === 0 ? 0 : Math.min(100, Math.max(0, (totalPicked / requiredTotal) * 100))}%` }}
                />
              </div>
              {errors.picks && <p className={errorTextCls + " mt-2"}>{errors.picks}</p>}
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
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </button>

            <button
              type="button"
              onClick={() => {
                setPicks([])
                clearEligibleOnly()
                setForm((f) => ({
                  ...f,
                  lot_number: "",
                  total_weight: "",
                  product_id: "",
                  product_name: "",
                  rice_id: "",
                  rice_type: "",
                  subrice_id: "",
                  subrice_name: "",
                  condition_id: "",
                  field_type_id: "",
                  field_type_label: "",
                  rice_year_id: "",
                  rice_year_label: "",
                  program_id: "",
                  program_label: "",
                  business_type_id: "",
                  business_type_label: "",
                }))
                setErrors({})
                setMissingHints({})
              }}
              className="inline-flex items-center justify-center rounded-2xl 
                border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
                shadow-sm
                transition-all duration-300 ease-out
                hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                active:scale-[.97]
                dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
                dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
            >
              ล้างฟอร์ม LOT/สินค้า
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** แถวในตาราง Eligible พร้อมอินพุตน้ำหนักท้องถิ่น */
function RowEligible({ row, defaultWeight, onAdd }) {
  const [w, setW] = useState(defaultWeight ?? "")
  useEffect(() => setW(defaultWeight ?? ""), [defaultWeight])

  const canAdd = toInt(w) > 0

  return (
    <tr className="border-t border-slate-100 dark:border-slate-700/60">
      <td className="px-3 py-2">{row.tempstock_id}</td>
      <td className="px-3 py-2">{row.stock_id}</td>
      <td className="px-3 py-2">{row.stock_branch ?? "—"}</td>
      <td className="px-3 py-2">{row.stock_klang}</td>
      <td className="px-3 py-2">{row.amount_available?.toLocaleString()} กก.</td>
      <td className="px-3 py-2">
        <input
          inputMode="numeric"
          className={baseField}
          value={w}
          onChange={(e) => setW(onlyDigits(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (canAdd) onAdd(w)
            }
          }}
          placeholder="จำนวนเต็ม"
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={() => onAdd(w)}
          disabled={!canAdd}
          className={cx(
            "rounded-xl px-3 py-2 text-white",
            canAdd ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400 cursor-not-allowed"
          )}
        >
          เพิ่ม/อัปเดต
        </button>
      </td>
    </tr>
  )
}

export default StockTransferMill
