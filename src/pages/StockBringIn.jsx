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
  /** ===== โหมด Enter ข้ามช่อง ===== */
  enterMovesFocus = false,
  onEnterWhenClosed = null,
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

    // ----- ปิดอยู่ -----
    if (!open) {
      // กด Enter เพื่อ "ข้ามช่อง"
      if (enterMovesFocus && e.key === "Enter") {
        e.preventDefault()
        onEnterWhenClosed?.()
        return
      }
      // เปิดรายการด้วย Space / ArrowDown (หรือ Enter ถ้าไม่ใช่โหมดข้ามช่อง)
      if (e.key === " " || e.key === "ArrowDown" || (!enterMovesFocus && e.key === "Enter")) {
        e.preventDefault()
        setOpen(true)
        setHighlight((h) => (h >= 0 ? h : 0))
        clearHint?.()
        return
      }
      return
    }

    // ----- เปิดอยู่ -----
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
          if (disabled) return
          setOpen((prev) => {
            const next = !prev
            // เปิดด้วยการคลิก (รวมโปรแกรมคลิก) ให้ไฮไลต์ตัวแรกเสมอ
            if (next) setHighlight((h) => (h >= 0 ? h : 0))
            else setHighlight(-1)
            return next
          })
        }}
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

  // ⭐ จุดยึดบนสุด + ฟังก์ชันเลื่อนขึ้นบน (ให้เหมือนหน้า Sales)
  const pageTopRef = useRef(null)
  const scrollToPageTop = () => {
    try { pageTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }) } catch {}
    const root = document.scrollingElement || document.documentElement || document.body
    try { root.scrollTo({ top: 0, behavior: "smooth" }) } catch { root.scrollTop = 0 }
  }

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

  const initialForm = {
    // ProductSpecIn (บังคับทุกช่อง)
    product_id: "",
    species_id: "",
    variant_id: "",
    product_year: "",
    condition_id: "",
    field_type: "",
    program: "",
    business_type: "",

    // CarryOver (บังคับราคา 1 & 2, ปริมาณ, คลัง)
    co_klang: "",
    price1: "",
    price2: "",
    co_available: "",
    comment: "", // ไม่บังคับ
  }

  const [form, setForm] = useState(initialForm)
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
    const qty = toNumber(form.co_available)
    const price = pricesArr[0] ?? 0
    return qty > 0 && price > 0 ? qty * price : 0
  }, [pricesArr, form.co_available])

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
    if (!form.product_year) m.product_year = true
    if (!form.condition_id) m.condition_id = true
    if (!form.field_type) m.field_type = true
    if (!form.program) m.program = true
    if (!form.business_type) m.business_type = true
    if (!form.co_klang) m.co_klang = true
    // บังคับราคา 1 และ 2 > 0
    if (!(toNumber(form.price1) > 0 && toNumber(form.price2) > 0)) m.prices = true
    // ปริมาณต้อง > 0
    if (form.co_available === "" || toNumber(form.co_available) <= 0) m.co_available = true
    return m
  }

  const validate = () => {
    const e = {}
    if (!form.product_id) e.product_id = "กรุณาเลือกประเภทสินค้า"
    if (!form.species_id) e.species_id = "กรุณาเลือกชนิดข้าว"
    if (!form.variant_id) e.variant_id = "กรุณาเลือกชั้นย่อย/สายพันธุ์"
    if (!form.product_year) e.product_year = "กรุณาเลือกปี/ฤดูกาล"
    if (!form.condition_id) e.condition_id = "กรุณาเลือกสภาพ/เงื่อนไข"
    if (!form.field_type) e.field_type = "กรุณาเลือกประเภทนา"
    if (!form.program) e.program = "กรุณาเลือกโปรแกรม"
    if (!form.business_type) e.business_type = "กรุณาเลือกประเภทธุรกิจ"
    if (!form.co_klang) e.co_klang = "กรุณาเลือกคลังปลายทาง"
    // ต้องมีราคา 1 และ ราคา 2 และทั้งคู่ > 0
    if (!(toNumber(form.price1) > 0 && toNumber(form.price2) > 0)) {
      e.prices = "ต้องกรอกราคา 1 และ ราคา 2 มากกว่า 0"
    }
    if (form.co_available === "") e.co_available = "กรุณากรอกปริมาณยกมา"
    else if (toNumber(form.co_available) <= 0) e.co_available = "ปริมาณต้องมากกว่า 0"
    setErrors(e)
    return { ok: Object.keys(e).length === 0, e }
  }

  /** ---------- ===== Keyboard Flow: Enter ไล่โฟกัส + เปิด dropdown ถัดไป ===== ---------- */
  // refs เรียงซ้าย -> ขวา
  const productRef = useRef(null)
  const speciesRef = useRef(null)
  const variantRef = useRef(null)
  const yearRef = useRef(null)
  const conditionRef = useRef(null)
  const fieldTypeRef = useRef(null)
  const programRef = useRef(null)
  const businessRef = useRef(null)
  const klangRef = useRef(null)
  const coAvailableRef = useRef(null)
  const price1Ref = useRef(null)
  const price2Ref = useRef(null)
  const commentRef = useRef(null)
  const submitBtnRef = useRef(null)

  const orderedRefs = useMemo(
    () => [
      productRef,
      speciesRef,
      variantRef,
      yearRef,
      conditionRef,
      fieldTypeRef,
      programRef,
      businessRef,
      klangRef,
      coAvailableRef,
      price1Ref,
      price2Ref,
      commentRef,
      submitBtnRef, // ปุ่ม
    ],
    []
  )

  const focusNextAndOpenIfCombo = (refObj) => {
    const idx = orderedRefs.findIndex((r) => r === refObj)
    if (idx === -1) return
    for (let i = idx + 1; i < orderedRefs.length; i++) {
      const el = orderedRefs[i]?.current
      if (el && !el.disabled && typeof el.focus === "function") {
        el.focus()
        // ถ้าเป็นปุ่มของ ComboBox ให้เปิด dropdown ทันที (ถ้ายังไม่เปิด)
        const hasPopup = el.getAttribute?.("aria-haspopup")
        if (hasPopup === "listbox") {
          const expanded = el.getAttribute("aria-expanded") === "true"
          if (!expanded) {
            // เปิดหลังจากโฟกัสแล้ว 1 เฟรม
            requestAnimationFrame(() => {
              if (el.getAttribute("aria-expanded") !== "true") el.click()
            })
          }
        }
        return
      }
    }
  }

  const onEnterKey = (e, currentRef) => {
    if (e.key === "Enter") {
      e.preventDefault()
      focusNextAndOpenIfCombo(currentRef)
    }
  }

  /** ---------- Helper: focus + scroll to first invalid ---------- */
  const fieldRefByKey = {
    product_id: productRef,
    species_id: speciesRef,
    variant_id: variantRef,
    product_year: yearRef,
    condition_id: conditionRef,
    field_type: fieldTypeRef,
    program: programRef,
    business_type: businessRef,
    co_klang: klangRef,
    co_available: coAvailableRef,
    prices: price1Ref,
  }

  const scrollAndFocus = (ref) => {
    const el = ref?.current
    if (!el) return
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      // หากเป็น ComboBox (button) ให้โฟกัส + เปิดรายการเพื่อให้เลือกได้ทันที
      el.focus({ preventScroll: true })
      const hasPopup = el.getAttribute?.("aria-haspopup")
      if (hasPopup === "listbox" && el.getAttribute("aria-expanded") !== "true") {
        // เปิดหลังเลื่อนจบเล็กน้อย
        setTimeout(() => {
          if (el.getAttribute("aria-expanded") !== "true") el.click()
        }, 120)
      }
    } catch (_) {}
  }

  const focusFirstInvalid = (hints, e) => {
    const order = [
      "product_id",
      "species_id",
      "variant_id",
      "product_year",
      "condition_id",
      "field_type",
      "program",
      "business_type",
      "co_klang",
      "co_available",
      "prices",
    ]
    const firstKey = order.find((k) => hints[k] || e[k])
    if (!firstKey) return
    // ชี้แดงแบบ hint และโฟกัสช่องแรกที่ผิด
    setMissingHints((prev) => ({ ...prev, [firstKey]: true }))
    const ref = fieldRefByKey[firstKey]
    // รอให้ DOM อัปเดตแล้วค่อยเลื่อน
    setTimeout(() => scrollAndFocus(ref), 0)
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()

    // เลื่อนขึ้นบนสุดให้เหมือนหน้า Sales
    scrollToPageTop()

    const hints = computeMissingHints()
    setMissingHints(hints)

    const { ok, e: ev } = validate()

    // ❌ แจ้งเตือนแบบหน้า Sales เมื่อฟอร์มไม่ผ่าน
    if (!ok || Object.values(hints).some(Boolean)) {
      alert("❌❌❌❌❌❌❌❌❌ บันทึกไม่สำเร็จ ❌❌❌❌❌❌❌❌❌\n\n                   รบกวนกรอกข้อมูลที่จำเป็นให้ครบในช่องที่มีกรอบสีแดง")
      focusFirstInvalid(hints, ev)
      return
    }

    const payload = {
      spec: {
        product_id: Number(form.product_id),
        species_id: Number(form.species_id),
        variant_id: Number(form.variant_id),
        product_year: Number(form.product_year),
        condition_id: Number(form.condition_id),
        field_type: Number(form.field_type),
        program: Number(form.program),
        business_type: Number(form.business_type),
      },
      co_klang: Number(form.co_klang),
      prices: pricesArr, // ต้องมี 2 ค่า (> 0)
      co_available: Number(form.co_available),
      comment: form.comment?.trim() || null,
    }

    setLoading(true)
    try {
      await post("/carryover/create", payload)

      // ✅ แจ้งเตือนแบบหน้า Sales (ปรับข้อความให้ตรงหน้าฟอร์ม)
      alert("✅✅✅✅✅✅✅✅✅ บันทึกยอดยกเข้าเรียบร้อย ✅✅✅✅✅✅✅✅✅")

      // รีเซ็ตค่าทุกอย่าง + ล้าง error/hint + เด้งไปบนสุด + โฟกัสช่องแรก
      setForm(initialForm)
      setErrors({})
      setMissingHints({})
      requestAnimationFrame(() => scrollToPageTop())
      try { submitBtnRef.current?.blur?.() } catch {}
      setTimeout(() => productRef.current?.focus(), 200)
    } catch (err) {
      console.error(err)
      const detail = err?.data?.detail ? `\n\nรายละเอียด:\n${JSON.stringify(err.data.detail, null, 2)}` : (err?.message ? `\n\nรายละเอียด:\n${err.message}` : "")
      // ❌ แจ้งเตือนสไตล์เดียวกับหน้า Sales เมื่อเกิดข้อผิดพลาดจาก BE
      alert(`❌❌❌❌❌❌❌❌❌ บันทึกไม่สำเร็จ ❌❌❌❌❌❌❌❌❌${detail}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        {/* จุดยึดสำหรับเลื่อนขึ้นบนสุด (เหมือนหน้า Sales) */}
        <div ref={pageTopRef} />

        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">📥 ยอดยกมา (Carry Over)</h1>

        {/* สเปคสินค้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-xl font-semibold">กำหนดสเปคสินค้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>ประเภทสินค้า<span className="text-red-500"> *</span></label>
              <ComboBox
                options={productOptions}
                value={form.product_id}
                onChange={(v) => { clearError("product_id"); clearHint("product_id"); update("product_id", v) }}
                error={!!errors.product_id}
                hintRed={!!missingHints.product_id}
                clearHint={() => clearHint("product_id")}
                placeholder="— เลือกประเภทสินค้า —"
                buttonRef={productRef}
                enterMovesFocus
                onEnterWhenClosed={() => focusNextAndOpenIfCombo(productRef)}
              />
              {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ชนิดข้าว (Species)<span className="text-red-500"> *</span></label>
              <ComboBox
                options={speciesOptions}
                value={form.species_id}
                onChange={(v) => { clearError("species_id"); clearHint("species_id"); update("species_id", v) }}
                error={!!errors.species_id}
                hintRed={!!missingHints.species_id}
                clearHint={() => clearHint("species_id")}
                placeholder="— เลือกชนิดข้าว —"
                buttonRef={speciesRef}
                enterMovesFocus
                onEnterWhenClosed={() => focusNextAndOpenIfCombo(speciesRef)}
              />
              {errors.species_id && <p className={errorTextCls}>{errors.species_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ชั้นย่อย/สายพันธุ์ (Variant)<span className="text-red-500"> *</span></label>
              <ComboBox
                options={variantOptions}
                value={form.variant_id}
                onChange={(v) => { clearError("variant_id"); clearHint("variant_id"); update("variant_id", v) }}
                error={!!errors.variant_id}
                hintRed={!!missingHints.variant_id}
                clearHint={() => clearHint("variant_id")}
                placeholder="— เลือกชั้นย่อย —"
                buttonRef={variantRef}
                enterMovesFocus
                onEnterWhenClosed={() => focusNextAndOpenIfCombo(variantRef)}
              />
              {errors.variant_id && <p className={errorTextCls}>{errors.variant_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ปีสินค้า/ฤดูกาล<span className="text-red-500"> *</span></label>
              <ComboBox
                options={yearOptions}
                value={form.product_year}
                onChange={(v) => { clearError("product_year"); clearHint("product_year"); update("product_year", v) }}
                error={!!errors.product_year}
                hintRed={!!missingHints.product_year}
                clearHint={() => clearHint("product_year")}
                placeholder="— เลือกปี/ฤดูกาล —"
                buttonRef={yearRef}
                enterMovesFocus
                onEnterWhenClosed={() => focusNextAndOpenIfCombo(yearRef)}
              />
              {errors.product_year && <p className={errorTextCls}>{errors.product_year}</p>}
            </div>

            <div>
              <label className={labelCls}>สภาพ/เงื่อนไข<span className="text-red-500"> *</span></label>
              <ComboBox
                options={conditionOptions}
                value={form.condition_id}
                onChange={(v) => { clearError("condition_id"); clearHint("condition_id"); update("condition_id", v) }}
                error={!!errors.condition_id}
                hintRed={!!missingHints.condition_id}
                clearHint={() => clearHint("condition_id")}
                placeholder="— เลือกสภาพ/เงื่อนไข —"
                buttonRef={conditionRef}
                enterMovesFocus
                onEnterWhenClosed={() => focusNextAndOpenIfCombo(conditionRef)}
              />
              {errors.condition_id && <p className={errorTextCls}>{errors.condition_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ประเภทนา<span className="text-red-500"> *</span></label>
              <ComboBox
                options={fieldTypeOptions}
                value={form.field_type}
                onChange={(v) => { clearError("field_type"); clearHint("field_type"); update("field_type", v) }}
                error={!!errors.field_type}
                hintRed={!!missingHints.field_type}
                clearHint={() => clearHint("field_type")}
                placeholder="— เลือกประเภทนา —"
                buttonRef={fieldTypeRef}
                enterMovesFocus
                onEnterWhenClosed={() => focusNextAndOpenIfCombo(fieldTypeRef)}
              />
              {errors.field_type && <p className={errorTextCls}>{errors.field_type}</p>}
            </div>

            <div>
              <label className={labelCls}>โปรแกรม<span className="text-red-500"> *</span></label>
              <ComboBox
                options={programOptions}
                value={form.program}
                onChange={(v) => { clearError("program"); clearHint("program"); update("program", v) }}
                error={!!errors.program}
                hintRed={!!missingHints.program}
                clearHint={() => clearHint("program")}
                placeholder="— เลือกโปรแกรม —"
                buttonRef={programRef}
                enterMovesFocus
                onEnterWhenClosed={() => focusNextAndOpenIfCombo(programRef)}
              />
              {errors.program && <p className={errorTextCls}>{errors.program}</p>}
            </div>

            <div>
              <label className={labelCls}>ประเภทธุรกิจ<span className="text-red-500"> *</span></label>
              <ComboBox
                options={businessOptions}
                value={form.business_type}
                onChange={(v) => { clearError("business_type"); clearHint("business_type"); update("business_type", v) }}
                error={!!errors.business_type}
                hintRed={!!missingHints.business_type}
                clearHint={() => clearHint("business_type")}
                placeholder="— เลือกประเภทธุรกิจ —"
                buttonRef={businessRef}
                enterMovesFocus
                onEnterWhenClosed={() => focusNextAndOpenIfCombo(businessRef)}
              />
              {errors.business_type && <p className={errorTextCls}>{errors.business_type}</p>}
            </div>
          </div>
        </div>

        {/* คลังปลายทาง & ปริมาณ */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-xl font-semibold">คลังปลายทางและปริมาณยกเข้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>เลือกคลังปลายทาง<span className="text-red-500"> *</span></label>
              <ComboBox
                options={klangOptions}
                value={form.co_klang}
                onChange={(v) => { clearError("co_klang"); clearHint("co_klang"); update("co_klang", v) }}
                error={!!errors.co_klang}
                hintRed={!!missingHints.co_klang}
                clearHint={() => clearHint("co_klang")}
                placeholder="— เลือกคลัง —"
                buttonRef={klangRef}
                enterMovesFocus
                onEnterWhenClosed={() => focusNextAndOpenIfCombo(klangRef)}
              />
              {errors.co_klang && <p className={errorTextCls}>{errors.co_klang}</p>}
            </div>

            <div>
              <label className={labelCls}>ปริมาณยกมา (กก.)<span className="text-red-500"> *</span></label>
              <input
                ref={coAvailableRef}
                inputMode="decimal"
                className={cx(baseField, (errors.co_available || missingHints.co_available) && "border-red-500 ring-2 ring-red-300")}
                value={form.co_available}
                onChange={(e) => update("co_available", onlyDigits(e.target.value))}
                onFocus={() => { setErrors((p)=>({ ...p, co_available: undefined })); clearHint("co_available") }}
                onKeyDown={(e) => onEnterKey(e, coAvailableRef)}
                placeholder="เช่น 12000"
                aria-invalid={errors.co_available ? true : undefined}
              />
              {errors.co_available && <p className={errorTextCls}>{errors.co_available}</p>}
              <p className={helpTextCls}>ต้องมากกว่า 0</p>
            </div>
          </div>
        </div>

        {/* ราคายกเข้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-xl font-semibold">ราคายกเข้า<span className="text-red-500"> *</span></h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className={labelCls}>ราคา 1 (บาท/กก.)</label>
              <input
                ref={price1Ref}
                inputMode="decimal"
                className={cx(baseField, errors.prices && "border-red-400 ring-2 ring-red-300/70")}
                value={form.price1}
                onChange={(e) => update("price1", e.target.value.replace(/[^\d.]/g, ""))}
                onFocus={() => setErrors((p)=>({ ...p, prices: undefined }))}
                onKeyDown={(e) => onEnterKey(e, price1Ref)}
                placeholder="เช่น 9.50"
              />
              <p className={helpTextCls}>ต้องกรอกทั้ง 2 ช่อง</p>
            </div>

            <div>
              <label className={labelCls}>ราคา 2 (บาท/กก.)</label>
              <input
                ref={price2Ref}
                inputMode="decimal"
                className={cx(baseField, errors.prices && "border-red-400 ring-2 ring-red-300/70")}
                value={form.price2}
                onChange={(e) => update("price2", e.target.value.replace(/[^\d.]/g, ""))}
                onFocus={() => setErrors((p)=>({ ...p, prices: undefined }))}
                onKeyDown={(e) => onEnterKey(e, price2Ref)}
                placeholder="เช่น 15"
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
                ref={commentRef}
                className={baseField}
                value={form.comment}
                onChange={(e) => update("comment", e.target.value)}
                onKeyDown={(e) => onEnterKey(e, commentRef)}
                placeholder="เช่น ความชื้นสูง แกลบเยอะ หรือเหตุผลการที่ปฏิเสธ"
              />
            </div>
          </div>
        </div>

        {/* ปุ่ม */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            ref={submitBtnRef}
            type="button"
            onClick={handleSubmit}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(e) } }}
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
            onClick={() => setForm(initialForm)}
            className="inline-flex items-center justify-center rounded-2xl 
              border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
              shadow-sm transition-all duration-300 ease-out
              hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
              active:scale-[.97]
              dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
              dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
          >
            ล้างฟอร์มทั้งหมด
          </button>
        </div>
      </div>
    </div>
  )
}

export default StockBringIn
