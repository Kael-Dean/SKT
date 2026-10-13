// src/pages/StockTransferOut.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { ChevronDown } from "lucide-react"
import { get, post } from "../../lib/api"
import { describeApiError } from "../../lib/apiErrors"
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
import useBranchLock from "../../hooks/useBranchLock"
import BranchLockNote from "../../components/BranchLockNote"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toInt = (v) => {
  const n = Number(onlyDigits(String(v ?? "")))
  return Number.isFinite(n) ? n : 0
}
const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? Number(n) : 0)
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
const findLabelById = (opts = [], id) => {
  const s = String(id ?? "")
  if (!s) return ""
  const f = opts.find((o) => String(o.id ?? o.value) === s)
  return f ? String(f.label ?? "") : ""
}
/** option value ของหน้านี้ = id ก่อน value (คง default ของ ComboBox copy เดิม — WP2 ระบุให้ส่ง explicit) */
const getOptValue = (o) => o?.id ?? o?.value ?? ""

/** ชื่อฟิลด์สั้นสำหรับ toast "กรอกไม่ครบ" (mobile-copy §3.3) */
const FIELD_LABELS = {
  transfer_date: "วันที่โอน",
  from_branch_id: "สาขาต้นทาง",
  from_klang_id: "คลังต้นทาง",
  to_branch_id: "สาขาปลายทาง",
  to_klang_id: "คลังปลายทาง",
  driver_name: "ชื่อผู้ขนส่ง",
  plate_number: "ทะเบียนรถ",
  product_id: "ประเภทสินค้า",
  rice_id: "ชนิดข้าว",
  subrice_id: "ชั้นย่อย",
  field_type_id: "ประเภทนา",
  rice_year_id: "ปี/ฤดูกาล",
  program_id: "โปรแกรม",
  business_type_id: "ประเภทธุรกิจ",
  weight_in: "น้ำหนักขาเข้า",
  weight_out: "น้ำหนักขาออก",
  net_weight: "น้ำหนักสุทธิ",
  cost_per_kg: "ราคาต้นทุน",
  impurity_percent: "สิ่งเจือปน",
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
]
function describeSaveError(err) {
  const status = err?.status
  // 403 พร้อม detail = กฎธุรกิจ, 409 = เช่น สต็อกไม่พอ → แสดง detail จาก backend (handoff F6/F7)
  if (status === 403 || status === 409) return describeApiError(err)
  const raw = String(err?.message || "")
  const isThai = /[฀-๿]/.test(raw)
  // ข้อความไทยที่หน้าสร้างเอง (lookupOriginStock) ส่งต่อตรง ๆ
  if (!status && isThai) return { title: "บันทึกไม่สำเร็จ", description: raw }
  const hit = SAVE_ERR_TH.find(([re]) => re.test(raw))?.[1]
  if (hit) return { title: status === 422 ? "ข้อมูลไม่ผ่านการตรวจ" : "บันทึกไม่สำเร็จ", description: hit }
  if (!status) return { title: "บันทึกไม่สำเร็จ", description: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสัญญาณแล้วลองใหม่ ข้อมูลที่กรอกยังอยู่" }
  if (status === 401) return { title: "หมดเวลาใช้งาน", description: "เข้าสู่ระบบใหม่แล้วลองอีกครั้ง" }
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
        className={cx(
          baseField,
          "pr-12 cursor-pointer",
          error && "border-red-400 ring-2 ring-red-300/70",
          className
        )}
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

/** ---------- Page ---------- */
function StockTransferOut() {
  const isPhone = useIsPhone()
  const [submitting, setSubmitting] = useState(false)

  /** ---------- Template lock (เหมือนหน้า Buy) ---------- */
  const LOCK_SPEC = true
  const [templateOptions, setTemplateOptions] = useState([])
  const [formTemplate, setFormTemplate] = useState("")
  const [variantLookup, setVariantLookup] = useState({})
  const templateSubLabel = (opt) => {
    const vid = String(opt?.spec?.variant_id ?? "")
    const vLabel = vid ? (variantLookup[vid] || "") : ""
    return vLabel ? `ชั้นย่อย: ${vLabel}` : ""
  }

  /** ---------- Dropdown states ---------- */
  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])
  const [subriceOptions, setSubriceOptions] = useState([])

  const [fromBranchOptions, setFromBranchOptions] = useState([])
  const [toBranchOptions, setToBranchOptions] = useState([])
  const [fromKlangOptions, setFromKlangOptions] = useState([])
  const [toKlangOptions, setToKlangOptions] = useState([])

  // ✅ เมตาดาต้า (ไม่ล็อคค่าล่วงหน้าอีกต่อไป — ใช้จาก Template)
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldOptions, setFieldOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])

  /** สาขาต้นทาง: scope "own_branch" → ล็อกที่สาขาที่ใช้งานอยู่ (สาขาปลายทางเลือกได้ตามปกติ) */
  const branchLock = useBranchLock()

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    transfer_date: new Date().toISOString().slice(0, 10),

    from_branch_id: branchLock.activeId,
    from_branch_name: "",
    from_klang_id: null,
    from_klang_name: "",

    to_branch_id: null,
    to_branch_name: "",
    to_klang_id: null,
    to_klang_name: "",

    // ข้อมูลผู้ขนส่ง
    driver_name: "",
    plate_number: "",

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

    // ชั่งรถ
    weight_in: "",
    weight_out: "",
    cost_per_kg: "",
    quality_note: "",
    impurity_percent: "",
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  /** ---------- Derived ---------- */
  const weightIn = useMemo(() => toInt(form.weight_in), [form.weight_in])
  const weightOut = useMemo(() => toInt(form.weight_out), [form.weight_out])
  const netWeightInt = useMemo(() => Math.max(weightOut - weightIn, 0), [weightIn, weightOut])
  const costPerKg = useMemo(() => Number(form.cost_per_kg || 0), [form.cost_per_kg])
  const totalCost = useMemo(() => costPerKg * netWeightInt, [costPerKg, netWeightInt])

  /** ---------- Errors / hints ---------- */
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const hasRed = (key) => !!errors[key] || !!missingHints[key]
  const redFieldCls = (key) => (hasRed(key) ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : "")
  const redHintCls = (key) => (missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : "")
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
        const [products, branches, conditions, fields, years, programs, businesses] = await Promise.all([
          get("/order/product/search"),
          get("/order/branch/search"),
          get("/order/condition/search"),
          get("/order/field/search"),
          get("/order/year/search"),
          get("/order/program/search"),
          get("/order/business/search"),
        ])

        setProductOptions(
          (products || [])
            .map((x) => ({
              id: String(x.id ?? x.product_id ?? x.value ?? ""),
              label: String(x.product_type ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        const brs = (branches || []).map((b) => ({ id: b.id, label: b.branch_name }))
        setFromBranchOptions(brs)
        setToBranchOptions(brs)

        setConditionOptions((conditions || []).map((c, i) => ({ id: String(c.id ?? i), label: String(c.condition ?? c.name ?? "") })))
        setFieldOptions(
          (fields || [])
            .map((f, i) => ({ id: String(f.id ?? i), label: String(f.field ?? f.field_type ?? f.name ?? "") }))
            .filter((o) => o.id && o.label)
        )
        setYearOptions((years || []).map((y, i) => ({ id: String(y.id ?? i), label: String(y.year ?? y.name ?? "") })))
        setProgramOptions((programs || []).map((p, i) => ({ id: String(p.id ?? i), label: String(p.program ?? p.name ?? "") })))
        setBusinessOptions((businesses || []).map((b, i) => ({ id: String(b.id ?? i), label: String(b.business ?? b.name ?? "") })))
      } catch (e) {
        console.error("load static error:", e)
        setProductOptions([])
        setFromBranchOptions([])
        setToBranchOptions([])
        setConditionOptions([])
        setFieldOptions([])
        setYearOptions([])
        setProgramOptions([])
        setBusinessOptions([])
      }
    }
    loadStatic()
  }, [])

  /** ---------- โหลด Template (รูปแบบเดียวกับหน้า Buy) ---------- */
  useEffect(() => {
    const loadForms = async () => {
      try {
        const arr = (await get("/order/form/search")) || []
        const mapped = arr
          .map((x) => ({
            id: String(x.id ?? x.value ?? ""),
            label: String(x.prod_name ?? x.name ?? x.label ?? "").trim(),
            spec: {
              product_id: x.product_id ?? null,
              species_id: x.species_id ?? null,
              variant_id: x.variant_id ?? null,
              product_year: x.product_year ?? null,
              condition_id: x.condition_id ?? null,
              field_type: x.field_type ?? null,
              program: x.program ?? null,
              business_type: x.business_type ?? null,
            },
          }))
          .filter((o) => o.id && o.label)

        setTemplateOptions(mapped)

        // ค่าเริ่มต้น: shared.formTemplate → transfer.formTemplate → อันแรก
        let nextId = ""
        try {
          const shared = localStorage.getItem("shared.formTemplate")
          if (shared) {
            const o = JSON.parse(shared)
            if (o?.id && mapped.some((m) => String(m.id) === String(o.id))) nextId = String(o.id)
          }
          if (!nextId) {
            const saved = localStorage.getItem("transfer.formTemplate")
            if (saved && mapped.some((m) => String(m.id) === String(saved))) nextId = String(saved)
          }
        } catch { /* ignore unreadable localStorage */ }
        if (!nextId) nextId = String(mapped[0]?.id || "")

        if (nextId) {
          setFormTemplate(nextId)
          const found = mapped.find((o) => String(o.id) === nextId)
          if (found?.spec) applyTemplateBySpec(found.spec)
          try {
            localStorage.setItem("shared.formTemplate", JSON.stringify({ id: nextId, label: found?.label || "" }))
            localStorage.setItem("transfer.formTemplate", nextId)
          } catch { /* ignore localStorage write failure */ }
        }

        // เตรียม lookup variant id → label เพื่อแสดง subLabel ใน template
        const speciesIds = Array.from(
          new Set((mapped || []).map((t) => t?.spec?.species_id).filter(Boolean).map(String))
        )
        if (speciesIds.length) {
          const list = await Promise.all(
            speciesIds.map(async (sid) => {
              const arr2 = (await get(`/order/variant/search?species_id=${encodeURIComponent(sid)}`)) || []
              return arr2.map((x) => ({
                id: String(x.id ?? x.variant_id ?? x.value ?? ""),
                label: String(x.variant ?? x.name ?? x.label ?? "").trim(),
              }))
            })
          )
          const map = {}
          list.flat().forEach(({ id, label }) => {
            if (id && label) map[id] = label
          })
          setVariantLookup(map)
        }
      } catch (e) {
        console.error("load form templates error:", e)
        setTemplateOptions([])
      }
    }
    loadForms()
  }, [])

  /** ---------- apply template spec ---------- */
  const applyTemplateBySpec = (spec) => {
    if (!spec) return
    const S = (v) => (v == null ? "" : String(v))
    setForm((p) => ({
      ...p,
      product_id: S(spec.product_id),
      rice_id: S(spec.species_id),
      subrice_id: S(spec.variant_id),
      rice_year_id: S(spec.product_year),
      condition_id: S(spec.condition_id),
      field_type_id: S(spec.field_type),
      program_id: S(spec.program),
      business_type_id: S(spec.business_type),
      // เคลียร์ label รอ sync กับ options
      product_name: "",
      rice_type: "",
      subrice_name: "",
      rice_year_label: "",
      condition_label: "",
      field_type_label: "",
      program_label: "",
      business_type_label: "",
    }))
  }
  useEffect(() => {
    if (!formTemplate) return
    const current = templateOptions.find((o) => String(o.id) === String(formTemplate))
    if (current?.spec) applyTemplateBySpec(current.spec)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formTemplate])

  /** ---------- Sync id -> label เมื่อ options โหลดเสร็จ (เหมือนหน้า Buy) ---------- */
  useEffect(() => {
    const lbl = findLabelById(productOptions, form.product_id)
    if (form.product_id && lbl && lbl !== form.product_name) update("product_name", lbl)
  }, [form.product_id, productOptions]) // product_name
  useEffect(() => {
    const lbl = findLabelById(riceOptions, form.rice_id)
    if (form.rice_id && lbl && lbl !== form.rice_type) update("rice_type", lbl)
  }, [form.rice_id, riceOptions]) // rice_type
  useEffect(() => {
    const lbl = findLabelById(subriceOptions, form.subrice_id)
    if (form.subrice_id && lbl && lbl !== form.subrice_name) update("subrice_name", lbl)
  }, [form.subrice_id, subriceOptions]) // subrice_name
  useEffect(() => {
    const lbl = findLabelById(conditionOptions, form.condition_id)
    if (form.condition_id && lbl && lbl !== form.condition_label) update("condition_label", lbl)
  }, [form.condition_id, conditionOptions]) // condition_label
  useEffect(() => {
    const lbl = findLabelById(fieldOptions, form.field_type_id)
    if (form.field_type_id && lbl && lbl !== form.field_type_label) update("field_type_label", lbl)
  }, [form.field_type_id, fieldOptions]) // field_type_label
  useEffect(() => {
    const lbl = findLabelById(yearOptions, form.rice_year_id)
    if (form.rice_year_id && lbl && lbl !== form.rice_year_label) update("rice_year_label", lbl)
  }, [form.rice_year_id, yearOptions]) // rice_year_label
  useEffect(() => {
    const lbl = findLabelById(programOptions, form.program_id)
    if (form.program_id && lbl && lbl !== form.program_label) update("program_label", lbl)
  }, [form.program_id, programOptions]) // program_label
  useEffect(() => {
    const lbl = findLabelById(businessOptions, form.business_type_id)
    if (form.business_type_id && lbl && lbl !== form.business_type_label) update("business_type_label", lbl)
  }, [form.business_type_id, businessOptions]) // business_type_label

  /** ---------- product -> species (ปรับ logic ให้ไม่ล้างค่าเมื่อมี pid) ---------- */
  useEffect(() => {
    const pid = form.product_id
    if (!pid) {
      setRiceOptions([])
      setSubriceOptions([])
      update("rice_id", "")
      update("rice_type", "")
      update("subrice_id", "")
      update("subrice_name", "")
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
        setRiceOptions(mapped)
      } catch (e) {
        console.error("load species error:", e)
        setRiceOptions([])
      }
    }
    loadSpecies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_id])

  /** ---------- species -> variant (ไม่ล้าง subrice เมื่อมี sid) ---------- */
  useEffect(() => {
    const sid = form.rice_id
    if (!sid) {
      setSubriceOptions([])
      update("subrice_id", "")
      update("subrice_name", "")
      return
    }
    const loadVariant = async () => {
      try {
        const arr = await get(`/order/variant/search?species_id=${encodeURIComponent(sid)}`)
        const mapped = (arr || [])
          .map((x) => ({
            id: String(x.id ?? x.variant_id ?? x.value ?? ""),
            label: String(x.variant ?? x.sub_class ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setSubriceOptions(mapped)
      } catch (e) {
        console.error("load variant error:", e)
        setSubriceOptions([])
      }
    }
    loadVariant()
  }, [form.rice_id])

  /** ล็อกสาขาต้นทาง → บังคับเป็นสาขาที่ใช้งานอยู่ + ชื่อจากรายการสาขา */
  useEffect(() => {
    if (!branchLock.locked) return
    const found = fromBranchOptions.find((b) => String(b.id) === branchLock.activeKey)
    setForm((p) => {
      const name = found?.label ?? ""
      if (String(p.from_branch_id ?? "") === branchLock.activeKey && p.from_branch_name === name) return p
      const sameBranch = String(p.from_branch_id ?? "") === branchLock.activeKey
      return {
        ...p,
        from_branch_id: found?.id ?? branchLock.activeId,
        from_branch_name: name,
        ...(sameBranch ? null : { from_klang_id: null, from_klang_name: "" }),
      }
    })
  }, [branchLock.locked, branchLock.activeKey, branchLock.activeId, fromBranchOptions])

  /** ---------- โหลดคลัง (ต้นทาง/ปลายทาง) ---------- */
  useEffect(() => {
    const bid = form.from_branch_id
    const bname = form.from_branch_name?.trim()
    if (bid == null && !bname) {
      setFromKlangOptions([])
      update("from_klang_id", null)
      update("from_klang_name", "")
      return
    }
    const loadKlang = async () => {
      try {
        const qs = bid != null ? `branch_id=${bid}` : `branch_name=${encodeURIComponent(bname)}`
        const arr = await get(`/order/klang/search?${qs}`)
        setFromKlangOptions((arr || []).map((k) => ({ id: k.id, label: k.klang_name })))
      } catch (e) {
        console.error("Load from klang error:", e)
        setFromKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.from_branch_id, form.from_branch_name])

  useEffect(() => {
    const bid = form.to_branch_id
    const bname = form.to_branch_name?.trim()
    if (bid == null && !bname) {
      setToKlangOptions([])
      update("to_klang_id", null)
      update("to_klang_name", "")
      return
    }
    const loadKlang = async () => {
      try {
        const qs = bid != null ? `branch_id=${bid}` : `branch_name=${encodeURIComponent(bname)}`
        const arr = await get(`/order/klang/search?${qs}`)
        setToKlangOptions((arr || []).map((k) => ({ id: k.id, label: k.klang_name })))
      } catch (e) {
        console.error("Load to klang error:", e)
        setToKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.to_branch_id, form.to_branch_name])

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.transfer_date) m.transfer_date = true

    if (!form.from_branch_id) m.from_branch_id = true
    if (!form.from_klang_id) m.from_klang_id = true
    if (!form.to_branch_id) m.to_branch_id = true
    if (!form.to_klang_id) m.to_klang_id = true
    if (form.from_branch_id && form.to_branch_id && String(form.from_branch_id) === String(form.to_branch_id)) {
      m.to_branch_id = true
    }

    if (!form.driver_name?.trim()) m.driver_name = true
    if (!form.plate_number?.trim()) m.plate_number = true

    if (!form.product_id) m.product_id = true
    if (!form.rice_id) m.rice_id = true
    if (!form.subrice_id) m.subrice_id = true

    if (!form.field_type_id) m.field_type_id = true
    if (!form.business_type_id) m.business_type_id = true

    if (form.weight_in === "" || toInt(form.weight_in) <= 0) m.weight_in = true
    if (form.weight_out === "" || toInt(form.weight_out) <= 0) m.weight_out = true
    if (toInt(form.weight_out) <= toInt(form.weight_in)) m.weight_out = true
    if (netWeightInt <= 0) m.net_weight = true

    if (form.cost_per_kg === "" || Number(form.cost_per_kg) < 0) m.cost_per_kg = true

    if (form.impurity_percent === "") {
      m.impurity_percent = true
    } else {
      const ip = Number(form.impurity_percent)
      if (!isFinite(ip) || ip < 0 || ip > 100) m.impurity_percent = true
    }

    return m
  }

  const validate = () => {
    const e = {}
    if (!form.transfer_date) e.transfer_date = "กรุณาเลือกวันที่โอน"

    if (!form.from_branch_id) e.from_branch_id = "กรุณาเลือกสาขาต้นทาง"
    if (!form.from_klang_id) e.from_klang_id = "กรุณาเลือกคลังต้นทาง"
    if (!form.to_branch_id) e.to_branch_id = "กรุณาเลือกสาขาปลายทาง"
    if (!form.to_klang_id) e.to_klang_id = "กรุณาเลือกคลังปลายทาง"
    if (form.from_branch_id && form.to_branch_id && String(form.from_branch_id) === String(form.to_branch_id)) {
      e.to_branch_id = "สาขาต้นทาง/ปลายทาง ต้องไม่ซ้ำกัน"
    }

    if (!form.driver_name?.trim()) e.driver_name = "กรุณากรอกชื่อผู้ขนส่ง"
    if (!form.plate_number?.trim()) e.plate_number = "กรุณากรอกทะเบียนรถ"

    if (!form.product_id) e.product_id = "กรุณาเลือกฟอร์มสำเร็จรูปให้มีประเภทสินค้า"
    if (!form.rice_id) e.rice_id = "กรุณาเลือกฟอร์มสำเร็จรูปให้มีชนิดข้าว"
    if (!form.subrice_id) e.subrice_id = "กรุณาเลือกฟอร์มสำเร็จรูปให้มีชั้นย่อย"

    if (!form.field_type_id) e.field_type_id = "กรุณาเลือกฟอร์มสำเร็จรูปให้มีประเภทนา"
    if (!form.business_type_id) e.business_type_id = "กรุณาเลือกฟอร์มสำเร็จรูปให้มีประเภทธุรกิจ"

    const tIn = toInt(form.weight_in)
    const tOut = toInt(form.weight_out)
    if (tIn <= 0) e.weight_in = "น้ำหนักขาเข้า (รถเปล่า) ต้องมากกว่า 0"
    if (tOut <= 0) e.weight_out = "น้ำหนักขาออก (รถ+ข้าว) ต้องมากกว่า 0"
    if (tOut <= tIn) e.weight_out = "น้ำหนักขาออก ต้องมากกว่า น้ำหนักขาเข้า"
    if (netWeightInt <= 0) e.net_weight = "น้ำหนักสุทธิต้องมากกว่า 0 (ขาออก − ขาเข้า)"

    if (form.cost_per_kg === "") e.cost_per_kg = "กรุณากรอกราคาต้นทุน"
    else if (Number(form.cost_per_kg) < 0) e.cost_per_kg = "ราคาต้นทุนต้องไม่ติดลบ"

    if (form.impurity_percent === "") {
      e.impurity_percent = "กรุณากรอกสิ่งเจือปน 0–100"
    } else {
      const ip = Number(form.impurity_percent)
      if (!isFinite(ip) || ip < 0 || ip > 100) e.impurity_percent = "กรุณากรอก 0–100"
    }

    setErrors(e)
    return e
  }

  /** ---------- Builders ---------- */
  const buildSpec = () => {
    const product_id = /^\d+$/.test(form.product_id) ? Number(form.product_id) : form.product_id
    const species_id = /^\d+$/.test(form.rice_id) ? Number(form.rice_id) : form.rice_id
    const variant_id = /^\d+$/.test(form.subrice_id) ? Number(form.subrice_id) : form.subrice_id

    return {
      product_id,
      species_id,
      variant_id,
      product_year: form.rice_year_id ? Number(form.rice_year_id) : null,
      condition_id: form.condition_id ? Number(form.condition_id) : null,
      field_type: form.field_type_id ? Number(form.field_type_id) : null,
      program: form.program_id ? Number(form.program_id) : null,
      business_type: form.business_type_id ? Number(form.business_type_id) : null,
    }
  }

  const lookupOriginStock = async (transferQty) => {
    const body = { klang_id: Number(form.from_klang_id), spec: buildSpec() }
    const rows = await post("/transfer/stock/lookup", body)
    if (!rows || rows.length === 0) throw new Error("ไม่พบสต็อกต้นทางของสเปคนี้ในคลังที่เลือก")
    const available = Number(rows[0].available ?? 0)
    if (available < transferQty) {
      throw new Error(`สต็อกคงเหลือต้นทางไม่พอ (คงเหลือ ${available.toLocaleString()} กก.)`)
    }
    return true
  }

  /** ---------- Keyboard & focus flow ---------- */
  const driverRef = useRef(null)
  const plateRef = useRef(null)
  const fromBranchRef = useRef(null)
  const fromKlangRef = useRef(null)
  const toBranchRef = useRef(null)
  const toKlangRef = useRef(null)
  const productRef = useRef(null)
  const riceRef = useRef(null)
  const subriceRef = useRef(null)
  const conditionRef = useRef(null)
  const fieldRef = useRef(null)
  const yearRef = useRef(null)
  const programRef = useRef(null)
  const businessRef = useRef(null)
  const weightInRef = useRef(null)
  const weightOutRef = useRef(null)
  const costRef = useRef(null)
  const impurityRef = useRef(null)
  const saveBtnRef = useRef(null)
  const dateRef = useRef(null)
  /** ⭐ เพิ่ม: ref ของคอมโบ “ฟอร์มสำเร็จรูป” เพื่อใช้ onMoveNext */
  const templateRef = useRef(null)

  const scrollActiveIntoView = () => {
    try {
      const el = document.activeElement
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
      }
    } catch { /* scroll best-effort */ }
  }

  const focusComboRef = (nextRef) => {
    const target = nextRef?.current
    if (!target) return
    target.focus?.()
    requestAnimationFrame(() => {
      target.open?.()
      scrollActiveIntoView()
    })
  }

  const getFlow = () => {
    return [
      { ref: driverRef, type: "input", disabled: false },
      { ref: plateRef, type: "input", disabled: false },
      { ref: productRef, type: "combo", disabled: LOCK_SPEC },
      { ref: riceRef, type: "combo", disabled: LOCK_SPEC || !form.product_id },
      { ref: subriceRef, type: "combo", disabled: LOCK_SPEC || !form.rice_id },
      { ref: fieldRef, type: "combo", disabled: LOCK_SPEC },
      { ref: yearRef, type: "combo", disabled: LOCK_SPEC },
      { ref: programRef, type: "combo", disabled: LOCK_SPEC },
      { ref: weightInRef, type: "input", disabled: false },
      { ref: weightOutRef, type: "input", disabled: false },
      { ref: costRef, type: "input", disabled: false },
      { ref: impurityRef, type: "input", disabled: false },
      { ref: saveBtnRef, type: "button", disabled: false },
    ].filter((i) => !i.disabled)
  }

  const focusNextFromRef = (currentRef) => {
    const arr = getFlow()
    const idx = arr.findIndex((i) => i.ref === currentRef)
    const next = idx >= 0 ? arr[idx + 1] : null
    if (!next) return
    const target = next.ref.current
    if (!target) return

    if (next.type === "combo") {
      target.focus?.()
      requestAnimationFrame(() => {
        target.open?.()
        scrollActiveIntoView()
      })
    } else {
      target.focus?.()
      requestAnimationFrame(scrollActiveIntoView)
    }
  }

  const enterToNext = (refObj) => (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      focusNextFromRef(refObj)
    }
  }

  /** ---------- Scroll helpers ---------- */
  const scrollToPageTop = () => {
    try {
      const root = document.scrollingElement || document.documentElement || document.body
      root.scrollTo({ top: 0, behavior: "smooth" })
    } catch { /* smooth scroll best-effort */ }
  }

  const errorOrder = [
    "transfer_date",
    "from_branch_id", "from_klang_id",
    "to_branch_id", "to_klang_id",
    "driver_name", "plate_number",
    "product_id", "rice_id", "subrice_id",
    "field_type_id", "rice_year_id", "program_id", "business_type_id",
    "weight_in", "weight_out", "net_weight",
    "cost_per_kg", "impurity_percent",
  ]

  const refMap = {
    transfer_date: dateRef,
    from_branch_id: fromBranchRef,
    from_klang_id: fromKlangRef,
    to_branch_id: toBranchRef,
    to_klang_id: toKlangRef,
    driver_name: driverRef,
    plate_number: plateRef,
    product_id: productRef,
    rice_id: riceRef,
    subrice_id: subriceRef,
    field_type_id: fieldRef,
    rice_year_id: yearRef,
    program_id: programRef,
    business_type_id: businessRef,
    weight_in: weightInRef,
    weight_out: weightOutRef,
    cost_per_kg: costRef,
    impurity_percent: impurityRef,
  }
  const comboKeys = new Set([
    "from_branch_id","from_klang_id","to_branch_id","to_klang_id",
    "product_id","rice_id","subrice_id","field_type_id","rice_year_id","program_id","business_type_id",
  ])

  const focusByKey = (key) => {
    const k = key === "net_weight" ? "weight_out" : key
    const r = refMap[k]
    if (!r?.current) return
    if (comboKeys.has(k)) {
      focusComboRef(r)
    } else {
      r.current.focus?.()
      scrollActiveIntoView()
    }
  }

  const scrollToFirstError = (eObj) => {
    const firstKey = errorOrder.find((k) => k in eObj)
    if (firstKey) focusByKey(firstKey)
  }
  const scrollToFirstMissing = (hintsObj) => {
    const firstKey = errorOrder.find((k) => hintsObj[k])
    if (firstKey) focusByKey(firstKey)
  }

  const notifyInvalid = (hints, eObj) => {
    const missingKeys = errorOrder.filter((k) => hints[k] && k !== "net_weight" && (form[k] === "" || form[k] == null))
    if (missingKeys.length) toast.error("กรอกไม่ครบ", { description: missingDescription(missingKeys) })
    else toast.error("ข้อมูลไม่ถูกต้อง", { description: Object.values(eObj)[0] || "ตรวจช่องที่มีกรอบสีแดง" })
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    scrollToPageTop()

    const hints = computeMissingHints()
    setMissingHints(hints)
    const eObj = validate()

    if (Object.keys(eObj).length > 0) {
      notifyInvalid(hints, eObj)
      scrollToFirstError(eObj)
      return
    }
    if (Object.values(hints).some(Boolean)) {
      notifyInvalid(hints, {})
      scrollToFirstMissing(hints)
      return
    }

    const transferQty = netWeightInt
    if (!(transferQty > 0)) {
      const e2 = { net_weight: "น้ำหนักสุทธิไม่ถูกต้อง" }
      setErrors((prev) => ({ ...prev, ...e2 }))
      toast.error("ข้อมูลไม่ถูกต้อง", { description: "ตรวจน้ำหนักสุทธิให้ถูกต้อง" })
      scrollToFirstError(e2)
      return
    }

    setSubmitting(true)
    try {
      await lookupOriginStock(transferQty)

      const payload = {
        date: form.transfer_date,

        from_branch: form.from_branch_id != null ? Number(form.from_branch_id) : null,
        from_klang: form.from_klang_id != null ? Number(form.from_klang_id) : 0,

        to_branch: form.to_branch_id != null ? Number(form.to_branch_id) : null,
        to_klang: form.to_klang_id != null ? Number(form.to_klang_id) : null,

        driver_name: form.driver_name.trim(),
        plate_number: form.plate_number.trim(),

        spec: buildSpec(),

        entry_weight: toInt(form.weight_in),
        exit_weight: toInt(form.weight_out),

        weight: transferQty,
        impurity: Number(form.impurity_percent),

        price_per_kilo: Number(form.cost_per_kg),
        price: Number(form.cost_per_kg) * transferQty,

        quality: 0,
        transfer_qty: transferQty,
        sender_note: form.quality_note?.trim() || null,
      }

      await post("/transfer/request", payload)

      toast.success("บันทึกโอนออกแล้ว", {
        description: `${form.from_klang_name || "คลังต้นทาง"} → ${form.to_klang_name || "คลังปลายทาง"} · ${nf(transferQty)} กก.`,
      })
      setForm((f) => ({
        ...f,
        weight_in: "",
        weight_out: "",
        cost_per_kg: "",
        impurity_percent: "",
      }))
      requestAnimationFrame(() => scrollToPageTop())
      try { saveBtnRef.current?.blur?.() } catch { /* blur best-effort */ }
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
      weight_in: "",
      weight_out: "",
      cost_per_kg: "",
      impurity_percent: "",
    }))

  /** ---------- สรุป (ใช้ทั้ง tile ≥md และ dl <md) ---------- */
  const summaryRows = [
    { label: "วันที่โอน", value: form.transfer_date || "—", numeric: true },
    { label: "จาก (สาขา/คลัง)", value: `${form.from_branch_name || "—"}${form.from_klang_name ? `\n${form.from_klang_name}` : ""}` },
    { label: "ไป (สาขา/คลัง)", value: `${form.to_branch_name || "—"}${form.to_klang_name ? `\n${form.to_klang_name}` : ""}` },
    { label: "สินค้า", value: form.product_name || "—" },
    { label: "ชนิดข้าว", value: form.rice_type || "—" },
    { label: "ชั้นย่อย", value: form.subrice_name || "—" },
    { label: "สภาพ", value: form.condition_label || "—" },
    { label: "ประเภทนา", value: form.field_type_label || "—" },
    { label: "ปี/ฤดูกาล", value: form.rice_year_label || "—" },
    { label: "โปรแกรม", value: form.program_label || "—" },
    { label: "ประเภทธุรกิจ", value: form.business_type_label || "—" },
    { label: "น้ำหนักขาเข้า", value: `${toInt(form.weight_in).toLocaleString()} กก.`, numeric: true },
    { label: "น้ำหนักขาออก", value: `${toInt(form.weight_out).toLocaleString()} กก.`, numeric: true },
    { label: "น้ำหนักสุทธิ", value: `${netWeightInt.toLocaleString()} กก.`, numeric: true },
    { label: "ราคาต้นทุน/กก.", value: form.cost_per_kg ? `${Number(form.cost_per_kg).toFixed(2)} บาท/กก.` : "—", numeric: true },
    { label: "ราคารวม", value: thb(totalCost), numeric: true },
    { label: "สิ่งเจือปน", value: form.impurity_percent !== "" ? `${Number(form.impurity_percent)} %` : "—", numeric: true },
    { label: "ผู้ขนส่ง", value: form.driver_name || "—" },
    { label: "ทะเบียนรถ", value: form.plate_number || "—", numeric: true },
    { label: "บันทึกเพิ่มเติม", value: form.quality_note || "—" },
  ]

  /** สเปคที่ล็อกจากฟอร์มสำเร็จรูป — read-only card บน <md (UI-SPEC §7) */
  const lockedSpecRows = [
    { key: "product_id", label: "ประเภทสินค้า", value: form.product_name },
    { key: "rice_id", label: "ชนิดข้าว", value: form.rice_type },
    { key: "subrice_id", label: "ชั้นย่อย", value: form.subrice_name },
    { key: "condition_id", label: "สภาพ/เงื่อนไข", value: form.condition_label },
    { key: "field_type_id", label: "ประเภทนา", value: form.field_type_label },
    { key: "rice_year_id", label: "ปี/ฤดูกาล", value: form.rice_year_label },
    { key: "program_id", label: "โปรแกรม", value: form.program_label },
    { key: "business_type_id", label: "ประเภทธุรกิจ", value: form.business_type_label },
  ]

  /** ---------- Sticky bar summary (<md) ---------- */
  const barSummary = (
    <div className="min-w-0">
      <p className="truncate text-gray-900 dark:text-gray-100">
        {form.from_klang_name || form.to_klang_name
          ? `${form.from_klang_name || "คลังต้นทาง"} → ${form.to_klang_name || "คลังปลายทาง"}`
          : "ยังไม่ได้เลือกคลัง"}
      </p>
      <p className="tabular-nums text-gray-500 dark:text-gray-400">
        สุทธิ {nf(netWeightInt)} กก. · {thb(totalCost)}
      </p>
    </div>
  )

  const cardSectionCls = cx(cardCls, "p-4 md:p-5 mb-4 md:mb-6")

  const specGrid = (
    <div className="grid gap-4 md:grid-cols-3">
      <div>
        <label className={labelCls}>ประเภทสินค้า</label>
        <ComboBox
          ref={productRef}
          title="ประเภทสินค้า"
          ariaLabel="ประเภทสินค้า"
          options={productOptions}
          value={form.product_id}
          getValue={getOptValue}
          enterMovesWhenFilled
          onMoveNext={() => {/* skip */}}
          onChange={(id, found) => {
            clearError("product_id")
            clearHint("product_id")
            update("product_id", id)
            update("product_name", found?.label ?? "")
          }}
          placeholder="—"
          error={!!errors.product_id}
          hintRed={!!missingHints.product_id}
          disabled={LOCK_SPEC}
        />
        {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
      </div>

      <div>
        <label className={labelCls}>ชนิดข้าว</label>
        <ComboBox
          ref={riceRef}
          title="ชนิดข้าว"
          ariaLabel="ชนิดข้าว"
          searchable
          options={riceOptions}
          value={form.rice_id}
          getValue={getOptValue}
          enterMovesWhenFilled
          onMoveNext={() => {/* skip */}}
          onChange={(id, found) => {
            clearError("rice_id")
            clearHint("rice_id")
            update("rice_id", id)
            update("rice_type", found?.label ?? "")
          }}
          placeholder="—"
          disabled={LOCK_SPEC}
          error={!!errors.rice_id}
          hintRed={!!missingHints.rice_id}
        />
        {errors.rice_id && <p className={errorTextCls}>{errors.rice_id}</p>}
      </div>

      <div>
        <label className={labelCls}>ชั้นย่อย</label>
        <ComboBox
          ref={subriceRef}
          title="ชั้นย่อย"
          ariaLabel="ชั้นย่อย"
          searchable
          options={subriceOptions}
          value={form.subrice_id}
          getValue={getOptValue}
          enterMovesWhenFilled
          onMoveNext={() => {/* skip */}}
          onChange={(id, found) => {
            clearError("subrice_id")
            clearHint("subrice_id")
            update("subrice_id", id)
            update("subrice_name", found?.label ?? "")
          }}
          placeholder="—"
          disabled={LOCK_SPEC}
          error={!!errors.subrice_id}
          hintRed={!!missingHints.subrice_id}
        />
        {errors.subrice_id && <p className={errorTextCls}>{errors.subrice_id}</p>}
      </div>

      <div>
        <label className={labelCls}>สภาพ/เงื่อนไข</label>
        <ComboBox
          ref={conditionRef}
          title="สภาพ/เงื่อนไข"
          ariaLabel="สภาพ/เงื่อนไข"
          options={conditionOptions}
          value={form.condition_id}
          getValue={getOptValue}
          enterMovesWhenFilled
          onMoveNext={() => {/* ไม่อยู่ใน flow */}}
          onChange={(id, found) => {
            update("condition_id", id)
            update("condition_label", found?.label ?? "")
          }}
          placeholder="—"
          disabled={LOCK_SPEC}
        />
      </div>

      <div>
        <label className={labelCls}>ประเภทนา</label>
        <ComboBox
          ref={fieldRef}
          title="ประเภทนา"
          ariaLabel="ประเภทนา"
          options={fieldOptions}
          value={form.field_type_id}
          getValue={getOptValue}
          enterMovesWhenFilled
          onMoveNext={() => {/* skip */}}
          onChange={(id, found) => {
            clearError("field_type_id")
            clearHint("field_type_id")
            update("field_type_id", id)
            update("field_type_label", found?.label ?? "")
          }}
          placeholder="—"
          error={!!errors.field_type_id}
          hintRed={!!missingHints.field_type_id}
          disabled={LOCK_SPEC}
        />
        {errors.field_type_id && <p className={errorTextCls}>{errors.field_type_id}</p>}
      </div>

      <div>
        <label className={labelCls}>ปี/ฤดูกาล</label>
        <ComboBox
          ref={yearRef}
          title="ปี/ฤดูกาล"
          ariaLabel="ปี/ฤดูกาล"
          options={yearOptions}
          value={form.rice_year_id}
          getValue={getOptValue}
          enterMovesWhenFilled
          onMoveNext={() => {/* skip */}}
          onChange={(id, found) => {
            update("rice_year_id", id)
            update("rice_year_label", found?.label ?? "")
          }}
          placeholder="—"
          disabled={LOCK_SPEC}
        />
      </div>

      <div>
        <label className={labelCls}>โปรแกรม</label>
        <ComboBox
          ref={programRef}
          title="โปรแกรม"
          ariaLabel="โปรแกรม"
          options={programOptions}
          value={form.program_id}
          getValue={getOptValue}
          enterMovesWhenFilled
          onMoveNext={() => {/* skip */}}
          onChange={(id, found) => {
            update("program_id", id)
            update("program_label", found?.label ?? "")
          }}
          placeholder="—"
          disabled={LOCK_SPEC}
        />
      </div>

      <div>
        <label className={labelCls}>ประเภทธุรกิจ</label>
        <ComboBox
          ref={businessRef}
          title="ประเภทธุรกิจ"
          ariaLabel="ประเภทธุรกิจ"
          options={businessOptions}
          value={form.business_type_id}
          getValue={getOptValue}
          enterMovesWhenFilled
          onMoveNext={() => {/* ไม่อยู่ใน flow */}}
          onChange={(id, found) => {
            clearError("business_type_id")
            clearHint("business_type_id")
            update("business_type_id", id)
            update("business_type_label", found?.label ?? "")
          }}
          placeholder="—"
          error={!!errors.business_type_id}
          hintRed={!!missingHints.business_type_id}
          disabled={LOCK_SPEC}
        />
        {errors.business_type_id && <p className={errorTextCls}>{errors.business_type_id}</p>}
      </div>
    </div>
  )

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <h1 className="mb-4 flex items-center gap-2.5 text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 md:size-7 text-indigo-600 dark:text-indigo-400">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
            <path d="M15 18H9" />
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
            <circle cx="17" cy="18" r="2" />
            <circle cx="7" cy="18" r="2" />
          </svg>
          โอนออกข้าวเปลือก
        </h1>

        <form onSubmit={handleSubmit}>
          {/* กล่องข้อมูลการโอน + ดรอปดาวน์ฟอร์มสำเร็จรูป (ตำแหน่งแบบเดียวกับหน้า Buy) */}
          <div className={cardSectionCls}>
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <h2 className="text-lg md:text-xl font-semibold">ข้อมูลการโอน</h2>

              <div className="ml-auto w-full sm:w-72 self-start">
                <label className={labelCls}>ฟอร์มสำเร็จรูป</label>
                <ComboBox
                  ref={templateRef}
                  title="ฟอร์มสำเร็จรูป"
                  ariaLabel="ฟอร์มสำเร็จรูป"
                  searchable
                  options={templateOptions}
                  value={formTemplate}
                  getValue={getOptValue}
                  getSubLabel={(o) => templateSubLabel(o)}
                  enterMovesWhenFilled
                  onChange={(id, found) => {
                    const idStr = String(id)
                    setFormTemplate(idStr)
                    try {
                      localStorage.setItem("shared.formTemplate", JSON.stringify({ id: idStr, label: found?.label || "" }))
                      localStorage.setItem("transfer.formTemplate", idStr)
                    } catch { /* ignore localStorage write failure */ }
                    if (found?.spec) applyTemplateBySpec(found.spec)
                  }}
                  /** ⭐ Enter หรือเลือกเสร็จ ➜ เด้งไป "ชื่อผู้ขนส่ง" */
                  onMoveNext={() => {
                    try {
                      driverRef.current?.focus?.()
                      requestAnimationFrame(() => {
                        try { document.activeElement?.scrollIntoView?.({ behavior: "smooth", block: "center" }) } catch { /* scroll best-effort */ }
                      })
                    } catch { /* focus best-effort */ }
                  }}
                  placeholder="— เลือกฟอร์มสำเร็จรูป —"
                />
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  สเปคสินค้ามาจากฟอร์มสำเร็จรูปที่เลือก
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* วันที่ */}
              <div>
                <label htmlFor="transfer_date" className={labelCls}>วันที่โอน</label>
                <DateInput
                  id="transfer_date"
                  ref={dateRef}
                  value={form.transfer_date}
                  onChange={(e) => {
                    clearError("transfer_date")
                    clearHint("transfer_date")
                    update("transfer_date", e.target.value)
                  }}
                  /** ⭐ Enter ที่วันที่ ➜ เด้งไป "ชื่อผู้ขนส่ง" */
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      try {
                        driverRef.current?.focus?.()
                        requestAnimationFrame(() => {
                          try { document.activeElement?.scrollIntoView?.({ behavior: "smooth", block: "center" }) } catch { /* scroll best-effort */ }
                        })
                      } catch { /* focus best-effort */ }
                    }
                  }}
                  error={!!errors.transfer_date}
                  className={redHintCls("transfer_date")}
                  aria-invalid={errors.transfer_date ? true : undefined}
                />
                {errors.transfer_date && <p className={errorTextCls}>{errors.transfer_date}</p>}
              </div>

              {/* ชื่อผู้ขนส่ง */}
              <div>
                <label htmlFor="driver_name" className={labelCls}>ชื่อผู้ขนส่ง</label>
                <input
                  id="driver_name"
                  ref={driverRef}
                  className={cx(baseField, redFieldCls("driver_name"))}
                  value={form.driver_name}
                  onChange={(e) => update("driver_name", e.target.value)}
                  onFocus={() => {
                    clearError("driver_name")
                    clearHint("driver_name")
                  }}
                  onKeyDown={enterToNext(driverRef)}
                  placeholder="เช่น นายสมชาย ขยันงาน"
                  aria-invalid={errors.driver_name ? true : undefined}
                />
                {errors.driver_name && <p className={errorTextCls}>{errors.driver_name}</p>}
              </div>

              {/* ทะเบียนรถ */}
              <div>
                <label htmlFor="plate_number" className={labelCls}>ทะเบียนรถขนส่ง</label>
                <input
                  id="plate_number"
                  ref={plateRef}
                  className={cx(baseField, redFieldCls("plate_number"))}
                  value={form.plate_number}
                  onChange={(e) => update("plate_number", e.target.value)}
                  onFocus={() => {
                    clearError("plate_number")
                    clearHint("plate_number")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusComboRef(branchLock.locked ? fromKlangRef : fromBranchRef)
                    }
                  }}
                  placeholder="เช่น 1ขข-1234 กทม."
                  aria-invalid={errors.plate_number ? true : undefined}
                />
                {errors.plate_number && <p className={errorTextCls}>{errors.plate_number}</p>}
              </div>

              {/* ต้นทาง */}
              <div>
                <label className={labelCls}>สาขาต้นทาง</label>
                <ComboBox
                  ref={fromBranchRef}
                  title="สาขาต้นทาง"
                  ariaLabel="สาขาต้นทาง"
                  options={fromBranchOptions}
                  value={form.from_branch_id}
                  getValue={(o) => o.id}
                  enterMovesWhenFilled
                  onMoveNext={() => focusComboRef(fromKlangRef)}
                  onChange={(_val, found) => {
                    clearError("from_branch_id")
                    clearHint("from_branch_id")
                    update("from_branch_id", found?.id ?? null)
                    update("from_branch_name", found?.label ?? "")
                    update("from_klang_id", null)
                    update("from_klang_name", "")
                  }}
                  placeholder="— เลือกสาขาต้นทาง —"
                  error={!!errors.from_branch_id}
                  hintRed={!!missingHints.from_branch_id}
                  clearHint={() => clearHint("from_branch_id")}
                  disabled={branchLock.locked}
                />
                {errors.from_branch_id && <p className={errorTextCls}>{errors.from_branch_id}</p>}
                {branchLock.locked && <BranchLockNote />}
              </div>

              <div>
                <label className={labelCls}>คลังต้นทาง</label>
                <ComboBox
                  ref={fromKlangRef}
                  title="คลังต้นทาง"
                  ariaLabel="คลังต้นทาง"
                  options={fromKlangOptions}
                  value={form.from_klang_id}
                  getValue={(o) => o.id}
                  enterMovesWhenFilled
                  onMoveNext={() => focusComboRef(toBranchRef)}
                  onChange={(_val, found) => {
                    clearError("from_klang_id")
                    clearHint("from_klang_id")
                    update("from_klang_id", found?.id ?? null)
                    update("from_klang_name", found?.label ?? "")
                  }}
                  placeholder="— เลือกคลังต้นทาง —"
                  disabled={!form.from_branch_id}
                  error={!!errors.from_klang_id}
                  hintRed={!!missingHints.from_klang_id}
                  clearHint={() => clearHint("from_klang_id")}
                />
                {!form.from_branch_id && <p className={helpTextCls}>เลือกสาขาต้นทางก่อน</p>}
                {errors.from_klang_id && <p className={errorTextCls}>{errors.from_klang_id}</p>}
              </div>

              <div className="hidden md:block" />

              {/* ปลายทาง */}
              <div>
                <label className={labelCls}>สาขาปลายทาง</label>
                <ComboBox
                  ref={toBranchRef}
                  title="สาขาปลายทาง"
                  ariaLabel="สาขาปลายทาง"
                  options={toBranchOptions}
                  value={form.to_branch_id}
                  getValue={(o) => o.id}
                  enterMovesWhenFilled
                  onMoveNext={() => focusComboRef(toKlangRef)}
                  onChange={(_val, found) => {
                    clearError("to_branch_id")
                    clearHint("to_branch_id")
                    update("to_branch_id", found?.id ?? null)
                    update("to_branch_name", found?.label ?? "")
                    update("to_klang_id", null)
                    update("to_klang_name", "")
                  }}
                  placeholder="— เลือกสาขาปลายทาง —"
                  error={!!errors.to_branch_id}
                  hintRed={!!missingHints.to_branch_id}
                  clearHint={() => clearHint("to_branch_id")}
                />
                {errors.to_branch_id && <p className={errorTextCls}>{errors.to_branch_id}</p>}
              </div>

              <div>
                <label className={labelCls}>คลังปลายทาง</label>
                <ComboBox
                  ref={toKlangRef}
                  title="คลังปลายทาง"
                  ariaLabel="คลังปลายทาง"
                  options={toKlangOptions}
                  value={form.to_klang_id}
                  getValue={(o) => o.id}
                  enterMovesWhenFilled
                  /** ⭐ เลือกคลังปลายทางเสร็จ ➜ ไป "น้ำหนักขาเข้า (รถเปล่า)" */
                  onMoveNext={() => {
                    try {
                      weightInRef.current?.focus?.()
                      requestAnimationFrame(() => {
                        try { document.activeElement?.scrollIntoView?.({ behavior: "smooth", block: "center" }) } catch { /* scroll best-effort */ }
                      })
                    } catch { /* focus best-effort */ }
                  }}
                  onChange={(_val, found) => {
                    clearError("to_klang_id")
                    clearHint("to_klang_id")
                    update("to_klang_id", found?.id ?? null)
                    update("to_klang_name", found?.label ?? "")
                  }}
                  placeholder="— เลือกคลังปลายทาง —"
                  disabled={!form.to_branch_id}
                  error={!!errors.to_klang_id}
                  hintRed={!!missingHints.to_klang_id}
                  clearHint={() => clearHint("to_klang_id")}
                />
                {!form.to_branch_id && <p className={helpTextCls}>เลือกสาขาปลายทางก่อน</p>}
                {errors.to_klang_id && <p className={errorTextCls}>{errors.to_klang_id}</p>}
              </div>

              <div className="hidden md:block" />
            </div>
          </div>

          {/* สินค้า + เมตาดาต้า (ล็อกจาก Template) */}
          <div className={cardSectionCls}>
            <h2 className={sectionTitleCls}>สินค้า / คุณสมบัติ (ข้าวเปลือก)</h2>

            {isPhone ? (
              <>
                {/* read-only card ของสเปคที่ล็อก (UI-SPEC §7 / §3.2) */}
                <dl className="divide-y divide-gray-100 rounded-2xl bg-gray-50 px-4 dark:divide-gray-700/70 dark:bg-gray-900/40">
                  {lockedSpecRows.map((r) => (
                    <div key={r.key} className="py-2.5">
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">{r.label}</dt>
                        <dd className="text-right text-base font-medium leading-relaxed text-gray-900 dark:text-gray-100">{r.value || "—"}</dd>
                      </div>
                      {errors[r.key] && <p className={errorTextCls}>{errors[r.key]}</p>}
                    </div>
                  ))}
                </dl>
                <p className={helpTextCls}>ตามฟอร์มสำเร็จรูป</p>
                <details className="group mt-3">
                  <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-1 text-sm font-medium text-gray-700 dark:text-gray-200 [&::-webkit-details-marker]:hidden">
                    ดูช่องสเปคทั้งหมด
                    <ChevronDown aria-hidden="true" strokeWidth={1.75} className="size-5 text-gray-400 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none dark:text-gray-500" />
                  </summary>
                  <div className="pt-3">{specGrid}</div>
                </details>
              </>
            ) : (
              specGrid
            )}
          </div>

          {/* ชั่ง/ราคา */}
          <div className={cardSectionCls}>
            <h2 className={sectionTitleCls}>ชั่งน้ำหนักและต้นทุน</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <label htmlFor="weight_in" className={labelCls}>น้ำหนักขาเข้า (รถเปล่า) กก.</label>
                <input
                  id="weight_in"
                  ref={weightInRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, "tabular-nums", redFieldCls("weight_in"))}
                  value={form.weight_in}
                  onChange={(e) => update("weight_in", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("weight_in")
                    clearHint("weight_in")
                  }}
                  onKeyDown={enterToNext(weightInRef)}
                  placeholder="เช่น 9000"
                  aria-invalid={errors.weight_in ? true : undefined}
                />
                {errors.weight_in && <p className={errorTextCls}>{errors.weight_in}</p>}
                <p className={helpTextCls}>* ต้องเป็นจำนวนเต็มกิโลกรัม</p>
              </div>

              <div>
                <label htmlFor="weight_out" className={labelCls}>น้ำหนักขาออก (รถ + ข้าว) กก.</label>
                <input
                  id="weight_out"
                  ref={weightOutRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, "tabular-nums", redFieldCls("weight_out"))}
                  value={form.weight_out}
                  onChange={(e) => update("weight_out", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("weight_out")
                    clearHint("weight_out")
                  }}
                  onKeyDown={enterToNext(weightOutRef)}
                  placeholder="เช่น 24000"
                  aria-invalid={errors.weight_out ? true : undefined}
                />
                {errors.weight_out && <p className={errorTextCls}>{errors.weight_out}</p>}
                <p className={helpTextCls}>* ต้องเป็นจำนวนเต็มกิโลกรัม และมากกว่า “ขาเข้า”</p>
              </div>

              <div className="col-span-2 md:col-span-1">
                {isPhone ? (
                  <div
                    className={cx(
                      "rounded-2xl bg-gray-50 p-4 ring-1 ring-indigo-200/60 dark:bg-gray-800/60 dark:ring-indigo-500/30",
                      errors.net_weight && "ring-red-300 dark:ring-red-500/50"
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    <p className="text-sm text-gray-500 dark:text-gray-400">น้ำหนักสุทธิ</p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{nf(netWeightInt)} กก.</p>
                    <p className={helpTextCls}>คำนวณ = น้ำหนักขาออก − น้ำหนักขาเข้า</p>
                  </div>
                ) : (
                  <>
                    <label className={labelCls}>น้ำหนักสุทธิ (กก.)</label>
                    <input disabled aria-label="น้ำหนักสุทธิ (กก.)" className={cx(baseField, fieldDisabled, "tabular-nums")} value={netWeightInt} />
                    <p className={helpTextCls}>คำนวณ = น้ำหนักขาออก − น้ำหนักขาเข้า</p>
                  </>
                )}
                {errors.net_weight && <p className={errorTextCls}>{errors.net_weight}</p>}
              </div>

              <div>
                <label htmlFor="cost_per_kg" className={labelCls}>ราคาต้นทุน (บาท/กก.)</label>
                <input
                  id="cost_per_kg"
                  ref={costRef}
                  inputMode="decimal"
                  className={cx(baseField, "tabular-nums", redFieldCls("cost_per_kg"))}
                  value={form.cost_per_kg}
                  onChange={(e) => update("cost_per_kg", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => { clearError("cost_per_kg"); clearHint("cost_per_kg") }}
                  onKeyDown={enterToNext(costRef)}
                  placeholder="เช่น 8.50"
                  aria-invalid={errors.cost_per_kg ? true : undefined}
                />
                {errors.cost_per_kg && <p className={errorTextCls}>{errors.cost_per_kg}</p>}
              </div>

              <div>
                <label className={labelCls}>ราคาสุทธิ (บาท)</label>
                <input disabled aria-label="ราคาสุทธิ (บาท)" className={cx(baseField, fieldDisabled, "tabular-nums")} value={thb(totalCost)} />
                <p className={helpTextCls}>คำนวณ = ราคาต้นทุน × น้ำหนักสุทธิ</p>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label htmlFor="impurity_percent" className={labelCls}>สิ่งเจือปน (%)</label>
                <input
                  id="impurity_percent"
                  ref={impurityRef}
                  inputMode="decimal"
                  className={cx(baseField, "tabular-nums", redFieldCls("impurity_percent"))}
                  value={form.impurity_percent}
                  onChange={(e) => update("impurity_percent", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => { clearError("impurity_percent"); clearHint("impurity_percent") }}
                  onKeyDown={enterToNext(impurityRef)}
                  placeholder="เช่น 2.5"
                  aria-invalid={errors.impurity_percent ? true : undefined}
                />
                {errors.impurity_percent && <p className={errorTextCls}>{errors.impurity_percent}</p>}
                <p className={helpTextCls}>กรอกเป็นตัวเลข 0–100</p>
              </div>
            </div>
          </div>

          {/* สรุปก่อนบันทึก */}
          <div className="mb-4 md:mb-6">
            <h2 className={sectionTitleCls}>สรุปก่อนบันทึก</h2>
            {isPhone ? (
              <dl className={cx(cardCls, "divide-y divide-gray-100 px-4 dark:divide-gray-700/70")}>
                {summaryRows.map((c) => (
                  <div key={c.label} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="shrink-0 text-sm text-gray-500 dark:text-gray-400">{c.label}</dt>
                    <dd className={cx("min-w-0 text-right text-base font-medium leading-relaxed whitespace-pre-line text-gray-900 dark:text-gray-100", c.numeric && "tabular-nums")}>
                      {c.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="grid gap-4 md:grid-cols-5">
                {summaryRows.map((c) => (
                  <div
                    key={c.label}
                    className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 transition-shadow duration-150 hover:shadow-md dark:bg-slate-800 dark:text-white dark:ring-slate-700"
                  >
                    <div className="text-sm text-slate-600 dark:text-slate-300">{c.label}</div>
                    <div className={cx("text-lg md:text-xl font-semibold whitespace-pre-line", c.numeric && "tabular-nums")}>
                      {c.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ปุ่ม — <md: แถบติดล่าง (UI-SPEC §7) · ≥md: ปุ่มเดิม (saveBtnRef อยู่ใน Enter flow) */}
          {isPhone ? (
            <StickyActionBar
              summary={barSummary}
              secondary={{ label: "ล้างฟอร์ม", onClick: handleReset, disabled: submitting }}
              primary={{ label: submitting ? "กำลังบันทึก…" : "บันทึก", onClick: handleSubmit, loading: submitting }}
            />
          ) : (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                ref={saveBtnRef}
                type="submit"
                disabled={submitting}
                onClick={scrollToPageTop}
                className={submitBtnCls}
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

export default StockTransferOut
