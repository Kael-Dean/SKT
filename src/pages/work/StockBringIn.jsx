// src/pages/StockBringIn.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { get, post } from "../../lib/api"
import {
  cx,
  baseField,
  fieldDisabled,
  labelCls,
  helpTextCls,
  errorTextCls,
  cardCls,
  sectionTitleCls,
  submitBtnCls,
  resetBtnCls,
  spinnerCls,
} from "../../lib/styles"
import ComboBox from "../../components/ComboBox"
import { StickyActionBar, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/[^\d]/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? Number(n) : 0)
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
/** option value ของหน้านี้ = id ก่อน value (คง default ของ ComboBox copy เดิม) */
const getOptValue = (o) => o?.id ?? o?.value ?? ""

/** ชื่อฟิลด์สั้นสำหรับ toast "กรอกไม่ครบ" (mobile-copy §3.3 / §9.3) */
const FIELD_LABELS = {
  product_id: "ประเภทสินค้า",
  species_id: "ชนิดข้าว",
  variant_id: "ชั้นย่อย",
  product_year: "ปี/ฤดูกาล",
  condition_id: "สภาพ",
  field_type: "ประเภทนา",
  program: "โปรแกรม",
  business_type: "ประเภทธุรกิจ",
  co_klang: "คลังปลายทาง",
  co_available: "ปริมาณยกมา",
  prices: "ราคา 1 และ 2",
}
const missingDescription = (keys) => {
  const names = keys.map((k) => FIELD_LABELS[k]).filter(Boolean)
  const rest = names.length - 3
  return `ยังไม่ได้กรอก: ${names.slice(0, 3).join(", ")}${rest > 0 ? ` และอีก ${rest} ช่อง` : ""}`
}

/** แปลง error จากหลังบ้านเป็นข้อความไทย (mobile-copy §4.3–4.4) */
const SAVE_ERR_TH = [
  [/failed to fetch|networkerror|timeout/i, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"],
  [/field required/i, "ข้อมูลบางช่องไม่ครบ"],
  [/value is not a valid|type_error/i, "รูปแบบข้อมูลบางช่องไม่ถูกต้อง"],
  [/greater than 0|ensure this value is greater/i, "น้ำหนักหรือราคาต้องมากกว่า 0"],
  [/not found[\s\S]*(klang|warehouse)|(klang|warehouse)[\s\S]*not found/i, "ไม่พบคลังที่เลือก"],
  [/duplicate|already exists/i, "รายการนี้มีอยู่แล้ว"],
  [/unauthorized|forbidden|credentials/i, "ไม่มีสิทธิ์หรือหมดเวลาใช้งาน"],
]
function describeSaveError(err) {
  const status = err?.status
  const raw = String(err?.message || "")
  const isThai = /[฀-๿]/.test(raw)
  const hit = SAVE_ERR_TH.find(([re]) => re.test(raw))?.[1]
  if (hit) return { title: status === 422 ? "ข้อมูลไม่ผ่านการตรวจ" : "บันทึกไม่สำเร็จ", description: hit }
  if (!status) return { title: "บันทึกไม่สำเร็จ", description: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสัญญาณแล้วลองใหม่ ข้อมูลที่กรอกยังอยู่" }
  if (status === 401 || status === 403) return { title: "ไม่มีสิทธิ์บันทึก", description: "สิทธิ์ของบัญชีนี้ไม่ครอบคลุมรายการนี้ หรือหมดเวลาใช้งาน เข้าสู่ระบบใหม่แล้วลองอีกครั้ง" }
  if (status === 409) return { title: "รายการนี้มีอยู่แล้ว", description: isThai ? raw : "รายการนี้ถูกบันทึกไปแล้ว ตรวจก่อนบันทึกซ้ำ" }
  if (status === 422) return { title: "ข้อมูลไม่ผ่านการตรวจ", description: isThai ? raw : "เซิร์ฟเวอร์ปฏิเสธข้อมูลบางช่อง ตรวจค่าที่กรอกแล้วลองใหม่" }
  if (status >= 500) return { title: "เซิร์ฟเวอร์ขัดข้อง", description: "ยังไม่ได้บันทึก ลองใหม่ในอีกสักครู่ ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ" }
  return { title: "บันทึกไม่สำเร็จ", description: isThai ? raw : "เกิดข้อผิดพลาดที่ไม่คาดคิด ลองใหม่อีกครั้ง" }
}

/** ---------- Main Page: Carry Over (ยอดยกมาเข้าคลัง) ---------- */
function StockBringIn() {
  const isPhone = useIsPhone()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})

  // ⭐ จุดยึดบนสุด + ฟังก์ชันเลื่อนขึ้นบน (ให้เหมือนหน้า Sales)
  const pageTopRef = useRef(null)
  const scrollToPageTop = () => {
    try { pageTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }) } catch { /* best-effort */ }
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
      } catch { /* try next candidate path */ }
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
        setKlangOptions((klangs || []).map((k) => ({ id: String(k.id ?? k.klang_id ?? ""), label: String(k.klang_name ?? k.name ?? "ไม่ทราบชื่อคลัง") })))
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
    } catch { /* scroll/focus best-effort */ }
  }

  const MISSING_ORDER = [
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

  const focusFirstInvalid = (hints, e) => {
    const firstKey = MISSING_ORDER.find((k) => hints[k] || e[k])
    if (!firstKey) return
    // ชี้แดงแบบ hint และโฟกัสช่องแรกที่ผิด
    setMissingHints((prev) => ({ ...prev, [firstKey]: true }))
    const ref = fieldRefByKey[firstKey]
    // รอให้ DOM อัปเดตแล้วค่อยเลื่อน
    setTimeout(() => scrollAndFocus(ref), 0)
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e?.preventDefault?.()

    // เลื่อนขึ้นบนสุดให้เหมือนหน้า Sales
    scrollToPageTop()

    const hints = computeMissingHints()
    setMissingHints(hints)

    const { ok, e: ev } = validate()

    // แจ้งเตือนเมื่อฟอร์มไม่ผ่าน (toast แทน alert)
    if (!ok || Object.values(hints).some(Boolean)) {
      const missingKeys = MISSING_ORDER.filter((k) => hints[k])
      if (missingKeys.length) toast.error("กรอกไม่ครบ", { description: missingDescription(missingKeys) })
      else toast.error("ข้อมูลไม่ถูกต้อง", { description: Object.values(ev)[0] })
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

      toast.success("บันทึกยอดยกมาแล้ว", {
        description: `${nf(toNumber(form.co_available))} กก. · ${thb(totalValuation)}`,
      })

      // รีเซ็ตค่าทุกอย่าง + ล้าง error/hint + เด้งไปบนสุด + โฟกัสช่องแรก
      setForm(initialForm)
      setErrors({})
      setMissingHints({})
      requestAnimationFrame(() => scrollToPageTop())
      try { submitBtnRef.current?.blur?.() } catch { /* blur best-effort */ }
      setTimeout(() => productRef.current?.focus(), 200)
    } catch (err) {
      console.error(err)
      const { title, description } = describeSaveError(err)
      toast.error(title, { description })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => setForm(initialForm)

  /** ---------- Sticky bar summary (<md) ---------- */
  const speciesLabel = speciesOptions.find((o) => String(o.id) === String(form.species_id))?.label
  const klangLabel = klangOptions.find((o) => String(o.id) === String(form.co_klang))?.label
  const barSummary = (
    <div className="min-w-0">
      <p className="truncate text-gray-900 dark:text-gray-100">
        {speciesLabel || klangLabel ? [speciesLabel, klangLabel].filter(Boolean).join(" · ") : "ยังไม่ได้เลือกสเปค"}
      </p>
      <p className="tabular-nums text-gray-500 dark:text-gray-400">
        {nf(toNumber(form.co_available))} กก. · {thb(totalValuation)}
      </p>
    </div>
  )

  const cardSectionCls = cx(cardCls, "p-4 md:p-5 mb-4 md:mb-6")

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        {/* จุดยึดสำหรับเลื่อนขึ้นบนสุด (เหมือนหน้า Sales) */}
        <div ref={pageTopRef} />

        <h1 className="mb-4 flex items-center gap-2.5 text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 md:size-7 text-indigo-600 dark:text-indigo-400">
            <path d="M12 13V2" />
            <path d="m8 9 4 4 4-4" />
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          </svg>
          ยอดยกมา
        </h1>

        {/* สเปคสินค้า */}
        <div className={cardSectionCls}>
          <h2 className={sectionTitleCls}>กำหนดสเปคสินค้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>ประเภทสินค้า<span className="text-red-500"> *</span></label>
              <ComboBox
                title="ประเภทสินค้า"
                ariaLabel="ประเภทสินค้า"
                options={productOptions}
                value={form.product_id}
                getValue={getOptValue}
                onChange={(v) => { clearError("product_id"); clearHint("product_id"); update("product_id", v) }}
                error={!!errors.product_id}
                hintRed={!!missingHints.product_id}
                clearHint={() => clearHint("product_id")}
                placeholder="— เลือกประเภทสินค้า —"
                buttonRef={productRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(productRef)}
              />
              {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ชนิดข้าว<span className="text-red-500"> *</span></label>
              <ComboBox
                title="ชนิดข้าว"
                ariaLabel="ชนิดข้าว"
                searchable
                options={speciesOptions}
                value={form.species_id}
                getValue={getOptValue}
                onChange={(v) => { clearError("species_id"); clearHint("species_id"); update("species_id", v) }}
                error={!!errors.species_id}
                hintRed={!!missingHints.species_id}
                clearHint={() => clearHint("species_id")}
                placeholder="— เลือกชนิดข้าว —"
                buttonRef={speciesRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(speciesRef)}
              />
              {errors.species_id && <p className={errorTextCls}>{errors.species_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ชั้นย่อย/สายพันธุ์<span className="text-red-500"> *</span></label>
              <ComboBox
                title="ชั้นย่อย/สายพันธุ์"
                ariaLabel="ชั้นย่อย/สายพันธุ์"
                searchable
                options={variantOptions}
                value={form.variant_id}
                getValue={getOptValue}
                onChange={(v) => { clearError("variant_id"); clearHint("variant_id"); update("variant_id", v) }}
                error={!!errors.variant_id}
                hintRed={!!missingHints.variant_id}
                clearHint={() => clearHint("variant_id")}
                placeholder="— เลือกชั้นย่อย —"
                buttonRef={variantRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(variantRef)}
              />
              {errors.variant_id && <p className={errorTextCls}>{errors.variant_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ปีสินค้า/ฤดูกาล<span className="text-red-500"> *</span></label>
              <ComboBox
                title="ปีสินค้า/ฤดูกาล"
                ariaLabel="ปีสินค้า/ฤดูกาล"
                options={yearOptions}
                value={form.product_year}
                getValue={getOptValue}
                onChange={(v) => { clearError("product_year"); clearHint("product_year"); update("product_year", v) }}
                error={!!errors.product_year}
                hintRed={!!missingHints.product_year}
                clearHint={() => clearHint("product_year")}
                placeholder="— เลือกปี/ฤดูกาล —"
                buttonRef={yearRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(yearRef)}
              />
              {errors.product_year && <p className={errorTextCls}>{errors.product_year}</p>}
            </div>

            <div>
              <label className={labelCls}>สภาพ/เงื่อนไข<span className="text-red-500"> *</span></label>
              <ComboBox
                title="สภาพ/เงื่อนไข"
                ariaLabel="สภาพ/เงื่อนไข"
                options={conditionOptions}
                value={form.condition_id}
                getValue={getOptValue}
                onChange={(v) => { clearError("condition_id"); clearHint("condition_id"); update("condition_id", v) }}
                error={!!errors.condition_id}
                hintRed={!!missingHints.condition_id}
                clearHint={() => clearHint("condition_id")}
                placeholder="— เลือกสภาพ/เงื่อนไข —"
                buttonRef={conditionRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(conditionRef)}
              />
              {errors.condition_id && <p className={errorTextCls}>{errors.condition_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ประเภทนา<span className="text-red-500"> *</span></label>
              <ComboBox
                title="ประเภทนา"
                ariaLabel="ประเภทนา"
                options={fieldTypeOptions}
                value={form.field_type}
                getValue={getOptValue}
                onChange={(v) => { clearError("field_type"); clearHint("field_type"); update("field_type", v) }}
                error={!!errors.field_type}
                hintRed={!!missingHints.field_type}
                clearHint={() => clearHint("field_type")}
                placeholder="— เลือกประเภทนา —"
                buttonRef={fieldTypeRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(fieldTypeRef)}
              />
              {errors.field_type && <p className={errorTextCls}>{errors.field_type}</p>}
            </div>

            <div>
              <label className={labelCls}>โปรแกรม<span className="text-red-500"> *</span></label>
              <ComboBox
                title="โปรแกรม"
                ariaLabel="โปรแกรม"
                options={programOptions}
                value={form.program}
                getValue={getOptValue}
                onChange={(v) => { clearError("program"); clearHint("program"); update("program", v) }}
                error={!!errors.program}
                hintRed={!!missingHints.program}
                clearHint={() => clearHint("program")}
                placeholder="— เลือกโปรแกรม —"
                buttonRef={programRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(programRef)}
              />
              {errors.program && <p className={errorTextCls}>{errors.program}</p>}
            </div>

            <div>
              <label className={labelCls}>ประเภทธุรกิจ<span className="text-red-500"> *</span></label>
              <ComboBox
                title="ประเภทธุรกิจ"
                ariaLabel="ประเภทธุรกิจ"
                options={businessOptions}
                value={form.business_type}
                getValue={getOptValue}
                onChange={(v) => { clearError("business_type"); clearHint("business_type"); update("business_type", v) }}
                error={!!errors.business_type}
                hintRed={!!missingHints.business_type}
                clearHint={() => clearHint("business_type")}
                placeholder="— เลือกประเภทธุรกิจ —"
                buttonRef={businessRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(businessRef)}
              />
              {errors.business_type && <p className={errorTextCls}>{errors.business_type}</p>}
            </div>
          </div>
        </div>

        {/* คลังปลายทาง & ปริมาณ */}
        <div className={cardSectionCls}>
          <h2 className={sectionTitleCls}>คลังปลายทางและปริมาณยกเข้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>เลือกคลังปลายทาง<span className="text-red-500"> *</span></label>
              <ComboBox
                title="คลังปลายทาง"
                ariaLabel="คลังปลายทาง"
                options={klangOptions}
                value={form.co_klang}
                getValue={getOptValue}
                onChange={(v) => { clearError("co_klang"); clearHint("co_klang"); update("co_klang", v) }}
                error={!!errors.co_klang}
                hintRed={!!missingHints.co_klang}
                clearHint={() => clearHint("co_klang")}
                placeholder="— เลือกคลัง —"
                buttonRef={klangRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(klangRef)}
              />
              {errors.co_klang && <p className={errorTextCls}>{errors.co_klang}</p>}
            </div>

            <div>
              <label htmlFor="co_available" className={labelCls}>ปริมาณยกมา (กก.)<span className="text-red-500"> *</span></label>
              <input
                id="co_available"
                ref={coAvailableRef}
                inputMode="decimal"
                className={cx(baseField, "tabular-nums", (errors.co_available || missingHints.co_available) && "border-red-500 ring-2 ring-red-300")}
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
        <div className={cardSectionCls}>
          <h2 className={sectionTitleCls}>ราคายกเข้า<span className="text-red-500"> *</span></h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label htmlFor="price1" className={labelCls}>ราคา 1 (บาท/กก.)</label>
              <input
                id="price1"
                ref={price1Ref}
                inputMode="decimal"
                className={cx(baseField, "tabular-nums", errors.prices && "border-red-400 ring-2 ring-red-300/70")}
                value={form.price1}
                onChange={(e) => update("price1", e.target.value.replace(/[^\d.]/g, ""))}
                onFocus={() => setErrors((p)=>({ ...p, prices: undefined }))}
                onKeyDown={(e) => onEnterKey(e, price1Ref)}
                placeholder="เช่น 9.50"
              />
              <p className={helpTextCls}>ต้องกรอกทั้ง 2 ช่อง</p>
            </div>

            <div>
              <label htmlFor="price2" className={labelCls}>ราคา 2 (บาท/กก.)</label>
              <input
                id="price2"
                ref={price2Ref}
                inputMode="decimal"
                className={cx(baseField, "tabular-nums", errors.prices && "border-red-400 ring-2 ring-red-300/70")}
                value={form.price2}
                onChange={(e) => update("price2", e.target.value.replace(/[^\d.]/g, ""))}
                onFocus={() => setErrors((p)=>({ ...p, prices: undefined }))}
                onKeyDown={(e) => onEnterKey(e, price2Ref)}
                placeholder="เช่น 15"
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>มูลค่าประเมินรวม</label>
              <input disabled aria-label="มูลค่าประเมินรวม" className={cx(baseField, fieldDisabled, "tabular-nums")} value={thb(totalValuation)} />
              <p className={helpTextCls}>คำนวณจาก ราคา 1 × ปริมาณ</p>
            </div>
          </div>
          {errors.prices && <p className={errorTextCls}>{errors.prices}</p>}
        </div>

        {/* บันทึกเพิ่มเติม / เหตุผล (ผู้รับ) */}
        <div className={cardSectionCls}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label htmlFor="co_comment" className={labelCls}>บันทึกเพิ่มเติม / เหตุผล (ผู้รับ)</label>
              <input
                id="co_comment"
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

        {/* ปุ่ม — <md: แถบติดล่าง (UI-SPEC §7) · ≥md: ปุ่มเดิม (คง submitBtnRef สำหรับ Enter-flow) */}
        {isPhone ? (
          <StickyActionBar
            summary={barSummary}
            secondary={{ label: "ล้างฟอร์ม", onClick: handleReset, disabled: loading }}
            primary={{ label: loading ? "กำลังบันทึก…" : "บันทึก", onClick: handleSubmit, loading }}
          />
        ) : (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              ref={submitBtnRef}
              type="button"
              onClick={handleSubmit}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(e) } }}
              disabled={loading}
              className={submitBtnCls}
              aria-busy={loading ? "true" : "false"}
            >
              {loading && <span className={spinnerCls} aria-hidden="true" />}
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className={resetBtnCls}
            >
              รีเซ็ต
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default StockBringIn
