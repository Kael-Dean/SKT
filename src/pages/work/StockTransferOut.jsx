// src/pages/StockTransferOut.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
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
import ProductFormPicker, { SpecChips } from "../../components/ProductFormPicker"
import useProductForms, { specFromForm } from "../../lib/useProductForms"
import { getActiveBranch } from "../../lib/auth"
import { StickyActionBar, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"

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
/** ชื่อฟิลด์สั้นสำหรับ toast "กรอกไม่ครบ" (mobile-copy §3.3) */
const FIELD_LABELS = {
  transfer_date: "วันที่โอน",
  from_branch_id: "สาขาต้นทาง",
  form_template: "ฟอร์มสินค้า",
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

  /** ---------- ฟอร์มสินค้า (handoff F30) — สเปคทั้ง 8 ค่ามาจากฟอร์มที่เลือก ---------- */
  const productForms = useProductForms()
  const [formTemplate, setFormTemplate] = useState("")
  const selectedForm = productForms.findForm(formTemplate)
  const selectedChips = selectedForm ? productForms.chipsFor(selectedForm.spec) : []

  /** ---------- Dropdown states ---------- */
  const [fromBranchOptions, setFromBranchOptions] = useState([])
  const [toBranchOptions, setToBranchOptions] = useState([])
  const [fromKlangOptions, setFromKlangOptions] = useState([])
  const [toKlangOptions, setToKlangOptions] = useState([])

  /** สาขาต้นทาง = สาขาที่ใช้งานอยู่ (แถบบน) เสมอ — backend รับเฉพาะสาขานี้ (handoff F7).
   *  สาขาปลายทางเลือกได้ตามปกติ */
  const activeBranchId = getActiveBranch()
  const activeBranchKey = activeBranchId == null ? "" : String(activeBranchId)

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    transfer_date: new Date().toISOString().slice(0, 10),

    from_branch_id: activeBranchId,
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

  /** ---------- Load branches ---------- */
  useEffect(() => {
    const loadStatic = async () => {
      try {
        const branches = await get("/order/branch/search")
        const brs = (branches || []).map((b) => ({ id: b.id, label: b.branch_name }))
        setFromBranchOptions(brs)
        setToBranchOptions(brs)
      } catch (e) {
        console.error("load branches error:", e)
        setFromBranchOptions([])
        setToBranchOptions([])
      }
    }
    loadStatic()
  }, [])

  /** สาขาต้นทาง → สาขาที่ใช้งานอยู่ + ชื่อจากรายการสาขา */
  useEffect(() => {
    if (!activeBranchKey) return
    const found = fromBranchOptions.find((b) => String(b.id) === activeBranchKey)
    setForm((p) => {
      const name = found?.label ?? ""
      if (String(p.from_branch_id ?? "") === activeBranchKey && p.from_branch_name === name) return p
      const sameBranch = String(p.from_branch_id ?? "") === activeBranchKey
      return {
        ...p,
        from_branch_id: found?.id ?? activeBranchId,
        from_branch_name: name,
        ...(sameBranch ? null : { from_klang_id: null, from_klang_name: "" }),
      }
    })
  }, [activeBranchKey, activeBranchId, fromBranchOptions])

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

    if (!formTemplate) m.form_template = true

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

    if (!formTemplate) e.form_template = "กรุณาเลือกฟอร์มสินค้า"
    else if (!selectedForm) e.form_template = "ฟอร์มสินค้านี้ใช้งานไม่ได้แล้ว เลือกฟอร์มอื่น"

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
  const buildSpec = () => specFromForm(selectedForm)

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

  /** คงเหลือในคลังต้นทางของสินค้านี้ (รวมยอดยกมา) — แสดงให้เห็นก่อนกรอกน้ำหนัก (handoff F6) */
  const [originStock, setOriginStock] = useState({ status: "idle", available: null })
  useEffect(() => {
    if (!form.from_klang_id || !selectedForm) { setOriginStock({ status: "idle", available: null }); return }
    let alive = true
    setOriginStock({ status: "loading", available: null })
    post("/transfer/stock/lookup", { klang_id: Number(form.from_klang_id), spec: specFromForm(selectedForm) })
      .then((rows) => {
        if (!alive) return
        const total = (rows || []).reduce((s, r) => s + Number(r?.available ?? 0), 0)
        setOriginStock({ status: "ready", available: total })
      })
      .catch(() => alive && setOriginStock({ status: "error", available: null }))
    return () => { alive = false }
  }, [form.from_klang_id, selectedForm])

  /** ---------- Keyboard & focus flow ---------- */
  const driverRef = useRef(null)
  const plateRef = useRef(null)
  const fromBranchRef = useRef(null)
  const fromKlangRef = useRef(null)
  const toBranchRef = useRef(null)
  const toKlangRef = useRef(null)
  const weightInRef = useRef(null)
  const weightOutRef = useRef(null)
  const costRef = useRef(null)
  const impurityRef = useRef(null)
  const saveBtnRef = useRef(null)
  const dateRef = useRef(null)
  /** ปุ่มของตัวเลือกฟอร์มสินค้า */
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
    "form_template",
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
    form_template: templateRef,
    weight_in: weightInRef,
    weight_out: weightOutRef,
    cost_per_kg: costRef,
    impurity_percent: impurityRef,
  }
  const comboKeys = new Set([
    "from_branch_id","from_klang_id","to_branch_id","to_klang_id",
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
    const valueOf = (k) => (k === "form_template" ? formTemplate : form[k])
    const missingKeys = errorOrder.filter((k) => hints[k] && k !== "net_weight" && (valueOf(k) === "" || valueOf(k) == null))
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
    // สินค้า/สเปคอ่านจากฟอร์มที่เลือกโดยตรง — ไม่หลุดเมื่อเปลี่ยนฟอร์ม (handoff F24)
    { label: "ฟอร์มสินค้า", value: selectedForm?.label || "—", wide: true },
    { label: "สเปค", value: selectedChips.length ? <SpecChips chips={selectedChips} className="mt-1" /> : "—", wide: true },
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
            <h2 className={sectionTitleCls}>ข้อมูลการโอน</h2>

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
                      focusComboRef(fromKlangRef)
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
                  placeholder={activeBranchKey ? "กำลังโหลด…" : "— เลือกสาขาที่แถบด้านบน —"}
                  error={!!errors.from_branch_id}
                  hintRed={!!missingHints.from_branch_id}
                  clearHint={() => clearHint("from_branch_id")}
                  disabled
                />
                {errors.from_branch_id
                  ? <p className={errorTextCls}>{errors.from_branch_id}</p>
                  : <p className={helpTextCls}>โอนออกได้จากสาขาที่ใช้งานอยู่เท่านั้น — สลับสาขาที่แถบด้านบน</p>}
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
                {originStock.status === "loading" && <p className={helpTextCls}>กำลังตรวจสต็อกคงเหลือ…</p>}
                {originStock.status === "ready" && (
                  <p className={cx(helpTextCls, netWeightInt > originStock.available && "!text-red-600 dark:!text-red-400")}>
                    คงเหลือของสินค้านี้ในคลัง: <span className="font-medium tabular-nums">{nf(originStock.available)} กก.</span>
                  </p>
                )}
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

          {/* สินค้า — ฟอร์มสินค้าตัวเดียว + ชิปสเปค (handoff F30) */}
          <div className={cardSectionCls}>
            <h2 className={sectionTitleCls}>สินค้า</h2>
            <ProductFormPicker
              id="transfer-form"
              forms={productForms}
              value={formTemplate}
              storageKey="transfer.formTemplate"
              onChange={(id) => { clearError("form_template"); clearHint("form_template"); setFormTemplate(id) }}
              error={errors.form_template}
              hintRed={!!missingHints.form_template}
              clearHint={() => clearHint("form_template")}
              buttonRef={templateRef}
              onEnterNext={() => { weightInRef.current?.focus?.(); requestAnimationFrame(scrollActiveIntoView) }}
              className="md:max-w-2xl"
            />
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
                    className={cx(c.wide && "md:col-span-5", "rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 transition-shadow duration-150 hover:shadow-md dark:bg-slate-800 dark:text-white dark:ring-slate-700")}
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
