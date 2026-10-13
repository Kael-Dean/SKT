// src/pages/StockDamageOut.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
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
  resetBtnCls,
  spinnerCls,
} from "../../lib/styles"
import ComboBox from "../../components/ComboBox"
import { StickyActionBar, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import useBranchLock from "../../hooks/useBranchLock"
import BranchLockNote from "../../components/BranchLockNote"

/** ---------- Utils ---------- */
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? Number(n) : 0)
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
/** option value ของหน้านี้ = id ก่อน value (คง default ของ ComboBox copy เดิม) */
const getOptValue = (o) => o?.id ?? o?.value ?? ""

/** ชื่อฟิลด์สั้นสำหรับ toast "กรอกไม่ครบ" (mobile-copy §3.3) */
const FIELD_LABELS = {
  damage_date: "วันที่ตัดเสียหาย",
  branch_id: "สาขา",
  klang_id: "คลัง",
  product_id: "ประเภทสินค้า",
  species_id: "ชนิดข้าว",
  variant_id: "ชั้นย่อย",
  weight_out: "น้ำหนักที่ตัดออก",
  cost_per_kg: "ค่าเสียหาย/กก.",
}
const MISSING_ORDER = ["damage_date", "branch_id", "klang_id", "product_id", "species_id", "variant_id", "weight_out", "cost_per_kg"]
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
        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-11 md:size-9 items-center justify-center rounded-xl
        transition-transform hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer bg-transparent"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- Page: ตัดเสียหาย (นำออกจากคลัง) ---------- */
const StockDamageOut = () => {
  const isPhone = useIsPhone()
  const [submitting, setSubmitting] = useState(false)

  /** ---------- Dropdown options ---------- */
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const [productOptions, setProductOptions] = useState([])
  const [speciesOptions, setSpeciesOptions] = useState([])   // species = ชนิด
  const [variantOptions, setVariantOptions] = useState([])   // variant = ชั้นย่อย

  // เมตาดาต้า
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldOptions, setFieldOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])

  /** สาขา: scope "own_branch" → ล็อกที่สาขาที่ใช้งานอยู่ */
  const branchLock = useBranchLock()

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    damage_date: new Date().toISOString().slice(0, 10),

    branch_id: branchLock.activeId,
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

        setBranchOptions((branches || []).map((b) => ({ id: b.id, label: b.branch_name })))

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

  // ล็อกสาขา → บังคับเป็นสาขาที่ใช้งานอยู่ + ชื่อจากรายการสาขา
  useEffect(() => {
    if (!branchLock.locked) return
    const found = branchOptions.find((b) => String(b.id) === branchLock.activeKey)
    setForm((p) => {
      const name = found?.label ?? ""
      if (String(p.branch_id ?? "") === branchLock.activeKey && p.branch_name === name) return p
      const sameBranch = String(p.branch_id ?? "") === branchLock.activeKey
      return {
        ...p,
        branch_id: found?.id ?? branchLock.activeId,
        branch_name: name,
        ...(sameBranch ? null : { klang_id: null, klang_name: "" }),
      }
    })
  }, [branchLock.locked, branchLock.activeKey, branchLock.activeId, branchOptions])

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
        setSpeciesOptions(
          (arr || [])
            .map((x) => ({
              id: String(x.id ?? x.species_id ?? x.value ?? ""),
              label: String(x.species ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )
      } catch (e) {
        console.error("load species error:", e)
        setSpeciesOptions([])
      }
    }
    loadSpecies()
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
        setVariantOptions(
          (arr || [])
            .map((x) => ({
              id: String(x.id ?? x.variant_id ?? x.value ?? ""),
              label: String(x.variant ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )
      } catch (e) {
        console.error("load variant error:", e)
        setVariantOptions([])
      }
    }
    loadVariant()
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
    if (!form.species_id) e.species_id = "กรุณาเลือกชนิดข้าว"
    if (!form.variant_id) e.variant_id = "กรุณาเลือกชั้นย่อย"

    if (toNumber(form.weight_out) <= 0) e.weight_out = "น้ำหนักต้องมากกว่า 0"
    if (form.cost_per_kg === "" || toNumber(form.cost_per_kg) < 0) e.cost_per_kg = "ค่าเสียหาย/กก. ต้องไม่ติดลบ"

    setErrors(e)
    return { ok: Object.keys(e).length === 0, e }
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const hints = computeMissingHints()
    setMissingHints(hints)
    const { ok: okForm, e: ev } = validate()

    // แจ้งเตือนเมื่อฟอร์มไม่ครบ/ไม่ผ่าน (toast แทน alert)
    if (!okForm || Object.values(hints).some(Boolean)) {
      const missingKeys = MISSING_ORDER.filter((k) => hints[k] && (form[k] === "" || form[k] == null))
      if (missingKeys.length) toast.error("กรอกไม่ครบ", { description: missingDescription(missingKeys) })
      else toast.error("ข้อมูลไม่ถูกต้อง", { description: Object.values(ev)[0] || "ตรวจช่องที่มีกรอบสีแดง" })
      return
    }

    setSubmitting(true)
    try {
      const priceVal = toNumber(form.cost_per_kg)
      const amountVal = toNumber(form.weight_out)

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

      // รองรับหลายสคีมาของ BE: ส่งทั้งชุด co_*, cl_* และทั้ง price/prices, amount/cl_amount
      const payload = {
        date: form.damage_date,
        spec,

        // ที่ตั้ง
        cl_branch: Number(form.branch_id),
        cl_klang: Number(form.klang_id),
        co_branch: Number(form.branch_id),
        co_klang: Number(form.klang_id),

        // ราคา/จำนวน
        price: priceVal,
        prices: [priceVal],       // <-- BE ที่ฟ้องหา "prices"
        amount: amountVal,
        cl_amount: amountVal,

        comment: form.reason?.trim() || null,
      }

      await post("/carryover/create", payload)

      toast.success("บันทึกตัดเสียหายแล้ว", {
        description: `ตัด ${nf(amountVal)} กก. · ${thb(totalDamage)}`,
      })

      setForm((f) => ({
        ...f,
        // คงสาขา/คลังไว้
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
      const { title, description } = describeSaveError(err)
      toast.error(title, { description })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () =>
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

  /** ---------- Sticky bar summary (<md) ---------- */
  const barSummary = (
    <div className="min-w-0">
      <p className="truncate text-gray-900 dark:text-gray-100">
        {weightOut > 0 || form.klang_name
          ? [`ตัด ${nf(weightOut)} กก.`, form.klang_name].filter(Boolean).join(" · ")
          : "ยังไม่ได้กรอกน้ำหนัก"}
      </p>
      <p className="tabular-nums text-gray-500 dark:text-gray-400">มูลค่าเสียหาย {thb(totalDamage)}</p>
    </div>
  )

  const cardSectionCls = cx(cardCls, "p-4 md:p-5 mb-4 md:mb-6")

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <h1 className="mb-4 flex items-center gap-2.5 text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 md:size-7 text-red-600 dark:text-red-400">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          ตัดเสียหาย
        </h1>

        <form onSubmit={handleSubmit}>
          {/* กรอบที่ 1: ที่ตั้ง (สาขา/คลัง) & วันที่ */}
          <div className={cardSectionCls}>
            <h2 className={sectionTitleCls}>ข้อมูลตัดเสียหาย</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="damage_date" className={labelCls}>วันที่ตัดเสียหาย</label>
                <DateInput
                  id="damage_date"
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
                  title="สาขา"
                  ariaLabel="สาขา"
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
                  clearHint={() => clearHint("branch_id")}
                  disabled={branchLock.locked}
                />
                {errors.branch_id && <p className={errorTextCls}>{errors.branch_id}</p>}
                {branchLock.locked && <BranchLockNote />}
              </div>

              <div>
                <label className={labelCls}>คลัง</label>
                <ComboBox
                  title="คลัง"
                  ariaLabel="คลัง"
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
                  clearHint={() => clearHint("klang_id")}
                />
                {!form.branch_id && <p className={helpTextCls}>เลือกสาขาก่อน</p>}
                {errors.klang_id && <p className={errorTextCls}>{errors.klang_id}</p>}
              </div>
            </div>
          </div>

          {/* กรอบที่ 2: สินค้า / คุณสมบัติ */}
          <div className={cardSectionCls}>
            <h2 className={sectionTitleCls}>สินค้า / คุณสมบัติ (ข้าวเปลือก)</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>ประเภทสินค้า</label>
                <ComboBox
                  title="ประเภทสินค้า"
                  ariaLabel="ประเภทสินค้า"
                  options={productOptions}
                  value={form.product_id}
                  getValue={getOptValue}
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
                  clearHint={() => clearHint("product_id")}
                />
                {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
              </div>

              <div>
                <label className={labelCls}>ชนิดข้าว</label>
                <ComboBox
                  title="ชนิดข้าว"
                  ariaLabel="ชนิดข้าว"
                  searchable
                  options={speciesOptions}
                  value={form.species_id}
                  getValue={getOptValue}
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
                  clearHint={() => clearHint("species_id")}
                />
                {errors.species_id && <p className={errorTextCls}>{errors.species_id}</p>}
              </div>

              <div>
                <label className={labelCls}>ชั้นย่อย</label>
                <ComboBox
                  title="ชั้นย่อย"
                  ariaLabel="ชั้นย่อย"
                  searchable
                  options={variantOptions}
                  value={form.variant_id}
                  getValue={getOptValue}
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
                  clearHint={() => clearHint("variant_id")}
                />
                {errors.variant_id && <p className={errorTextCls}>{errors.variant_id}</p>}
              </div>

              {/* สภาพ/เงื่อนไข */}
              <div>
                <label className={labelCls}>สภาพ/เงื่อนไข</label>
                <ComboBox
                  title="สภาพ/เงื่อนไข"
                  ariaLabel="สภาพ/เงื่อนไข"
                  options={conditionOptions}
                  value={form.condition_id}
                  getValue={getOptValue}
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
                  title="ประเภทนา"
                  ariaLabel="ประเภทนา"
                  options={fieldOptions}
                  value={form.field_type_id}
                  getValue={getOptValue}
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
                  title="ปี/ฤดูกาล"
                  ariaLabel="ปี/ฤดูกาล"
                  options={yearOptions}
                  value={form.rice_year_id}
                  getValue={getOptValue}
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
                  title="โปรแกรม"
                  ariaLabel="โปรแกรม (ไม่บังคับ)"
                  options={programOptions}
                  value={form.program_id}
                  getValue={getOptValue}
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
                  title="ประเภทธุรกิจ"
                  ariaLabel="ประเภทธุรกิจ"
                  options={businessOptions}
                  value={form.business_type_id}
                  getValue={getOptValue}
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
          <div className={cardSectionCls}>
            <h2 className={sectionTitleCls}>น้ำหนักและค่าเสียหาย</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label htmlFor="weight_out" className={labelCls}>น้ำหนักที่ตัดออก (กก.)</label>
                <input
                  id="weight_out"
                  inputMode="decimal"
                  className={cx(baseField, "tabular-nums", redFieldCls("weight_out"))}
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
                <label htmlFor="cost_per_kg" className={labelCls}>ค่าเสียหาย / กก. (บาท)</label>
                <input
                  id="cost_per_kg"
                  inputMode="decimal"
                  className={cx(baseField, "tabular-nums", redFieldCls("cost_per_kg"))}
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
                <input disabled aria-label="มูลค่าเสียหายรวม (บาท)" className={cx(baseField, fieldDisabled, "tabular-nums font-semibold")} value={thb(totalDamage)} />
                <p className={helpTextCls}>คำนวณ = น้ำหนัก × ค่าเสียหาย/กก.</p>
              </div>

              <div className="md:col-span-4">
                <label htmlFor="damage_reason" className={labelCls}>เหตุผล / บันทึกเพิ่มเติม</label>
                <textarea
                  id="damage_reason"
                  className={baseField}
                  rows={3}
                  value={form.reason}
                  onChange={(e) => update("reason", e.target.value)}
                  placeholder="เช่น เสียหายจากความชื้นสูง / ศัตรูพืช / ขนส่ง"
                />
              </div>
            </div>
          </div>

          {/* ปุ่ม — <md: แถบติดล่าง (UI-SPEC §7) · ≥md: ปุ่มเดิม (type=submit ใน <form>) */}
          {isPhone ? (
            <StickyActionBar
              summary={barSummary}
              secondary={{ label: "ล้างฟอร์ม", onClick: handleReset, disabled: submitting }}
              primary={{ label: submitting ? "กำลังบันทึก…" : "บันทึก", onClick: handleSubmit, loading: submitting }}
            />
          ) : (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl
                  bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-sm cursor-pointer
                  transition-all duration-200
                  hover:bg-red-700 hover:shadow-[0_8px_20px_rgba(220,38,38,0.35)] hover:scale-[1.02]
                  active:scale-[.97]
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2
                  dark:focus-visible:ring-offset-slate-900"
                aria-busy={submitting ? "true" : "false"}
              >
                {submitting && <span className={spinnerCls} aria-hidden="true" />}
                {submitting ? "กำลังบันทึก..." : "บันทึก"}
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
        </form>
      </div>
    </div>
  )
}

export default StockDamageOut
